# F1 — InputNumerico compartido y adopción en Ventas

Fecha de verificación: 2026-10-14, America/Santiago. Beads: OND-c07.16.
Rama: `Cristhian-S1/fux-f1-numerico`.
Base: `origin/feature/frontend-ux`, `34fbf874bf9618b108e88b88145a9bc5df6b1553`.

## Resultado y alcance

Se implementó `frontend/src/components/InputNumerico.tsx` y se adoptó en todos los campos de magnitudes numéricas editables de Ventas: cantidad, precio unitario, descuento y monto de gastos. Teléfono y número de local siguen siendo identificadores de texto; los selectores de mes/año conservan su semántica de selección. El máximo de filas por venta se calcula con el catálogo activo que entrega `obtenerProductosVenta()` (el servicio ya filtra `activo = true`), sin depender del antiguo límite de seis ni de cuántos productos tienen carga.

La cantidad conserva el error inmediato `Excede tu carga`, con `aria-invalid` y `aria-describedby`, y la validación de carga previa al envío. La disponibilidad no se pasa como `max`: eso recortaría silenciosamente el valor e impediría mostrar el error que el usuario pidió conservar. Precio, descuento y monto de gastos usan `conFlechas={false}`: ajustar montos peso a peso no aporta una interacción útil y evita controles adicionales; la escritura y el formato son los mismos.

`Agregar producto` se deshabilita al alcanzar el número de productos activos y enlaza el motivo visible mediante `aria-describedby`. También explica carga, error o catálogo vacío. Se retiró el límite de seis del parser de borradores: un borrador de diez filas puede restaurarse con un catálogo de diez productos. Al cargar un catálogo de menos de tres productos se retiran sólo filas iniciales vacías sobrantes; las filas con datos se conservan y el envío comprueba el límite vigente.

No se modificaron otros dominios, helpers compartidos, permisos, rutas, esquemas, migraciones, CSP, dependencias ni presupuestos. `frontend/.env.local` está ignorado y sólo contiene URL/anon de Supabase local. No se crearon ni cerraron issues de Beads.

## API compartida

Importación: `import InputNumerico from '@/components/InputNumerico'`.
También se exporta el tipo `InputNumericoProps`. El contrato está documentado mediante JSDoc en el componente.

| Propiedad | Tipo / valor por defecto | Comportamiento |
| --- | --- | --- |
| `value` | `number \| string \| null \| undefined` | Valor controlado; admite cadenas con puntos. Cero y vacío muestran el placeholder. |
| `onChange` | `(value: number \| undefined) => void` | Entrega un entero sin formato; al vaciar entrega `undefined`. |
| `min` | `number`, `0` | Límite inferior de escritura, pegado y pasos. |
| `max` | `number`, `Number.MAX_SAFE_INTEGER` | Límite superior de escritura, pegado y pasos. |
| `conFlechas` | `boolean`, `true` | Muestra botones `Aumentar` y `Disminuir`, de 44×44 px. |
| `error` | `string`, opcional | Mensaje debajo; añade estilo de error y asociación ARIA. |
| `ref` | `Ref<HTMLInputElement>` | Expone el input nativo para foco de RHF. |
| Atributos nativos | `id`, `name`, `onBlur`, `disabled`, `readOnly`, `className`, `placeholder`, `aria-*`, etc. | Se conservan; `aria-describedby` externo se combina con el error propio. |

El input usa `type="text"`, `inputMode="numeric"` y placeholder `0`; reutiliza `formatMiles` y `parseMiles`. No admite negativos ni decimales. Se normalizan los límites a enteros no negativos dentro del rango seguro; un `max` menor que `min` se eleva a `min`. Los valores introducidos se recortan a los límites, mientras que vacío sigue siendo `undefined` para que el formulario decida si es obligatorio.

Las letras, signos y separadores se rechazan por teclado. El pegado conserva únicamente dígitos: `1.2a3` produce `123`, y un pegado sin dígitos conserva el valor anterior. Los atajos de copiar, pegar, seleccionar y deshacer permanecen disponibles. `ArrowUp`/`ArrowDown` ajustan ±1 incluso con las flechas ocultas. `disabled` y `readOnly` bloquean ajustes y deshabilitan los botones. Los valores de cero se ven mediante el placeholder `0`, conforme al comportamiento anterior de las cantidades.

Se restaura el cursor según las cifras a su izquierda cuando se insertan puntos, y Backspace/Delete junto a un separador eliminan una cifra sin quedar atascados en el punto. El componente no depende de React Hook Form y no tiene dependencias nuevas.

### Estado controlado

```tsx
const [cantidad, setCantidad] = useState<number | undefined>()

<label htmlFor="cantidad">Cantidad</label>
<InputNumerico
  id="cantidad"
  value={cantidad}
  onChange={setCantidad}
  min={0}
  max={1000}
  error={errorCantidad}
/>
```

### Controller / useController

```tsx
<Controller
  control={control}
  name="cantidad"
  render={({ field, fieldState }) => (
    <InputNumerico
      {...field}
      aria-label="Cantidad"
      value={Number(field.value) || 0}
      onChange={numero => field.onChange(numero ?? 0)}
      error={fieldState.error?.message}
    />
  )}
/>
```

Cuando el dominio necesita preservar vacío como `undefined` —por ejemplo, Gastos— se entrega directamente `field.onChange`. Si se usa `CampoFormulario`, éste ya renderiza y enlaza el error: se pasan sus atributos a `InputNumerico` sin duplicar el mensaje en la prop `error`. Las páginas mantienen los tipos `z.input`/`z.output` de sus formularios.

## Pruebas y cuatro verificaciones

TDD: se ejecutaron primero las pruebas nuevas contra la base. Fallaron por componente ausente, flechas ausentes, aceptación de letras, límite fijo de seis, catálogo pequeño y borrador de diez filas; se corrigieron selectores ambiguos de las pruebas antes de comprobar la fase roja del límite dinámico. Después de la implementación se ejecutó toda la suite.

- `InputNumerico.test.tsx`: nueve casos que cubren teclado y atajos, pegado mixto y texto puro, miles/cursor, borrado junto a separadores, flechas/teclado/límites, ARIA, disabled/readOnly, flechas ocultas y Controller con foco/ref/números/vacío.
- `RegistrarVenta.test.tsx`: catálogos de 7 y 10 productos, bloqueo con descripción y habilitación al quitar una fila, catálogo de un producto, restauración de diez filas y disponibilidad inmediata al incrementar/disminuir.
- `Gastos.test.tsx`: rechazo por teclado, pegado con formato y ausencia de flechas. Se adaptó la comprobación del símbolo `$` al contenedor de moneda tras insertar el componente.

Última ejecución conjunta, desde `frontend/`, con `.env.local` de Supabase local:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin errores. |
| `npm run build` | PASS, TypeScript y Vite. |
| `npm run size` | PASS, cinco métricas OK. |
| `npm run test` | PASS, 705 pruebas en 53 archivos. |
| `git diff --check` | PASS. |

El build conserva el aviso preexistente `INEFFECTIVE_DYNAMIC_IMPORT` de `lib/dashboard.ts` (importación dinámica y estática). No es un error de compilación.

| Métrica de tamaño | Actual, bytes | Presupuesto, bytes | Estado |
| --- | ---: | ---: | --- |
| JS de entrada, gzip | 94.871 | 105.567 | OK |
| CSS de entrada, gzip | 7.354 | 47.853 | OK |
| Chunk JS mayor, sin comprimir | 298.613 | 332.108 | OK |
| JS inicial total, gzip | 151.517 | 174.765 | OK |
| CSS inicial total, gzip | 7.354 | 48.053 | OK |

## Verificación visual

Google Chrome headless con Playwright, build servido por Vite preview en `http://127.0.0.1:5184`, cuenta local `ux-vendedor@example.invalid`, conexión real a `http://127.0.0.1:54321`. No hubo interceptores ni respuestas RPC simuladas. Sólo se hicieron lecturas e interacciones de formulario; no se confirmaron ventas ni gastos.

El preview aplica la CSP de despliegue, que no permite Supabase por HTTP local. Se empleó `bypassCSP: true` únicamente en el contexto de Playwright para esta revisión local, sin editar `vercel.json` ni las cabeceras. Por tanto, esta revisión no acredita la CSP ni el despliegue.

| Vista | Viewport | `documentElement.scrollWidth` | `innerWidth` | Resultado |
| --- | ---: | ---: | ---: | --- |
| Registrar venta | 375 | 375 | 375 | PASS |
| Registrar venta | 768 | 768 | 768 | PASS |
| Registrar venta | 1280 | 1280 | 1280 | PASS |
| Gastos | 375 | 375 | 375 | PASS |
| Gastos | 768 | 768 | 768 | PASS |
| Gastos | 1280 | 1280 | 1280 | PASS |

En las tres anchuras se comprobó edición intermedia con cursor, formato `1.000.000`, rechazo de `a`, ArrowDown, botón Aumentar, error de disponibilidad asociado y seis botones de 44×44 px. En Gastos se comprobó `12.500`, rechazo de letras, reemplazo por pegado `1.2a3` → `123` y ausencia de flechas. Cero errores de consola/pageerror y cero respuestas HTTP >=400 en la ejecución visual correcta. Se ajustó el ancho mínimo de la celda Cantidad en tabla para que el millón se muestre completo a 768 px; se conserva un solo árbol de formulario y las tarjetas bajo 640 px.

Capturas revisadas, todas por debajo de 135 kB:

- [Registrar venta, 375](f1-registrar-venta-375.png)
- [Registrar venta, 768](f1-registrar-venta-768.png)
- [Registrar venta, 1280](f1-registrar-venta-1280.png)
- [Gastos, 375](f1-gastos-375.png)
- [Gastos, 768](f1-gastos-768.png)
- [Gastos, 1280](f1-gastos-1280.png)

## Commits y límites de la entrega

- `87dce27` — `feat(ui): add accessible formatted numeric input` (componente compartido y sus pruebas; aislado para los demás lotes).
- `51489d3` — `feat(ventas): use numeric input and dynamic product limit` (adopción en Ventas y pruebas).
- Este informe y las seis capturas se entregan en un tercer commit de documentación.

No se ejecutaron `npm run test:integration`, `supabase db reset` ni pruebas en producción. La revisión visual no prueba escritura de RPC/stock ni lector de pantalla, ni teclado móvil físico. No hubo push, merge ni PR; la integración y adopción por otros lotes quedan a cargo del coordinador.
