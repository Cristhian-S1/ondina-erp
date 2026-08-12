# Historias de Usuario

## Sistema de Gestión de Ventas, Producción y Bodega — Ondina

**Fuentes:** Problematica.md, Requerimentos RF y RNF.md, Reunión 1 — Levantamiento de requerimientos.

**Formato de descripción:** *Como [rol], quiero [funcionalidad], para [beneficio]*.

**Criterios de aceptación:** redactados en estilo Gherkin en español (*Dado / Cuando / Entonces*) para el flujo principal, complementados con condiciones adicionales verificables.

**Nota:** HU-01 a HU-29 derivan de los requerimientos funcionales (RF-01 a RF-28). HU-31 es una historia técnica derivada de los RNF de mayor impacto operativo (RNF-07, RNF-08). El resto de los RNF se consideran restricciones transversales y están referenciados dentro de los criterios de aceptación de cada historia.

**Historias eliminadas (2026-08-01):** HU-18 (Cerrar jornada) y HU-30 (Registrar operaciones sin conexión) fueron eliminadas del alcance por decisión del equipo. Los IDs no se renumeran para preservar la trazabilidad con los RF/RNF. Total vigente: **29 historias**.

---

## Módulo de Ventas y Clientes (Vendedor)

### HU-01 — Registrar venta

- **ID:** HU-01
- **Requerimiento asociado:** RF-01
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero registrar una venta asociándola a un cliente, con productos, cantidades, precios unitarios, método de pago, cupones de descuento y observaciones, para dejar un respaldo digital inmediato y confiable de cada venta realizada en terreno.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado, cuando selecciona un cliente, agrega al menos un producto con su cantidad y precio, indica el método de pago y confirma, entonces el sistema registra la venta almacenando automáticamente la fecha, hora y vendedor responsable (RNF-11, RNF-12).
  - El sistema permite ingresar precios unitarios distintos al precio estándar y aplicar cupones o descuentos sobre el total de la venta.
  - El sistema advierte y bloquea el registro si faltan campos obligatorios: cliente, al menos un producto con cantidad y método de pago (RNF-25).
  - Al confirmarse, la venta descuenta automáticamente los productos de la carga asignada al vendedor.
  - La venta queda visible en tiempo real para el administrador (RNF-03).
  - Una vez registrada, la venta no puede ser modificada ni eliminada por el vendedor; solo el administrador puede corregirla dejando trazabilidad (RNF-10, RNF-14).

### HU-02 — Registrar cliente

- **ID:** HU-02
- **Requerimiento asociado:** RF-02
- **Rol:** Vendedor / Administrador
- **Descripción:** Como vendedor o administrador, quiero registrar nuevos clientes con sus datos de identificación y contacto, para mantener la cartera de clientes actualizada y disponible para las ventas en ruta.
- **Criterios de aceptación:**
  - Dado un vendedor o administrador autenticado, cuando ingresa los datos del nuevo cliente y confirma, entonces el sistema crea la ficha del cliente y la deja disponible para asociar ventas.
  - La ficha debe incluir al menos: nombre completo, contacto, dirección, número del local y tipo de cliente (mayorista, minorista u ocasional).
  - El sistema valida que los campos obligatorios estén completos antes de guardar (RNF-25).
  - El cliente registrado por un vendedor queda asociado a la ruta/cartera de ese vendedor.
  - El vendedor no puede editar la ficha una vez registrada; solo el administrador puede modificarla (RNF-10).

### HU-03 — Consultar carga asignada

- **ID:** HU-03
- **Requerimiento asociado:** RF-17
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero consultar los productos y cantidades asignados a mi ruta, para conocer mi disponibilidad real antes y durante la jornada de venta.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado con un despacho registrado, cuando accede a su carga, entonces el sistema muestra el detalle de productos y cantidades cargadas, actualizado con las ventas ya realizadas.
  - El vendedor solo puede visualizar su propia carga, no la de otros vendedores (RNF-08).

### HU-04 — Consultar clientes de la ruta

- **ID:** HU-04
- **Requerimiento asociado:** RF-18
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero visualizar los clientes asociados a mi ruta, para planificar mis visitas y gestionar mi cartera sin acceder a clientes de otros vendedores.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado, cuando accede a su ruta, entonces el sistema muestra la lista de clientes asignados con sus datos principales (nombre, dirección, contacto).
  - El vendedor solo visualiza los clientes de su propia cartera (RNF-08).
  - La lista refleja de inmediato los clientes nuevos registrados por el vendedor.

### HU-05 — Consultar bidones vacíos

- **ID:** HU-05
- **Requerimiento asociado:** RF-19
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero consultar la cantidad de bidones vacíos registrados durante mi ruta, para controlar los envases recuperados que debo devolver al finalizar la jornada.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado, cuando consulta los bidones vacíos, entonces el sistema muestra la cantidad acumulada durante su jornada.
  - El contador es consistente con los envases registrados en las ventas y devoluciones de la ruta.
  - El vendedor solo visualiza los envases de su propia ruta (RNF-08).

### HU-06 — Generar boleta o factura

- **ID:** HU-06
- **Requerimiento asociado:** RF-20
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero generar una boleta o factura al momento de realizar una venta, para entregar el documento tributario al cliente cuando lo solicite.
- **Criterios de aceptación:**
  - Dada una venta confirmada, cuando el vendedor selecciona generar documento y elige boleta o factura, entonces el sistema emite el documento con los datos de la venta.
  - El documento incluye: cliente, productos, cantidades, precios unitarios, descuentos aplicados, total, método de pago, fecha y folio identificador.
  - El documento generado queda asociado a la venta y disponible para consulta posterior.

### HU-07 — Registrar gasto extra

- **ID:** HU-07
- **Requerimiento asociado:** RF-21
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero registrar los gastos adicionales efectuados durante la jornada adjuntando una foto o documento de respaldo, para justificar los egresos que se descuentan del dinero recaudado en el día.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado, cuando ingresa el monto, el motivo del gasto y adjunta la foto o documento de respaldo, entonces el sistema registra el gasto asociado a su jornada con fecha y hora (RNF-11, RNF-12).
  - El sistema permite adjuntar una imagen como comprobante (foto de boleta, vale de combustible u otro documento).
  - El sistema advierte si falta el monto o el motivo del gasto (RNF-25).
  - El gasto registrado se consolida como egreso del día en los reportes de administración (HU-14).
  - El gasto no puede ser modificado ni eliminado por el vendedor una vez registrado (RNF-10, RNF-14).

### HU-08 — Visualizar ranking de vendedores

- **ID:** HU-08
- **Requerimiento asociado:** RF-22
- **Rol:** Vendedor / Administrador
- **Descripción:** Como vendedor, quiero visualizar el ranking de vendedores según ventas o desempeño, para conocer mi posición dentro del equipo y fomentar la competencia interna.
- **Criterios de aceptación:**
  - Dado un usuario autenticado, cuando accede al ranking, entonces el sistema muestra la lista ordenada de vendedores según sus ventas o desempeño del periodo seleccionado.
  - El ranking se calcula automáticamente a partir de las ventas registradas en el sistema.
  - El ranking muestra posiciones y resultados agregados, sin exponer el detalle de clientes ni de ventas individuales de otros vendedores (RNF-08).

### HU-09 — Visualizar mi comisión

- **ID:** HU-09
- **Requerimiento asociado:** RF-26
- **Rol:** Vendedor
- **Descripción:** Como vendedor, quiero que el sistema calcule y muestre automáticamente mi comisión durante la jornada, para conocer mi ganancia acumulada según lo vendido.
- **Criterios de aceptación:**
  - Dado un vendedor autenticado con ventas registradas, cuando consulta su comisión, entonces el sistema muestra el monto calculado según las reglas de comisión vigentes por tipo de producto.
  - El cálculo se actualiza automáticamente con cada venta registrada.
  - El vendedor solo visualiza su propia comisión (RNF-08).

---

## Módulo de Administración (Administrador)

### HU-10 — Gestionar usuarios

- **ID:** HU-10
- **Requerimiento asociado:** RF-03
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero crear, modificar, habilitar y deshabilitar usuarios, para controlar el acceso al sistema según el rol de cada trabajador.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando crea un usuario indicando nombre, credenciales y rol (Vendedor, Bodega/Despacho, Producción o Administrador), entonces el sistema habilita el acceso con las funcionalidades propias de ese rol (RNF-07, RNF-08).
  - El administrador puede modificar datos, cambiar el rol y deshabilitar usuarios sin eliminarlos, conservando su historial de registros.
  - Un usuario deshabilitado no puede ingresar al sistema, pero sus registros históricos se conservan (RNF-14).
  - El sistema permite incorporar nuevos usuarios sin rediseño, soportando el crecimiento del equipo (de 4 a 6 vendedores el próximo año) (RNF-16).

### HU-11 — Consultar historial del cliente

- **ID:** HU-11
- **Requerimiento asociado:** RF-04
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero consultar las ventas, visitas y movimientos históricos asociados a cada cliente, para conocer su comportamiento y respaldar decisiones comerciales.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando selecciona un cliente y accede a su historial, entonces el sistema muestra las ventas, visitas y movimientos registrados, ordenados por fecha.
  - El historial incluye montos, productos, cantidades y el vendedor que atendió cada operación.
  - El historial es de solo lectura; las correcciones se realizan sobre los registros originales mediante HU-13.

### HU-12 — Recibir alertas de clientes inactivos

- **ID:** HU-12
- **Requerimiento asociado:** RF-05
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero recibir alertas de los clientes que no han comprado durante un periodo determinado, para contactarlos y averiguar el motivo de la inactividad (mal servicio, pérdida frente a la competencia, etc.).
- **Criterios de aceptación:**
  - Dado un cliente que supera el periodo configurado sin compras, cuando el sistema detecta la inactividad, entonces genera una alerta visible para el administrador.
  - El periodo de inactividad es configurable (por defecto, una semana) (RNF-26).
  - La alerta identifica al cliente, su vendedor asignado y la fecha de su última compra.
  - El administrador puede revisar el listado completo de clientes inactivos.

### HU-13 — Modificar registros con trazabilidad

- **ID:** HU-13
- **Requerimiento asociado:** RF-23
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero corregir registros ingresados por otros usuarios (ventas, despachos, producción, gastos), dejando trazabilidad de cada modificación, para mantener la información confiable sin perder el historial de cambios.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando modifica un registro ya ingresado y confirma la corrección, entonces el sistema guarda el cambio conservando el valor anterior, el valor nuevo, la fecha/hora y el usuario que modificó (RNF-12, RNF-13).
  - Ningún otro rol puede modificar registros cerrados; los intentos son bloqueados por el sistema (RNF-10).
  - Los registros operacionales no se eliminan físicamente: solo se anulan o corrigen dejando trazabilidad (RNF-14).
  - El historial de modificaciones de cada registro es consultable (RNF-13).

### HU-14 — Visualizar reportes de ventas

- **ID:** HU-14
- **Requerimiento asociado:** RF-24
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero consultar reportes generales y detallados de ventas según parámetros como fecha, vendedor y producto, para monitorear los ingresos del negocio en tiempo real desde cualquier dispositivo.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando selecciona los parámetros de consulta (rango de fechas, vendedor, producto), entonces el sistema muestra el reporte con totales y detalle de ventas (RNF-21).
  - El reporte diario refleja los ingresos en tiempo real a medida que los vendedores registran ventas (RNF-03).
  - Los reportes consolidan información diaria, semanal y mensual.
  - El reporte es accesible desde computador, tablet o teléfono (RNF-05, RNF-24).

### HU-15 — Configurar comisiones

- **ID:** HU-15
- **Requerimiento asociado:** RF-25
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero definir porcentajes, montos y reglas para el cálculo de comisiones, para ajustar los incentivos del equipo sin modificar el código del sistema.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando modifica los porcentajes o montos de comisión (por ejemplo, por tipo de producto: bidón, hielo) y guarda, entonces el sistema aplica las nuevas reglas en los cálculos posteriores (RNF-26).
  - Los cambios de configuración no requieren modificación de código ni redespliegue.
  - Las comisiones calculadas con anterioridad conservan las reglas vigentes al momento de su cálculo.

### HU-16 — Monitorear vendedores en terreno

- **ID:** HU-16
- **Requerimiento asociado:** RF-27
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero visualizar la ubicación de los vendedores mediante GPS durante la jornada, para supervisar la operación en tiempo real.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando accede al monitoreo, entonces el sistema muestra en un mapa la última ubicación conocida de cada vendedor activo.
  - La ubicación se actualiza periódicamente durante la jornada, cuando el dispositivo dispone de conexión.
  - Solo el administrador tiene acceso a esta funcionalidad (RNF-08).

### HU-17 — Gestionar catálogo de productos

- **ID:** HU-17
- **Requerimiento asociado:** RF-28
- **Rol:** Administrador
- **Descripción:** Como administrador, quiero mantener un catálogo único de productos (tipos de bidón, agua y hielo), para asegurar que todos los módulos registren operaciones con los mismos productos y precios base.
- **Criterios de aceptación:**
  - Dado un administrador autenticado, cuando crea, edita o desactiva un producto del catálogo (nombre, tipo, precio base), entonces el cambio queda disponible para los módulos de ventas, despacho y producción.
  - El catálogo es único y centralizado: todos los registros del sistema referencian productos del catálogo (RNF-29).
  - Un producto con movimientos asociados no se elimina; solo puede desactivarse (RNF-14).

---

## Módulo de Producción

### HU-19 — Consultar envases vacíos disponibles

- **ID:** HU-19
- **Requerimiento asociado:** RF-06
- **Rol:** Producción
- **Descripción:** Como encargado de producción, quiero conocer la cantidad de envases vacíos disponibles, para planificar la producción de agua según la capacidad real de envasado.
- **Criterios de aceptación:**
  - Dado un usuario de producción autenticado, cuando accede a envases vacíos, entonces el sistema muestra la cantidad disponible actualizada.
  - La cantidad se actualiza automáticamente con cada devolución de envases registrada y con cada registro de producción.

### HU-20 — Registrar producción

- **ID:** HU-20
- **Requerimiento asociado:** RF-07
- **Rol:** Producción
- **Descripción:** Como encargado de producción, quiero registrar la producción de agua y hielo (incluyendo cada descarga de hielo de ~50 unidades), para que el stock de bodega aumente automáticamente y la administración vea en tiempo real cuánto se produce.
- **Criterios de aceptación:**
  - Dado un usuario de producción autenticado, cuando registra una producción indicando producto y cantidad (o una descarga de hielo), entonces el sistema suma automáticamente esas unidades al stock de bodega.
  - Cada registro almacena fecha, hora y usuario responsable (RNF-11, RNF-12).
  - La producción registrada se refleja en tiempo real para el administrador (RNF-03).
  - El registro no puede ser modificado ni eliminado por producción una vez ingresado; solo el administrador puede corregirlo (RNF-10, RNF-14).

### HU-21 — Consultar historial de producción

- **ID:** HU-21
- **Requerimiento asociado:** RF-08
- **Rol:** Producción
- **Descripción:** Como encargado de producción, quiero revisar los registros históricos de producción, para verificar lo fabricado en jornadas anteriores.
- **Criterios de aceptación:**
  - Dado un usuario de producción autenticado, cuando accede al historial y filtra por fecha o producto, entonces el sistema muestra los registros de producción ordenados cronológicamente.
  - El historial es de solo lectura para el rol producción (RNF-10).

### HU-22 — Visualizar indicadores de producción

- **ID:** HU-22
- **Requerimiento asociado:** RF-09
- **Rol:** Producción
- **Descripción:** Como encargado de producción, quiero visualizar indicadores y reportes de producción, para evaluar el rendimiento de la fabricación y anticipar necesidades.
- **Criterios de aceptación:**
  - Dado un usuario de producción autenticado, cuando accede a los indicadores, entonces el sistema muestra métricas de producción (totales por periodo y por producto) calculadas a partir de los registros.
  - Los indicadores se actualizan con cada nuevo registro de producción (RNF-03).

### HU-23 — Registrar incidencias

- **ID:** HU-23
- **Requerimiento asociado:** RF-10
- **Rol:** Producción
- **Descripción:** Como encargado de producción, quiero registrar observaciones, problemas o incidencias ocurridas durante la producción, para dejar constancia de los eventos que afectan la fabricación o el stock.
- **Criterios de aceptación:**
  - Dado un usuario de producción autenticado, cuando ingresa la descripción de la incidencia y confirma, entonces el sistema la registra con fecha, hora y responsable (RNF-11, RNF-12).
  - Las incidencias quedan asociadas a la jornada de producción y son visibles para el administrador.

---

## Módulo de Bodega / Despacho

### HU-24 — Consultar stock

- **ID:** HU-24
- **Requerimiento asociado:** RF-11
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero consultar el stock disponible de productos y envases, para saber cuánto puedo asignar a cada vendedor, especialmente en temporada alta.
- **Criterios de aceptación:**
  - Dado un despachador autenticado, cuando accede al stock, entonces el sistema muestra las cantidades disponibles por producto y envase.
  - El stock se actualiza automáticamente: suma con producción y devoluciones; resta con despachos y mermas (RNF-03).

### HU-25 — Registrar despacho

- **ID:** HU-25
- **Requerimiento asociado:** RF-12
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero registrar los productos entregados a cada vendedor al comenzar su ruta, para que el stock se descuente automáticamente y quede constancia digital de la carga asignada.
- **Criterios de aceptación:**
  - Dado un despachador autenticado, cuando selecciona el vendedor, indica productos y cantidades entregadas y confirma, entonces el sistema registra el despacho con fecha, hora de salida y responsable, y descuenta automáticamente las cantidades del stock de bodega (RNF-11, RNF-12).
  - El sistema valida que las cantidades despachadas no superen el stock disponible (RNF-25).
  - El despacho queda asignado como carga del vendedor, visible para él (HU-03).
  - El despacho registrado no puede eliminarse; solo es ajustable dentro de la ventana de ajuste (HU-26) o corregible por el administrador (RNF-14).

### HU-26 — Modificar despacho dentro de la ventana de ajuste

- **ID:** HU-26
- **Requerimiento asociado:** RF-13, RNF-15
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero sumar productos adicionales a un despacho durante los primeros 10 a 20 minutos posteriores a su registro, para reflejar cargas de último minuto sin alterar lo ya registrado.
- **Criterios de aceptación:**
  - Dado un despacho registrado dentro del plazo de ajuste, cuando el despachador agrega productos adicionales y confirma, entonces el sistema suma las cantidades al despacho y las descuenta del stock.
  - Pasado el plazo (configurable entre 10 y 20 minutos), el sistema bloquea cualquier ajuste sobre el despacho (RNF-15, RNF-26).
  - La ventana solo permite **sumar** productos; no se puede restar ni editar lo ya registrado.
  - Cada ajuste queda registrado con fecha, hora y responsable (RNF-11, RNF-12, RNF-13).

### HU-27 — Registrar devolución de productos

- **ID:** HU-27
- **Requerimiento asociado:** RF-14
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero registrar los productos no vendidos que el vendedor devuelve al finalizar la ruta, para reingresarlos al stock y cuadrar la jornada del vendedor.
- **Criterios de aceptación:**
  - Dado un vendedor que finaliza su ruta, cuando el despachador registra los productos devueltos y confirma, entonces el sistema reingresa las cantidades al stock de bodega y las asocia a la jornada del vendedor.
  - La devolución queda disponible para el cuadre entre lo despachado, lo vendido y lo devuelto de cada vendedor.

### HU-28 — Registrar devolución de envases

- **ID:** HU-28
- **Requerimiento asociado:** RF-15
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero registrar los envases vacíos devueltos por cada vendedor, para mantener actualizado el inventario de envases disponibles para producción.
- **Criterios de aceptación:**
  - Dado un vendedor que finaliza su ruta, cuando el despachador registra los envases vacíos devueltos y confirma, entonces el sistema suma las cantidades al inventario de envases vacíos disponibles.
  - La devolución queda asociada al vendedor y a su jornada, con fecha, hora y responsable (RNF-11, RNF-12).

### HU-29 — Registrar mermas

- **ID:** HU-29
- **Requerimiento asociado:** RF-16
- **Rol:** Bodega / Despacho
- **Descripción:** Como despachador, quiero registrar los productos dañados, perdidos o no aptos para la venta, para que el sistema refleje con precisión cuánto se vendió, cuánto se perdió y cuánto queda realmente en stock.
- **Criterios de aceptación:**
  - Dado un despachador autenticado, cuando registra una merma indicando producto, cantidad y motivo, entonces el sistema descuenta las unidades del stock disponible sin reingresarlas.
  - El motivo de la merma es obligatorio (por ejemplo: bidón roto, bolsa de hielo rota) (RNF-25).
  - La merma queda asociada a la jornada correspondiente y se considera en el cuadre de movimientos del día.

---

## Historias técnicas (transversales, derivadas de RNF)

### HU-31 — Ingresar al sistema con credenciales y rol

- **ID:** HU-31
- **Requerimiento asociado:** RNF-07, RNF-08
- **Rol:** Todos los roles
- **Descripción:** Como usuario, quiero ingresar al sistema con mis credenciales personales y acceder únicamente a las funciones de mi rol, para proteger la información del negocio y evitar manipulaciones.
- **Criterios de aceptación:**
  - Dado un usuario habilitado, cuando ingresa credenciales válidas, entonces el sistema le da acceso solo a las funcionalidades permitidas para su rol (Vendedor, Bodega/Despacho, Producción o Administrador).
  - Dado un usuario con credenciales inválidas o deshabilitado, cuando intenta ingresar, entonces el sistema rechaza el acceso.
  - Cada acción realizada queda asociada al usuario autenticado (RNF-12).

---

## Tabla de trazabilidad

| ID HU | Nombre | RF / RNF asociado | Rol |
| :---- | :----- | :---------------- | :-- |
| HU-01 | Registrar venta | RF-01 | Vendedor |
| HU-02 | Registrar cliente | RF-02 | Vendedor / Administrador |
| HU-03 | Consultar carga asignada | RF-17 | Vendedor |
| HU-04 | Consultar clientes de la ruta | RF-18 | Vendedor |
| HU-05 | Consultar bidones vacíos | RF-19 | Vendedor |
| HU-06 | Generar boleta o factura | RF-20 | Vendedor |
| HU-07 | Registrar gasto extra | RF-21 | Vendedor |
| HU-08 | Visualizar ranking de vendedores | RF-22 | Vendedor / Administrador |
| HU-09 | Visualizar mi comisión | RF-26 | Vendedor |
| HU-10 | Gestionar usuarios | RF-03 | Administrador |
| HU-11 | Consultar historial del cliente | RF-04 | Administrador |
| HU-12 | Recibir alertas de clientes inactivos | RF-05 | Administrador |
| HU-13 | Modificar registros con trazabilidad | RF-23 | Administrador |
| HU-14 | Visualizar reportes de ventas | RF-24 | Administrador |
| HU-15 | Configurar comisiones | RF-25 | Administrador |
| HU-16 | Monitorear vendedores en terreno | RF-27 | Administrador |
| HU-17 | Gestionar catálogo de productos | RF-28 | Administrador |
| HU-19 | Consultar envases vacíos disponibles | RF-06 | Producción |
| HU-20 | Registrar producción | RF-07 | Producción |
| HU-21 | Consultar historial de producción | RF-08 | Producción |
| HU-22 | Visualizar indicadores de producción | RF-09 | Producción |
| HU-23 | Registrar incidencias | RF-10 | Producción |
| HU-24 | Consultar stock | RF-11 | Bodega / Despacho |
| HU-25 | Registrar despacho | RF-12 | Bodega / Despacho |
| HU-26 | Modificar despacho (ventana de ajuste) | RF-13, RNF-15 | Bodega / Despacho |
| HU-27 | Registrar devolución de productos | RF-14 | Bodega / Despacho |
| HU-28 | Registrar devolución de envases | RF-15 | Bodega / Despacho |
| HU-29 | Registrar mermas | RF-16 | Bodega / Despacho |
| HU-31 | Ingresar con credenciales y rol | RNF-07, RNF-08 | Todos los roles |
