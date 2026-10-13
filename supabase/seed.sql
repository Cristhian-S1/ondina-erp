-- Synthetic local fixtures only. Never apply this seed to production.
-- Auth users are non-login fixtures: no passwords or external identities.
insert into public.sucursales(id, nombre, direccion) values
 ('10000000-0000-0000-0000-000000000001', 'Sucursal Sintética A', 'Dirección de prueba A'),
 ('10000000-0000-0000-0000-000000000002', 'Sucursal Sintética B', 'Dirección de prueba B');

-- IDs encode branch (fourth group) and role (last digit: admin/bodega/production/seller).
with fixtures as (
 select ('20000000-0000-0000-000' || branch || '-00000000000' || role_no)::uuid as id
 from generate_series(1,2) branch cross join generate_series(1,4) role_no
)
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'fixture-' || id || '@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()
from fixtures;

insert into public.perfiles(id, sucursal_id, nombres, apellidos, rol)
select ('20000000-0000-0000-000' || branch || '-00000000000' || role_no)::uuid,
       ('10000000-0000-0000-0000-00000000000' || branch)::uuid,
       'Fixture ' || role_name, 'Sucursal ' || branch, role_name
from generate_series(1,2) branch
cross join (values (1,'administrador'), (2,'bodega'), (3,'produccion'), (4,'vendedor')) roles(role_no,role_name);

-- Preserve/test the existing global administrator model (nullable sucursal_id).
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'global-admin@example.invalid', '{}', '{}', now(), now());
insert into public.perfiles(id, sucursal_id, nombres, apellidos, rol)
values ('20000000-0000-0000-0000-000000000001', null, 'Fixture Global', 'Administrador', 'administrador');

insert into public.tipos_empaque(id, nombre, categoria) values
 ('30000000-0000-0000-0000-000000000001', 'Bidón Policarbonato', 'retornable'),
 ('30000000-0000-0000-0000-000000000002', 'Bidón Plástico/PET', 'retornable'),
 ('30000000-0000-0000-0000-000000000003', 'Bidón 10L', 'retornable'),
 ('30000000-0000-0000-0000-000000000004', 'Bolsa Hielo CUBO', 'no_retornable'),
 ('30000000-0000-0000-0000-000000000005', 'Bolsa Hielo SACO', 'no_retornable'),
 ('30000000-0000-0000-0000-000000000006', 'Bolsa Hielo FRAPE', 'no_retornable'),
 ('30000000-0000-0000-0000-000000000007', 'Caja Interna Sintética', 'uso_interno');

insert into public.productos(id, nombre, tipo, tipo_empaque_id, precio_base)
select ('40000000-0000-0000-0000-00000000000' || ordinal)::uuid, nombre, tipo,
       ('30000000-0000-0000-0000-00000000000' || ordinal)::uuid, precio
from (values (1,'Bidón POL','agua',1000), (2,'Bidón PET','agua',1000), (3,'Bidón 10L','agua',1000),
             (4,'Hielo CUBO','hielo',400), (5,'Hielo SACO','hielo',400), (6,'Hielo FRAPE','hielo',400)) p(ordinal,nombre,tipo,precio);

insert into public.stock_bodega(sucursal_id, producto_id, cantidad)
select s.id, p.id, 100 from public.sucursales s cross join public.productos p;
insert into public.stock_envases(sucursal_id, tipo_empaque_id, cantidad)
select s.id, t.id, 100 from public.sucursales s cross join public.tipos_empaque t;
insert into public.carga_vendedor(vendedor_id, producto_id, cantidad)
select v.id, p.id, 20 from public.perfiles v cross join public.productos p where v.rol = 'vendedor';
insert into public.configuracion(clave, valor, descripcion)
values ('dias_inactividad_cliente', '30', 'Synthetic inactivity threshold');

insert into public.clientes(id, sucursal_id, vendedor_id, nombre, direccion, creado_por)
select ('50000000-0000-0000-0000-00000000000' || branch)::uuid,
       ('10000000-0000-0000-0000-00000000000' || branch)::uuid,
       ('20000000-0000-0000-000' || branch || '-000000000004')::uuid,
       'Cliente Sintético ' || branch, 'Dirección de prueba',
       ('20000000-0000-0000-000' || branch || '-000000000004')::uuid
from generate_series(1,2) branch;
