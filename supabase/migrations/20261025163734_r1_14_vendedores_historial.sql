-- R1-14: historical seller roster for branch history screens (read-only).
-- Same identity/role/branch gate as public.vendedores_sucursal (RB-15), but it also
-- includes inactive sellers, with an `activo` flag. Every historical dispatch references the
-- seller through despachos_vendedor_id_sucursal_id_fkey (vendedor_id, sucursal_id) -> perfiles,
-- so a seller's perfiles.sucursal_id is the branch of all of their dispatches.
-- Returns no rut, telefono, email or other profile data.
create function public.vendedores_historial_sucursal(p_sucursal_id uuid)
returns table(id uuid, nombres text, apellidos text, activo boolean)
language sql stable security definer set search_path = '' as $$
 select p.id, p.nombres, p.apellidos, p.activo from public.perfiles p
 where (private.es_rol('bodega') or private.es_rol('administrador'))
 and private.perfil_activo()
 and (private.es_admin_global() or p_sucursal_id = private.mi_sucursal())
 and p.rol = 'vendedor' and p.sucursal_id = p_sucursal_id
 order by p.activo desc, p.nombres, p.apellidos;
$$;
comment on function public.vendedores_historial_sucursal(uuid) is
 'R1-14: sellers of the branch, active or not; id, names and activo only. Read-only; same gate as vendedores_sucursal.';
revoke execute on function public.vendedores_historial_sucursal(uuid) from public, anon;
grant execute on function public.vendedores_historial_sucursal(uuid) to authenticated, service_role;
