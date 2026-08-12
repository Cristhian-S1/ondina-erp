# **Documento de Alcance del Proyecto**

## **Sistema de Gestión de Ventas, Producción y Bodega —Ondina** 

## **1\. Problemática**

### **1.1 Situación actual**

La empresa gestiona hoy toda su operación de venta de agua embotellada y hielo mediante **planillas físicas**, llenadas a mano por cada uno de los 4 vendedores durante su ruta, y consolidadas después manualmente en Excel de forma diaria, semanal y mensual.

Existen dos tipos de planilla en uso:

* **Registro de venta** (bidones y hielo por separado): vendedor, fecha, dinero ingresado, gastos extra, cantidades por tipo de producto y por cliente.  
* **Auditoría de ingreso y salida**: hora de salida/regreso del vendedor, cantidades cargadas y devueltas, mermas y roturas.

### **1.2 Consecuencias operativas**

Este método manual genera problemas concretos que motivan el proyecto:

* **Sin visibilidad en tiempo real**: la administración solo conoce el resultado de la jornada cuando el vendedor regresa a planta a rendir cuentas.  
* **Trazabilidad débil**: no es posible confirmar con certeza cuánto se entregó exactamente a un cliente ni a qué precio real se cobró, ya que esa relación queda en manos del chofer/vendedor sin respaldo digital.  
* **Información manipulable**: el Excel consolidado puede editarse sin dejar rastro, lo que dificulta un control confiable.  
* **Pérdida y dispersión de información**: una planilla física traspapelada o dañada es información que no se recupera.  
* **Reportes lentos**: pasar de papel a Excel es un proceso manual que retrasa cualquier análisis.  
* **Poco control de inventario**: no hay visibilidad automática de cuánto stock de agua o hielo queda disponible, especialmente crítico en temporada alta (carnaval, año nuevo).  
* **Canales de pedido dispersos**: los pedidos nuevos llegan hoy por tres vías distintas (llamadas y WhatsApp), que muchas veces no se atienden a tiempo.  
* **Correcciones poco confiables en despacho**: hoy es común que un chofer firme una cantidad de salida y luego declare haber llevado otra, generando borrones y ajustes posteriores en la planilla física.

### **1.3 Contexto normativo**

El problema se enmarca además en la **Ley N° 21.180 (Cero Papel)**, que impulsa la digitalización de procesos como el que hoy la empresa resuelve en papel.

---

## **2\. Propuesta**

### **2.1 Enfoque general**

Se propone un sistema con **arquitectura tipo ERP**, compuesto por módulos independientes pero interconectados entre sí, que digitalice el proceso de venta de punta a punta y entregue visibilidad en tiempo real a la administración — sin que ningún cliente final necesite usar el sistema: el registro lo hace siempre el vendedor o chofer desde su propio dispositivo.

### **2.2 Alcance por etapas**

El desarrollo se plantea de forma **incremental**, para entregar primero un producto funcional con lo esencial y luego ampliar según el uso real:

| Etapa | Contenido |
| ----- | ----- |
| **Etapa 1 (actual)** | Módulo de Ventas y Clientes, Módulo de Producción, Módulo de Bodega/Despacho — producto funcional mínimo |
| **Etapa 2 (posterior)** | Módulo administrativo completo (sueldos, gastos generales) y demás funcionalidades que surjan del feedback de la primera versión |

Aunque el módulo administrativo completo queda para la Etapa 2, sí se incluye desde ahora que administración pueda visualizar en la nube, en tiempo real, el total de ingresos diarios generados por las ventas y lo producido cada día.

### 

### 

### **2.3 Reglas de negocio clave**

Estas reglas condicionan el diseño de los módulos y deben respetarse en la implementación:

* **Ventana de ajuste en despacho**: tras registrar el despacho de un vendedor, existe un margen de 15 a 20 minutos para sumar productos adicionales (ej. si a último momento se decide cargar más bidones). Pasado ese margen, el despacho ya registrado no se puede editar ni restar — solo permite sumatoria posterior dentro del plazo.  
* **Edición restringida a Administrador**: solo el rol Administrador puede modificar o corregir un registro ya ingresado (venta, despacho, producción). El resto de los roles visualiza únicamente su propio historial, sin capacidad de edición, evitando que un dato ya registrado sea alterado.  
* **Cuadre automático antes del cierre**: el sistema debe comparar despacho, ventas y devoluciones de forma automática, de modo que ese cuadre esté listo antes de que Administrador cierre la jornada.  
* **Descuento automático de stock**: al despachar productos para la venta, el stock de bodega se resta automáticamente; al registrar producción (o cada descarga de hielo, \~50 unidades), el stock se suma.

### **2.4 Plataforma e infraestructura**

* Acceso principal desde **tablets**, para vendedores/choferes, producción y despacho, permitiendo ingresar datos en tiempo real desde terreno o desde la planta.  
* Diseño pensado para **operar con conexión limitada**, de forma que el personal pueda seguir registrando información aun sin internet en ciertos puntos de la ruta.  
* La empresa **no cuenta con servidor propio** hoy, por lo que la infraestructura (hosting, base de datos, backend) se construye completamente desde cero para este proyecto.

## **3\. Consideraciones**

### **3.1 Supuestos y alcance actual**

* Existen dos cajas separadas en la operación de la empresa: **Agroplan** y **Ondina**. Este proyecto se enfoca en **Ondina**; Agroplan queda fuera de alcance por ahora.  
* Cada vendedor mantiene su propia cartera de clientes y ruta ya asignada; distintos vendedores pueden operar en un mismo sector geográfico (la división no es estrictamente por zona, sino por cliente ya asignado).  
* El registro de venta lo realiza siempre el vendedor/chofer; no se asume que el cliente final tenga acceso al sistema.

### **3.2 Crecimiento y escalabilidad**

* Se espera incorporar **2 vendedores adicionales** durante el próximo año (de 4 a 6), por lo que el sistema debe soportar el crecimiento del equipo y de las rutas sin rediseño estructural.  
* El control de stock debe sostener picos de demanda en **temporada alta** (carnaval, año nuevo), donde se vende gran parte del stock disponible, principalmente de hielo.

### **3.3 Puntos a confirmar con el cliente**

Estos puntos no bloquean el desarrollo, pero conviene resolverlos antes de cerrar el modelo de datos definitivo: 

| Punto | Detalle |
| ----- | ----- |
| Recepción centralizada de pedidos | Falta definir formalmente cómo y con quién se centraliza la recepción de pedidos nuevos (hoy por 3 canales) y cómo se asignan al vendedor con menor carga |
| Precio y cupones por cliente | El precio de bidones/hielo puede variar por cliente y aplicar cupones; falta reflejarlo en el registro de venta, más allá del precio estándar |
| Informe de clientes por vendedor | Falta un reporte específico (distinto del ranking) de clientes atendidos, nuevos y perdidos por vendedor, para priorizar visitas |
| Respaldo de gasto extra | Definir si el sistema debe permitir adjuntar comprobante/vale y patente del vehículo cuando el gasto extra sea sobre el vehículo |
| Método de pago | Confirmar si son efectivo/transferencia o efectivo/tarjeta — ambos aparecen mencionados en distintas fuentes |
| Catálogo único de productos | Unificar los tipos de bidón y hielo que maneja el sistema, ya que las planillas actuales no son consistentes entre sí en la cantidad de tipos registrados |

### 

### 

### **3.4 Referencias de mercado**

Como referencia de sistemas similares que ya operan bajo un modelo de venta por ruta, se mencionaron empresas como Pesovar, Luqué, Coca-Cola y CCU. También se mencionó el caso de Soprodi (venta de alimento para mascotas), que trabaja con metas de venta mensuales por vendedor y un ranking interno — modelo que inspira el ranking de vendedores propuesto en el Módulo de Ventas.

### **3.5 Estructura organizacional interna**

El negocio se organiza hoy en tres áreas — administración, ventas y producción —, cada una a cargo de una persona distinta dentro de la empresa. Esto es relevante para el diseño de permisos: conviene validar si los roles operativos definidos (Vendedor, Bodega, Producción) cubren también las necesidades de quienes lideran cada área, o si se requiere un nivel de reportes/gestión intermedio para cada encargado de área, distinto del rol operativo de base y del rol Administrador general.

---

## **4\. Scopes por rol**

### **4.1 Vendedor**

**Objetivo:** operar la venta directa en ruta y mantener actualizada su relación con los clientes.

**Puede:**

* Consultar el stock de su carga asignada  
* Registrar una venta (cliente, productos, cantidad, método de pago, observación)  
* Generar boleta o factura al momento de la venta  
* Ver sus propios clientes (ruta)  
* Registrar nuevos clientes  
* Consultar envases vacíos  
* Registrar gastos extra  
* Visualizar sus propios reportes (ranking, historial de sus ventas)

**No puede:**

* Editar clientes ya registrados (solo Administrador edita)  
* Modificar una venta o gasto ya registrado  
* Ver clientes, ventas o reportes de otros vendedores  
* Acceder a reportes financieros globales de la empresa

### 

### **4.2 Bodega / Despacho**

**Objetivo:** administrar el inventario disponible y controlar la carga que sale y regresa con cada vendedor.

**Puede:**

* Consultar stock disponible  
* Registrar despacho de productos a un vendedor (con ventana de ajuste de 15–20 minutos para sumar productos)  
* Asignar carga a un vendedor  
* Registrar devolución de productos no vendidos  
* Registrar devolución de envases vacíos  
* Registrar mermas (productos dañados)  
* Comparar despacho, ventas y devoluciones (cuadre previo al cierre de jornada)

**No puede:**

* Modificar o eliminar un despacho ya cerrado, fuera de la ventana de ajuste  
* Editar registros de venta del vendedor  
* Ver reportes financieros globales de la empresa  
* Gestionar usuarios ni configurar comisiones

### **4.3 Producción**

**Objetivo:** garantizar la disponibilidad de agua y hielo para la venta, con control de stock e incidencias de fabricación.

**Puede:**

* Consultar envases vacíos disponibles  
* Registrar producción (aumenta el stock)  
* Consultar historial de producción  
* Ver indicadores/reportes de producción  
* Registrar observaciones o incidencias

**No puede:**

* Registrar ventas ni despachos  
* Ver información de clientes  
* Modificar registros de otras áreas

### 

### 

### **4.4 Administrador**

**Objetivo:** supervisar y controlar toda la operación del negocio, con capacidad de corrección y configuración general.

**Puede:**

* Gestionar usuarios  
* Modificar o corregir cualquier registro ya ingresado (único rol con este permiso)  
* Visualizar reportes de ventas e ingresos  
* Visualizar reportes por vendedor (ranking, desempeño)  
* Configurar comisiones y parámetros, con cálculo automático  
* Monitorear la ubicación de vendedores en tiempo real  
* Gestionar clientes (editar fichas)  
* Recibir alertas de clientes inactivos  
* Realizar el cierre de jornada (consolidar ingresos, egresos y comisiones del día)

**No puede:**

* No tiene restricciones de alcance dentro del sistema — es el único rol sin límites de visualización o edición

### **4.5 Matriz resumen de permisos**

| Función | Vendedor | Bodega/Despacho | Producción | Administrador |
| ----- | ----- | ----- | ----- | ----- |
| Registrar venta | ✅ | — | — | ✅ (corrige) |
| Generar boleta/factura | ✅ | — | — | — |
| Registrar cliente | ✅ | — | — | ✅ |
| Editar cliente | — | — | — | ✅ |
| Registrar despacho | — | ✅ | — | ✅ (corrige) |
| Registrar devoluciones/mermas | — | ✅ | — | ✅ (corrige) |
| Registrar producción | — | — | ✅ | ✅ (corrige) |
| Ver stock/carga propia | ✅ | ✅ | ✅ | ✅ |
| Ver reportes globales de la empresa | — | — | — | ✅ |
| Configurar comisiones y parámetros | — | — | — | ✅ |
| Monitorear ubicación de vendedores | — | — | — | ✅ |
| Gestionar usuarios | — | — | — | ✅ |
| Cerrar jornada | — | — | — | ✅ |

