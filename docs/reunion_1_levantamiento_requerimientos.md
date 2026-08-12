**Reunión de levantamiento de requerimientos**

*Sistema de gestión de ventas, producción y bodega — Ondina*

A continuación se presenta la transcripción ordenada por temas de la reunión sostenida entre el equipo de desarrollo y el cliente (empresa distribuidora de agua embotellada y hielo, operando bajo los nombres Ondina y Agroplan), con el objetivo de levantar los requerimientos para un futuro sistema de gestión.

# 1\. Situación actual: registro manual de ventas

Actualmente la empresa gestiona sus ventas mediante planillas físicas que llena cada vendedor. Cuentan con cuatro vendedores, cada uno con su propia ruta de venta y cartera de clientes ya designada; se espera incorporar dos vendedores adicionales el próximo año para expandir la cobertura de rutas.

En las planillas se registra el nombre del cliente, la cantidad de bidones (policarbonatos y plásticos) y bolsas de hielo entregadas, y el precio cobrado en cada caso. El precio estándar de los bidones ronda los 1.000 pesos (pudiendo llegar a 1.100–2.000 en algunos departamentos), y el hielo entre 400 y 500 pesos, según el cliente. Al finalizar la jornada se suma el total de policarbonato, plástico y hielo vendido para calcular la comisión de cada vendedor, y el vendedor entrega el efectivo correspondiente al total de la venta.

Todo este registro se consolida hoy en planillas física que luego pasan a un Excel, de forma diaria, semanal y mensual. La responsable indicó que este método tiene un problema central: no permite visibilidad en tiempo real. No es posible saber, por ejemplo, cuántos productos exactos se entregaron a un cliente ni a qué precio real, ya que los choferes manejan directamente esa relación con el cliente y pueden hacer pasar una venta como si hubiera sido a precio estándar cuando en realidad se cobró distinto. Además, el Excel es manipulable, lo que dificulta llevar un control fiable.

# 2\. Objetivo del sistema: visibilidad en tiempo real

La necesidad principal planteada por el cliente es poder ver la venta en tiempo real, para que tanto ella como su hermana Beatriz y su padre puedan monitorear la operación en línea sin depender de que los vendedores regresen a la planta a rendir cuentas. Se aclaró que esto no requeriría necesariamente que cada cliente final tenga computador, ya que el registro lo haría el vendedor o chofer desde su propio dispositivo.

El sistema se plantea con arquitectura de tipo ERP, funcionando por módulos independientes pero interconectados. En una primera etapa se acordó enfocarse en tres módulos principales: ventas, producción y bodega/despacho, dejando para una etapa posterior el módulo administrativo completo (sueldos, gastos generales, etc.), aunque sí se busca que el área administrativa pueda visualizar en la nube, en tiempo real, el total de ingresos diarios generados por las ventas.

# 

# 3\. Módulo de ventas y clientes

Cada vendedor debe poder registrar sus ventas desde el terreno, idealmente desde una tablet, ingresando cliente, productos entregados (bidones, hielo) y precio cobrado, además de la forma de pago (efectivo o transferencia), permitiendo generar boleta o factura al momento si el cliente la solicita.

Un requerimiento clave es la alerta de clientes inactivos: si un cliente que normalmente pide a diario deja de hacerlo durante una semana, el sistema debe notificarlo automáticamente, para que la responsable pueda contactarlo y averiguar el motivo (mal servicio del chofer, pérdida del cliente frente a la competencia, etc.).

También se solicitó un apartado de reportes o informes periódicos (semanales o mensuales) por vendedor, que muestre cuántos clientes atendió, cuántos se sumaron, cuántos se perdieron y el detalle de lo vendido — información que permitiría decidir a qué clientes priorizar visitar.

Sobre el registro de clientes: deben quedar todos registrados en el sistema, incluyendo tanto los clientes fijos (que se dividen en mayoristas y minoristas, descritos como "piramidales") como los ocasionales. La ficha de cliente debe incluir nombre completo, contacto, dirección y número del local.

Actualmente los pedidos nuevos llegan por tres líneas de contacto distintas (llamadas y WhatsApp) que muchas veces no se atienden a tiempo. Se busca centralizar la recepción de pedidos en un solo punto — en recepción o directamente con la responsable — para luego asignarlos manualmente al vendedor con menor carga de clientes en ese momento.

Sobre las rutas: cada vendedor tiene clientes ya asignados y respeta la cartera del resto, aunque distintos vendedores pueden operar en un mismo sector geográfico (no se dividen estrictamente por zona, sino por cliente). Las rutas van variando a medida que se suman nuevos clientes.

Como referencia de sistemas similares que ya existen en el mercado, se mencionaron empresas como Pesovar y Luqué, Coca-Cola y CCU, que manejan este mismo modelo de ruta y venta directa. También se mencionó el caso de Soprodi (venta de alimento para mascotas), que trabaja con un sistema de metas de venta mensuales por vendedor, generando una suerte de ranking o competencia interna — modelo que el cliente ve como un posible incentivo o gratificación a futuro.

# 4\. Módulo de producción y bodega

Se requiere que el sistema permite saber en tiempo real cuánto se está produciendo y cuánto queda en stock en bodega, tanto de bidones como de hielo. La máquina de hielo produce por descargas, y cada descarga (aproximadamente 50 unidades) debe quedar registrada para ir sumando al stock de bodega; a medida que se despacha para la venta, ese stock se debe ir restando automáticamente.

Este control es especialmente importante en las temporadas altas (carnaval, año nuevo), donde se vende gran parte del stock, principalmente hielo, y la responsable necesita poder distribuir la cantidad disponible en partes iguales entre los vendedores sin tener que llamar a producción a preguntar cuánto queda.

También se debe registrar la merma (por ejemplo, un bidón o una bolsa de hielo que se rompe), de forma que el sistema refleje con precisión cuánto se vendió, cuánto se perdió por merma y cuánto queda realmente en stock.

# 5\. Despacho y control de camiones

En bodega existe además una planilla de despacho que utiliza la encargada de esa área: se registra la hora de salida de cada chofer, la hora de regreso, lo que se llevó lleno y lo que trajo vacío, y finalmente el total vendido, cifra que debe coincidir con lo registrado en la planilla de ventas de cada vendedor.

El objetivo de digitalizar este proceso es evitar los borrones y las correcciones posteriores en la planilla física (por ejemplo, un chofer que firma haber sacado una cantidad y luego dice que en realidad se llevó otra). Se plantea permitir un margen breve de 15 a 20 minutos después del despacho para poder sumar productos adicionales (por ejemplo, si a último momento se decide cargar más bidones), pero sin permitir modificar o restar lo ya registrado una vez pasado ese margen — solo permitir sumatoria, no edición retroactiva del despacho original.

# 6\. Roles, permisos y control de manipulación de datos

Se identificaron inicialmente cuatro roles: vendedor, bodega, producción y administrador. Cada rol debe poder registrar únicamente la información propia de su función (ventas, movimientos de bodega, producción), mientras que solo el rol de administrador debe tener permiso para modificar registros o corregir planillas ya ingresadas, además de poder ver el historial completo de todos los movimientos. El resto de los roles solo debería poder visualizar su propio historial, sin capacidad de edición, para evitar que un conductor o vendedor altere datos ya registrados.

# 7\. Gastos operativos asociados a la venta

Se explicó que los choferes a veces cubren gastos operativos directamente desde el dinero de la venta del día — por ejemplo, reparaciones de emergencia de la camioneta, cambio de una rueda, o combustible cuando no alcanzaron a cargar en la planta. Todo esto se anota hoy como "gasto extra" en la planilla, respaldado con boletas cuando corresponde (los llamados "vales" de combustible que se compran en la planta).

Al cierre de cada jornada, la responsable registra en la planilla tanto lo que ingresó (venta) como lo que salió (gastos y comisiones), incluyendo la comisión de bidón y de hielo pagada al chofer y al ayudante o "pionetas" (se mencionó como ejemplo una comisión total de 23.300 pesos, con pagos de 23 y 20 mil pesos respectivamente). Este mismo criterio de separar ingresos y egresos por jornada, y consolidarlo semanal y mensualmente, es el que se espera que el sistema automatice.

# 

# 

# 8\. Alcance de administración y separación de áreas

El cliente identificó tres áreas dentro del negocio: administración, ventas y producción, cada una a cargo de una persona distinta de la familia (la responsable está a cargo de ventas; su hermana, de producción). Aunque el primer entregable se enfocará en ventas, producción y bodega, se aclaró que administración también necesita visibilidad sobre lo que ingresa por ventas y lo que se produce diariamente, aunque el detalle de gastos de sueldo y otros gastos administrativos pueda quedar para una etapa posterior del proyecto.

Actualmente, existen dos cajas separadas: Agroplan y Ondina, siendo esta última la de interés principal para este proyecto.

# 9\. Plataforma e infraestructura

Se definió que el sistema debe ser accesible principalmente desde tablets para los choferes/vendedores y para el personal de producción y despacho, permitiendo ingresar datos en tiempo real desde terreno o desde la planta. La empresa no cuenta actualmente con ningún tipo de servidor propio, por lo que la infraestructura deberá construirse completamente desde cero. Se conversó también sobre la posibilidad de desplegar el sistema de forma que no dependa exclusivamente de la nube, para que el personal pueda seguir registrando información aun sin conexión a internet en ciertos puntos.

# 10\. Alcance de la primera entrega y próximos pasos

El equipo de desarrollo propuso un enfoque incremental: entregar primero un producto funcional con los requerimientos mínimos más importantes (los tres módulos centrales: ventas, gestión de inventario/bodega y despacho), para luego, en base al feedback del cliente sobre esta primera versión, incorporar en una segunda etapa funcionalidades adicionales como el seguimiento más detallado de gastos operativos, el módulo administrativo completo, y otros requerimientos que vayan surgiendo.

Se acordó realizar una segunda reunión (tentativamente jueves o viernes de esa semana) en la que el equipo de desarrollo presentará una propuesta preliminar — incluyendo un boceto de cómo se vería el sistema — junto con un presupuesto estimado, para que el cliente pueda revisarlo, hacer observaciones o correcciones antes de comenzar formalmente las etapas de diseño y desarrollo.

