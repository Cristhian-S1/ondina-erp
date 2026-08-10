# Diseño — Filtros en la vista de Despachos

- **Fecha:** 2026-08-07
- **Rama:** `feature/bodega`
- **Ámbito:** Bodega / Despacho (UX de la vista de despachos)
- **Estado:** Aprobado

## Resumen

La vista de Despachos muestra actualmente todos los despachos de la sucursal
("Últimos despachos") sin filtros. Se agregan dos filtros para mejorar la
experiencia del usuario: **por día** (hoy por defecto) y **por vendedor**. El
panel lateral de devoluciones (agrupadas por despacho) sigue los mismos filtros
para mantener consistencia visual.

## Decisiones de diseño acordadas

- El filtro por día usa **chips rápidos** (`Hoy`, `Ayer`, `7 días`, `Todo`) más un
  **input de calendario** (fecha libre). `Hoy` es el valor por defecto.
- Si el día seleccionado no tiene despachos, se muestra el mensaje vacío del
  filtro (no se cae a "recientes").
- El aside de devoluciones **sigue los filtros** de día y vendedor.
- Filtrado **en el frontend** (cliente) sobre los datos ya cargados de la
  sucursal. Sin cambios en API ni en base de datos.
- Filtro de vendedor disponible para roles `bodega` y `administrador` por igual.

---

## Sección 1 — Toolbar de filtros

Barra dentro de la card de la sección de despachos, entre el encabezado y el
listado. Contiene:

- **Chips de día:** `Hoy` (activo por defecto) · `Ayer` · `7 días` · `Todo`. El
  chip seleccionado se marca visualmente como activo.
- **Calendario:** input `type="date"`. Al elegir una fecha, el filtro pasa a
  "ese día puntual" y ningún chip queda activo.
- **Vendedor:** select con `Todos los vendedores` + la lista de vendedores de la
  sucursal (ya cargados en el estado `vendedores`).

## Sección 2 — Estado de filtros y lógica de fechas

- `dia`: uno de `hoy | ayer | 7d | todo | fecha`.
- `fechaSeleccionada`: `YYYY-MM-DD`; solo aplica cuando `dia === 'fecha'`.
- `vendedorFiltro`: `''` = todos, o el `id` de un vendedor.

La comparación por día se hace contra `creado_en` del despacho usando la
**fecha local** del usuario (mismo criterio que `fmtFecha`):

- `hoy`: mismo día calendario local que hoy.
- `ayer`: el día calendario local anterior.
- `7d`: hoy más los 6 días anteriores (ventana inclusiva de 7 días).
- `fecha`: el día calendario local de `fechaSeleccionada`.

Los chips y el calendario son mutuamente excluyentes: elegir un chip limpia la
fecha; elegir una fecha desactiva el chip.

## Sección 3 — Efecto en la lista de despachos

- Los despachos visibles son `despachos.filter(porDia && porVendedor)`.
- El contador "N registros" refleja los **filtrados**.
- Al cambiar cualquier filtro se colapsa la card expandida
  (`setDespachoExpandido(null)`), para no dejar abierta una card de un despacho
  que dejó de estar visible.
- Si el resultado es vacío: mensaje *"No hay despachos para el día y vendedor
  seleccionados."*
- El modal "Nuevo despacho" no se ve afectado por los filtros.

## Sección 4 — Efecto en el aside de devoluciones

`gruposDevolucion` se recalcula considerando solo los despachos que pasan los
filtros de día y vendedor (el grupo se filtra por el despacho al que pertenece la
devolución). Si no hay devoluciones en el filtro, se mantiene el mensaje vacío
existente.

## Sección 5 — Alcance y no-cambios

- Solo se modifica `frontend/src/domains/bodega/pages/Despachos.tsx` (y
  posiblemente un helper de fechas local al archivo).
- No hay cambios en `api.ts`, tipos, SQL ni base de datos.
- No se agregan dependencias nuevas.
