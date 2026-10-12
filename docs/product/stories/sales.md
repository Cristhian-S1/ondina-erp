# Ventas y clientes

Criterios del producto; consultar [requisitos](../requirements.md) y [estado de implementación](../../status/user-stories.md) sin confundirlos con validación de producción.

## HU-01

**Registrar venta** · RF-01 · Vendedor

Como vendedor, quiero registrar una venta asociándola a un cliente, con productos, cantidades, precios unitarios, método de pago, cupones de descuento y observaciones, para dejar un respaldo digital inmediato y confiable de cada venta realizada en terreno.

**Aceptación:**

- Dado un vendedor autenticado, cuando selecciona un cliente, agrega al menos un producto con su cantidad y precio, indica el método de pago y confirma, entonces el sistema registra la venta almacenando automáticamente la fecha, hora y vendedor responsable (RNF-11, RNF-12).
- El sistema permite ingresar precios unitarios distintos al precio estándar y aplicar cupones o descuentos sobre el total de la venta.
- El sistema advierte y bloquea el registro si faltan campos obligatorios: cliente, al menos un producto con cantidad y método de pago (RNF-25).
- Al confirmarse, la venta descuenta automáticamente los productos de la carga asignada al vendedor.
- La venta queda visible en tiempo real para el administrador (RNF-03).
- Una vez registrada, la venta no puede ser modificada ni eliminada por el vendedor; solo el administrador puede corregirla dejando trazabilidad (RNF-10, RNF-14).

## HU-02

**Registrar cliente** · RF-02 · Vendedor / Administrador

Como vendedor o administrador, quiero registrar nuevos clientes con sus datos de identificación y contacto, para mantener la cartera de clientes actualizada y disponible para las ventas en ruta.

**Aceptación:**

- Dado un vendedor o administrador autenticado, cuando ingresa los datos del nuevo cliente y confirma, entonces el sistema crea la ficha del cliente y la deja disponible para asociar ventas.
- La ficha debe incluir al menos: nombre completo, contacto, dirección, número del local y tipo de cliente (mayorista, minorista u ocasional).
- El sistema valida que los campos obligatorios estén completos antes de guardar (RNF-25).
- El cliente registrado por un vendedor queda asociado a la ruta/cartera de ese vendedor.
- El vendedor no puede editar la ficha una vez registrada; solo el administrador puede modificarla (RNF-10).

## HU-03

**Consultar carga asignada** · RF-17 · Vendedor

Como vendedor, quiero consultar los productos y cantidades asignados a mi ruta, para conocer mi disponibilidad real antes y durante la jornada de venta.

**Aceptación:**

- Dado un vendedor autenticado con un despacho registrado, cuando accede a su carga, entonces el sistema muestra el detalle de productos y cantidades cargadas, actualizado con las ventas ya realizadas.
- El vendedor solo puede visualizar su propia carga, no la de otros vendedores (RNF-08).

## HU-04

**Consultar clientes de la ruta** · RF-18 · Vendedor

Como vendedor, quiero visualizar los clientes asociados a mi ruta, para planificar mis visitas y gestionar mi cartera sin acceder a clientes de otros vendedores.

**Aceptación:**

- Dado un vendedor autenticado, cuando accede a su ruta, entonces el sistema muestra la lista de clientes asignados con sus datos principales (nombre, dirección, contacto).
- El vendedor solo visualiza los clientes de su propia cartera (RNF-08).
- La lista refleja de inmediato los clientes nuevos registrados por el vendedor.

## HU-05

**Consultar bidones vacíos** · RF-19 · Vendedor

Como vendedor, quiero consultar la cantidad de bidones vacíos registrados durante mi ruta, para controlar los envases recuperados que debo devolver al finalizar la jornada.

**Aceptación:**

- Dado un vendedor autenticado, cuando consulta los bidones vacíos, entonces el sistema muestra la cantidad acumulada durante su jornada.
- El contador es consistente con los envases registrados en las ventas y devoluciones de la ruta.
- El vendedor solo visualiza los envases de su propia ruta (RNF-08).

## HU-06

**Generar boleta o factura** · RF-20 · Vendedor

Como vendedor, quiero generar una boleta o factura al momento de realizar una venta, para entregar el documento tributario al cliente cuando lo solicite.

**Aceptación:**

- Dada una venta confirmada, cuando el vendedor selecciona generar documento y elige boleta o factura, entonces el sistema emite el documento con los datos de la venta.
- El documento incluye: cliente, productos, cantidades, precios unitarios, descuentos aplicados, total, método de pago, fecha y folio identificador.
- El documento generado queda asociado a la venta y disponible para consulta posterior.

## HU-07

**Registrar gasto extra** · RF-21 · Vendedor

Como vendedor, quiero registrar los gastos adicionales efectuados durante la jornada adjuntando una foto o documento de respaldo, para justificar los egresos que se descuentan del dinero recaudado en el día.

**Aceptación:**

- Dado un vendedor autenticado, cuando ingresa el monto, el motivo del gasto y adjunta la foto o documento de respaldo, entonces el sistema registra el gasto asociado a su jornada con fecha y hora (RNF-11, RNF-12).
- El sistema permite adjuntar una imagen como comprobante (foto de boleta, vale de combustible u otro documento).
- El sistema advierte si falta el monto o el motivo del gasto (RNF-25).
- El gasto registrado se consolida como egreso del día en los reportes de administración (HU-14).
- El gasto no puede ser modificado ni eliminado por el vendedor una vez registrado (RNF-10, RNF-14).

## HU-08

**Visualizar ranking de vendedores** · RF-22 · Vendedor / Administrador

Como vendedor, quiero visualizar el ranking de vendedores según ventas o desempeño, para conocer mi posición dentro del equipo y fomentar la competencia interna.

**Aceptación:**

- Dado un usuario autenticado, cuando accede al ranking, entonces el sistema muestra la lista ordenada de vendedores según sus ventas o desempeño del periodo seleccionado.
- El ranking se calcula automáticamente a partir de las ventas registradas en el sistema.
- El ranking muestra posiciones y resultados agregados, sin exponer el detalle de clientes ni de ventas individuales de otros vendedores (RNF-08).

## HU-09

**Visualizar mi comisión** · RF-26 · Vendedor

Como vendedor, quiero que el sistema calcule y muestre automáticamente mi comisión durante la jornada, para conocer mi ganancia acumulada según lo vendido.

**Aceptación:**

- Dado un vendedor autenticado con ventas registradas, cuando consulta su comisión, entonces el sistema muestra el monto calculado según las reglas de comisión vigentes por tipo de producto.
- El cálculo se actualiza automáticamente con cada venta registrada.
- El vendedor solo visualiza su propia comisión (RNF-08).
