# O1 — Endurecimiento de CI en el repositorio

Fecha: 2026-10-14, America/Santiago. GitHub: #46. Beads: `OND-o5g`.
Task Orca: `task_fdfd9f9b4e97`; dispatch: `ctx_75b46f56dda8`.

## Resultado y alcance

Implementación local entregada en `chore/ci-hardening`, creada desde
`origin/develop` en `6903f59e66bcd49c1c14b20fbfe57271b0c7a353`.
Commit de implementación: `e9eac74d7f06906394adf26537daaa4d8ff7641a`
(`ci: add redacted secret scanning and dependency review`).
La documentación y este informe se entregan en un segundo commit local.
No se hizo push, PR, merge, despliegue ni escritura de configuración en GitHub.

Se añadieron escaneo de secretos por rango, instalación de Gitleaks con checksum
fijo, autocomprobación con fixture temporal y revisión de dependencias en PR.
Se redujeron los permisos de Health al job que administra incidencias.
La guía de seguridad está en inglés y enlazada desde el mapa y deployment.
Se corrigieron dos frases obsoletas de deployment que aún describían el job de
migraciones como una comprobación de sintaxis: el workflow actual reconstruye
una instancia local y ejecuta pgTAP y recorridos de roles.

## Criterios de aceptación de #46 → evidencia

| Criterio | Implementación y evidencia | Estado y límite |
| --- | --- | --- |
| El CI detecta una credencial sintética sin imprimir valores sensibles | `.github/workflows/security.yml:28` ejecuta `scripts/ci/test-gitleaks.sh`; `scripts/ci/test-gitleaks.sh:14` genera el valor aleatorio en tiempo de ejecución, exige exit `42` y comprueba log + JSON y `Secret=REDACTED` | PASS local con Gitleaks 8.30.1; ejecución real en Actions pendiente tras integración |
| Un PR no confiable no recibe secretos ni escritura innecesaria | `.github/workflows/security.yml:3` usa `pull_request`; permisos por defecto vacíos y `contents: read` por job; sin referencia a secretos, sin `pull_request_target`, checkout sin credenciales persistidas; `.github/workflows/health.yml:14` y `:23` limitan `issues: write` al job Health | PASS de revisión estática; no se creó un PR de fork para prueba remota |
| Actions/herramientas críticas fijas y actualización revisable | Dependency Review v5.0.0 fijada por SHA en `.github/workflows/security.yml:57`; versión/checksum de Gitleaks en `scripts/ci/install-gitleaks.sh:5`; tags verificados por `gh api`; Dependabot existente para npm/Actions; actualización manual del binario documentada | PASS local y consultas remotas de lectura; checksum incorrecto rechazado antes de instalar |
| Lockfile analizado y riesgo runtime/desarrollo diferenciado | `.github/workflows/security.yml:56` publica avisos de desarrollo; `:64` bloquea runtime/unknown con severidad high/critical; `comment-summary-in-pr: never`; la action compara revisiones del PR mediante Dependency Review API | Configuración válida y entradas contrastadas con la action fijada; comparación real de lockfiles en Actions pendiente |
| Respuesta a una credencial real por canal seguro, sin publicarla en issue | `docs/engineering/security.md:102`: revocar/rotar primero, revisar uso, actualizar consumidores, verificar revocación y funcionamiento, purgar historial sólo cuando proceda | Procedimiento entregado; no hubo credencial privada que exigiera activar respuesta |
| Escaneo del repositorio pasa con excepciones justificadas | `scripts/ci/scan-gitleaks.sh:9` y `.gitleaks.toml:6`; escaneo completo con `all` y escaneo del índice preparado antes de commit | PASS; cobertura de refs alcanzables, no objetos inalcanzables ni garantía universal de ausencia de secretos |
| YAML válido y gates de frontend verdes | Actionlint 1.7.12, PyYAML, ShellCheck y gates de frontend con Node 22.23.3 | PASS; 44 archivos / 529 tests; sin `test:integration` |

## Escaneo y excepción histórica

Gitleaks **8.30.1**, asset `gitleaks_8.30.1_linux_x64.tar.gz`.
SHA-256 verificado contra el checksum oficial y fijado en el instalador:
`551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`.

El primer escaneo sin configuración encontró **2 hallazgos JWT**, ambos del
mismo valor público en la línea 75 de `docs/setup-vercel-supabase-github.md`,
con commits `f8e3ec5ada81e1c7c2ec249f5cd15f8b2accd414` y
`a90ed63a272f8d1f430bf6aae02468f6e0201b6a`.
La revisión del payload confirmó `iss=supabase`, `role=anon` y
`ref=rhivlzwtobhiguzmkiat`; no era una clave privilegiada.
Su hash es
`85410bc506548bca60fbeb0096e9c5fa920a2f5838b2a1e0d7c10663eaf0007a`.
El informe no reproduce el valor.

La única excepción añadida exige simultáneamente la ruta histórica exacta y el
valor exacto, y sólo afecta a la regla `jwt`. No se excluyeron directorios de
archivo, commits completos, familias de JWT ni `service_role`. Se conservan las
reglas predeterminadas de Gitleaks. Los comentarios `gitleaks:allow` no suprimen
hallazgos en estos comandos.

En PR se escanea `merge-base(base, head)..head`; en push, `before..head`.
Un primer push con `before` a ceros escanea toda la historia del nuevo tip.
Una referencia inexistente falla de forma cerrada. El fixture confirma que
añadir y luego eliminar un secreto en el mismo rango sigue siendo detectado.

## Validación ejecutada

Desde la raíz, salvo los gates de frontend:

```bash
bash scripts/ci/install-gitleaks.sh /tmp/ondina-o1-installed
GITLEAKS_BIN=/tmp/ondina-o1-installed/gitleaks bash scripts/ci/test-gitleaks.sh
GITLEAKS_BIN=/tmp/ondina-o1-installed/gitleaks bash scripts/ci/scan-gitleaks.sh all
/tmp/ondina-o1-installed/gitleaks git . --staged --pre-commit \
  --redact=100 --no-banner --ignore-gitleaks-allow --config .gitleaks.toml
/tmp/ondina-o1-tools/actionlint .github/workflows/*.yml
shellcheck scripts/ci/*.sh
git diff --check
```

| Comprobación | Resultado observado |
| --- | --- |
| Instalador con checksum oficial fijado | exit 0, versión `8.30.1` |
| Copia temporal del instalador con checksum deliberadamente incorrecto | exit 1, binario no instalado; no se modificó el instalador del repo |
| Fixture de directorio | `PASS: synthetic credential detected (exit 42); log and JSON contain no value.` |
| Fixture Git | `PASS: PR/push/first-push detect a removed credential; an empty range passes; missing refs fail.` |
| Historia alcanzable, tras commit de implementación | exit 0, `228 commits scanned`, `no leaks found`, aproximadamente 8.02 MB; las refs compartidas pueden cambiar por otros workers |
| Índice preparado, antes de commit | exit 0, `no leaks found` |
| Actionlint 1.7.12, todos los workflows | exit 0, sin hallazgos; binario descargado con verificación de checksum |
| PyYAML | `safe_load` válido para los cinco workflows y Dependabot |
| ShellCheck, tres scripts | exit 0, sin hallazgos |
| Revisión del diff | sin espacios inválidos; sin modificaciones versionadas de `frontend/`, SQL, migraciones o `.opencode/` |

El shell inicial tenía Node 26.3.1 y `npm ci` emitió `EBADENGINE`; sus gates
pasaron, pero se repitió instalación y los cuatro gates con **Node 22.23.3**
para corresponder con `frontend/.nvmrc` y `engines`.
Comando ejecutado desde `frontend/`:

```bash
npm exec --yes --package=node@22.23.3 -- sh -c \
  'node --version && npm ci && npm run lint && npm run build && npm run size && npm run test'
```

En la ejecución real se redirigió cada salida a un log independiente bajo
`/tmp/ondina-o1-tools/node22-*.log`; el comando anterior conserva los mismos
pasos y su orden para reproducción.

| Gate con Node 22.23.3 | Resultado |
| --- | --- |
| `npm ci` | 292 paquetes instalados, 293 auditados, 0 vulnerabilidades reportadas |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `npm run size` | exit 0; JS entrada gzip 107253 / presupuesto 117979 B; CSS gzip 45754 / 50330 B; chunk mayor 341686 / 375855 B |
| `npm run test` | exit 0; **44 archivos, 529 tests** |

No se ejecutó `npm run test:integration`, ningún comando de Supabase ni ninguna
operación de BD. Se prepararon únicamente dependencias y `.env.local` ignorado
según el preámbulo; no se modificó código de frontend. No aplica evidencia por
viewport a esta tarea de workflows/scripts/documentación.

## Verificación de releases y configuración de sólo lectura

Todos los tags consultados devolvieron `object.type=commit`; no hubo tag anotado
que requiriera una segunda desreferencia.

| Repo / tag consultado con `gh api repos/<repo>/git/ref/tags/<tag>` | SHA confirmado |
| --- | --- |
| `actions/dependency-review-action` / `v5.0.0` | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |
| `actions/checkout` / `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` / `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `supabase/setup-cli` / `v3.0.1` | `45a513f8c64c0bc8e0e3dfe572b5c95be85f6359` |
| `gitleaks/gitleaks` / `v8.30.1` | `83d9cd684c87d95d656c1458ef04895a7f1cbd8e` |

Se contrastaron las entradas y el comportamiento de scope/warn-only con
[Dependency Review v5.0.0](https://github.com/actions/dependency-review-action/blob/v5.0.0/action.yml)
y su fuente fijada, y las opciones de rango/allowlist/redacción con
[Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/tree/v8.30.1).

Las consultas GET a GitHub confirmaron repo público, secret scanning y push
protection habilitados, actualizaciones de seguridad Dependabot habilitadas,
los nombres `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` a nivel repo y
ningún secreto en `development`/`production`. No se leyó ni imprimió su valor.
Las ramas tienen dos checks requeridos: `Lint + typecheck + build + test` y
`Validar migraciones Supabase`; strict=false en develop y strict=true en main.

## Configuración externa propuesta, sin aplicar

El diff exacto está en
[CI security — External configuration proposal](../../../../engineering/security.md#external-configuration-proposal--do-not-apply-automatically).

1. Crear los tres secretos de Vercel en **cada** environment `development` y
   `production`, con token/proyecto/cuenta adecuados; verificar despliegues
   autorizados y después eliminar las tres copias de repositorio. Mantener
   reviewers y restricciones existentes; transferir valores por canal seguro.
2. Añadir los checks `Secret scan + self-test` y
   `Dependency review (runtime high)` a las reglas de **develop y main**,
   conservando los dos checks actuales, sus bindings de app y el strict actual.
   Elegir los contextos después de un PR real exitoso.

El umbral propuesto e implementado bloquea runtime y scope desconocido en
**high/critical**; desarrollo muestra avisos de todas las severidades sin
bloquear. La revisión de licencias queda desactivada expresamente porque no se
definió una política de licencias en esta tarea.

Los workflows de seguridad y despliegue son independientes: un fallo de
seguridad no introduce por sí solo una dependencia `needs` en un despliegue por
push. Los checks requeridos protegen el camino de integración por PR después
de activarlos; políticas de push directo y bypass siguen bajo responsabilidad
del propietario. No se certifican esos controles externos mediante pruebas
locales ni se declara #46 cerrado remotamente.

## Archivos y entrega

- `.github/workflows/security.yml`, `.github/workflows/health.yml`.
- `.gitleaks.toml`.
- `scripts/ci/install-gitleaks.sh`, `scan-gitleaks.sh`, `test-gitleaks.sh`.
- `docs/engineering/security.md`, `docs/engineering/deployment.md`, `docs/README.md`.
- Este informe en `docs/archive/audits/2026-10-14/operacion/O1-ci-hardening.md`.

Beads se mantiene para trazabilidad local; el cierre global de `OND-o5g` queda
al coordinador tras integrar y verificar las obligaciones remotas. El hook
existente del commit exportó 117 issues a
`/home/cristhian/Documents/ondina/.beads/issues.jsonl`; no se editó ese archivo
manualmente ni se incluyó en estos commits. La comunicación de entrega usa
únicamente Orca y una única señal `worker_done` con los IDs del dispatch.
