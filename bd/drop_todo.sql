-- Limpia todas las tablas de Ondina (con CASCADE por las claves foráneas).
-- NO borra auth.users: tus usuarios y contraseñas se mantienen.
-- Ejecutar en Supabase: SQL Editor → New query → Run

drop table if exists public.auditoria cascade;
drop table if exists public.ubicaciones_vendedores cascade;
drop table if exists public.incidencias_produccion cascade;
drop table if exists public.producciones cascade;
drop table if exists public.mermas cascade;
drop table if exists public.devoluciones_envases cascade;
drop table if exists public.devoluciones_productos cascade;
drop table if exists public.despacho_detalles cascade;
drop table if exists public.despachos cascade;
drop table if exists public.gastos_extras cascade;
drop table if exists public.venta_detalles cascade;
drop table if exists public.ventas cascade;
drop table if exists public.carga_vendedor cascade;
drop table if exists public.stock_envases cascade;
drop table if exists public.stock_bodega cascade;
drop table if exists public.reglas_comision cascade;
drop table if exists public.configuracion cascade;
drop table if exists public.clientes cascade;
drop table if exists public.productos cascade;
drop table if exists public.tipos_empaque cascade;
drop table if exists public.perfiles cascade;
drop table if exists public.sucursales cascade;

-- Funciones auxiliares usadas por las políticas RLS (se recrean con rls_policies.sql).
-- Antes de dropear las funciones, eliminar las políticas de storage.objects que
-- las referencian (storage no se dropea aquí porque es un esquema gestionado por
-- Supabase). Si se agregaron más políticas sobre storage.objects, añadirlas abajo.
drop policy if exists "comprobantes_insert_vendedor" on storage.objects;
drop policy if exists "comprobantes_select_propio" on storage.objects;
drop function if exists public.es_rol(text);
drop function if exists public.mi_sucursal();

-- ---------------------------------------------------------------------------
-- Funciones de triggers de negocio y auditoría (se recrean con
-- triggers_negocio.sql y auditoria.sql). Ordernar por dependencia no es
-- necesario: DROP FUNCTION ignora los triggers que las invocan.
-- ---------------------------------------------------------------------------
drop function if exists public.trg_despacho_detalle_insert();
drop function if exists public.trg_venta_detalle_insert();
drop function if exists public.trg_venta_recalcular_total();
drop function if exists public.trg_devolucion_producto_insert();
drop function if exists public.trg_devolucion_envase_insert();
drop function if exists public.trg_produccion_insert();
drop function if exists public.trg_merma_insert();
drop function if exists public.trg_venta_anular();
drop function if exists public.trg_despacho_anular();
drop function if exists public.trg_devolucion_producto_anular();
drop function if exists public.trg_devolucion_envase_anular();
drop function if exists public.trg_produccion_anular();
drop function if exists public.trg_merma_anular();
drop function if exists public.fn_sello_modificacion();
drop function if exists public.fn_auditoria();
drop function if exists public.fn_auditoria_simple();
