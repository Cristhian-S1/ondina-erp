begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select tables_are('public', array['auditoria','carga_vendedor','clientes','configuracion','despacho_detalles','despacho_envases','despachos','devoluciones_envases','devoluciones_productos','gastos_extras','incidencias_produccion','mermas','perfiles','producciones','productos','reglas_comision','stock_bodega','stock_envases','sucursales','tipos_empaque','ubicaciones_vendedores','venta_detalles','ventas'], 'All 23 production tables exist');
select views_are('public', array['v_bidones_vacios_vendedor','v_comision_vendedor','v_indicadores_produccion_diarios','v_ranking_vendedores','v_stock_actual','v_cuadre_despacho','v_ventas_diarias','v_clientes_inactivos','v_historial_cliente','v_ventas_producto'], 'All baseline and added report views exist');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity), 0::bigint,
 'Every public table has RLS enabled');
select has_column('public', 'v_comision_vendedor', 'jornada', 'Daily commission contract is preserved');
select col_is_null('public', 'perfiles', 'sucursal_id', 'Global administrator may have no sucursal');
select has_function('public', 'corregir_devolucion', 'Expected function corregir_devolucion exists');
select has_function('public', 'crear_despacho', 'Expected function crear_despacho exists');
select has_function('public', 'es_rol', 'Expected function es_rol exists');
select has_function('public', 'fn_auditoria_simple', 'Expected function fn_auditoria_simple exists');
select has_function('public', 'mi_sucursal', 'Expected function mi_sucursal exists');
select has_function('public', 'registrar_venta', 'Expected function registrar_venta exists');
select has_function('public', 'rls_auto_enable', 'Expected function rls_auto_enable exists');
select has_function('public', 'trg_despacho_anular', 'Expected function trg_despacho_anular exists');
select has_function('public', 'trg_despacho_detalle_insert', 'Expected function trg_despacho_detalle_insert exists');
select has_function('public', 'trg_despacho_envase_insert', 'Expected function trg_despacho_envase_insert exists');
select has_function('public', 'trg_devolucion_envase_anular', 'Expected function trg_devolucion_envase_anular exists');
select has_function('public', 'trg_devolucion_envase_insert', 'Expected function trg_devolucion_envase_insert exists');
select has_function('public', 'trg_devolucion_producto_anular', 'Expected function trg_devolucion_producto_anular exists');
select has_function('public', 'trg_devolucion_producto_insert', 'Expected function trg_devolucion_producto_insert exists');
select has_function('public', 'trg_merma_insert', 'Expected function trg_merma_insert exists');
select has_function('public', 'trg_produccion_anular', 'Expected function trg_produccion_anular exists');
select has_function('public', 'trg_produccion_insert', 'Expected function trg_produccion_insert exists');
select has_function('public', 'trg_venta_anular', 'Expected function trg_venta_anular exists');
select has_function('public', 'trg_venta_detalle_insert', 'Expected function trg_venta_detalle_insert exists');
select has_function('public', 'trg_venta_recalcular_total', 'Expected function trg_venta_recalcular_total exists');
select has_function('public', 'fn_sello_modificacion', 'Expected function fn_sello_modificacion exists');
select has_function('public', 'fn_auditoria', 'Expected function fn_auditoria exists');
select has_function('public', 'trg_merma_anular', 'Expected function trg_merma_anular exists');
select has_function('private', 'es_rol', array['text']);
select has_function('private', 'mi_sucursal', array[]::text[]);

-- New objects must arrive with the restricted exposure documented in B1.
select is((select count(*) from pg_class where relnamespace='public'::regnamespace
 and relname in ('v_stock_actual','v_cuadre_despacho','v_ventas_diarias','v_clientes_inactivos','v_historial_cliente','v_ventas_producto')
 and coalesce(reloptions @> array['security_invoker=true'],false)), 6::bigint,
 'All six added views use caller RLS');
select ok(not exists (
 select 1 from unnest(array['v_stock_actual','v_cuadre_despacho','v_ventas_diarias','v_clientes_inactivos','v_historial_cliente','v_ventas_producto']) v(name)
 where has_table_privilege('anon','public.' || name,'SELECT')
), 'Anonymous users cannot read added report views');
select ok(not exists (
 select 1 from unnest(array['fn_auditoria','fn_sello_modificacion','trg_merma_anular']) f(name)
 where has_function_privilege('anon','public.' || name || '()','EXECUTE')
    or has_function_privilege('authenticated','public.' || name || '()','EXECUTE')
), 'Added trigger helpers have no client EXECUTE');

-- Use the actual authenticated production identity, so policy regressions fail too.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000003', true);
set local role authenticated;
select lives_ok($sql$
 insert into public.producciones (id, sucursal_id, producto_id, cantidad, creado_por)
 values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
         '40000000-0000-0000-0000-000000000001', 7, '20000000-0000-0000-0001-000000000003')
$sql$, 'Production insert succeeds through authenticated RLS');
reset role;
select is((select cantidad from public.stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'), 107, 'Production increases stock once');
select is((select cantidad from public.stock_envases where sucursal_id='10000000-0000-0000-0000-000000000001' and tipo_empaque_id='30000000-0000-0000-0000-000000000001'), 93, 'Production consumes returnable packaging once');
select is((select count(*) from public.auditoria where tabla='producciones' and registro_id='60000000-0000-0000-0000-000000000001' and accion='INSERT' and usuario_id='20000000-0000-0000-0001-000000000003'), 1::bigint, 'Production audit retains actor and row');
select is((select count(*) from public.producciones where id='60000000-0000-0000-0000-000000000001'), 1::bigint, 'Production row and relations are preserved');

-- Ordinary plant-merma cancellation restores the new reversal binding.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000001', true);
set local role authenticated;
insert into public.mermas(id,sucursal_id,producto_id,cantidad,motivo,creado_por)
values ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 '40000000-0000-0000-0000-000000000001', 2, 'Synthetic test', '20000000-0000-0000-0001-000000000001');
update public.mermas set anulado=true where id='70000000-0000-0000-0000-000000000001';
reset role;
select is((select cantidad from public.stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'), 107, 'Ordinary merma cancellation restores stock once');
select is((select count(*) from public.auditoria where tabla='mermas' and registro_id='70000000-0000-0000-0000-000000000001' and accion='ANULACION'), 1::bigint, 'Merma cancellation has an audit record');
select * from finish();
rollback;
