-- ============================================================
-- 0003_correcciones_seguridad_ventas.sql
-- ============================================================
-- Corrige los WARN/ERROR detectados tras aplicar 0002_modulo_ventas.sql al
-- remoto:
--   1) ERROR: la vista v_bidones_vacios_vendedor quedó como SECURITY DEFINER
--      por defecto (bypasaba RLS). Se recrea con SECURITY INVOKER para que la
--      RLS del llamador filtre por vendedor_id.
--   2) WARN (anon): es_rol, mi_sucursal y registrar_venta eran ejecutables por
--      anon vía PUBLIC. Se revoca EXECUTE de PUBLIC/anon (authenticated sigue
--      conservando su grant; esperado por diseño porque las policies infladas
--      por authenticated las requieren).
-- Idempotente. No altera datos ni los objetos creados en 0001/0002.

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
    when others then null;
end $$;

-- Reafirmamos el grant a authenticated (idempotente).
grant execute on function public.es_rol(text) to authenticated;
grant execute on function public.mi_sucursal() to authenticated;
grant execute on function public.registrar_venta(
    uuid, text, jsonb, numeric, text
) to authenticated;

-- Vista recreada como SECURITY INVOKER (RLS del llamador aplica).
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