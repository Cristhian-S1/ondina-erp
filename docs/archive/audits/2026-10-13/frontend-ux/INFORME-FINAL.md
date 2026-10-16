# Informe final — Revisión y mejora del frontend (OND-c07)

- **Fechas:** 2026-10-13 → 2026-10-14 (pausa por límites de uso entre ambos días).
- **Rama:** `feature/frontend-ux`, creada desde `develop` `40c152b`. No se hizo merge a `develop` ni a `main`. PR #84 en borrador sólo para CI.
- **Orquestación:** Orca (`run_620b3e21571f` y, tras el reinicio del equipo, `run_3a39af3e54f3`), con un máximo de 3 workers simultáneos.
  - Codex `gpt-6.1-sol`: diagnóstico técnico, implementación técnica y revisión de lo hecho por Sonnet.
  - Claude Sonnet 5.5: diagnóstico UX/UI, implementación visual y revisión de lo hecho por Codex.
  - OpenCode GLM-5.3-Flash: medición de rendimiento y documentación.
- **Alcance:** calidad, rendimiento, usabilidad y responsividad, sin funcionalidades nuevas ni HU del Sprint 2. Sin cambios en SQL, migraciones, Supabase remoto, Vercel ni CSP.

## Resultado

| Indicador | Antes (40c152b) | Después (feature/frontend-ux) |
| --- | --- | --- |
| Desbordes horizontales en el barrido ruta×rol×ancho | 3 rutas a 375 px (Despachos 382 px, Incidencias 397 px, Devoluciones 553 px con detalle) | **0/420** (A2 → C2) |
| Controles táctiles < 44 px | 1 | **0/420** |
| Errores o warnings de consola | 0 | 0/420 |
| JS inicial total (gzip, entry + preloads) | 158.877 B | **151.494 B (−4,6 %)** |
| CSS inicial (gzip) | 43.684 B | **6.865 B (−84 %)** |
| Bytes transferidos en primera carga (Lighthouse, 9 combinaciones) | 206–209 kB | **165–168 kB (−20 %)** |
| LCP móvil `/login` / portada | 2.171 / 2.416 ms | **1.965 / 2.265 ms** |
| Rendimiento Lighthouse (móvil/tablet; escritorio) | 96–97; 100 | 97–98; 100 |
| Chunk de Ranking | 179 KB | 3,7 KB |
| Pruebas unitarias | 529 | **691** |
| Integración contra Supabase local (`test:integration`) | 22/22 | 22/22 |
| `npm run size` | 3 métricas | 5 métricas (añade JS/CSS inicial total), todas OK |
| TypeScript | sin `strict` explícito | `strict: true` (app y node) |

Detalle en [C1-medicion-final.md](C1-medicion-final.md) y [C2-barrido-final.md](C2-barrido-final.md). La línea base está en [A3-linea-base.md](A3-linea-base.md), [A1-tecnico.md](A1-tecnico.md) y [A2-ux-ui.md](A2-ux-ui.md).

## Estado de los hallazgos

C2 reverificó 86 hallazgos de A1, A2, R1, R2, R3 y R4: **71 resueltos, 7 parciales, 5 diferidos y 3 no resueltos** (los 3 son P3 de R2, diferidos de forma explícita). Los dos P1 técnicos (carrera de sucursal en Bodega y ceros falsos en Producción) y los tres bloqueantes de layout de A2 están resueltos.

## Lo mejorado (por lote)

- **B5 — Base común de la interfaz:**
  - Menú móvil como modal accesible: ciclo de foco, fondo inerte, Escape y nombre, rol y sucursal visibles.
  - Login con error anunciado, controles de 44 px y botón para mostrar la contraseña.
  - Componente compartido `EstadoVista` para carga, vacío y error.
  - Formato de fechas único (es-CL, America/Santiago).
  - Encabezados de tabla con contraste 7,24:1.
  - Campana sin función retirada, `document.title` por ruta y secciones de administración marcadas como "Próximamente".
- **B1 — Bodega:**
  - Lecturas con clave por sucursal y remontaje por ámbito: ya no se mezclan datos ni borradores entre sucursales.
  - Jornada reactiva, claves estables en las filas del modal, sin desborde a 375 px y "Vendedor no disponible" en lugar de "Desconocido".
- **B2 — Producción:**
  - Un error ya nunca se muestra como cero ni como lista vacía.
  - Consultas independientes por sección, tablas convertidas en tarjetas en móvil, Toast para mutaciones y título y sub-navegación por sección.
- **B3 — Registrar venta, cliente y gastos:**
  - Campos accesibles (`CampoFormulario`: aria-invalid y aria-describedby).
  - Resumen de la venta confirmada sin redirección (folio copiable y total leído de la BD).
  - Prevención cuando no hay carga o clientes, y aviso de alcance para el administrador.
  - Barra fija con total y confirmar en móvil.
  - Borrador con escritura agrupada y menos renders.
  - Tras una venta se invalidan comisión y ranking.
- **B4 — Ventas en modo lectura:**
  - Ranking con mes calculado en Santiago, React Query y reintento; selectores nativos en lugar de Mantine.
  - Mi comisión con etiquetas en español.
  - Textos según el rol y sin CTAs duplicados.
- **B6 — Herramientas:**
  - Chunk `vendor-supabase` explícito. Corrige una regresión de B5 que metía Supabase en el entry (+56 KB).
  - Métricas de JS y CSS inicial total y TypeScript `strict`.
- **B7:** se retiraron Mantine y dayjs (era sólo un provider con estilos globales). Es la mayor ganancia de rendimiento.
- **Revisiones cruzadas y correcciones:**
  - R1 y R2 (Sonnet revisa a Codex) → FX.
  - R3 (Codex revisa a Sonnet) → FX3.
  - R4 (Sonnet revisa B3 y FX) → FX2.
  - Entre lo corregido: errores dentro del diálogo, refetch que ya no tapa los datos, filtros de fecha en zona de Santiago, restauración del cliente del borrador, confirmación explícita de ventas de $0, despachos anunciados con un aviso y nombre accesible para "Cerrar sesión".
- **D1:** `docs/engineering/frontend.md` y `architecture.md` documentan las convenciones nuevas.

## Descartado, diferido o pendiente

- **A1-08 (Beads OND-c07.10):** paginación o rango del historial de despachos. Cambia qué datos ve el usuario y requiere medir con volumen real.
- **Decisión de producto (OND-c07.14):** la BD acepta ventas con total $0. La UI ahora pide confirmación explícita; prohibirlas requiere un cambio en la BD.
- **R2-04 (OND-c07.14):** registrar producción no tiene clave de idempotencia. Requiere backend.
- **P3 pendientes (OND-c07.13):** N-01 ("Desconocido" en Stock), N-02 (el historial de producción mide 6.074 px de alto en móvil), A1-02/R1-12 (Despachos y Devoluciones siguen siendo componentes grandes), R1-14 (nombres de vendedores históricos limitados por RLS) y R2-08/09/11.
- **Lighthouse:** `unused-javascript` y `color-contrast` siguen por debajo de 100 (C1-01..04). El +3 de accesibilidad en `/login` es un artefacto del cálculo de LH 12.8.2, no una corrección de contraste.

## Incidencias del proceso

- Las mediciones de tamaño sin `frontend/.env.local` son falsas: `lib/supabase.ts` lanza un error al importarse y el bundler elimina Supabase. La regresión de B5 se detectó por eso y se corrigió en B6. Ahora está documentado en `docs/engineering/frontend.md`.
- `vite preview` aplica la CSP de producción, que bloquea Supabase local. La medición usa `scripts/servidor-local-a3.mjs`, que sólo añade `connect-src` local.
- Hubo una pausa por los límites de 5 h de Codex y Claude, y el equipo se reinició durante la pausa: B3 se reanudó desde su commit WIP en un Run nuevo.
- OpenCode 2 no acepta `--model` al lanzarse; se verificó en pantalla que usaba GLM-5.3-Flash.

## Cómo probar la rama

```bash
git fetch origin && git switch feature/frontend-ux
supabase start                       # stack local con seed
cd frontend && npm ci
printf 'VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_ANON_KEY=%s\n' \
  "$(cd .. && supabase status -o env | grep '^ANON_KEY' | cut -d'"' -f2)" > .env.local
npm run lint && npm run build && npm run size && npm run test && npm run test:integration
npm run dev
```

Las cuentas sintéticas de navegación (`ux-vendedor@`, `ux-bodega@`, `ux-produccion@`, `ux-admin@` y `ux-admin-global@`, dominio `example.invalid`, contraseña `ux-local-2026`) existen sólo en la BD local de esta estación. En otra máquina hay que crearlas con la Auth admin API local, como hace `tests/integration/global-setup.ts`. Recorrido sugerido a 375, 768 y 1280 px: registrar venta (vendedor y admin), Despachos con el modal, Devoluciones con detalle, las cinco secciones de Producción, Ranking y el menú móvil.
