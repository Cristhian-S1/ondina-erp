-- ============================================================================
-- Triggers de negocio — Ondina (esquema final)
-- ============================================================================
-- Reglas de inventario que NO pueden vivir solo en React (RNF-03, RNF-15):
-- el stock lo mantienen las funciones de la base de datos, no el frontend.
-- Adaptado al esquema final: claves compuestas por sucursal en stock_bodega,
-- stock_envases, despachos, ventas, producciones, devoluciones y mermas.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql
-- Requiere: bd/rls_policies.sql (funciones es_rol / mi_sucursal) si se usan.
-- Nota: `configuracion.valor` es text; los triggers lo castearán a integer
-- (ventana_ajuste_minutos) cuando se lea. Si el valor se setea mal desde la
-- app, el trigger fallará en runtime. La UI de administración debe validar el
-- tipo antes de escribir el parámetro (la BD no valida el contenido aquí).
-- Orden sugerido: esquema → triggers_negocio.sql → auditoria.sql
--                → vistas.sql → seed.sql → rls_policies.sql.
--
-- Envases por despacho: `despacho_envases` registra las bandejas/cajas de
-- transporte (uso_interno) que salen con el despacho. El trigger descuenta de
-- stock_envases; la devolución de envases lo reingresa; la anulación del
-- despacho lo devuelve (sección 8b).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Despacho: valida ventana, descuenta stock_bodega y suma carga_vendedor
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

    -- HU-26 / RNF-15: los ajustes solo suman y solo dentro de la ventana configurable
    if new.es_ajuste then
        select valor::integer into v_minutos
        from public.configuracion where clave = 'ventana_ajuste_minutos';
        if now() > v_despacho.creado_en + make_interval(mins => coalesce(v_minutos, 0)) then
            raise exception 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        end if;
    end if;

    -- Descuenta stock de bodega de la sucursal (clave compuesta)
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

    -- Suma a la carga del vendedor (el vendedor pertenece a la sucursal)
    insert into public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    values (v_despacho.vendedor_id, new.producto_id, new.cantidad, now())
    on conflict (vendedor_id, producto_id)
    do update set cantidad = carga_vendedor.cantidad + excluded.cantidad,
                  modificado_en = now();

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1b. Despacho de envases (bandejas/cajas): descuenta stock_envases
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_envase_insert()
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

    -- HU-26 / RNF-15: los ajustes solo suman y solo dentro de la ventana configurable
    if new.es_ajuste then
        select valor::integer into v_minutos
        from public.configuracion where clave = 'ventana_ajuste_minutos';
        if now() > v_despacho.creado_en + make_interval(mins => coalesce(v_minutos, 0)) then
            raise exception 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        end if;
    end if;

    -- Descuenta envases vacíos de la sucursal (clave compuesta)
    select cantidad into v_stock_actual
    from public.stock_envases
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente de envases para el tipo %', new.tipo_empaque_id;
    end if;
    update public.stock_envases
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and tipo_empaque_id = new.tipo_empaque_id;

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Venta: descuenta de la carga del vendedor (registra envases, no mueve stock)
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta  public.ventas%rowtype;
begin
    select * into v_venta from public.ventas where id = new.venta_id;
    if v_venta.anulado then
        raise exception 'La venta está anulada';
    end if;

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

    -- NOTA DE MODELO: `envases_recibidos` se registra aquí con fines de reporte
    -- (cuántos envases vacíos devolvió el cliente), pero NO mueve stock_envases.
    -- Los envases aún viajan con el vendedor; solo la devolución de envases del
    -- despachador (trg_devolucion_envase_insert) suma al inventario de vacíos de
    -- la sucursal, cuando el envase llega físicamente a bodega. Así hay una sola
    -- entrada y no existe doble conteo.

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Venta: real aproxima el total (suma de subtotales - descuento)
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
-- 4. Devolución de productos: carga -> bodega
-- ---------------------------------------------------------------------------
-- Validación: se devuelve hasta lo que el vendedor tiene en carga. Antes se
-- recortaba con greatest(cantidad - X, 0), lo que podía crear "stock fantasma"
-- en bodega si se devolvía más de lo despachado.
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
    if not es_rol('administrador') then
        if v_carga is null or v_carga < new.cantidad then
            raise exception 'Carga insuficiente del vendedor para devolver el producto %', new.producto_id;
        end if;
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
-- 5. Devolución de envase: suma al inventario de vacíos (solo estado bueno)
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
-- 6. Producción: suma al stock de bodega
-- ---------------------------------------------------------------------------
create or replace function public.trg_produccion_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
    values (new.sucursal_id, new.producto_id, new.cantidad, now())
    on conflict (sucursal_id, producto_id)
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad, modificado_en = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Merma: descuenta carga (ruta) o bodega (planta) o stock de envases (vacíos
--    rotos se descuentan del inventario de envases de la sucursal)
-- ---------------------------------------------------------------------------
create or replace function public.trg_merma_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    if new.producto_id is not null then
        if new.despacho_id is not null then
            select * into v_despacho from public.despachos where id = new.despacho_id;
            update public.carga_vendedor
            set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id  = new.producto_id;
        else
            update public.stock_bodega
            set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
            where sucursal_id = new.sucursal_id
              and producto_id  = new.producto_id;
        end if;
    elsif new.tipo_empaque_id is not null then
        update public.stock_envases
        set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id;
    end if;
    return new;
end;
$$;

-- ===========================================================================
-- 8. Reversión de stock al anular (anulado pasa de false a true)
-- ===========================================================================
-- Las anulaciones no se borran: marcan `anulado = true`. La reversión de los
-- movimientos de stock la hace la BD (no el frontend) para preservar la
-- integrididad aun si se llama la API directamente. Cada función retorna las
-- existencias al estado previo de la operación anulada. Si el stock había
-- cambiado por operaciones posteriores, se respeta el no-negativo con
-- greatest(..., 0). Estos triggers se disparan SOLO en la transición
-- `anulado: false -> true`; una posterior reactivación NO restaura movimientos
-- (la decisión de revertir deja claro que la operación debe registrarse de
-- nuevo, no reactivarse acríticamente).
-- ---------------------------------------------------------------------------

-- 8a. Anular venta: devolver carga al vendedor
create or replace function public.trg_venta_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    vd record;
begin
    -- Por cada detalle de la venta: sumamos a la carga del vendedor
    -- (en el INSERT se había restado). No se toca stock_envases porque la
    -- venta no lo movió (ver trg_venta_detalle_insert: los envases se cuentan
    -- cuando el despachador registra la devolución en bodega).
    for vd in select producto_id, cantidad
              from public.venta_detalles where venta_id = new.id loop
        update public.carga_vendedor
        set cantidad = cantidad + vd.cantidad, modificado_en = now()
        where vendedor_id = new.vendedor_id
          and producto_id = vd.producto_id;
    end loop;
    return new;
end;
$$;

-- 8b. Anular despacho: devolver a stock_bodega, quitar de carga_vendedor y
--     devolver a stock_envases los envases que salieron
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    dd record;
begin
    -- Por cada detalle (incluidos los ajustes): revertimos el movimiento.
    -- stock_bodega se había restado -> sumamos. carga_vendedor se había
    -- sumado -> restamos (respetando no-negativo).
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

    -- Por cada envase despachado: stock_envases se había restado -> sumamos.
    for dd in select tipo_empaque_id, sum(cantidad) as total
              from public.despacho_envases where despacho_id = new.id
              group by tipo_empaque_id loop
        update public.stock_envases
        set cantidad = cantidad + dd.total, modificado_en = now()
        where sucursal_id = new.sucursal_id and tipo_empaque_id = dd.tipo_empaque_id;
    end loop;

    return new;
end;
$$;

-- 8c. Anular devolución de productos: revertir (carga vuelve a bajar, bodega sube)
create or replace function public.trg_devolucion_producto_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;
    if v_despacho.anulado then
        -- Si el despacho también está anulado, su reversión ya movió stock;
        -- aquí no tocamos para no duplicar.
        return new;
    end if;
    -- En el INSERT se hizo: carga -= cantidad, stock_bodega += cantidad.
    -- Revertimos: carga += cantidad, stock_bodega -= cantidad.
    update public.carga_vendedor
    set cantidad = cantidad + new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id and producto_id = new.producto_id;

    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- 8d. Anular devolución de envase (bueno): restar lo sumado al stock_envases
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

-- 8e. Anular producción: restar de stock_bodega lo que se había sumado
create or replace function public.trg_produccion_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = new.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- 8f. Anular merma: revertir su descuento
create or replace function public.trg_merma_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    if new.producto_id is not null then
        if new.despacho_id is not null then
            select * into v_despacho from public.despachos where id = new.despacho_id;
            -- La merma restaba carga (ruta) o bodega (planta). Revertir sumando.
            update public.carga_vendedor
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id  = new.producto_id;
            -- Nota: para merma en ruta tocábamos carga_vendedor (no stock_bodega);
            -- para merma en planta tocábamos stock_bodega. Aquí distinguimos por
            -- despacho_id presente y operamos sobre carga_vendedor en ruta.
        else
            update public.stock_bodega
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where sucursal_id = new.sucursal_id and producto_id = new.producto_id;
        end if;
    elsif new.tipo_empaque_id is not null then
        update public.stock_envases
        set cantidad = cantidad + new.cantidad, modificado_en = now()
        where sucursal_id = new.sucursal_id and tipo_empaque_id = new.tipo_empaque_id;
    end if;
    return new;
end;
$$;

-- ===========================================================================
-- Activación de triggers de negocio
-- ===========================================================================
create trigger trg_despacho_detalle_insert after insert on public.despacho_detalles
    for each row execute function public.trg_despacho_detalle_insert();
create trigger trg_despacho_envase_insert after insert on public.despacho_envases
    for each row execute function public.trg_despacho_envase_insert();
create trigger trg_venta_detalle_insert after insert on public.venta_detalles
    for each row execute function public.trg_venta_detalle_insert();
create trigger trg_venta_total_ins after insert on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_venta_total_upd after update on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_venta_total_del after delete on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_devolucion_producto after insert on public.devoluciones_productos
    for each row execute function public.trg_devolucion_producto_insert();
create trigger trg_devolucion_envase after insert on public.devoluciones_envases
    for each row execute function public.trg_devolucion_envase_insert();
create trigger trg_produccion_insert after insert on public.producciones
    for each row execute function public.trg_produccion_insert();
create trigger trg_merma_insert after insert on public.mermas
    for each row execute function public.trg_merma_insert();

-- Activación de los triggers de reversión por anulación
-- (se disparan solo en la transición anulado: false -> true)
create trigger trg_venta_anular after update of anulado on public.ventas
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_venta_anular();
create trigger trg_despacho_anular after update of anulado on public.despachos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_despacho_anular();
create trigger trg_devolucion_producto_anular after update of anulado
    on public.devoluciones_productos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_producto_anular();
create trigger trg_devolucion_envase_anular after update of anulado
    on public.devoluciones_envases
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_envase_anular();
create trigger trg_produccion_anular after update of anulado on public.producciones
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_produccion_anular();
create trigger trg_merma_anular after update of anulado on public.mermas
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_merma_anular();