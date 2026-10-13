# Bodega y despacho

Criterios del producto; consultar [requisitos](../requirements.md) y [estado de implementación](../../status/user-stories.md) sin confundirlos con validación de producción.

## HU-24

**Consultar stock** · RF-11 · Bodega / Despacho

Como despachador, quiero consultar el stock disponible de productos y envases, para saber cuánto puedo asignar a cada vendedor, especialmente en temporada alta.

**Aceptación:**

- Dado un despachador autenticado, cuando accede al stock, entonces el sistema muestra las cantidades disponibles por producto y envase.
- El stock se actualiza automáticamente: suma con producción y devoluciones; resta con despachos y mermas (RNF-03).

## HU-25

**Registrar despacho** · RF-12 · Bodega / Despacho

Como despachador, quiero registrar los productos entregados a cada vendedor al comenzar su ruta, para que el stock se descuente automáticamente y quede constancia digital de la carga asignada.

**Aceptación:**

- Dado un despachador autenticado, cuando selecciona el vendedor, indica productos y cantidades entregadas y confirma, entonces el sistema registra el despacho con fecha, hora de salida y responsable, y descuenta automáticamente las cantidades del stock de bodega (RNF-11, RNF-12).
- El sistema valida que las cantidades despachadas no superen el stock disponible (RNF-25).
- El despacho queda asignado como carga del vendedor, visible para él (HU-03).
- El despacho registrado no puede eliminarse; solo es ajustable dentro de la ventana de ajuste (HU-26) o corregible por el administrador (RNF-14).

## HU-26

**Modificar despacho dentro de la ventana de ajuste** · RF-13, RNF-15 · Bodega / Despacho

Como despachador, quiero sumar productos adicionales a un despacho durante los primeros 10 a 20 minutos posteriores a su registro, para reflejar cargas de último minuto sin alterar lo ya registrado.

**Aceptación:**

- Dado un despacho registrado dentro del plazo de ajuste, cuando el despachador agrega productos adicionales y confirma, entonces el sistema suma las cantidades al despacho y las descuenta del stock.
- Pasado el plazo (configurable entre 10 y 20 minutos), el sistema bloquea cualquier ajuste sobre el despacho (RNF-15, RNF-26).
- La ventana solo permite **sumar** productos; no se puede restar ni editar lo ya registrado.
- Cada ajuste queda registrado con fecha, hora y responsable (RNF-11, RNF-12, RNF-13).

## HU-27

**Registrar devolución de productos** · RF-14 · Bodega / Despacho

Como despachador, quiero registrar los productos no vendidos que el vendedor devuelve al finalizar la ruta, para reingresarlos al stock y cuadrar la jornada del vendedor.

**Aceptación:**

- Dado un vendedor que finaliza su ruta, cuando el despachador registra los productos devueltos y confirma, entonces el sistema reingresa las cantidades al stock de bodega y las asocia a la jornada del vendedor.
- La devolución queda disponible para el cuadre entre lo despachado, lo vendido y lo devuelto de cada vendedor.

## HU-28

**Registrar devolución de envases** · RF-15 · Bodega / Despacho

Como despachador, quiero registrar los envases vacíos devueltos por cada vendedor, para mantener actualizado el inventario de envases disponibles para producción.

**Aceptación:**

- Dado un vendedor que finaliza su ruta, cuando el despachador registra los envases vacíos devueltos y confirma, entonces el sistema suma las cantidades al inventario de envases vacíos disponibles.
- La devolución queda asociada al vendedor y a su jornada, con fecha, hora y responsable (RNF-11, RNF-12).

## HU-29

**Registrar mermas** · RF-16 · Bodega / Despacho

Como despachador, quiero registrar los productos dañados, perdidos o no aptos para la venta, para que el sistema refleje con precisión cuánto se vendió, cuánto se perdió y cuánto queda realmente en stock.

**Aceptación:**

- Dado un despachador autenticado, cuando registra una merma indicando producto, cantidad y motivo, entonces el sistema descuenta las unidades del stock disponible sin reingresarlas.
- El motivo de la merma es obligatorio (por ejemplo: bidón roto, bolsa de hielo rota) (RNF-25).
- La merma queda asociada a la jornada correspondiente y se considera en el cuadre de movimientos del día.
