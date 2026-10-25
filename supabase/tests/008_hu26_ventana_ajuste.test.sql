begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
           from pg_proc where oid = 'public.ventana_ajuste_despacho()'::regprocedure),
          'Window RPC is stable, security definer, and has an empty search path');
select ok(not has_function_privilege('anon', 'public.ventana_ajuste_despacho()', 'execute'),
          'Anonymous callers have no execute grant');
select ok(has_function_privilege('service_role', 'public.ventana_ajuste_despacho()', 'execute'),
          'Service role has the explicit execute grant');
select ok((select convalidated from pg_constraint
           where conname = 'configuracion_ventana_ajuste_minutos_rango'),
          'Window sanity constraint is validated');

-- Synthetic seed omits the setting: exercise the same fallback as the trigger.
delete from public.configuracion where clave = 'ventana_ajuste_minutos';
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000002', true);
set local role authenticated;
select is((select minutos from public.ventana_ajuste_despacho()), 15, 'Bodega gets default 15 when setting is absent');
select throws_ok($q$select * from public.configuracion$q$, '42501', null,
                 'Bodega still cannot read configuration directly');
reset role;
insert into public.configuracion(clave, valor) values ('ventana_ajuste_minutos', '15');
create temporary table reloj_hu26 as select clock_timestamp() as antes;
grant select on reloj_hu26 to authenticated;
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 1::bigint, 'Active bodega gets exactly one row');
select is((select minutos from public.ventana_ajuste_despacho()), 15, 'Bodega gets configured 15');
select ok((select servidor_ahora between (select antes from reloj_hu26) and clock_timestamp()
           from public.ventana_ajuste_despacho()), 'RPC returns current server time');
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000001', true);
set local role authenticated;
select is((select minutos from public.ventana_ajuste_despacho()), 15, 'Active administrator gets configured 15');
select ok((select servidor_ahora between (select antes from reloj_hu26) and clock_timestamp()
           from public.ventana_ajuste_despacho()), 'Administrator gets current server time');
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000004', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Seller gets no rows');
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000003', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Production gets no rows');
reset role;
update public.perfiles set activo = false where id in (
    '20000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000002');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000002', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Inactive bodega gets no rows');
reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000001', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Inactive administrator gets no rows');
reset role;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000099', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Missing profile gets no rows');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select is((select count(*) from public.ventana_ajuste_despacho()), 0::bigint, 'Missing identity gets no rows');
reset role;
set local role anon;
select throws_ok($q$select * from public.ventana_ajuste_despacho()$q$, '42501',
                 null, 'Anon cannot execute RPC');
reset role;

select throws_ok($q$update public.configuracion set valor = '4' where clave = 'ventana_ajuste_minutos'$q$,
                 '23514', null, 'Window below 5 rejected');
select throws_ok($q$update public.configuracion set valor = '61' where clave = 'ventana_ajuste_minutos'$q$,
                 '23514', null, 'Window above 60 rejected');
select throws_ok($q$update public.configuracion set valor = 'abc' where clave = 'ventana_ajuste_minutos'$q$,
                 '23514', null, 'Non-numeric window rejected');
select throws_ok($q$update public.configuracion set valor = '1.5' where clave = 'ventana_ajuste_minutos'$q$,
                 '23514', null, 'Fractional window rejected');
select throws_ok($q$update public.configuracion set valor = '100' where clave = 'ventana_ajuste_minutos'$q$,
                 '23514', null, 'Three-digit window rejected');
select lives_ok($q$update public.configuracion set valor = '5' where clave = 'ventana_ajuste_minutos'$q$,
                'Minimum 5 accepted');
select lives_ok($q$update public.configuracion set valor = '60' where clave = 'ventana_ajuste_minutos'$q$,
                'Maximum 60 accepted');
select lives_ok($q$update public.configuracion set valor = '20' where clave = 'ventana_ajuste_minutos'$q$,
                'Configured 20 accepted');
select lives_ok($q$insert into public.configuracion(clave, valor) values ('hu26_unrelated', 'abc')$q$,
                'Guard does not restrict unrelated configuration');
update public.perfiles set activo = true where id in (
    '20000000-0000-0000-0001-000000000001', '20000000-0000-0000-0001-000000000002');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0001-000000000002', true);
set local role authenticated;
select is((select minutos from public.ventana_ajuste_despacho()), 20, 'RPC reflects configured 20');
reset role;
insert into public.despachos(id, sucursal_id, vendedor_id, despachador_id, creado_por)
values ('86000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000002',
        '20000000-0000-0000-0001-000000000002'),
       ('86000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0001-000000000004', '20000000-0000-0000-0001-000000000002',
        '20000000-0000-0000-0001-000000000002');
-- Only the synthetic fixture bypasses timestamp immutability, inside rollback.
alter table public.despachos disable trigger proteger_movimiento_b3;
update public.despachos set creado_en = clock_timestamp() - interval '19 minutes'
where id = '86000000-0000-0000-0000-000000000001';
update public.despachos set creado_en = clock_timestamp() - interval '21 minutes'
where id = '86000000-0000-0000-0000-000000000002';
alter table public.despachos enable trigger proteger_movimiento_b3;
set local role authenticated;
select lives_ok($q$insert into public.despacho_detalles(despacho_id, producto_id, cantidad, es_ajuste)
    values ('86000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, true)$q$,
    'Trigger permits adjustment beyond default 15 but within configured 20');
select throws_ok($q$insert into public.despacho_detalles(despacho_id, producto_id, cantidad, es_ajuste)
    values ('86000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 1, true)$q$,
    'P0001', 'La ventana de ajuste del despacho expiró.', 'Trigger rejects beyond configured 20');
reset role;
select is((select count(*) from public.despacho_detalles
           where despacho_id = '86000000-0000-0000-0000-000000000002'), 0::bigint, 'Expired adjustment leaves no line');
select is((select cantidad from public.stock_bodega where sucursal_id = '10000000-0000-0000-0000-000000000001'
           and producto_id = '40000000-0000-0000-0000-000000000001'), 99, 'Only accepted adjustment consumes stock');
select * from finish();
rollback;
