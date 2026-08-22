# Convenciones del Frontend

Reglas de diseño, mensajes, errores y comentarios para todos los módulos del frontend.

---

## Mensajes de Validación y Errores

### Clases compartidas

Usar siempre las constantes de `frontend/src/lib/ui.ts`:

| Constante | Uso | Clase CSS |
|:---|:---|:---|
| `errorTextCls` | Texto rojo bajo un input con error de campo | `mt-1 block text-xs text-red-600` |
| `errorBlockCls` | Bloque de error para mutaciones fallidas | `rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600` |
| `inputErrorCls` | Borde rojo para inputs que fallan validación | `border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30` |

No repetir strings inline de error. Si se necesita un nuevo estilo, agregarlo a `ui.ts`.

### Sistema de Toast

Usar `useToast` de `frontend/src/components/toast-utils.ts` y el componente `Toast` de `frontend/src/components/Toast.tsx`.

| Tipo | Color | Cuándo usarlo |
|:---|:---|:---|
| `exito` | Verde | Confirmación de operación exitosa (venta, gasto, cliente registrados) |
| `error` | Rojo | Error de negocio (carga insuficiente, sin productos válidos) o error de mutación |

Reglas:
- Todo formulario de escritura debe mostrar Toast en éxito y error.
- Los errores de validación de campo (campo requerido faltante) se muestran como `errorTextCls` bajo el input, no como Toast.
- El Toast se auto-cierra a los 4 segundos.

### Tabla de comportamientos

| Tipo de error | Dónde se muestra | Cómo |
|:---|:---|:---|
| Campo requerido faltante | Debajo del input | `<span class={errorTextCls}>` |
| Validación de negocio | Toast flotante | Toast rojo |
| Error de mutación (Supabase) | Toast flotante | Toast rojo con mensaje traducido |
| Éxito de mutación | Toast flotante | Toast verde |

---

## Comentarios de Código

### Reglas

1. **Comentar el porqué, no el qué.** El código dice qué hace; el comentario dice por qué.
2. **Comentarios inline con `//`** en español, máximo 2 líneas, encima del código que explican.
3. **JSDoc/TSDoc** solo en funciones exportadas de servicios (`api.ts`), hooks y utilidades que otros módulos consumen.
4. **No comentar lo obvio.** `// suma 1 a i` es ruido. `// HU-01: filtrar cantidad>0 porque el schema permite 0` es útil.
5. **Marcar HU relacionada** en la primera línea del comentario cuando aplica.
6. **No dejar código comentado** ni `console.log` en producción.

### Ejemplos

```ts
// HU-01: el schema permite cantidad 0 para no bloquear filas vacías;
// onSubmit filtra solo las que tienen cantidad > 0
const limpio = values.detalles.filter((d) => d.productoId && d.cantidad > 0)

// HU-03: alias producto:productos() para que Supabase devuelva el join
// bajo la key "producto" (singular) y coincida con el tipo CargaVendedor
producto:productos(id, nombre, tipo, precio_base)
```

---

## Responsividad

Breakpoints de Tailwind (por defecto):
- `sm`: 640px (tablet horizontal)
- `md`: 768px (tablet vertical)
- `lg`: 1024px (desktop)

Reglas:
- Toda página debe funcionar en 375px (móvil chico), 768px (tablet) y 1280px (desktop).
- Tablas con muchas columnas se convierten en tarjetas apiladas en `<640px` usando `hidden sm:table` para tabla y `sm:hidden` para tarjetas.
- Formularios usan `grid grid-cols-1 sm:grid-cols-N` para apilar en móvil.
- Botones usan `flex flex-wrap gap-3` para no desbordar en móvil.
