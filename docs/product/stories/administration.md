# Administración

Criterios del producto; consultar [requisitos](../requirements.md) y [estado de implementación](../../status/user-stories.md) sin confundirlos con validación de producción.

## HU-10

**Gestionar usuarios** · RF-03 · Administrador

Como administrador, quiero crear, modificar, habilitar y deshabilitar usuarios, para controlar el acceso al sistema según el rol de cada trabajador.

**Aceptación:**

- Dado un administrador autenticado, cuando crea un usuario indicando nombre, credenciales y rol (Vendedor, Bodega/Despacho, Producción o Administrador), entonces el sistema habilita el acceso con las funcionalidades propias de ese rol (RNF-07, RNF-08).
- El administrador puede modificar datos, cambiar el rol y deshabilitar usuarios sin eliminarlos, conservando su historial de registros.
- Un usuario deshabilitado no puede ingresar al sistema, pero sus registros históricos se conservan (RNF-14).
- El sistema permite incorporar nuevos usuarios sin rediseño, soportando el crecimiento del equipo (de 4 a 6 vendedores el próximo año) (RNF-16).

## HU-11

**Consultar historial del cliente** · RF-04 · Administrador

Como administrador, quiero consultar las ventas, visitas y movimientos históricos asociados a cada cliente, para conocer su comportamiento y respaldar decisiones comerciales.

**Aceptación:**

- Dado un administrador autenticado, cuando selecciona un cliente y accede a su historial, entonces el sistema muestra las ventas, visitas y movimientos registrados, ordenados por fecha.
- El historial incluye montos, productos, cantidades y el vendedor que atendió cada operación.
- El historial es de solo lectura; las correcciones se realizan sobre los registros originales mediante HU-13.

## HU-12

**Recibir alertas de clientes inactivos** · RF-05 · Administrador

Como administrador, quiero recibir alertas de los clientes que no han comprado durante un periodo determinado, para contactarlos y averiguar el motivo de la inactividad (mal servicio, pérdida frente a la competencia, etc.).

**Aceptación:**

- Dado un cliente que supera el periodo configurado sin compras, cuando el sistema detecta la inactividad, entonces genera una alerta visible para el administrador.
- El periodo de inactividad es configurable (por defecto, una semana) (RNF-26).
- La alerta identifica al cliente, su vendedor asignado y la fecha de su última compra.
- El administrador puede revisar el listado completo de clientes inactivos.

## HU-13

**Modificar registros con trazabilidad** · RF-23 · Administrador

Como administrador, quiero corregir registros ingresados por otros usuarios (ventas, despachos, producción, gastos), dejando trazabilidad de cada modificación, para mantener la información confiable sin perder el historial de cambios.

**Aceptación:**

- Dado un administrador autenticado, cuando modifica un registro ya ingresado y confirma la corrección, entonces el sistema guarda el cambio conservando el valor anterior, el valor nuevo, la fecha/hora y el usuario que modificó (RNF-12, RNF-13).
- Ningún otro rol puede modificar registros cerrados; los intentos son bloqueados por el sistema (RNF-10).
- Los registros operacionales no se eliminan físicamente: solo se anulan o corrigen dejando trazabilidad (RNF-14).
- El historial de modificaciones de cada registro es consultable (RNF-13).

## HU-14

**Visualizar reportes de ventas** · RF-24 · Administrador

Como administrador, quiero consultar reportes generales y detallados de ventas según parámetros como fecha, vendedor y producto, para monitorear los ingresos del negocio en tiempo real desde cualquier dispositivo.

**Aceptación:**

- Dado un administrador autenticado, cuando selecciona los parámetros de consulta (rango de fechas, vendedor, producto), entonces el sistema muestra el reporte con totales y detalle de ventas (RNF-21).
- El reporte diario refleja los ingresos en tiempo real a medida que los vendedores registran ventas (RNF-03).
- Los reportes consolidan información diaria, semanal y mensual.
- El reporte es accesible desde computador, tablet o teléfono (RNF-05, RNF-24).

## HU-15

**Configurar comisiones** · RF-25 · Administrador

Como administrador, quiero definir porcentajes, montos y reglas para el cálculo de comisiones, para ajustar los incentivos del equipo sin modificar el código del sistema.

**Aceptación:**

- Dado un administrador autenticado, cuando modifica los porcentajes o montos de comisión (por ejemplo, por tipo de producto: bidón, hielo) y guarda, entonces el sistema aplica las nuevas reglas en los cálculos posteriores (RNF-26).
- Los cambios de configuración no requieren modificación de código ni redespliegue.
- Las comisiones calculadas con anterioridad conservan las reglas vigentes al momento de su cálculo.

## HU-16

**Monitorear vendedores en terreno** · RF-27 · Administrador

Como administrador, quiero visualizar la ubicación de los vendedores mediante GPS durante la jornada, para supervisar la operación en tiempo real.

**Aceptación:**

- Dado un administrador autenticado, cuando accede al monitoreo, entonces el sistema muestra en un mapa la última ubicación conocida de cada vendedor activo.
- La ubicación se actualiza periódicamente durante la jornada, cuando el dispositivo dispone de conexión.
- Solo el administrador tiene acceso a esta funcionalidad (RNF-08).

## HU-17

**Gestionar catálogo de productos** · RF-28 · Administrador

Como administrador, quiero mantener un catálogo único de productos (tipos de bidón, agua y hielo), para asegurar que todos los módulos registren operaciones con los mismos productos y precios base.

**Aceptación:**

- Dado un administrador autenticado, cuando crea, edita o desactiva un producto del catálogo (nombre, tipo, precio base), entonces el cambio queda disponible para los módulos de ventas, despacho y producción.
- El catálogo es único y centralizado: todos los registros del sistema referencian productos del catálogo (RNF-29).
- Un producto con movimientos asociados no se elimina; solo puede desactivarse (RNF-14).
