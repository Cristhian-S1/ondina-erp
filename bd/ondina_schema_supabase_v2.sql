-- Ondina - esquema relacional mínimo para Supabase
-- Propuesta v2: tablas, relaciones, restricciones y reglas esenciales.
-- No incluye vistas, datos semilla, configuración de Storage ni funciones de reportes.
-- Aplicar primero en un proyecto Supabase aislado y convertir a migraciones antes de producción.
--
-- IDEA GENERAL
-- Este archivo define el núcleo relacional del negocio. Las tablas describen quién
-- opera, qué productos existen, qué se encuentra en bodega, qué sale a ruta,
-- qué se vende, qué retorna y qué se produce. No intenta resolver en este mismo
-- archivo toda la aplicación: reportes, pantallas y automatizaciones se agregan
-- mediante migraciones separadas después de validar los flujos con el equipo.
--
-- FLUJO PRINCIPAL
-- 1. Producciones aumenta stock_bodega.
-- 2. Un despacho mueve productos desde stock_bodega a carga_vendedor.
-- 3. Una venta descuenta carga_vendedor y puede registrar envases recibidos.
-- 4. Devoluciones, mermas y ajustes corrigen las existencias sin borrar historia.
-- Cada movimiento operativo queda asociado a una sucursal para separar stock,
-- ventas, despachos y producción entre las distintas sedes de la empresa.
-- Las operaciones anteriores deben ejecutarse en transacciones y con RLS; los
-- comentarios de reglas al final documentan la lógica que implementarán triggers
-- o funciones RPC en una migración posterior.

begin;

create extension if not exists pgcrypto;

-- IDENTIDAD Y CATÁLOGOS
-- `perfiles` complementa a auth.users. Supabase Auth conserva la contraseña;
-- aquí solo se guarda la información necesaria para autorización y operación.
-- Una sucursal representa una sede física de Ondina. Es la entidad que separa
-- existencias y movimientos operativos; configuración y catálogo siguen siendo
-- globales salvo que una futura regla de negocio indique lo contrario.
create table sucursales (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    direccion text,
    comuna text,
    region text,
    telefono text,
    activa boolean not null default true,
    creado_en timestamptz not null default now()
);

-- Supabase Auth administra las contraseñas. Esta tabla solo guarda el perfil operativo.
create table perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    sucursal_id uuid not null references sucursales(id),
    nombres text not null,
    apellidos text not null,
    rut text unique,
    telefono text,
    rol text not null check (rol in ('vendedor', 'bodega', 'produccion', 'administrador')),
    activo boolean not null default true,
    creado_en timestamptz not null default now(),
    unique (id, sucursal_id)
);

-- Un producto puede utilizar un tipo de envase retornable o no retornable.
create table tipos_empaque (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    categoria text not null check (categoria in ('retornable', 'no_retornable')),
    activo boolean not null default true
);

-- El precio base es referencial. El precio cobrado realmente se congela en
-- venta_detalles.precio_unitario para conservar el historial de cada venta.
create table productos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    tipo text not null check (tipo in ('agua', 'hielo')),
    tipo_empaque_id uuid references tipos_empaque(id),
    precio_base numeric(12, 2) not null check (precio_base >= 0),
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

-- La cartera pertenece a un vendedor, pero la trazabilidad de creación y edición
-- conserva también qué perfil realizó cada operación. La sucursal se guarda de
-- forma explícita para consultar carteras y reportes por sede sin inferencias.
create table clientes (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    vendedor_id uuid not null,
    nombre text not null,
    telefono text,
    direccion text not null,
    numero_local text,
    tipo text not null default 'minorista'
        check (tipo in ('mayorista', 'minorista', 'ocasional')),
    activo boolean not null default true,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now(),
    modificado_por uuid references perfiles(id),
    modificado_en timestamptz,
    foreign key (vendedor_id, sucursal_id) references perfiles(id, sucursal_id),
    unique (id, sucursal_id)
);

-- CONFIGURACIÓN Y COMISIONES
-- Se guardan como datos para no tener que publicar una nueva versión del frontend
-- cuando cambie la ventana de ajuste o una regla comercial.
-- Los parámetros se modifican desde la aplicación por administración.
create table configuracion (
    clave text primary key,
    valor text not null,
    descripcion text,
    modificado_por uuid references perfiles(id),
    modificado_en timestamptz
);

-- Las reglas tienen vigencia para que una comisión histórica no cambie cuando el
-- administrador configure una regla nueva.
create table reglas_comision (
    id uuid primary key default gen_random_uuid(),
    tipo_producto text not null check (tipo_producto in ('agua', 'hielo')),
    porcentaje numeric(5, 2) check (porcentaje >= 0),
    monto_fijo numeric(12, 2) check (monto_fijo >= 0),
    vigente_desde timestamptz not null default now(),
    vigente_hasta timestamptz,
    creado_por uuid references perfiles(id),
    check (porcentaje is not null or monto_fijo is not null),
    check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

-- EXISTENCIAS
-- Estas tablas son saldos actuales, no un libro histórico. Los movimientos que
-- producen esos saldos son ventas, despachos, devoluciones, mermas y producción.
-- La sucursal forma parte de la clave porque el mismo producto puede tener saldos
-- distintos en dos sedes.
create table stock_bodega (
    sucursal_id uuid not null references sucursales(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null default 0 check (cantidad >= 0),
    modificado_en timestamptz not null default now(),
    primary key (sucursal_id, producto_id)
);

-- Los envases se controlan por separado porque pueden regresar aunque el producto
-- vendido sea agua o hielo y porque un envase malo se transforma en merma.
create table stock_envases (
    sucursal_id uuid not null references sucursales(id),
    tipo_empaque_id uuid not null references tipos_empaque(id),
    cantidad integer not null default 0 check (cantidad >= 0),
    modificado_en timestamptz not null default now(),
    primary key (sucursal_id, tipo_empaque_id)
);

-- La clave compuesta impide tener dos saldos para el mismo producto y vendedor.
-- No se repite sucursal_id: el vendedor ya pertenece a una sucursal mediante
-- perfiles.sucursal_id, que es la única fuente de verdad para su carga.
create table carga_vendedor (
    vendedor_id uuid not null references perfiles(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null default 0 check (cantidad >= 0),
    modificado_en timestamptz not null default now(),
    primary key (vendedor_id, producto_id)
);

-- VENTAS
-- La cabecera identifica cliente, vendedor y medio de pago. Los detalles contienen
-- cantidades y precios reales; así cambiar productos.precio_base no altera ventas
-- anteriores. Las claves foráneas compuestas obligan a que vendedor, cliente y
-- venta pertenezcan a la misma sucursal. La anulación conserva el registro.
create table ventas (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    vendedor_id uuid not null,
    cliente_id uuid not null,
    metodo_pago text not null check (metodo_pago in ('efectivo', 'transferencia')),
    tipo_documento text check (tipo_documento in ('boleta', 'factura')),
    folio_documento text,
    descuento numeric(12, 2) not null default 0 check (descuento >= 0),
    total numeric(12, 2) not null default 0 check (total >= 0),
    observaciones text,
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now(),
    modificado_por uuid references perfiles(id),
    modificado_en timestamptz,
    check (tipo_documento is null or folio_documento is not null),
    unique (tipo_documento, folio_documento),
    foreign key (vendedor_id, sucursal_id) references perfiles(id, sucursal_id),
    foreign key (cliente_id, sucursal_id) references clientes(id, sucursal_id)
);

-- subtotal es calculado por PostgreSQL para evitar que frontend y base de datos
-- mantengan fórmulas diferentes.
create table venta_detalles (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references ventas(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    envases_recibidos integer not null default 0 check (envases_recibidos >= 0),
    subtotal numeric(12, 2) generated always as (cantidad * precio_unitario) stored
);

-- Los comprobantes se suben a Supabase Storage; la tabla solo conserva su URL.
create table gastos_extras (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    vendedor_id uuid not null,
    tipo text not null default 'otra'
        check (tipo in ('combustible', 'averia', 'otra')),
    monto numeric(12, 2) not null check (monto > 0),
    motivo text not null,
    comprobante_url text,
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now(),
    modificado_por uuid references perfiles(id),
    modificado_en timestamptz,
    foreign key (vendedor_id, sucursal_id) references perfiles(id, sucursal_id)
);

-- DESPACHO Y CIERRE DE RUTA
-- Un despacho representa la salida de productos hacia un vendedor. No se editan
-- cantidades históricas: un ajuste se registra como una nueva fila en detalles.
-- Las claves compuestas impiden despachar entre sucursales distintas.
create table despachos (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    vendedor_id uuid not null,
    despachador_id uuid not null,
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now(),
    modificado_por uuid references perfiles(id),
    modificado_en timestamptz,
    unique (id, sucursal_id),
    foreign key (vendedor_id, sucursal_id) references perfiles(id, sucursal_id),
    foreign key (despachador_id, sucursal_id) references perfiles(id, sucursal_id)
);

-- `es_ajuste` permite distinguir la carga inicial de una suma posterior dentro de
-- la ventana configurada. La validación temporal no se deja a la interfaz.
create table despacho_detalles (
    id uuid primary key default gen_random_uuid(),
    despacho_id uuid not null references despachos(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null check (cantidad > 0),
    es_ajuste boolean not null default false,
    creado_en timestamptz not null default now()
);

-- Las devoluciones son movimientos nuevos y nunca eliminan el despacho original.
create table devoluciones_productos (
    id uuid primary key default gen_random_uuid(),
    despacho_id uuid not null references despachos(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null check (cantidad > 0),
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now()
);

-- Un envase puede retornar en buen o mal estado; los malos no vuelven a stock útil.
create table devoluciones_envases (
    id uuid primary key default gen_random_uuid(),
    despacho_id uuid not null references despachos(id),
    tipo_empaque_id uuid not null references tipos_empaque(id),
    cantidad integer not null check (cantidad > 0),
    estado text not null default 'bueno' check (estado in ('bueno', 'malo')),
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now()
);

-- Una merma afecta exactamente a un producto o a un tipo de envase. Puede ocurrir
-- en una ruta (`despacho_id`) o en planta cuando ese dato queda vacío.
create table mermas (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    despacho_id uuid,
    producto_id uuid references productos(id),
    tipo_empaque_id uuid references tipos_empaque(id),
    cantidad integer not null check (cantidad > 0),
    motivo text not null,
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now(),
    check ((producto_id is not null) <> (tipo_empaque_id is not null)),
    foreign key (despacho_id, sucursal_id) references despachos(id, sucursal_id)
);

-- PRODUCCIÓN Y OPERACIÓN EN TERRENO
-- Cada producción representa una entrada de producto terminado a bodega.
create table producciones (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references sucursales(id),
    producto_id uuid not null references productos(id),
    cantidad integer not null check (cantidad > 0),
    observaciones text,
    anulado boolean not null default false,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now()
);

-- Una incidencia puede relacionarse con una producción concreta o ser general de
-- la jornada cuando produccion_id es null.
create table incidencias_produccion (
    id uuid primary key default gen_random_uuid(),
    produccion_id uuid references producciones(id),
    descripcion text not null,
    creado_por uuid not null references perfiles(id),
    creado_en timestamptz not null default now()
);

-- Se conserva cada posición reportada para que administración pueda consultar el
-- recorrido; no se reemplaza la última posición porque el historial es útil.
create table ubicaciones_vendedores (
    id bigint generated always as identity primary key,
    vendedor_id uuid not null references perfiles(id),
    latitud numeric(9, 6) not null check (latitud between -90 and 90),
    longitud numeric(9, 6) not null check (longitud between -180 and 180),
    registrado_en timestamptz not null default now()
);

-- AUDITORÍA
-- registro_id no tiene FK porque auditoria registra tablas distintas. La pareja
-- (tabla, registro_id) identifica el objeto auditado y los JSON guardan el antes
-- y después de una modificación.
create table auditoria (
    id bigint generated always as identity primary key,
    tabla text not null,
    registro_id uuid not null,
    accion text not null check (accion in ('INSERT', 'UPDATE', 'ANULACION')),
    usuario_id uuid references perfiles(id),
    valores_anteriores jsonb,
    valores_nuevos jsonb,
    creado_en timestamptz not null default now()
);

-- REGLAS DE NEGOCIO PENDIENTES DE IMPLEMENTAR COMO MIGRACIONES/RPC/TRIGGERS
-- Estas reglas no se deben implementar solo en React, porque un cliente puede
-- intentar llamar directamente la API de Supabase.
-- 1. Solo administración puede modificar o anular operaciones cerradas.
-- 2. Un despacho solo admite nuevas filas es_ajuste dentro de configuracion.
-- 3. Despacho descuenta stock_bodega y suma carga_vendedor.
-- 4. Venta descuenta carga_vendedor y recibe envases en stock_envases.
-- 5. Devoluciones y producción actualizan existencias; una merma descuenta existencias.
-- 6. Las operaciones anuladas no se borran y todos sus cambios se registran en auditoria.
-- 7. RLS debe habilitarse en todas las tablas expuestas; la UI no es una barrera de seguridad.

alter table perfiles enable row level security;
alter table sucursales enable row level security;
alter table tipos_empaque enable row level security;
alter table productos enable row level security;
alter table clientes enable row level security;
alter table configuracion enable row level security;
alter table reglas_comision enable row level security;
alter table stock_bodega enable row level security;
alter table stock_envases enable row level security;
alter table carga_vendedor enable row level security;
alter table ventas enable row level security;
alter table venta_detalles enable row level security;
alter table gastos_extras enable row level security;
alter table despachos enable row level security;
alter table despacho_detalles enable row level security;
alter table devoluciones_productos enable row level security;
alter table devoluciones_envases enable row level security;
alter table mermas enable row level security;
alter table producciones enable row level security;
alter table incidencias_produccion enable row level security;
alter table ubicaciones_vendedores enable row level security;
alter table auditoria enable row level security;

commit;
