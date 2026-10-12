# Claude Code y OpenCode como clientes de Orca

## Separar tres niveles
Orca mantiene workspaces, ejecución, mensajes y ciclo de vida. Claude Code y OpenCode son clientes agentes distintos. El proveedor/modelo se elige para el cliente que ejecuta cada rol.
Claude puede ser coordinador y OpenCode ejecutar los workers. Esto no significa que OpenCode sea un modelo de Claude ni que compartir carpeta transfiera sus MCP, OAuth o memoria.
Los subagentes nativos de Claude/OpenCode son otra capacidad. Si se pide supervisión Orca, usar Run/Task/Dispatch de Orca y conservar su autoridad; no reemplazarlos por delegación nativa no registrada.

## Modelos pendientes
Cada rol declara client y model en perfiles.example.json. Los modelos siguen en null por decisión del usuario.
Comprobar los modelos reales disponibles en el cliente y host antes de pasar un override. El ID aceptado puede depender del proveedor; no validar por el nombre comercial únicamente.
Orca admite --model en un nuevo terminal Claude. --effort requiere un modelo que lo soporte.
Para OpenCode, la guía instalada permite --model solo en un worktree existente y cuando el host valida versión y disponibilidad. Un worktree nuevo con ese override no está soportado y OpenCode no admite --effort.
Comparar launch.requested con launch.effective. Una intención en los argumentos no prueba el modelo efectivo. No crear un segundo agente ni reenviar una tarea para corregir incertidumbre sin seguir la recuperación.

## Instrucciones y skills
Claude carga CLAUDE.md, que importa AGENTS.md. Las reglas por ruta están en .claude/rules/ y las skills en .claude/skills/ enlazan a .agents/skills/.
OpenCode conserva su configuración del repo y sus plugins. Consultar las [instrucciones de reglas](https://opencode.ai/docs/rules/) y [skills](https://opencode.ai/docs/skills/) de la versión correspondiente; comprobar lo cargado en su sesión.
El campo `disable-model-invocation` pertenece a Claude; no tratarlo como una garantía equivalente en OpenCode. Verificar las opciones de metadatos y permisos que admite la versión instalada, y dejar en la spec del worker qué flujos requieren una solicitud explícita. El diagnóstico `opencode --pure debug skill` permite comprobar el catálogo sin cargar plugins externos.
Las memorias Mem0 y los MCP se configuran por cliente. Beads conserva contexto compartido independientemente del cliente; CodeGraph tiene CLI utilizable aunque no se configure su MCP.

## Permisos y setup
Las credenciales y preferencias personales permanecen fuera de Git. Cada worker recibe el entorno y acceso mínimo de su tarea, sin heredar autorización para otros sistemas por tener un terminal.
Los workers consultan al coordinador mediante el comando ask del preámbulo de Orca. Conservar Task, Dispatch, executable y handle exactos; no inventar identidades a partir del rol o del nombre de la rama.
El coordinador verifica resultado, pruebas, límites de acceso y diff antes de integrar. Un modelo caro o una skill instalada no reemplazan esa evidencia.

## Fuentes
- Guías versionadas obtenidas con orca-ide skills get orchestration y su referencia coordinator-loop.
- [Claude: memoria y reglas](https://code.claude.com/docs/en/memory).
- [OpenCode: agentes](https://opencode.ai/docs/agents/).
