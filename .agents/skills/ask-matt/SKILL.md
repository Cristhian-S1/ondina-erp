---
name: ask-matt
description: Elegir entre las skills instaladas en Ondina según el trabajo solicitado.
---

# Elegir una skill en Ondina

Comprueba el catálogo de la sesión y las skills locales antes de recomendar un nombre. Los comandos de otros asistentes no implican que exista una skill equivalente instalada.

- Seguimiento de tareas y dependencias: `beads`. Ondina usa bd, no tickets Markdown ni un tracker adicional.
- Aclarar requisitos de un cambio: `grill-with-docs`; vocabulario y decisiones de dominio: `domain-modeling`.
- Especificación de un cambio grande: `to-spec`; cortes implementables y dependencias en bd: `to-tickets`.
- Arquitectura: `codebase-design` e `improve-codebase-architecture` cuando haya evidencia de fricción.
- Incertidumbre que exige ejecutar algo: `prototype`, dentro del alcance autorizado.
- Base de datos: `supabase` y `supabase-postgres-best-practices`.
- React: `vercel-react-best-practices`.
- Cambio de sesión: `handoff`, enlazando issues y artefactos existentes.

Si se necesitan flujos de depuración, pruebas o revisión, usa las skills de Superpowers que aparezcan realmente en el catálogo. Para documentación técnica actual usa Context7 y fuentes oficiales mediante Tavily si están conectados. No inventes `/grilling`, `/implement`, `/triage` o `/research`, ni ejecutes instalaciones como precondición automática.

AGENTS.md define las fuentes de verdad y el flujo del repositorio; lee CodeGraph antes de explorar código indexado. Elige solo las skills que aporten al objetivo del usuario.
