# FX3 — Correcciones de la revisión R3 sobre B5 y B4

Fecha: 2026-10-14. Base: `origin/feature/frontend-ux` (`a5f4705`). Informe de origen: `R3-revision-B5-B4-B7.md`.

## Hallazgos resueltos

| ID | Corrección | Commit |
| --- | --- | --- |
| R3-02 | `DashboardLayout` guarda el nombre de sucursal junto a su ámbito (`perfil.id:sucursal_id`) y lo renderiza sólo si coincide con el actual; si la lectura nueva falla, cae a “Sucursal asignada”. Se conserva la protección frente a respuestas tardías. | `836d46a` |
| R3-03 | `fmtFecha`/`fmtFechaHora` reconocen `AAAA-MM-DD` (validado, incluye bisiestos) y lo formatean como fecha de calendario sin zona. `fmtFechaHora` con fecha civil devuelve sólo la fecha (no inventa hora). Timestamps/DST sin cambios. | `836d46a` |
| R3-04 | El selector de año ofrece de 2020 hasta el año actual (rango amplio y fijo, constante `ANIO_INICIAL`, sin consultas nuevas); el ajuste de mes futuro al volver al año actual se mantiene. | `836d46a` |
| R3-05 | El botón “Cerrar sesión” tiene `aria-label` permanente y `title` al colapsar. | `836d46a` |

## Descartados / fuera de alcance

- R3-01 (invalidación del ranking tras registrar venta): lo corrige otro worker; no se tocó `useRegistrarVenta`.
- R3-04: no se fijó una política de retención; 2020 es un piso amplio documentado en el código. Si producto define otro, es un cambio de constante.

## Pruebas añadidas (4 archivos tocados, +6 pruebas; 674 en total)

- `DashboardLayout.test.tsx`: A→B con rechazo de la lectura nueva (R3-02); `aria-label` de Cerrar sesión (R3-05).
- `format.test.ts`: fecha civil verano/invierno/bisiesto/inválida; `fmtFechaHora` con fecha civil (R3-03).
- `RankingVendedores.test.tsx`: año 2022 disponible y consulta `2022-12`; diciembre→año actual ajusta a `2026-10` (R3-04).

## Verificaciones (desde `frontend/`, con `.env.local` local)

| Control | Resultado |
| --- | --- |
| `npm run lint` | Exit 0 |
| `npm run build` | Exit 0 (advertencia conocida de import dinámico de dashboard) |
| `npm run size` | 5 métricas OK (JS entrada 94.841 / 105.567; chunk mayor 298.568 / 332.108) |
| `npm run test` | 52 archivos, 674 pruebas OK |

Visual (Chrome headless, vendedor local, 375/768/1280): `scrollWidth === innerWidth` en ranking; selector de año con 2026…2020; drawer a 375 con “Sucursal Sintética A”; a 1280 colapsado hay 1 botón con nombre accesible “Cerrar sesión”. Capturas: `capturas/fx3-ranking-vendedor-375.png`, `-1280.png`, `fx3-drawer-vendedor-375.png`.

## Límites

- La prueba de R3-02 con respuesta demorada exitosa y reapertura del menú no se añadió; la protección `activo` ya existía y la clave de ámbito cubre el caso.
- jsdom no reproduce `lg:hidden`; R3-05 se verifica por atributo y en Chrome.
- Sin lector de pantalla ni dispositivo físico.
