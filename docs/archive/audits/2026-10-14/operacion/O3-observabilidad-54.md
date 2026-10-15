# O3 — Observabilidad de bajo costo (#54 / OND-5a4)

Fecha de ejecución y entrega: **2026-10-15**, America/Santiago. El directorio `2026-10-14` se conserva por la ruta pedida en el despacho.

**Resultado: parte del repositorio implementada y verificada localmente.** La aceptación operativa completa de #54 sigue pendiente de configuración externa y recepción real de una alerta; no se ejecutó nada contra los proyectos remotos GitHub, Supabase o Vercel.

## Alcance y rama

- Rama: `chore/observabilidad`; base y referencia local `origin/develop`: `6903f59e66bcd49c1c14b20fbfe57271b0c7a353`.
- No se consultó el remoto ni se hizo fetch por la restricción del despacho; no había avance en la referencia local que requiriera rebase. Esto no certifica el HEAD actual del servidor.
- Se retomó `O3-WIP.md`; se reprodujo el rojo por módulo faltante y por el ID corto del boundary. El commit WIP `db97d5b` se rehízo, con autorización del despacho, como `8b279f0` (`feat(observability): correlate sanitized frontend errors`).
- Workflow: `afe9763` (`ci(health): add read-only auth and database synthetic check`). El tercer commit contiene runbook, enlaces, este informe y capturas.
- Sólo commits locales. Sin push, PR, merges, cuentas nuevas, cambios de secretos, SQL/migraciones, `db reset`, configuración remota ni cambios en `.opencode/`.

## Cambios

`frontend/src/lib/observabilidad.ts` genera UUID, versión de build, modo Vite y clasificación de operación/error. La salida usa una lista cerrada: no serializa mensajes, stack, nombres personalizados, causas, variables de mutación ni contexto libre. El depurador descarta todos los escalares y nombres originales de campos, incluso contraseñas opacas y datos financieros sin patrón, y limita profundidad/entradas. La consola es el destino predeterminado; el adaptador opcional requiere registro explícito **y** `VITE_ERROR_DSN`, recibe únicamente el evento inmutable y contiene sus propios fallos. No hay SDK, transporte externo ni dependencia nueva.

El `ErrorBoundary` muestra el mismo ID del evento. `main.tsx` registra `MutationCache.onError`; `App.tsx` muestra una referencia persistente y cerrable en español, conserva la pantalla y no reemplaza los callbacks de error del dominio. La correlación es del error frontend con versión/entorno/ID; no añade cabeceras de traza ni instrumentación al servidor/RPC.

`health.yml` conserva los chequeos de frontend y Auth health y añade password grant + `GET /rest/v1/productos?select=id&limit=1`. Las credenciales entran sólo por `env`; tokens y cuerpos no se imprimen ni se escriben a disco. El cliente rechaza redirecciones con credenciales, limita respuestas a 64 KiB y usa timeout de 30 s por solicitud. Un catálogo vacío falla para no confundir RLS sin filas visibles con lectura útil. El login crea una sesión Auth; no hay escrituras de negocio ni ventas. Sin secretos, se omite con `::notice` y no falla el job. `simular_fallo` fuerza el incidente y el siguiente éxito cierra la incidencia; las omisiones permanecen explícitas y no prueban disponibilidad de sondas omitidas. La concurrencia del job serializa los cambios de incidencia.

`docs/engineering/observability.md`, en inglés y enlazado desde ambos índices requeridos, documenta umbrales, respuesta, responsable pendiente, retención propuesta/real, exclusiones, coste incremental 0, comparación de planes gratuitos y configuración externa. Se corrigió una descripción antigua en `deployment.md`: el `vercel.json` de esta base **ya declara CSP aplicada**, no report-only. No se modificó ese archivo ni `connect-src`; cualquier colector nuevo requiere propuesta/revisión separada.

## Criterios de #54 → evidencia

| Criterio | Evidencia local | Estado y límite |
| --- | --- | --- |
| Disponibilidad y recorrido Auth/API sin ventas reales | `.github/workflows/health.yml:36` y `:78`; ensayo del bloque exacto contra `http://127.0.0.1:54321` con la cuenta UX vendedor | PASS local: Auth HTTP 200 y BD HTTP 200, una fila visible; cuenta de monitoreo real de sólo lectura aún no creada. |
| Error frontend/RPC relacionado con versión, entorno e ID | `frontend/src/lib/observabilidad.ts:43`, `:73`; `frontend/src/main.tsx:18`; `frontend/src/components/ErrorBoundary.tsx:14`; `frontend/src/App.tsx:17` | PASS en boundary y callback real de TanStack Query. La referencia no es una traza backend. |
| Sin tokens, contraseñas, RUT, teléfonos, correos ni montos | `frontend/src/lib/observabilidad.test.ts:7`, `:25`, `:36`, `:50`, `:112`; `frontend/src/lib/observabilidad-ui.test.tsx:12` | PASS con valores de formato real, secretos opacos, JWT, objetos cíclicos y getters; ningún dato libre entra al evento. |
| Alerta de prueba, diagnóstico y recuperación | `health.yml:13`, `:161`, `:184`, `:192`; mismos bloques shell ejecutados con `curl`/`gh` locales simulados | PASS del contrato local: abre, falla el run, comenta y cierra. **Recepción real de notificación no ensayada** por prohibición remota. |
| Umbrales, responsable, retención y coste | `docs/engineering/observability.md` | Documentado; responsable `decide el responsable`, retención de logs propuesta 14 días (no aplicada), issues según política GitHub, consola sin persistencia de la app. Coste incremental de suscripciones 0. |
| ID visible y controles accesibles en teléfono/tablet/escritorio | Pruebas boundary/UI y seis PNG enlazados abajo | PASS 375/768/1280 × 900, sin desbordamiento; foco y activación con teclado. Capturas de fixture local controlado. |
| YAML / actionlint | Parseo con PyYAML 6.0.3, `shellcheck --shell=bash` sobre los cinco bloques `run`, revisión de expresiones/env | YAML y shellcheck PASS. **actionlint no disponible** en PATH ni ubicaciones locales comprobadas; no se presenta como ejecutado. No se añadió ninguna action. |
| Gates frontend | `npm run lint`, `npm run build`, `npm run size`, `npm run test`, desde `frontend/` | Todos PASS; 46 archivos, **538 pruebas**. No se ejecutó `test:integration` según instrucción. |

## Ensayos locales

Se extrajo `jobs.health.steps[id=synthetic].run` mediante PyYAML y se ejecutó directamente con `bash -e -c`, las variables públicas de `frontend/.env.local`, las credenciales UX proporcionadas y archivos temporales de `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY`. Antes de enviar credenciales se comprobó que la URL fuera loopback local. No se copió la clave ni la contraseña al informe.

| Escenario | Resultado observado |
| --- | --- |
| Supabase local, cuenta `ux-vendedor@example.invalid` | `failures=`; `status=ok`; Auth password grant HTTP 200; BD HTTP 200, una fila visible, sólo `id`. |
| Secretos ausentes | `::notice::MONITOR_EMAIL/MONITOR_PASSWORD absent; synthetic Auth/DB check skipped.`; `status=skipped`; `failures=`; exit 0. |
| Contraseña local incorrecta | `failures=Sintético Auth (400)`; `status=failed`; BD no ejecutada; sin cuerpo de error ni token. |
| Servidor HTTP local que devuelve token opaco y BD 403 | `status=failed`, clasificación BD; salida sin token ni email del cuerpo simulado. |
| Servidor HTTP local que devuelve BD 302 | Fallo BD, sin seguir `Location` ni reenviar credenciales. |
| Simulación y recuperación con `gh`/`curl` simulados | `simulación controlada` → `issue create` → exit 1 → siguiente éxito → `issue comment` + `issue close`; ningún `gh` remoto. |

Las dos pruebas HTTP simuladas verificaron exactamente `POST /auth/v1/token?grant_type=password` y `GET /rest/v1/productos?select=id&limit=1`, sin más solicitudes. Los resultados locales y los mocks no demuestran RLS de sólo lectura de una identidad productiva ni entrega de notificaciones.

Reproducción del bloque sintético con credenciales **locales** suministradas en el entorno (no ejecutar pasos `gh` con credenciales reales):

```python
import os, subprocess, tempfile, yaml
from pathlib import Path

workflow = yaml.safe_load(Path('.github/workflows/health.yml').read_text())
script = next(step['run'] for step in workflow['jobs']['health']['steps']
              if step.get('id') == 'synthetic')
# Supply SUPABASE_URL, SUPABASE_ANON_KEY, MONITOR_EMAIL, MONITOR_PASSWORD
# through the environment using the isolated local project only.
assert os.environ['SUPABASE_URL'] == 'http://127.0.0.1:54321'
with tempfile.TemporaryDirectory(prefix='o3-local-') as directory:
    environment = dict(os.environ, RUNNER_TEMP=directory,
                       GITHUB_OUTPUT=directory + '/output',
                       GITHUB_STEP_SUMMARY=directory + '/summary')
    subprocess.run(['bash', '-e', '-c', script], env=environment, check=True)
    print(Path(directory + '/output').read_text())
    print(Path(directory + '/summary').read_text())
```

## Verificación frontend

Ejecución completa del 2026-10-15:

```text
npm run lint   PASS
npm run build  PASS (TypeScript + Vite)
npm run size   PASS
npm run test   PASS — 46 archivos, 538 pruebas, 14.24 s
```

Presupuesto: JS entrada gzip **107649 B / 117979 B**; CSS entrada gzip **45808 B / 50330 B**; chunk JS máximo **342979 B / 375855 B**. Sin cambios de presupuesto ni lockfile. Las once pruebas focalizadas incluyen ocho del depurador/reporte/cache, dos del boundary y una del aviso persistente.

## Evidencia visual

Fixture temporal con los componentes reales `App`/`ErrorBoundary`, contexto Auth local simulado y fallo deliberado de `MutationObserver`; sin llamadas de mutación a Supabase. Navegación local con Chrome headless y Playwright. El fixture y servidor se retiraron al terminar y no se incluyen en el producto.

| Vista | 375 × 900 | 768 × 900 | 1280 × 900 |
| --- | --- | --- | --- |
| Referencia de mutación | [PNG](../frontend-movil/capturas/O3/mutacion-375x900-despues.png) | [PNG](../frontend-movil/capturas/O3/mutacion-768x900-despues.png) | [PNG](../frontend-movil/capturas/O3/mutacion-1280x900-despues.png) |
| ErrorBoundary | [PNG](../frontend-movil/capturas/O3/boundary-375x900-despues.png) | [PNG](../frontend-movil/capturas/O3/boundary-768x900-despues.png) | [PNG](../frontend-movil/capturas/O3/boundary-1280x900-despues.png) |

Se comprobó código UUID visible, ausencia del texto privado de prueba, cero `pageerror`, ningún log con datos privados, `scrollWidth <= innerWidth` y foco del botón en los seis escenarios. `Cerrar aviso` se activó con Enter y retiró el aviso. No se tomó una matriz antes/después del código antiguo; son capturas posteriores del fallo controlado, no evidencia de navegación autenticada o de una caída productiva.

## Pendiente externo y entrega

El responsable debe crear/verificar una cuenta **efectivamente de sólo lectura** (no reutilizar un vendedor), resolver por separado cualquier necesidad de rol/perfil/RLS, configurar secretos/variables y etiqueta/notificaciones, integrar el workflow en la rama por defecto y autorizar el ensayo de alerta real. Las políticas actuales y una simple etiqueta de perfil no bastan para certificar esa identidad; no se modificaron aquí. El DSN y el colector son opcionales y permanecen desactivados; se propone comparar Sentry Developer y BugSnag Free en el runbook antes de elegir.

Beads OND-5a4 permanece en progreso por estos criterios operativos pendientes; el despacho O3 de implementación local sí queda terminado. `actionlint` queda por ejecutar donde esté instalado; YAML/shellcheck y los ensayos descritos sí se ejecutaron. No se atribuye recepción real de alerta, cumplimiento productivo de sólo lectura, retención aplicada, ni disponibilidad de un remoto a esta entrega.
