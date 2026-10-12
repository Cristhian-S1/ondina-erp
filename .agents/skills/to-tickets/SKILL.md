---
name: to-tickets
description: Dividir una especificación o plan en tareas verificables y sus dependencias dentro del tracker configurado.
disable-model-invocation: true
---
# De especificación a tareas
Leer [tracker](../../../docs/agents/issue-tracker.md). Ondina usa Beads como seguimiento duradero y external_ref para su enlace a GitHub.

1. Leer la especificación y revisar las tareas existentes para evitar duplicados.
2. Dividir en entregables que puedan verificarse por comportamiento, preferentemente cortes verticales. Para un cambio transversal, usar expandir, migrar y retirar cuando mantenga compatibilidad.
3. Cada tarea describe problema, alcance, propiedad de archivos, restricciones, aceptación y validación.
4. Añadir solo dependencias reales mediante bd dep add. Identificar qué tareas pueden avanzar juntas sin compartir escritura.
5. Si la petición ya autoriza el desglose, crear las tareas en Beads; preguntar solo por decisiones de alcance no resueltas.
6. Publicar o actualizar GitHub cuando esté autorizado y conservar sus enlaces. No crear .scratch/issues ni archivos Markdown como tracker alternativo.
7. No cerrar el padre por haber creado los tickets.

Para supervisión, el coordinador crea Tasks de Orca que referencian los IDs de Beads. Un Dispatch es un intento, no otra tarea de producto. Ver [orquestación](../../../docs/orquestacion/README.md).
