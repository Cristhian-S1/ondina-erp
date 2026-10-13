-- B4 / OND-5gi.8: #47 indexes, #48 / BD-12 Realtime publication, advisor auth_rls_initplan.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- #48: the publication contains exactly the tables with a subscriber or a justified 0008 intent.
select is(
  (select array_agg(tablename::text order by tablename) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'),
  array['incidencias_produccion', 'mermas', 'producciones', 'stock_envases'],
  'supabase_realtime publishes producciones, mermas, stock_envases and incidencias_produccion only'
);
select is(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
   and tablename = 'mermas'),
  1::bigint,
  'mermas is published once (idempotent migration)'
);

-- #47: each measured index exists and the partial ones keep their predicate.
select has_index('public', 'producciones', 'idx_producciones_sucursal_creado_en', 'producciones history index exists');
select has_index('public', 'mermas', 'idx_mermas_sucursal_creado_en_pendientes', 'pending mermas index exists');
select has_index('public', 'gastos_extras', 'idx_gastos_extras_vendedor_creado_en', 'seller expense index exists');
select has_index('public', 'ventas', 'idx_ventas_vendedor_creado_en_activas', 'seller sales index exists');

select is(
  (select pg_get_expr(indpred, indrelid) like '%NOT anulado%' from pg_index
    where indexrelid = 'public.idx_producciones_sucursal_creado_en'::regclass),
  true,
  'producciones index is partial on active rows'
);
select is(
  (select pg_get_expr(indpred, indrelid) like '%despacho_id IS NULL%' from pg_index
    where indexrelid = 'public.idx_mermas_sucursal_creado_en_pendientes'::regclass),
  true,
  'mermas index is partial on pending product mermas'
);
select is(
  (select indpred is null from pg_index where indexrelid = 'public.idx_gastos_extras_vendedor_creado_en'::regclass),
  true,
  'gastos index is not partial (seller predicate covers all rows)'
);
select is(
  (select pg_get_expr(indpred, indrelid) like '%NOT anulado%' from pg_index
    where indexrelid = 'public.idx_ventas_vendedor_creado_en_activas'::regclass),
  true,
  'ventas index is partial on active rows'
);

-- Earlier secondary indexes from 20261013000100 and B3 are not dropped by B4.
select has_index('public', 'ventas', 'idx_ventas_vendedor', 'restored ventas seller index is kept');
select has_index('public', 'ventas', 'idx_ventas_creado_en', 'restored ventas time index is kept');
select has_index('public', 'producciones', 'idx_producciones_creado_en', 'restored production time index is kept');
select has_index('public', 'reglas_comision', 'reglas_comision_no_solapamiento_b3', 'B3 commission exclusion index is kept');

-- advisor auth_rls_initplan: incident insert policy wraps auth.uid() in an initplan.
select is(
  (select position('SELECT auth.uid() AS uid' in pg_get_expr(polwithcheck, polrelid)) > 0 from pg_policy
    where polname = 'incidencias_produccion_insert_b3'),
  true,
  'incident insert policy evaluates auth.uid() once per statement'
);
select is(
  (select position('creado_por = auth.uid()' in pg_get_expr(polwithcheck, polrelid)) = 0 from pg_policy
    where polname = 'incidencias_produccion_insert_b3'),
  true,
  'incident insert policy has no per-row auth.uid() call'
);

-- Behaviour is unchanged: active production user of branch A may insert for self,
-- and cannot insert on behalf of another author or from a seller role.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0001-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.incidencias_produccion(id, sucursal_id, descripcion, creado_por)
    values ('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Propia de producción', '20000000-0000-0000-0001-000000000003')$$,
  'production user inserts an incident authored by self in own branch'
);
select throws_ok(
  $$insert into public.incidencias_produccion(id, sucursal_id, descripcion, creado_por)
    values ('71000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Ajena', '20000000-0000-0000-0001-000000000001')$$,
  '42501', null,
  'production user cannot insert an incident authored by another user'
);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0001-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.incidencias_produccion(id, sucursal_id, descripcion, creado_por)
    values ('71000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Vendedor', '20000000-0000-0000-0001-000000000004')$$,
  '42501', null,
  'seller role cannot insert incidents'
);
reset role;

select * from finish();
rollback;
