# Producción

Criterios del producto; consultar [requisitos](../requirements.md) y [estado de implementación](../../status/user-stories.md) sin confundirlos con validación de producción.

## HU-19

**Consultar envases vacíos disponibles** · RF-06 · Producción

Como encargado de producción, quiero conocer la cantidad de envases vacíos disponibles, para planificar la producción de agua según la capacidad real de envasado.

**Aceptación:**

- Dado un usuario de producción autenticado, cuando accede a envases vacíos, entonces el sistema muestra la cantidad disponible actualizada.
- La cantidad se actualiza automáticamente con cada devolución de envases registrada y con cada registro de producción.

## HU-20

**Registrar producción** · RF-07 · Producción

Como encargado de producción, quiero registrar la producción de agua y hielo (incluyendo cada descarga de hielo de ~50 unidades), para que el stock de bodega aumente automáticamente y la administración vea en tiempo real cuánto se produce.

**Aceptación:**

- Dado un usuario de producción autenticado, cuando registra una producción indicando producto y cantidad (o una descarga de hielo), entonces el sistema suma automáticamente esas unidades al stock de bodega.
- Cada registro almacena fecha, hora y usuario responsable (RNF-11, RNF-12).
- La producción registrada se refleja en tiempo real para el administrador (RNF-03).
- El registro no puede ser modificado ni eliminado por producción una vez ingresado; solo el administrador puede corregirlo (RNF-10, RNF-14).

## HU-21

**Consultar historial de producción** · RF-08 · Producción

Como encargado de producción, quiero revisar los registros históricos de producción, para verificar lo fabricado en jornadas anteriores.

**Aceptación:**

- Dado un usuario de producción autenticado, cuando accede al historial y filtra por fecha o producto, entonces el sistema muestra los registros de producción ordenados cronológicamente.
- El historial es de solo lectura para el rol producción (RNF-10).

## HU-22

**Visualizar indicadores de producción** · RF-09 · Producción

Como encargado de producción, quiero visualizar indicadores y reportes de producción, para evaluar el rendimiento de la fabricación y anticipar necesidades.

**Aceptación:**

- Dado un usuario de producción autenticado, cuando accede a los indicadores, entonces el sistema muestra métricas de producción (totales por periodo y por producto) calculadas a partir de los registros.
- Los indicadores se actualizan con cada nuevo registro de producción (RNF-03).

## HU-23

**Registrar incidencias** · RF-10 · Producción

Como encargado de producción, quiero registrar observaciones, problemas o incidencias ocurridas durante la producción, para dejar constancia de los eventos que afectan la fabricación o el stock.

**Aceptación:**

- Dado un usuario de producción autenticado, cuando ingresa la descripción de la incidencia y confirma, entonces el sistema la registra con fecha, hora y responsable (RNF-11, RNF-12).
- Las incidencias quedan asociadas a la jornada de producción y son visibles para el administrador.
