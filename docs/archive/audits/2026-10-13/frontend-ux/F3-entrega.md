# F3 · Feedback del usuario: Producción (OND-c07.18)

Fecha: 2026-10-14 · Rama de worktree `Cristhian-S1/fux-f3-produccion` · Base `origin/feature/frontend-ux`.

## Cambios (solo `frontend/src/domains/produccion/**`)

1. **Filtros en Producción reciente** (`/produccion/registrar`): producto y rango de fechas, con el mismo componente que Historial.
   - `components/FiltrosProduccion.tsx` + `components/filtros.ts` (extraídos de `HistorialProduccion`, que ahora los reutiliza).
   - `components/ProduccionReciente.tsx`: sin filtros muestra la lista reciente ya cargada (30); con filtros consulta `obtenerHistorialProduccion` (hasta 200). Estado vacío: «No hay producciones para los filtros seleccionados.»; un rango invertido muestra el error asociado y no consulta. La etiqueta del filtro es «Filtrar por producto» para no chocar con el campo «Producto» del formulario.
2. **Formulario independiente de la lista**: `gridCls` con `items-start` y `formCls` con `self-start`; las listas de producción reciente, incidencias y mermas tienen `xl:max-h-* xl:overflow-y-auto` (alto propio y desplazamiento solo en escritorio; en móvil/tablet se apilan de forma natural). Aplica a Registrar e Incidencias (incidencias y mermas). Envases es una grilla de tarjetas sin formulario: no aplica.
3. **InputNumerico**: pendiente; el coordinador aún no avisó de que exista `components/InputNumerico.tsx`.

## Pruebas (TDD)

- `ProduccionReciente.test.tsx`: lista sin consultar historial, filtros por producto/fechas, limpiar filtros, clases de scroll.
- `Produccion.test.tsx`: formulario `self-start`, contenedor `items-start`, lista fuera del formulario con alto propio.
- `Produccion.branch.test.tsx`: ajustado (`findAllByRole`) porque «Agua» aparece también en el filtro.

## Verificación

- `npm run lint`, `npm run build`, `npm run size` (5 métricas OK), `npm run test` (53 archivos, 696 pruebas): verdes.
- Visual con 70+ registros sintéticos locales (40 producciones, 25 incidencias, 25 mermas; cuenta `ux-produccion@example.invalid`):

| Vista | Anchos | scrollWidth ≤ innerWidth | Alto del formulario |
|---|---|---|---|
| registrar | 375 / 768 / 1280 | ✔ en los tres | 417 px en los tres |
| incidencias | 375 / 768 / 1280 | ✔ en los tres | 365 / 325 / 345 px (varía solo por el ancho del texto) |

Capturas: `capturas/f3-registrar-{375,768,1280}.png`, `capturas/f3-incidencias-{375,768,1280}.png`.

## F3b · InputNumerico en Producción (ítem 3)

- `Produccion.tsx`: cantidad de producción y cantidad de merma usan `components/InputNumerico` (solo dígitos, miles con punto, placeholder `0`, flechas ±1). Las etiquetas se enlazan por `htmlFor` y el foco por error de envío se conserva.
- **Validación en tiempo real**: `calculos.ts` (`limiteEnvases`, `mensajeLimiteEnvases`) toma el `tipo_empaque_id` del producto elegido y los envases vacíos retornables de la sucursal (misma consulta de la sección Envases, ahora también activa en Registrar). Si la cantidad los supera se muestra bajo el input «Solo hay N envases vacíos disponibles para este producto.»; no se usa `max` para no recortar en silencio (patrón de Registrar venta) y el envío queda bloqueado con el mismo mensaje. Sin envase retornable conocido no hay límite. La merma no tiene límite de disponibilidad conocido en esta pantalla, por lo que solo adopta el componente.
- Pruebas: rechazo de texto y formato de miles, error en tiempo real, envío bloqueado (`Produccion.test.tsx`); ajuste de `aria-invalid` en `Produccion.branch.test.tsx`.
- Verificación: lint, build, size (5 métricas OK) y test (54 archivos, 713 pruebas) verdes. Visual 375/768/1280 en registrar e incidencias sin desborde (scrollWidth = innerWidth); con 99.999 aparece el error de envases y `12a34` en merma queda `1.234`.
- Capturas: `capturas/f3b-registrar-{375,1280}.png`, `capturas/f3b-incidencias-{375,768}.png`.
