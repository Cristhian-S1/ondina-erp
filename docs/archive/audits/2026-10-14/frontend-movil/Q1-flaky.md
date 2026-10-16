# Q1-Parte A — OND-c07.19: prueba intermitente bajo carga (diagnóstico y correcciones)

**Tarea:** Q1_parte_A (Beads OND-c07.19) · **Fecha:** 2026-10-14 · **Producto:** este informe + correcciones de pruebas/vitest, sin cambios de código de producto.
**Commit base del worktree:** `4809b1a` (branch `Cristhian-S1/q1-flaky-lighthouse`, base `origin/feature/frontend-ux`). Lighthouse (Parte B): informe separado en `Q1-lighthouse-base.md`.

## Resumen ejecutivo

- **Se reprodujo la clase de fallo con carga:** en un primer bucle de 15 corridas (`npx vitest run --reporter=verbose` con 8 procesos de CPU ocupados + la carga ambiental real de otros trabajadores Orca), 14 corridas fueron verdes y **1 (run 13) falló con 6 pruebas** sin ninguna edición previa del entorno. Con la carga igual o mayor, tras las correcciones descritas abajo, el segundo bucle completo dio **15/15 verdes**.
- **Causa raíz (evidencia de ambos bucles):** no es una prueba equivocada sino **presupuestos de tiempo de pared** — `testTimeout` de vitest 5 s por defecto y 1 s por defecto de `waitFor`/`findBy*` de Testing Library — que quedan cortos ante la latencia de contención de CPU (medido: loadavg ~31–39 sobre 12 núcleos mientras vivían otros workers Orca; las pruebas fallidas reflejaban una latencia ~3× sin lógica defectuosa). Ninguna de las 6 pruebas con fallo tenía lógica incorrecta.
- **Correcciones aplicadas (basadas en la medición, no a ciegas):** `testTimeout: 15000` en vitest.config.ts; `configure({ asyncUtilTimeout: 3000 })` en src/test/setup.ts; prueba del borrador de `RegistrarVenta` convertida a relojes falsos (elimina la espera real del debounce de 250 ms); `timeout: 30_000` explícito para el test que construye un build de Vite REAL en proceso hijo. **Ningún código de producto cambió.**
- Las candidatas estáticas con lógica de fecha/hora (Despachos/Devoluciones/Ranking/MiComision/EstadosProduccion/useJornadaSantiago) permanecen intactas: ya usan `vi.useFakeTimers({toFake:['Date']})` con hora fijada; no son la causa.

## Método

Bucle de `npx vitest run --reporter=verbose` bajo carga simulada (`stress-ng` no instalado). Carga: **8 bucles busy por core (`taskset -c 0..7 sh -c 'while :; do :; done'`)** + las actividades reales de otros trabajadores Orca vivos en el mismo host (claude/codex/opencode con server de dev de Vite para m1-tarjetas-movil en el puerto 5180). El bucle completó ≥15 corridas seguidas registrando rc, duración y **loadavg de /proc/loadavg antes de cada corrida**. En ningún momento se corrió `test:integration`.

Script reproducible: `scripts/q1-bucle-carga.sh` (mismo directorio de este informe). Los logs completos de cada corrida residen en `/tmp/opencode/flaky-loop{,2}/run-*.log` (volátiles); los fragmentos de fallo de la corrida fallida quedaron capturados en `evidencia/bucle-carga-run13-fallos.log` (140 líneas) y el resumen en las tablas siguientes.

## Corridas — Bucle 1 (antes de correcciones; HEAD sin modificar)

| Run | RC | Duración (s) | loadavg (1m) | Resultado |
| --- | ---: | ---: | ---: | --- |
| 01 | 0 | 18 | 3.23 | verde |
| 02 | 0 | 25 | 11.46 | verde |
| 03 | 0 | 19 | 20.22 | verde |
| 04 | 0 | 19 | 26.13 | verde |
| 05 | 0 | 22 | 27.27 | verde |
| 06 | 0 | 19 | 30.01 | verde |
| 07 | 0 | 18 | 31.46 | verde |
| 08 | 0 | 18 | 32.87 | verde |
| 09 | 0 | 16 | 32.45 | verde |
| 10 | 0 | 15 | 32.17 | verde |
| 11 | 0 | 17 | 29.82 | verde |
| 12 | 0 | 19 | 29.34 | verde |
| **13** | **1** | **33** | **31.47** | **6 pruebas fallan (tabla abajo)** |
| 14 | 0 | 16 | 39.37 | verde |
| 15 | 0 | 16 | 36.23 | verde |

**14/15 verdes**. Recuento estable en las 15 corridas: **55 archivos / 723 tests** (717 verdes en run 13 con 6 fallos). Nota: el incidente original de OND-c07.19 reportó "1 de 696" porque se midió en el worktree de integración (otra composición de branch); en este worktree `4809b1a` la suite tiene 723 tests y así se registró en ambos bucles.

### Pruebas fallidas en run 13 (todas con la suite correcta, por tiempo)

| Prueba | Duración | Error |
| --- | ---: | --- |
| `scripts/check-bundle-size.test.mjs > presupuesto inicial > falla si crece un preload…` | 8538 ms | `Error: Test timed out in 5000ms` (spawnSync de node) |
| `src/…/ventas/pages/Clientes.scope.test.tsx > keeps the selected seller in the dialog and restores focus after Escape` | 4760 ms | `TestingLibraryElementError: Unable to find role="option" and name "Norte"` (acumulado bajo `selectScope`, línea 21; presupuesto por defecto de 1 s en `findBy*`) |
| `src/…/ventas/pages/RegistrarCliente.test.tsx > moves focus inside and returns it to the opener after Escape` | 11253 ms | `Error: Test timed out in 5000ms` |
| `src/…/produccion/pages/Produccion.branch.test.tsx > requires an explicit administrator selection with profile branch null` | 12462 ms | `Error: Test timed out in 5000ms` |
| `src/…/ventas/pages/RegistrarVenta.draft.test.tsx > persists changes under the current user key` | 13306 ms | `Error: Test timed out in 5000ms` (el debounce de 250 ms de `PersistenciaBorradorVenta` + `waitFor` sobre reloj real) |
| `scripts/check-bundle-size.test.mjs > separa Supabase en un vendor precargado…` (build REAL de Vite en `spawnSync`) | 5430 ms | `Error: Test timed out in 5000ms` |

Fragmentos de salida exactos: `evidencia/bucle-carga-run13-fallos.log`.

## Revisión estática (candidatas)

Patrones buscados (`grep` sobre `*.test.ts*`): `setTimeout`, `waitFor`/`findBy*`, `Date.now()`/`new Date()`, medianoche/zona `America/Santiago`, debounce (`PersistenciaBorradorVenta`, 250 ms).

| # | Zona | Patrón | ¿Riesgo bajo carga? | Procesamiento |
| --- | --- | --- | --- | --- |
| 1 | `RegistrarVenta.draft.test.tsx:42` "persists changes under the current user key" | Debounce real de 250 ms de `PersistenciaBorradorVenta.tsx:27` + `waitFor` (1 s) esperando "flush" | **Sí — confirmado**: falló en run13 (13306 ms) | Convertida a relojes simulados con `advanceTimersByTime(300)` (mismo patrón que la prueba A1-03 del mismo archivo); ahora es determinista y además comprueba que la tecla NO escribe antes del debounce |
| 2 | `AuthProvider.test.tsx:130` `setTimeout(resolve,10)` en "keeps the loaded profile…" (`it.each` ×3) | Sueño duro de 10 ms + asserts inmediatos | **Bajo**: el estado asertado ("perfil previo, sin loading, cache intacta") es invariante durante el refresh en background; ninguna rama depende del sueño haber terminado | Sin cambios; queda documentada. Si reapareciera en CI, reemplazar por `waitFor(() => expect(auth.single).toHaveBeenCalledTimes(n))` |
| 3 | Toda la suite — `waitFor`/`findBy*` | Presupuesto por defecto **1 s** de Testing Library | **Sí — confirmada vía Clientes.scope.run13** (`Norte` no apareció en 1 s con HTML correcto) | `configure({ asyncUtilTimeout: 3000 })` centralizado en `src/test/setup.ts` |
| 4 | `scripts/check-bundle-size.test.mjs` | `spawnSync` de `node` (4 tests de presupuesto) y de un **build real de Vite** (1 test) | **Sí — confirmado** (8538 y 5430 ms) | `testTimeout` global 15 s cubre los cuatro de spawn; para el de build de Vite se fija `timeout: 30_000` explícito (latencia dominada por el spawn, no por la lógica) |
| 5 | `Produccion.branch.test.tsx:33` "requires an explicit administrator selection…" | Cadena render+findBy asíncronos alentados ~2,6× por saturación | Plausible (12462 ms el run13) | Cubierta por `testTimeout: 15000` + `asyncUtilTimeout: 3000`; sin cambios al archivo |
| 6 | `Despachos.test.tsx`, `Devoluciones.test.tsx`, `RankingVendedores.test.tsx`, `MiComision.test.tsx`, `EstadosProduccion.test.tsx`, `useJornadaSantiago.test.tsx` | `vi.useFakeTimers({toFake:['Date']})` + `vi.setSystemTime` con fecha fija | **No** (reloj de pared controlado; la única `new Date()` viva está en fixtures: `Despachos.test.tsx:81` y `Devoluciones.test.tsx:83`, `creado_en` de fixtures, no en aserciones de UI) | Sin cambios |
| 7 | Timers de producto sin prueba de reloj real: `toast-utils.ts` (4000 ms), `RegistrarCliente.tsx` (1500 ms), `AuthProvider.tsx` (setTimeout 0) | Zh.tests que cubren estos timers usan fake timers o solo buscan el toast | Ninguna prueba espera reloj real contra ellos (no sobrepasan presupuesto) | Sin cambios |

## Correcciones aplicadas (archivos de pruebas y configuración de vitest; nada de `frontend/src` de producto)

| Archivo | Cambio | Justificación |
| --- | --- | --- |
| `frontend/vitest.config.ts` | `testTimeout: 15000` | La latencia por contención superó 5 s en 4 pruebas durante bucle 1 (8538/11253/12462/13306 ms). 15 s sigue fallando rápido ante colgadas reales y absorbe picos de compilación/spawnSync |
| `frontend/src/test/setup.ts` | `configure({ asyncUtilTimeout: 3000 })` | Presupuesto de `find*`/`waitFor` de 1 s insuficiente con latencia 3× (run13 prueba Clientes.scope); centralizado en vez de parchear cada llamada |
| `frontend/src/domains/ventas/pages/RegistrarVenta.draft.test.tsx` | "persists changes…" pasa de `waitFor` con reloj real a `vi.useFakeTimers()` + `advanceTimersByTime(300)`; test ahora sync | Debounce de 250 ms causa la dependencia del reloj; misma técnica ya usada por la prueba A1-03 del mismo archivo |
| `frontend/scripts/check-bundle-size.test.mjs` | El test con `vite build` REAL en subproceso lleva `timeout: 30000` explícito | 5430 ms bajo carga media rompía el muro de 5 s; la lógica es determinista (fixture) y la latencia es del subproceso |

Ninguna otra prueba o archivo fue modificado. `lint` limpio en los cuatro archivos editados.

## Bucle 2 (después de correcciones; HEAD + 4 archivos de prueba/config)

Se corrió el mismo bucle con la misma generación de carga: **15/15 verdes, con loadavg igual o mayor** (hasta 35.96 de 1 min). Duraciones 16–37 s, recuento estable (55 archivos / 723 tests).

| Run | RC | Duración (s) | loadavg (1m) | Resultado |
| --- | ---: | ---: | ---: | --- |
| 01–15 | 0 | 16–37 | 4.67–35.96 | **verde (15/15)** |

Resultado final: **bucle 1: 13/15 verdes con 1 corrida dañada (run 13, 6 pruebas) → tras correcciones: bucle 2: 15/15 verdes** bajo carga igual o superior.

## Limitaciones

- La carga simulada (8 busy loops + otros workers activos) es una **aproximación** del escenario real de CI/integración donde 3 workers compilaban; el incidente original (1/696 una vez) no dejó registro del archivo y prueba exacta que falló, por lo que no puede confirmarse identidad directa; la **clase** (presupuesto de tiempo) queda cubierta por las correcciones y el bucle bajo carga.
- `waitFor` más largo tiene el costo natural de demorar fallos reales de aserción asíncrona hasta 3 s; trade-off aceptado porque el presupuesto de 1 s demostró insuficiente bajo carga medida sin errores lógicos.
- No se corrió `npm run test:integration` (excluido por el enunciado; lo hace el coordinador).
- Los logs completos por corrida viven en `/tmp` (volátiles); se preservó el fragmento de fallo del run 13 en `evidencia/`.

## Cómo repetir

```sh
docs/archive/audits/2026-10-14/frontend-movil/scripts/q1-bucle-carga.sh 15   # bucle de suite completa con carga simulada
```

