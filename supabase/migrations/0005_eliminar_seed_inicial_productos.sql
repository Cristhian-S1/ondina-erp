-- Migración 0005 — Desactivar productos semilla iniciales del catálogo
--
-- En lugar de borrar físicamente los 3 productos cargados por 0001_init.sql
-- (Agua Purificada 5L, Agua Purificada 20L y Hielo en Bolsa 1kg) se hace
-- soft-delete (UPDATE activo = false) porque ya están referenciados por
-- stock_bodega y borrarlos violaría la FK. El frontend (HU-01 y HU-04)
-- filtra por productos activos, así que desaparecen del selector sin
-- romper la integridad referencial ni el histórico de carga/ventas.
--
-- El catálogo activo queda en los 6 productos cargados en
-- 0004_catalogo_productos_venta.sql (Bidón POL/PET/10L y Hielo CUBO/SACO/
-- FRAPE). El formulario HU-01 precarga 3 (Bidón POL, Bidón PET, Hielo
-- CUBO); los otros 3 quedan accesibles con el botón "Agregar producto".

update public.productos
   set activo = false
 where nombre in ('Agua Purificada 5L', 'Agua Purificada 20L', 'Hielo en Bolsa 1kg');