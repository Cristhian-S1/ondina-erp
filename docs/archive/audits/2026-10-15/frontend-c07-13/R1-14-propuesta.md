# R1-14 · Propuesta de backend: vendedores inactivos en el historial (2026-10-15)

> **Estado: PROPUESTA, sin aplicar.** No se creó nada en `supabase/migrations/` ni `supabase/tests/`, no se tocó la BD remota ni `frontend/src`. El SQL y la prueba se validaron sólo contra el Supabase local dentro de una transacción con `ROLLBACK`.

## 1. Diagnóstico

**RPC actual.** `supabase/migrations/20261013200000_b6_revision_fixes.sql:270-278` define `public.vendedores_sucursal(p_sucursal_id uuid)` → `table(id, nombres, apellidos)`:

- `language sql stable security definer set search_path = ''` (`:272`).
- Rol: `private.es_rol('bodega') or private.es_rol('administrador')` (`:274`); perfil del llamador activo: `private.perfil_activo()` (`:275`).
- Sucursal: `private.es_admin_global() or p_sucursal_id = private.mi_sucursal()` (`:276`).
- Filtro de datos: `p.sucursal_id = p_sucursal_id and p.rol = 'vendedor' and p.activo` (`:277`) ← **causa de R1-14**: los inactivos nunca salen.
- Grants: `revoke … from public, anon` (`:280`), `grant … to authenticated, service_role` (`:281`).
- Por qué existe: la política `perfiles_select_b6` (`:252-253`) deja a bodega leer sólo su propio perfil; la lista de vendedores sólo se obtiene por esta RPC (RB-15, `docs/engineering/database.md:156-160`). Un `select` directo a `perfiles` no es alternativa.
- Integridad: `despachos_vendedor_id_sucursal_id_fkey` es `FOREIGN KEY (vendedor_id, sucursal_id) REFERENCES perfiles(id, sucursal_id)`. Todo despacho de la sucursal A pertenece a un vendedor con `perfiles.sucursal_id = A`, de modo que «vendedor con relación a la sucursal» equivale a `perfiles.sucursal_id = p_sucursal_id`.

**Uso en frontend.**
- `frontend/src/domains/bodega/api.ts:53-62` `obtenerVendedores` → `supabase.rpc('vendedores_sucursal', …)`; tipo generado en `frontend/src/types/database-generated.types.ts:1803-1810`.
- `hooks/useDatosBodega.ts:17-23`: la misma lista alimenta el selector de «Nuevo despacho», el filtro por vendedor y `obtenerCargaVendedores(vendedores.map(v => v.id))`.
- `hooks/usePaginaBodega.ts:56-62`: arma `Map(id → nombre)`; si el vendedor no está muestra `Vendedor no disponible · ref. xxxxxxxx` y `vendedorDisponible=false`.
- `pages/Despachos.tsx:114,300,418,452-455` y `pages/Devoluciones.tsx:69,368,402,428`: historial, filtro y tarjetas.

**Pruebas actuales.** `supabase/tests/005_b6_revision.test.sql:69-83` (bodega/vendedor/admin) y `supabase/tests/002_security.test.sql:77` (lista cerrada de RPC autenticadas: **hay que añadir la función nueva**).

## 2. Opciones

| | A. RPC nueva `vendedores_historial_sucursal(p_sucursal_id)` | B. Parámetro opcional `p_incluir_inactivos boolean default false` | C. Relajar `perfiles_select_b6` |
|---|---|---|---|
| Compatibilidad | La RPC actual no cambia (el selector de despachos sigue sólo con activos) | Cambia la firma: `drop`+`create`, tipos generados y pruebas existentes | Reabre `rut`/`telefono` a bodega (RB-15) |
| Exposición | `id`, nombres, `activo`; misma compuerta | Igual, con un flag que el cliente puede activar siempre | Alta: viola RB-15 |
| Riesgo de regresión | Mínimo (aditiva) | Medio: el selector de nuevo despacho podría listar inactivos | Alto |
| Allow-list `002` | +1 nombre | Sin cambio | n/a |

**Recomendación: A.** Es aditiva y revertible (`drop function`), mantiene EXACTAMENTE la compuerta de identidad/rol/sucursal y evita que un inactivo aparezca en el selector de nuevos despachos (que sigue con `vendedores_sucursal`). C se descarta por RB-15.

La función devuelve los vendedores de la sucursal (activos primero, luego inactivos); no incluye correo, RUT, teléfono ni otra columna de `perfiles`.

## 3. Migración propuesta y prueba pgTAP

Archivo sugerido: `supabase/migrations/<timestamp posterior a 20261013200000>_r1_14_vendedores_historial.sql`.

```sql
-- R1-14: historical seller roster for branch history screens (read-only).
-- Same identity/role/branch gate as public.vendedores_sucursal (RB-15), but it also
-- returns inactive sellers too, with an `activo` flag. Every historical dispatch references the
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
```

Prueba sugerida: `supabase/tests/006_r1_14_vendedores_historial.test.sql`, más un cambio de una línea en `002_security.test.sql:77` (añadir `'vendedores_historial_sucursal'` a la lista).

```sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
-- R1-14 fixtures (synthetic): an inactive seller in each branch, the one of branch A with a past dispatch.
insert into auth.users(id,aud,role,email) values
 ('20000000-0000-0000-0001-000000000021','authenticated','authenticated','inactivo-a@example.invalid'),
 ('20000000-0000-0000-0002-000000000021','authenticated','authenticated','inactivo-b@example.invalid');;
insert into public.perfiles(id,sucursal_id,nombres,apellidos,rol,activo) values
 ('20000000-0000-0000-0001-000000000021','10000000-0000-0000-0000-000000000001','Inactivo','Sucursal A','vendedor',false),
 ('20000000-0000-0000-0002-000000000021','10000000-0000-0000-0000-000000000002','Inactivo','Sucursal B','vendedor',false);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000002',true);
insert into public.despachos(id,sucursal_id,vendedor_id,despachador_id,creado_por) values
 ('71000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0001-000000000021','20000000-0000-0000-0001-000000000002','20000000-0000-0000-0001-000000000002');

select is(pg_get_function_result('public.vendedores_historial_sucursal(uuid)'::regprocedure),'TABLE(id uuid, nombres text, apellidos text, activo boolean)','R1-14 returns only id, names and activo');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.vendedores_historial_sucursal(uuid)'::regprocedure),'R1-14 definer with empty search_path');
select ok(not has_function_privilege('anon','public.vendedores_historial_sucursal(uuid)','EXECUTE') and has_function_privilege('authenticated','public.vendedores_historial_sucursal(uuid)','EXECUTE'),'R1-14 grants: authenticated only');

-- bodega of branch A
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021' and not activo),'R1-14 bodega sees the inactive seller of its branch flagged inactive');
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000004' and activo),'R1-14 bodega still sees active sellers');
select ok(not exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0002-000000000021'),'R1-14 inactive seller of another branch is not exposed');
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'R1-14 bodega gets nothing for another branch');
select ok(not exists(select 1 from public.vendedores_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021'),'R1-14 original RPC is unchanged: still active only');
reset role;
-- branch administration
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000001',true);
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001') where id='20000000-0000-0000-0001-000000000021'),'R1-14 branch admin sees the inactive seller of its branch');
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002')),0::bigint,'R1-14 branch admin gets nothing for another branch');
reset role;
-- global admin
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select ok(exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002') where id='20000000-0000-0000-0002-000000000021' and not activo),'R1-14 global admin sees inactive sellers of branch B');
select ok(not exists(select 1 from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000002') where id='20000000-0000-0000-0001-000000000021'),'R1-14 global admin: branch A inactive seller is not listed under branch B');
reset role;
-- seller and production are denied (empty), anon gets 42501
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000004',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 seller gets no roster');
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0001-000000000003',true);
set local role authenticated;
select is((select count(*) from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')),0::bigint,'R1-14 production gets no roster');
reset role;
set local role anon;
select throws_ok($q$select * from public.vendedores_historial_sucursal('10000000-0000-0000-0000-000000000001')$q$,'42501',null,'R1-14 anon is denied');
reset role;
-- 002_security allow-list, extended with the new endpoint
select ok(not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and has_function_privilege('authenticated',p.oid,'EXECUTE')
 and p.proname not in ('registrar_venta','crear_despacho','corregir_devolucion','registrar_devolucion','contar_ventas_jornada','vendedores_sucursal','vendedores_historial_sucursal')),'Authenticated RPC allow-list (002) with the new endpoint');
select * from finish();
rollback;
```

**Validación local (transacción revertida).** Se ejecutó `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -At` con `begin; <migración>; <prueba sin begin/rollback>; select * from finish(); rollback;`. Tras el `ROLLBACK`, `to_regprocedure('public.vendedores_historial_sucursal(uuid)')` devolvió vacío (nada persistió). Salida:

```text
BEGIN
CREATE FUNCTION
COMMENT
REVOKE
GRANT
ok 1 - R1-14 returns only id, names and activo
ok 2 - R1-14 definer with empty search_path
ok 3 - R1-14 grants: authenticated only
ok 4 - R1-14 bodega sees the inactive seller of its branch flagged inactive
ok 5 - R1-14 bodega still sees active sellers
ok 6 - R1-14 inactive seller of another branch is not exposed
ok 7 - R1-14 bodega gets nothing for another branch
ok 8 - R1-14 original RPC is unchanged: still active only
ok 9 - R1-14 branch admin sees the inactive seller of its branch
ok 10 - R1-14 branch admin gets nothing for another branch
ok 11 - R1-14 global admin sees inactive sellers of branch B
ok 12 - R1-14 global admin: branch A inactive seller is not listed under branch B
ok 13 - R1-14 seller gets no roster
ok 14 - R1-14 production gets no roster
ok 15 - R1-14 anon is denied
ok 16 - Authenticated RPC allow-list (002) with the new endpoint
1..16
ROLLBACK
```

Nota: vendedor y producción reciben cero filas (igual que la RPC actual, que no lanza error); `anon` recibe `42501`.

## 4. Cambio de frontend (sólo descrito)

1. **Tipos generados**: regenerar `database-generated.types.ts` (aparece `vendedores_historial_sucursal` con `activo: boolean`).
2. **`bodega/api.ts`**: nueva `obtenerVendedoresHistorial(sucursalId)` con el mismo patrón de error que `obtenerVendedores`; tipo `VendedorHistorial = VendedorSucursal & { activo: boolean }`. `obtenerVendedores` se conserva para selectores y carga.
3. **`useDatosBodega`**: añadir `vendedoresHistorial` al `Promise.all`; `vendedores` y `obtenerCargaVendedores` siguen con los activos. Si la RPC nueva falla (p. ej. migración no aplicada aún), degradar a la lista de activos sin romper la pantalla.
4. **`usePaginaBodega`**: construir el `Map` desde el historial; etiqueta «Nombres Apellidos (inactivo)» si `!activo`; `vendedorDisponible` verdadero para inactivos conocidos, conservando `Vendedor no disponible · ref.` sólo para IDs realmente ausentes.
5. **Filtros** de Despachos/Devoluciones: usar el historial (inactivos al final) para filtrar el historial; el selector «Nuevo despacho» no cambia.
6. **Pruebas**: `api.test.ts` (RPC y error), `usePaginaBodega.test.tsx` («(inactivo)» y fallback), `Despachos.test.tsx`/`Devoluciones.test.tsx` (selector de nuevo despacho sin inactivos). Sin CSS nuevo.

## 5. Despliegue (según `docs/engineering/database.md`)

1. Crear migración y prueba en una rama desde `develop`; correr `supabase test db` sólo en una BD local/aislada (sin `db reset` sobre fixtures compartidos).
2. Revisar el SQL (compuerta idéntica a `vendedores_sucursal`, `search_path` vacío, grants) y la lista cerrada de `002`.
3. **No** ejecutar `supabase db push` contra producción mientras no estén cerradas la reconciliación de esquema/historial y la verificación aislada (`AGENTS.md`, `supabase/reconciliation.md`). Aplicar entonces por el procedimiento revisado, **antes** del commit de frontend (precedente: `supabase/reconciliation.md:425`).
4. Regenerar tipos y publicar el frontend con el degradado a la lista de activos.
5. Reversión: `drop function public.vendedores_historial_sucursal(uuid);` y revertir el frontend; no se modifica ningún dato.
