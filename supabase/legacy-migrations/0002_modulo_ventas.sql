-- ============================================================
-- 0002_modulo_ventas.sql — Módulo de Ventas: RPC + vista + revokes
-- ============================================================
-- Cambios sobre el baseline 0001_init.sql para habilitar el módulo de ventas:
--   1) Revokes de EXECUTE sobre public.es_rol(text) y public.mi_sucursal() a
--      anon y authenticated (cierra WARN de advisors). Las políticas RLS las
--      invocan vía el motor interno; no requieren grant público, y el frontend
--      no las llama vía /rest/v1/rpc.
--   2) Función RPC SECURITY DEFINER public.registrar_venta(...) que inserta la
--      cabecera de la venta y sus detalles en una transacción atómica. Los
--      triggers existentes (trg_venta_detalle_insert, trg_venta_total_ins)
--      descuentan carga, suman envases y recalculan el total. Cubre HU-01.
--   3) Vista public.v_bidones_vacios_vendedor (SECURITY INVOKER) que suma los
--      envases recibidos en las ventas del día del vendedor más las
--      devoluciones de envases en buen estado de sus despachos del día. Cubre
--      HU-05.
--
-- Nota de alcance: NO incluye HU-06 (boletas/factura) ni Storage para
-- comprobantes de HU-07; ambos quedan pendientes por decisión del producto.
--================================================================

-- ---------------------------------------------------------------------------
-- 1. Revokes de seguridad: helpers sólo invocables desde políticas RLS
-- ---------------------------------------------------------------------------
-- Las políticas RLS invocan es_rol/mi_sucursal internamente (no requieren
-- EXECUTE grant; el motor de RLS las resuelve). Revocamos de PUBLIC/anon para
-- que NO se expongan vía /rest/v1/rpc/es_rol|mi_sucursal. Mantenemos el grant
-- a authenticated (las policies de usuarios autenticados lo necesitan).
do $$
begin
    revoke execute on function public.es_rol(text) from public;
    revoke execute on function public.es_rol(text) from anon;
    revoke execute on function public.mi_sucursal() from public;
    revoke execute on function public.mi_sucursal() from anon;
    revoke execute on function public.registrar_venta(
        uuid, text, jsonb, numeric, text
    ) from public;
    revoke execute on function public.registrar_venta(
        uuid, text, jsonb, numeric, text
    ) from anon;
exception
    when others then
        -- idempotente: si ya están revocados o los roles no existen, seguimos
        null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. RPC registrar_venta (HU-01)
-- ---------------------------------------------------------------------------
-- El vendedor invoca supabase.rpc('registrar_venta', {...}). La función valida
-- que el cliente pertenezca a la sucursal del vendedor y a su cartera (o que
-- el llamador sea administrador), inserta la cabecera y los detalles. Los
-- triggers de venta_detalles descuentan carga y recalculan total. En caso de
-- error (carga insuficiente, producto inexistente, cliente inexistente), la
-- transacción completa deja a la BD en su estado previo.

create or replace function public.registrar_venta(
    p_cliente_id uuid,
    p_metodo_pago text,
    p_detalles jsonb,
    p_descuento numeric default 0,
    p_observaciones text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_venta         public.ventas%rowtype;
    v_cliente       public.clientes%rowtype;
    v_sucursal_id   uuid;
    v_vendedor      uuid := auth.uid();
    v_detalle       jsonb;
    v_venta_id      uuid;
    v_producto      uuid;
    v_cantidad      integer;
    v_precio        numeric(12, 2);
    v_envases       integer;
begin
    if v_vendedor is null then
        raise exception 'No hay un usuario autenticado';
    end if;

    if p_detalles is null or jsonb_array_length(p_detalles) = 0 then
        raise exception 'La venta debe incluir al menos un detalle';
    end if;

    if p_metodo_pago is null or p_metodo_pago not in ('efectivo', 'transferencia') then
        raise exception 'Método de pago inválido (efectivo o transferencia)';
    end if;

    -- Sucursal del vendedor (mi_sucursal() es SECURITY DEFINER, se invoca aquí
    -- desde el contexto interno; no requiere grant público).
    select sucursal_id into v_sucursal_id from public.perfiles where id = v_vendedor;
    if v_sucursal_id is null then
        raise exception 'El usuario autenticado no tiene perfil';
    end if;

    -- Cliente debe existir y pertenecer a la sucursal del vendedor; además, si
    -- el llamador es vendedor, el cliente debe estar en su cartera. Un admin
    -- puede registrar una venta sobre cualquier cliente de su sucursal.
    if public.es_rol('administrador') then
        select * into v_cliente from public.clientes
        where id = p_cliente_id and sucursal_id = v_sucursal_id and activo;
    else
        select * into v_cliente from public.clientes
        where id = p_cliente_id
          and sucursal_id = v_sucursal_id
          and vendedor_id = v_vendedor
          and activo;
    end if;
    if v_cliente.id is null then
        raise exception 'Cliente inexistente o fuera de su cartera/sucursal';
    end if;

    -- Cabecera de la venta. El total lo recalcula el trigger al insertar
    -- detalles; aquí se inserta con 0 para cumplir la constraint NOT NULL.
    insert into public.ventas (
        sucursal_id, vendedor_id, cliente_id,
        metodo_pago, descuento, total, observaciones,
        creado_por
    )
    values (
        v_sucursal_id, v_vendedor, p_cliente_id,
        p_metodo_pago, coalesce(p_descuento, 0), 0, p_observaciones,
        v_vendedor
    )
    returning id into v_venta_id;

-- Detalles: cada insert gatilla trg_venta_detalle_insert (descuenta carga,
-- suma envases) y trg_venta_total_ins (recalcula total). Si una inserción
-- falla (carga insuficiente, producto inexistente), la transacción completa
-- hace rollback.
    for v_detalle in select jsonb_array_elements(p_detalles) loop
        v_producto := (v_detalle ->> 'producto_id')::uuid;
        v_cantidad := (v_detalle ->> 'cantidad')::integer;
        v_precio   := (v_detalle ->> 'precio_unitario')::numeric(12, 2);
        v_envases  := coalesce((v_detalle ->> 'envases_recibidos')::integer, 0);

        if v_producto is null or v_cantidad is null or v_precio is null then
            raise exception 'Detalle de venta incompleto (producto_id, cantidad y precio_unitario son obligatorios)';
        end if;
        if v_cantidad <= 0 then
            raise exception 'La cantidad debe ser mayor que cero';
        end if;
        if v_precio < 0 then
            raise exception 'El precio unitario no puede ser negativo';
        end if;

        insert into public.venta_detalles (
            venta_id, producto_id, cantidad,
            precio_unitario, envases_recibidos
        )
        values (
            v_venta_id, v_producto, v_cantidad,
            v_precio, v_envases
        );
    end loop;

    return v_venta_id;
end;
$$;

-- El frontend llama esta función vía supabase.rpc('registrar_venta', {...}) con
-- un JWT autenticado; no requiere exposición a anon.
grant execute on function public.registrar_venta(
    uuid, text, jsonb, numeric, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vista v_bidones_vacios_vendedor (HU-05)
-- ---------------------------------------------------------------------------
-- Devuelve, por vendedor y día, la cantidad de envases recibidos durante su
-- jornada: suma los `envases_recibidos` registrados en las ventas no anuladas
-- del día (vía venta_detalles → productos.tipo_empaque_id) más las
-- devoluciones_envases en estado 'bueno' de despachos del vendedor creados
-- ese mismo día. El filtrado por vendedor_id se hace desde el frontend con
-- `.eq('vendedor_id', perfil.id)`; la vista expone las columnas necesarias.

create or replace view public.v_bidones_vacios_vendedor
with (security_invoker = true) as
with ventas_dia as (
    select
        v.vendedor_id,
        v.creado_en::date as fecha,
        p.tipo_empaque_id,
        sum(vd.envases_recibidos) as cantidad
    from public.ventas v
    join public.venta_detalles vd on vd.venta_id = v.id
    join public.productos p on p.id = vd.producto_id
    where not v.anulado
      and p.tipo_empaque_id is not null
    group by v.vendedor_id, v.creado_en::date, p.tipo_empaque_id
),
devoluciones_dia as (
    select
        d.vendedor_id,
        d.creado_en::date as fecha,
        de.tipo_empaque_id,
        sum(de.cantidad) as cantidad
    from public.devoluciones_envases de
    join public.despachos d on d.id = de.despacho_id
    where not de.anulado
      and de.estado = 'bueno'
    group by d.vendedor_id, d.creado_en::date, de.tipo_empaque_id
)
select
    coalesce(v.vendedor_id, dv.vendedor_id) as vendedor_id,
    coalesce(v.fecha, dv.fecha) as fecha,
    te.id as tipo_empaque_id,
    te.nombre as empaque_nombre,
    coalesce(v.cantidad, 0) + coalesce(dv.cantidad, 0) as cantidad
from ventas_dia v
full outer join devoluciones_dia dv
    on dv.vendedor_id = v.vendedor_id
   and dv.fecha = v.fecha
   and dv.tipo_empaque_id = v.tipo_empaque_id
right join public.tipos_empaque te
    on te.id = coalesce(v.tipo_empaque_id, dv.tipo_empaque_id);