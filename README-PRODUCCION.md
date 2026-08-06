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
