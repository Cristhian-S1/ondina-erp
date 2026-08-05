-- Seed de datos de prueba para Ondina
-- Requisitos:
--  1. Aplicar primero ondina_schema.sql y rls_policies.sql
--  2. Crear los 3 usuarios en Authentication > Users (admin + vendedor + despacho)
--     y REEMPLAZAR abajo los emails CAMBIAR-* por los emails reales de cada uno.
--  3. Este script resuelve el id de cada perfil usando el email de auth.users,
--     así perfiles.id siempre coincide con el id del usuario (obligatorio para login y RLS).

begin;

-- 0) Si el esquema se aplicó antes de agregar la categoría 'uso_interno',
--    este DO actualiza el constraint (con esquema nuevo no hace nada).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'tipos_empaque_categoria_check'
  ) then
    alter table tipos_empaque drop constraint tipos_empaque_categoria_check;
    alter table tipos_empaque add constraint tipos_empaque_categoria_check
      check (categoria in ('retornable', 'no_retornable', 'uso_interno'));
  end if;
end $$;

-- 1) SUCURSALES
insert into sucursales (nombre, direccion, comuna, region, telefono, activa) values
  ('Ondina - Arica',   'Av. Comandante San Martín 2450', 'Arica',     'Arica y Parinacota', '+56 58 220 1111', true),
  ('Ondina - Iquique', 'Av. Arturo Prat 1850',           'Iquique',   'Tarapacá',           '+56 57 240 2222', true)
on conflict (nombre) do nothing;

-- 2) PERFILES
-- El id debe ser el UUID de auth.users. Se resuelve por email.
-- REEMPLAZA los emails CAMBIAR-* por los de tus usuarios en Authentication > Users.
-- El administrador no tiene sucursal asignada (sucursal_id = null): ve y opera en
-- todas. El vendedor y el bodega pertenecen a Ondina - Arica.

-- Administrador (sin sucursal: opera en todas)
insert into perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, null, 'Camila', 'Salinas', '17.123.456-7', '+56 9 1111 0001', 'administrador', true
from auth.users u
where u.email = 'admin@ondina.cl'
on conflict (id) do nothing;

-- Vendedor
insert into perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Diego', 'Moreno', '18.765.432-1', '+56 9 1111 0002', 'vendedor', true
from auth.users u, sucursales s
where u.email = 'vendedor@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

-- Bodega / despacho
insert into perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Felipe', 'Contreras', '19.234.567-3', '+56 9 1111 0003', 'bodega', true
from auth.users u, sucursales s
where u.email = 'despacho@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

-- 3) TIPOS_EMPAQUE
insert into tipos_empaque (nombre, categoria, activo) values
  ('Bidón 5 Litros',   'retornable',    true),
  ('Bidón 20 Litros',  'retornable',    true),
  ('Bolsa de Hielo 1kg', 'no_retornable', true),
  ('Bandeja',          'uso_interno',   true)
on conflict (nombre) do nothing;

-- 4) PRODUCTOS
insert into productos (nombre, tipo, tipo_empaque_id, precio_base, activo)
select v.nombre, v.tipo, t.id, v.precio, true
from (values
  ('Agua Purificada 5L',    'agua',  'Bidón 5 Litros',     1000),
  ('Agua Purificada 20L',   'agua',  'Bidón 20 Litros',    3000),
  ('Hielo en Bolsa 1kg',    'hielo', 'Bolsa de Hielo 1kg', 1200)
) as v(nombre, tipo, empaque, precio)
join tipos_empaque t on t.nombre = v.empaque
on conflict (nombre) do nothing;

-- 5) STOCK_BODEGA por sucursal y producto
insert into stock_bodega (sucursal_id, producto_id, cantidad)
select s.id, p.id, v.cantidad
from (values
  ('Ondina - Arica',   'Agua Purificada 5L',   200),
  ('Ondina - Arica',   'Agua Purificada 20L',  120),
  ('Ondina - Arica',   'Hielo en Bolsa 1kg',    80),
  ('Ondina - Iquique', 'Agua Purificada 5L',   150),
  ('Ondina - Iquique', 'Agua Purificada 20L',   60),
  ('Ondina - Iquique', 'Hielo en Bolsa 1kg',    40)
) as v(sucursal, producto, cantidad)
join sucursales s on s.nombre = v.sucursal
join productos p on p.nombre = v.producto
on conflict (sucursal_id, producto_id) do nothing;

-- 6) STOCK_ENVASES por sucursal y tipo de empaque
insert into stock_envases (sucursal_id, tipo_empaque_id, cantidad)
select s.id, t.id, v.cantidad
from (values
  ('Ondina - Arica',   'Bidón 5 Litros',      300),
  ('Ondina - Arica',   'Bidón 20 Litros',     150),
  ('Ondina - Arica',   'Bolsa de Hielo 1kg',  200),
  ('Ondina - Arica',   'Bandeja',              40),
  ('Ondina - Iquique', 'Bidón 5 Litros',      250),
  ('Ondina - Iquique', 'Bidón 20 Litros',      80),
  ('Ondina - Iquique', 'Bolsa de Hielo 1kg',  120),
  ('Ondina - Iquique', 'Bandeja',              25)
) as v(sucursal, empaque, cantidad)
join sucursales s on s.nombre = v.sucursal
join tipos_empaque t on t.nombre = v.empaque
on conflict (sucursal_id, tipo_empaque_id) do nothing;

commit;
