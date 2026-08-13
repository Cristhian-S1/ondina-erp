# Ondina - Rama `feature/produccion`

Esta rama queda reservada para el módulo de **Producción**. Contiene
intencionalmente solo este README; la aplicación, la base de datos, la
configuración de OpenCode y las skills de trabajo se consultan desde `develop`.

## Alcance Del Módulo

- Registro de producción de agua e hielo.
- Ingreso de producto terminado a las existencias.
- Registro y seguimiento de incidencias de planta.
- Coordinación con bodega para disponibilidad de productos.

## Flujo De Trabajo

1. Actualiza tu rama desde `develop`.
2. Implementa una HU de producción sin duplicar la aplicación ni crear carpetas
   permanentes por módulo.
3. Coordina con `feature/bodega` cualquier cambio en stock o despacho.
4. Agrega pruebas y abre un Pull Request hacia `develop`.

Consulta el README de `develop` para la instalación inicial de Ubuntu, React,
Vite, Supabase, OpenCode, CodeGraph, Beads, Mem0 y MCPs.

## Historias de Usuario Implementadas

### HU-19 — Consultar envases vacíos disponibles
Permite al encargado de Producción consultar los envases retornables disponibles
en su sucursal.

- Consulta de stock de envases por sucursal.
- Visualización por tipo de envase.
- Actualización automática mediante Supabase Realtime.
- Actualización manual disponible.
- Acceso protegido mediante RLS.

### HU-20 — Registrar producción
Permite registrar la producción de agua e hielo.

- Registro de producto y cantidad.
- Fecha, hora, sucursal y responsable asignados automáticamente.
- El stock de bodega aumenta automáticamente.
- Los envases retornables se descuentan cuando corresponde.
- La operación de producción y stock se procesa de forma atómica en PostgreSQL.
- Una producción no puede ser modificada ni eliminada por el rol Producción.
- Los cambios se reflejan mediante Supabase Realtime.

### HU-21 — Consultar historial de producción
Permite consultar las producciones registradas anteriormente.

- Filtro por producto.
- Filtro por rango de fechas.
- Registros ordenados desde el más reciente.
- Vista de solo lectura para Producción.

### HU-22 — Visualizar indicadores de producción
Permite visualizar métricas calculadas desde los registros de producción.

- Total de unidades producidas.
- Cantidad de registros.
- Totales agrupados por producto.
- Filtros por período.
- Actualización automática al registrarse nueva producción.

### HU-23 — Registrar incidencias
Permite registrar problemas u observaciones ocurridas durante la jornada.

- Descripción obligatoria.
- Asociación opcional con una producción.
- Fecha, hora y responsable automáticos.
- Registro visible posteriormente en el módulo.
- Integración con auditoría y Realtime.
