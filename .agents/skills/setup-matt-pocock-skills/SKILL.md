---
name: setup-matt-pocock-skills
description: Comprobar la configuración de tracker y documentación requerida por las skills de ingeniería, preservando la instalación existente de Ondina.
disable-model-invocation: true
---
# Comprobar configuración de ingeniería
Ondina ya utiliza Beads y documentos de referencia. Este comando es una comprobación y ajuste selectivo, no una reinicialización.

1. Leer [tracker](../../../docs/agents/issue-tracker.md), [dominio](../../../docs/agents/domain.md), AGENTS.md y CLAUDE.md.
2. Ejecutar bd prime y bd stats. Conservar el Dolt existente, remoto, issues y memorias.
3. Verificar que las skills y sus referencias existan. El catálogo está en [skills](../../../docs/skills.md).
4. Proponer y aplicar solo los ajustes que la petición autorice; reutilizar la configuración ya acordada.
5. No instalar un tracker Markdown ni cambiar al tracker GitHub por detectar un remoto. No crear vocabularios de triage si no hay un flujo que los consuma.
6. Si faltan archivos, crear solo la referencia que se necesite; no reemplazar los dos archivos raíz ni sus reglas por una plantilla.
