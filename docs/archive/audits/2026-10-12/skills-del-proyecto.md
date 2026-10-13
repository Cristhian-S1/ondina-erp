# Revisión de skills de Ondina — 12-10-2026

## Método y límites
Se leyó cada SKILL.md de las quince skills de develop, se comprobaron referencias locales y se contrastó el núcleo Supabase/React con fuentes oficiales. Se evaluó compatibilidad con Beads, CodeGraph, Claude Code, OpenCode y la petición de supervisión Orca.
Se privilegió adecuación, instrucciones ejecutables, permisos, mantenimiento y contexto necesario. Installs/stars no se usaron como prueba de calidad.
Esta revisión documental y de estructura no certifica todos los comportamientos de todas las skills mediante ejecuciones de LLM ni modifica el código funcional del ERP.

## Decisiones por skill original
| Skill | Decisión | Evidencia y adaptación |
| --- | --- | --- |
| ask-matt | Adaptar | El router referenciaba varias skills no instaladas. Ahora enumera el catálogo real y el tracker existente. |
| beads | Conservar | Coincide con bd instalado y el seguimiento duradero. |
| codebase-design | Conservar | Diseño modular útil; aplicar su vocabulario cuando se diseñe, sin renombrar el dominio por preferencia terminológica. |
| domain-modeling | Conservar | Útil para jornada, carga, envases y comisiones; glosario y ADR se crean cuando hay una decisión. |
| find-skills | Adaptar | Sustituir estrellas/installs como prueba de calidad y evitar instalación global por defecto. |
| grill-with-docs | Adaptar | Invocaba /grilling, que no está instalada. El flujo queda autocontenido y usa domain-modeling disponible. |
| handoff | Conservar | Usa el directorio temporal y referencias, compatible con retirar docs/handoffs. |
| improve-codebase-architecture | Adaptar | Usar CodeGraph primero y delegación disponible/autorizada; reemplazar /grilling por el flujo instalado. |
| prototype | Conservar | Adecuada para una duda exploratoria; no confundir su código desechable con el entregable de producción. |
| setup-matt-pocock-skills | Adaptar | Beads ya existe; se convierte en comprobación idempotente y evita tracker Markdown o una reinicialización. |
| supabase-postgres-best-practices | Conservar | Referencia oficial para PostgreSQL/RLS/índices y concurrencia. |
| supabase | Adaptar alcance | Ejemplos de iteración SQL solo sobre el entorno aislado confirmado; no sobre un remoto enlazado por defecto. |
| to-spec | Adaptar | Usar contexto aprobado y tracker Beads; evitar publicación GitHub implícita o specs infladas. |
| to-tickets | Adaptar | Dependencias nativas Beads; eliminar el tracker local .scratch/issues y duplicación de tareas. |
| vercel-react-best-practices | Adaptar alcance | Ondina usa React/Vite y TanStack; no incorporar Next.js/RSC/SWR por una receta de la guía. |

## Incorporaciones
- testing-strategy: adaptación del recurso engineering 1.2.0 instalado, con riesgos frontend y SQL real.
- code-review: adaptación del recurso engineering 1.2.0 instalado; se elimina CONNECTORS.md inexistente y se explicitan conexiones disponibles.
- orca-cli y orchestration: stubs instalados copiados sin cambios. La guía completa se obtiene del binario utilizado para cada sesión, evitando mantener una copia estática que diverja.

## Capas de aplicación
Supabase/Vercel son referencias generales, las reglas de Ondina establecen el stack y entorno permitido, y los roles asignan propiedad y aceptación.
Las skills de entrevista, especificación y setup conservan su política de invocación explícita para Claude. No asumir que el campo `disable-model-invocation` controle la selección en OpenCode: sus metadatos y permisos se comprueban por cliente. No lanzar subagentes por una mención de un área ni activar una flota con modelos null.
El catálogo final tiene 19 skills. Su uso en Claude se comparte mediante enlaces a una única fuente.
Se comprobó YAML y campos reconocidos por Claude. El validador local de skill-creator usa un esquema más limitado: rechaza disable-model-invocation y argument-hint, que Claude admite. Se conservaron esos campos y se verificó el esquema común de las 19 skills mediante copias temporales normalizadas, sin modificar su política de invocación.
El inventario real de `opencode --pure debug skill` encontró las 19 skills locales sin duplicar sus nombres. La cuenta de Claude estaba autenticada. No se ejecutaron workers ni pruebas de selección automática de skills con un LLM; tampoco se verificaron `/context` y `/mcp` en una sesión interactiva de Claude. No hay servidores MCP de proyecto configurados para ese cliente.

## Fuentes
- [Supabase Agent Skills](https://supabase.com/docs/guides/ai-tools/ai-skills).
- [Vercel Agent Skills](https://vercel.com/docs/agent-resources/skills).
- [Claude: skills](https://code.claude.com/docs/en/skills) y [memoria/reglas](https://code.claude.com/docs/en/memory).
- [OpenCode: agentes](https://opencode.ai/docs/agents/) y [skills, metadatos y permisos](https://opencode.ai/docs/skills/).
- Guías locales de orca-ide obtenidas con skills get orca-cli, skills get orchestration y coordinator-loop; flags contrastados con worker-start --help.
