-- ============================================================================
-- Vistas de apoyo a reportes — Ondina (esquema final)
-- ============================================================================
-- RF-22 (ranking), RF-05 (clientes inactivos), RF-24 (cuadre), HU-08/12/14.
-- Adaptadas al esquema final: claves compuestas por sucursal (stock_bodega),
-- tablas `producciones`, `configuracion`, `reglas_comision`, `ventas` con
-- `sucursal_id`, y boleta/factura como columnas de `ventas`.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql.
-- Estas vistas exponen datos sensibles; su acceso se controla con RLS a nivel
-- de tabla subyacente y con los roles es_rol()/mi_sucursal() de rls_policies.sql.
-- Para restringir por filas de forma segura, materializar con
-- SECURITY INVOKER y aplicar RLS del llamador si es necesario.
-- ============================================================================

-- Stock actual con nombre de producto, por sucursal (HU-24)
-- Solo productos activos (los inactivos no inflan el reporte)
create or replace view public.v_stock_actual as
select p.id as producto_id, p.nombre, p.tipo,
       s.sucursal_id,
       coalesce(s.cantidad, 0) as cantidad, s.modificado_en
from public.productos p
left join public.stock_bodega s on s.producto_id = p.id
where p.activo;

-- Cuadre por despacho: despachado vs vendido vs devuelto vs merma
-- (Problematica §2.3)
create or replace view public.v_cuadre_despacho as
select
    d.id as despacho_id,
    d.sucursal_id,
    d.vendedor_id,
    d.creado_en::date as fecha,
    dd.producto_id,
    sum(dd.cantidad) as cantidad_despachada,
    coalesce(v.cantidad_vendida, 0)   as cantidad_vendida,
    coalesce(dp.cantidad_devuelta, 0) as cantidad_devuelta,
    coalesce(m.cantidad_merma, 0)     as cantidad_merma,
    sum(dd.cantidad) - coalesce(v.cantidad_vendida, 0) - coalesce(dp.cantidad_devuelta, 0)
        - coalesce(m.cantidad_merma, 0) as diferencia
from public.despachos d
join public.despacho_detalles dd on dd.despacho_id = d.id
left join (
    select vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date as fecha,
           sum(vd.cantidad) as cantidad_vendida
    from public.ventas vt join public.venta_detalles vd on vd.venta_id = vt.id
    where not vt.anulado
    group by vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date
) v on v.producto_id = dd.producto_id
     and v.vendedor_id = d.vendedor_id
     and v.sucursal_id = d.sucursal_id
     and v.fecha = d.creado_en::date
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_devuelta
    from public.devoluciones_productos where not anulado group by despacho_id, producto_id
) dp on dp.despacho_id = d.id and dp.producto_id = dd.producto_id
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_merma
    from public.mermas where not anulado and producto_id is not null group by despacho_id, producto_id
) m on m.despacho_id = d.id and m.producto_id = dd.producto_id
where not d.anulado
group by d.id, d.sucursal_id, d.vendedor_id, d.creado_en::date, dd.producto_id,
         v.cantidad_vendida, dp.cantidad_devuelta, m.cantidad_merma;

-- Ingresos diarios por vendedor y sucursal (HU-14, Problematica §2.2)
create or replace view public.v_ventas_diarias as
select creado_en::date as fecha, sucursal_id, vendedor_id,
       count(*) as cantidad_ventas, sum(total) as total_ingresos
from public.ventas
where not anulado
group by creado_en::date, sucursal_id, vendedor_id;

-- Ranking de vendedores (RF-22, HU-08)
create or replace view public.v_ranking_vendedores as
select p.id as vendedor_id, p.sucursal_id,
       p.nombres || ' ' || p.apellidos as vendedor,
       date_trunc('month', v.creado_en) as mes,
       count(v.id) as cantidad_ventas, coalesce(sum(v.total), 0) as total_vendido
from public.perfiles p
left join public.ventas v on v.vendedor_id = p.id and not v.anulado
where p.rol = 'vendedor' and p.activo
group by p.id, p.sucursal_id, p.nombres, p.apellidos, date_trunc('month', v.creado_en)
order by mes desc, total_vendido desc;

-- Comisión por vendedor según regla vigente por tipo de producto
-- (RF-26, HU-09). Regla vigente = vigente_hasta nulo o la más reciente.
-- `monto_fijo` se interpreta como un bono por venta (no por periodo): se suma
-- una vez por cada venta con detalle del tipo de producto. Ajustar si la regla
-- de negocio cambia a monto por periodo o por detalle.
create or replace view public.v_comision_vendedor as
select
    v.vendedor_id,
    date_trunc('month', v.creado_en) as mes,
    p.tipo,
    sum(vd.cantidad * vd.precio_unitario) as base_comision,
    r.porcentaje,
    r.monto_fijo,
    count(distinct v.id) as ventas_del_tipo,
    round(
        coalesce(sum(vd.cantidad * vd.precio_unitario) * r.porcentaje / 100.0, 0)
        + count(distinct v.id) * coalesce(r.monto_fijo, 0)
    , 2) as comision
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id and not v.anulado
join public.productos p on p.id = vd.producto_id
left join lateral (
    select r.porcentaje, r.monto_fijo
    from public.reglas_comision r
    where r.tipo_producto = p.tipo
      and r.vigente_desde <= now()
      and (r.vigente_hasta is null or r.vigente_hasta >= now())
    order by r.vigente_desde desc
    limit 1
) r on true
where not v.anulado
group by v.vendedor_id, date_trunc('month', v.creado_en), p.tipo, r.porcentaje, r.monto_fijo;

-- Clientes inactivos según parámetro configurable (RF-05, HU-12)
create or replace view public.v_clientes_inactivos as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       max(v.creado_en) as ultima_compra,
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente') as dias_configurados,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id
having max(v.creado_en) is null
    or now()::date - max(v.creado_en)::date >
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente');

-- Historial resumido del cliente (RF-04, HU-11).
-- NOTA: "visitas" del vendedor al cliente no están modeladas en el esquema
-- (ubicaciones_vendedores es solo GPS del vendedor, no una visita registrada).
-- Esta vista cubre el historial de ventas; modelar visitas requerirá una
-- entidad nueva (visitas: vendedor + cliente + fecha) y se deja como decisión
-- pendiente. Mientras tanto, una heurística posible es inferir cercanía del
-- GPS a la dirección del cliente, pero esa lógica no pertenece a esta vista.
create or replace view public.v_historial_cliente as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       count(distinct v.id) as cantidad_compras,
       coalesce(sum(v.total), 0) as total_comprado,
       max(v.creado_en) as ultima_compra,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id;

-- Reporte de ventas por vendedor y producto (HU-14).
-- Permite filtrar por producto fuera del contexto de despacho (HU-14 pide
-- "vendedor y producto"), complementando v_ventas_diarias (sin producto) y
-- v_cuadre_despacho (acotada al despacho). No incluye anuladas.
create or replace view public.v_ventas_producto as
select v.creado_en::date as fecha, v.sucursal_id, v.vendedor_id,
       vd.producto_id, p.nombre as producto, p.tipo,
       sum(vd.cantidad) as cantidad,
       sum(vd.subtotal) as total
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id
join public.productos p on p.id = vd.producto_id
where not v.anulado
group by v.creado_en::date, v.sucursal_id, v.vendedor_id,
         vd.producto_id, p.nombre, p.tipo;

-- ---------------------------------------------------------------------------
-- RF-20 (consulta posterior de documentos boleta/factura): NO implementado
-- como objeto separado. `ventas.tipo_documento` y `ventas.folio_documento`
-- guardan el tipo y folio del documento emitido para cada venta, por lo que
-- la consulta posterior puede construirse consultando `ventas` directamente.
-- Si se requiere conservar el documento generado (PDF/render) para mostrarlo
-- sin recalcularlo, añadir una tabla `documentos_ventas` o un bucket de
-- Storage; queda pendiente de decisión del equipo (ver Plan §6.2).
-- ---------------------------------------------------------------------------