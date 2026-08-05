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
drop function if exists public.es_rol(text);
drop function if exists public.mi_sucursal();
