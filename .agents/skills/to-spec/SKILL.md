---
name: to-spec
description: Sintetizar una especificación a partir de requisitos y decisiones ya discutidos, y vincularla al tracker de proyecto.
disable-model-invocation: true
---
# De conversación a especificación
Trabajar con el contexto y las decisiones existentes. Leer [tracker](../../../docs/agents/issue-tracker.md) y aplicar domain-modeling cuando haga falta.
Explorar con CodeGraph si falta evidencia del código. No reabrir una entrevista que el usuario ya resolvió.
Escribir problema, resultado esperado, historias pertinentes, decisiones, interfaces afectadas, restricciones, criterios de aceptación observables y validación. Incluir las rutas comprobadas cuando ayuden al implementador.
Distinguir decisiones pendientes de requisitos aprobados. No inventar funcionalidades ni considerar producción validada por tener pantallas.
Conservar una especificación proporcionada al tamaño del cambio y enlazarla desde Beads; una spec no es otra lista de seguimiento.
Publicar en GitHub solo cuando la petición o autorización existente lo cubra. Si ya hay un issue, actualizar o vincular antes de duplicarlo.
