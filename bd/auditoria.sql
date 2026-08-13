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

-- despacho_envases: auditoría simple (sin columna `anulado`)
create trigger trg_audit_despacho_envases
    after insert or update on public.despacho_envases
    for each row execute function public.fn_auditoria_simple();