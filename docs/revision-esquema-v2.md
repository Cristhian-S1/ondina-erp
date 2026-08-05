# Revisión Del Esquema Supabase v2

Fecha de revisión: 2026-08-04

## Alcance

Se revisó estáticamente `bd/ondina_schema_supabase_v2.sql`. No se aplicó el
archivo a Supabase ni se ejecutaron advisors remotos porque este entorno no
expuso recursos MCP de Supabase. El archivo sigue siendo una propuesta para
convertir en migraciones, no una migración desplegable.

## Hallazgos Bloqueantes

### RLS habilitado sin políticas

El archivo habilita RLS en todas las tablas del dominio, pero no declara ninguna
política. Después de aplicar el esquema, las operaciones de `anon` y
`authenticated` no tendrán acceso por defecto. Antes de conectar la aplicación se
deben definir políticas por rol y sucursal para lectura, inserción, actualización
y anulación. No se deben copiar políticas genéricas: la autorización de cada
dominio debe acordarse con el equipo.

### Automatizaciones de inventario y auditoría ausentes

Los comentarios describen reglas pendientes, pero no existen funciones, triggers o
RPC para:

- descontar `stock_bodega` y sumar `carga_vendedor` al confirmar un despacho;
- descontar la carga al confirmar una venta y recibir envases;
- actualizar existencias por producción, devoluciones y mermas;
- impedir cantidades negativas bajo concurrencia;
- calcular o validar `ventas.total` a partir de sus detalles;
- registrar cambios en `auditoria`;
- validar la ventana de `despacho_detalles.es_ajuste`.

Estas reglas no deben implementarse solamente en React. Requieren migraciones,
funciones invocables con autorización y pruebas de concurrencia/RLS.

### Storage de comprobantes no incluido

`gastos_extras.comprobante_url` guarda una URL, pero el esquema v2 no define
bucket ni políticas para `storage.objects`. La carga y lectura de comprobantes
requieren una migración de Storage con rutas por sucursal/vendedor y políticas
compatibles con RLS.

## Riesgos De Integridad A Resolver

- `carga_vendedor` permite referenciar cualquier `perfiles.id`; el rol de ese
  perfil debe restringirse a `vendedor` mediante una función/RPC o una regla de
  autorización en la base de datos.
- Los detalles de devoluciones no validan que el producto o envase haya sido parte
  del despacho ni que la cantidad devuelta no supere lo entregado. Se requiere
  una función transaccional que compruebe el saldo disponible.
- `venta_detalles` no valida que el producto esté disponible en la carga del
  vendedor. Esa comprobación pertenece a la operación transaccional de venta.
- `auditoria.registro_id` es `uuid`, pero `ubicaciones_vendedores.id` es `bigint`.
  Si las ubicaciones deben auditarse, hay que decidir si el identificador de
  auditoría será `text`, si se excluye esa tabla o si se usa una representación
  tipada distinta.
- `perfiles.sucursal_id` es obligatorio, por lo que un administrador queda
  asociado a una sola sucursal. Confirmar si administración debe operar una o
  varias sucursales antes de fijar sus políticas.
- No existe una restricción que relacione el tipo de producto con el tipo de
  envase. Confirmar si toda combinación es válida o si catálogo necesita una
  tabla de compatibilidad.

## Rendimiento Y Operación

Las claves foráneas compuestas existen donde se necesita separación por sucursal,
pero faltan índices secundarios para varios accesos por FK y consultas de
reportes. Antes de producción se deben medir las consultas reales y agregar
índices para filtros por sucursal, vendedor, cliente, fechas y estados activos.

También faltan vistas/reportes, datos iniciales de sucursales y catálogos,
procedimiento de creación de `perfiles` después de `auth.users`, y una estrategia
de migraciones versionadas. Esos elementos deben agregarse después de cerrar las
decisiones de autorización y flujo de inventario.

## Orden Recomendado Para Habilitar Desarrollo

1. Confirmar sucursales, alcance del administrador, reglas de envases y método de
   pago definitivo.
2. Crear migración de políticas RLS por rol y sucursal.
3. Crear funciones transaccionales de despacho, venta, producción, devolución y
   merma, con locks y validación de saldos.
4. Crear triggers de auditoría y resolver el tipo de identificador auditado.
5. Agregar Storage, semillas mínimas e índices medidos.
6. Probar cada operación con usuarios de cada rol y casos de concurrencia antes
   de que los módulos construyan sus pantallas finales.

## Conclusión

El modelo contiene una base útil para repartir el trabajo por módulos, pero no
debe tratarse como contrato operativo final hasta resolver RLS, movimientos de
stock, auditoría, Storage y las decisiones de integridad indicadas arriba.
