# Contexto y objetivos de Ondina

## Problema y usuarios

Ondina distribuye agua embotellada y hielo. El levantamiento original describía ventas en papel, consolidación posterior en Excel, escasa visibilidad durante la ruta y correcciones sin trazabilidad.
El sistema lo opera el personal de la empresa desde tablets o computadores; los clientes finales no necesitan una cuenta. Las carteras pertenecen a cada vendedor y pueden compartir un sector geográfico.
Agroplan queda fuera del alcance. La referencia inicial de cuatro vendedores y crecimiento a seis debe confirmarse al validar la capacidad actual.

## Objetivo

Digitalizar el flujo producción → despacho → venta → devolución para conocer ingresos e inventario, justificar gastos y conservar registros confiables durante la operación.

- Registrar cliente, producto, cantidad y precio realmente cobrado, sin depender de la rendición en papel.
- Mantener separados stock de bodega, envases y carga del vendedor, con movimientos consistentes.
- Dar visibilidad autorizada a administración sobre ventas, producción, gastos y comisiones.
- Permitir correcciones con responsable, fecha y valores anteriores/nuevos, conservando el historial.

## Alcance por etapas

| Etapa | Intención del producto |
| --- | --- |
| Operación inicial | Ventas/clientes, producción y bodega/despacho; administración necesita visibilidad básica. |
| Ampliación | Administración completa y funcionalidades adicionales según validación del cliente. Sueldos y gastos generales no se incorporan por suposición. |

El alcance requerido no equivale al estado implementado: consultar [estado de las HU](../status/user-stories.md).

## Responsabilidades

| Rol | Responsabilidad |
| --- | --- |
| Vendedor | Registrar ventas, clientes y gastos de su cartera; consultar carga, ranking agregado y comisión propia. |
| Bodega/despacho | Despachar, registrar devoluciones/mermas y consultar inventario. |
| Producción | Registrar fabricación y eventos de producción; consultar envases, historial e indicadores. |
| Administrador | Supervisar, corregir con trazabilidad y gestionar usuarios, catálogo y parámetros dentro de la autorización de la aplicación. |

Los detalles y permisos exigidos están en [requisitos](requirements.md) y [historias por dominio](stories/README.md); esta tabla no certifica los permisos desplegados.

## Decisiones pendientes

| Tema | Qué debe ratificar el cliente/equipo |
| --- | --- |
| Pedidos | Punto de recepción central y asignación al vendedor con menor carga. |
| Precios y cupones | Reglas por cliente y representación del descuento; no fijar precios de ejemplo como valores del sistema. |
| Clientes | Tipos y datos obligatorios; informe de atendidos, nuevos y perdidos por vendedor. |
| Gastos | Comprobantes, patente y rendición por jornada; no mezclar ingresos de ventas con egresos. |
| Pago y catálogo | Efectivo/transferencia frente a referencias a tarjeta; tipos de productos y envases inconsistentes en fuentes antiguas. |
| Ajuste de despacho | RF-13 dice 10–15 minutos, el levantamiento 15–20 y RNF-15/HU-26 10–20. Mantener la ventana configurable y la suma sin edición; confirmar el valor acordado. |
| Offline y cierre | RNF-01 pide operación sin conexión, pero HU-30 fue retirada; HU-18 de cierre también fue retirada. Ratificar la entrega sin reintroducirlas automáticamente. |
| Supervisión | Confirmar si los encargados de área necesitan permisos/reportes adicionales a los cuatro roles. |

Este documento consolida el problema, objetivos y asuntos útiles del levantamiento/plan inicial. Las decisiones no resueltas pertenecen a Beads (OND-4qp); eliminar un documento redundante no las convierte en requisitos aprobados.
