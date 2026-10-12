# Herramientas de trabajo para agentes

## Instrucciones y clientes
AGENTS.md contiene reglas comunes y CLAUDE.md las importa. Las reglas .claude/rules/ se cargan por rutas; las skills .claude/skills/ enlazan a .agents/skills/.
Las configuraciones de Codex, Claude Code y OpenCode son independientes. Una integración disponible en un cliente no acredita disponibilidad en otro.

## Beads
El seguimiento duradero vive en Beads. Leer [.beads/README](../.beads/README.md), ejecutar bd prime y usar bd ready, bd show, bd update --claim, bd stats y bd close.
La base local está en .beads/embeddeddolt/; su sincronización es bd dolt pull/push mediante refs/dolt/data. git push por sí solo no publica esos registros.
import.auto queda desactivado y export.git-add es false. issues.jsonl es export pasivo local. No reinicializar la base existente ni reimportar un export de otra rama.
La restauración comienza con scripts/bootstrap-beads.sh. Mantener repos.primary igual a "." y preservar el remoto acordado.
GitHub sirve para revisión y asignación del equipo. Mantener external_ref y actualizar los estados deliberadamente; no crear una segunda lista Markdown de tareas.
Orca Run/Task/Dispatch registra intentos de ejecución; su Task no sustituye al issue de Beads. Asociar cada intento con el ID de Beads y su enlace GitHub cuando exista.

## CodeGraph
Si existe .codegraph/, explorar código antes de buscarlo manualmente: codegraph explore "símbolo o pregunta". Usar MCP cuando el cliente lo tenga configurado.
codegraph sync actualiza el índice existente y codegraph status muestra su estado. No inicializar ni actualizar versiones por el solo hecho de entrar al proyecto.
El índice local y su runtime no se versionan. Una consulta estructural no reemplaza compilación o pruebas.

## Mem0
Mem0 guarda memorias en el servicio del conector o en el backend configurado por el cliente; no se conserva copiando AGENTS o ignorando una carpeta.
Usar el usuario correcto y el ámbito de aplicación del proyecto para evitar mezclar memorias. No trasladar claves ni conversaciones completas a Git.
En la revisión del 12-10-2026, la búsqueda del conector de Codex respondió y OpenCode conserva @mem0/opencode-plugin. No se encontraron MCP de Mem0 en la configuración local de Claude; ese acceso debe configurarse y verificarse por separado.
Las instrucciones persistentes del proyecto viven en docs y Beads; Mem0 puede complementar la recuperación de contexto, sin sustituirlos.

## Configuración compartida y personal
Versionar .claude/settings.json, reglas, skills, hooks portables y las plantillas de entorno. Ignorar .claude/settings.local.json, CLAUDE.local.md, variables de entorno y datos generados.
.mcp.json se añade solo para MCP compartidos reales; usar referencias de variables de entorno y permisos adecuados. OAuth y claves permanecen en la configuración personal de cada cliente.
Verificar en Claude /context y /mcp. Los hooks existentes de SessionStart y PreCompact ejecutan bd prime; comprobar que bd esté instalado antes de usar el cliente.

## Orca y modelos
La [sección de orquestación](orquestacion/README.md) documenta resolución de CLI, roles, modelos pendientes, límites y el ciclo de workers.
El [catálogo de skills](skills.md) identifica cuáles se cargan por tarea y qué adaptaciones son específicas de Ondina.
