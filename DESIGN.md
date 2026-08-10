# Ondina — Sistema de Diseño del Frontend

> Referencia visual y de estilos para el frontend (`frontend/`). Toda nueva UI
> debe respetar estos colores, tipografías, espacios y componentes para mantener
> la coherencia con lo existente.

Stack de estilos: **Tailwind CSS v4** (configurado vía `@tailwindcss/vite`),
sin archivo `tailwind.config.js`. Los design tokens viven en
`frontend/src/index.css` bajo el bloque `@theme`.

---

## 1. Paleta de colores

### 1.1 Marca (azul) — `brand`

Token central del producto. Se usa en sidebar, botones primarios, enlaces activos
y bordes de foco.

| Token            | Hex       | Uso typical                                        |
| ---------------- | --------- | -------------------------------------------------- |
| `brand-50`       | `#cbebfc` | fondos tenues, badges                              |
| `brand-100`      | `#a4dbf9` | avatar, acentos suaves                             |
| `brand-200`      | `#bfdcf8` | bordes de botones secundarios (`border-brand-200`) |
| `brand-300`      | `#89c3eb` | bordes decorativos                                 |
| `brand-400`      | `#56c4ec` | iconos en hover                                    |
| `brand-500`      | `#749ccc` | _no muy usado_                                     |
| `brand-600`      | `#3284bd` | **botón primario**, nav activa, foco               |
| `brand-700`      | `#2b72a3` | hover de primario                                  |
| `brand-800`      | `#245f8a` | bordes del sidebar                                 |
| `brand-900`      | `#1c4e70` | **fondo del sidebar**                              |

### 1.2 Neutros — `slate`

Base para textos, fondos, bordes y tablas.

| Token     | Uso                                                  |
| --------- | ---------------------------------------------------- |
| `slate-100` | fondo de página (`body`), badges, encabezados de tabla |
| `slate-200` | bordes de tarjetas y dividers (`border-slate-200`)  |
| `slate-300` | bordes de inputs (`border-slate-300`), bordes dashed |
| `slate-400` | texto secundario, `tracking-wide`, iconos de toggle |
| `slate-500` | descripciones, placeholders, estados vacíos         |
| `slate-700` | labels de formulario                                 |
| `slate-900` | títulos y texto principal                           |
| `slate-950` | overlays de modal (`bg-slate-950/60`)               |

### 1.3 Semánticos por rol (Dashboard)

Cada roltiene un badge con fondo + texto:

| Rol            | Clase                                   |
| -------------- | --------------------------------------- |
| `vendedor`     | `bg-sky-100 text-sky-700`                |
| `bodega`       | `bg-amber-100 text-amber-700`           |
| `produccion`   | `bg-violet-100 text-violet-700`          |
| `administrador`| `bg-emerald-100 text-emerald-700`       |

### 1.4 Estados

- Error / alerta: `bg-red-50 text-red-600` (inline), `bg-red-600` hover `bg-red-700` (botón danger), `bg-red-500` (punto de notificación).
- Advertencia (devoluciones producto): `bg-amber-500`.
- Éxito / devoluciones envase: `bg-emerald-500`.

---

## 2. Tipografía

- Familia: la **fuente del sistema** (Tailwind por defecto, sin `@theme` de
  `--font-*`). No se carga Google Font.
- Pesas usadas: `font-medium` (labels), `font-semibold` (botones, títulos de
  sección), `font-bold` (h1).
- Tamaños: `text-xs` (badges, metadatos), `text-sm` (cuerpo general, inputs,
  botones), `text-base` (títulos de sección), `text-lg` (títulos de modal),
  `text-2xl` (h1 de página).
- Transforma a mayúsculas con `uppercase` solo en cabeceras de tabla junto a
  `tracking-wide text-slate-400`.
- Localización de números/fechas: `toLocaleString('es-CL', ...)` — ver `fmtFecha`
  en `lib/ui.ts`.

### Body

```css
body { @apply bg-slate-100 text-slate-800 antialiased; }
```

---

## 3. Espaciado, radios y sombras

- Radios: `rounded-lg` (inputs, botones, badges, pills de tabs), `rounded-2xl`
  (tarjetas, modales, avatar, logo), `rounded-full` (avatar del header, badges
  redondos, puntos de estado), `rounded-xl` (logo en sidebar).
- Padding de tarjetas/secciones: `px-5 py-4` en cabeceras, `px-5 py-8` en
  estados vacíos, `p-6` en tarjetas de Dashboard, `p-8` en Login.
- Padding de página: `main` usa `p-4 sm:p-6`.
- Sombra: `shadow-sm` (tarjetas), `shadow-lg` (Login), `shadow-xl` (modal),
  `shadow` (hover de social links).
- Borde por defecto: `border border-slate-200`.

---

## 4. Layout y navegación

### 4.1 Estructura (`DashboardLayout.tsx`)

- Contenedor raíz: `flex min-h-svh`.
- **Sidebar** fijo a la izquierda, `w-64` (`lg:w-16` colapsado), fondo `bg-brand-900`,
  texto `text-slate-300`/`text-white`, border `border-brand-800`. En móvil:
  `fixed` con overlay `bg-slate-950/60`.
- **Header** sticky `top-0 z-20 h-16 bg-white/90 backdrop-blur`, border inferior
  `border-slate-200`. Contiene botón de menú, notificaciones y avatar+nombre del
  usuario.
- **Main** `flex-1 p-4 sm:p-6` con padding lateral que se ajusta al colapso del
  sidebar (`lg:pl-64` / `lg:pl-16`).

### 4.2 Nav

- Item: `rounded-lg py-2.5 px-4 text-sm gap-3`. Activo `bg-brand-600 text-white`;
  inactivo `text-slate-300 hover:bg-brand-800 hover:text-white`.
- Icono del item: `h-5 w-5 shrink-0`.
- Las rutas se definen por `DomainModule` (ver `types/module.ts`); el header de
  nav filtra por rol del perfil.

### 4.3 Logout

Botón al pie del sidebar, `hover:bg-red-500/10 hover:text-red-400`.

---

## 5. Componentes base

Definidos como **constantes de clases** en `frontend/src/lib/ui.ts` para
reutilizar sin repetir Tailwind. Úsalos siempre que aplique.

| Constante       | Uso                                                            |
| ---------------- | -------------------------------------------------------------- |
| `labelCls`       | `block text-sm font-medium text-slate-700`                    |
| `inputCls`       | inputs/selects: borde slate-300, foco `brand-600` con ring     |
| `btnPrimary`     | fondo `brand-600`, hover `brand-700`, texto blanco             |
| `btnSecondary`   | borde `brand-200`, fondo blanco, texto `brand-800`             |
| `btnDanger`      | fondo `red-600`, hover `red-700`                               |
| `cardCls`        | `rounded-2xl border border-slate-200 bg-white shadow-sm`       |
| `thCls`          | cabecera de tabla: `text-xs uppercase tracking-wide slate-400`|
| `tdCls`          | celda: `text-sm text-slate-900`                                |
| `fmtFecha(iso)`  | fecha local `'es-CL'` (día/mes + hora)                         |

### Helper de catálogo (`lib/catalog.ts`)

`obtenerProductos`, `obtenerTiposEmpaque`, `obtenerSucursales`: queries a las
tablas maestras con `eq('activo', true)` y `order('nombre')`. Reúsalos en vez de
consultar directo.

---

## 6. Iconos

Iconos SVG propios en `frontend/src/components/icons.tsx` (stroke, `viewBox 0 0
24 24`, `strokeWidth=2`). Heredan de `IconProps = SVGProps<SVGSVGElement>`.

Disponibles: `DropletIcon`, `MenuIcon`, `BellIcon`, `HomeIcon`, `UsersIcon`,
`ShoppingCartIcon`, `DollarIcon`, `TruckIcon`, `BoxIcon`, `AlertIcon`,
`FactoryIcon`, `BarChartIcon`, `MapPinIcon`, `SettingsIcon`, `ShieldIcon`,
`LogOutIcon`.

Para nuevas necesidades, agrega un export siguiendo el mismo patrón `Svg`.

---

## 7. Patrones de UI existentes

### 7.1 Tabla (Stock, Despachos)

```tsx
<section className={cardCls}>
  <div className="border-b border-slate-100 px-5 py-4">
    <h2 className="text-base font-semibold text-slate-900">...</h2>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-100 bg-slate-50">
          <th className={thCls}>...</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">...</tbody>
    </table>
  </div>
</section>
```

### 7.2 Lista con punto de color (Despachos)

```tsx
<span className={cls.colorDot} /> // h-2 w-2 rounded-full
<p className="truncate text-sm text-slate-900">{descripcion}</p>
<span className="shrink-0 text-xs text-slate-400">{fmtFecha(fecha)}</span>
```

### 7.3 Modal

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
  <div className="max-h-full w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
    ...
  </div>
</div>
```

### 7.4 Tabs (Despachos)

```tsx
<div className="inline-flex rounded-lg bg-slate-100 p-1">
  <button className={activo ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}>
```

### 7.5 Formulario repetible (líneas de despacho)

Grid `sm:grid-cols-[minmax(0,1fr)_7rem_auto]`, botón "Quitar" y "+ Agregar".

### 7.6 Estado vacío y carga

- Carga: `<p className="text-sm text-slate-500">Cargando...</p>`.
- Vacío: `px-5 py-8 text-center text-sm text-slate-500` con mensaje en español.
- Error inline: `<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>`.

---

## 8. Convenciones

(Tomadas de `AGENTS.md` — obligatorias.)

- Componentes en **PascalCase**, hooks `useCamelCase`, utilidades `camelCase`,
  carpetas en **kebab-case**.
- **Mensajes al usuario en español.** Sin `console.log`, sin secretos en el
  repo, **sin emojis** (salvo petición explícita).
- TypeScript estricto: `noUnusedLocals`, `noUnusedParameters`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`. Importa tipos con
  **`import type`** cuando solo uses tipos.
- No agregues dependencias nuevas sin justificarlas en el PR.
- Los dominios viven en `frontend/src/domains/<dominio>/`; no saques la lógica
  de ahí. Accede a Supabase mediante el cliente de `lib/supabase.ts` y los
  servicios del dominio.
- Estados responsivos: mobile first; usa `sm:`/`lg:` para partir de 1 columna y
  abrir a tabla/grid en desktop.

---

## 9. Accesibilidad y toque

- Inputs con `<label>` visible o `sr-only` cuando el Placeholder basta.
- `aria-label` en botones de icono (cerrar, alternar menú).
- `aria-hidden="true"` en iconos decorativos.
- Botones grandes (`px-4 py-2` mínimo) para pantallas táctiles.

---

## 10. Cómo extender

1. Revisa `lib/ui.ts` y `lib/catalog.ts` antes de crear clases nuevas.
2. Si necesitas un color no listado, defínelo en `@theme` de `index.css`, no
   uses un hex arbitrario.
3. Para nuevos iconos, agrega un `export function XxxIcon(props: IconProps)` en
   `components/icons.tsx`.
4. Respeta el patrón de `DomainModule` (ver `types/module.ts`) al añadir rutas.
5. Pruebas: Vitest + Testing Library con `vi.mock('@/lib/supabase')`, mensajes
   en español, patrón Arrange-Act-Assert.