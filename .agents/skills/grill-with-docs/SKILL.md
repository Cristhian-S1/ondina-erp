---
name: grill-with-docs
description: Aclarar un diseño o requisito mediante preguntas y conservar las decisiones aprobadas en el lenguaje de dominio y documentación.
disable-model-invocation: true
---
# Aclarar un diseño
Leer las decisiones existentes y aplicar domain-modeling cuando haya términos ambiguos. No depende de una skill /grilling adicional.
Identificar los supuestos que realmente cambian el diseño; preguntar de uno en uno solo cuando el contexto no los resuelva.
Explorar código con CodeGraph cuando esté indexado. Contrastar el requisito con el comportamiento y exponer las diferencias.
Registrar términos y decisiones aprobados según [dominio](../../../docs/agents/domain.md). Los pendientes se siguen en Beads.
Si el usuario ya aprobó el diseño y pide ejecución, continuar con ese alcance; no reiniciar una entrevista.
En una ejecución supervisada de Orca, las dudas bloqueantes van al coordinador mediante el preámbulo del Dispatch.
