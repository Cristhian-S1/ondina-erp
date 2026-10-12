---
name: ask-matt
description: Orientar al usuario entre las skills instaladas para especificación, diseño, implementación, revisión u orquestación de Ondina.
disable-model-invocation: true
---
# Elegir una skill
Usar este router cuando el usuario lo invoque. Elegir el flujo más corto que resuelva la petición y respetar decisiones y autorizaciones ya dadas.

| Necesidad | Entrada disponible |
| --- | --- |
| Tareas, dependencias y recuperación | beads |
| Aclarar un diseño con el usuario | grill-with-docs y domain-modeling |
| Diseñar interfaces o refactorizar | codebase-design e improve-codebase-architecture |
| Resolver una duda con un experimento | prototype |
| Especificación a partir de contexto acordado | to-spec |
| Dividir una especificación en tareas | to-tickets y beads |
| Estrategia de pruebas | testing-strategy |
| Revisar un diff o PR | code-review |
| Supabase, Auth y consultas | supabase y supabase-postgres-best-practices |
| Rendimiento React/Vite | vercel-react-best-practices |
| Handoff de contexto | handoff |
| Worktrees y terminales Orca | orca-cli |
| Supervisión de workers en Orca | orchestration |
| Descubrir una capacidad adicional | find-skills |

Consultar [catálogo](../../../docs/skills.md) y [tracker](../../../docs/agents/issue-tracker.md).
Si falta una capacidad, describirla sin invocar comandos de skills no instaladas. No ejecutar un setup por defecto en un proyecto ya configurado.
