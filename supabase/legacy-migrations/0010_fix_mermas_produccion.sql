-- ============================================================
-- 0010_fix_mermas_produccion.sql
-- Corrige HU-23:
-- - Producción puede registrar mermas de planta
-- - Producto + cantidad
-- - Descuento automático de stock_bodega
-- - Crea trigger faltante sobre public.mermas
-- ============================================================


-- ------------------------------------------------------------
-- 1. Función de negocio para registrar una merma
-- ------------------------------------------------------------
create or replace function public.trg_merma_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_despacho public.despachos%rowtype;
    v_stock integer;
begin

    -- ========================================================
    -- MERMA DE PRODUCTO
    -- ========================================================
    if new.producto_id is not null then

        -- ----------------------------------------------------
        -- Merma asociada a un despacho / vendedor
        -- ----------------------------------------------------
        if new.despacho_id is not null then

            select *
            into v_despacho
            from public.despachos
            where id = new.despacho_id;

            if not found then
                raise exception 'El despacho asociado no existe';
            end if;

            select cantidad
            into v_stock
            from public.carga_vendedor
            where vendedor_id = v_despacho.vendedor_id
              and producto_id = new.producto_id
            for update;

            if coalesce(v_stock, 0) < new.cantidad then
                raise exception
                    'Cantidad de merma superior a la carga disponible. Disponible: %',
                    coalesce(v_stock, 0);
            end if;

            update public.carga_vendedor
            set cantidad = cantidad - new.cantidad,
                modificado_en = now()
            where vendedor_id = v_despacho.vendedor_id
              and producto_id = new.producto_id;


        -- ----------------------------------------------------
        -- Merma de planta / Producción
        -- ----------------------------------------------------
        else

            select cantidad
            into v_stock
            from public.stock_bodega
            where sucursal_id = new.sucursal_id
              and producto_id = new.producto_id
            for update;

            if coalesce(v_stock, 0) < new.cantidad then
                raise exception
                    'Cantidad de merma superior al stock disponible. Disponible: %',
                    coalesce(v_stock, 0);
            end if;

            update public.stock_bodega
            set cantidad = cantidad - new.cantidad,
                modificado_en = now()
            where sucursal_id = new.sucursal_id
              and producto_id = new.producto_id;

        end if;


    -- ========================================================
    -- MERMA DE ENVASE
    -- ========================================================
    elsif new.tipo_empaque_id is not null then

        select cantidad
        into v_stock
        from public.stock_envases
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id
        for update;

        if coalesce(v_stock, 0) < new.cantidad then
            raise exception
                'Cantidad de merma superior a los envases disponibles. Disponibles: %',
                coalesce(v_stock, 0);
        end if;

        update public.stock_envases
        set cantidad = cantidad - new.cantidad,
            modificado_en = now()
        where sucursal_id = new.sucursal_id
          and tipo_empaque_id = new.tipo_empaque_id;

    else
        raise exception 'La merma debe indicar un producto o un tipo de envase';
    end if;

    return new;
end;
$$;


-- ------------------------------------------------------------
-- 2. Crear el trigger que actualmente falta en Supabase
-- ------------------------------------------------------------
drop trigger if exists trg_merma_insert
on public.mermas;

create trigger trg_merma_insert
after insert on public.mermas
for each row
execute function public.trg_merma_insert();


-- ------------------------------------------------------------
-- 3. Reemplazar policy de INSERT
-- ------------------------------------------------------------
drop policy if exists "mermas_insert_bodega"
on public.mermas;

drop policy if exists "mermas_insert_operativo"
on public.mermas;

create policy "mermas_insert_operativo"
on public.mermas
for insert
to authenticated
with check (
    creado_por = (select auth.uid())
    and (
        -- Administrador puede registrar en cualquier sucursal
        private.es_rol('administrador')

        -- Bodega puede registrar mermas de su sucursal
        or (
            private.es_rol('bodega')
            and sucursal_id = private.mi_sucursal()
        )

        -- Producción solo registra mermas de planta
        or (
            private.es_rol('produccion')
            and sucursal_id = private.mi_sucursal()
            and despacho_id is null
            and producto_id is not null
        )
    )
);


-- ------------------------------------------------------------
-- 4. Permisos
-- ------------------------------------------------------------
grant select, insert
on table public.mermas
to authenticated;

-- Hay una mejora importante respecto del trigger viejo del repositorio: no uso greatest(stock - merma, 0). Eso podría permitir registrar una merma de 100 cuando solamente hay 10 productos y simplemente dejar el stock en 0, ocultando una inconsistencia.
--Con este 0010, si tienes 10 productos y tratas de registrar una merma de 20:
--Cantidad de merma superior al stock disponible. Disponible: 10
--y no se registra la merma.