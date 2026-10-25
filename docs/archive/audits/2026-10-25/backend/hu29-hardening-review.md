> Date: 2026-10-25 · Reviewer role: Security/review (Claude Code Sonnet 5.5) · Commit: 743c3bc (integrated as 590d281).

# HU-29 hardening review (OND-w76.10) - commit 743c3bc

> Fecha: 2026-10-25 · Rol: Security/review (Claude Code Sonnet 5.5), solo lectura · Rama `Cristhian-S1/t3-hu29-hardening` · Migración `20261025223257_hu29_mermas_hardening.sql`

## VERDICT: PASS

La migración cierra F1-F5 de la revisión anterior (`docs/archive/audits/2026-10-25/backend/hu29-security-review.md`) sin regresiones.
No hay hallazgos HIGH ni MEDIUM de seguridad. Hay 1 hallazgo MEDIUM de funcionalidad (mensaje de frontend sin traducir) y 4 LOW. Ninguno bloquea el merge de la migración; el MEDIUM de frontend se recomienda corregir antes de exponer la pantalla.

Método: revisión estática del diff + stack local (`supabase start`, `db reset`), `supabase test db`, probes en transacciones con rollback, 22 mutaciones sobre `009`, harness de concurrencia y un stress de deadlocks. No se editó ni se commiteó ningún archivo del repo. No se tocó el proyecto remoto. Stack detenido al final (`supabase stop`, 0 contenedores supabase).

## Resumen de ejecución

| Comprobación | Resultado |
|---|---|
| `supabase db reset` + `supabase test db` | 9 archivos, **891 tests, PASS** |
| `009_hu29` (psql directo) | **147 ok, 0 not ok, 0 SKIP** (antes del commit: 123 ok, 3 SKIP) |
| `concurrency-hu29.py` | 5/5 PASS (3 previos + loss→return y return→loss directos) |
| Mutaciones sobre 009 / concurrencia | 22 aplicadas: 18 muertas por pgTAP; M9 y M21 las mata el harness de concurrencia; sobreviven M4 y M22 (ver item 5) |
| Stress de deadlocks (6 sesiones, ~2×6000 sentencias mixtas) | **0 deadlocks**, invariante `devuelto+mermas <= despachado` intacto en los 3 despachos |

## Item 1 - F1: UPDATE de `public.mermas` cerrado: OK

Evidencia (DB tras reset):
- `has_table_privilege('authenticated','public.mermas','update')` = **f**; `has_any_column_privilege(...,'update')` = **f**; `anon` = f/f; sin grants a PUBLIC.
- `information_schema.column_privileges` (UPDATE, grantee authenticated/anon/PUBLIC) = vacío. Grants de tabla: authenticated = `SELECT,INSERT`; roles con UPDATE: solo `postgres`, `service_role`, `supabase_admin`.
- Probes como admin sucursal A y como bodega A: `update mermas set anulado=true`, `update mermas set motivo=...`, `insert ... on conflict (id) do update set anulado=true` y `delete` => todos `ERROR: permission denied for table mermas` (el upsert también, porque requiere UPDATE).
- `anular_merma_bodega` es la única vía: produccion/bodega => `Solo administración puede anular mermas.` (42501); `SECURITY DEFINER`, `search_path=""`, ACL sin anon.
- La política `mermas_update_b2` sigue existiendo (admin + sucursal/global) pero no es alcanzable: sin privilegio UPDATE el chequeo de RLS no se evalúa, y no hay default privileges de `postgres` que otorguen a `authenticated` sobre `public` (`pg_default_acl`: solo `postgres`/`service_role`). No es una escalada. Riesgo residual: una migración futura con `grant update on all tables ... to authenticated` reabriría la vía y la política la permitiría; el test 127 de `009` ("Neither table nor column UPDATE remains") lo detecta.
- INSERT directo sigue gobernado por RLS (`mermas_insert_b2`): produccion solo producto sin despacho (envase => `new row violates row-level security policy`); bodega/admin de su sucursal con `creado_por=auth.uid()` y `not anulado`; `anulado=true` en INSERT => violación de RLS (probado para `mermas` y `devoluciones_productos`).
- Frontend: único acceso directo es `produccion/api.ts:157` (`insert`); no hay `update` sobre `mermas`.

## Item 2 - F2: trigger `private.validar_merma_hu29`: OK (con 1 LOW)

- Higiene DEFINER: `prosecdef=t`, `proconfig={search_path=""}`, owner `postgres`, `proacl={postgres=X/postgres}` (EXECUTE revocado a public/anon/authenticated; `has_function_privilege` = f/f/f). Los triggers siguen disparando (EXECUTE solo se exige al crear el trigger). Todos los objetos están calificados (`public.despachos`).
- Rechaza motivo blanco: directo `'   '`, `\t\n\r`, `\v\f`, NBSP (U+00A0), EM SPACE (U+2003), `NULL` => `Indica el motivo de la merma.` Rechaza `despacho_id`+`tipo_empaque_id` (pgTAP 123-124, stock sin cambios). Produccion con motivo blanco rechazado igual (probe).
- Orden de locks: advisory(clave) → `despachos FOR UPDATE` → `bloquear_saldos` (bodega, carga, envases). Verificado en las definiciones:
  - `registrar_merma_bodega`: advisory → despacho FOR UPDATE → bloquear_saldos → insert (el trigger BEFORE vuelve a pedir el lock que ya tiene).
  - `anular_merma_bodega`: despacho FOR UPDATE → merma FOR UPDATE → `trg_merma_anular` (despacho, bloquear_saldos).
  - `registrar_devolucion` / `corregir_devolucion`: advisory(propio namespace) → despacho FOR UPDATE → bloquear_saldos.
  - `trg_merma_insert` es AFTER INSERT (tgtype 5): sin el lock BEFORE, la FK `despacho_id` (RI, key-share) se tomaría antes del FOR UPDATE del trigger => ciclo contra `registrar_devolucion`. El BEFORE `validar_merma_hu29` elimina ese ciclo.
- Prueba empírica de ausencia de ciclo: stress de 6 sesiones (bodega x3, admin x3) con mezcla de `registrar_merma_bodega`, INSERT directo en `mermas`, `registrar_devolucion`, INSERT directo en `devoluciones_productos`, `anular_merma_bodega`, `corregir_devolucion` sobre 3 despachos: runs N=400 y N=1000, **0 `deadlock detected`**. Control: con el lock quitado de `validar_merma_hu29` (M4) el mismo stress dio **9 deadlocks** => el lock es necesario y el diseño lo resuelve.
- Diff de `registrar_merma_bodega`/`anular_merma_bodega` contra la migración base: solo se fusiona `not found or ...` en un mismo 42501 (F5). Sin otros cambios semánticos.

## Item 3 - F3: trigger `a_validar_devolucion_mermas_hu29`: OK

- Cota `devuelto + mermas + new <= despachado` con `despachado = sum(despacho_detalles)` (cubre ajustes aditivos HU-26), `devuelto`/`mermas` excluyen `anulado`.
- Orden de disparo: BEFORE INSERT, nombre `a_...` precede por orden alfabético a `trg_devolucion_producto_insert` (y a `auditoria_b3`/`proteger_movimiento_b3`, que no son BEFORE INSERT). `pg_trigger`: `a_validar_devolucion_mermas_hu29`, `trg_devolucion_producto_insert`, ambos tgtype 7.
- Cobertura: `registrar_devolucion` (pgTAP 134, mensaje del trigger), INSERT directo (133), `corregir_devolucion` (135; la corrección anula antes las devoluciones previas, por eso el total excluye las anuladas: 136-139, límite exacto 6+4=10 permitido, tras anular la merma se permite 4 más).
- `v_mermas=0`: el trigger no actúa y delega a B3, que responde `No se puede devolver más de lo despachado.` (mensaje B3 preservado; probe con despacho inexistente y stress). Correcto.
- Bypass con `anulado=true`: el trigger retorna sin validar, pero la RLS de `devoluciones_productos` exige `not anulado` para `authenticated` (probe: violación de RLS) y `proteger_movimiento_b3` prohíbe reactivar; un registro anulado no mueve stock. Sin bypass.
- Concurrencia: `concurrency-hu29.py` cubre loss→return y return→loss directos; la mutación que quita el lock del trigger (M9) la mata el harness (AssertionError). Stress sin deadlocks.

## Item 4 - F5: mensajes 42501 unificados: OK (con 1 LOW)

- `registrar_merma_bodega`: despacho inexistente y de otra sucursal => mismo 42501 `No tienes permisos para registrar mermas en esta sucursal.` (pgTAP 131, 141). La compuerta rol/sucursal va primero. Las mutaciones M16/M17 (separar los mensajes) fallan.
- `anular_merma_bodega`: merma inexistente y de otra sucursal => 42501 `No tienes permisos para anular esta merma.` (pgTAP 128; M14 falla).
- Replay `La clave de reintento pertenece a otra operación.`: solo es alcanzable tras la compuerta (usuario autorizado de la sucursal), exige conocer una clave UUID v4 ajena y no revela el id de la merma. Mismo contrato que `registrar_devolucion`/`corregir_devolucion`/`ajustar_despacho`. **Aceptable**.
- Residuales: `La sucursal no existe.` y `El producto no existe...` solo los ven admin global o catálogo que ya es legible. Un nuevo oráculo menor aparece en INSERT directo de devoluciones (F-A abajo).

## Item 5 - F4: pgTAP 009 sin SKIP y los tests aseguran las guardas: OK (con 1 LOW)

0 SKIP (era 3), +24 tests. Mutaciones (se aplicó la mutación dentro de la transacción, se ejecutó `009` completo y rollback):

| # | Mutación | Resultado |
|---|---|---|
| M1 | drop trigger `validar_merma_hu29` | MUERTA (5 not ok) |
| M2 | trigger sin guarda de motivo en blanco | MUERTA (3) |
| M3 | trigger sin guarda despacho+envase | MUERTA (2) |
| M4 | trigger sin lock del despacho | **SOBREVIVE en pgTAP y en concurrency-hu29** (stress sí: 9 deadlocks) |
| M5 | drop trigger `a_validar_devolucion_mermas_hu29` | MUERTA (6) |
| M6 | cota ignora mermas | MUERTA (5) |
| M7 | cuenta mermas anuladas | MUERTA (el test aborta con el error del trigger) |
| M8 | guarda deshabilitada | MUERTA (6) |
| M9 | trigger devolución sin lock | pgTAP sobrevive; **harness de concurrencia la mata** |
| M10 | `grant update` tabla a authenticated | MUERTA (2) |
| M11 | `grant update (anulado)` | MUERTA (2) |
| M12 | anular sin compuerta de admin | MUERTA (2) |
| M13 | anular sin guarda de motivo | MUERTA (1) |
| M14 | anular: mensaje distinto para merma inexistente | MUERTA (1) |
| M15 | registrar sin compuerta de rol | MUERTA (2) |
| M16 | registrar sin chequeo de sucursal del despacho | MUERTA (1) |
| M17 | registrar: mensaje distinto despacho inexistente | MUERTA (1) |
| M18 | registrar sin rechazo de despacho anulado | MUERTA (1) |
| M19 | replay sin chequeo de actor/payload | MUERTA (4) |
| M20 | registrar sin guarda despacho+envase | MUERTA (1) |
| M21 | registrar sin advisory lock | MUERTA por `concurrency-hu29.py` (pk duplicada) |
| M22 | registrar sin `bloquear_saldos` | sobrevive (redundante: lo vuelve a tomar `trg_merma_insert`; ya existía en la base) |

Las guardas de F1-F3, F5 están realmente afirmadas, salvo el lock de M4 (ver LOW-3).

## Item 6 - Impacto en frontend (solo reporte)

- `Indica el motivo de la anulación.`: mapeado en `bodega/api.ts:426` (`mensajesMerma`, usado por `anularMermaBodega` vía `mensajeErrorMerma`) y validado antes en `bodega/validacion.ts:79`. Llega en español. OK.
- `La devolución y las mermas superan lo despachado de ese producto.`: **no está mapeado** en `frontend/src/lib/errors.ts` (`mensajesDeNegocio`/`patronesDeNegocio`) ni en `bodega/api.ts`. `registrarDevolucion`/`corregirDevolucion` (`bodega/api.ts:283-322`) usan `mensajeErrorSupabase`; el código es P0001 y `mensajeErrorSupabase` devuelve el genérico `No fue posible completar la operación. Inténtalo de nuevo.` Ver hallazgo F-B.
- `Indica el motivo de la merma.` (trigger) también llega por `produccion/api.ts:157` con `mensajeErrorSupabase` => genérico, pero `produccion/validacion.ts:23` valida el motivo antes, así que solo se vería con un cliente que se salte la UI.

## Hallazgos priorizados

### F-B - MEDIUM (funcional, no explotable) - Mensaje de la cota combinada llega genérico
- Archivo: `frontend/src/lib/errors.ts:13` (`mensajesDeNegocio`), consumo en `frontend/src/domains/bodega/api.ts:283-322`.
- Probe: tras una merma de 4 sobre un despacho de 10, `registrar_devolucion` de 7 => P0001 `La devolución y las mermas superan lo despachado de ese producto.`; `mensajeErrorSupabase` solo traduce P0001 por texto exacto/patrón y devuelve el genérico (grep: el texto no existe en `frontend/`).
- Impacto: el usuario de Devoluciones no sabe por qué falla (la causa es una merma activa). Sin impacto de seguridad.
- Fix: agregar la entrada en `mensajesDeNegocio` (texto en español: p. ej. `La devolución y las mermas superan lo despachado de ese producto.`) y un test en `lib/errors.test.ts`/`api.errors.test.ts`.

### F-A - LOW - Nuevo oráculo cross-sucursal en INSERT directo de devoluciones
- Archivo: `supabase/migrations/20261025223257_hu29_mermas_hardening.sql:34-41`.
- Causa: el trigger `a_...` (SECURITY DEFINER, sin RLS) corre antes que `trg_devolucion_producto_insert`, que es el que hace la comprobación de sucursal (42501), y antes del `WITH CHECK` de RLS.
- Probe (bodega A inserta directo en `devoluciones_productos` con `cantidad=1000`):
  - despacho de la sucursal B con mermas activas del producto => `La devolución y las mermas superan lo despachado de ese producto.`
  - despacho de B sin mermas de ese producto => `No tienes permisos para registrar devoluciones.`
  - despacho inexistente => `No se puede devolver más de lo despachado.`
  Distingue (despacho existe, tiene mermas del producto) para otra sucursal. Ya existía la diferencia inexistente/ajeno; el trigger añade un bit.
- Impacto: bajo; exige conocer el UUID del despacho de otra sucursal (no listable) y UUIDs aleatorios. La ruta RPC no lo expone (comprueba sucursal antes).
- Fix (opcional): en el trigger, tras bloquear el despacho, repetir la compuerta (`es_admin_global() or sucursal_id = mi_sucursal()`) con el mismo 42501 que `trg_devolucion_producto_insert`, o cambiar el orden para que ese chequeo ocurra primero.

### LOW-3 - Test gap: el lock de `validar_merma_hu29` no tiene test que falle si se quita
- Archivo: `supabase/migrations/20261025223257_hu29_mermas_hardening.sql:10-12`; `supabase/tests/concurrency-hu29.py:49-72`.
- Probe: mutación M4 pasa `009` (147 ok) y pasa `concurrency-hu29.py` completo; el mismo stress de mezcla de operaciones muestra 9 deadlocks sin el lock y 0 con él. El lock es necesario porque `trg_merma_insert` es AFTER INSERT y la FK toma key-share antes de su FOR UPDATE.
- Fix: agregar al harness un par que fuerce la interleaving (INSERT directo en `mermas` con `pg_sleep` tras el INSERT vs `registrar_devolucion` del mismo despacho, `expect_error` por `deadlock detected` ausente), o documentar en el comentario de la migración que la prueba es el stress. Mutación M22 queda redundante.

### LOW-4 - `anular_merma_bodega` acepta motivo solo de tabuladores/saltos de línea o U+200B
- Archivo: `supabase/migrations/20261025223257_hu29_mermas_hardening.sql:157` (`pg_catalog.btrim(p_motivo)=''`; `btrim` solo recorta espacios U+0020).
- Probe (admin A): `anular_merma_bodega(id, E'\t\n')` y `E'​'` => aceptados; la auditoría ANULACION guarda ese motivo. Con `'   '` sí rechaza. El trigger de INSERT usa `[[:space:]]` y rechaza tab/NBSP/EM SPACE; así que la regla "motivo obligatorio" no es uniforme entre mermas y anulaciones.
- Impacto: integridad de la auditoría (solo admin; sin escalada).
- Fix: usar `p_motivo ~ '^[[:space:]]*$'` también en `anular_merma_bodega` (y en `registrar_merma_bodega` para coherencia); opcional rechazar U+200B (`[[:space:]​⁠﻿]`).

### LOW-5 - `validar_merma_hu29` acepta motivo con solo U+200B (carácter de formato)
- Archivo: `...hardening.sql:5`.
- Probe: INSERT directo con `E'​'` => aceptado (NBSP, EM SPACE, VT/FF y NULL sí se rechazan).
- Impacto: motivo "visualmente vacío" aún posible por un usuario ya autorizado; mismo fix que LOW-4.

## Notas informativas (sin acción)
- El orden `a_` < `trg_` depende del nombre del trigger (orden alfabético de `pg_trigger`); ningún test aserta explícitamente el orden. Si se invirtiera solo cambiaría qué mensaje gana cuando fallan ambas cotas (el rollback de la sentencia revierte el stock de todas formas).
- `validar_merma_hu29` toma `FOR UPDATE` del despacho antes del `WITH CHECK` de RLS, por lo que un usuario de otra sucursal que adivine un UUID de despacho retiene brevemente su lock (DoS, fuera de alcance).
- Archivos de evidencia temporal en el scratchpad: `t009.out`, `mut.py`, `mut_*.sql`, `stress.py`, `probe1.sql`, `probe2.sql`, `probe3.sql`.
