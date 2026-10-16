# B4 — Ventas (lectura y gestión): entrega

Beads OND-c07.7 · rama `Cristhian-S1/fux-b4-ventas-lectura` (base `origin/feature/frontend-ux`) · fecha 2026-10-13.

## Hallazgos resueltos

| ID | Resolución | Commit |
| --- | --- | --- |
| UX-08 / A1-13 | Mes actual en America/Santiago (`mesActualSantiago`), lectura con React Query en `useRankingVendedores` (clave por mes, usuario, sucursal y rol), error `role="alert"` + Reintentar, cargando `role="status"`, `truncate`/`min-w-0`, top 3 y fila propia destacados (`aria-current`) | `4554585` |
| UX-08 (picker) | `MonthPickerInput` de Mantine reemplazado por dos `<select>` nativos (Mes/Año, meses futuros deshabilitados, áreas ≥44 px) | `4554585` |
| UX-07 | Mi comisión: sólo la primera letra de la jornada en mayúscula, tipos `agua`/`hielo` → "Agua"/"Hielo", `<h1>` en carga/error/éxito, Reintentar con EstadoVista | `4554585` |
| Consistencia visual | `cardCls`, `text-slate-*`, jerarquía `text-2xl font-bold` + descripción `text-sm text-slate-500` en Ranking y Mi comisión; importes con `formatMiles` | `4554585` |
| UX-15 | Copy por rol en Ventas, Carga y Clientes ("tu ruta" sólo para vendedor; administrador: texto de cartera por vendedor y vacío explicativo "Tu usuario no tiene carga asignada…") | `77a34e8` |
| UX-16 (Ventas) | Sin "confirmación atómica"; eliminados los CTAs duplicados "Registrar venta"/"Ver clientes" bajo las tarjetas | `77a34e8` |
| Estados | EstadoVista en las cinco páginas y en los fallbacks de Suspense de `index.tsx`; fechas con `fmtFecha` de `lib/format` | `77a34e8` |
| Clientes | Selectores de sucursal y vendedor con etiqueta visible (verificado); tarjetas móviles ahora incluyen "Registrado" | `77a34e8` |

## Descartados / parciales

- **Tabla→tarjetas a 375 en Clientes con datos**: la base local no tiene clientes para las cuentas de prueba, así que sólo se verificó el estado vacío en navegador; el cambio tabla/tarjetas (`hidden sm:block` / `sm:hidden`) queda cubierto por lectura de código, no por captura con datos.
- **Dependencia `@mantine/dates` / `dayjs`**: ya no se importan en `src/` (sólo `main.tsx` carga estilos de Mantine). Retirarlas de `package.json` queda fuera de mi propiedad; se propone al coordinador.
- **Comisión tipo desconocido**: se muestra capitalizado como respaldo.
- Pruebas del ranking y del hook se escribieron junto con la implementación en el mismo commit, no como ciclo rojo→verde estricto.

## Pruebas añadidas

- `hooks/useRankingVendedores.test.tsx`: mes de Santiago a fin de mes 22:00 Chile (UTC ya en el mes siguiente), cambio de mes, clave de ámbito, reintento.
- `RankingVendedores.test.tsx` (reescrito): mes Santiago, role status/alert, Reintentar, cambio de período, meses futuros deshabilitados, fila propia y truncado.
- `MiComision.test.tsx`: h1 en todos los estados, capitalización y etiqueta de tipo.
- `Carga.test.tsx`: copy por rol (Carga/Ventas), sin jerga ni CTAs duplicados, Reintentar.
- `Clientes.test.tsx`: copy por rol, etiquetas visibles, error + Reintentar, fecha dd-mm-aaaa. `Clientes.scope.test.tsx`: textos de admin actualizados.

## Verificaciones (desde `frontend/`, con `.env.local` real)

| Comando | Resultado |
| --- | --- |
| `npm run lint` | verde |
| `npm run build` | verde |
| `npm run test` | verde: 49 archivos, 588 pruebas |
| `npm run size` | **falla por la regresión conocida de la base (B6)**; CSS dentro de presupuesto |

Métricas (base `origin/feature/frontend-ux` → B4):

| Métrica | Base | B4 |
| --- | --- | --- |
| JS de entrada (gzip, `size`) | 155,892 KB | 155,318 KB (−0,37 %) |
| Chunk JS más grande (sin comprimir) | 533,027 KB | 530,703 KB |
| CSS de entrada (gzip) | 43,684 KB | 43,653 KB (presupuesto 47,853) |
| Chunk RankingVendedores | 179,14 KB (53,95 KB gzip) | 3,65 KB (1,53 KB gzip) |

El JS difiere de la base en −0,37 % (mejora, no regresión), por encima del umbral ±0,1 % pedido; la causa es que el picker de Mantine ya no se carga. Los valores absolutos siguen sobre presupuesto por la regresión de B6, ajena a este lote.

## Verificación visual

Chrome headless (CDP) sobre `vite dev`, Supabase local, cuentas `ux-vendedor` y `ux-admin`: 5 páginas × 375/768/1280 (vendedor) y 4 páginas (admin; Mi comisión es sólo vendedor). `scrollWidth <= innerWidth` en las 27 combinaciones. Ocho capturas en `capturas/b4-*.png`.

## Límites

- Sin datos locales de ventas/clientes/comisión: sólo se vieron estados vacíos en navegador; las vistas con datos están cubiertas por pruebas.
- `npm run test:integration` no se ejecutó (lo corre el coordinador).
- El selector Mes/Año limita el histórico a 3 años atrás.
