# CI/CD y Operación — verificación de la auditoría 2026-10-09

Worker: CI/CD y operación (opencode / deepseek-v4.1-flash) · Orca `run_af5dd59a6889` · Beads OND-c2z · 2026-10-13.
Checkout compartido `develop` en `a0a8f65` (solo lectura; el único archivo escrito es este informe). Verificaciones remotas puntuales con `gh api` en modo lectura (sin escrituras, sin despliegues, sin paneles de Vercel/Supabase). Los resultados de npm provienen del worker de testing y no se repitieron.

## Resumen

1. Revisé los tres workflows (`.github/workflows/ci.yml`, `deploy-develop.yml`, `deploy-prod.yml`), `frontend/vercel.json`, `frontend/package.json` y `package-lock.json` (metadatos), `vite.config.ts`, `.gitignore`, `.env.example`, `docs/engineering/{deployment,development,database}.md`, `scripts/bootstrap-beads.sh`, los 5 hooks de `.beads/hooks/`, el historial Git y lecturas de GitHub (ejecuciones, deployments, environments, protección de ramas y alertas).
2. Las afirmaciones de la sección 9 y preguntas relacionadas quedaron evaluadas en 26 filas: ninguna refutada; 21 confirmadas (varias con matices), 4 parciales (Node, caché, env vars de build, manejo de secretos) y 1 ausencia de control (timeouts).
3. Verificación remota nueva del 13-10: `develop` **no está protegida** y **ningún branch exige checks de CI** (main: 1 review, sin `required_status_checks`; rulesets vacíos). `production` sí tiene 4 reviewers y política de rama `main`, pero ese gate **solo cubre la vía Actions**.
4. La doble publicación quedó confirmada con registros actuales: `vercel[bot]` crea deployments Preview/Production (Git integration) y el workflow CLI publica el mismo commit; en main@38b60b0 ambos publicaron con 13 s de diferencia (23-08) y en develop@a0a8f65 con ~1 min (13-10).
5. Hallazgos nuevos: CICD-1 (sin protección de `develop` ni checks exigidos), CICD-2 (la vía Git de producción evade el gate de reviewers), CICD-3 (repo público sin secret scanning/push protection/Dependabot alerts), CICD-4 (sin timeouts), CICD-5 (sin rollback/redespliegue versionado) y CICD-6 (secretos repo-level y token inline en `run:`).
6. A preservar: concurrency en los tres workflows, caché npm en CI/verify, `npm ci` con lockfile v3, `permissions: contents: read` en deploys, ausencia de `pull_request_target` e inputs no confiables en `run:`, environment `production` con 4 reviewers + rama `main`, y hooks de Beads operativos.
7. Ramas: `feature/administracion` (3 commits, 04-08; 352 archivos y 38.598 eliminaciones si se fusionara tal cual) y `feature/ventas` (23 commits, 10-08; su contenido HU-08/09 ya está en develop) siguen sin decisión; `feature/bodega` y `feature/produccion` están 0 adelante. Ver #57.
8. No existe workflow de despliegue de Supabase (migraciones manuales, `deployment.md:29`); tampoco Dependabot/renovate, CODEOWNERS, plantilla de PR ni `docs/operations/`.

## Evaluación de afirmaciones de la auditoría 2026-10-09

| ID / afirmación (resumen) | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| C-01 `migrations-check` solo busca `;` | confirmada | `ci.yml:63-66` (`grep -q ";"` por archivo); pasa en vacío (`ci.yml:59-61`); no parsea ni aplica SQL | "…solo verifica que cada archivo contenga al menos un `;`; pasa trivialmente si no hay archivos" |
| C-02 `deploy-develop` publica sin depender de CI | confirmada | `deploy-develop.yml:3-5` (push develop) y `:14-31` sin `needs`/`workflow_run`; `gh run list`: 13-10 02:59:49Z CI `cancelled` y Deploy Desarrollo `success` 03:04:33Z | — |
| C-03 Producción con job verify y environment; reviewers no acreditables por YAML | confirmada; ahora verificable | `deploy-prod.yml:17-44` (verify), `:49-55` (environment); API environments: `production` con `required_reviewers` = Cristhian-S1, CRISTIAN-HC27, galletaneru, Laoch-11 y `branch_policy` `main` | "…el environment `production` tiene 4 reviewers y política de rama `main` (verificado 13-10 vía API); el YAML por sí solo no lo acreditaba" |
| C-04 Git integration y CLI publican el mismo commit | confirmada | API deployments: `vercel[bot]` Preview ×47 (10-08→13-10) y Production ×6 (13-08→23-08); Actions `development` ×40 y `production` ×7; main@38b60b0: bot 23-08 03:15:46Z vs Actions 03:15:59Z; `vercel.json:1-8` sin `git.deploymentEnabled` | — |
| C-05 `vercel@latest` sin fijar | confirmada | `deploy-develop.yml:25`; `deploy-prod.yml:61` | — |
| C-06 Actions por tag, no por SHA | confirmada | `checkout@v4`: `ci.yml:27,53`, `deploy-develop.yml:22`, `deploy-prod.yml:25,58`; `setup-node@v4`: `ci.yml:30`, `deploy-prod.yml:28` | — |
| C-07 `pull-requests: write` global | confirmada y excesiva | `ci.yml:9-11`; ningún step escribe PRs; el default del repo es `read` (API `actions/permissions/workflow`) | "…permiso workflow-level sin uso observado; el default del repositorio es `read`" |
| C-08 Node dispar entre CI (22), Vercel (24.x) y local (26) | parcial | CI 22: `ci.yml:32`, `deploy-prod.yml:30`; `deploy-develop.yml` sin `setup-node` (`:24-25`); local `v26.3.1` (medido hoy); sin `engines`/`.nvmrc` (`package.json:1-48`; `ls .nvmrc` ausente); runtime de Vercel = configuración remota | "CI fija Node 22; `deploy-develop` no fija runtime para el CLI; no existe pin `engines`/`.nvmrc`; local v26.3.1 (13-10); runtime de Vercel no verificable desde el repo" |
| C-09 Sin build-once-promote | confirmada | Sin `upload-artifact`/`download-artifact` (grep); CI construye (`ci.yml:42-43`) y Vercel reconstruye (`vercel.json:4-6`); la integración Git construye de nuevo | — |
| C-10 Sin monitorización/alertas/uptime | confirmada (sin evidencia en repo) | grep de `sentry`/`analytics`/`monitoring`/`uptime` sin resultados en `frontend/src`, `index.html` y `docs/engineering`; paneles remotos no verificables | — |
| C-11 Backups/PITR sin verificar | confirmada; no verificable en repo | Sin documentación de backups (grep `docs/engineering`); requiere panel Supabase (#41) | — |
| C-12 S-04: HSTS sí; sin CSP/XCTO/RP/PP | confirmada a nivel de repositorio | `frontend/vercel.json:1-8` sin clave `headers`; sin `_headers` ni meta CSP (grep); HSTS observado el 09-10 no re-verificado (respuesta remota) | "El repo no declara cabeceras de seguridad en `vercel.json`; HSTS proviene de la plataforma y no fue re-verificado el 13-10" |
| C-13 Manejo de secretos en workflows | parcial | Sin `pull_request_target` ni `github.event.*` en `run:` (grep); token inline `--token=${{ secrets.VERCEL_TOKEN }}` (`deploy-develop.yml:28`; `deploy-prod.yml:64`) vs IDs por `env:`; secretos a nivel repo (API); scanning deshabilitado (ver CICD-3) | ver CICD-6 |
| C-14 Concurrency groups | confirmada | `ci.yml:13-15` (`cancel-in-progress: true`); `deploy-develop.yml:10-12`; `deploy-prod.yml:10-12` (`false`) | — |
| C-15 Caching | parcial | CI y verify: `setup-node` con `cache: npm` (`ci.yml:31-34`; `deploy-prod.yml:28-32`); jobs de deploy sin `setup-node` ni caché; CLI global descargado por corrida | — |
| C-16 Timeouts | ausente (hallazgo) | Sin `timeout-minutes` en los 3 workflows; GitHub aplica 360 min/job por defecto | ver CICD-4 |
| C-17 Branch triggers | confirmada | `ci.yml:3-7` (PR y push develop+main); `deploy-develop.yml:3-5`; `deploy-prod.yml:3-5`; sin `workflow_dispatch` → ver CICD-5 | — |
| C-18 ¿CI detectaría una migración rota? | no (carencia confirmada) | `ci.yml:63-66` no parsea ni ejecuta SQL; 0007 recrea triggers ya definidos en `0001_init.sql:1426` sin `drop trigger` (`0007_fix_triggers_ventas.sql:123-135`; 0 drops en el archivo) y pasaría el grep; el job `verify` de producción no corre `migrations-check` (`deploy-prod.yml:37-44`) | — |
| C-19 ¿Existe workflow de despliegue Supabase? | no | Sin CLI `supabase` en workflows (grep); migraciones manuales (`deployment.md:29`); gate de reconciliación (`database.md:6`); sin `supabase/config.toml` (solo `.gitignore` y `migrations/0001-0010`) | — |
| C-20 ¿Deploy construye con las env vars correctas? | parcial / no verificable | Build en Vercel (`vercel.json:4-6`); los workflows solo pasan Vercel ID/token; `VITE_*` deben existir en el proyecto remoto (`deployment.md:20`; `.env.example:6,10`); raíz resuelta por project setting (commit `8751ee7`; `deployment.md:19`); `supabase.ts:4-7` sin diagnóstico de variables | — |
| C-21 ¿`npm ci` usa el lockfile? | confirmada | `ci.yml:34,37`; `deploy-prod.yml:32,35`; `vercel.json:6`; `package-lock.json:4` (`lockfileVersion: 3`) | — |
| C-22 Dependabot/renovate | ausentes | `ls` sin `.github/dependabot.yml` ni `renovate.json`; API: Dependabot alerts deshabilitadas | ver CICD-3 |
| C-23 CODEOWNERS | ausente | `ls CODEOWNERS .github/CODEOWNERS` sin resultados | — |
| C-24 Plantilla de PR | ausente | `ls .github/pull_request_template.md` y variantes sin resultados | — |
| C-25 Protección de ramas: docs vs realidad | docs correctas al remitir a ajustes vivos; realidad incompleta | `deployment.md:13,22`; `development.md:11`; API: `develop` 404 "Branch not protected", `main` 1 review sin checks, rulesets `[]` | ver CICD-1 |
| C-26 Ramas antiguas | confirmada (siguen sin decisión) | `git branch -a`; adelanto: administracion 3, ventas 23, bodega 0, produccion 0; diffs dos-puntos 352/297 archivos; fechas 04-08/10-08; ver #57 | — |

## Hallazgos nuevos

### CICD-1 — `develop` sin protección de rama y ningún required status check en el repositorio · alta · confirmado

- **Evidencia:** `gh api repos/Cristhian-S1/ondina-erp/branches/develop/protection` → 404 "Branch not protected"; `.../branches/main/protection` → `required_status_checks` ausente, `required_pull_request_reviews.required_approving_review_count: 1`, `enforce_admins: false`; `.../rulesets` → `[]`.
- **Comando:** los tres `gh api` anteriores (13-10, solo lectura).
- **Impacto:** el CI (`ci.yml`) no es puerta para integrar ni publicar: un push directo a `develop` pasa sin revisión y `deploy-develop` publica automáticamente (C-02). En `main` el check de CI tampoco es obligatorio, y con `enforce_admins: false` un administrador puede saltarse la revisión exigida.
- **Issue:** relacionado #39 y #57; `sin issue (proponer)`: **"Proteger `develop` y exigir los checks de CI para integrar y publicar"**. Criterios de aceptación: (1) `develop` con protección de rama y `required_status_checks` (build + `migrations-check`); (2) `main` exige además el check de CI junto a la revisión actual; (3) bypass de administradores deshabilitado o documentado como excepción; (4) evidencia de un PR de prueba bloqueado por check fallido y de un push directo rechazado.

### CICD-2 — La publicación de producción por Git integration no pasa por el gate del environment `production` · alta · confirmado

- **Evidencia:** API deployments: `vercel[bot]` creó 6 deployments `Production` (2026-08-13→23-08) sobre commits de `main`; para main@38b60b0, `vercel[bot]` publicó a las 03:15:46Z y el workflow de Actions a las 03:15:59Z (ambos el 23-08). El environment `production` (4 reviewers) solo protege el job de Actions (`deploy-prod.yml:49-55`); `vercel.json:1-8` no desactiva Git deployments (sin `git.deploymentEnabled`).
- **Comando:** `gh api 'repos/Cristhian-S1/ondina-erp/deployments?per_page=100'` (agrupado por environment/creator) + `gh api repos/Cristhian-S1/ondina-erp/environments`.
- **Impacto:** los criterios de #39 "no hay dos despliegues de producción independientes para el mismo cambio" y "una aprobación no protege una publicación automática paralela" siguen sin cumplirse: un merge/push a `main` se publica por la integración Git sin pasar por los reviewers.
- **Issue:** #39 (núcleo del problema; ver ediciones propuestas en "Issues revisados").

### CICD-3 — Repositorio público sin secret scanning, push protection ni Dependabot alerts · media · confirmado

- **Evidencia:** `gh api repos/Cristhian-S1/ondina-erp` → `"visibility":"public"` y `security_and_analysis` con `secret_scanning: disabled`, `secret_scanning_push_protection: disabled`, `dependabot_security_updates: disabled`; `.../dependabot/alerts` → 403 "Dependabot alerts are disabled for this repository"; sin `.github/dependabot.yml` ni `renovate.json` (ls).
- **Comando:** los `gh api` anteriores y `ls` de configuraciones.
- **Impacto:** una credencial filtrada en un commit público no sería detectada por las capas nativas de GitHub (y no existe escaneo equivalente en el CI); las dependencias vulnerables detectadas por `npm audit` (9 alertas; ver informe de testing) no generan alertas del repositorio. No hay evidencia de una credencial expuesta hoy; es una brecha preventiva en un repo público.
- **Issue:** #46 (y #38 para dependencias). Añadir a su alcance: activar secret scanning + push protection y Dependabot alerts/security updates, además del escaneo en CI.

### CICD-4 — Jobs sin timeout explícito · baja · confirmado

- **Evidencia:** `grep -n "timeout-minutes" .github/workflows/*.yml` sin resultados (3 workflows, 5 jobs); GitHub aplica 360 min por job por defecto.
- **Comando:** el grep anterior.
- **Impacto:** un job colgado (`npm ci`, tests o CLI Vercel esperando) puede consumir horas de runner y retrasar el feedback; sin control de coste.
- **Issue:** `sin issue (proponer)`: **"Añadir `timeout-minutes` a los jobs de CI y deploy"**. Criterios: (1) cada job con timeout razonable (p. ej. build 15, migrations 5, verify 20, deploy 15); (2) un job que excede el límite falla en vez de colgarse; (3) CI verde sin cambios funcionales.

### CICD-5 — Sin vía versionada de redespliegue/rollback desde Actions · media · confirmado

- **Evidencia:** ninguno de los 3 workflows tiene `workflow_dispatch` (lectura completa); `deployment.md:32` exige que el rollback use un deployment previo aprobado, pero no existe procedimiento versionado; #39 pide "se prueba un rollback inocuo" sin evidencia en el repo.
- **Comando:** lectura de workflows + `grep workflow_dispatch`.
- **Impacto:** ante un deploy defectuoso no hay un procedimiento trazable en el repositorio; se depende del panel de Vercel (sin pasos documentados) o de un commit nuevo.
- **Issue:** relacionado #39; `sin issue (proponer)` si se quiere granularidad: **"Versionar el procedimiento de rollback/redeploy del frontend"**. Criterios: (1) `workflow_dispatch` (o procedimiento CLI documentado y probado) para redesplegar un commit/deployment anterior; (2) ensayo inocuo en preview con evidencia; (3) referencia al deployment ID retenido.

### CICD-6 — Secretos de Vercel a nivel repo y token inline en `run:` · baja · confirmado

- **Evidencia:** `gh api .../actions/secrets` → `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` a nivel repo (sin secretos por environment); `deploy-develop.yml:27-31` y `deploy-prod.yml:63-67` interpolan `${{ secrets.VERCEL_TOKEN }}` sin comillas dentro de `run:`, mientras que los IDs van por `env:`.
- **Comando:** los `gh api` y lecturas anteriores.
- **Impacto:** cualquier workflow del repositorio puede leer el token (mayor alcance que un secreto de environment); el patrón recomendado (`env:` + comillas) evita exposición en la línea de comandos y roturas por caracteres especiales. No hay evidencia de filtración.
- **Issue:** #46.

## Issues revisados

- **#39 · OND-get — "[P1][CI/CD] Unificar publicación en Vercel y exigir verificaciones" (abierto).** Sigue **preciso**, ahora con evidencia actual: (1) "las protecciones no pudieron verificarse" → verificado 13-10: `develop` sin protección, `main` 1 review sin checks, `production` con 4 reviewers + rama `main`; (2) la doble publicación sigue activa (CICD-2: `vercel[bot]` Production + Actions production del mismo commit el 23-08; Preview + development el 13-10); (3) añadir CICD-1 (checks no exigidos) y CICD-5 (rollback sin mecanismo); (4) mantener la advertencia de no aplicar SQL automático sin reconciliar.
- **#40 · OND-eh8 — "[P1][CI/CD] Ejecutar migraciones y pgTAP reales en integración continua" (abierto).** Sigue **preciso**. Evidencia útil: `migrations-check` pasa en vacío (`ci.yml:59-61`), no parsea SQL y el `verify` de producción ni lo ejecuta; no existe `supabase/config.toml` (solo `migrations/0001-0010`); el caso 0007 (triggers de `0001_init.sql:1426` recreados en `0007_fix_triggers_ventas.sql:123-135` sin `drop trigger`) pasaría el chequeo. El criterio "el check es obligatorio para integrar" depende de CICD-1: enlazar.
- **#41 · OND-uxi — "[P1][Operación] Verificar backups y ensayar recuperación de Supabase" (abierto).** Sigue **preciso**; nada verificable desde el repo (sin documentación de backups en `docs/engineering/`); dependencia #28 vigente. Sin cambios de redacción.
- **#45 · OND-4hm — "[P2][Seguridad] Aplicar cabeceras de seguridad y una CSP compatible" (abierto).** Sigue **preciso**: `frontend/vercel.json:1-8` no declara `headers` y no hay otra configuración de cabeceras en el repo; la evidencia HSTS es del 09-10 y no se re-verificó (sin acceso a la respuesta remota). Edición sugerida: precisar que el punto de partida del repo es "sin cabeceras declaradas en `vercel.json`".
- **#46 · OND-o5g — "[P1][CI/CD] Proteger secretos y dependencias de la cadena de CI" (abierto).** Sigue **preciso**; añadir al estado inicial verificado: secret scanning/push protection/Dependabot alerts deshabilitados en repo público (CICD-3); `VERCEL_*` a nivel repo y token inline (CICD-6); actions `@v4` y `vercel@latest` vigentes (C-05/C-06); `pull-requests: write` sin uso (C-07). Mantener los criterios actuales.
- **#53 · OND-aeo — "[P2][Repositorio] Hacer reproducible el entorno de desarrollo y configuración" (abierto).** Sigue **preciso**; evidencia adicional: `deploy-develop` no fija Node para el CLI (sin `setup-node`), `deploy-prod`/CI usan 22, local v26.3.1, sin `engines`/`.nvmrc`; `supabase.ts:4-7` no valida variables (error genérico de `createClient`). Añadir "runtime del proyecto Vercel por verificar en panel" como parte del criterio de paridad.
- **#54 · OND-5a4 — "[P2][Operación] Detectar caídas y errores con observabilidad y alertas útiles" (abierto).** Sigue **preciso**; sin cambios: el repo no contiene analytics/monitorización y no se verificaron paneles remotos.
- **#55 · OND-roo — "[P2][Infraestructura] Evaluar defensa contra abuso con Vercel y Cloudflare Turnstile" (abierto).** Sigue **preciso** como decisión abierta; desde el repo solo se confirma que no hay configuración de proxy/WAF versionada (no verificable en panel). Sin cambios.
- **#57 · OND-2mt — "[P2][Repositorio] Revisar ramas antiguas y reforzar el flujo de PR" (abierto).** Sigue **preciso**; actualizar con datos de hoy: `feature/administracion` 3 commits adelante (último 04-08) y diff dos-puntos de **352 archivos con 38.598 eliminaciones** (179 borrados, incluidas todas las `.agents/skills/*`); `feature/ventas` 23 adelante (10-08; 297 archivos de divergencia) pero su contenido HU-08/09 ya está en develop (`MiComision.tsx`, `RankingVendedores.tsx` presentes en develop); `feature/bodega` y `feature/produccion` 0 adelante (10-08); sin CODEOWNERS ni plantilla de PR (C-23/C-24); protección real: ver CICD-1 (develop sin protección; main sin checks). PR usados: 8 históricos (6 fusionados, 2 cerrados, 0 abiertos) y una única ejecución de CI disparada por `pull_request` (14-08).

## Límites

- **Sin acceso a paneles remotos** de Vercel (runtime Node del proyecto, Git integration, protección/rollback) ni Supabase (backups/PITR, advisors): esas afirmaciones quedan `no verificable (requiere panel remoto)`; solo se usó la API de GitHub en modo lectura y el contenido del repositorio.
- **HSTS/cabeceras HTTP de producción no re-verificadas** el 13-10 (la tarea prohíbe llamadas a producción); se evalúa lo declarado en el repo.
- **No ejecuté npm** (lint/build/test/audit) ni `npm ci`: los resultados citados provienen del informe del worker de testing (`docs/archive/audits/2026-10-13/workers/testing-documentacion.md`) y no se repitieron aquí.
- **La ejecución real del CLI Vercel** (resolución de `rootDirectory=frontend` desde la raíz) no se re-verificó; se cita el commit `8751ee7` y `deployment.md:19` como evidencia declarada, no observada hoy.
- **Estados remotos puntuales**: protección, environments, deployments y alertas se leyeron el 2026-10-13; pueden cambiar después de esta fecha. No se leyeron valores de secretos (solo sus nombres).
- **Calidad de las migraciones SQL** fuera de alcance (otro worker); aquí solo se usa 0007 como ejemplo de que el chequeo de `;` no detecta errores reales.
- **`.beads/hooks`** leídos (5 wrappers Beads v1.0.4 con `timeout` de 300 s y manejo de exit 3; `core.hooksPath=.beads/hooks`): operativos, no modificados. `docs/operations/` no existe; `scripts/` solo contiene `bootstrap-beads.sh`.
