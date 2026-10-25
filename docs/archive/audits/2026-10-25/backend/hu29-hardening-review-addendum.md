> Date: 2026-10-25 · Reviewer role: Security/review (Claude Code Sonnet 5.5) · Commit: 1e066dd (integrated as 91c57dc; re-verifies 743c3bc).

# HU-29 hardening review - ADDENDUM (re-verificación de 1e066dd)

> Fecha: 2026-10-25 · Rol: Security/review (Claude Code Sonnet 5.5), solo lectura · Beads OND-w76.10
> Base: `hu29-hardening-review.md` (mismo scratchpad) sobre 743c3bc · Commit re-verificado: `1e066dd fix(db): close HU-29 hardening review low findings`

## VERDICT GLOBAL: PASS

F-A, LOW-3, LOW-4 y LOW-5 quedan cerrados sin regresiones. Sin hallazgos HIGH/MEDIUM nuevos. Dos observaciones LOW/INFO de cobertura de test (abajo). No se editó ni commiteó nada; stack local detenido (`supabase stop`, 0 contenedores supabase), sin acceso al remoto.

| # | Ítem | Veredicto |
|---|---|---|
| 1 | F-A: oráculo cross-sucursal en `devoluciones_productos` | **PASS** |
| 2 | `private.motivo_merma_vacio` (LOW-4 / LOW-5) | **PASS** |
| 3 | LOW-3: `--lock-only` mata la mutación del lock | **PASS** |
| 4 | Suite completa | **PASS** |
| F-B | Mapeo frontend (feature/T3) | **PASS** (lectura) |

## Item 1 - F-A: PASS

Cambio: `private.validar_devolucion_mermas_hu29` ahora lee el despacho (`select * into d ... for update`) y, antes de leer las sumas de mermas, repite la compuerta de B3: `auth.uid() is not null and (not (bodega or administrador) or not (admin_global or d.sucursal_id = mi_sucursal()))` => 42501 `No tienes permisos para registrar devoluciones.`

Probes (rollback, bodega A, despacho de sucursal B; antes de 1e066dd el caso 1a devolvía el mensaje de la cota):

| Caso | Resultado |
|---|---|
| 1a directo, despacho B **con** mermas del producto, qty 1000 | 42501 `No tienes permisos para registrar devoluciones.` |
| 1b directo, despacho B producto **sin** mermas, qty 1000 | 42501 (mismo mensaje que 1a) |
| 1c directo, despacho B con mermas, qty 1 | 42501 |
| 1d despacho inexistente, qty 1000 | `No se puede devolver más de lo despachado.` (contrato B3 conservado: `d.sucursal_id` NULL => la condición evalúa NULL, no lanza) |
| 1e sucursal propia A, 4 de merma + 7 | `La devolución y las mermas superan lo despachado de ese producto.` |
| 1f RPC `registrar_devolucion` en despacho ajeno | 42501 (la RPC comprueba sucursal antes de insertar) |
| 1f RPC propio, 4 + 7 | mensaje de la cota; 4 + 6 = 10 pasa |
| 1g produccion y vendedor, INSERT directo en su sucursal | 42501 |
| 1i admin global en despacho de B qty 1000 | pasa la compuerta y recibe el mensaje de la cota (esperado) |

Sin bypass por `auth.uid() is not null`:
- Es la misma condición que ya usa `trg_devolucion_producto_insert` (B3); solo omite la compuerta cuando no hay sesión (contextos owner/`service_role`, seeds, migraciones).
- Caso 1h: rol `authenticated` **sin** `sub` (`auth.uid() IS NULL`): INSERT directo (con `creado_por` de otro o `NULL`) => `new row violates row-level security policy` (la política exige `creado_por = auth.uid()`, que evalúa a NULL); `registrar_devolucion` => 42501 (el chequeo de rol usa `auth.uid()`). `anon` no tiene grants sobre `devoluciones_productos`. Un cliente autenticado real siempre trae `sub` (GoTrue).
- El 42501 ocurre antes de leer `devoluciones_productos`/`mermas` (sumas), de modo que la información privada de mermas no alcanza a usuarios sin autorización.

Mutaciones sobre `009` (175 tests): quitar la compuerta (`if false and`) o su cláusula de sucursal => MUERTA (`not ok 174 - Other-branch direct return hides active losses at quantity 1000`).

## Item 2 - `private.motivo_merma_vacio`: PASS

Catálogo:
- `provolatile='i'` (immutable), `proconfig={search_path=""}`, `prosecdef=f` (no necesita DEFINER), `proacl={postgres=X/postgres}`.
- `has_function_privilege`: anon=f, authenticated=f, **service_role=f**, postgres=t. Llamada directa como `authenticated` => `permission denied for function motivo_merma_vacio`; como `anon` => `permission denied for schema private`.
- Sigue invocable desde los llamadores SECURITY DEFINER (owner `postgres`): `validar_merma_hu29`, `registrar_merma_bodega`, `anular_merma_bodega` rechazan con su mensaje, es decir la función se ejecuta.
- La regex `U&'^[[:space:]\00A0\200B\2060\FEFF]*$'` es un literal constante (sin interpolación); el operador `~` se resuelve vía `pg_catalog` aun con `search_path=''`.

Matriz (cada una por INSERT directo / `registrar_merma_bodega` / `anular_merma_bodega`; los 3 canales rechazan con `Indica el motivo de la merma.` / `Indica el motivo de la anulación.`):
tab · `\n\r` · VT/FF · NBSP U+00A0 · **ZWSP U+200B · WORD JOINER U+2060 · BOM U+FEFF** · EM SPACE U+2003 · NARROW NBSP U+202F · IDEOGRAPHIC SPACE U+3000 · mezcla de invisibles · vacío · espacios · NULL => **todos rechazados (14/14 x 3 canales)**.
Texto visible rodeado de invisibles (`ZWSP+'rotura'+BOM`, `NBSP+'recuperada'`) => aceptado (sin falsos positivos).

Mutaciones (009 a 175 tests): helper con la regex vieja (12 not ok), quitar U+200B / U+2060 / U+FEFF (6 not ok c/u), NULL deja de ser vacío (4), `anular` vuelve a `btrim` (7), trigger vuelve a la regex vieja (4) => todas MUERTAS.

Observaciones (INFO/LOW, no bloquean):
- **INFO-1** Sigue siendo una lista de bloqueo: se aceptan como motivo único U+200C/U+200D (ZWNJ/ZWJ), U+00AD (soft hyphen), U+180E, U+3164 (Hangul filler), U+2800 (braille blank). Fuera del alcance pedido (tab/NBSP/U+200B/U+2060/U+FEFF); si se quiere cerrar, añadir esos puntos o exigir `[[:alnum:]]`/`\p`-equivalente (`~ '[[:alnum:]]'`). Impacto: solo auditoría, usuario ya autorizado.
- **INFO-2** `[[:space:]]` depende del `ctype` de la base. Los casos NBSP/U+3000/U+202F pasan en el stack local; la mutación que elimina `\00A0` explícito sobrevive (N8) porque la clase ya lo cubre. Con otra collation (p. ej. `C`) la lista explícita es la que protege, por lo que conviene conservarla.
- **LOW-6 (cobertura)** Mutación N11 (volver `registrar_merma_bodega` a `v_motivo = ''`) sobrevive: el trigger BEFORE INSERT rechaza con el mismo mensaje, por lo que es defensa en profundidad redundante (el comportamiento observable no cambia). No requiere acción.

## Item 3 - LOW-3 (`--lock-only`): PASS

Diseño del test (`concurrency-hu29.py:34-109`): un holder toma `FOR NO KEY UPDATE` del despacho (permite el key-share de la FK, bloquea `FOR UPDATE`); un trigger AFTER de prueba `a_hu29_after_insert_probe` (ordenado antes de `trg_merma_insert`) toma un advisory lock como marcador. Sin el lock BEFORE el INSERT directo llega al marcador antes de bloquearse; con él, se bloquea antes. Es determinista (no depende de provocar un deadlock).

| Corrida | Resultado |
|---|---|
| `--lock-only` sobre el código de 1e066dd | `PASS: direct loss blocks BEFORE FK/AFTER INSERT under parent NO KEY UPDATE` |
| Mutación: solo `perform 1 from public.despachos ... for update;` => `null;` en `validar_merma_hu29` | **FALLA**, exit 1: `AssertionError: Direct loss reached AFTER INSERT before acquiring the despacho FOR UPDATE lock` |
| Tras la falla | 0 triggers `a_hu29_after_insert_probe`, 0 funciones de probe, 0 sesiones colgadas (el `finally` limpia y libera al holder) |
| Función restaurada | `--lock-only` PASS otra vez; `md5(pg_get_functiondef)` igual al original |

## Item 4 - Suite completa: PASS

- `supabase db reset` limpio y `supabase test db`: 9 archivos, **919 tests, Result: PASS** (antes 891).
- `009_hu29`: **175 ok, 0 not ok, 0 SKIP**, plan 1..175 (antes 147). Ningún archivo `0*.test.sql` contiene `# SKIP`.
- `python3 supabase/tests/concurrency-hu29.py`: 6/6 PASS (3 originales + loss→return, return→loss, y el nuevo parent-lock).

## F-B (frontend, lectura)

`feature/T3` (HEAD `094f397`, el commit `0307670` vive además en la rama `Cristhian-S1/t3-hu29-messages`) tiene en `frontend/src/lib/errors.ts` (líneas 42-44) las tres entradas P0001:
- `La devolución y las mermas superan lo despachado de ese producto.` -> `La devolución más las mermas activas superan lo despachado de ese producto. Revisa las mermas registradas.`
- `Indica el motivo de la merma.` -> mismo texto.
- `Registra los envases dañados del despacho como devolución en estado malo.` -> mismo texto.
`Indica el motivo de la anulación.` ya estaba mapeado en `bodega/api.ts` (`mensajesMerma`). Mapeo correcto y en español. Nota de integración: la rama del hardening no trae ese archivo hasta que se integre `0307670`/`094f397` sobre ella; mientras tanto la rama sola muestra el mensaje genérico en Devoluciones.

## Hallazgos nuevos / residuales

| Sev | Hallazgo | Dónde | Probe | Fix |
|---|---|---|---|---|
| LOW | No hay test que falle si se quita la cláusula de rol de la compuerta nueva | `...hardening.sql` (`validar_devolucion_mermas_hu29`, `not (es_rol('bodega') or es_rol('administrador'))`) | mutación N3: 175 ok, 0 not ok | Añadir un caso: produccion/vendedor de la misma sucursal inserta directo con mermas activas => espera 42501. Sin fuga real: RLS ya impide el INSERT y esos roles ven las mermas de su propia sucursal |
| INFO | Lista de invisibles no exhaustiva (ZWNJ/ZWJ/U+00AD/U+180E/U+3164/U+2800) | helper `motivo_merma_vacio` | probe: aceptados como motivo único | Opcional: exigir al menos un `[[:alnum:]]` |
| INFO | N8/N11 sobreviven por redundancia intencional (clase `[[:space:]]` y trigger) | helper / `registrar_merma_bodega` | mutaciones | Sin acción |

Evidencia temporal (scratchpad): `probe4.sql`, `probe5.sql`, `mut2.py`, `orig_val.sql`, `mut_val.sql`.
