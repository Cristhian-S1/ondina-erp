-- ============================================================================
-- Triggers de bodega: despacho y devoluciones — Ondina
-- ============================================================================
-- Script para cargar en el SQL Editor de Supabase (proyecto dev
-- rhivlzwtobhiguzmkiat). Hace operativos los movimientos de stock que el
-- esquema ya define pero que NO están cargados en la BD:
--
--   - Crear despacho          -> descuenta stock_bodega y suma carga_vendedor
--   - Devolución de productos -> carga_vendedor -=, stock_bodega +=
--   - Devolución de envases   -> stock_envases += (solo estado 'bueno')
--   - Anulaciones             -> revierten los movimientos anteriores
--
-- NOTA DE MODELO (envases): stock_envases = envases vacíos físicamente en
-- bodega. La venta registra envases_recibidos para reporte pero NO mueve
-- stock; la devolución de envases aquí es la única entrada que suma al
-- inventario de vacíos (evita doble conteo).
--
-- Requisito previo: tablas + políticas RLS ya aplicadas en el proyecto.
-- No depende de los dominios venta, producción ni merma.
--
-- Idempotente: las funciones usan CREATE OR REPLACE y los triggers se crean
-- tras un DROP IF EXISTS, por lo que puede re-ejecutarse sin errores.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Parámetro de configuración usado por el trigger de despacho (RNF-15)
-- ---------------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion)
values ('ventana_ajuste_minutos', '15',
        'Minutos para sumar productos a un despacho ya registrado (RNF-15: 10-20)')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 1) Despacho: valida stock, descuenta stock_bodega y suma carga_vendedor
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho     public.despachos%rowtype;
    v_minutos      integer;
    v_stock_actual integer;
begin
    select * into v_despacho
    from public.despachos where id = new.despacho_id for update;
    if v_despacho.anulado then
        raise exception 'El despacho está anulado';
    end if;

    -- Los ajustes solo suman y solo dentro de la ventana configurable
    if new.es_ajuste then
        select valor::integer into v_minutos
        from public.configuracion where clave = 'ventana_ajuste_minutos';
        if now() > v_despacho.creado_en + make_interval(mins => coalesce(v_minutos, 0)) then
            raise exception 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        end if;
    end if;

    select cantidad into v_stock_actual
    from public.stock_bodega
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente en bodega para el producto %', new.producto_id;
    end if;
    update public.stock_bodega
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id;

    insert into public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    values (v_despacho.vendedor_id, new.producto_id, new.cantidad, now())
    on conflict (vendedor_id, producto_id)
    do update set cantidad = carga_vendedor.cantidad + excluded.cantidad,
                  modificado_en = now();

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Devolución de productos: carga -> bodega
-- ---------------------------------------------------------------------------
-- CORREGIDO: valida que el vendedor tenga carga suficiente y lanza error, en
-- lugar de recortar con greatest(cantidad - X, 0) que creaba stock fantasma.
create or replace function public.trg_devolucion_producto_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
    v_carga    integer;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;

    select cantidad into v_carga
    from public.carga_vendedor
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id
    for update;
    if v_carga is null or v_carga < new.cantidad then
        raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
    end if;

    update public.carga_vendedor
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id;

    insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
    values (v_despacho.sucursal_id, new.producto_id, new.cantidad, now())
    on conflict (sucursal_id, producto_id)
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad,
                  modificado_en = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Devolución de envases: suma al inventario de vacíos (solo estado bueno)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_envase_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    if new.estado = 'bueno' then
        insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
        values (v_sucursal, new.tipo_empaque_id, new.cantidad, now())
        on conflict (sucursal_id, tipo_empaque_id)
        do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                      modificado_en = now();
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Anular despacho: devolver a stock_bodega y quitar de carga_vendedor
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    dd record;
begin
    for dd in select producto_id, sum(cantidad) as total
              from public.despacho_detalles where despacho_id = new.id
              group by producto_id loop
        update public.stock_bodega
        set cantidad = cantidad + dd.total, modificado_en = now()
        where sucursal_id = new.sucursal_id and producto_id = dd.producto_id;

        update public.carga_vendedor
        set cantidad = greatest(cantidad - dd.total, 0), modificado_en = now()
        where vendedor_id = new.vendedor_id and producto_id = dd.producto_id;
    end loop;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Anular devolución de productos: revertir (carga vuelve a subir, bodega baja)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_producto_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;
    if v_despacho.anulado then
        return new;
    end if;
    update public.carga_vendedor
    set cantidad = cantidad + new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id and producto_id = new.producto_id;

    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Anular devolución de envase (bueno): restar lo sumado al stock_envases
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_envase_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    if new.estado <> 'bueno' then
        return new;
    end if;
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    update public.stock_envases
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_sucursal and tipo_empaque_id = new.tipo_empaque_id;
    return new;
end;
$$;

-- ===========================================================================
-- Activación de los triggers de bodega
-- ===========================================================================
drop trigger if exists trg_despacho_detalle_insert on public.despacho_detalles;
create trigger trg_despacho_detalle_insert after insert on public.despacho_detalles
    for each row execute function public.trg_despacho_detalle_insert();

drop trigger if exists trg_devolucion_producto on public.devoluciones_productos;
create trigger trg_devolucion_producto after insert on public.devoluciones_productos
    for each row execute function public.trg_devolucion_producto_insert();

drop trigger if exists trg_devolucion_envase on public.devoluciones_envases;
create trigger trg_devolucion_envase after insert on public.devoluciones_envases
    for each row execute function public.trg_devolucion_envase_insert();

drop trigger if exists trg_despacho_anular on public.despachos;
create trigger trg_despacho_anular after update of anulado on public.despachos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_despacho_anular();

drop trigger if exists trg_devolucion_producto_anular on public.devoluciones_productos;
create trigger trg_devolucion_producto_anular after update of anulado
    on public.devoluciones_productos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_producto_anular();

drop trigger if exists trg_devolucion_envase_anular on public.devoluciones_envases;
create trigger trg_devolucion_envase_anular after update of anulado
    on public.devoluciones_envases
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_envase_anular();

commit;
