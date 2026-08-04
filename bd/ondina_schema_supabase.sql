-- ============================================================================
-- Sistema de Gestión de Ventas, Producción y Bodega — Ondina
-- Esquema de base de datos para Supabase (PostgreSQL 15+)
-- Versión 1.0 — 2026-08-01
--
-- Reemplaza a: ondina_sql.txt (borrador pgAdmin con errores de tipos y sintaxis)
-- Cumple: RF-01..RF-28, RNF-07/08/10/11/12/13/14/15/25/26, HU-01..HU-31
--
-- Convenciones (AGENTS.md §5):
--   - Tablas en español, plural, snake_case
--   - PKs uuid con gen_random_uuid()
--   - Toda fecha/hora en timestamptz (RNF-11)
--   - Soft-delete con "anulado" en tablas operacionales (RNF-14)
--   - RLS habilitado en TODA tabla (RNF-08)
--   - Auditoría por triggers hacia audit_log (RNF-12/13)
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================================

CREATE TYPE rol_usuario AS ENUM ('vendedor', 'bodega', 'produccion', 'administrador');
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'transferencia'); -- pendiente confirmar tarjeta (Problematica §3.3)
CREATE TYPE tipo_cliente AS ENUM ('mayorista', 'minorista', 'ocasional');
CREATE TYPE tipo_producto AS ENUM ('agua', 'hielo');
CREATE TYPE categoria_empaque AS ENUM ('retornable', 'no_retornable');
CREATE TYPE estado_envase AS ENUM ('bueno', 'malo');
CREATE TYPE tipo_documento AS ENUM ('boleta', 'factura');
CREATE TYPE tipo_gasto AS ENUM ('combustible', 'averia', 'otra');

-- ============================================================================
-- 2. TABLAS MAESTRAS
-- ============================================================================

-- Sucursales: hoy la empresa opera UNA planta; se mantiene la tabla para no
-- rediseñar si más adelante abre otra (ver Problematica §3.2).
CREATE TABLE public.sucursales (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL,
    comuna      text,
    region      text,
    telefono    text,
    activa      boolean NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Perfiles: extiende auth.users de Supabase. La contraseña NUNCA se guarda aquí;
-- la gestiona Supabase Auth. id = auth.users.id (RNF-07).
CREATE TABLE public.perfiles (
    id              uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    sucursal_id     uuid REFERENCES public.sucursales (id),
    nombres         text NOT NULL,
    apellidos       text NOT NULL,
    rut             text UNIQUE,
    telefono        text,
    rol             rol_usuario NOT NULL,
    activo          boolean NOT NULL DEFAULT true,          -- deshabilitar sin borrar (HU-10, RNF-14)
    creado_en       timestamptz NOT NULL DEFAULT now(),
    modificado_en   timestamptz
);

CREATE TABLE public.tipos_empaque (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              text NOT NULL UNIQUE,               -- bidón policarbonato, bidón PET, bidón 10L, bolsa hielo, bandeja
    categoria           categoria_empaque NOT NULL DEFAULT 'retornable',
    capacidad_unidades  integer NOT NULL DEFAULT 1 CHECK (capacidad_unidades > 0),
    activo              boolean NOT NULL DEFAULT true
);

-- Catálogo único de productos (RF-28, HU-17). Nunca se borran: se desactivan (RNF-14).
CREATE TABLE public.productos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          text NOT NULL UNIQUE,                   -- "Bidón Policarbonato 20L", "Hielo Frape", ...
    tipo            tipo_producto NOT NULL,
    tipo_empaque_id uuid REFERENCES public.tipos_empaque (id),
    precio_base     numeric(12,2) NOT NULL CHECK (precio_base >= 0),
    imagen_url      text,
    activo          boolean NOT NULL DEFAULT true,          -- desactivar, no eliminar (HU-17)
    creado_en       timestamptz NOT NULL DEFAULT now(),
    modificado_en   timestamptz
);

-- Clientes (RF-02, HU-02). La cartera es del vendedor asignado.
CREATE TABLE public.clientes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     uuid REFERENCES public.sucursales (id),
    vendedor_id     uuid NOT NULL REFERENCES public.perfiles (id),
    nombre          text NOT NULL,
    telefono        text,                                   -- text: conserva +56 y ceros
    direccion       text NOT NULL,
    numero_local    text,                                   -- HU-02
    comuna          text,
    tipo            tipo_cliente NOT NULL DEFAULT 'minorista',
    activo          boolean NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id),   -- RNF-12
    modificado_en   timestamptz,
    modificado_por  uuid REFERENCES public.perfiles (id)    -- solo admin edita (HU-02, RNF-10)
);

-- Parámetros configurables del negocio (RNF-26): ventana de ajuste, días de
-- inactividad, etc. Se editan desde la app por el administrador, sin código.
CREATE TABLE public.parametros_configuracion (
    clave           text PRIMARY KEY,
    valor           text NOT NULL,
    descripcion     text,
    modificado_en   timestamptz,
    modificado_por  uuid REFERENCES public.perfiles (id)
);

-- Reglas de comisión configurables (RF-25, HU-15). Se conserva el historial:
-- una regla no se edita, se cierra (vigente_hasta) y se crea la nueva.
CREATE TABLE public.comisiones_reglas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_producto   tipo_producto NOT NULL,
    porcentaje      numeric(5,2) CHECK (porcentaje >= 0),
    monto_fijo      numeric(12,2) CHECK (monto_fijo >= 0),
    vigente_desde   timestamptz NOT NULL DEFAULT now(),
    vigente_hasta   timestamptz,                            -- NULL = regla vigente
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id),
    CHECK (porcentaje IS NOT NULL OR monto_fijo IS NOT NULL)
);

-- ============================================================================
-- 3. INVENTARIO
-- ============================================================================

-- Stock de productos en bodega (RF-11, HU-24). Se actualiza SOLO por triggers.
CREATE TABLE public.stock_bodega (
    producto_id     uuid PRIMARY KEY REFERENCES public.productos (id),
    cantidad        integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    modificado_en   timestamptz NOT NULL DEFAULT now()
);

-- Carga actual de cada vendedor en ruta (RF-17, HU-03). Solo por triggers.
CREATE TABLE public.carga_vendedor (
    vendedor_id     uuid NOT NULL REFERENCES public.perfiles (id),
    producto_id     uuid NOT NULL REFERENCES public.productos (id),
    cantidad        integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    modificado_en   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (vendedor_id, producto_id)
);

-- Envases vacíos disponibles en bodega para producción (RF-06, HU-19).
CREATE TABLE public.inventario_envases (
    tipo_empaque_id uuid PRIMARY KEY REFERENCES public.tipos_empaque (id),
    cantidad        integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    modificado_en   timestamptz NOT NULL DEFAULT now()
);

-- Bandejas/cajas (planilla "auditoría de ingreso y salida": "cantidad de cajas").
CREATE TABLE public.inventario_bandejas (
    sucursal_id     uuid PRIMARY KEY REFERENCES public.sucursales (id),
    cantidad_bodega integer NOT NULL DEFAULT 0 CHECK (cantidad_bodega >= 0),
    cantidad_ruta   integer NOT NULL DEFAULT 0 CHECK (cantidad_ruta >= 0),
    modificado_en   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. VENTAS (HU-01..HU-09)
-- ============================================================================

CREATE TABLE public.ventas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id     uuid NOT NULL REFERENCES public.perfiles (id),
    cliente_id      uuid NOT NULL REFERENCES public.clientes (id),
    metodo_pago     metodo_pago NOT NULL DEFAULT 'efectivo',
    observaciones   text,                                   -- RF-01
    cupon           text,                                   -- cupón/descuento por cliente (planilla física)
    descuento       numeric(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total           numeric(12,2) NOT NULL DEFAULT 0,       -- lo recalcula trigger
    anulado         boolean NOT NULL DEFAULT false,         -- RNF-14: se anula, no se borra
    creado_en       timestamptz NOT NULL DEFAULT now(),     -- RNF-11
    creado_por      uuid REFERENCES public.perfiles (id),   -- RNF-12
    modificado_en   timestamptz,
    modificado_por  uuid REFERENCES public.perfiles (id)    -- solo admin corrige (HU-13)
);

CREATE TABLE public.venta_detalles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id            uuid NOT NULL REFERENCES public.ventas (id),
    producto_id         uuid NOT NULL REFERENCES public.productos (id),
    cantidad            integer NOT NULL CHECK (cantidad > 0),
    precio_unitario     numeric(12,2) NOT NULL CHECK (precio_unitario >= 0), -- puede diferir del estándar (RF-01)
    subtotal            numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    envases_recibidos   integer NOT NULL DEFAULT 0 CHECK (envases_recibidos >= 0) -- intercambio bidón lleno/vacío
);

-- Boletas / facturas (RF-20, HU-06).
CREATE TABLE public.documentos_tributarios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id        uuid NOT NULL REFERENCES public.ventas (id),
    tipo            tipo_documento NOT NULL,
    folio           text NOT NULL,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tipo, folio)
);

-- Gastos extra de la jornada (RF-21, HU-07).
CREATE TABLE public.gastos_extras (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id     uuid NOT NULL REFERENCES public.perfiles (id),
    tipo            tipo_gasto NOT NULL DEFAULT 'otra',
    monto           numeric(12,2) NOT NULL CHECK (monto > 0),
    motivo          text NOT NULL,
    patente         text,                                   -- si el gasto es del vehículo (Problematica §3.3)
    comprobante_url text,                                   -- foto en Supabase Storage (bucket "comprobantes")
    anulado         boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id),
    modificado_en   timestamptz,
    modificado_por  uuid REFERENCES public.perfiles (id)
);

-- ============================================================================
-- 5. DESPACHO / BODEGA (HU-24..HU-29)
-- ============================================================================

CREATE TABLE public.despachos (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id         uuid NOT NULL REFERENCES public.perfiles (id),
    despachador_id      uuid NOT NULL REFERENCES public.perfiles (id),
    cantidad_bandejas   integer NOT NULL DEFAULT 0 CHECK (cantidad_bandejas >= 0), -- "cajas" de la planilla
    anulado             boolean NOT NULL DEFAULT false,
    creado_en           timestamptz NOT NULL DEFAULT now(), -- hora de salida; base de la ventana de ajuste
    creado_por          uuid REFERENCES public.perfiles (id),
    modificado_en       timestamptz,
    modificado_por      uuid REFERENCES public.perfiles (id)
);

CREATE TABLE public.despacho_detalles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    despacho_id     uuid NOT NULL REFERENCES public.despachos (id),
    producto_id     uuid NOT NULL REFERENCES public.productos (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    es_ajuste       boolean NOT NULL DEFAULT false,         -- true = sumado dentro de la ventana (HU-26)
    creado_en       timestamptz NOT NULL DEFAULT now()
    -- Restar o editar filas está prohibido por regla de negocio: solo se suman
    -- nuevas filas con es_ajuste = true dentro de la ventana (RNF-15).
);

CREATE TABLE public.devoluciones_productos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    despacho_id     uuid NOT NULL REFERENCES public.despachos (id),
    producto_id     uuid NOT NULL REFERENCES public.productos (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),  -- "retornos llenos" de la planilla
    anulado         boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id)
);

CREATE TABLE public.devoluciones_envases (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    despacho_id     uuid NOT NULL REFERENCES public.despachos (id),
    tipo_empaque_id uuid NOT NULL REFERENCES public.tipos_empaque (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    estado          estado_envase NOT NULL DEFAULT 'bueno', -- "roto" se registra como merma
    anulado         boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id)
);

CREATE TABLE public.retorno_bandejas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    despacho_id     uuid NOT NULL REFERENCES public.despachos (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id)
);

CREATE TABLE public.mermas (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    despacho_id     uuid REFERENCES public.despachos (id),  -- NULL = merma en planta/bodega
    producto_id     uuid REFERENCES public.productos (id),
    tipo_empaque_id uuid REFERENCES public.tipos_empaque (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    motivo          text NOT NULL,                          -- HU-29: obligatorio (RNF-25)
    anulado         boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id),
    CHECK (producto_id IS NOT NULL OR tipo_empaque_id IS NOT NULL) -- merma de producto O de envase
);

-- ============================================================================
-- 6. PRODUCCIÓN (HU-19..HU-23)
-- ============================================================================

CREATE TABLE public.produccion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id     uuid NOT NULL REFERENCES public.productos (id),
    cantidad        integer NOT NULL CHECK (cantidad > 0),  -- descarga de hielo ≈ 50 unidades (HU-20)
    observaciones   text,
    anulado         boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id)
);

CREATE TABLE public.incidencias_produccion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produccion_id   uuid REFERENCES public.produccion (id), -- NULL = incidencia general (HU-23)
    descripcion     text NOT NULL,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    creado_por      uuid REFERENCES public.perfiles (id)
);

-- ============================================================================
-- 7. UBICACIONES GPS (RF-27, HU-16) Y AUDITORÍA (RNF-12/13, HU-13)
-- ============================================================================

CREATE TABLE public.ubicaciones_vendedores (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendedor_id     uuid NOT NULL REFERENCES public.perfiles (id),
    latitud         numeric(9,6) NOT NULL,
    longitud        numeric(9,6) NOT NULL,
    registrado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla               text NOT NULL,
    registro_id         text NOT NULL,
    accion              text NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'ANULACION')),
    usuario_id          uuid,                               -- auth.uid() al momento del cambio (RNF-12)
    valores_anteriores  jsonb,                              -- HU-13: valor anterior
    valores_nuevos      jsonb,                              -- HU-13: valor nuevo
    creado_en           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. ÍNDICES (FKs y consultas frecuentes de reportes)
-- ============================================================================

CREATE INDEX idx_clientes_vendedor          ON public.clientes (vendedor_id) WHERE activo;
CREATE INDEX idx_ventas_vendedor_fecha      ON public.ventas (vendedor_id, creado_en) WHERE NOT anulado;
CREATE INDEX idx_ventas_cliente             ON public.ventas (cliente_id);
CREATE INDEX idx_venta_detalles_venta       ON public.venta_detalles (venta_id);
CREATE INDEX idx_venta_detalles_producto    ON public.venta_detalles (producto_id);
CREATE INDEX idx_despachos_vendedor_fecha   ON public.despachos (vendedor_id, creado_en);
CREATE INDEX idx_despacho_detalles_despacho ON public.despacho_detalles (despacho_id);
CREATE INDEX idx_gastos_vendedor_fecha      ON public.gastos_extras (vendedor_id, creado_en);
CREATE INDEX idx_produccion_fecha           ON public.produccion (creado_en);
CREATE INDEX idx_ubicaciones_vendedor       ON public.ubicaciones_vendedores (vendedor_id, registrado_en DESC);
CREATE INDEX idx_audit_tabla_registro       ON public.audit_log (tabla, registro_id);

-- ============================================================================
-- 9. FUNCIONES Y TRIGGERS — REGLAS DE NEGOCIO
-- ============================================================================

-- Rol del usuario autenticado (para políticas RLS) --------------------------------
CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS rol_usuario
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT rol FROM public.perfiles WHERE id = auth.uid() AND activo;
$$;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT public.rol_actual() = 'administrador';
$$;

-- Sello de modificación ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sello_modificacion()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
    NEW.modificado_en := now();
    NEW.modificado_por := auth.uid();
    RETURN NEW;
END;
$$;

-- Auditoría genérica (RNF-12/13, HU-13) ------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_log (tabla, registro_id, accion, usuario_id, valores_anteriores, valores_nuevos)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        CASE
            WHEN TG_OP = 'INSERT' THEN 'INSERT'
            WHEN TG_OP = 'UPDATE' AND NEW.anulado AND NOT OLD.anulado THEN 'ANULACION'
            ELSE 'UPDATE'
        END,
        auth.uid(),
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$;

-- Despacho: valida ventana de ajuste, descuenta stock y suma carga (HU-25/26) -----
CREATE OR REPLACE FUNCTION public.fn_despacho_detalle_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_despacho      public.despachos%ROWTYPE;
    v_minutos       integer;
    v_stock_actual  integer;
BEGIN
    SELECT * INTO v_despacho FROM public.despachos WHERE id = NEW.despacho_id FOR UPDATE;
    IF v_despacho.anulado THEN
        RAISE EXCEPTION 'El despacho está anulado';
    END IF;

    -- HU-26 / RNF-15: los ajustes solo suman, y solo dentro de la ventana configurable
    IF NEW.es_ajuste THEN
        SELECT valor::integer INTO v_minutos
        FROM public.parametros_configuracion WHERE clave = 'ventana_ajuste_minutos';
        IF now() > v_despacho.creado_en + make_interval(mins => v_minutos) THEN
            RAISE EXCEPTION 'La ventana de ajuste expiró (% minutos). Solo el administrador puede corregir el despacho.', v_minutos;
        END IF;
    END IF;

    -- Valida y descuenta stock de bodega (RNF-25)
    SELECT cantidad INTO v_stock_actual FROM public.stock_bodega
    WHERE producto_id = NEW.producto_id FOR UPDATE;
    IF v_stock_actual IS NULL OR v_stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente en bodega para el producto %', NEW.producto_id;
    END IF;
    UPDATE public.stock_bodega
    SET cantidad = cantidad - NEW.cantidad, modificado_en = now()
    WHERE producto_id = NEW.producto_id;

    -- Suma a la carga del vendedor (RF-17)
    INSERT INTO public.carga_vendedor (vendedor_id, producto_id, cantidad, modificado_en)
    VALUES (v_despacho.vendedor_id, NEW.producto_id, NEW.cantidad, now())
    ON CONFLICT (vendedor_id, producto_id)
    DO UPDATE SET cantidad = carga_vendedor.cantidad + EXCLUDED.cantidad, modificado_en = now();

    RETURN NEW;
END;
$$;

-- Venta: descuenta de la carga del vendedor (HU-01) --------------------------------
CREATE OR REPLACE FUNCTION public.fn_venta_detalle_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_vendedor uuid;
BEGIN
    SELECT vendedor_id INTO v_vendedor FROM public.ventas WHERE id = NEW.venta_id;

    UPDATE public.carga_vendedor
    SET cantidad = cantidad - NEW.cantidad, modificado_en = now()
    WHERE vendedor_id = v_vendedor AND producto_id = NEW.producto_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El vendedor no tiene carga del producto %', NEW.producto_id;
    END IF;
    IF (SELECT cantidad FROM public.carga_vendedor
        WHERE vendedor_id = v_vendedor AND producto_id = NEW.producto_id) < 0 THEN
        RAISE EXCEPTION 'Carga insuficiente del vendedor para el producto %', NEW.producto_id;
    END IF;

    -- Envases recibidos en la venta suman al inventario de vacíos
    IF NEW.envases_recibidos > 0 THEN
        INSERT INTO public.inventario_envases (tipo_empaque_id, cantidad, modificado_en)
        SELECT p.tipo_empaque_id, NEW.envases_recibidos, now()
        FROM public.productos p WHERE p.id = NEW.producto_id AND p.tipo_empaque_id IS NOT NULL
        ON CONFLICT (tipo_empaque_id)
        DO UPDATE SET cantidad = inventario_envases.cantidad + EXCLUDED.cantidad, modificado_en = now();
    END IF;

    RETURN NEW;
END;
$$;

-- Venta: recalcula total (subtotales - descuento) -----------------------------------
CREATE OR REPLACE FUNCTION public.fn_venta_recalcular_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_venta uuid := COALESCE(NEW.venta_id, OLD.venta_id);
BEGIN
    UPDATE public.ventas v
    SET total = GREATEST(
        COALESCE((SELECT sum(subtotal) FROM public.venta_detalles WHERE venta_id = v_venta), 0) - v.descuento, 0)
    WHERE v.id = v_venta;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Devolución de productos: carga → bodega (HU-27) -----------------------------------
CREATE OR REPLACE FUNCTION public.fn_devolucion_producto_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_vendedor uuid;
BEGIN
    SELECT vendedor_id INTO v_vendedor FROM public.despachos WHERE id = NEW.despacho_id;

    UPDATE public.carga_vendedor
    SET cantidad = GREATEST(cantidad - NEW.cantidad, 0), modificado_en = now()
    WHERE vendedor_id = v_vendedor AND producto_id = NEW.producto_id;

    INSERT INTO public.stock_bodega (producto_id, cantidad, modificado_en)
    VALUES (NEW.producto_id, NEW.cantidad, now())
    ON CONFLICT (producto_id)
    DO UPDATE SET cantidad = stock_bodega.cantidad + EXCLUDED.cantidad, modificado_en = now();

    RETURN NEW;
END;
$$;

-- Devolución de envases: suman al inventario de vacíos (HU-28) -----------------------
CREATE OR REPLACE FUNCTION public.fn_devolucion_envase_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.inventario_envases (tipo_empaque_id, cantidad, modificado_en)
    VALUES (NEW.tipo_empaque_id, NEW.cantidad, now())
    ON CONFLICT (tipo_empaque_id)
    DO UPDATE SET cantidad = inventario_envases.cantidad + EXCLUDED.cantidad, modificado_en = now();
    RETURN NEW;
END;
$$;

-- Producción: suma al stock (HU-20) -------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_produccion_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.stock_bodega (producto_id, cantidad, modificado_en)
    VALUES (NEW.producto_id, NEW.cantidad, now())
    ON CONFLICT (producto_id)
    DO UPDATE SET cantidad = stock_bodega.cantidad + EXCLUDED.cantidad, modificado_en = now();
    RETURN NEW;
END;
$$;

-- Mermas: descuentan de carga (ruta) o de bodega (planta); envases rotos descuentan
-- del inventario de vacíos (HU-29) --------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_merma_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_vendedor uuid;
BEGIN
    IF NEW.producto_id IS NOT NULL THEN
        IF NEW.despacho_id IS NOT NULL THEN
            SELECT vendedor_id INTO v_vendedor FROM public.despachos WHERE id = NEW.despacho_id;
            UPDATE public.carga_vendedor
            SET cantidad = GREATEST(cantidad - NEW.cantidad, 0), modificado_en = now()
            WHERE vendedor_id = v_vendedor AND producto_id = NEW.producto_id;
        ELSE
            UPDATE public.stock_bodega
            SET cantidad = GREATEST(cantidad - NEW.cantidad, 0), modificado_en = now()
            WHERE producto_id = NEW.producto_id;
        END IF;
    ELSIF NEW.tipo_empaque_id IS NOT NULL THEN
        UPDATE public.inventario_envases
        SET cantidad = GREATEST(cantidad - NEW.cantidad, 0), modificado_en = now()
        WHERE tipo_empaque_id = NEW.tipo_empaque_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Bandejas: salida con el despacho y retorno -----------------------------------------
CREATE OR REPLACE FUNCTION public.fn_despacho_bandejas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_sucursal uuid;
BEGIN
    IF NEW.cantidad_bandejas > 0 THEN
        SELECT sucursal_id INTO v_sucursal FROM public.perfiles WHERE id = NEW.despachador_id;
        IF v_sucursal IS NOT NULL THEN
            UPDATE public.inventario_bandejas
            SET cantidad_bodega = GREATEST(cantidad_bodega - NEW.cantidad_bandejas, 0),
                cantidad_ruta   = cantidad_ruta + NEW.cantidad_bandejas,
                modificado_en   = now()
            WHERE sucursal_id = v_sucursal;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_retorno_bandejas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_sucursal uuid;
BEGIN
    SELECT p.sucursal_id INTO v_sucursal
    FROM public.despachos d JOIN public.perfiles p ON p.id = d.despachador_id
    WHERE d.id = NEW.despacho_id;
    IF v_sucursal IS NOT NULL THEN
        UPDATE public.inventario_bandejas
        SET cantidad_ruta   = GREATEST(cantidad_ruta - NEW.cantidad, 0),
            cantidad_bodega = cantidad_bodega + NEW.cantidad,
            modificado_en   = now()
        WHERE sucursal_id = v_sucursal;
    END IF;
    RETURN NEW;
END;
$$;

-- Activación de triggers ------------------------------------------------------------
CREATE TRIGGER trg_despacho_detalle_insert     AFTER INSERT ON public.despacho_detalles
    FOR EACH ROW EXECUTE FUNCTION public.fn_despacho_detalle_insert();
CREATE TRIGGER trg_venta_detalle_insert        AFTER INSERT ON public.venta_detalles
    FOR EACH ROW EXECUTE FUNCTION public.fn_venta_detalle_insert();
CREATE TRIGGER trg_venta_total_ins             AFTER INSERT ON public.venta_detalles
    FOR EACH ROW EXECUTE FUNCTION public.fn_venta_recalcular_total();
CREATE TRIGGER trg_venta_total_upd             AFTER UPDATE ON public.venta_detalles
    FOR EACH ROW EXECUTE FUNCTION public.fn_venta_recalcular_total();
CREATE TRIGGER trg_venta_total_del             AFTER DELETE ON public.venta_detalles
    FOR EACH ROW EXECUTE FUNCTION public.fn_venta_recalcular_total();
CREATE TRIGGER trg_devolucion_producto         AFTER INSERT ON public.devoluciones_productos
    FOR EACH ROW EXECUTE FUNCTION public.fn_devolucion_producto_insert();
CREATE TRIGGER trg_devolucion_envase           AFTER INSERT ON public.devoluciones_envases
    FOR EACH ROW EXECUTE FUNCTION public.fn_devolucion_envase_insert();
CREATE TRIGGER trg_produccion_insert           AFTER INSERT ON public.produccion
    FOR EACH ROW EXECUTE FUNCTION public.fn_produccion_insert();
CREATE TRIGGER trg_merma_insert                AFTER INSERT ON public.mermas
    FOR EACH ROW EXECUTE FUNCTION public.fn_merma_insert();
CREATE TRIGGER trg_despacho_bandejas           AFTER INSERT ON public.despachos
    FOR EACH ROW EXECUTE FUNCTION public.fn_despacho_bandejas();
CREATE TRIGGER trg_retorno_bandejas            AFTER INSERT ON public.retorno_bandejas
    FOR EACH ROW EXECUTE FUNCTION public.fn_retorno_bandejas();

-- Auditoría en tablas operacionales y corregibles por el admin (HU-13)
CREATE TRIGGER trg_audit_ventas        AFTER INSERT OR UPDATE ON public.ventas
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
CREATE TRIGGER trg_audit_despachos     AFTER INSERT OR UPDATE ON public.despachos
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
CREATE TRIGGER trg_audit_produccion    AFTER INSERT OR UPDATE ON public.produccion
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
CREATE TRIGGER trg_audit_gastos        AFTER INSERT OR UPDATE ON public.gastos_extras
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
CREATE TRIGGER trg_audit_mermas        AFTER INSERT OR UPDATE ON public.mermas
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
CREATE TRIGGER trg_audit_clientes      AFTER INSERT OR UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Sello de modificación
CREATE TRIGGER trg_sello_ventas        BEFORE UPDATE ON public.ventas
    FOR EACH ROW EXECUTE FUNCTION public.fn_sello_modificacion();
CREATE TRIGGER trg_sello_despachos     BEFORE UPDATE ON public.despachos
    FOR EACH ROW EXECUTE FUNCTION public.fn_sello_modificacion();
CREATE TRIGGER trg_sello_clientes      BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_sello_modificacion();
CREATE TRIGGER trg_sello_gastos        BEFORE UPDATE ON public.gastos_extras
    FOR EACH ROW EXECUTE FUNCTION public.fn_sello_modificacion();
CREATE TRIGGER trg_sello_productos     BEFORE UPDATE ON public.productos
    FOR EACH ROW EXECUTE FUNCTION public.fn_sello_modificacion();

-- ============================================================================
-- 10. VISTAS DE APOYO A REPORTES (RF-22, RF-24, RF-05, HU-08/12/14)
-- ============================================================================

-- Stock actual con nombre de producto (HU-24)
CREATE VIEW public.v_stock_actual AS
SELECT p.id AS producto_id, p.nombre, p.tipo, COALESCE(s.cantidad, 0) AS cantidad, s.modificado_en
FROM public.productos p
LEFT JOIN public.stock_bodega s ON s.producto_id = p.id
WHERE p.activo;

-- Cuadre por despacho: despachado vs vendido vs devuelto vs merma (Problematica §2.3)
CREATE VIEW public.v_cuadre_despacho AS
SELECT
    d.id AS despacho_id,
    d.vendedor_id,
    d.creado_en::date AS fecha,
    dd.producto_id,
    sum(dd.cantidad) AS cantidad_despachada,
    COALESCE(v.cantidad_vendida, 0)   AS cantidad_vendida,
    COALESCE(dp.cantidad_devuelta, 0) AS cantidad_devuelta,
    COALESCE(m.cantidad_merma, 0)     AS cantidad_merma,
    sum(dd.cantidad) - COALESCE(v.cantidad_vendida, 0) - COALESCE(dp.cantidad_devuelta, 0)
        - COALESCE(m.cantidad_merma, 0) AS diferencia
FROM public.despachos d
JOIN public.despacho_detalles dd ON dd.despacho_id = d.id
LEFT JOIN (
    SELECT vd.producto_id, vt.vendedor_id, vt.creado_en::date AS fecha, sum(vd.cantidad) AS cantidad_vendida
    FROM public.ventas vt JOIN public.venta_detalles vd ON vd.venta_id = vt.id
    WHERE NOT vt.anulado
    GROUP BY vd.producto_id, vt.vendedor_id, vt.creado_en::date
) v ON v.producto_id = dd.producto_id AND v.vendedor_id = d.vendedor_id AND v.fecha = d.creado_en::date
LEFT JOIN (
    SELECT despacho_id, producto_id, sum(cantidad) AS cantidad_devuelta
    FROM public.devoluciones_productos WHERE NOT anulado GROUP BY despacho_id, producto_id
) dp ON dp.despacho_id = d.id AND dp.producto_id = dd.producto_id
LEFT JOIN (
    SELECT despacho_id, producto_id, sum(cantidad) AS cantidad_merma
    FROM public.mermas WHERE NOT anulado AND producto_id IS NOT NULL GROUP BY despacho_id, producto_id
) m ON m.despacho_id = d.id AND m.producto_id = dd.producto_id
WHERE NOT d.anulado
GROUP BY d.id, d.vendedor_id, d.creado_en::date, dd.producto_id,
         v.cantidad_vendida, dp.cantidad_devuelta, m.cantidad_merma;

-- Ingresos diarios por vendedor (HU-14, Problematica §2.2)
CREATE VIEW public.v_ventas_diarias AS
SELECT creado_en::date AS fecha, vendedor_id,
       count(*) AS cantidad_ventas, sum(total) AS total_ingresos
FROM public.ventas
WHERE NOT anulado
GROUP BY creado_en::date, vendedor_id;

-- Ranking de vendedores (RF-22, HU-08)
CREATE VIEW public.v_ranking_vendedores AS
SELECT p.id AS vendedor_id, p.nombres || ' ' || p.apellidos AS vendedor,
       date_trunc('month', v.creado_en) AS mes,
       count(v.id) AS cantidad_ventas, COALESCE(sum(v.total), 0) AS total_vendido
FROM public.perfiles p
LEFT JOIN public.ventas v ON v.vendedor_id = p.id AND NOT v.anulado
WHERE p.rol = 'vendedor' AND p.activo
GROUP BY p.id, p.nombres, p.apellidos, date_trunc('month', v.creado_en)
ORDER BY mes DESC, total_vendido DESC;

-- Clientes inactivos según parámetro configurable (RF-05, HU-12)
CREATE VIEW public.v_clientes_inactivos AS
SELECT c.id AS cliente_id, c.nombre, c.vendedor_id,
       max(v.creado_en) AS ultima_compra,
       (SELECT valor::integer FROM public.parametros_configuracion
        WHERE clave = 'dias_inactividad_cliente') AS dias_configurados,
       now()::date - max(v.creado_en)::date AS dias_sin_comprar
FROM public.clientes c
LEFT JOIN public.ventas v ON v.cliente_id = c.id AND NOT v.anulado
WHERE c.activo
GROUP BY c.id, c.nombre, c.vendedor_id
HAVING max(v.creado_en) IS NULL
    OR now()::date - max(v.creado_en)::date >
       (SELECT valor::integer FROM public.parametros_configuracion
        WHERE clave = 'dias_inactividad_cliente');

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RNF-08, RNF-10, HU-31)
-- ============================================================================

ALTER TABLE public.perfiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_empaque             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_configuracion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comisiones_reglas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_bodega              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carga_vendedor            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_envases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_bandejas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_tributarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_extras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despacho_detalles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones_productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones_envases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retorno_bandejas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mermas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias_produccion    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones_vendedores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                 ENABLE ROW LEVEL SECURITY;

-- perfiles: cada usuario ve el suyo; admin los gestiona todos (HU-10)
CREATE POLICY perfiles_select ON public.perfiles FOR SELECT
    USING (id = auth.uid() OR public.es_admin());
CREATE POLICY perfiles_admin_all ON public.perfiles FOR ALL
    USING (public.es_admin()) WITH CHECK (public.es_admin());

-- Maestros: lectura para usuarios autenticados; escritura solo admin
CREATE POLICY sucursales_select ON public.sucursales FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY sucursales_admin  ON public.sucursales FOR ALL USING (public.es_admin());
CREATE POLICY tipos_empaque_select ON public.tipos_empaque FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY tipos_empaque_admin  ON public.tipos_empaque FOR ALL USING (public.es_admin());
CREATE POLICY productos_select ON public.productos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY productos_admin  ON public.productos FOR ALL USING (public.es_admin());
CREATE POLICY parametros_select ON public.parametros_configuracion FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY parametros_admin  ON public.parametros_configuracion FOR ALL USING (public.es_admin());
CREATE POLICY comisiones_select ON public.comisiones_reglas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY comisiones_admin  ON public.comisiones_reglas FOR ALL USING (public.es_admin());

-- clientes: el vendedor ve y registra solo los suyos; editar, solo admin (HU-02/04)
CREATE POLICY clientes_vendedor_select ON public.clientes FOR SELECT
    USING (vendedor_id = auth.uid() OR public.es_admin());
CREATE POLICY clientes_vendedor_insert ON public.clientes FOR INSERT
    WITH CHECK (vendedor_id = auth.uid() OR public.es_admin());
CREATE POLICY clientes_admin_update ON public.clientes FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

-- ventas: el vendedor registra y ve solo las suyas; corregir, solo admin (HU-01, RNF-10)
CREATE POLICY ventas_vendedor_select ON public.ventas FOR SELECT
    USING (vendedor_id = auth.uid() OR public.es_admin());
CREATE POLICY ventas_vendedor_insert ON public.ventas FOR INSERT
    WITH CHECK (vendedor_id = auth.uid() AND public.rol_actual() = 'vendedor');
CREATE POLICY ventas_admin_update ON public.ventas FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY venta_detalles_select ON public.venta_detalles FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id
                   AND (v.vendedor_id = auth.uid() OR public.es_admin())));
CREATE POLICY venta_detalles_insert ON public.venta_detalles FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id
                        AND v.vendedor_id = auth.uid() AND NOT v.anulado));
CREATE POLICY venta_detalles_admin ON public.venta_detalles FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY documentos_select ON public.documentos_tributarios FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id
                   AND (v.vendedor_id = auth.uid() OR public.es_admin())));
CREATE POLICY documentos_insert ON public.documentos_tributarios FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id
                        AND v.vendedor_id = auth.uid()));

-- gastos: el vendedor registra y ve solo los suyos (HU-07)
CREATE POLICY gastos_vendedor_select ON public.gastos_extras FOR SELECT
    USING (vendedor_id = auth.uid() OR public.es_admin());
CREATE POLICY gastos_vendedor_insert ON public.gastos_extras FOR INSERT
    WITH CHECK (vendedor_id = auth.uid() AND public.rol_actual() = 'vendedor');
CREATE POLICY gastos_admin_update ON public.gastos_extras FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

-- stock y carga: lectura por rol; escritura SOLO vía triggers (SECURITY DEFINER)
CREATE POLICY stock_select ON public.stock_bodega FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'produccion', 'administrador'));
CREATE POLICY carga_vendedor_select ON public.carga_vendedor FOR SELECT
    USING (vendedor_id = auth.uid() OR public.rol_actual() IN ('bodega', 'administrador'));
CREATE POLICY envases_select ON public.inventario_envases FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'produccion', 'administrador'));
CREATE POLICY bandejas_select ON public.inventario_bandejas FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'administrador'));

-- despachos: bodega registra; el vendedor ve los suyos (HU-03/25/26)
CREATE POLICY despachos_bodega_select ON public.despachos FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'administrador') OR vendedor_id = auth.uid());
CREATE POLICY despachos_bodega_insert ON public.despachos FOR INSERT
    WITH CHECK (despachador_id = auth.uid() AND public.rol_actual() = 'bodega');
CREATE POLICY despachos_admin_update ON public.despachos FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY despacho_detalles_select ON public.despacho_detalles FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.despachos d WHERE d.id = despacho_id
                   AND (d.vendedor_id = auth.uid() OR public.rol_actual() IN ('bodega', 'administrador'))));
CREATE POLICY despacho_detalles_insert ON public.despacho_detalles FOR INSERT
    WITH CHECK (public.rol_actual() = 'bodega');
-- Sin política de UPDATE/DELETE: los detalles no se editan ni se restan (HU-26).

-- devoluciones y mermas: registra bodega; ve el vendedor dueño del despacho (HU-27/28/29)
CREATE POLICY dev_productos_select ON public.devoluciones_productos FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.despachos d WHERE d.id = despacho_id
                   AND (d.vendedor_id = auth.uid() OR public.rol_actual() IN ('bodega', 'administrador'))));
CREATE POLICY dev_productos_insert ON public.devoluciones_productos FOR INSERT
    WITH CHECK (public.rol_actual() = 'bodega');

CREATE POLICY dev_envases_select ON public.devoluciones_envases FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.despachos d WHERE d.id = despacho_id
                   AND (d.vendedor_id = auth.uid() OR public.rol_actual() IN ('bodega', 'administrador'))));
CREATE POLICY dev_envases_insert ON public.devoluciones_envases FOR INSERT
    WITH CHECK (public.rol_actual() = 'bodega');

CREATE POLICY retorno_bandejas_select ON public.retorno_bandejas FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'administrador'));
CREATE POLICY retorno_bandejas_insert ON public.retorno_bandejas FOR INSERT
    WITH CHECK (public.rol_actual() = 'bodega');

CREATE POLICY mermas_select ON public.mermas FOR SELECT
    USING (public.rol_actual() IN ('bodega', 'administrador'));
CREATE POLICY mermas_insert ON public.mermas FOR INSERT
    WITH CHECK (public.rol_actual() = 'bodega');
CREATE POLICY mermas_admin_update ON public.mermas FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

-- producción e incidencias: registra producción (HU-20/23)
CREATE POLICY produccion_select ON public.produccion FOR SELECT
    USING (public.rol_actual() IN ('produccion', 'administrador'));
CREATE POLICY produccion_insert ON public.produccion FOR INSERT
    WITH CHECK (public.rol_actual() = 'produccion');
CREATE POLICY produccion_admin_update ON public.produccion FOR UPDATE
    USING (public.es_admin()) WITH CHECK (public.es_admin());

CREATE POLICY incidencias_select ON public.incidencias_produccion FOR SELECT
    USING (public.rol_actual() IN ('produccion', 'administrador'));
CREATE POLICY incidencias_insert ON public.incidencias_produccion FOR INSERT
    WITH CHECK (public.rol_actual() = 'produccion');

-- ubicaciones GPS: el vendedor reporta la suya; solo admin consulta (HU-16)
CREATE POLICY ubicaciones_insert ON public.ubicaciones_vendedores FOR INSERT
    WITH CHECK (vendedor_id = auth.uid() AND public.rol_actual() = 'vendedor');
CREATE POLICY ubicaciones_admin_select ON public.ubicaciones_vendedores FOR SELECT
    USING (public.es_admin());

-- audit_log: solo lectura para admin (HU-13); inmutable para todos
CREATE POLICY audit_admin_select ON public.audit_log FOR SELECT
    USING (public.es_admin());

-- ============================================================================
-- 12. STORAGE — comprobantes de gastos (HU-07)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY comprobantes_upload ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');
CREATE POLICY comprobantes_read ON storage.objects FOR SELECT
    USING (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');

-- ============================================================================
-- 13. DATOS SEMILLA (ajustables por el administrador desde la app)
-- ============================================================================

INSERT INTO public.sucursales (nombre, comuna, region)
VALUES ('Planta Ondina', NULL, NULL);

INSERT INTO public.parametros_configuracion (clave, valor, descripcion) VALUES
    ('ventana_ajuste_minutos', '15',  'Minutos para sumar productos a un despacho ya registrado (RNF-15: 10–20)'),
    ('dias_inactividad_cliente', '7', 'Días sin compras para alertar cliente inactivo (HU-12)');

INSERT INTO public.tipos_empaque (nombre, categoria, capacidad_unidades) VALUES
    ('Bidón Policarbonato', 'retornable', 1),
    ('Bidón Plástico/PET',  'retornable', 1),
    ('Bidón 10L',           'retornable', 1),
    ('Bolsa de Hielo',      'no_retornable', 1),
    ('Bandeja/Caja',        'retornable', 1);

-- Catálogo inicial según planilla física (precios referenciales; los edita el admin)
-- INSERT INTO public.productos (nombre, tipo, tipo_empaque_id, precio_base) VALUES
--     ('Bidón Policarbonato 20L', 'agua',  (SELECT id FROM tipos_empaque WHERE nombre = 'Bidón Policarbonato'), 1000),
--     ('Bidón Plástico/PET 20L',  'agua',  (SELECT id FROM tipos_empaque WHERE nombre = 'Bidón Plástico/PET'), 1000),
--     ('Bidón 10L',               'agua',  (SELECT id FROM tipos_empaque WHERE nombre = 'Bidón 10L'), 1000),
--     ('Hielo Frape',             'hielo', (SELECT id FROM tipos_empaque WHERE nombre = 'Bolsa de Hielo'), 500),
--     ('Hielo Cubo',              'hielo', (SELECT id FROM tipos_empaque WHERE nombre = 'Bolsa de Hielo'), 500),
--     ('Hielo Saco',              'hielo', (SELECT id FROM tipos_empaque WHERE nombre = 'Bolsa de Hielo'), 400);

COMMIT;
