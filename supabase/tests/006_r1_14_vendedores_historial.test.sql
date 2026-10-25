begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(22);
-- R1-14 fixtures (synthetic): an inactive seller in each branch, the one of branch A with a past dispatch.
insert into auth.users(id,aud,role,email) values
 ('20000000-0000-0000-0001-000000000021','authenticated','authenticated','inactivo-a@example.invalid'),
 ('20000000-0000-0000-0002-000000000021','authenticated','authenticated','inactivo-b@example.invalid');
insert into public.perfiles(id,sucursal_id,nombres,apellidos,rol,activo) values
 ('20000000-0000-0000-0001-000000000021','10000000-0000-0000-0000-000000000001','Aardvark','Sucursal A','vendedor',false),
 ('20000000-0000-0000-0002-000000000021','10000000-0000-0000-0000-000000000002','Inactivo','Sucursal B','vendedor',false);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values
 ('71000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000021','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');

select is(pg_get_function_result('public.vendedores_historial_sucursal(uuid)'::regprocedure),'TABLE(id uuid, nombres text, apellidos text, activo boolean)','R1-14 returns only id, names and activo');
select ok((select provolatile = 's' and prolang = (select oid from pg_language where lanname = 'sql') and prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.vendedores_historial_sucursal(uuid)'::regprocedure),'R1-14 stable SQL definer with empty search_path');
select ok(not has_function_privilege('anon','public.vendedores_historial_sucursal(uuid)','EXECUTE') and has_function_privilege('authenticated','public.vendedores_historial_sucursal(uuid)','EXECUTE') and has_function_privilege('service_role','public.vendedores_historial_sucursal(uuid)','EXECUTE'),'R1-14 grants: authenticated and service_role, not anon');

-- bodega of branch A
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021' and not activo),'R1-14 bodega sees the inactive seller of its branch flagged inactive');
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000004' and activo),'R1-14 bodega still sees active sellers');
select ok(not exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0002-000000000021'),'R1-14 inactive seller of another branch is not exposed');
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'R1-14 bodega gets nothing for another branch');
select ok(not exists(select 1 from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021'),'R1-14 original RPC is unchanged: still active only');
-- Returned order is active first, then names and surnames.
select results_eq(
 $q$select id from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')$q$,
 $q$values ('20000000-0000-0000-0001-000000000004'::uuid), ('20000000-0000-0000-0001-000000000021'::uuid)$q$,
 'R1-14 active sellers precede inactive sellers');
select results_eq(
 $q$select id from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001')$q$,
 $q$values ('20000000-0000-0000-0001-000000000004'::uuid)$q$,
 'R1-14 original RPC returns exactly the active seller');
reset role;
-- branch administration
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000001',true);
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021'),'R1-14 branch admin sees the inactive seller of its branch');
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'R1-14 branch admin gets nothing for another branch');
reset role;
-- global admin
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002') where id='20000000-0000-0000-0002-000000000021' and not activo),'R1-14 global admin sees inactive sellers of branch B');
select ok(not exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002') where id='20000000-0000-0000-0001-000000000021'),'R1-14 global admin: branch A inactive seller is not listed under branch B');
reset role;
-- seller and production are denied (empty), anon gets 42501
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000004',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 seller gets no roster');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000003',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 production gets no roster');
reset role;
set local role anon;
select throws_ok($q$select * from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')$q$,'42501',null,'R1-14 anon is denied');
reset role;
-- V2-02: absent identity and inactive callers get an empty roster for every branch.
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 no JWT subject gets no roster');
reset role;
select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 identity without a profile gets no roster');
reset role;
update public.perfiles set activo=false where id='20000000-0000-0000-0001-000000000002';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 inactive bodega caller gets no roster');
reset role;
update public.perfiles set activo=false where id='20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'R1-14 inactive global admin gets no roster');
reset role;
-- Complementary contract: new dispatches still refuse an inactive seller (despachos_insert_b6).
update public.perfiles set activo=true where id='20000000-0000-0000-0001-000000000002';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
set local role authenticated;
select throws_ok($q$insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000021','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002')$q$,'42501',null,'R1-14 dispatch to an inactive seller is still denied');
reset role;
select * from finish();
rollback;
