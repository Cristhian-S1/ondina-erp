## **2\. Requerimientos Funcionales**

Definen las funciones específicas y capacidades operativas que el sistema de estacionamiento debe proveer:

## **Vendedor**

| ID Requerimiento | Descripción del Requerimiento Funcional (RF)   |
| :---- | :---- |
| **RF-01 Registrar ventas**  | El sistema deberá permitir registrar una venta asociándose a un vendedor y a un cliente, permitiendo ingresar los productos vendidos, cantidades, método de pago, observaciones, cupones (descuentos),  y precios unitarios.  |
| **RF-02 Registrar cliente**  | El sistema deberá permitir que vendedores y administradores registren nuevos clientes. |
| **RF-17 Consultar carga** | El vendedor deberá poder consultar los productos y cantidades asignados a su ruta.  |
| **RF-18 Consultar clientes de la ruta** | El vendedor deberá poder visualizar los clientes asociados a su ruta.  |
| **RF-19 Consultar bidones vacíos**  | El vendedor deberá poder consultar la cantidad de bidones vacíos registrados durante su ruta.  |
| **RF-21 Registrar gasto extra**  | El vendedor deberá poder registrar gastos adicionales efectuados durante la jornada, permitiendo adjuntar foto o documento respaldando el gasto.  |
| **RF-22 Visualizar ranking de vendedores**  | El sistema deberá generar un ranking de vendedores de acuerdo con sus ventas o desempeño.  |
| **RF-26 Visualizar comisión** | El sistema deberá calcular automáticamente y mostrar las comisiones correspondientes a cada vendedor durante la jornada. |

## **Administrador**

| ID Requerimiento | Descripción del Requerimiento Funcional (RF)   |
| :---- | :---- |
| **RF-02 Registrar cliente**  | El sistema deberá permitir que vendedores y administradores registren nuevos clientes. |
| **RF-03  Gestionar Usuarios** | El administrador deberá poder crear, modificar, habilitar y deshabilitar usuarios.  |
| **RF-05 Identificar clientes inactivos**  | El sistema deberá generar alertas sobre clientes que no hayan realizado compras durante un periodo determinado.  |
| **RF-23 Modificar registros**  | El administrador deberá poder corregir registros ingresados por otros usuarios, dejando trazabilidad de la modificación.  |
| **RF-24 Visualizar reportes de ventas**  | El administrador deberá poder consultar reportes generales y detallados de ventas de acuerdo a ciertos parámetros.  |
| **RF-25 Configurar comisiones**  | El administrador deberá poder definir porcentajes, montos y reglas utilizadas para calcular las comisiones.  |
| **RF-27 Monitorear vendedores**  | El administrador deberá poder visualizar la ubicación de los vendedores durante la jornada mediante GPS.  |
| **RF-28 Gestionar catálogo de productos**  | El administrador deberá poder mantener un catálogo único de productos, tipos de bidones, agua y hielo.  |

## 

## **Produccion**

| ID Requerimiento | Descripción del Requerimiento Funcional (RF)   |
| :---- | :---- |
| **RF-6 Consultar envases vacíos**  | El sistema deberá mostrar la cantidad de envases vacíos disponibles para producción.  |
| **RF-7 Registrar producción**  | El sistema deberá permitir registrar la producción de agua y hielo, aumentando automáticamente el stock.  |
| **RF-8 Consultar historial de producción**  | El sistema deberá permitir revisar los registros históricos de producción.  |
| **RF-9 Visualizar indicadores de producción** | El sistema deberá generar indicadores y reportes relacionados con la producción.  |
| **RF-10 Registrar incidencias** | El sistema deberá permitir registrar observaciones, problemas o incidencias ocurridas durante la producción.  |

**Despachador**

| ID Requerimiento | Descripción del Requerimiento Funcional (RF)   |
| :---- | :---- |
| **RF-11 Consultar stock**  | El sistema deberá mostrar el stock disponible de productos y envases.  |
| **RF-12 Registrar despacho**  | El sistema deberá permitir al despachador registrar los productos entregados a cada vendedor al comenzar su ruta.  |
| **RF-13  Modificar despacho**  | El sistema deberá permitir modificar productos del despacho durante los primeros 10 a 15 minutos posteriores al registro. |
| **RF-14 Registrar devolución de productos**   | El sistema deberá permitir registrar los productos **no** vendidos que el vendedor devuelve al finalizar la ruta.  |
| **RF-15 Registrar devolución de envases**  | El sistema deberá permitir registrar los envases vacíos devueltos por cada vendedor.  |
| **RF-16 Registrar mermas** | El sistema deberá permitir registrar productos dañados, perdidos o no aptos para la venta.  |

**Requerimientos**

| ID Requerimiento | Descripción del Requerimiento Funcional (RF)   |
| :---- | :---- |
| **RF-01 Registrar ventas**  | El sistema deberá permitir registrar una venta asociándose a un vendedor y a un cliente, permitiendo ingresar los productos vendidos, cantidades, método de pago, observaciones, cupones (descuentos),  y precios unitarios.  |
| **RF-02 Registrar cliente**  | El sistema deberá permitir que vendedores y administradores registren nuevos clientes. |
| **RF-03  Gestionar Usuarios** | El administrador deberá poder crear, modificar, habilitar y deshabilitar usuarios.  |
| **RF-04 Consultar historial del cliente**   | El sistema deberá mostrar las ventas, visitas y movimientos históricos asociados a cada cliente.  |
| **RF-05 Identificar clientes inactivos**  | El sistema deberá generar alertas sobre clientes que no hayan realizado compras durante un periodo determinado.  |
| **RF-6 Consultar envases vacíos**  | El sistema deberá mostrar la cantidad de envases vacíos disponibles para producción.  |
| **RF-7 Registrar producción**  | El sistema deberá permitir registrar la producción de agua y hielo, aumentando automáticamente el stock.  |
| **RF-8 Consultar historial de producción**  | El sistema deberá permitir revisar los registros históricos de producción.  |
| **RF-9 Visualizar indicadores de producción** | El sistema deberá generar indicadores y reportes relacionados con la producción.  |
| **RF-10 Registrar incidencias** | El sistema deberá permitir registrar observaciones, problemas o incidencias ocurridas durante la producción.  |
| **RF-11 Consultar stock**  | El sistema deberá mostrar el stock disponible de productos y envases.  |
| **RF-12 Registrar despacho**  | El sistema deberá permitir al despachador registrar los productos entregados a cada vendedor al comenzar su ruta.  |
| **RF-13  Modificar despacho**  | El sistema deberá permitir modificar productos del despacho durante los primeros 10 a 15 minutos posteriores al registro. |
| **RF-14 Registrar devolución de productos**   | El sistema deberá permitir registrar los productos **no** vendidos que el vendedor devuelve al finalizar la ruta.  |
| **RF-15 Registrar devolución de envases**  | El sistema deberá permitir registrar los envases vacíos devueltos por cada vendedor.  |
| **RF-16 Registrar mermas** | El sistema deberá permitir registrar productos dañados, perdidos o no aptos para la venta.  |
| **RF-17 Consultar carga** | El vendedor deberá poder consultar los productos y cantidades asignados a su ruta.  |
| **RF-18 Consultar clientes de la ruta** | El vendedor deberá poder visualizar los clientes asociados a su ruta.  |
| **RF-19 Consultar bidones vacíos**  | El vendedor deberá poder consultar la cantidad de bidones vacíos registrados durante su ruta.  |
| **RF-20 Generar documento tributario**  | El sistema deberá permitir generar una boleta o factura al momento de realizar una venta. |
| **RF-21 Registrar gasto extra**  | El vendedor deberá poder registrar gastos adicionales efectuados durante la jornada, permitiendo adjuntar foto o documento respaldando el gasto.  |
| **RF-22 Visualizar ranking de vendedores**  | El sistema deberá generar un ranking de vendedores de acuerdo con sus ventas o desempeño.  |
| **RF-23 Modificar registros**  | El administrador deberá poder corregir registros ingresados por otros usuarios, dejando trazabilidad de la modificación.  |
| **RF-24 Visualizar reportes de ventas**  | El administrador deberá poder consultar reportes generales y detallados de ventas de acuerdo a ciertos parámetros.  |
| **RF-25 Configurar comisiones**  | El administrador deberá poder definir porcentajes, montos y reglas utilizadas para calcular las comisiones.  |
| **RF-26 Visualizar comisión** | El sistema deberá calcular automáticamente y mostrar las comisiones correspondientes a cada vendedor durante la jornada. |
| **RF-27 Monitorear vendedores**  | El administrador deberá poder visualizar la ubicación de los vendedores durante la jornada mediante GPS.  |
| **RF-28 Gestionar catálogo de productos**  | El administrador deberá poder mantener un catálogo único de productos, tipos de bidones, agua y hielo.  |

## **3\. Requerimientos No Funcionales**

Definen los atributos de calidad del sistema, restricciones técnicas y requerimientos de entorno:

| ID Requerimiento | Descripción del Requerimiento No Funcional (RNF)   | Categoría |
| :---- | :---- | :---- |
| **RNF-01 Operación sin conexión**  | El sistema deberá permitir registrar ventas y movimientos desde las tablets cuando no exista conexión a internet.  La información registrada sin conexión deberá sincronizarse automáticamente cuando el dispositivo recupere internet.  | Conectividad  |
| **RNF-03 Actualización en tiempo real**   | Las ventas, despachos y registros de producción deberán reflejarse inmediatamente para los usuarios autorizados.  | Rendimiento  |
| **RNF-05 Acceso múltiples dispositivo**  | El administrador deberá poder acceder al sistema desde computadores, tablets o teléfonos con conexión a internet.  | Compatibilidad  |
| **RNF-06 Sistema en la nube**  | El sistema deberá estar alojado en una infraestructura en la nube que permite el acceso remoto. | Infraestructura  |
| **RNF-07 Control de acceso** | Cada usuario deberá ingresar al sistema mediante credenciales personales para acceder a las funcionalidades del sistema.  | Seguridad  |
| **RNF-08 Control por roles**  | El sistema deberá manejar al menos los roles Vendedor, Despacho o Bodega, Producción y Administrador.  | Seguridad  |
| **RNF-10 Restricción de edición**  | Solo el administrador podrá modificar registros previamente ingresados y cerrados.  | Seguridad  |
| **RNF-11 Registro de fecha y hora**  | Cada movimiento deberá almacenar automáticamente la fecha y hora en que fue realizado. | Auditoría  |
| **RNF-12 Identificación del responsable**  | Cada registro deberá almacenar el usuario responsable de su creación o modificación.  | Auditoría  |
| **RNF-13 Historial de modificaciones**  | El sistema deberá conservar un historial de los cambios realizados sobre los registros.  | Auditoría  |
| **RNF-14 Registros no eliminables**  | Los movimientos operacionales no deberán eliminarse definitivamente; deberán anularse o corregirse dejando trazabilidad. | Integridad  |
| **RNF-15 Ventana de ajuste**  | Los despachos solo podrán ajustarse durante un periodo máximo configurable de entre 10 y 20 minutos.  | Integridad  |
| **RNF-16 Incorporación de usuarios**  | El sistema deberá permitir agregar nuevos usuarios.  | Escalabilidad  |
| **RNF-17 Crecimiento de operaciones**  | El sistema deberá soportar el aumento progresivo de ventas, clientes, productos y registros históricos.  | Escalabilidad  |
| **RNF-18 Copias de seguridad**  | El sistema deberá realizar copias de seguridad automáticas de la información almacenada.  | Respaldo  |
| **RNF-19 Restauración de información** | El sistema deberá permitir recuperar la información desde una copia de seguridad ante una falla.  | Recuperación  |
| **RNF-20 Tiempo de registro**  | El registro de una venta deberá completarse en pocos segundos bajo condiciones normales de conexión.  | Rendimiento |
| **RNF-21 Carga de reportes**  | Los reportes habituales deberán mostrarse dentro de un tiempo de respuesta aceptable para el usuario.  | Rendimiento |
| **RNF-22 Continuidad operacional**  | El sistema deberá mantenerse disponible durante toda la jornada de producción, despacho y ventas | Disponibilidad  |
| **RNF-23 Interfaz sencilla**  | La interfaz deberá ser comprensible para usuarios que actualmente trabajan principalmente con registros en papel.  | Usabilidad |
| **RNF-24 Diseño adaptable** | La interfaz deberá adaptarse al tamaño de pantalla del dispositivo utilizado.  | Usabilidad  |
| **RNF-25 Validación de datos**  | El sistema deberá advertir cuando existan campos obligatorios sin completar o datos ingresados incorrectamente. | Usabilidad |
| **RNF-26 Parámetros configurables**  | Los porcentajes de comisión y otros valores operacionales deberán poder configurarse sin modificar el código. | Mantenibilidad |
| **RNF-27 Protección de datos** | Los datos de clientes, ventas y trabajadores deberán mantenerse protegidos contra accesos no autorizados.  | Privacidad |
| **RNF-28 Digitalización documental**  | El sistema deberá reducir el uso de planillas físicas y respaldar la digitalización de los procesos internos.  | Cumplimiento  |
| **RNF-29 Base de datos centralizada**  | Toda la información deberá almacenarse en una base de datos centralizada.  | Infraestructura  |
| **RNF-30 Construcción de infraestructura**  | El proyecto deberá incluir la implementación del hosting, backend, base de datos y servicios necesarios para operar. | Infraestructura |

