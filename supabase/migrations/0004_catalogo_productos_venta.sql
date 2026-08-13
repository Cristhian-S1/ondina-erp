-- ============================================================================
-- Migración 0004 — Catálogo de productos para el módulo de ventas
-- ============================================================================
-- Define los 6 productos vendibles que el frontend precarga por defecto en
-- RegistrarVenta (HU-01):
--   • Bidón POL         (agua)  $1.000  empaque: Bidón Policarbonato
--   • Bidón PET         (agua)  $1.000  empaque: Bidón Plástico/PET
--   • Bidón 10L         (agua)  $1.000  empaque: Bidón 10L
--   • Hielo CUBO        (hielo)   $400  empaque: Bolsa Hielo CUBO
--   • Hielo SACO        (hielo)   $400  empaque: Bolsa Hielo SACO
--   • Hielo FRAPE       (hielo)   $400  empaque: Bolsa Hielo FRAPE
--
-- Idempotente (ON CONFLICT nombre DO NOTHING) para no duplicar al re-aplicar.
-- No toca los productos de prueba cargados por 0001; si un nombre coincide,
-- se respeta el existente (no se sobrescribe precio).
-- Autor: GLM-5.2 · HU-01 · issue beads ondina-01b
-- ============================================================================

-- 1) Tipos de empaque para los 3 formatos de hielo (no retornables).
--    Los bidones ya existen en el seed (Bidón Policarbonato, Poliestileno/PET, 10L).
insert into public.tipos_empaque (nombre, categoria, activo) values
  ('Bolsa Hielo CUBO',  'no_retornable', true),
  ('Bolsa Hielo SACO',  'no_retornable', true),
  ('Bolsa Hielo FRAPE', 'no_retornable', true)
on conflict (nombre) do nothing;

-- 2) Productos vendibles. Bidones con precio_base = 1000, hielos = 400.
insert into public.productos (nombre, tipo, tipo_empaque_id, precio_base, activo)
select v.nombre, v.tipo, t.id, v.precio, true
from (values
  ('Bidón POL',    'agua',  'Bidón Policarbonato', 1000),
  ('Bidón PET',    'agua',  'Bidón Plástico/PET',   1000),
  ('Bidón 10L',    'agua',  'Bidón 10L',            1000),
  ('Hielo CUBO',   'hielo', 'Bolsa Hielo CUBO',      400),
  ('Hielo SACO',   'hielo', 'Bolsa Hielo SACO',      400),
  ('Hielo FRAPE',  'hielo', 'Bolsa Hielo FRAPE',     400)
) as v(nombre, tipo, empaque, precio)
join public.tipos_empaque t on t.nombre = v.empaque
on conflict (nombre) do nothing;