# Reorganización de develop y preparación de Claude Code — Implementation Plan

> Para la ejecución: usar la skill superpowers:executing-plans y realizar el trabajo en este checkout, sin delegación. Este documento especifica cambios y verificaciones; el seguimiento de su ejecución pertenece a Beads.
> Estado: aprobado por el usuario el 12-10-2026 y ampliado con revisión de skills y documentación de orquestación. El seguimiento de la ejecución y su evidencia está en Beads OND-k2t.

**Objetivo:** trabajar sobre develop, conservar selectivamente la documentación solicitada de la auditoría, concentrar sus Markdown y reducir el contexto permanente de los agentes sin perder las herramientas existentes.

**Arquitectura:** develop será la fuente del código y de las skills. README resumirá el producto y su estado; AGENTS contendrá invariantes comunes; CLAUDE importará AGENTS y utilizará reglas por ruta. Los procedimientos extensos vivirán en docs y los datos personales o generados seguirán fuera del Git normal.

**Stack:** Git, Markdown, Claude Code, Beads con Dolt embebido, CodeGraph, Mem0, React/Vite/TypeScript y Supabase.

**Especificación:** petición del usuario del 12-10-2026 y decisión explícita de mover el handoff Kimi a docs/auditorias/2026-10-09/ como antecedente histórico.

## Evidencia comprobada al preparar el plan

- Rama actual: codex/auditoria-integral-beads, commit cb6f35923e91d497bab9f3a1be75d3e18a34c594.
- origin/develop: 38b60b00c6dc5b41c37472c02d2f2f081ab7ac3e, consultado tras git fetch origin.
- Los 25 archivos que difieren entre ambas ramas no se integrarán en bloque: se seleccionan las fuentes indicadas abajo.
- README de develop: 521 líneas y una afirmación obsoleta de que no existen frontend, migraciones ni pruebas.
- AGENTS de develop: 133 líneas; mezcla instrucciones, historial, estado de módulos y dos bloques de Beads.
- En develop se versionan issues.jsonl, interactions.jsonl y metadata.json de Beads; su documentación propone incluso un estado done que no corresponde al flujo comprobado.
- Beads local: 66 issues, 45 abiertos, 21 cerrados y cuatro memorias persistentes. El remoto Dolt está publicado por refs/dolt/data.
- CodeGraph: índice existente y actualizado de 97 archivos; sus datos locales están ignorados.
- Mem0: búsqueda de lectura exitosa en el ámbito cristhian; existe memoria del proyecto con app_id Cristhian-S1-ondina-erp.
- Claude Code instalado: 2.1.296. No se encontraron servidores MCP configurados en su ámbito de usuario ni en el ámbito local de este proyecto.
- Ya existe .claude/settings.json con hooks de bd prime para SessionStart y PreCompact. No hay .mcp.json compartido.
- Se conservan tres stashes existentes.
- develop contiene 15 archivos de pruebas y 10 migraciones locales. El lockfile exige para Vite ^20.19.0 || >=22.12.0; el README propuesto recomienda Node 22.12 o posterior.
- No se han repetido las pruebas de frontend ni la verificación remota de producción durante esta planificación.

## Restricciones globales

1. Partir de origin/develop actualizado; usar sus versiones de frontend, bd, supabase, workflows, skills y documentación no seleccionada.
2. No fusionar ni hacer cherry-pick de los dos commits completos de auditoría.
3. Partir de las skills de develop y aplicar solo las adaptaciones justificadas por la revisión adicional solicitada. La exposición a Claude será mediante enlaces relativos a una única fuente. Consultar docs/auditorias/2026-10-12/skills-del-proyecto.md para las decisiones por skill.
4. Borrar docs/handoffs y docs/evidencias-auditoria-2026-10-09 del árbol de trabajo resultante, después de conservar el Markdown Kimi.
5. No reinicializar Beads, importar exports antiguos, borrar la base Dolt ni eliminar memorias.
6. No ejecutar migraciones contra Supabase ni publicar la aplicación en Vercel como parte de este cambio.
7. Conservar los stashes y las ramas ajenas al trabajo.
8. La ejecución, publicación en develop y borrado de la rama cuentan con la confirmación del usuario del 12-10-2026. Los modelos y la puesta en marcha de una flota Orca quedan reservados para una decisión futura.
9. Mantener el hallazgo y la fecha de los informes; los cambios de archivado solo aclaran procedencia y corrigen enlaces.
10. Mantener la autorización antes de operaciones externas en la guía común; retirar el mandato de publicar incluso durante una petición de plan.

## Foco de revisión

- Un checkout puede activar hooks de Beads y reimportar datos heredados: transición sin hooks y configuración corregida antes de ejecutar bd.
- Ignorar archivos ya versionados no los desversiona: retirar del índice únicamente exports/metadatos heredados, conservando el Dolt real.
- Borrar una rama puede dejar sin referencia el commit que enlazan los issues: crear primero una etiqueta de archivo.
- Un handoff histórico puede reactivar reglas o HU obsoletas: incluir una advertencia de antecedente y no importarlo en los agentes.
- Mover informes y borrar capturas puede romper enlaces: comprobar las referencias de toda la documentación afectada.
- Las conexiones de Codex/OpenCode no son conexiones de Claude: informar y verificar cada cliente por separado, sin trasladar credenciales a Git.

## Mapa de archivos

### Fuentes seleccionadas y destinos

| Fuente | Versión de origen | Destino |
| --- | --- | --- |
| docs/archivo/auditoria-inicial-2026-10-09.md | Rama de auditoría | docs/auditorias/2026-10-09/auditoria-inicial-2026-10-09.md |
| docs/auditoria-integral-2026-10-09.md | Rama de auditoría | docs/auditorias/2026-10-09/auditoria-integral-2026-10-09.md |
| docs/estado-historias-usuario.md | Rama de auditoría | Misma ruta; actualizar enlace a la auditoría archivada |
| docs/setup-vercel-supabase-github.md | Rama de auditoría | Misma ruta; actualizar enlace a la auditoría archivada |
| scripts/bootstrap-beads.sh | Rama de auditoría | Misma ruta; validar y conservar su comportamiento recuperable |
| docs/handoffs/kimi-k3-frontend-ventas.md | develop, porque fue retirado en la rama de auditoría | docs/auditorias/2026-10-09/kimi-k3-frontend-ventas.md |
| docs/contexto-sesion-auditoria.md | develop; no trasladar sus cambios desde la rama de auditoría | docs/auditorias/2026-10-09/contexto-sesion-auditoria.md, rotulado como antecedente de agosto |

Los seis archivos solicitados están incluidos en las primeras seis filas. La séptima organiza un documento de auditoría ya presente en develop, cumpliendo la concentración de esos Markdown. El resto de los documentos no seleccionados conserva su contenido de develop, salvo enlaces afectados por los movimientos.

### Documentación breve y procedimientos

- Reescribir README.md: 77 líneas en el borrador, con propósito, estado por etapas, stack, arranque local, calidad, estructura y enlaces.
- Reescribir AGENTS.md: 39 líneas en el borrador, con contexto, fuentes, Beads/CodeGraph, invariantes y validaciones.
- Crear CLAUDE.md: 11 líneas en el borrador; importar únicamente AGENTS.md y enlazar procedimientos que se leen cuando se necesitan.
- Crear docs/desarrollo.md: comandos, convenciones Git, revisiones, pruebas y criterios de entrega extraídos y corregidos.
- Crear docs/base-de-datos.md: separar SQL de diseño, migraciones y esquema desplegado; documentar invariantes y procedimiento aislado.
- Crear docs/herramientas-agentes.md: uso por cliente de Beads, CodeGraph, Mem0 y Claude Code; configuración común frente a personal.
- Conservar docs/convenciones-frontend.md como fuente de la UI; no duplicar su contenido completo.

### Configuración y reglas

- Ajustar .gitignore y .beads/.gitignore.
- Actualizar .beads/config.yaml y .beads/README.md para la recuperación real y export pasivo.
- Conservar los hooks útiles de .claude/settings.json, revisar portabilidad y evitar duplicar bd prime.
- Crear .claude/rules/frontend.md: paths frontend/src/**; tipos, dominios, servicios y convenciones de UI.
- Crear .claude/rules/supabase.md: paths bd/** y supabase/**; migraciones, autorización y reglas de integridad.
- Crear .claude/rules/documentacion.md: paths docs/** y los Markdown raíz; evidencia fechada, referencias y coherencia.
- Crear .claude/rules/ci-cd.md: paths .github/** y frontend/vercel.json; calidad y despliegue.
- Crear .claude/rules/herramientas.md: paths .beads/**, scripts/bootstrap-beads.sh y configuración MCP; datos locales, recuperación y ámbitos.
- Crear enlaces relativos bajo .claude/skills/ para beads, supabase, supabase-postgres-best-practices, vercel-react-best-practices, codebase-design y domain-modeling, apuntando a las skills de develop en .agents/skills.
- .mcp.json será solo configuración realmente compartida, sin claves ni rutas absolutas personales. La habilitación de Mem0 en Claude requiere una conexión específica; se documentará y comprobará con las credenciales locales disponibles. Si faltan, quedará explícito, sin presentar el conector como funcional.
- No crear agentes especializados, hooks nuevos o un directorio tests vacío solo para completar una plantilla. Se añadirán cuando exista una necesidad concreta.

## Propuesta de estructura

Rutas relativas a /home/cristhian/Documents/ondina:

~~~text
README.md
AGENTS.md
CLAUDE.md
.gitignore
.mcp.json                         # solo si hay configuración compartida real
.agents/skills/                   # fuente de develop
.claude/
  settings.json
  settings.local.json             # personal e ignorado, si se utiliza
  rules/
    frontend.md
    supabase.md
    documentacion.md
    ci-cd.md
    herramientas.md
  skills/                         # enlaces a la fuente compartida
.beads/
  README.md
  config.yaml
  .gitignore
  embeddeddolt/                    # local e ignorado
docs/
  desarrollo.md
  base-de-datos.md
  herramientas-agentes.md
  estado-historias-usuario.md
  setup-vercel-supabase-github.md
  auditorias/2026-10-09/
    auditoria-inicial-2026-10-09.md
    auditoria-integral-2026-10-09.md
    contexto-sesion-auditoria.md
    kimi-k3-frontend-ventas.md
frontend/                         # aplicación y pruebas existentes
supabase/
bd/
scripts/bootstrap-beads.sh
~~~

## Paso 1 — Respaldo y transición a develop

**Produce:** develop como base de trabajo, preservando datos y contexto anteriores.

1. Repetir fetch y comprobar git status, la rama y los commits disponibles. Conservar este plan local.
2. Registrar los tres stashes y la configuración de hooks. Sincronizar Dolt con bd dolt pull usando la configuración funcional actual y tomar el inventario actualizado de issues y memorias antes del respaldo; conservar cualquier trabajo remoto legítimo que haya aparecido desde esta propuesta.
3. Respaldar la base Dolt y los archivos locales de herramientas en .local-backups/; comprobar que el respaldo es legible.
4. Crear la etiqueta de archivo archivo/auditoria-integral-2026-10-09 en cb6f35923e91d497bab9f3a1be75d3e18a34c594. Publicarla con la confirmación de este plan para conservar los enlaces históricos que usan ese SHA.
5. Guardar las versiones seleccionadas mediante git show antes de modificar o eliminar ramas.
6. Cambiar a develop con los hooks Git desactivados solo para esa operación: git -c core.hooksPath=/dev/null switch develop.
7. Actualizar develop al remoto mediante avance simple. Si apareció trabajo local o remoto inesperado, conservarlo y revisar antes de continuar; no usar reset destructivo.
8. Antes de ejecutar bd, corregir configuración y exports heredados según el paso 2.

**Resultado verificable:** el código y las skills provienen de develop; el respaldo y la etiqueta apuntan al commit de auditoría; los stashes no cambian.

## Paso 2 — Preservar Beads y corregir exclusiones

**Archivos:** .gitignore, .beads/.gitignore, .beads/config.yaml y .beads/README.md.

1. Mantener repos.primary igual a "." y el remoto Dolt correcto.
2. Mantener import.auto: false, export.auto: true y export.git-add: false en el formato que utiliza la versión instalada.
3. Desversionar issues.jsonl, interactions.jsonl y metadata.json heredados; no borrar embeddeddolt ni importar el JSONL de develop.
4. Documentar que git push publica commits y bd dolt push publica la base de tareas; no son el mismo flujo.
5. Ignorar configuración personal, entornos, caches, builds, .codegraph, bases locales y respaldos. Conservar configuraciones compartidas, plantillas, hooks y skills como archivos versionables.
6. Corregir ejemplos obsoletos, incluidos bd statistics y el estado done.
7. Validar con bd stats --json, bd memories, bd lint y bd orphans. Comparar con el inventario previo y comprobar que los enlaces de GitHub siguen presentes.

**Resultado verificable:** siguen disponibles todos los issues y memorias del inventario actualizado del paso 1, que al preparar el plan era de 66 issues y cuatro memorias. Cualquier tarea nueva de ejecución queda identificada. Los metadatos/export no vuelven a incorporarse al Git normal.

## Paso 3 — Trasladar documentación seleccionada

**Consume:** fuentes del mapa de archivos, capturadas antes del cambio de rama.

1. Crear docs/auditorias/2026-10-09/ y trasladar allí los informes y antecedentes enumerados.
2. Conservar íntegro el cuerpo del handoff Kimi y añadir una nota de antecedente histórico de agosto; no usarlo como instrucciones vigentes.
3. Retirar docs/handoffs y docs/evidencias-auditoria-2026-10-09 del árbol resultante.
4. Sustituir la imagen embebida del informe por una nota descriptiva de la evidencia histórica; evitar un enlace relativo roto.
5. Actualizar las referencias en informes, estado de HU, setup, documentación de Beads y otros documentos que apuntan a los nombres movidos.
6. Conservar fechas y hallazgos históricos. En el informe, distinguir el archivado de octubre 12 de las verificaciones de octubre 9.

**Resultado verificable:** los cuatro Markdown históricos están juntos, las carpetas solicitadas están ausentes del árbol y los enlaces internos afectados resuelven.

## Paso 4 — Reescribir README y AGENTS

**Consume:** los borradores adjuntos y las convenciones de develop.

1. Aplicar el README breve y contrastar su estado por etapas con los archivos existentes y la auditoría fechada.
2. Trasladar procedimientos a docs/desarrollo.md, docs/base-de-datos.md y docs/herramientas-agentes.md, corrigiendo el contenido contradictorio antes de conservarlo.
3. Aplicar AGENTS breve y mantener únicamente reglas comunes, comandos esenciales y referencias selectivas.
4. Retirar historial de fixes, tamaños de bundle, inventarios SQL extensos, duplicados de Beads y obligaciones de limpiar trabajo ajeno.
5. Mantener la fecha del inventario de HU y evitar presentar resultados de agosto u octubre 9 como comprobados hoy.

**Resultado verificable:** README no afirma que el repositorio carece de aplicación; AGENTS no repite procedimientos ni contiene instrucciones incompatibles con una petición de plan.

## Paso 5 — Preparar Claude Code

**Archivos:** CLAUDE.md, .claude/settings.json, .claude/rules/ y .claude/skills/.

1. Añadir CLAUDE.md con @AGENTS.md. En la versión comprobada, la presencia de CLAUDE requiere esta carga explícita de las instrucciones comunes.
2. Añadir reglas con frontmatter paths y referencias a los procedimientos correspondientes. Evitar importar todas las guías al inicio.
3. Crear y verificar los seis enlaces relativos a las skills originales de develop.
4. Revisar los hooks existentes de bd prime sin añadir permisos generales ni duplicar los hooks de Git.
5. Documentar que CodeGraph y Beads también funcionan mediante CLI. Separar la conexión Mem0 de Codex/OpenCode de una futura conexión de Claude.
6. Comprobar los archivos cargados en una sesión de Claude con /context y los servidores con /mcp. Si falta autenticación o un servidor, registrar el límite real; no copiar tokens a archivos versionados.
7. Sincronizar el índice existente de CodeGraph tras el cambio de rama con codegraph sync y comprobar codegraph status, conservando su versión instalada y sin reinicializar el proyecto.

**Resultado verificable:** Claude carga una guía común breve y las reglas pertinentes; las skills no tienen enlaces rotos ni copias divergentes; las conexiones se describen por su estado real.

## Paso 6 — Validación, publicación y retirada de la rama

1. Registrar el trabajo de ejecución en Beads vinculado a OND-4qp y, cuando corresponda, OND-aeo. Esta reorganización no cierra por sí sola el issue #56, que también necesita decisiones de negocio y revisión funcional.
2. Revisar el diff contra origin/develop y confirmar que frontend, SQL, workflows y configuración OpenCode no cambiaron. Los cambios de skills deben corresponder a la revisión documentada: nueve adaptaciones de las quince originales y cuatro incorporaciones.
3. Validar JSON, frontmatter de reglas, referencias Markdown, enlaces de skills y sintaxis de bootstrap con bash -n.
4. Probar bootstrap en un clon aislado, recuperando el remoto Dolt sin reinicialización ni importación vieja. Comparar tareas y memorias con el inventario acordado.
5. Ejecutar lint y build existentes y registrar resultados; ejecutar pruebas de frontend si se detecta cualquier cambio que pueda afectar su comportamiento. No crear pruebas que solo comprueben texto del README.
6. Revisar exclusiones con git check-ignore: los datos y secretos locales se ignoran; las plantillas, reglas y configuraciones compartidas no.
7. Crear commits revisables en español, por ejemplo docs(repo): reorganizar auditorías y guías del proyecto y chore(agentes): preparar Claude Code y preservar herramientas.
8. Publicar develop y comprobar que el remoto contiene los commits. Sincronizar Beads si se modificaron sus tareas.
9. Verificar que la etiqueta conserva el commit histórico y borrar codex/auditoria-integral-beads tanto local como remotamente. Su eliminación local podrá requerir -D porque no se integran todos sus commits; el respaldo y las fuentes seleccionadas deben estar comprobados antes.
10. Terminar en develop, con los commits publicados, las herramientas verificadas y los stashes conservados.

## Borradores disponibles para revisión

- /tmp/ondina-propuesta-develop-2026-10-12/README.propuesto.md
- /tmp/ondina-propuesta-develop-2026-10-12/AGENTS.propuesto.md
- /tmp/ondina-propuesta-develop-2026-10-12/CLAUDE.propuesto.md
- /tmp/ondina-propuesta-develop-2026-10-12/gitignore.propuesto

Los enlaces de esos borradores utilizan las rutas finales propuestas y se validarán contra el árbol resultante.

## Fuentes técnicas consultadas

- https://code.claude.com/docs/en/memory — instrucciones, importación de AGENTS y reglas por ruta.
- https://code.claude.com/docs/en/settings — configuración compartida y personal.
- https://code.claude.com/docs/en/skills — skills del proyecto y enlaces simbólicos.
- https://code.claude.com/docs/en/mcp — ámbitos de MCP y variables de entorno.
- https://docs.mem0.ai/platform/quickstart — autenticación y ámbitos de memoria.
- CLI local y archivos de Git de Ondina, consultados sin trasladar credenciales.

## Autorización y ampliación

El usuario pidió: “Proponme el plan y yo te confirmo para subir los cambios a la rama develop”.
El usuario confirmó la propuesta y pidió ejecutarla. Añadió la revisión de todas las skills y una sección de orquestación con Orca, Claude Code y OpenCode, roles y cantidades; elegirá los modelos más adelante.

La ampliación produce docs/orquestacion/, perfiles.example.json deshabilitado y sin modelos, docs/skills.md y una revisión fechada. No inicia workers ni modifica la instalación global de agentes o skills.
