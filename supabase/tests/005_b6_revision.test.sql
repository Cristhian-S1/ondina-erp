begin; create extension if not exists pgtap with schema extensions; set local search_path=public,extensions; select no_plan();
-- B6 / OND-5gi.9: RB-1, RB-5, RB-9, RB-11, RB-15, RB-16. Synthetic seed fixtures only; the outer transaction rolls back.
-- Seed balances: bodega 100 per product in branch 1; seller 20001...0004 holds 20 per product.

-- RB-1: a dispatch annulled after a linked loss returns only what is still outstanding.
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
insert into despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');
insert into despacho_detalles(despacho_id,producto_id,cantidad) values('71000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',10);
insert into mermas(id,sucursal_id,producto_id,despacho_id,cantidad,motivo,creado_por) values('72000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',2,'Rotura en ruta','20000000-0000-0000-0001-000000000002');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),28,'RB-1 linked loss leaves the seller load (20 + 10 - 2)');
update despachos set anulado=true where id='71000000-0000-0000-0000-000000000001';
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'),98,'RB-1 dispatch annul returns 10 minus the active linked loss of 2 (90 to 98)');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),20,'RB-1 seller load returns to its pre-dispatch level (28 to 20)');
update mermas set anulado=true where id='72000000-0000-0000-0000-000000000001';
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),20,'RB-1 annulling a loss of an annulled dispatch adds nothing to the seller load');
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'),98,'RB-1 annulling that loss adds nothing to warehouse stock');
update despachos set anulado=true where id='71000000-0000-0000-0000-000000000001';
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'),98,'RB-1 repeated dispatch annul creates no stock');

-- RB-1: a loss annulled before its dispatch is annulled is returned with the dispatch, not twice.
insert into despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');
insert into despacho_detalles(despacho_id,producto_id,cantidad) values('71000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',10);
insert into mermas(id,sucursal_id,producto_id,despacho_id,cantidad,motivo,creado_por) values('72000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002',3,'Error de conteo','20000000-0000-0000-0001-000000000002');
update mermas set anulado=true where id='72000000-0000-0000-0000-000000000002';
update despachos set anulado=true where id='71000000-0000-0000-0000-000000000002';
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'),98,'RB-1 annulled loss is returned once with its dispatch (88 to 98)');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),20,'RB-1 seller load after annulled loss and dispatch (30 to 20)');

-- RB-1: a linked loss may not exceed the outstanding quantity of its dispatch; an active loss stays on the annulled dispatch.
insert into despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');
insert into despacho_detalles(despacho_id,producto_id,cantidad) values('71000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',5);
select throws_ok($q$insert into mermas(id,sucursal_id,producto_id,despacho_id,cantidad,motivo,creado_por) values('72000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003',6,'Exceso','20000000-0000-0000-0001-000000000002')$q$,'P0001','La merma supera lo despachado pendiente de ese producto.','RB-1 linked loss cannot exceed the outstanding dispatched quantity');
insert into mermas(id,sucursal_id,producto_id,despacho_id,cantidad,motivo,creado_por) values('72000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003',5,'Rotura total','20000000-0000-0000-0001-000000000002');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),20,'RB-1 loss equal to the outstanding quantity is accepted (25 to 20)');
update despachos set anulado=true where id='71000000-0000-0000-0000-000000000003';
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000001'),93,'RB-1 dispatch fully lost returns nothing to the warehouse');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000001'),20,'RB-1 fully lost dispatch leaves the seller load unchanged');

-- RB-9: a line inserted into an annulled sale is rejected with a Spanish business message.
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000004',true);
create temp table sale_rb9 as select registrar_venta('50000000-0000-0000-0000-000000000001','efectivo','[{"producto_id":"40000000-0000-0000-0000-000000000003","cantidad":1,"precio_unitario":1000,"envases_recibidos":0}]',0,null,'73000000-0000-0000-0000-000000000001') as id;
update ventas set anulado=true where id=(select id from sale_rb9);
select throws_ok($q$insert into venta_detalles(venta_id,producto_id,cantidad,precio_unitario,envases_recibidos) values((select id from sale_rb9),'40000000-0000-0000-0000-000000000003',1,1000,0)$q$,'P0001','La venta está anulada','RB-9 line insert into an annulled sale raises La venta está anulada');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000003'),20,'RB-9 rejected line leaves the seller load unchanged after the sale annul');

-- RB-11: a correction retried with the same key is a no-op: no second annul/reinsert and no audit row.
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
insert into despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');
insert into despacho_detalles(despacho_id,producto_id,cantidad) values('71000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002',4);
select registrar_devolucion('71000000-0000-0000-0000-000000000004','[{"producto_id":"40000000-0000-0000-0000-000000000002","cantidad":3}]','[]','75000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000001',true);
select corregir_devolucion('71000000-0000-0000-0000-000000000004','20000000-0000-0000-0001-000000000001','[{"producto_id":"40000000-0000-0000-0000-000000000002","cantidad":1}]','[]','Conteo verificado','75000000-0000-0000-0000-000000000002');
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000002'),97,'RB-11 correction moves the outstanding balance (96 to 99 to 97)');
create temp table audit_rb11 as select count(*) n from auditoria;
select lives_ok($q$select corregir_devolucion('71000000-0000-0000-0000-000000000004','20000000-0000-0000-0001-000000000001','[{"producto_id":"40000000-0000-0000-0000-000000000002","cantidad":1}]','[]','Conteo verificado','75000000-0000-0000-0000-000000000002')$q$,'RB-11 retried correction with the same key returns the original result');
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000002'),97,'RB-11 retry leaves warehouse stock unchanged');
select is((select cantidad from carga_vendedor where vendedor_id='20000000-0000-0000-0001-000000000004' and producto_id='40000000-0000-0000-0000-000000000002'),23,'RB-11 retry leaves seller load unchanged');
select is((select count(*) from devoluciones_productos where despacho_id='71000000-0000-0000-0000-000000000004' and not anulado),1::bigint,'RB-11 retry creates no second active return');
select is((select count(*) from auditoria),(select n from audit_rb11),'RB-11 retry writes no audit rows');
select throws_ok($q$select corregir_devolucion('71000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000001','[]','[]','Otro despacho','75000000-0000-0000-0000-000000000002')$q$,'P0001','La clave de reintento pertenece a otra operación.','RB-11 correction key cannot be replayed on another dispatch');
select lives_ok($q$select corregir_devolucion('71000000-0000-0000-0000-000000000004','20000000-0000-0000-0001-000000000001','[{"producto_id":"40000000-0000-0000-0000-000000000002","cantidad":1}]','[]','Sin clave')$q$,'RB-11 correction without a key still applies (legacy callers)');
select is((select cantidad from stock_bodega where sucursal_id='10000000-0000-0000-0000-000000000001' and producto_id='40000000-0000-0000-0000-000000000002'),97,'RB-11 keyless correction keeps the same net balance');

-- RB-15: bodega reads only its own profile and the narrow seller list; no seller rut or telefono.
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
set local role authenticated;
select is((select count(*) from public.perfiles),1::bigint,'RB-15 bodega reads only its own profile row');
select is((select count(*) from public.perfiles where rol='vendedor'),0::bigint,'RB-15 bodega cannot read seller profile rows');
select is((select count(*) from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001')),1::bigint,'RB-15 bodega lists active sellers of its branch');
select is((select id from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001')),'20000000-0000-0000-0001-000000000004'::uuid,'RB-15 narrow seller list returns the seller id');
select is((select count(*) from public.vendedores_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'RB-15 bodega sees no sellers of another branch');
-- RB-16 (dispatch half): the seller of a dispatch must belong to its branch; the scoped helper keeps this for direct inserts.
select lives_ok($q$insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002')$q$,'RB-15 direct dispatch header for an in-branch seller still passes RLS');
select throws_ok($q$insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values('71000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0002-000000000004','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002')$q$,'42501',null,'RB-16 direct dispatch for a seller of another branch is denied');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000004',true);
set local role authenticated;
select is((select count(*) from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'RB-15 sellers cannot list the seller roster');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000001',true);
set local role authenticated;
select is((select count(*) from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001')),1::bigint,'RB-15 branch administration lists sellers of its branch');
select is((select count(*) from public.vendedores_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'RB-15 branch administration does not list sellers of another branch');

-- RB-16: a client can be assigned only to an active seller of the same branch.
select lives_ok($q$insert into public.clientes(sucursal_id,vendedor_id,nombre,direccion,creado_por) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','Cliente B6 válido','Sintética','20000000-0000-0000-0001-000000000001')$q$,'RB-16 administration assigns a client to an active seller of its branch');
select throws_ok($q$insert into public.clientes(sucursal_id,vendedor_id,nombre,direccion,creado_por) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000002','Cliente B6 bodega','Sintética','20000000-0000-0000-0001-000000000001')$q$,'42501',null,'RB-16 client cannot be assigned to a non-seller profile');
reset role;
update public.perfiles set activo=false where id='20000000-0000-0000-0001-000000000004';
set local role authenticated;
select throws_ok($q$insert into public.clientes(sucursal_id,vendedor_id,nombre,direccion,creado_por) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000004','Cliente B6 inactivo','Sintética','20000000-0000-0000-0001-000000000001')$q$,'42501',null,'RB-16 client cannot be assigned to an inactive seller');
reset role;

-- RB-5: the action check is NOT VALID (no full scan on upgrade) but still checks new rows.
select is((select convalidated from pg_constraint where conrelid='public.auditoria'::regclass and conname='auditoria_accion_check'),false,'RB-5 auditoria_accion_check is NOT VALID');
select throws_ok($q$insert into public.auditoria(tabla,registro_id,accion,usuario_id,valores_anteriores,valores_nuevos,motivo) values('test',gen_random_uuid(),'BORRADO',null,null,'{}'::jsonb,null)$q$,'23514',null,'RB-5 new audit rows still obey the action check');

select * from finish();
rollback;
