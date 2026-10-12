# Skills de Ondina

La fuente compartida es .agents/skills/. Claude accede por los enlaces relativos .claude/skills/. Las skills no son contexto que deba importarse completo: elegir las que resuelvan la tarea.
La revisión [del 12-10-2026](auditorias/2026-10-12/skills-del-proyecto.md) cubrió las quince originales y documenta nueve adaptaciones y cuatro incorporaciones.

## Núcleo técnico
- beads: seguimiento y contexto duradero; no reimportar exports ni reinicializar.
- supabase: documentación, Auth, RLS y servicios Supabase; el entorno de escritura se confirma antes de actuar.
- supabase-postgres-best-practices: esquema, consultas, índices, concurrencia y autorización PostgreSQL.
- vercel-react-best-practices: rendimiento React, bundles y renderizado; adaptar sus recetas al stack Vite/TanStack existente.
- codebase-design: interfaces y profundidad de módulos cuando se diseña/refactoriza.
- domain-modeling: términos y decisiones de dominio, sin convertir el glosario en tracker.
- testing-strategy: pruebas según riesgos y capa, con integración real para RLS/stock.
- code-review: revisión por evidencia de seguridad, rendimiento y corrección.

## Flujos opcionales
ask-matt orienta entre las skills realmente instaladas. grill-with-docs aclara decisiones; prototype responde una duda con código desechable; handoff conserva referencias para otra sesión; improve-codebase-architecture evalúa refactors.
to-spec y to-tickets convierten decisiones en especificación y tareas Beads, respetando la autorización de publicación. setup-matt-pocock-skills comprueba configuración existente; no inicializa otro tracker.
find-skills sirve cuando falta una capacidad. Evaluar compatibilidad, fuente, mantenimiento, licencia y evidencia; popularidad no demuestra que una skill sea adecuada.
En Claude, las skills que incluyen `disable-model-invocation: true` se invocan explícitamente. No asumir que OpenCode aplique ese campo de Claude: comprobar su configuración de skills y permisos al preparar cada worker.

## Orca
orca-cli gestiona worktrees y terminales. orchestration supervisa workers, preguntas, intentos y cierre.
Los entrypoints resuelven el binario y obtienen su manual versionado. Para utilizarlos en Ondina, comenzar por [orquestación](orquestacion/README.md).

## Validación y mantenimiento
Comprobar frontmatter, referencias, alcance y dependencias antes de actualizar. Evitar instalar lotes de skills por keywords o copiar versiones nuevas sin revisar su diff.
Las incorporaciones de testing/code-review se adaptaron de las skills engineering 1.2.0 instaladas. Las de Supabase y Vercel conservan sus metadatos y referencias oficiales; las de Orca conservan sus stubs originales.
No se declara que este catálogo sea el mejor universal ni que todos sus recorridos estén certificados en cada proveedor: se evaluó su adecuación al stack y a las herramientas comprobadas de Ondina.
El diagnóstico local `opencode --pure debug skill` descubrió las 19 skills del proyecto el 12-10-2026. Esta comprobación no carga plugins externos ni acredita sus conexiones MCP o la selección automática de skills en una sesión de LLM.
