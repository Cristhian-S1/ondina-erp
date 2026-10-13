-- ============================================================
-- 0007_fix_triggers_ventas.sql — Triggers faltantes del módulo de ventas
-- ============================================================
-- La migración 0001_init.sql definió los triggers de negocio para ventas
-- (descuento de carga, cálculo de total, anulación) pero nunca se aplicó
-- al Supabase. Solo se aplicaron 0002-0005. Esta migración crea los
-- triggers faltantes y repara los datos históricos.
--
-- Triggers creados:
--   1. trg_venta_detalle_insert — descuenta carga del vendedor al vender
--      y valida que tenga stock suficiente. También suma envases recibidos
--      al stock_envases de la sucursal.
--   2. trg_venta_recalcular_total — recalcula el total de la venta
--      (suma de subtotales - descuento) tras insertar/update/delete un
--      detalle.
--   3. trg_venta_anular — devuelve la carga al vendedor y resta envases
--      al anular una venta.
--
-- Además repara datos históricos:
--   A. ventas.total = 0 → recalcula desde venta_detalles.subtotal
--   B. carga_vendedor.cantidad → descuenta las ventas no anuladas
--================================================================

-- ---------------------------------------------------------------------------
-- 1. Función: descontar carga del vendedor al insertar un detalle de venta
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta  public.ventas%rowtype;
    v_empaque uuid;
begin
    select * into v_venta from public.ventas where id = new.venta_id;
    if v_venta.anulado then
        raise exception 'La venta está anulada';
    end if;

    -- Descontar de la carga del vendedor
    update public.carga_vendedor
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where vendedor_id = v_venta.vendedor_id
      and producto_id  = new.producto_id;
    if not found then
        raise exception 'El vendedor no tiene carga del producto %', new.producto_id;
    end if;
    if (select cantidad from public.carga_vendedor
        where vendedor_id = v_venta.vendedor_id and producto_id = new.producto_id) < 0 then
        raise exception 'Carga insuficiente del vendedor para el producto %', new.producto_id;
    end if;

    -- Envases recibidos de la venta suman al inventario de vacíos de la sucursal
    if new.envases_recibidos > 0 then
        select tipo_empaque_id into v_empaque
        from public.productos where id = new.producto_id;
        if v_empaque is not null then
            insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
            values (v_venta.sucursal_id, v_empaque, new.envases_recibidos, now())
            on conflict (sucursal_id, tipo_empaque_id)
            do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                          modificado_en = now();
        end if;
    end if;

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Función: recalcular el total de la venta tras insertar/editar/borrar detalle
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_recalcular_total()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
    update public.ventas v
    set total = greatest(
        coalesce((select sum(subtotal) from public.venta_detalles where venta_id = v_venta), 0) - v.descuento,
        0)
    where v.id = v_venta;
    return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Función: anular venta → devolver carga y restar envases
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    vd record;
    v_empaque uuid;
begin
    for vd in select producto_id, cantidad, envases_recibidos
              from public.venta_detalles where venta_id = new.id loop
        update public.carga_vendedor
        set cantidad = cantidad + vd.cantidad, modificado_en = now()
        where vendedor_id = new.vendedor_id
          and producto_id = vd.producto_id;

        if vd.envases_recibidos > 0 then
            select tipo_empaque_id into v_empaque
            from public.productos where id = vd.producto_id;
            if v_empaque is not null then
                update public.stock_envases
                set cantidad = greatest(cantidad - vd.envases_recibidos, 0),
                    modificado_en = now()
                where sucursal_id = new.sucursal_id
                  and tipo_empaque_id = v_empaque;
            end if;
        end if;
    end loop;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Crear los triggers
-- ---------------------------------------------------------------------------
create trigger trg_venta_detalle_insert after insert on public.venta_detalles
    for each row execute function public.trg_venta_detalle_insert();

create trigger trg_venta_total_ins after insert on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();

create trigger trg_venta_total_upd after update on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();

create trigger trg_venta_total_del after delete on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();

create trigger trg_venta_anular after update of anulado on public.ventas
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_venta_anular();

-- ---------------------------------------------------------------------------
-- 5. Reparar datos históricos
-- ---------------------------------------------------------------------------

-- 5a. Recalcular total de ventas existentes con total = 0
update public.ventas v
set total = greatest(
    coalesce((select sum(subtotal) from public.venta_detalles where venta_id = v.id), 0) - v.descuento,
    0)
where v.total = 0 and not v.anulado;

-- 5b. Descontar de carga_vendedor las ventas no anuladas que no fueron
-- descontadas (porque el trigger no existía). La carga actual refleja
-- despachos y devoluciones pero NO ventas. Restamos el total vendido.
with ventas_no_anuladas as (
    select v.vendedor_id, vd.producto_id, sum(vd.cantidad) as total_vendido
    from public.ventas v
    join public.venta_detalles vd on vd.venta_id = v.id
    where not v.anulado
    group by v.vendedor_id, vd.producto_id
)
update public.carga_vendedor cv
set cantidad = greatest(cv.cantidad - vna.total_vendido, 0),
    modificado_en = now()
from ventas_no_anuladas vna
where cv.vendedor_id = vna.vendedor_id
  and cv.producto_id = vna.producto_id;