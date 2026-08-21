# Plan: Mejoras del Módulo de Ventas

**Fecha:** 2026-08-21  
**Rama base:** `develop` (commit `f2413d0`)  
**Módulo:** Ventas (`frontend/src/domains/ventas/`)  
**Estado:** Pendiente de aprobación

---

## 1. Objetivo

Aplicar mejoras acordadas en reunión de equipo al módulo de ventas: estandarizar mensajes de validación y errores, unificar el sistema de Toast, agregar validaciones faltantes, limitar productos por venta, y hacer todas las vistas responsive para móvil y tablet.

---

## 2. Consenso de Diseño: Mensajes y Errores

### 2.1 Clases utilitarias compartidas

Agregar a `frontend/src/lib/ui.ts` las siguientes constantes para que **todos los módulos** las reutilicen:

```ts
// Texto rojo bajo un input con error de validación
export const errorTextCls = 'mt-1 block text-xs text-red-600'

// Bloque de error de mutación (query/mutation fallida)
export const errorBlockCls = 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600'

// Borde rojo para inputs con error
export const inputErrorCls = 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
```

**Razón:** Actualmente `mt-1 block text-xs text-red-600` se repite ~12 veces y `rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600` ~6 veces. Centralizar evita drift y facilita cambiar el estilo global.

### 2.2 Sistema de Toast unificado

**Estado actual:** Solo `RegistrarVenta.tsx` usa Toast. Gastos muestra éxito como `<p>` inline verde. RegistrarCliente no muestra éxito (solo cierra el modal).

**Cambios:**
- `Gastos.tsx`: importar `useToast` + `Toast`. Mostrar Toast verde "Gasto registrado" en `onSuccess`. Mostrar Toast rojo en `onError`.
- `RegistrarCliente.tsx`: importar `useToast` + `Toast`. Mostrar Toast verde "Cliente registrado" en `onSuccess` antes de `onClose()`. Mostrar Toast rojo en `onError`.
- `RegistrarVenta.tsx`: ya usa Toast, sin cambios.

**Ubicación del Toast:** `fixed right-4 top-20 z-50` (ya definido en `Toast.tsx`). En móvil se ajusta a `right-2 left-2 top-20` para ocupar el ancho completo.

### 2.3 Reglas de display de errores

| Tipo de error | Dónde se muestra | Cómo se muestra |
|:---|:---|:---|
| Campo requerido faltante | Debajo del input | `<span class={errorTextCls}>` texto rojo |
| Validación de negocio (carga, etc.) | Toast flotante | Toast rojo con mensaje |
| Error de mutación (Supabase) | Toast flotante | Toast rojo con mensaje traducido |
| Éxito de mutación | Toast flotante | Toast verde con confirmación |

---

## 3. Consenso de Comentarios de Código

### 3.1 Reglas

1. **Comentar el porqué, no el qué:** el código dice qué hace; el comentario dice por qué lo hace o qué regla de negocio cumple.
2. **Comentarios inline con `//`** en español, máximo 2 líneas, encima del código que explican.
3. **JSDoc/TSDoc** solo en funciones exportadas de servicios (`api.ts`), hooks, y utilidades que otros módulos consumen — con `@param`, `@returns`, y referencia a HU cuando aplique.
4. **No comentar lo obvio:** `// suma 1 a i` es ruido. `// HU-01: filtrar cantidad>0 porque el schema permite 0` es útil.
5. **Marcar HU relacionada** en la primera línea del comentario cuando el código implementa una historia de usuario.
6. **No dejar código comentado** ni `console.log` en producción.

### 3.2 Ejemplos

```ts
// HU-01: el schema permite cantidad 0 para no bloquear filas vacías;
// onSubmit filtra solo las que tienen cantidad > 0
const limpio = values.detalles.filter((d) => d.productoId && d.cantidad > 0)

// HU-03: alias producto:productos() para que Supabase devuelva el join
// bajo la key "producto" (singular) y coincida con el tipo CargaVendedor
producto:productos(id, nombre, tipo, precio_base)
```

### 3.3 Dónde documentar

- `README.md` → sección "Convenciones de Código" → agregar subsección "Comentarios"
- `AGENTS.md` → sección "Frontend" → agregar regla de comentarios
- `docs/convenciones-frontend.md` → **nuevo archivo** con reglas detalladas y ejemplos

---

## 4. Mejoras por Página

### 4.1 RegistrarVenta.tsx (HU-01)

**Validaciones faltantes:**

| Cambio | Detalle |
|:---|:---|
| Validar "Selecciona..." en producto | Si una fila tiene `productoId === ''`, mostrar `errorTextCls` "Selecciona un producto" debajo del select. Zod ya valida `.min(1)` pero el mensaje no aparece porque las filas precargadas tienen productos asignados. Para filas nuevas (botón "Agregar producto"), el productoId es `''` y el error debe mostrarse al intentar submit. |
| Máximo 6 productos | El botón "Agregar producto" se deshabilita cuando `fields.length >= 6`. Mostrar texto "Máximo 6 productos por venta" cuando se alcance el límite. |
| Validar cantidad > 0 en al menos una fila | Actualmente `onSubmit` retorna si `limpio.detalles.length === 0` silenciosamente. Mostrar Toast rojo "Agrega al menos un producto con cantidad mayor a 0". |

**Responsividad:**

| Elemento | Desktop (≥640px) | Móvil (<640px) |
|:---|:---|:---|
| Tabla de productos | Tabla con columnas: Producto, Disponible, Cantidad, Precio, Subtotal, Quitar | Tarjetas apiladas, una por producto. Cada tarjeta tiene: nombre (select), disponible + cantidad en fila, precio + subtotal en fila, botón Quitar |
| Sección Pago | `grid sm:grid-cols-3` | `grid grid-cols-1` (ya implementado) |
| Sección Resumen | `flex justify-between` | `flex flex-col gap-4` |
| Header | `flex flex-wrap justify-between` | `flex flex-col gap-3` |

**Implementación tabla → tarjetas:**
Usar Tailwind `hidden sm:table` para la tabla y `sm:hidden` para las tarjetas. Misma data, dos representaciones.

### 4.2 RegistrarCliente.tsx (HU-02)

**Validaciones:**
- Ya muestra errores de campo con `errorTextCls` (actualmente inline). Cambiar a usar la constante compartida.
- Agregar Toast verde "Cliente registrado" en `onSuccess`.

**Responsividad:**
- El modal ya tiene `max-w-lg` y `overflow-y-auto`. Agregar `mx-4` en móvil para margen lateral.
- El grid `sm:grid-cols-2` para Teléfono/Nº de local ya está bien.
- Botones: `flex justify-end gap-3` → agregar `flex-wrap` para móvil.

### 4.3 Gastos.tsx (HU-07)

**Validaciones:**
- Ya muestra errores de campo con `text-xs text-red-600` inline. Cambiar a `errorTextCls`.
- El campo `monto` tiene `defaultValues: { monto: undefined }` — si el usuario no ingresa nada, Zod muestra "Ingresa un monto". Verificar que el mensaje llegue.
- Agregar Toast verde "Gasto registrado" en `onSuccess` y Toast rojo en `onError`.

**Responsividad:**
- Formulario: `grid sm:grid-cols-3` → en móvil `grid grid-cols-1` (ya implementado).
- Lista de gastos: `flex flex-wrap items-center justify-between` → agregar `gap-3` (ya tiene `gap-2`).
- Botón "Registrar gasto": `flex justify-end` → agregar `flex-wrap` para que no se desborde.

### 4.4 Carga.tsx (HU-03)

**Responsividad:**
- Grid de tarjetas: `grid sm:grid-cols-2 lg:grid-cols-3` (ya implementado).
- Verificar que las tarjetas no se desborden en móvil chico (320px).

### 4.5 Clientes.tsx (HU-04)

**Responsividad:**
- Tabla de clientes: agregar `overflow-x-auto` si no lo tiene.
- En móvil (<640px), convertir a tarjetas al igual que RegistrarVenta.

### 4. Ventas.tsx (Resumen)

**Responsividad:**
- Grid de accesos rápidos: `grid sm:grid-cols-2 lg:grid-cols-4` (ya implementado).
- Lista de carga: `ul` con `flex justify-between` → agregar `flex-wrap` y `gap-2`.
- Botones finales: `flex flex-wrap gap-3` (ya implementado).

### 4.7 MiComision.tsx (HU-09)

**Responsividad:**
- Grid de tarjetas: `grid sm:grid-cols-3` → en móvil `grid grid-cols-1` (cambiar de `sm:grid-cols-3` a `grid grid-cols-1 sm:grid-cols-3`).
- Tarjetas de comisión por tipo: `grid grid-cols-2 gap-3` → `grid grid-cols-1 sm:grid-cols-2 gap-3`.

### 4.8 RankingVendedores.tsx (HU-08)

**Responsividad:**
- MonthPickerInput: verificar que no se desborde en móvil.
- Tabla de ranking: agregar `overflow-x-auto`.
- En móvil (<640px), convertir a tarjetas.

---

## 5. Toast Responsive

Modificar `Toast.tsx` para que en móvil ocupe el ancho completo:

```tsx
// Actual: fixed right-4 top-20 z-50
// Nuevo:  fixed right-2 left-2 top-20 z-50 sm:right-4 sm:left-auto
```

---

## 6. Archivos a Modificar

| Archivo | Cambios |
|:---|:---|
| `frontend/src/lib/ui.ts` | Agregar `errorTextCls`, `errorBlockCls`, `inputErrorCls` |
| `frontend/src/components/Toast.tsx` | Responsive: `left-2 right-2 sm:left-auto sm:right-4` |
| `frontend/src/domains/ventas/pages/RegistrarVenta.tsx` | Max 6 productos, validar producto vacío, Toast en silencio, tabla→tarjetas responsive, usar `errorTextCls` |
| `frontend/src/domains/ventas/pages/RegistrarCliente.tsx` | Toast en éxito/error, usar `errorTextCls`, responsive modal |
| `frontend/src/domains/ventas/pages/Gastos.tsx` | Toast en éxito/error, usar `errorTextCls`, responsive |
| `frontend/src/domains/ventas/pages/Carga.tsx` | Verificar responsive |
| `frontend/src/domains/ventas/pages/Clientes.tsx` | Tabla→tarjetas responsive, `overflow-x-auto` |
| `frontend/src/domains/ventas/pages/MiComision.tsx` | Responsive grid |
| `frontend/src/domains/ventas/pages/RankingVendedores.tsx` | Tabla→tarjetas responsive, `overflow-x-auto` |
| `frontend/src/domains/ventas/pages/Ventas.tsx` | Responsive ajustes menores |
| `docs/convenciones-frontend.md` | **Nuevo:** reglas de mensajes, errores, comentarios |
| `README.md` | Actualizar convenciones de código |
| `AGENTS.md` | Actualizar sección frontend |

---

## 7. Tests

### 7.1 Tests unitarios (Vitest + Testing Library)

| Archivo | Tests a agregar |
|:---|:---|
| `schemas.test.ts` | Validar que `registrarVentaSchema` rechaza más de 6 detalles |
| `RegistrarVenta.test.tsx` | (1) Botón "Agregar producto" se deshabilita con 6 filas. (2) Toast rojo al submit con 0 productos válidos. (3) Tabla se oculta en viewport móvil (test con CSS mock o className check). |
| `Gastos.test.tsx` | **Nuevo archivo:** (1) Muestra error si monto está vacío. (2) Muestra error si motivo está vacío. (3) Toast verde en éxito. |
| `RegistrarCliente.test.tsx` | **Nuevo archivo:** (1) Muestra error si nombre vacío. (2) Muestra error si dirección vacía. (3) Toast verde en éxito. |

### 7.2 Verificación con Playwright MCP

| Flujo | Pasos | Verificaciones |
|:---|:---|:---|
| Login vendedor | Navegar a `/login`, ingresar credenciales | Sin errores de consola |
| Registrar venta - validaciones | Navegar a `/ventas/registrar`, click "Confirmar venta" sin seleccionar cliente | Toast rojo o texto rojo bajo select de cliente |
| Registrar venta - max productos | Click "Agregar producto" 6 veces | Botón se deshabilita, texto "Máximo 6 productos" visible |
| Registrar venta - producto vacío | Agregar fila nueva, no seleccionar producto, intentar submit | Texto rojo "Selecciona un producto" bajo el select |
| Registrar venta - éxito | Llenar cliente, producto, cantidad, submit | Toast verde con folio, navegación a /ventas |
| Registrar cliente | Abrir modal, llenar datos, submit | Toast verde "Cliente registrado" |
| Gastos - validación | Navegar a `/gastos`, submit sin monto | Texto rojo bajo input de monto |
| Gastos - éxito | Llenar monto y motivo, submit | Toast verde "Gasto registrado" |
| Responsive móvil | Resize a 375px, navegar todas las páginas | Sin scroll horizontal, tarjetas visibles, tabla oculta |
| Responsive tablet | Resize a 768px, navegar todas las páginas | Layout correcto |
| Consola | Revisar en cada página | 0 errores de consola |

---

## 8. Orden de Ejecución

1. **Fase 1 — Consenso base:** `ui.ts` (clases compartidas) + `Toast.tsx` (responsive) + `docs/convenciones-frontend.md`
2. **Fase 2 — RegistrarVenta:** max 6 productos, validar producto vacío, Toast silencioso, tabla→tarjetas, usar `errorTextCls`
3. **Fase 3 — Gastos:** Toast, `errorTextCls`, responsive
4. **Fase 4 — RegistrarCliente:** Toast, `errorTextCls`, responsive modal
5. **Fase 5 — Páginas restantes:** Carga, Clientes, MiComision, RankingVendedores, Ventas (responsive)
6. **Fase 6 — Tests:** nuevos archivos + tests adicionales
7. **Fase 7 — Documentación:** README.md, AGENTS.md, beads, mem0
8. **Fase 8 — Verificación:** lint + build + test + Playwright
9. **Fase 9 — Commit + push develop + merge main**

---

## 9. Definición de Hecho

- [ ] `ui.ts` exporta `errorTextCls`, `errorBlockCls`, `inputErrorCls`
- [ ] Todas las páginas de ventas usan las clases compartidas (sin strings inline repetidos)
- [ ] Toast verde en éxito y rojo en error en RegistrarVenta, Gastos, RegistrarCliente
- [ ] Toast responsive en móvil (ancho completo)
- [ ] RegistrarVenta: máximo 6 productos, botón se deshabilita
- [ ] RegistrarVenta: producto vacío muestra error de validación
- [ ] RegistrarVenta: submit sin productos válidos muestra Toast rojo
- [ ] RegistrarVenta: tabla → tarjetas en móvil (<640px)
- [ ] Todas las páginas responsive en 375px y 768px
- [ ] `docs/convenciones-frontend.md` creado con reglas de mensajes, errores y comentarios
- [ ] `README.md` y `AGENTS.md` actualizados
- [ ] Tests nuevos pasando (Gastos, RegistrarCliente, RegistrarVenta adicionales)
- [ ] `npm run lint` sin errores
- [ ] `npm run build` sin errores
- [ ] `npm run test` todos pasan
- [ ] Playwright: 0 errores de consola en todas las páginas
- [ ] Commit + push a develop + merge a main
