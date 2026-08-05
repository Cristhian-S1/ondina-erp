-- ============================================================================
-- Datos semilla — Ondina (esquema final)
-- ============================================================================
-- Este archivo fusiona en uno solo los dos seeds que antes vivían por separado.
-- Se compone de dos secciones que respetan la separación original:
--
--   SECCIÓN A — Seed base / configuración (antes bd/seed_v2.sql)
--       Sucursal inicial, parámetros configurables, catálogo mínimo de tipos
--       de empaque y bucket de Storage. Es configuración mínima y requerida
--       por triggers y vistas; el administrador la ajusta desde la app.
--
--   SECCIÓN B — Datos de prueba (antes bd/seed_datos_prueba.sql)
--       Sucursales de ejemplo, perfiles vinculados a usuarios de auth.users,
--       tipos de empaque, productos y existencias iniciales para probar los
--       flujos de ventas, despacho y producción en un entorno de desarrollo.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql.
-- Opcional (según sección): bd/triggers_negocio.sql, bd/auditoria.sql,
-- bd/vistas.sql y bd/rls_policies.sql.
-- Idempotente en su mayor parte (ON CONFLICT DO NOTHING).
-- ============================================================================

begin;

-- ============================================================================
-- SECCIÓN A — SEED BASE / CONFIGURACIÓN
-- (Antes: bd/seed_v2.sql)
-- ============================================================================

-- Sucursal inicial (una planta, por ahora)
insert into public.sucursales (nombre, comuna, region, activa)
values ('Planta Ondina', null, null, true)
on conflict (nombre) do nothing;

-- Parámetros configurables usados por triggers y vistas (RNF-26)
insert into public.configuracion (clave, valor, descripcion) values
    ('ventana_ajuste_minutos', '15',  'Minutos para sumar productos a un despacho ya registrado (RNF-15: 10–20)'),
    ('dias_inactividad_cliente', '7', 'Días sin compras para alertar cliente inactivo (HU-12)')
on conflict (clave) do nothing;

-- Tipos de empaque (catálogo inicial, ajustable por el administrador)
insert into public.tipos_empaque (nombre, categoria, activo) values
    ('Bidón Policarbonato', 'retornable', true),
    ('Bidón Plástico/PET',  'retornable', true),
    ('Bidón 10L',           'retornable', true),
    ('Bolsa de Hielo',      'no_retornable', true)
on conflict (nombre) do nothing;

-- Bucket de Storage para comprobantes de gastos (RF-21, HU-07)
-- Crea el bucket requerido por las políticas storage de rls_policies.sql.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- ============================================================================
-- SECCIÓN B — DATOS DE PRUEBA
-- (Antes: bd/seed_datos_prueba.sql)
-- ============================================================================

-- 0) Compatibilidad: este bloque actualiza el constraint de tipos_empaque para
--    admitir la categoría 'uso_interno' (usada por bandejas/cajas en BD de
--    prueba importadas de versiones previas del esquema). Con el esquema final
--    (que ya la contempla o no), el DDL idempotente no rompe la ejecución.
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

-- 1) SUCURSALES (ejemplos)
insert into public.sucursales (nombre, direccion, comuna, region, telefono, activa) values
  ('Ondina - Arica',   'Av. Comandante San Martín 2450', 'Arica',     'Arica y Parinacota', '+56 58 220 1111', true),
  ('Ondina - Iquique', 'Av. Arturo Prat 1850',           'Iquique',  'Tarapacá',           '+56 57 240 2222', true)
on conflict (nombre) do nothing;

-- 2) PERFILES de prueba: el id debe coincidir con el UUID de auth.users.
--    REEMPLAZA los emails CAMBIAR-* por los de tus usuarios en Authentication > Users.
--    En el esquema final `perfiles.sucursal_id` es NOT NULL, por lo que también
--    el administrador queda asignado a una sucursal (aquí "Ondina - Arica").
insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Camila', 'Salinas', '17.123.456-7', '+56 9 1111 0001', 'administrador', true
from auth.users u, public.sucursales s
where u.email = 'admin@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Diego', 'Moreno', '18.765.432-1', '+56 9 1111 0002', 'vendedor', true
from auth.users u, public.sucursales s
where u.email = 'vendedor@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Felipe', 'Contreras', '19.234.567-3', '+56 9 1111 0003', 'bodega', true
from auth.users u, public.sucursales s
where u.email = 'despacho@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

-- 3) TIPOS DE EMPAQUE (prueba)
insert into public.tipos_empaque (nombre, categoria, activo) values
  ('Bidón 5 Litros',     'retornable',   true),
  ('Bidón 20 Litros',    'retornable',   true),
  ('Bolsa de Hielo 1kg', 'no_retornable', true),
  ('Bandeja',            'uso_interno',  true)
on conflict (nombre) do nothing;

-- 4) PRODUCTOS
insert into public.productos (nombre, tipo, tipo_empaque_id, precio_base, activo)
select v.nombre, v.tipo, t.id, v.precio, true
from (values
  ('Agua Purificada 5L',  'agua',  'Bidón 5 Litros',    1000),
  ('Agua Purificada 20L', 'agua',  'Bidón 20 Litros',   3000),
  ('Hielo en Bolsa 1kg',  'hielo', 'Bolsa de Hielo 1kg', 1200)
) as v(nombre, tipo, empaque, precio)
join public.tipos_empaque t on t.nombre = v.empaque
on conflict (nombre) do nothing;

-- 5) STOCK_BODEGA por sucursal y producto
insert into public.stock_bodega (sucursal_id, producto_id, cantidad)
select s.id, p.id, v.cantidad
from (values
  ('Ondina - Arica',   'Agua Purificada 5L',   200),
  ('Ondina - Arica',   'Agua Purificada 20L',  120),
  ('Ondina - Arica',   'Hielo en Bolsa 1kg',    80),
  ('Ondina - Iquique', 'Agua Purificada 5L',   150),
  ('Ondina - Iquique', 'Agua Purificada 20L',   60),
  ('Ondina - Iquique', 'Hielo en Bolsa 1kg',    40)
) as v(sucursal, producto, cantidad)
join public.sucursales s on s.nombre = v.sucursal
join public.productos p on p.nombre = v.producto
on conflict (sucursal_id, producto_id) do nothing;

-- 6) STOCK_ENVASES por sucursal y tipo de empaque
insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad)
select s.id, t.id, v.cantidad
from (values
  ('Ondina - Arica',   'Bidón 5 Litros',     300),
  ('Ondina - Arica',   'Bidón 20 Litros',    150),
  ('Ondina - Arica',   'Bolsa de Hielo 1kg', 200),
  ('Ondina - Arica',   'Bandeja',             40),
  ('Ondina - Iquique', 'Bidón 5 Litros',     250),
  ('Ondina - Iquique', 'Bidón 20 Litros',     80),
  ('Ondina - Iquique', 'Bolsa de Hielo 1kg', 120),
  ('Ondina - Iquique', 'Bandeja',             25)
) as v(sucursal, empaque, cantidad)
join public.sucursales s on s.nombre = v.sucursal
join public.tipos_empaque t on t.nombre = v.empaque
on conflict (sucursal_id, tipo_empaque_id) do nothing;

commit;