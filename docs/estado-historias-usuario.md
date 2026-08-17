# Estado de Historias de Usuario

Documento el estado de implementación de cada HU al 2026-08-17, tras la restauración de archivos perdidos en merges y corrección de bugs en el módulo de ventas.

---

## Módulo de Ventas (Vendedor)

| HU | Nombre | Estado | Frontend | BD | Tests | Notas |
|:---|:-------|:------|:---------|:---|:------|:------|
| HU-01 | Registrar venta | ✅ Completo | RegistrarVenta.tsx | RPC `registrar_venta` | api.test.ts, RegistrarVenta.test.tsx | 3 filas preseleccionadas (POL/PET/CUBO), sessionStorage, productos duplicados deshabilitados dinámicamente, columna Disponible se actualiza al seleccionar, cantidad 0 permitida en validación (filtrada en onSubmit), sidebar sin dual-highlight en /ventas/registrar |
| HU-02 | Registrar cliente | ✅ Completo | RegistrarCliente.tsx | RLS + `clientes` | — | Admin selecciona vendedor asignado |
| HU-03 | Consultar carga | ✅ Completo | Carga.tsx | `carga_vendedor` | Carga.test.tsx | Solo lectura; la asigna bodega. Filtra cantidad=0. Nombres reales via alias `producto:productos()` |
| HU-04 | Consultar clientes ruta | ✅ Completo | Clientes.tsx | RLS por `vendedor_id` | Clientes.test.tsx | Solo ve su cartera |
| HU-05 | Bidones vacíos | ⛔ Eliminada del frontend | — | Vista `v_bidones_vacios_vendedor` | — | La vista queda en BD para bodega/HU-28 |
| HU-06 | Boleta/factura | ⛔ Fuera de scope | — | `tipo_documento`, `folio_documento` en `ventas` | — | Pendiente para sprint futuro |
| HU-07 | Registrar gasto extra | ✅ Parcial | Gastos.tsx | `gastos_extras` | — | Sin Storage upload (comprobante foto fuera de scope) |
| HU-08 | Ranking vendedores | ✅ Completo | RankingVendedores.tsx | Vista `v_ranking_vendedores` | — | MonthPickerInput (Mantine), `count(distinct)` |
| HU-09 | Mi comisión | ✅ Completo | MiComision.tsx | Vista `v_comision_vendedor` + `obtenerCantidadVentasJornada` | — | Jornada en zona America/Santiago. Total ventas real via count de ventas del día (fix Laoch-11 commit 027cc22) |

**Tests del módulo:** 5 archivos, 20 tests (api, schemas, Carga, Clientes, RegistrarVenta).

---

## Módulo de Bodega / Despacho (Bodega)

| HU | Nombre | Estado | Frontend | BD | Tests | Notas |
|:---|:-------|:------|:---------|:---|:------|:------|
| HU-13 | Modificar registros con trazabilidad | ✅ Parcial | Devoluciones.tsx (admin corrige) | Triggers auditoría en `auditoria` | — | Anulación reversiona movimientos |
| HU-24 | Consultar stock | ✅ Completo | Stock.tsx | `stock_bodega`, `stock_envases` | Stock.test.tsx | Tabs Productos/Envases |
| HU-25 | Registrar despacho | ✅ Completo | Despachos.tsx | RPC `crear_despacho` | Despachos.test.tsx | Descuenta stock automáticamente |
| HU-26 | Ventana de ajuste | ✅ BD completo | — | Trigger con `ventana_ajuste_minutos` | — | Frontend no expone UI específica; ajuste vía API |
| HU-27 | Devolución productos | ✅ Completo | Devoluciones.tsx | RPC `registrar_devolucion_productos` | Devoluciones.test.tsx | Reingresa al stock de bodega |
| HU-28 | Devolución envases | ✅ Completo | Devoluciones.tsx | RPC `registrar_devolucion_envases` | Devoluciones.test.tsx | Suma a stock_envases |
| HU-29 | Registrar mermas | ⚠️ Sin UI | — | Triggers en BD | — | BD soporta mermas; frontend no tiene página específica |

**Tests del módulo:** 5 archivos, 29 tests (Despachos, Devoluciones, Stock).

---

## Módulo de Producción (Producción)

| HU | Nombre | Estado | Frontend | BD | Tests | Notas |
|:---|:-------|:------|:---------|:---|:------|:------|
| HU-19 | Envases vacíos disponibles | ✅ Completo | Produccion.tsx (sección envases) | `stock_envases` | Produccion.test.tsx | Realtime via Supabase channels |
| HU-20 | Registrar producción | ✅ Completo | Produccion.tsx (sección registrar) | RPC `registrar_produccion` | Produccion.test.tsx, validacion.test.ts | Valida con `validacion.ts`, suma stock |
| HU-21 | Historial de producción | ✅ Completo | HistorialProduccion.tsx | `producciones` | HistorialProduccion.test.tsx | Componente separado, filtros por fecha/producto |
| HU-22 | Indicadores de producción | ✅ Completo | IndicadoresProduccion.tsx | `calculos.ts` | calculos.test.ts | Métricas calculadas en frontend |
| HU-23 | Registrar incidencias | ✅ Completo | Produccion.tsx (sección incidencias) | `incidencias_produccion` | Produccion.test.tsx | Fecha, hora y responsable |

**Tests del módulo:** 4 archivos, 34 tests (Produccion, HistorialProduccion, calculos, validacion).

---

## Módulo de Administración (Administrador)

| HU | Nombre | Estado | Frontend | BD | Tests | Notas |
|:---|:-------|:------|:---------|:---|:------|:------|
| HU-10 | Gestionar usuarios | ❌ Placeholder | Administracion.tsx ("En construcción") | `perfiles` | — | Etapa 3 (semanas 11-13) |
| HU-11 | Historial del cliente | ❌ No implementado | — | Vista `v_historial_cliente` | — | BD lista, sin frontend |
| HU-12 | Alertas clientes inactivos | ❌ No implementado | — | Vista `v_clientes_inactivos` | — | BD lista, sin frontend |
| HU-13 | Modificar registros (admin) | ✅ Parcial | Devoluciones.tsx | `auditoria` | — | Admin puede corregir devoluciones |
| HU-14 | Reportes de ventas | ❌ Placeholder | Reportes.tsx ("En construcción") | Vistas SQL | — | Etapa 3 |
| HU-15 | Configurar comisiones | ❌ No implementado UI | — | `reglas_comision` | — | BD lista, sin frontend |
| HU-16 | Monitoreo GPS | ❌ Placeholder | Ubicaciones.tsx ("En construcción") | `ubicaciones_vendedores` | — | Etapa 3 |
| HU-17 | Catálogo de productos | ❌ No implementado UI | — | `productos` | — | BD permite gestionar, sin frontend |

**Tests del módulo:** 0 (deuda técnica).

---

## Historia técnica

| HU | Nombre | Estado | Frontend | BD | Tests | Notas |
|:---|:-------|:------|:---------|:---|:------|:------|
| HU-31 | Login con credenciales y rol | ✅ Completo | Login.tsx | Supabase Auth + RLS | — | Roles respetan nav visible, redirecciones correctas |

---

## Historias eliminadas del alcance

- **HU-18** (Cerrar jornada) — eliminada por decisión del equipo el 2026-08-01.
- **HU-30** (Registrar operaciones sin conexión) — eliminada por decisión del equipo.

---

## Resumen

| Módulo | Total HU | Completas | Parciales | Placeholders | Sin UI | Eliminadas |
|:-------|:---------|:----------|:---------|:------------|:------|:-----------|
| Ventas | 9 | 6 | 1 | 0 | 0 | 2 |
| Bodega | 6 | 4 | 1 | 0 | 1 | 0 |
| Producción | 5 | 5 | 0 | 0 | 0 | 0 |
| Administración | 8 | 0 | 1 | 4 | 3 | 0 |
| Transversal | 1 | 1 | 0 | 0 | 0 | 0 |
| **Total** | **29** | **16** | **3** | **4** | **4** | **2** |

**Tests:** 83 (ventas 20, bodega 29, producción 34). Verificación: `npm run test` en `frontend/`.

**Verificación Playwright (2026-08-17):**
- Vendedor (vendedor@ondina.cl): 7 páginas verificadas, 0 errores de consola.
- Sidebar sin dual-highlight en /ventas/registrar (fix NavLink `end` dinámico).
- RegistrarVenta: productos duplicados deshabilitados dinámicamente, columna Disponible se actualiza al seleccionar, cantidad 0 no bloquea el formulario.
- Carga: nombres reales via alias `producto:productos()`, filtra cantidad=0.
- Bodega (despacho@ondina.cl): 3 páginas verificadas (Despachos, Devoluciones, Stock), 0 errores.
- Admin (admin@ondina.cl): 19 rutas visibles, administración y producción muestran "En construcción" o "Cargando...", 0 errores.
- Producción: sin usuario de producción en BD; verificación por código (api.ts, validacion.ts, componentes).

**Verificación técnica:**
- `npm run lint` ✅ 0 errores
- `npm run build` ✅ Build exitoso
- `npm run test` ✅ 83/83 tests pasan
- Migraciones SQL: 8 archivos (0001-0008), sintaxis válida