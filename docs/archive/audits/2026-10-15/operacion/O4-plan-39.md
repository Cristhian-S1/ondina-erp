# O4 — Unificar publicación en Vercel (#39 / OND-get)

Fecha: 2026-10-15, America/Santiago. Alcance: evidencia externa de solo lectura, cambios de repositorio y propuesta de controles externos para aprobación del responsable. Rama `chore/vercel-unificar`, base `origin/develop` = `6903f59e66bcd49c1c14b20fbfe57271b0c7a353`. No se modificaron settings, environments, secretos, Vercel, Supabase, SQL ni `.opencode/`; no se hizo push, PR ni publicación. OND-get permanece abierto: esta entrega no satisface por sí sola sus criterios operacionales remotos.

## 1. Diagnóstico actualizado y evidencia reproducible

El diagnóstico del handoff describe un estado anterior. La doble publicación histórica se confirma, pero develop **ya tiene protección**, y la desactivación Git y los dispatches con `ref` ya están implementados. No se duplican esas funciones.

Consultas efectuadas con `gh` autenticado, exclusivamente GET:

```bash
gh issue view 39
gh pr view 87 --json number,state,title,headRefName,headRefOid,baseRefName,files
gh pr diff 87
gh pr checks 87
gh api repos/Cristhian-S1/ondina-erp/branches/develop/protection
gh api repos/Cristhian-S1/ondina-erp/branches/main/protection
gh api repos/Cristhian-S1/ondina-erp/rulesets
gh api repos/Cristhian-S1/ondina-erp/environments
gh api repos/Cristhian-S1/ondina-erp/environments/production/deployment-branch-policies
gh api repos/Cristhian-S1/ondina-erp/actions/secrets
gh api repos/Cristhian-S1/ondina-erp/environments/development/secrets
gh api repos/Cristhian-S1/ondina-erp/environments/production/secrets
gh api 'repos/Cristhian-S1/ondina-erp/deployments?per_page=100'
gh api 'repos/Cristhian-S1/ondina-erp/deployments?sha=6903f59e66bcd49c1c14b20fbfe57271b0c7a353&per_page=100'
gh api repos/Cristhian-S1/ondina-erp/actions/runs/38645213522/jobs
gh api repos/Cristhian-S1/ondina-erp/commits/6903f59e66bcd49c1c14b20fbfe57271b0c7a353/check-runs
```

Solo se registran nombres de secretos; sus valores no son visibles por estas consultas ni se solicitaron. Repositorio público; rama por defecto `main`; lista de rulesets vacía en esta lectura.

| Control | Resultado verificado en esta ejecución |
| --- | --- |
| develop | Checks `Lint + typecheck + build + test`, `Validar migraciones Supabase`; `strict=false`, `enforce_admins.enabled=false`; sin requisito de PR. Force push y borrado deshabilitados. |
| main | Mismos checks, `strict=true`; PR con una aprobación, descarte de revisiones obsoletas y resolución de conversaciones; `enforce_admins.enabled=false`. Force push y borrado deshabilitados. |
| Check bindings | Build ligado a GitHub Actions, app ID `15368`; migraciones con `app_id=null` en la protección. Los check-runs actuales de ambos tienen app ID `15368`. |
| production | Cuatro revisores: Cristhian-S1, CRISTIAN-HC27, galletaneru, Laoch-11; basta uno, no son cuatro aprobaciones. `prevent_self_review=false`, `can_admins_bypass=true`; política custom de rama exclusivamente `main`. |
| development | Sin reglas de protección, `deployment_branch_policy=null`, `can_admins_bypass=true`. |
| Preview | Environment histórico sin reglas; no lo usan los jobs de Actions de esta entrega. |
| Secretos | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` a nivel repositorio. Listas de secretos propias de development y production vacías. No se comprobó el valor ni alcance real del token. |
| Git Vercel | `frontend/vercel.json:7` ya contiene `deploymentEnabled=false` en la base; también se leyó ese valor en `main` vía Contents API. La CSP está aplicada (`Content-Security-Policy`), no Report-Only. |

Doble publicación histórica confirmada en los registros de GitHub:

| SHA | Deployment GitHub | Vía / environment | Fecha UTC |
| --- | --- | --- | --- |
| `38b60b00c6dc5b41c37472c02d2f2f081ab7ac3e` | `6043883647` | vercel[bot] / Production | 2026-08-23 03:15:46 |
| mismo SHA | `6043885207` | Cristhian-S1 / production (Actions) | 2026-08-23 03:15:59 |
| `059172a020a89023d31aef0204f7d6b0a4e688b6` | `7045011256` | vercel[bot] / Preview | 2026-10-13 17:12:27 |
| mismo SHA | `7045016707` | Cristhian-S1 / development (Actions) | 2026-10-13 17:12:43 |

La muestra de 100 registros más recientes devuelve para `6903f59…` un único deployment, `7078471822` (development, 2026-10-14 22:09:59 UTC). Su [CI 38645213522](https://github.com/Cristhian-S1/ondina-erp/actions/runs/38645213522) muestra éxito en build, migraciones y deploy. Para la producción actual `fcad2fbb631cfdb7a5626ae9b76ed4e4e9bda166` aparece `7052642877`, production; su CI push main `38484564089` fue exitoso. Esto respalda la corrección reciente, sin demostrar ausencia absoluta de publicaciones por otra credencial/proyecto.

### Vercel autenticado

No hay binario `vercel` en PATH; **sí hubo lectura MCP autenticada**. Se usaron `vercel_get_project(idOrName="ondina-erp")` y `vercel_list_deployments(projectId="prj_uOyPIotyMKPyB4zVTP7AD7cSZpp1", limit=30)`. Proyecto `ondina-erp`, account/team `team_JcZu1ij2RbokdkQuq8SYtT0g`.

La muestra confirma dos deployments READY para `059172a…`: `dpl_fKvRSbRcheu2kF3GW2C7RHSpGhuz` y `dpl_3pNNWK2KnrUTTy7iro3fTXiyH4ac`. Para `6903f59…` contiene uno, `dpl_JDFYr67GBZU5rmcRm3H1s9sh2XgD`, READY/preview; producción `fcad2fbb…` corresponde a `dpl_Bzuo9K94Kv1buw8Z9LtSFkuBkJ1f`, READY/production. Los dos históricos de Vercel comparten creador; la atribución Git/Actions proviene de los registros GitHub correlacionados, no del nombre del usuario Vercel.

El MCP entrega un resumen del proyecto sin Root Directory, reglas Git ni secretos: no se afirma haber verificado esos ajustes en el panel. Las 30 entradas no son un inventario completo ni una garantía futura.

## 2. Propuesta implementada en el repositorio

- Se conserva íntegro `frontend/vercel.json`, incluida la CSP; la clave ya era correcta. [Vercel documenta el booleano false para desactivar todos los despliegues Git](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).
- No se modifica `ci.yml`: develop automático ya tiene `needs: [build, migrations-check]` y guard canónico. `health.yml` solo se lee.
- `deploy-develop.yml` incorpora `verify`: resuelve la ref una sola vez, exige el último run de `ci.yml` por push para ese SHA en develop/main, y exporta el SHA. `deploy` depende con `needs: verify`, vuelve a comprobarlo y publica bajo development. Antes el dispatch publicaba directamente sin validación.
- `deploy-prod.yml` conserva `needs: verify` y production, y ahora exige también CI completo exitoso del mismo SHA en main antes de sus validaciones frontend. Así, una migración/check de CI fallido ya no queda fuera de la puerta de producción. Se añade `npm run size` a la verificación existente.
- Un resultado fallido/cancelado/skipped bloquea; ausencia o ejecución pendiente espera 60 consultas cada 15 segundos y falla al agotar el plazo. Un error de API también bloquea. No se acepta el éxito de un SHA distinto ni de un PR sintético. El timeout de verify de producción pasa de 20 a 35 minutos para reservar 15 a esta espera y conservar los 20 de verificación previa.
- Permiso adicional solo de lectura `actions: read` en verify; checkout sin credenciales persistentes en ambos workflows. Secretos Vercel exclusivamente en el paso de publicación. Se usa `VERCEL_TOKEN` nativo, según [guía de Vercel](https://github.com/vercel-labs/agent-skills/blob/main/skills/vercel-cli-with-tokens/SKILL.md).
- La concurrencia de desarrollo manual se alinea con `deploy-develop` de CI; la de producción sigue `deploy-prod`. Los locks se sitúan en deploy, sin bloquear verify ni provocar espera circular con CI. No cancelan una publicación en ejecución; no prometen FIFO ni deduplicación de redeploys explícitos.
- La guía inglesa documenta estos cambios y corrige las descripciones obsoletas de CSP y migraciones. Los deploys no aplican SQL; CI verifica una BD aislada, no remota.

### Coordinación con PR #87

[PR #87](https://github.com/Cristhian-S1/ondina-erp/pull/87), abierta, rama `chore/ci-hardening`, head `3ced55a93c6b2bc3c4488470ea6ed9f57047a144`, agrega `security.yml`, Gitleaks/revisión de dependencias y controles externos propuestos. Sus checks `Secret scan + self-test` y `Dependency review (runtime high)` están verdes en la lectura; no se copian ni modifican aquí. El pinning de checkout/setup-node y CLI existente se conserva.

Único solapamiento de archivos: `docs/engineering/deployment.md`. Al integrar, retener la nueva fila Security/link a security.md de #87 y la descripción de migraciones real; conservar los controles y redeploys de O4 y la CSP aplicada. No resolver el conflicto tomando un archivo completo de una sola rama. Security sigue separado de CI: la publicación automática de develop no tiene `needs` sobre Security; su protección se obtiene por PR obligatorio y checks requeridos externos. No afirmar bloqueo de cualquier vía mientras persistan pushes/admin bypass o credenciales independientes.

## 3. Diff EXTERNO propuesto — pendiente de aprobación

Este bloque expresa cambios de campos efectivos, **no comandos ejecutados**. Releer el baseline antes de aplicarlo y preservar controles ajenos. No reemplazar protecciones enteras con un payload parcial. GitHub permite [checks requeridos y PRs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) y [aprobación de environments sin bypass](https://docs.github.com/en/actions/how-tos/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments).

```diff
 branches.develop.protection:
-  required_status_checks.strict: false
+  required_status_checks.strict: true
-  required_status_checks.checks:
-    - {context: "Lint + typecheck + build + test", app_id: 15368}
-    - {context: "Validar migraciones Supabase", app_id: null}
+  required_status_checks.checks:
+    - {context: "Lint + typecheck + build + test", app_id: 15368}
+    - {context: "Validar migraciones Supabase", app_id: 15368}
+    - {context: "Secret scan + self-test", app_id: 15368}
+    - {context: "Dependency review (runtime high)", app_id: 15368}
-  enforce_admins.enabled: false
+  enforce_admins.enabled: true
-  required_pull_request_reviews: absent
+  required_pull_request_reviews:
+    required_approving_review_count: 1
+    dismiss_stale_reviews: true
+    require_code_owner_reviews: false
+    require_last_push_approval: true
-  required_conversation_resolution.enabled: false
+  required_conversation_resolution.enabled: true
 branches.main.protection:
   required_status_checks.strict: true
-  required_status_checks.checks:
-    - {context: "Lint + typecheck + build + test", app_id: 15368}
-    - {context: "Validar migraciones Supabase", app_id: null}
+  required_status_checks.checks:
+    - {context: "Lint + typecheck + build + test", app_id: 15368}
+    - {context: "Validar migraciones Supabase", app_id: 15368}
+    - {context: "Secret scan + self-test", app_id: 15368}
+    - {context: "Dependency review (runtime high)", app_id: 15368}
-  enforce_admins.enabled: false
+  enforce_admins.enabled: true
   required_pull_request_reviews.required_approving_review_count: 1
   required_pull_request_reviews.dismiss_stale_reviews: true
-  required_pull_request_reviews.require_last_push_approval: false
+  required_pull_request_reviews.require_last_push_approval: true
   required_conversation_resolution.enabled: true
```

Los arrays `contexts` deben reflejar esos mismos cuatro nombres, sin sufijos históricos `(sintaxis, no aplica)`. Conservar `allow_force_pushes.enabled=false`, `allow_deletions.enabled=false`, y demás campos vigentes en ambas ramas. Confirmar app ID `15368` en checks de #87 antes de ligar los dos nuevos contextos; solo exigirlos cuando #87 esté integrado en las dos ramas y produzca checks reales. No exigir jobs de deploy con secretos/aprobación como checks de merge. `Dependency review` corre en PR y se omite en push por diseño.

```diff
 environments.production:
-  can_admins_bypass: true
+  can_admins_bypass: false
-  required_reviewers.prevent_self_review: false
+  required_reviewers.prevent_self_review: true
   required_reviewers.reviewers:
     - {type: User, id: 131498778}  # Cristhian-S1
     - {type: User, id: 169545076}  # CRISTIAN-HC27
     - {type: User, id: 170050705}  # galletaneru
     - {type: User, id: 311951131}  # Laoch-11
   deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}
   deployment_branch_policies: [{name: main, type: branch}]
 environments.development:
-  can_admins_bypass: true
+  can_admins_bypass: false
-  deployment_branch_policy: null
+  deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}
-  deployment_branch_policies: []
+  deployment_branch_policies: [{name: develop, type: branch}, {name: main, type: branch}]
```

No se añade revisión humana al preview automático de development. Sus ramas permitidas son develop y main para dispatches desde código confiable. La regla evalúa el [GITHUB_REF del workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), no el input `ref`: la puerta de SHA en O4 es necesaria además de esa restricción.

```diff
 environments.development.actions.secrets:
+  VERCEL_TOKEN: [token de publicación preview, introducido por el responsable]
+  VERCEL_PROJECT_ID: [ID del proyecto development autorizado]
+  VERCEL_ORG_ID: [ID de su cuenta/team autorizado]
 environments.production.actions.secrets:
+  VERCEL_TOKEN: [token de publicación production, introducido por el responsable]
+  VERCEL_PROJECT_ID: [ID del proyecto production autorizado]
+  VERCEL_ORG_ID: [ID de su cuenta/team autorizado]
 repository.actions.secrets:  # retirar solo después de comprobar ambas rutas
-  VERCEL_TOKEN
-  VERCEL_PROJECT_ID
-  VERCEL_ORG_ID
```

Los textos entre corchetes son destinos/operación del responsable, no valores ni ejemplos para pegar literalmente. Seleccionar el alcance mínimo que soporte el proveedor; no se presupone que permita restringir un token al target preview. Los IDs no son credenciales, pero se conservan como secrets para compatibilidad con `secrets.*` ya usado. No rotar/revocar primero el token activo: crear y validar reemplazos, luego retirar copias y revocar lo sustituido sin afectar otros consumidores autorizados. Si ambos entornos usan el mismo proyecto, verificar separación de variables Vercel Preview/Production y permisos; no afirmar aislamiento solo por nombres GitHub.

Vercel: confirmar proyecto y Root Directory `frontend`, preservar Git desactivado en develop/main y no agregar Deploy Hooks ni una segunda vía de publicación. El resumen MCP no permite proponer un delta comprobado de Root Directory: si ya es `frontend`, **no hay cambio**; si difiere, el responsable debe revisar el proyecto correcto antes de modificarlo. Restricción/revocación de credenciales alternativas y permisos de despliegue manual requiere inventario del responsable: el repo no puede impedir un deploy hecho por otro token o por el panel.

## 4. Orden seguro de aplicación

1. Antes de fusionar: guardar snapshots de protecciones/environments y deployment servido (ID, SHA, URL, target); confirmar Root Directory, ambos destinos, revisores distintos disponibles y credenciales válidas. El sitio existente sigue servido aunque no haya una nueva publicación.
2. Crear secretos propios de environments conservando los de repositorio como respaldo; configurar aprobación de production, impedir autoaprobación/bypass y restringir ramas. Verificar que development admite develop y main. No borrar ni revocar credenciales todavía.
3. Integrar #87 y O4 mediante el flujo autorizado del coordinador; no introducir checks requeridos que aún no existan. O4 no necesita apagar Git en esta base porque ya está apagado. Si otra rama lo tiene activo, preparar primero la ruta Actions y sus secretos; fusionar la desactivación junto a la puerta, sin quitar el deployment servido.
4. Confirmar CI verde y preview de develop; llevar los workflows actualizados a main mediante release autorizada. `workflow_dispatch` requiere el archivo en la rama por defecto; [documentación GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). Confirmar CI de main verde y job production pendiente de revisión antes de aprobarlo.
5. Aplicar los checks requeridos, PR obligatorio, strict y enforce_admins en ambas ramas cuando los cuatro contextos existan; conservar prohibición de force push/borrado. Verificar lectura posterior y ensayo de rechazo con cuenta administradora. Entre integración y activación existe una ventana de controles incompletos: el responsable debe suspender pushes directos durante ella.
6. Ejecutar los ensayos siguientes, probar el uso de secretos propios de environments y retirar los de repositorio solo tras éxito en ambas rutas. Inventariar y limitar otras credenciales/hooks para sostener la vía única. Si falla Actions, conservar el sitio servido y corregir permisos/configuración; no reactivar Git como bypass automático.

## 5. Guion de ensayos — pendiente de ejecución autorizada

No se lanzaron workflows ni publicaciones durante O4. Guardar por ensayo run URL, SHA completo, jobs/conclusiones, deployment IDs/targets y horas; no secretos. Son pruebas operacionales posteriores a la integración, no capturas de UI móvil (no cambió la UI).

**A. Check fallido y rechazo de publicación.** En una rama/PR de prueba, provocar un fallo determinista y reversible de lint o test. Comprobar CI rojo, merge rechazado (también admin), sin deployment Git para ese SHA. Intentar el dispatch development desde `--ref main` con `-f ref=<SHA-rojo>`: no existe CI push válido de develop/main y debe agotar el plazo sin ejecutar deploy. Para verificar un CI push fallido sin romper main/develop, usar un repositorio/proyecto espejo aislado con las mismas reglas; allí confirmar que el deploy automático de develop queda skipped y producción falla en verify por un CI fallido del mismo SHA. No desproteger main real para fabricar el caso.

**B. Preview correcta.** Fusionar un cambio inocuo aprobado en develop con los cuatro checks de PR verdes. Verificar CI push exitoso, un único deployment nuevo para el SHA (Actions development, Vercel target preview/READY) y ausencia de vercel[bot]. Abrir la URL devuelta, verificar login y rutas SPA con datos de desarrollo, sin ventas ni escrituras; comprobar CSP en headers. Confirmar que no cambió el alias de producción. La ausencia de despliegues duplicados debe verificarse en GitHub y Vercel, no solo en el resultado del job.

**C. Approval real.** En una release autorizada a main, comprobar que verify espera el CI de ese SHA y que production permanece pendiente. El iniciador no puede autoaprobar ni el administrador omitir la revisión; un revisor distinto aprueba el SHA documentado. Registrar run, deployment, URL, target, SHA y estado READY. No ejecutar si no hay autorización de publicación real.

**D. Rollback inocuo de development.** Anotar la preview y SHA actuales, elegir un SHA anterior compatible con el esquema y con CI push exitoso conservado. Ejecutar, solo tras autorización:

```bash
gh workflow run deploy-develop.yml --ref main -f ref=<SHA-anterior-con-CI-verde>
```

Comprobar resolución/checkout del mismo SHA, CI de ese SHA, URL preview nueva y login/rutas de lectura. Restaurar el SHA inicial con el mismo comando y verificar la restauración. No cambiar SQL ni producción. Una ref no probada o con CI expirado falla cerrada; no eludir la puerta para ensayar.

**E. Redeploy inocuo de production (opcional, requiere autorización propia).** Usar `gh workflow run deploy-prod.yml --ref main -f ref=<SHA-production-actual-con-CI-verde-main>`, CI verde, aprobación distinta y comprobación del alias. Una reversión real a otro SHA requiere revisar compatibilidad con el esquema y no equivale a revertir la BD. Detener/despachar coordinadamente pushes y revisar jobs pendientes antes del rollback: la concurrencia no asegura FIFO y un deploy posterior puede sustituirlo.

## 6. Validación local y límites

- `cd frontend && npm run lint && npm run build && npm run size && npm run test -- --reporter=dot`: exit 0; 44 archivos, **529 tests PASS**. Build Vite 8.3.4 correcto; presupuesto JS/CSS/chunk en verde. Vitest emitió avisos React `act(...)` en Stock preexistente; no se modificó código frontend.
- PyYAML 6.0.3, BaseLoader: cuatro workflows parseados; todos sus scripts `run` pasan `bash -n`. `actionlint` no estaba en PATH; se descargó v1.7.12 a `/tmp/o4-actionlint`, se verificó su SHA256 con el archivo oficial de checksums y se ejecutó sobre los cuatro workflows: PASS sin exclusiones. Se corrigió SC2034 de la variable de intentos mostrando el progreso de espera.
- Shell extraído de cada nueva puerta, con gh/sleep simulados: 7 casos por workflow, **14 PASS**: éxito, fallo, cancelled, skipped, pendiente hasta timeout, ausente y error de API. No prueban el scheduler/approval remoto.
- Se inspeccionó el paquete npm exacto `vercel@63.1.2`: `dist/index.js` lee `process.env.VERCEL_TOKEN` con `tokenSource="env"`; la autenticación nativa no se presupone a partir de otra versión. No se ejecutó el CLI ni se leyó un token.
- Consulta real con el mismo filtro de la puerta: `38645213522 completed success` para `6903f59…`. Producción actual tiene CI main exitoso `38484564089`.
- CSP/vercel.json idénticos a la base; sin SQL, CI, health ni archivos de #87 editados. No se ejecutó `test:integration`, Supabase reset ni ensayo remoto.
- Los workflows suben source y Vercel reconstruye el commit validado; no promueven el mismo artefacto compilado en CI. Configuración/env remota pueden alterar el build. Se deja explícito; un cambio a prebuilt/promote requiere otro alcance y ensayo.
- La puerta comprueba el último run de CI por SHA, no Security separado ni todos los tokens/paneles. La defensa completa depende de los controles externos propuestos, integración de #87 y ensayos. Un rerun iniciado después de la consulta y las carreras entre solicitudes siguen requiriendo disciplina operativa.

Commit de workflows: `8765fb07f4b05e807b469026fc2d606ac428bf29` (`ci(deploy): require exact-commit CI before redeploy and production`). La guía y este informe se entregan en un segundo commit convencional, identificado en el worker_done.

Entrega de repositorio completa; aceptación operacional de #39 **pendiente** de aprobación/aplicación externa y ensayos. No cerrar OND-get ni #39 con esta evidencia local.
