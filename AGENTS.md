# Guía para agentes de Ondina

## Contexto y referencias

Ondina es una aplicación React + Vite + TypeScript en `frontend/`, con Supabase como backend. La base de integración es `develop`.

Lee `README.md` al empezar. Consulta solo los documentos necesarios para el trabajo:
- `docs/desarrollo.md`: flujo Git, calidad y comandos.
- `docs/convenciones-frontend.md`: UI y convenciones del frontend.
- `docs/base-de-datos.md`: esquema, migraciones e invariantes.
- `docs/estado-historias-usuario.md`: alcance e implementación de las HU.
- `docs/herramientas-agentes.md` y `.beads/README.md`: herramientas y seguimiento.

Las auditorías de `docs/auditorias/` son evidencia histórica fechada. Verifica los estados que puedan haber cambiado.

## Trabajo y herramientas

- Usa Beads para tareas, dependencias y contexto persistente del proyecto. Ejecuta `bd prime` al recuperar contexto; usa `bd stats` para el resumen.
- Si existe `.codegraph/`, usa CodeGraph antes de localizar o entender código. Si no existe, continúa con las herramientas normales sin inicializarlo.
- Aplica las skills relevantes de `.agents/skills/`. Conserva esa fuente compartida; evita copias divergentes.
- Consulta Mem0 en el ámbito de usuario y proyecto correcto, cuando esté disponible. Las instrucciones y credenciales personales pertenecen a la configuración local.
- Si el usuario pide orquestación, lee `docs/orquestacion/README.md`; usa el runtime de Orca y respeta la selección de modelos pendiente.
- Registra hallazgos nuevos y validaciones en Beads. Cierra una tarea solo cuando sus criterios estén cumplidos.

## Invariantes

- TypeScript estricto; usa `import type` para tipos. Los mensajes de interfaz van en español.
- La lógica de cada dominio vive en `frontend/src/domains/<dominio>/`. Los componentes de presentación usan servicios; no acceden directamente a Supabase.
- La autorización debe existir en la base de datos. Ocultar opciones en la UI no reemplaza RLS.
- El stock y las anulaciones se gestionan mediante reglas de la base de datos; conserva la trazabilidad.
- No ejecutar `supabase db push` contra producción hasta reconciliar esquema e historial en un entorno aislado.
- No guardar credenciales en el repositorio ni contraseñas en tablas de la aplicación.

## Verificación y entrega

- Para cambios de frontend, ejecuta `npm run lint` y `npm run build` en `frontend/`; ejecuta las pruebas pertinentes al cambio.
- Comprueba los scripts y configuraciones que modifiques y los enlaces de la documentación.
- Revisa `git status` y el diff antes de entregar. Explica qué cambió, su validación y los límites de lo comprobado.
- Conserva stashes, ramas y archivos de otras sesiones. Limpia únicamente los artefactos propios que ya no hagan falta.
- Publica commits, ramas o cambios externos cuando la solicitud o autorización del usuario abarque esa publicación. Una petición de plan no autoriza su ejecución.
