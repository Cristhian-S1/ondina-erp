-- ============================================================
-- 0001_init.sql — Baseline del esquema Ondina (estado aplicado)
-- ============================================================
-- Snapshot versionado del estado actualmente aplicado en la BD remota.
-- Los objetos ya existen en el entorno en uso; marcar como aplicada con:
--   supabase migration repair --status applied <hash_0001>
-- para que el flujo de migraciones no la reintente sobre la BD poblada.
--
-- Orden de composición (documentado en AGENTS.md):
-- 1) ondina_schema_supabase.sql (tablas, índices, enable RLS)
-- 2) rls_policies.sql (helpers es_rol/mi_sucursal + políticas)
-- 3) triggers_negocio.sql (stock, total, reversión por anulación)
-- 4) auditoria.sql (sello + fn_auditoria / fn_auditoria_simple)
-- 5) vistas.sql (v_stock_actual..v_ventas_producto)
-- 6) seed.sql (configuración + datos de prueba)


-- ============================================================
-- SECCIÓN 1 — ESQUEMA
-- ============================================================
-- Ondina - esquema relacional final para Supabase
-- Esquema definitivo: tablas, relaciones, restricciones y reglas esenciales.
-- No incluye vistas, datos semilla, configuración de Storage ni funciones de reportes;
-- esos objetos viven en archivos separados de bd/ (rls_policies.sql, triggers_negocio.sql,
-- auditoria.sql, vistas.sql y seed.sql).
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

-- Un producto puede utilizar un tipo de envase retornable, no retornable o de
-- uso interno (bandejas/cajas para transporte operativo interno).
create table tipos_empaque (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    categoria text not null check (categoria in ('retornable', 'no_retornable', 'uso_interno')),
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

-- ÍNDICES
-- Cubren los filtros más frecuentes de los reportes y la navegación operativa.
-- Las claves primarias compuestas ya indexan (sucursal_id, producto_id) en
-- stock_bodega/stock_envases y (vendedor_id, producto_id) en carga_vendedor.
create index if not exists idx_clientes_sucursal on public.clientes (sucursal_id);
create index if not exists idx_clientes_vendedor on public.clientes (vendedor_id);
create index if not exists idx_ventas_sucursal on public.ventas (sucursal_id);
create index if not exists idx_ventas_vendedor on public.ventas (vendedor_id);
create index if not exists idx_ventas_cliente on public.ventas (cliente_id);
create index if not exists idx_ventas_creado_en on public.ventas (creado_en);
create index if not exists idx_venta_detalles_venta on public.venta_detalles (venta_id);
create index if not exists idx_venta_detalles_producto on public.venta_detalles (producto_id);
create index if not exists idx_despachos_sucursal on public.despachos (sucursal_id);
create index if not exists idx_despachos_vendedor on public.despachos (vendedor_id);
create index if not exists idx_despachos_creado_en on public.despachos (creado_en);
create index if not exists idx_despacho_detalles_despacho on public.despacho_detalles (despacho_id);
create index if not exists idx_despacho_detalles_producto on public.despacho_detalles (producto_id);
create index if not exists idx_devoluciones_productos_despacho on public.devoluciones_productos (despacho_id);
create index if not exists idx_devoluciones_envases_despacho on public.devoluciones_envases (despacho_id);
create index if not exists idx_mermas_sucursal on public.mermas (sucursal_id);
create index if not exists idx_mermas_despacho on public.mermas (despacho_id);
create index if not exists idx_producciones_sucursal on public.producciones (sucursal_id);
create index if not exists idx_producciones_creado_en on public.producciones (creado_en);
create index if not exists idx_ubicaciones_vendedor on public.ubicaciones_vendedores (vendedor_id, registrado_en desc);
create index if not exists idx_auditoria_tabla_registro on public.auditoria (tabla, registro_id);
create index if not exists idx_auditoria_creado_en on public.auditoria (creado_en);

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


-- ============================================================
-- SECCIÓN 2 — POLÍTICAS RLS
-- ============================================================
-- Políticas RLS completas para Ondina
-- Ejecutar en Supabase: SQL Editor → New query → Run
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql
--
-- Modelo de roles: vendedor, bodega, produccion, administrador.
-- - vendedor: su cartera, sus ventas, sus despachos, su carga y su ubicación.
-- - bodega: stock, despachos, carga de vendedores y mermas.
-- - produccion: producciones e incidencias de producción.
-- - administrador: administración (perfiles, catálogos, configuración) y anulación.
-- Las operaciones operativas no se borran: se anulan con su columna `anulado`.

-- Helper: consulta el rol del usuario autenticado.
-- SECURITY DEFINER con search_path fijo para evitar recursión al leer perfiles.
create or replace function public.es_rol(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = p_rol and activo
  );
$$;

grant execute on function public.es_rol(text) to authenticated;

-- Helper: sucursal del usuario autenticado.
-- SECURITY DEFINER para usarse dentro de políticas sin recursión sobre perfiles.
create or replace function public.mi_sucursal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sucursal_id from perfiles where id = auth.uid();
$$;

grant execute on function public.mi_sucursal() to authenticated;

-- PERFILES
-- Cada usuario lee su propio perfil; administración administra los perfiles.
drop policy if exists "perfiles_select_propio" on perfiles;
create policy "perfiles_select_propio" on perfiles
  for select to authenticated
  using (
    auth.uid() = id
    or es_rol('administrador')
    or (
      es_rol('bodega')
      and sucursal_id = mi_sucursal()
    )
  );

drop policy if exists "perfiles_insert_admin" on perfiles;
create policy "perfiles_insert_admin" on perfiles
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "perfiles_update_admin" on perfiles;
create policy "perfiles_update_admin" on perfiles
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- SUCURSALES
-- Todos los autenticados leen las sucursales; solo administración las administra.
drop policy if exists "sucursales_select_autenticado" on sucursales;
create policy "sucursales_select_autenticado" on sucursales
  for select to authenticated
  using (true);

drop policy if exists "sucursales_insert_admin" on sucursales;
create policy "sucursales_insert_admin" on sucursales
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "sucursales_update_admin" on sucursales;
create policy "sucursales_update_admin" on sucursales
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- TIPOS_EMPAQUE Y PRODUCTOS
-- Catálogos de lectura para todos; administración los administra.
drop policy if exists "tipos_empaque_select_autenticado" on tipos_empaque;
create policy "tipos_empaque_select_autenticado" on tipos_empaque
  for select to authenticated
  using (true);

drop policy if exists "tipos_empaque_insert_admin" on tipos_empaque;
create policy "tipos_empaque_insert_admin" on tipos_empaque
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "tipos_empaque_update_admin" on tipos_empaque;
create policy "tipos_empaque_update_admin" on tipos_empaque
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

drop policy if exists "productos_select_autenticado" on productos;
create policy "productos_select_autenticado" on productos
  for select to authenticated
  using (true);

drop policy if exists "productos_insert_admin" on productos;
create policy "productos_insert_admin" on productos
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "productos_update_admin" on productos;
create policy "productos_update_admin" on productos
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- CLIENTES
-- El vendedor ve y edita su propia cartera; administración ve y administra todo.
drop policy if exists "clientes_select_cartera" on clientes;
create policy "clientes_select_cartera" on clientes
  for select to authenticated
  using (auth.uid() = vendedor_id or es_rol('administrador'));

drop policy if exists "clientes_insert_cartera" on clientes;
create policy "clientes_insert_cartera" on clientes
  for insert to authenticated
  with check (
    (auth.uid() = vendedor_id
      and sucursal_id = mi_sucursal())
    or es_rol('administrador')
  );

drop policy if exists "clientes_update_cartera" on clientes;
create policy "clientes_update_cartera" on clientes
  for update to authenticated
  using (auth.uid() = vendedor_id or es_rol('administrador'))
  with check (auth.uid() = vendedor_id or es_rol('administrador'));

drop policy if exists "clientes_delete_admin" on clientes;
create policy "clientes_delete_admin" on clientes
  for delete to authenticated
  using (es_rol('administrador'));

-- CONFIGURACION
-- Solo administración accede a los parámetros.
drop policy if exists "configuracion_select_admin" on configuracion;
create policy "configuracion_select_admin" on configuracion
  for select to authenticated
  using (es_rol('administrador'));

drop policy if exists "configuracion_insert_admin" on configuracion;
create policy "configuracion_insert_admin" on configuracion
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "configuracion_update_admin" on configuracion;
create policy "configuracion_update_admin" on configuracion
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- REGLAS_COMISION
-- Todos la leen (el vendedor conoce su comisión); solo administración la administra.
drop policy if exists "reglas_comision_select_autenticado" on reglas_comision;
create policy "reglas_comision_select_autenticado" on reglas_comision
  for select to authenticated
  using (true);

drop policy if exists "reglas_comision_insert_admin" on reglas_comision;
create policy "reglas_comision_insert_admin" on reglas_comision
  for insert to authenticated
  with check (es_rol('administrador'));

drop policy if exists "reglas_comision_update_admin" on reglas_comision;
create policy "reglas_comision_update_admin" on reglas_comision
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

drop policy if exists "reglas_comision_delete_admin" on reglas_comision;
create policy "reglas_comision_delete_admin" on reglas_comision
  for delete to authenticated
  using (es_rol('administrador'));

-- STOCK_BODEGA Y STOCK_ENVASES
-- Lectura para bodega, produccion y administración (producción necesita conocer
-- existencias para planear HU-20); escritura para bodega y administración.
drop policy if exists "stock_bodega_select_operativo" on stock_bodega;
create policy "stock_bodega_select_operativo" on stock_bodega
  for select to authenticated
  using (
    es_rol('administrador')
    or (
      (es_rol('bodega') or es_rol('produccion'))
      and sucursal_id = mi_sucursal()
    )
  );

drop policy if exists "stock_bodega_write_bodega" on stock_bodega;
create policy "stock_bodega_write_bodega" on stock_bodega
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "stock_bodega_update_bodega" on stock_bodega;
create policy "stock_bodega_update_bodega" on stock_bodega
  for update to authenticated
  using (es_rol('bodega') or es_rol('administrador'))
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "stock_envases_select_operativo" on stock_envases;
create policy "stock_envases_select_operativo" on stock_envases
  for select to authenticated
  using (
    es_rol('administrador')
    or (
      (es_rol('bodega') or es_rol('produccion'))
      and sucursal_id = mi_sucursal()
    )
  );

drop policy if exists "stock_envases_write_bodega" on stock_envases;
create policy "stock_envases_write_bodega" on stock_envases
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "stock_envases_update_bodega" on stock_envases;
create policy "stock_envases_update_bodega" on stock_envases
  for update to authenticated
  using (es_rol('bodega') or es_rol('administrador'))
  with check (es_rol('bodega') or es_rol('administrador'));

-- CARGA_VENDEDOR
-- El vendedor ve su carga; bodega y administración la administran.
drop policy if exists "carga_vendedor_select_propio" on carga_vendedor;
create policy "carga_vendedor_select_propio" on carga_vendedor
  for select to authenticated
  using (auth.uid() = vendedor_id or es_rol('bodega') or es_rol('administrador'));

drop policy if exists "carga_vendedor_write_bodega" on carga_vendedor;
create policy "carga_vendedor_write_bodega" on carga_vendedor
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "carga_vendedor_update_bodega" on carga_vendedor;
create policy "carga_vendedor_update_bodega" on carga_vendedor
  for update to authenticated
  using (es_rol('bodega') or es_rol('administrador'))
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "carga_vendedor_delete_bodega" on carga_vendedor;
create policy "carga_vendedor_delete_bodega" on carga_vendedor
  for delete to authenticated
  using (es_rol('bodega') or es_rol('administrador'));

-- VENTAS
-- El vendedor lee e inserta sus ventas; administración lee, anula y corrige.
drop policy if exists "ventas_select_propio" on ventas;
create policy "ventas_select_propio" on ventas
  for select to authenticated
  using (auth.uid() = vendedor_id or es_rol('administrador'));

drop policy if exists "ventas_insert_vendedor" on ventas;
create policy "ventas_insert_vendedor" on ventas
  for insert to authenticated
  with check (
    (auth.uid() = vendedor_id
      and sucursal_id = mi_sucursal())
    or es_rol('administrador')
  );

drop policy if exists "ventas_update_admin" on ventas;
create policy "ventas_update_admin" on ventas
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- VENTA_DETALLES
-- Acceso según la venta padre; solo administración edita.
drop policy if exists "venta_detalles_select_venta" on venta_detalles;
create policy "venta_detalles_select_venta" on venta_detalles
  for select to authenticated
  using (
    exists (
      select 1 from ventas v
      where v.id = venta_id
        and (v.vendedor_id = auth.uid() or es_rol('administrador'))
    )
  );

drop policy if exists "venta_detalles_insert_venta" on venta_detalles;
create policy "venta_detalles_insert_venta" on venta_detalles
  for insert to authenticated
  with check (
    exists (
      select 1 from ventas v
      where v.id = venta_id
        and (v.vendedor_id = auth.uid() or es_rol('administrador'))
    )
  );

drop policy if exists "venta_detalles_update_admin" on venta_detalles;
create policy "venta_detalles_update_admin" on venta_detalles
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- DELETE de venta_detalles (opcional).
-- El trigger trg_venta_total_del recalcula el total de la venta al borrar un
-- detalle. Habilitar esta política SOLO si el administrador debe poder
-- eliminar detalles por corrección; mientras no se necesite, mantenerla
-- desactivada evita que la API permita borrar líneas ya vendidas. Como política
-- conservadora de referencia se define comentada; descomentar para habilitar.
-- drop policy if exists "venta_detalles_delete_admin" on venta_detalles;
-- create policy "venta_detalles_delete_admin" on venta_detalles
--   for delete to authenticated
--   using (es_rol('administrador'));

-- GASTOS_EXTRAS
-- El vendedor registra y ve sus gastos; administración los anula.
drop policy if exists "gastos_extras_select_propio" on gastos_extras;
create policy "gastos_extras_select_propio" on gastos_extras
  for select to authenticated
  using (auth.uid() = vendedor_id or es_rol('administrador'));

drop policy if exists "gastos_extras_insert_vendedor" on gastos_extras;
create policy "gastos_extras_insert_vendedor" on gastos_extras
  for insert to authenticated
  with check (
    (auth.uid() = vendedor_id
      and sucursal_id = mi_sucursal())
    or es_rol('administrador')
  );

drop policy if exists "gastos_extras_update_admin" on gastos_extras;
create policy "gastos_extras_update_admin" on gastos_extras
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- DESPACHOS
-- Bodega crea y ve despachos; el vendedor ve los suyos; administración anula.
-- NOTA: producción también lee despachos aquí para planear existencias (HU-20).
-- Si el equipo define que producción no necesita ver despachos, quitar la
-- rama `es_rol('produccion') and sucursal_id = mi_sucursal()` de la política.
drop policy if exists "despachos_select_operativo" on despachos;
create policy "despachos_select_operativo" on despachos
  for select to authenticated
  using (
    auth.uid() = vendedor_id
    or (es_rol('bodega') and sucursal_id = mi_sucursal())
    or (es_rol('produccion') and sucursal_id = mi_sucursal())
    or es_rol('administrador')
  );

drop policy if exists "despachos_insert_bodega" on despachos;
create policy "despachos_insert_bodega" on despachos
  for insert to authenticated
  with check (
    (
      es_rol('bodega')
      and despachador_id = auth.uid()
      and sucursal_id = mi_sucursal()
    )
    or es_rol('administrador')
  );

drop policy if exists "despachos_update_admin" on despachos;
create policy "despachos_update_admin" on despachos
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- DESPACHO_DETALLES
-- Acceso según el despacho padre; bodega inserta; administración corrige.
drop policy if exists "despacho_detalles_select_despacho" on despacho_detalles;
create policy "despacho_detalles_select_despacho" on despacho_detalles
  for select to authenticated
  using (
    exists (
      select 1 from despachos d
      where d.id = despacho_id
        and (
          d.vendedor_id = auth.uid()
          or es_rol('bodega')
          or es_rol('produccion')
          or es_rol('administrador')
        )
    )
  );

drop policy if exists "despacho_detalles_insert_bodega" on despacho_detalles;
create policy "despacho_detalles_insert_bodega" on despacho_detalles
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "despacho_detalles_update_admin" on despacho_detalles;
create policy "despacho_detalles_update_admin" on despacho_detalles
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- DEVOLUCIONES (productos y envases)
-- El vendedor registra devoluciones de sus despachos; administración anula.
drop policy if exists "devoluciones_productos_select_despacho" on devoluciones_productos;
create policy "devoluciones_productos_select_despacho" on devoluciones_productos
  for select to authenticated
  using (
    es_rol('administrador')
    or (
      es_rol('bodega')
      and exists (
        select 1 from despachos d
        where d.id = despacho_id
          and d.sucursal_id = mi_sucursal()
      )
    )
    or exists (
      select 1 from despachos d
      where d.id = despacho_id and d.vendedor_id = auth.uid()
    )
  );

drop policy if exists "devoluciones_productos_insert_despacho" on devoluciones_productos;
create policy "devoluciones_productos_insert_despacho" on devoluciones_productos
  for insert to authenticated
  with check (
    es_rol('administrador')
    or (
      es_rol('bodega')
      and exists (
        select 1 from despachos d
        where d.id = despacho_id
          and d.sucursal_id = mi_sucursal()
      )
    )
    or exists (
      select 1 from despachos d
      where d.id = despacho_id and d.vendedor_id = auth.uid()
    )
  );

drop policy if exists "devoluciones_productos_update_admin" on devoluciones_productos;
create policy "devoluciones_productos_update_admin" on devoluciones_productos
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

drop policy if exists "devoluciones_envases_select_despacho" on devoluciones_envases;
create policy "devoluciones_envases_select_despacho" on devoluciones_envases
  for select to authenticated
  using (
    es_rol('administrador')
    or (
      es_rol('bodega')
      and exists (
        select 1 from despachos d
        where d.id = despacho_id
          and d.sucursal_id = mi_sucursal()
      )
    )
    or exists (
      select 1 from despachos d
      where d.id = despacho_id and d.vendedor_id = auth.uid()
    )
  );

drop policy if exists "devoluciones_envases_insert_despacho" on devoluciones_envases;
create policy "devoluciones_envases_insert_despacho" on devoluciones_envases
  for insert to authenticated
  with check (
    es_rol('administrador')
    or (
      es_rol('bodega')
      and exists (
        select 1 from despachos d
        where d.id = despacho_id
          and d.sucursal_id = mi_sucursal()
      )
    )
    or exists (
      select 1 from despachos d
      where d.id = despacho_id and d.vendedor_id = auth.uid()
    )
  );

drop policy if exists "devoluciones_envases_update_admin" on devoluciones_envases;
create policy "devoluciones_envases_update_admin" on devoluciones_envases
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- MERMAS
-- Bodega y administración registran mermas; produccion y el vendedor la leen.
drop policy if exists "mermas_select_operativo" on mermas;
create policy "mermas_select_operativo" on mermas
  for select to authenticated
  using (
    es_rol('bodega')
    or es_rol('produccion')
    or es_rol('administrador')
    or (
      despacho_id is not null
      and exists (
        select 1 from despachos d
        where d.id = despacho_id and d.vendedor_id = auth.uid()
      )
    )
  );

drop policy if exists "mermas_insert_bodega" on mermas;
create policy "mermas_insert_bodega" on mermas
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "mermas_update_admin" on mermas;
create policy "mermas_update_admin" on mermas
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

-- PRODUCCIONES E INCIDENCIAS
-- Produccion y administración registran y leen; solo administración anula.
drop policy if exists "producciones_select_produccion" on producciones;
create policy "producciones_select_produccion" on producciones
  for select to authenticated
  using (es_rol('produccion') or es_rol('administrador'));

drop policy if exists "producciones_insert_produccion" on producciones;
create policy "producciones_insert_produccion" on producciones
  for insert to authenticated
  with check (es_rol('produccion') or es_rol('administrador'));

drop policy if exists "producciones_update_admin" on producciones;
create policy "producciones_update_admin" on producciones
  for update to authenticated
  using (es_rol('administrador'))
  with check (es_rol('administrador'));

drop policy if exists "incidencias_produccion_select_produccion" on incidencias_produccion;
create policy "incidencias_produccion_select_produccion" on incidencias_produccion
  for select to authenticated
  using (es_rol('produccion') or es_rol('administrador'));

drop policy if exists "incidencias_produccion_insert_produccion" on incidencias_produccion;
create policy "incidencias_produccion_insert_produccion" on incidencias_produccion
  for insert to authenticated
  with check (es_rol('produccion') or es_rol('administrador'));

-- UBICACIONES_VENDEDORES
-- El vendedor reporta y ve su ubicación; bodega y administración la ven.
drop policy if exists "ubicaciones_vendedores_select_operativo" on ubicaciones_vendedores;
create policy "ubicaciones_vendedores_select_operativo" on ubicaciones_vendedores
  for select to authenticated
  using (
    auth.uid() = vendedor_id
    or es_rol('bodega')
    or es_rol('administrador')
  );

drop policy if exists "ubicaciones_vendedores_insert_propio" on ubicaciones_vendedores;
create policy "ubicaciones_vendedores_insert_propio" on ubicaciones_vendedores
  for insert to authenticated
  with check (
    auth.uid() = vendedor_id or es_rol('administrador')
  );

-- AUDITORIA
-- Solo administración lee el registro de auditoría; nadie escribe desde la API
-- (los triggers con security definer / service_role escriben con RLS omitido).
drop policy if exists "auditoria_select_admin" on auditoria;
create policy "auditoria_select_admin" on auditoria
  for select to authenticated
  using (es_rol('administrador'));

-- STORAGE — comprobantes de gastos (RF-21, HU-07)
-- gastos_extras.comprobante_url guarda una URL de este bucket.
drop policy if exists "comprobantes_insert_vendedor" on storage.objects;
create policy "comprobantes_insert_vendedor" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (es_rol('vendedor') or es_rol('administrador'))
  );

drop policy if exists "comprobantes_select_propio" on storage.objects;
-- NOTA: esta política no filtra por propietario del objeto (storage.objects
-- expone `owner`, columna de los metadatos de Supabase Storage). Como está,
-- cualquier vendedor autenticado puede leer cualquier comprobante del bucket
-- si conoce la ruta. Para restringir por usuario habría que añadir
-- `and owner = auth.uid()` o usar la metadata del upload; queda pendiente de
-- revisar cómo el frontend almacena el owner al subir y si el acceso cruzado
-- (p.ej. bodega revisando comprobantes) es deseado.
create policy "comprobantes_select_propio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (es_rol('vendedor') or es_rol('bodega') or es_rol('administrador'))
  );


-- ============================================================
-- SECCIÓN 3 — TRIGGERS DE NEGOCIO
-- ============================================================
-- ============================================================================
-- Triggers de negocio — Ondina (esquema final)
-- ============================================================================
-- Reglas de inventario que NO pueden vivir solo en React (RNF-03, RNF-15):
-- el stock lo mantienen las funciones de la base de datos, no el frontend.
-- Adaptado al esquema final: claves compuestas por sucursal en stock_bodega,
-- stock_envases, despachos, ventas, producciones, devoluciones y mermas.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql
-- Requiere: bd/rls_policies.sql (funciones es_rol / mi_sucursal) si se usan.
-- Nota: `configuracion.valor` es text; los triggers lo castearán a integer
-- (ventana_ajuste_minutos) cuando se lea. Si el valor se setea mal desde la
-- app, el trigger fallará en runtime. La UI de administración debe validar el
-- tipo antes de escribir el parámetro (la BD no valida el contenido aquí).
-- Orden sugerido: esquema → triggers_negocio.sql → auditoria.sql
--                → vistas.sql → seed.sql → rls_policies.sql.
--
-- Pendiente por decisión de alcance: bandejas/cajas (inventario_bandejas,
-- retorno_bandejas, despachos.cantidad_bandejas). Este esquema no las modela;
-- se crean acá solo si el equipo confirma que siguen siendo requisito.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Despacho: valida ventana, descuenta stock_bodega y suma carga_vendedor
-- ---------------------------------------------------------------------------
create or replace function public.trg_despacho_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho     public.despachos%rowtype;
    v_minutos      integer;
    v_stock_actual integer;
begin
    select * into v_despacho
    from public.despachos where id = new.despacho_id for update;
    if v_despacho.anulado then
        raise exception 'El despacho está anulado';
    end if;

    -- HU-26 / RNF-15: los ajustes solo suman y solo dentro de la ventana configurable
    if new.es_ajuste then
        select valor::integer into v_minutos
        from public.configuracion where clave = 'ventana_ajuste_minutos';
        if now() > v_despacho.creado_en + make_interval(mins => coalesce(v_minutos, 0)) then
            raise exception 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        end if;
    end if;

    -- Descuenta stock de bodega de la sucursal (clave compuesta)
    select cantidad into v_stock_actual
    from public.stock_bodega
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id
    for update;
    if v_stock_actual is null or v_stock_actual < new.cantidad then
        raise exception 'Stock insuficiente en bodega para el producto %', new.producto_id;
    end if;
    update public.stock_bodega
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id
      and producto_id  = new.producto_id;

    -- Suma a la carga del vendedor (el vendedor pertenece a la sucursal)
    insert into public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    values (v_despacho.vendedor_id, new.producto_id, new.cantidad, now())
    on conflict (vendedor_id, producto_id)
    do update set cantidad = carga_vendedor.cantidad + excluded.cantidad,
                  modificado_en = now();

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Venta: descuenta de la carga del vendedor y recibe envases
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_detalle_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta  public.ventas%rowtype;
    v_empaque uuid;
begin
    select * into v_venta from public.ventas where id = new.venta_id;
    if v_venta.anulado then
        raise exception 'La venta está anulada';
    end if;

    update public.carga_vendedor
    set cantidad = cantidad - new.cantidad, modificado_en = now()
    where vendedor_id = v_venta.vendedor_id
      and producto_id  = new.producto_id;
    if not found then
        raise exception 'El vendedor no tiene carga del producto %', new.producto_id;
    end if;
    if (select cantidad from public.carga_vendedor
        where vendedor_id = v_venta.vendedor_id and producto_id = new.producto_id) < 0 then
        raise exception 'Carga insuficiente del vendedor para el producto %', new.producto_id;
    end if;

    -- Envases recibidos de la venta suman al inventario de vacíos de la sucursal
    if new.envases_recibidos > 0 then
        select tipo_empaque_id into v_empaque
        from public.productos where id = new.producto_id;
        if v_empaque is not null then
            insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
            values (v_venta.sucursal_id, v_empaque, new.envases_recibidos, now())
            on conflict (sucursal_id, tipo_empaque_id)
            do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                          modificado_en = now();
        end if;
    end if;

    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Venta: real aproxima el total (suma de subtotales - descuento)
-- ---------------------------------------------------------------------------
create or replace function public.trg_venta_recalcular_total()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
    update public.ventas v
    set total = greatest(
        coalesce((select sum(subtotal) from public.venta_detalles where venta_id = v_venta), 0) - v.descuento,
        0)
    where v.id = v_venta;
    return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Devolución de productos: carga -> bodega
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_producto_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;

    update public.carga_vendedor
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id
      and producto_id  = new.producto_id;

    insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
    values (v_despacho.sucursal_id, new.producto_id, new.cantidad, now())
    on conflict (sucursal_id, producto_id)
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad,
                  modificado_en = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Devolución de envase: suma al inventario de vacíos (solo estado bueno)
-- ---------------------------------------------------------------------------
create or replace function public.trg_devolucion_envase_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    if new.estado = 'bueno' then
        insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad, modificado_en)
        values (v_sucursal, new.tipo_empaque_id, new.cantidad, now())
        on conflict (sucursal_id, tipo_empaque_id)
        do update set cantidad = stock_envases.cantidad + excluded.cantidad,
                      modificado_en = now();
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Producción: suma al stock de bodega
-- ---------------------------------------------------------------------------
create or replace function public.trg_produccion_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.stock_bodega (sucursal_id, producto_id, cantidad, modificado_en)
    values (new.sucursal_id, new.producto_id, new.cantidad, now())
    on conflict (sucursal_id, producto_id)
    do update set cantidad = stock_bodega.cantidad + excluded.cantidad, modificado_en = now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Merma: descuenta carga (ruta) o bodega (planta) o stock de envases (vacíos
--    rotos se descuentan del inventario de envases de la sucursal)
-- ---------------------------------------------------------------------------
create or replace function public.trg_merma_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    if new.producto_id is not null then
        if new.despacho_id is not null then
            select * into v_despacho from public.despachos where id = new.despacho_id;
            update public.carga_vendedor
            set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id  = new.producto_id;
        else
            update public.stock_bodega
            set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
            where sucursal_id = new.sucursal_id
              and producto_id  = new.producto_id;
        end if;
    elsif new.tipo_empaque_id is not null then
        update public.stock_envases
        set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id;
    end if;
    return new;
end;
$$;

-- ===========================================================================
-- 8. Reversión de stock al anular (anulado pasa de false a true)
-- ===========================================================================
-- Las anulaciones no se borran: marcan `anulado = true`. La reversión de los
-- movimientos de stock la hace la BD (no el frontend) para preservar la
-- integrididad aun si se llama la API directamente. Cada función retorna las
-- existencias al estado previo de la operación anulada. Si el stock había
-- cambiado por operaciones posteriores, se respeta el no-negativo con
-- greatest(..., 0). Estos triggers se disparan SOLO en la transición
-- `anulado: false -> true`; una posterior reactivación NO restaura movimientos
-- (la decisión de revertir deja claro que la operación debe registrarse de
-- nuevo, no reactivarse acríticamente).
-- ---------------------------------------------------------------------------

-- 8a. Anular venta: devolver carga al vendedor y restar envases recibidos
create or replace function public.trg_venta_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    vd record;
    v_empaque uuid;
begin
    -- Por cada detalle de la venta: sumamos a la carga del vendedor
    -- (en el INSERT se había restado) y restamos del stock_envases los
    -- envases que se habían sumado.
    for vd in select producto_id, cantidad, envases_recibidos
              from public.venta_detalles where venta_id = new.id loop
        update public.carga_vendedor
        set cantidad = cantidad + vd.cantidad, modificado_en = now()
        where vendedor_id = new.vendedor_id
          and producto_id = vd.producto_id;

        if vd.envases_recibidos > 0 then
            select tipo_empaque_id into v_empaque
            from public.productos where id = vd.producto_id;
            if v_empaque is not null then
                update public.stock_envases
                set cantidad = greatest(cantidad - vd.envases_recibidos, 0),
                    modificado_en = now()
                where sucursal_id = new.sucursal_id
                  and tipo_empaque_id = v_empaque;
            end if;
        end if;
    end loop;
    return new;
end;
$$;

-- 8b. Anular despacho: devolver a stock_bodega y quitar de carga_vendedor
create or replace function public.trg_despacho_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    dd record;
begin
    -- Por cada detalle (incluidos los ajustes): revertimos el movimiento.
    -- stock_bodega se había restado -> sumamos. carga_vendedor se había
    -- sumado -> restamos (respetando no-negativo).
    for dd in select producto_id, sum(cantidad) as total
              from public.despacho_detalles where despacho_id = new.id
              group by producto_id loop
        update public.stock_bodega
        set cantidad = cantidad + dd.total, modificado_en = now()
        where sucursal_id = new.sucursal_id and producto_id = dd.producto_id;

        update public.carga_vendedor
        set cantidad = greatest(cantidad - dd.total, 0), modificado_en = now()
        where vendedor_id = new.vendedor_id and producto_id = dd.producto_id;
    end loop;
    return new;
end;
$$;

-- 8c. Anular devolución de productos: revertir (carga vuelve a bajar, bodega sube)
create or replace function public.trg_devolucion_producto_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    select * into v_despacho from public.despachos where id = new.despacho_id;
    if v_despacho.anulado then
        -- Si el despacho también está anulado, su reversión ya movió stock;
        -- aquí no tocamos para no duplicar.
        return new;
    end if;
    -- En el INSERT se hizo: carga -= cantidad, stock_bodega += cantidad.
    -- Revertimos: carga += cantidad, stock_bodega -= cantidad.
    update public.carga_vendedor
    set cantidad = cantidad + new.cantidad, modificado_en = now()
    where vendedor_id = v_despacho.vendedor_id and producto_id = new.producto_id;

    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_despacho.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- 8d. Anular devolución de envase (bueno): restar lo sumado al stock_envases
create or replace function public.trg_devolucion_envase_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_sucursal uuid;
begin
    if new.estado <> 'bueno' then
        return new;
    end if;
    select sucursal_id into v_sucursal from public.despachos where id = new.despacho_id;
    update public.stock_envases
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = v_sucursal and tipo_empaque_id = new.tipo_empaque_id;
    return new;
end;
$$;

-- 8e. Anular producción: restar de stock_bodega lo que se había sumado
create or replace function public.trg_produccion_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    update public.stock_bodega
    set cantidad = greatest(cantidad - new.cantidad, 0), modificado_en = now()
    where sucursal_id = new.sucursal_id and producto_id = new.producto_id;
    return new;
end;
$$;

-- 8f. Anular merma: revertir su descuento
create or replace function public.trg_merma_anular()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
    v_despacho public.despachos%rowtype;
begin
    if new.producto_id is not null then
        if new.despacho_id is not null then
            select * into v_despacho from public.despachos where id = new.despacho_id;
            -- La merma restaba carga (ruta) o bodega (planta). Revertir sumando.
            update public.carga_vendedor
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id  = new.producto_id;
            -- Nota: para merma en ruta tocábamos carga_vendedor (no stock_bodega);
            -- para merma en planta tocábamos stock_bodega. Aquí distinguimos por
            -- despacho_id presente y operamos sobre carga_vendedor en ruta.
        else
            update public.stock_bodega
            set cantidad = cantidad + new.cantidad, modificado_en = now()
            where sucursal_id = new.sucursal_id and producto_id = new.producto_id;
        end if;
    elsif new.tipo_empaque_id is not null then
        update public.stock_envases
        set cantidad = cantidad + new.cantidad, modificado_en = now()
        where sucursal_id = new.sucursal_id and tipo_empaque_id = new.tipo_empaque_id;
    end if;
    return new;
end;
$$;

-- ===========================================================================
-- Activación de triggers de negocio
-- ===========================================================================
create trigger trg_despacho_detalle_insert after insert on public.despacho_detalles
    for each row execute function public.trg_despacho_detalle_insert();
create trigger trg_venta_detalle_insert after insert on public.venta_detalles
    for each row execute function public.trg_venta_detalle_insert();
create trigger trg_venta_total_ins after insert on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_venta_total_upd after update on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_venta_total_del after delete on public.venta_detalles
    for each row execute function public.trg_venta_recalcular_total();
create trigger trg_devolucion_producto after insert on public.devoluciones_productos
    for each row execute function public.trg_devolucion_producto_insert();
create trigger trg_devolucion_envase after insert on public.devoluciones_envases
    for each row execute function public.trg_devolucion_envase_insert();
create trigger trg_produccion_insert after insert on public.producciones
    for each row execute function public.trg_produccion_insert();
create trigger trg_merma_insert after insert on public.mermas
    for each row execute function public.trg_merma_insert();

-- Activación de los triggers de reversión por anulación
-- (se disparan solo en la transición anulado: false -> true)
create trigger trg_venta_anular after update of anulado on public.ventas
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_venta_anular();
create trigger trg_despacho_anular after update of anulado on public.despachos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_despacho_anular();
create trigger trg_devolucion_producto_anular after update of anulado
    on public.devoluciones_productos
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_producto_anular();
create trigger trg_devolucion_envase_anular after update of anulado
    on public.devoluciones_envases
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_devolucion_envase_anular();
create trigger trg_produccion_anular after update of anulado on public.producciones
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_produccion_anular();
create trigger trg_merma_anular after update of anulado on public.mermas
    for each row when (new.anulado and not old.anulado)
    execute function public.trg_merma_anular();

-- ============================================================
-- SECCIÓN 4 — AUDITORÍA
-- ============================================================
-- ============================================================================
-- Auditoría genérica — Ondina (esquema final)
-- ============================================================================
-- RNF-11/12/13, HU-13: registrar quién, cuándo, valor anterior y valor nuevo en
-- cada operación corregible. Se aplica con triggers SECURITY DEFINER (con RLS
-- omitido) que escriben en `auditoria`; desde la API nadie escribe allí.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql y
-- bd/triggers_negocio.sql. Este archivo puede repetirse de forma idempotente.
--
-- NOTA DE INTEGRIDAD:
-- `auditoria.registro_id` es `uuid`, pero `ubicaciones_vendedores.id` es `bigint`.
-- Decisión adoptada: las ubicaciones NO se auditan (son histórico de posición,
-- no operación corregible), por lo que no se les instala trigger de auditoría.
-- Si a futuro se requiere auditar, cambiar el tipo del identificador auditado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Sello de modificación: rellena modificado_en / modificado_por en UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.fn_sello_modificacion()
returns trigger language plpgsql set search_path = public
as $$
begin
    if tg_op = 'UPDATE' then
        new.modificado_en := now();
        new.modificado_por := auth.uid();
    end if;
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoría genérica hacia `auditoria`
-- ---------------------------------------------------------------------------
create or replace function public.fn_auditoria()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.auditoria (tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos)
    values (
        tg_table_name,
        coalesce(new.id, old.id),
        case
            when tg_op = 'INSERT' then 'INSERT'
            when tg_op = 'UPDATE' and new.anulado and not old.anulado then 'ANULACION'
            else 'UPDATE'
        end,
        auth.uid(),
        case when tg_op = 'UPDATE' then to_jsonb(old) end,
        to_jsonb(new)
    );
    return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoría simple (INSERT/UPDATE) para tablas sin columna `anulado`
-- (p.ej. venta_detalles, despacho_detalles). No distingue ANULACION.
-- ---------------------------------------------------------------------------
create or replace function public.fn_auditoria_simple()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.auditoria (tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos)
    values (
        tg_table_name,
        coalesce(new.id, old.id),
        case when tg_op = 'INSERT' then 'INSERT' else 'UPDATE' end,
        auth.uid(),
        case when tg_op = 'UPDATE' then to_jsonb(old) end,
        to_jsonb(new)
    );
    return new;
end;
$$;

-- ===========================================================================
-- Activación de auditoría en tablas operacionales y corregibles (HU-13)
-- ===========================================================================

-- ventas: auditoría + sello
create trigger trg_audit_ventas after insert or update on public.ventas
    for each row execute function public.fn_auditoria();
create trigger trg_sello_ventas before update on public.ventas
    for each row execute function public.fn_sello_modificacion();

-- despachos: auditoría + sello
create trigger trg_audit_despachos after insert or update on public.despachos
    for each row execute function public.fn_auditoria();
create trigger trg_sello_despachos before update on public.despachos
    for each row execute function public.fn_sello_modificacion();

-- producciones: auditoría (sin sello: la tabla no tiene columnas modificado_*)
create trigger trg_audit_producciones after insert or update on public.producciones
    for each row execute function public.fn_auditoria();

-- gastos_extras: auditoría + sello
create trigger trg_audit_gastos after insert or update on public.gastos_extras
    for each row execute function public.fn_auditoria();
create trigger trg_sello_gastos before update on public.gastos_extras
    for each row execute function public.fn_sello_modificacion();

-- mermas: auditoría (sin sello: la tabla no tiene columnas modificado_*)
create trigger trg_audit_mermas after insert or update on public.mermas
    for each row execute function public.fn_auditoria();

-- clientes: sello (corrige administración, HU-02/13). Sin trigger de auditoría
-- genérico aquí: v2 NO tiene columna `anulado` en clientes (usa `activo`), y
-- fn_auditoria lee `anulado` para clasificar ANULACION.
create trigger trg_sello_clientes before update on public.clientes
    for each row execute function public.fn_sello_modificacion();

-- productos: sin sello ni auditoría genérica aquí (catálogo sin anulado y sin
-- columnas modificado_*; se audita bajo demanda si administración lo corrige).

-- ===========================================================================
-- Auditoría extendida a devoluciones y detalles
-- SUJETO A CAMBIOS: este bloque se incluye a modo de referencia para cerrar
-- RF-23 / HU-13 / RNF-13 sobre devoluciones, venta_detalles y despacho_detalles.
-- No se consideran necesariamente definitivas todas las tablas; revisar con
-- el equipo si los detalles de venta/despacho deben ser corregibles por el
-- administrador, o si conviene solo INSERT (no UPDATE) para esos registros.
-- ===========================================================================

-- devoluciones_productos: auditoría (con anulado -> ANULACION)
create trigger trg_audit_devoluciones_productos
    after insert or update on public.devoluciones_productos
    for each row execute function public.fn_auditoria();

-- devoluciones_envases: auditoría (con anulado -> ANULACION)
create trigger trg_audit_devoluciones_envases
    after insert or update on public.devoluciones_envases
    for each row execute function public.fn_auditoria();

-- venta_detalles: auditoría simple (sin columna `anulado`). Trigger DELETE
-- existente en triggers_negocio.sql recalcula total; aquí solo trazamos
-- INSERT/UPDATE. Si administración debe poder eliminar detalles, ver
-- comentario en rls_policies.sql (política DELETE venta_detalles).
create trigger trg_audit_venta_detalles
    after insert or update on public.venta_detalles
    for each row execute function public.fn_auditoria_simple();

-- despacho_detalles: auditoría simple (sin columna `anulado`)
create trigger trg_audit_despacho_detalles
    after insert or update on public.despacho_detalles
    for each row execute function public.fn_auditoria_simple();

-- ============================================================
-- SECCIÓN 5 — VISTAS
-- ============================================================
-- ============================================================================
-- Vistas de apoyo a reportes — Ondina (esquema final)
-- ============================================================================
-- RF-22 (ranking), RF-05 (clientes inactivos), RF-24 (cuadre), HU-08/12/14.
-- Adaptadas al esquema final: claves compuestas por sucursal (stock_bodega),
-- tablas `producciones`, `configuracion`, `reglas_comision`, `ventas` con
-- `sucursal_id`, y boleta/factura como columnas de `ventas`.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql.
-- Estas vistas exponen datos sensibles; su acceso se controla con RLS a nivel
-- de tabla subyacente y con los roles es_rol()/mi_sucursal() de rls_policies.sql.
-- Para restringir por filas de forma segura, materializar con
-- SECURITY INVOKER y aplicar RLS del llamador si es necesario.
-- ============================================================================

-- Stock actual con nombre de producto, por sucursal (HU-24)
-- Solo productos activos (los inactivos no inflan el reporte)
create or replace view public.v_stock_actual as
select p.id as producto_id, p.nombre, p.tipo,
       s.sucursal_id,
       coalesce(s.cantidad, 0) as cantidad, s.modificado_en
from public.productos p
left join public.stock_bodega s on s.producto_id = p.id
where p.activo;

-- Cuadre por despacho: despachado vs vendido vs devuelto vs merma
-- (Problematica §2.3)
create or replace view public.v_cuadre_despacho as
select
    d.id as despacho_id,
    d.sucursal_id,
    d.vendedor_id,
    d.creado_en::date as fecha,
    dd.producto_id,
    sum(dd.cantidad) as cantidad_despachada,
    coalesce(v.cantidad_vendida, 0)   as cantidad_vendida,
    coalesce(dp.cantidad_devuelta, 0) as cantidad_devuelta,
    coalesce(m.cantidad_merma, 0)     as cantidad_merma,
    sum(dd.cantidad) - coalesce(v.cantidad_vendida, 0) - coalesce(dp.cantidad_devuelta, 0)
        - coalesce(m.cantidad_merma, 0) as diferencia
from public.despachos d
join public.despacho_detalles dd on dd.despacho_id = d.id
left join (
    select vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date as fecha,
           sum(vd.cantidad) as cantidad_vendida
    from public.ventas vt join public.venta_detalles vd on vd.venta_id = vt.id
    where not vt.anulado
    group by vd.producto_id, vt.vendedor_id, vt.sucursal_id, vt.creado_en::date
) v on v.producto_id = dd.producto_id
     and v.vendedor_id = d.vendedor_id
     and v.sucursal_id = d.sucursal_id
     and v.fecha = d.creado_en::date
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_devuelta
    from public.devoluciones_productos where not anulado group by despacho_id, producto_id
) dp on dp.despacho_id = d.id and dp.producto_id = dd.producto_id
left join (
    select despacho_id, producto_id, sum(cantidad) as cantidad_merma
    from public.mermas where not anulado and producto_id is not null group by despacho_id, producto_id
) m on m.despacho_id = d.id and m.producto_id = dd.producto_id
where not d.anulado
group by d.id, d.sucursal_id, d.vendedor_id, d.creado_en::date, dd.producto_id,
         v.cantidad_vendida, dp.cantidad_devuelta, m.cantidad_merma;

-- Ingresos diarios por vendedor y sucursal (HU-14, Problematica §2.2)
create or replace view public.v_ventas_diarias as
select creado_en::date as fecha, sucursal_id, vendedor_id,
       count(*) as cantidad_ventas, sum(total) as total_ingresos
from public.ventas
where not anulado
group by creado_en::date, sucursal_id, vendedor_id;

-- Ranking de vendedores (RF-22, HU-08)
create or replace view public.v_ranking_vendedores as
select p.id as vendedor_id, p.sucursal_id,
       p.nombres || ' ' || p.apellidos as vendedor,
       date_trunc('month', v.creado_en) as mes,
       count(v.id) as cantidad_ventas, coalesce(sum(v.total), 0) as total_vendido
from public.perfiles p
left join public.ventas v on v.vendedor_id = p.id and not v.anulado
where p.rol = 'vendedor' and p.activo
group by p.id, p.sucursal_id, p.nombres, p.apellidos, date_trunc('month', v.creado_en)
order by mes desc, total_vendido desc;

-- Comisión por vendedor según regla vigente por tipo de producto
-- (RF-26, HU-09). Regla vigente = vigente_hasta nulo o la más reciente.
-- `monto_fijo` se interpreta como un bono por venta (no por periodo): se suma
-- una vez por cada venta con detalle del tipo de producto. Ajustar si la regla
-- de negocio cambia a monto por periodo o por detalle.
create or replace view public.v_comision_vendedor as
select
    v.vendedor_id,
    date_trunc('month', v.creado_en) as mes,
    p.tipo,
    sum(vd.cantidad * vd.precio_unitario) as base_comision,
    r.porcentaje,
    r.monto_fijo,
    count(distinct v.id) as ventas_del_tipo,
    round(
        coalesce(sum(vd.cantidad * vd.precio_unitario) * r.porcentaje / 100.0, 0)
        + count(distinct v.id) * coalesce(r.monto_fijo, 0)
    , 2) as comision
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id and not v.anulado
join public.productos p on p.id = vd.producto_id
left join lateral (
    select r.porcentaje, r.monto_fijo
    from public.reglas_comision r
    where r.tipo_producto = p.tipo
      and r.vigente_desde <= now()
      and (r.vigente_hasta is null or r.vigente_hasta >= now())
    order by r.vigente_desde desc
    limit 1
) r on true
where not v.anulado
group by v.vendedor_id, date_trunc('month', v.creado_en), p.tipo, r.porcentaje, r.monto_fijo;

-- Clientes inactivos según parámetro configurable (RF-05, HU-12)
create or replace view public.v_clientes_inactivos as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       max(v.creado_en) as ultima_compra,
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente') as dias_configurados,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id
having max(v.creado_en) is null
    or now()::date - max(v.creado_en)::date >
       (select valor::integer from public.configuracion
        where clave = 'dias_inactividad_cliente');

-- Historial resumido del cliente (RF-04, HU-11).
-- NOTA: "visitas" del vendedor al cliente no están modeladas en el esquema
-- (ubicaciones_vendedores es solo GPS del vendedor, no una visita registrada).
-- Esta vista cubre el historial de ventas; modelar visitas requerirá una
-- entidad nueva (visitas: vendedor + cliente + fecha) y se deja como decisión
-- pendiente. Mientras tanto, una heurística posible es inferir cercanía del
-- GPS a la dirección del cliente, pero esa lógica no pertenece a esta vista.
create or replace view public.v_historial_cliente as
select c.id as cliente_id, c.nombre, c.sucursal_id, c.vendedor_id,
       count(distinct v.id) as cantidad_compras,
       coalesce(sum(v.total), 0) as total_comprado,
       max(v.creado_en) as ultima_compra,
       now()::date - max(v.creado_en)::date as dias_sin_comprar
from public.clientes c
left join public.ventas v on v.cliente_id = c.id and not v.anulado
where c.activo
group by c.id, c.nombre, c.sucursal_id, c.vendedor_id;

-- Reporte de ventas por vendedor y producto (HU-14).
-- Permite filtrar por producto fuera del contexto de despacho (HU-14 pide
-- "vendedor y producto"), complementando v_ventas_diarias (sin producto) y
-- v_cuadre_despacho (acotada al despacho). No incluye anuladas.
create or replace view public.v_ventas_producto as
select v.creado_en::date as fecha, v.sucursal_id, v.vendedor_id,
       vd.producto_id, p.nombre as producto, p.tipo,
       sum(vd.cantidad) as cantidad,
       sum(vd.subtotal) as total
from public.ventas v
join public.venta_detalles vd on vd.venta_id = v.id
join public.productos p on p.id = vd.producto_id
where not v.anulado
group by v.creado_en::date, v.sucursal_id, v.vendedor_id,
         vd.producto_id, p.nombre, p.tipo;

-- ---------------------------------------------------------------------------
-- RF-20 (consulta posterior de documentos boleta/factura): NO implementado
-- como objeto separado. `ventas.tipo_documento` y `ventas.folio_documento`
-- guardan el tipo y folio del documento emitido para cada venta, por lo que
-- la consulta posterior puede construirse consultando `ventas` directamente.
-- Si se requiere conservar el documento generado (PDF/render) para mostrarlo
-- sin recalcularlo, añadir una tabla `documentos_ventas` o un bucket de
-- Storage; queda pendiente de decisión del equipo (ver Plan §6.2).
-- ---------------------------------------------------------------------------

-- ============================================================
-- SECCIÓN 6 — DATOS SEMILLA
-- ============================================================
-- ============================================================================
-- Datos semilla — Ondina (esquema final)
-- ============================================================================
-- Este archivo fusiona en uno solo los dos seeds que antes vivían por separado.
-- Se compone de dos secciones que respetan la separación original:
--
--   SECCIÓN A — Seed base / configuración (antes bd/seed_v2.sql)
--       Sucursal inicial, parámetros configurables, catálogo mínimo de tipos
--       de empaque y bucket de Storage. Es configuración mínima y requerida
--       por triggers y vistas; el administrador la ajusta desde la app.
--
--   SECCIÓN B — Datos de prueba (antes bd/seed_datos_prueba.sql)
--       Sucursales de ejemplo, perfiles vinculados a usuarios de auth.users,
--       tipos de empaque, productos y existencias iniciales para probar los
--       flujos de ventas, despacho y producción en un entorno de desarrollo.
--
-- Requisito: aplicar primero bd/ondina_schema_supabase.sql.
-- Opcional (según sección): bd/triggers_negocio.sql, bd/auditoria.sql,
-- bd/vistas.sql y bd/rls_policies.sql.
-- Idempotente en su mayor parte (ON CONFLICT DO NOTHING).
-- ============================================================================

begin;

-- ============================================================================
-- SECCIÓN A — SEED BASE / CONFIGURACIÓN
-- (Antes: bd/seed_v2.sql)
-- ============================================================================

-- Sucursal inicial (una planta, por ahora)
insert into public.sucursales (nombre, comuna, region, activa)
values ('Planta Ondina', null, null, true)
on conflict (nombre) do nothing;

-- Parámetros configurables usados por triggers y vistas (RNF-26)
insert into public.configuracion (clave, valor, descripcion) values
    ('ventana_ajuste_minutos', '15',  'Minutos para sumar productos a un despacho ya registrado (RNF-15: 10–20)'),
    ('dias_inactividad_cliente', '7', 'Días sin compras para alertar cliente inactivo (HU-12)')
on conflict (clave) do nothing;

-- Tipos de empaque (catálogo inicial, ajustable por el administrador)
insert into public.tipos_empaque (nombre, categoria, activo) values
    ('Bidón Policarbonato', 'retornable', true),
    ('Bidón Plástico/PET',  'retornable', true),
    ('Bidón 10L',           'retornable', true),
    ('Bolsa de Hielo',      'no_retornable', true)
on conflict (nombre) do nothing;

-- Bucket de Storage para comprobantes de gastos (RF-21, HU-07)
-- Crea el bucket requerido por las políticas storage de rls_policies.sql.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- ============================================================================
-- SECCIÓN B — DATOS DE PRUEBA
-- (Antes: bd/seed_datos_prueba.sql)
-- ============================================================================

-- 0) Compatibilidad: este bloque actualiza el constraint de tipos_empaque para
--    admitir la categoría 'uso_interno' (usada por bandejas/cajas en BD de
--    prueba importadas de versiones previas del esquema). Con el esquema final
--    (que ya la contempla o no), el DDL idempotente no rompe la ejecución.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'tipos_empaque_categoria_check'
  ) then
    alter table tipos_empaque drop constraint tipos_empaque_categoria_check;
    alter table tipos_empaque add constraint tipos_empaque_categoria_check
      check (categoria in ('retornable', 'no_retornable', 'uso_interno'));
  end if;
end $$;

-- 1) SUCURSALES (ejemplos)
insert into public.sucursales (nombre, direccion, comuna, region, telefono, activa) values
  ('Ondina - Arica',   'Av. Comandante San Martín 2450', 'Arica',     'Arica y Parinacota', '+56 58 220 1111', true),
  ('Ondina - Iquique', 'Av. Arturo Prat 1850',           'Iquique',  'Tarapacá',           '+56 57 240 2222', true)
on conflict (nombre) do nothing;

-- 2) PERFILES de prueba: el id debe coincidir con el UUID de auth.users.
--    REEMPLAZA los emails CAMBIAR-* por los de tus usuarios en Authentication > Users.
--    En el esquema final `perfiles.sucursal_id` es NOT NULL, por lo que también
--    el administrador queda asignado a una sucursal (aquí "Ondina - Arica").
insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Camila', 'Salinas', '17.123.456-7', '+56 9 1111 0001', 'administrador', true
from auth.users u, public.sucursales s
where u.email = 'admin@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Diego', 'Moreno', '18.765.432-1', '+56 9 1111 0002', 'vendedor', true
from auth.users u, public.sucursales s
where u.email = 'vendedor@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

insert into public.perfiles (id, sucursal_id, nombres, apellidos, rut, telefono, rol, activo)
select u.id, s.id, 'Felipe', 'Contreras', '19.234.567-3', '+56 9 1111 0003', 'bodega', true
from auth.users u, public.sucursales s
where u.email = 'despacho@ondina.cl' and s.nombre = 'Ondina - Arica'
on conflict (id) do nothing;

-- 3) TIPOS DE EMPAQUE (prueba)
insert into public.tipos_empaque (nombre, categoria, activo) values
  ('Bidón 5 Litros',     'retornable',   true),
  ('Bidón 20 Litros',    'retornable',   true),
  ('Bolsa de Hielo 1kg', 'no_retornable', true),
  ('Bandeja',            'uso_interno',  true)
on conflict (nombre) do nothing;

-- 4) PRODUCTOS
insert into public.productos (nombre, tipo, tipo_empaque_id, precio_base, activo)
select v.nombre, v.tipo, t.id, v.precio, true
from (values
  ('Agua Purificada 5L',  'agua',  'Bidón 5 Litros',    1000),
  ('Agua Purificada 20L', 'agua',  'Bidón 20 Litros',   3000),
  ('Hielo en Bolsa 1kg',  'hielo', 'Bolsa de Hielo 1kg', 1200)
) as v(nombre, tipo, empaque, precio)
join public.tipos_empaque t on t.nombre = v.empaque
on conflict (nombre) do nothing;

-- 5) STOCK_BODEGA por sucursal y producto
insert into public.stock_bodega (sucursal_id, producto_id, cantidad)
select s.id, p.id, v.cantidad
from (values
  ('Ondina - Arica',   'Agua Purificada 5L',   200),
  ('Ondina - Arica',   'Agua Purificada 20L',  120),
  ('Ondina - Arica',   'Hielo en Bolsa 1kg',    80),
  ('Ondina - Iquique', 'Agua Purificada 5L',   150),
  ('Ondina - Iquique', 'Agua Purificada 20L',   60),
  ('Ondina - Iquique', 'Hielo en Bolsa 1kg',    40)
) as v(sucursal, producto, cantidad)
join public.sucursales s on s.nombre = v.sucursal
join public.productos p on p.nombre = v.producto
on conflict (sucursal_id, producto_id) do nothing;

-- 6) STOCK_ENVASES por sucursal y tipo de empaque
insert into public.stock_envases (sucursal_id, tipo_empaque_id, cantidad)
select s.id, t.id, v.cantidad
from (values
  ('Ondina - Arica',   'Bidón 5 Litros',     300),
  ('Ondina - Arica',   'Bidón 20 Litros',    150),
  ('Ondina - Arica',   'Bolsa de Hielo 1kg', 200),
  ('Ondina - Arica',   'Bandeja',             40),
  ('Ondina - Iquique', 'Bidón 5 Litros',     250),
  ('Ondina - Iquique', 'Bidón 20 Litros',     80),
  ('Ondina - Iquique', 'Bolsa de Hielo 1kg', 120),
  ('Ondina - Iquique', 'Bandeja',             25)
) as v(sucursal, empaque, cantidad)
join public.sucursales s on s.nombre = v.sucursal
join public.tipos_empaque t on t.nombre = v.empaque
on conflict (sucursal_id, tipo_empaque_id) do nothing;

commit;