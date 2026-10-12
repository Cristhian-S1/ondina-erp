# Base de datos y migraciones

## Tres fuentes distintas
bd/ contiene SQL de diseño y objetos de negocio. supabase/migrations/ contiene diez migraciones versionadas. El esquema remoto y su historial son un tercer estado que debe comprobarse.
La [auditoría del 09-10-2026](auditorias/2026-10-09/auditoria-integral-2026-10-09.md) encontró divergencias; no ejecutar supabase db push contra producción hasta reconciliarlas en un entorno aislado.

## Invariantes del dominio
Supabase Auth administra las credenciales y perfiles.id referencia auth.users.id. No guardar contraseñas en tablas de la aplicación.
RLS, grants y autorización en funciones deben coincidir con identidad, rol, perfil activo y sucursal. El menú del frontend no constituye autorización.
Los triggers mantienen stock_bodega, stock_envases y carga_vendedor. Una anulación debe compensar movimientos una sola vez y conservar su auditoría. No trasladar esa lógica al frontend.
Los precios de venta históricos no se recalculan desde el catálogo. El comportamiento histórico de las comisiones requiere corregir y validar sus reglas.
Los ajustes de despacho agregan filas dentro de la ventana configurada; no editan ni restan líneas históricas.
Auditoría, reversión de stock, vistas y aislamiento tienen hallazgos pendientes. Estas son reglas exigidas por el proyecto, no una afirmación de que el despliegue ya las cumple.

## Trabajar sobre PostgreSQL/Supabase
Leer las skills supabase y supabase-postgres-best-practices antes de diseñar o cambiar SQL. Confirmar el proyecto y el entorno antes de cualquier consulta que escriba datos.
Reproducir el esquema y las migraciones en local o staging aislado. Validar SQL real, permisos por rol, otra sucursal, anonimato, concurrencia y efectos de anulación.
Descubrir comandos de la versión instalada mediante --help. Generar y revisar migraciones según el flujo del repositorio; la CLI y sus opciones pueden cambiar.
No aplicar comandos de iteración ad hoc a un proyecto remoto simplemente porque un conector lo tiene enlazado.
El responsable de backend integra las migraciones en serie y fija su orden; dos workers no migran el mismo entorno a la vez.

## Procedimientos y decisiones
[Setup de Vercel/Supabase/GitHub](setup-vercel-supabase-github.md) conserva pasos manuales, sujetos a reconciliación.
El backlog de [GitHub](https://github.com/Cristhian-S1/ondina-erp/issues) y Beads contiene las correcciones de seguridad, integridad y reconstrucción. Este cambio documental no aplica esas correcciones a producción.
