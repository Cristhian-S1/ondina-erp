# P1 · Robustez del script de Windows (`probar-frontend-ux-windows.ps1`)

**Fecha:** 2026-10-15 · **Tarea:** P1 (Orca task_9751df0c7542, sesión 2, worker OpenCode GLM-5.3-Flash) · **Rama:** `Cristhian-S1/p1-windows` @ ver «Traza».
**Denuncia del responsable:** al ejecutar el script en Windows 11 «se cierra solo y no indica un mensaje del porqué» (lanzamiento con clic derecho → «Ejecutar con PowerShell» o doble clic).
**Alcance:** sólo el archivo `/home/cristhian/Downloads/probar-frontend-ux-windows.ps1` (no versionado, fuera del repo; 539 líneas → 929) y este informe. La copia de seguridad del coordinador en `~/.cache/ondina-orq/2026-10-15/s2/probar-frontend-ux-windows.ps1.orig` no se tocó (32252 bytes, SHA verificado abajo). Sin `pwsh` en esta máquina Linux: validación **estática** (analizador propio + revisión línea a línea). Sin `push`. Sin cambios en `frontend/src`, `.opencode/`, SQL ni BD.

## 1. Causas probables del cierre silencioso (línea del original)

| # | Causa | Línea(s) del original |
|---|---|---|
| 1 | `exit 1` dentro de `Die`: **todo fallo** (pre-requisito, clone, supabase, seed…) hace `exit 1`, y con «Ejecutar con PowerShell» el host cierra la ventana al terminar el script: el mensaje rojo aparece un instante y desaparece. Es la causa principal del síntoma reportado. | 171-175 (`Die`), `exit 1` en 174 |
| 2 | `exit 0` tras `-SoloReiniciarDatos`: cerraba la ventana sin pedir Enter ni dejar resumen visible. | 510 |
| 3 | Errores terminantes sin capturar: p. ej. `& node $SeedPath` sin `node` en PATH lanza `CommandNotFoundException`, y `[System.IO.File]::WriteAllText` con ruta inválida lanza una excepción — no había `try/catch` global, así que PowerShell aborta y la ventana se cierra sin explicación. | 421, 390, 661-668, cualquier punto de `WriteAllText`/`New-Item` |
| 4 | `$ErrorActionPreference='Continue'` + comprobación de `$LASTEXITCODE` parcial: fallos mudos de `git branch --list`, `git log -1` y `cmd /c docker restart` (sin ningún chequeo). | 25, 236, 332-334, 341, 358 |
| 5 | Bloqueo **previo** al script: con política `Restricted`/`AllSigned`, «Ejecutar con PowerShell» muestra el aviso de bloqueo y se cierra (el script ni llega a arrancar); el doble clic ni siquiera ejecuta (abre el Bloc de notas). El script no puede mitigar esto en runtime, sólo instruir. | inicio del flujo (líneas 1-23) |
| 6 | Error de parseo (sintaxis) se imprime y cierra: no controlo en runtime; se mitiga con validación estática y conservando BOM/CRLF para que 5.1 lea acentos. | archivo completo |

Sub-factor agravante: no había pausa final en **ningún** caso de éxito ni fallo (el flujo acababa en `exit` o simplemente terminando), de modo que con el lanzador de doble-clic el cierre era rápido tanto en éxito con `-SoloReiniciarDatos` como en fallo.

## 2. Cambios por punto

**2.1 · Cierre que nunca deja sin explicar.** El flujo completo vive dentro de `try { … } catch { … } finally { … }`:
- `catch` imprime en rojo: sección (`Paso*`), comando exacto (`Invocar-Paso`), `$_.Exception.Message`, y, para errores ajenos al propio `Fallar`, `$_.InvocationInfo.ScriptLineNumber` + el texto de la línea; además `$_.ScriptStackTrace` (pila truncada a 6) y un bloque «QUÉ PUEDES HACER» con el log y cómo relanzarlo (`powershell -ExecutionPolicy Bypass -File "<ruta>"`).
- `Fallar` sustituye a `Die`: `throw` con el mensaje + «[línea N del script -> …]» calculado desde `Get-PSCallStack` (la línea del **llamador**, que `$_.InvocationInfo` de un `throw` interno no da). Ya no queda ningún `exit` intermedio (analizador: único `exit` restante en línea 927).
- `finally` detiene el transcript, anuncia la ruta del log, limpia claves de entorno y **en todos los casos pide «Presiona Enter para cerrar...»** salvo con el nuevo switch `-SinPausa`; con `-SinPausa` y error hace `exit 1` para conservar el código de salida en automatización.
- `Push/Pop-Location` ahora en `try/finally` (antes un error podía saltarse el `Pop`).

**2.2 · Registro (`Start-Transcript`).** Log en `%USERPROFILE%\ondina-frontend-ux-ultimo.log`, o «junto a `-Destino`» (carpeta contenedora) si se pasó ese parámetro, con fallback a `HOME` si la carpeta no existe o no es escribible y aviso claro si `Start-Transcript` falla (el script continúa sin log). La ruta se anuncia al inicio y al final. Detalle de seguridad: la salida de `supabase status -o env` (contiene `SUPABASE_SERVICE_ROLE_KEY`) se captura **en silencio** y nunca se imprime ni se escribe — el transcript no almacena la clave.

**2.3 · Comprobaciones previas con mensajes accionables.** Orden: versión de PowerShell (≥5; aviso si 5.1 recomendando PS7), `ExecutionPolicy` (`Restricted`/`AllSigned`/`Undefined` → aviso con `Set-ExecutionPolicy -Scope Process Bypass` y `powershell -ExecutionPolicy Bypass -File …`), ruta `-Destino` (caracteres Windows inválidos `< > | ? * "` y `:` fuera de la letra de unidad → aborta; espacios/puntos extremos de segmento → aborta; no-ASCII o longitud >200 → aviso), `git`, `node` con **`frontend/.nvmrc`** si existe (recorta `v`; ante `22` a secas usa el 22.12.0 de `engines "^22.12.0"`), `npm.cmd`, CLI de **Supabase o `npx --yes supabase`** (wrapper `Invocar-Supabase`; `--yes` evita el prompt interactivo de npx), Docker **instalado Y** ejecutándose (dos mensajes: falta Programa vs daemon no responde → abre Docker Desktop/WSL2), puertos **54321/54322** con sonda HTTP `/auth/v1/health` para distinguir «ocupado por la misma instancia local» (OK) de «otro proceso» (aviso con `netstat -ano | findstr`), avisos de 54323/54324/5173, y espacio en disco en la unidad de `-Destino` y del sistema (GB libres, umbral 10 GB).

**2.4 · Comandos nativos vigilados.** `Invocar-Paso <descripción> { & comando } [-Capturar] [-Sugerencia "…"]`: resetea `$LASTEXITCODE`, ejecuta, comprueba el código y en fallo lanza `Fallar` con mensaje + sugerencia; imprime duración. Se usa para `git clone/fetch/branch/log/switch/pull`, `supabase start/status -o env/db reset`, `npx supabase …`, `docker restart/info/--version`, `npm ci`, `npm run dev`, `node seed`. `docker info` sigue redirigido con `cmd /c "… >nul 2>&1"` porque PowerShell 5.1 no silencia el stderr nativo con `2>$null`. Versiones (`--version`) usan modo `-Capturar` y el llamador imprime el dato.

**2.5 · Compatibilidad 5.1, codificación y espacios.** Sin `&&`, `||`, `??`, `?.`, `??=` ni ternarios en el código PowerShell (los `??`/`?.` del seed son JavaScript dentro del here-string `@'…'@`, intacto). **BOM UTF-8 conservado** (verificado mecánicamente: el archivo empieza por `EF BB BF`; 5.1 lo necesita para los acentos) y ahora con line endings CRLF (el original era LF: en Windows es lo preferido para Notepad/ISE y no afecta al parser). Rutas con espacios: `Push-Location` + `-LiteralPath` en vez de `cmd /c "cd /d …"` en el lector de claves. **Garantías de seguridad intactas**: sólo Supabase LOCAL con la misma regex de validación (aborta ante API no local), `.env.local` sólo `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, la `service_role` sólo viaja por variable de entorno al seed y ahora **también se limpia en el `finally` global** (el original la removía sólo tras el `node` — si Node no existía, la clave quedaba en el entorno de la consola del usuario: fuga real reparada y documentada).

## 3. Cómo probarlo en Windows 11

Recomendación previa: lanzar desde una **consola ya abierta** (allí nada se cierra solo):
```powershell
cd "<carpeta donde está el script>"
powershell -ExecutionPolicy Bypass -File .\probar-frontend-ux-windows.ps1
```

| Caso | Acción | Esperado |
|---|---|---|
| Normal | script sin parámetros | completa 5 pasos + resumen + «Presiona Enter para cerrar...»; log anunciado al inicio y al final |
| Doble clic / clic derecho | «Ejecutar con PowerShell» | idem; tras Ctrl+C de Vite, la ventana queda esperando Enter |
| Automático | `-SinPausa` | sin pausa final; con error termina `exit 1` |
| Fallo de pre-requisito | quita `git.exe` del PATH antes de reejecutar | rojo: paso + comando + quién falta + `[línea N...]` + «QUÉ PUEDES HACER»; no se cierra sola |
| Docker apagado | cierra Docker Desktop | mensaje del paso «docker info» con cómo abrirlo/WSL2 |
| Sin CLI Supabase | ejecuta sin `supabase` en PATH pero con Node | aviso y uso de `npx --yes supabase …` |
| Reset | `-SoloReiniciarDatos` | pre-requisitos → reset + siembra + resumen + pausa |
| Fallo en reset | Docker cerrado + `-SoloReiniciarDatos` | rojo con la causa (puertos/Docker) y Enter para cerrar |
| Ruta conflictiva | `-Destino` con `*` o `:` fuera de la unidad | aborta explicando el carácter |
| Leer el log | `Get-Content $env:USERPROFILE\ondina-frontend-ux-ultimo.log -Tail 50 -Wait` | todo lo que se imprimió queda ahí |

## 4. Límites

1. **Sin `pwsh` en esta máquina**: la validación fue estática — analizador propio (Python, `/tmp/opencode/ps1_tools.py`, efímero) que comprueba BOM, CRLF uniformes, balance de `{}/()/[]` fuera de cadenas/comentarios, here-strings bien abiertos/cerrados, ausencia de operadores PS7, un solo `exit`, heredoc del seed **byte-idéntico al original** (122 líneas), presencia de requisitos y de seguridad — más revisión manual línea a línea. El comportamiento real con PowerShell 5.1/7 queda pendiente de los casos de la tabla anterior.
2. `Ctrl+C` sobre Vite: PowerShell ejecuta los `finally` al parar el pipeline, pero si el host corta más abruptamente la pausa podría no mostrarse (se detiene Vite a mano, no es un fallo del script).
3. En PS 5.1 el transcript tiene variaciones conocidas al capturar stderr nativo; el log recoge lo mostrado por consola.
4. El modo `-SinPausa` hace `exit 1` ante error (decisión documentada: automatización necesita código de salida; en interactivo la señal es la pausa).
5. `--yes` en `supabase db reset --local` se verificó en la documentación oficial: es **flag global** de la CLI («answer yes to all prompts», docs/reference/cli), válido con `db reset` — no era un defecto y no se tocó. Tampoco se cambió `-o env` (vigente en docs: incluye `ANON_KEY` y `SERVICE_ROLE_KEY`).

## 5. Traza

- Script corregido: `/home/cristhian/Downloads/probar-frontend-ux-windows.ps1` — 929 líneas, BOM UTF-8 + CRLF, SHA-256 `7f146694afb2058eb9bf2cae6135a2b6e31a77e88a99d3f2fae749b4060da945`.
- Copia de seguridad intacta: `~/.cache/ondina-orq/2026-10-15/s2/probar-frontend-ux-windows.ps1.orig` — SHA-256 `335b46ec7a78eb3842492a90d592a027e88d700c4aa08a4fd3c758ec9700e988`.
- Analizador: Python repasa «prohibidos» (`&&`, `||`, `??`, `?.`, `??=`, `exit`), Estado/here-string y fidelidad del seed; resultados «SIN ERRORES» tras las últimas correcciones.
- Los `?.`/`??` que aparecen en el archivo están sólo en el here-string del seed (JavaScript para Node 22) y fueron enmascarados por el analizador; cero `??`/`?.` en código PowerShell.

## Corrección posterior del coordinador (2026-10-15)

- **Problema:** la revisión del coordinador encontró que `supabase start` se ejecutaba sin capturar su salida. Esa salida incluye las claves locales (anon, service_role y JWT), y `Start-Transcript` la habría guardado en `ondina-frontend-ux-ultimo.log`, rompiendo la garantía "la service_role nunca a disco".
- **Corrección:** `Invocar-Paso` y `Invocar-Supabase` ganaron un modo `-OcultarSecretos`. Muestra la salida del comando, pero cambia las líneas con credenciales por "(línea con credenciales locales omitida)".
  - Se aplica a `supabase start`.
  - El código de salida se sigue comprobando igual que antes.
  - `supabase status -o env` ya se capturaba sin imprimirse.
- **Verificación:** se mantienen el BOM y los finales CRLF. No se pudo ejecutar en Windows porque no hay `pwsh` en Linux, así que conviene revisar el log después de la primera ejecución.
