Bodega

En el área de bodega, al presionar el botón "Nuevo despacho" y seleccionar un producto, aparece un mensaje debajo del selector que indica su disponibilidad mediante el mensaje "Disponible en bodega: xx". Ese mensaje desalinea el input de Producto con la Cantidad y no se ve bien. Propongo que, cuando aparezca el mensaje de disponibilidad, el input de cantidad se alinee con el input de producto; además, debe validarse que solo se puedan agregar un máximo de 6 productos porque es la cantidad de productos disponibles. Si los productos fueran 7 o 10, entonces el frontend debería poder adaptarse a eso y que la validación siga funcionando.

En devoluciones, me gusta cómo están los inputs; falta validar para que no puedan ingresar texto en inputs numéricos (esto va para todo el frontend). La devolución de "PRODUCTOS DEL DESPACHO" valida que no se pueda devolver más de lo que se tiene correctamente mediante un mensaje de error. En la devolución de "ENVASES" se permite registrar +1000 envases de bidón de 10 L aunque en bodega solo existan 994 y en despachadas ninguno. ¿Es esto un comportamiento normal y aceptable? 

Vendedor

En la sección de "Registrar venta" está correctamente validado para que se pueda ingresar un máximo de 6 productos por venta; también debería seguir la misma lógica que se mencionó en el módulo de Bodega. La columna con los inputs de CANTIDAD debería tener un input similar al que aparece en bodega, solo aceptar valores numéricos, un placeholder con valor cero y a la derecha del input unas flechas para ajustar unidades de 1 en 1.

Inputs numéricos como el que aparece en la columna de CANTIDAD tienen un formato de puntos del tipo 1.000.000 que permiten distinguir mucho mejor las unidades de mil y evitan errores de ingreso; este tipo de formato para los inputs numéricos ha de estar en todo el frontend.

Para los inputs numéricos que requieren validación por disponibilidad, me encanta el enfoque que ofrece "Registrar ventas" en los inputs de cantidad, donde detecta en tiempo real si la cantidad ingresada es válida o no de acuerdo a la cantidad disponible. Este tipo de implementación ha de implementarse en todo el frontend. Ese mensaje de error en tiempo real sí que puede desajustar el input con respecto al resto porque resalta mucho mejor dónde está el error; me encanta cómo lo lleva a cabo en Registrar ventas.

Producción 

Registrar producción debería tener un filtro para filtrar cuando la lista se vuelva muy grande, similar a como aparece en la sección de "Historial"; además, la sección de "Nueva producción" no debería crecer de la mano con los productos que se van registrando en "Producción reciente", a menos que sea algo deliberado con una justificación de implementación. 
