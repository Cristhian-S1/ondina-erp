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

-- DESPACHO_ENVASES
-- Mismas reglas que despacho_detalles: acceso según el despacho padre; bodega
-- inserta; administración corrige.
drop policy if exists "despacho_envases_select_despacho" on despacho_envases;
create policy "despacho_envases_select_despacho" on despacho_envases
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

drop policy if exists "despacho_envases_insert_bodega" on despacho_envases;
create policy "despacho_envases_insert_bodega" on despacho_envases
  for insert to authenticated
  with check (es_rol('bodega') or es_rol('administrador'));

drop policy if exists "despacho_envases_update_admin" on despacho_envases;
create policy "despacho_envases_update_admin" on despacho_envases
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
