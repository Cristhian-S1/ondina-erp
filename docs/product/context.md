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

## Decisiones ratificadas

Decididas el 2026-10-13 y actualizadas el 2026-10-25 por la coordinación en nombre del product owner, que delegó la elección («elige las mejores prácticas»); una decisión nueva puede revertirlas.

| Tema | Decisión | Fecha | Referencia |
| --- | --- | --- | --- |
| Descuento de venta | Un monto en CLP por venta, ≥ 0 y nunca mayor que la suma de las líneas; para la comisión se prorratea por línea según su subtotal. Los cupones con reglas por cliente quedan fuera del alcance actual y requerirían una historia nueva. | 2026-10-13 | [HU-01](stories/sales.md#hu-01) |
| Comisión | Cada venta usa la regla vigente en el instante de la venta (`vigente_desde ≤ venta < vigente_hasta`); cambiar o crear reglas nunca reescribe resultados pasados. Las reglas de un mismo tipo de producto no se solapan y el porcentaje está entre 0 y 100. La base es el monto neto de la línea después del descuento prorrateado, la misma del ranking. | 2026-10-13 | [HU-08](stories/sales.md#hu-08), [HU-09](stories/sales.md#hu-09), [#34](https://github.com/Cristhian-S1/ondina-erp/issues/34) |
| Jornada | El día y el mes de negocio se calculan según America/Santiago en vistas, reportes y "hoy". | 2026-10-13 | [#35](https://github.com/Cristhian-S1/ondina-erp/issues/35) |
| Incidencias y mermas | Una incidencia es descriptiva y no mueve stock; una merma es una pérdida cuantificada que descuenta stock. Producción ofrece ambas por separado. | 2026-10-13 | [HU-23](stories/production.md#hu-23), [#70](https://github.com/Cristhian-S1/ondina-erp/issues/70) |
| Ventana de ajuste de despacho | Configurable, 15 minutos por defecto (el cliente sugirió entre 10 y 20; la base de datos acepta minutos enteros entre 5 y 60 en `ventana_ajuste_minutos` de `configuracion`); el servidor la aplica siempre y los ajustes solo suman cantidades. | 2026-10-25 | [HU-26](stories/warehouse.md#hu-26), [RF-13](requirements.md), [RNF-15](requirements.md) |
| Reintentos | Cada envío de venta, despacho o devolución lleva una clave de idempotencia; un reintento no duplica el registro. | 2026-10-13 | [RNF-01](requirements.md), [#42](https://github.com/Cristhian-S1/ondina-erp/issues/42) |
| Offline y cierre | RNF-01 se acota a conectividad intermitente y la captura offline completa queda fuera de alcance; HU-18 (cierre diario) permanece retirada desde el 2026-08-01. No reintroducir ninguna de las dos sin una historia nueva. | 2026-10-13 | [RNF-01](requirements.md), HU-18, HU-30 |

## Decisiones pendientes

| Tema | Qué debe ratificar el cliente/equipo |
| --- | --- |
| Pedidos | Punto de recepción central y asignación al vendedor con menor carga. |
| Cupones por cliente | Definir si se agregan reglas de descuento por cliente; fuera del alcance actual, requerirían una historia nueva. |
| Clientes | Tipos y datos obligatorios; informe de atendidos, nuevos y perdidos por vendedor. |
| Gastos | Comprobantes, patente y rendición por jornada; no mezclar ingresos de ventas con egresos. |
| Pago y catálogo | Efectivo/transferencia frente a referencias a tarjeta; tipos de productos y envases inconsistentes en fuentes antiguas. |
| Supervisión | Confirmar si los encargados de área necesitan permisos/reportes adicionales a los cuatro roles. |

Este documento consolida el problema, objetivos y asuntos útiles del levantamiento/plan inicial. Las decisiones ratificadas quedan registradas arriba, reversibles solo con una decisión nueva; las no resueltas pertenecen a Beads (OND-4qp); eliminar un documento redundante no las convierte en requisitos aprobados.
