# Convenciones del Frontend

Reglas de diseño, mensajes, errores, comentarios y responsividad para todos los módulos del frontend. **Estándar aplicado y verificado en el módulo de ventas; los demás módulos deben seguir las mismas reglas.**

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
- El Toast es responsive: en móvil ocupa ancho completo (`left-2 right-2 sm:left-auto sm:right-4`).

### Tabla de comportamientos

| Tipo de error | Dónde se muestra | Cómo |
|:---|:---|:---|
| Campo requerido faltante | Debajo del input | `<span class={errorTextCls}>` |
| Validación de negocio | Toast flotante | Toast rojo |
| Error de mutación (Supabase) | Toast flotante | Toast rojo con mensaje traducido |
| Éxito de mutación | Toast flotante | Toast verde |

### Compatibilidad Zod v4 + React Hook Form

- Usar `@hookform/resolvers` v5.9.1+ con Zod v4. Versiones anteriores (v3.x) no detectan `ZodError` correctamente porque Zod v4 renombró `.errors` a `.issues`.
- En schemas con `z.coerce.number()`, separar tipos de input y output:
  - `type FormInput = z.input<typeof schema>` — para `useForm<FormInput, unknown, FormOutput>`
  - `type FormOutput = z.infer<typeof schema>` — para `onSubmit(values: FormOutput)`
- El `useForm` debe usar 3 generics: `useForm<TInput, Context, TOutput>`.

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

**Aplicable a todos los módulos.** El módulo de ventas ya cumple este estándar; los demás deben alinearse.

### Breakpoints de Tailwind (por defecto):
- `sm`: 640px (tablet horizontal / móvil grande)
- `md`: 768px (tablet vertical)
- `lg`: 1024px (desktop)

### Reglas:
- Toda página debe funcionar en **375px** (móvil chico), **768px** (tablet) y **1280px** (desktop).
- Tablas con muchas columnas se transforman en tarjetas en `<640px` usando CSS single-view: `thead` con `hidden sm:table-header-group`, filas con `block sm:table-row`, celdas con `block sm:table-cell`. Esto evita duplicar registros de RHF.
- Formularios usan `grid grid-cols-1 sm:grid-cols-N` para apilar en móvil.
- Botones usan `flex flex-wrap gap-3` para no desbordar en móvil.
- Headers de página usan `flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between`.
- Inputs en tabla responsive usan `w-full sm:w-N` (ancho completo en móvil, fijo en desktop).
- Cada celda de tabla en móvil muestra un label con `block text-xs font-medium text-slate-500 sm:hidden`.
- Verificar siempre que `document.body.scrollWidth <= document.body.clientWidth` (sin scroll horizontal).

### Implementación tabla → tarjetas (patrón):

```tsx
<table className="w-full">
  <thead className="hidden sm:table-header-group">
    {/* headers solo en desktop */}
  </thead>
  <tbody className="block gap-3 sm:table sm:table-row-group">
    {items.map((item, i) => (
      <tr key={i} className="mb-3 block rounded-xl border border-slate-200 p-4 sm:mb-0 sm:table-row sm:border-0 sm:p-0">
        <td className="mb-2 block sm:table-cell sm:mb-0">
          <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">Label</span>
          {/* contenido */}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```
