# Filtros en la Vista de Despachos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la vista de Despachos un filtro por día (default hoy, con chips y calendario) y por vendedor, aplicando también al aside de devoluciones.

**Architecture:** Filtrado 100% en el frontend sobre los datos ya cargados de la sucursal, dentro de `frontend/src/domains/bodega/pages/Despachos.tsx`. Se agregan helpers de fecha local, estado de filtros, un memo `despachosFiltrados` y se reutiliza para reconstruir `gruposDevolucion` (aside). Sin cambios en API, tipos, SQL ni dependencias.

**Tech Stack:** React 19, TypeScript estricto, Tailwind 4, Vite. Sin framework de pruebas (la verificación es `npm run lint` y `npm run build`).

## Global Constraints

- TypeScript estricto con `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` y `verbatimModuleSyntax`; `import type` obligatorio para imports de solo tipos. `npm run build` corre `tsc -b` y **falla con variables locales sin usar**; cada tarea debe quedar compilando por sí sola.
- Sin comentarios en el código salvo que se pidan.
- Mensajes al usuario en español.
- Solo se modifica `frontend/src/domains/bodega/pages/Despachos.tsx`.
- Verificación en `frontend/`: `npm run lint` y `npm run build` (no hay `npm test`).

---

### Task 1: Estado de filtros, toolbar y lista filtrada

**Files:**
- Modify: `frontend/src/domains/bodega/pages/Despachos.tsx`

**Interfaces:**
- Consumes: estado existente `despachos: DespachoConTotal[]` (campos `creado_en: string` ISO y `vendedor_id: string`), `vendedores: Perfil[]`, `setDespachoExpandido`.
- Produces:
  - Helper módulo-nivel `function aaaammdd(fecha: Date): string` — devuelve `YYYY-MM-DD` en la zona local del navegador.
  - Estado `diaFiltro: 'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'` (default `'hoy'`), `fechaSeleccionada: string` (default `''`), `vendedorFiltro: string` (default `''`).
  - Memo `diaObjetivo: string` — la fecha con la que se compara cuando aplica (`''` para `todo`).
  - Memo `despachosFiltrados: DespachoConTotal[]` — despachos que pasan día y vendedor.

- [ ] **Step 1: Agregar helper `aaaammdd` módulo-nivel**

Colocar después de la función `fmtHora` (aprox. línea 78):

```ts
function aaaammdd(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
```

- [ ] **Step 2: Agregar estado de filtros**

Junto a los otros estados (aprox. línea 107, al lado de `despachoExpandido`):

```ts
const [diaFiltro, setDiaFiltro] = useState<'hoy' | 'ayer' | '7d' | 'todo' | 'fecha'>('hoy')
const [fechaSeleccionada, setFechaSeleccionada] = useState('')
const [vendedorFiltro, setVendedorFiltro] = useState('')
```

- [ ] **Step 3: Agregar memos `diaObjetivo` y `despachosFiltrados`**

Justo antes de `if (cargando) return ...` (después del memo `gruposDevolucion`, aprox. línea 338):

```ts
const diaObjetivo = useMemo(() => {
  if (diaFiltro === 'fecha') return fechaSeleccionada
  if (diaFiltro === 'todo') return ''
  const hoy = new Date()
  if (diaFiltro === 'hoy') return aaaammdd(hoy)
  if (diaFiltro === 'ayer') {
    const ayer = new Date(hoy)
    ayer.setDate(hoy.getDate() - 1)
    return aaaammdd(ayer)
  }
  const inicio = new Date(hoy)
  inicio.setDate(hoy.getDate() - 6)
  return aaaammdd(inicio)
}, [diaFiltro, fechaSeleccionada])

const despachosFiltrados = useMemo(() => {
  return despachos.filter((d) => {
    if (vendedorFiltro && d.vendedor_id !== vendedorFiltro) return false
    if (diaFiltro === 'todo') return true
    const fechaDespacho = aaaammdd(new Date(d.creado_en))
    if (diaFiltro === '7d') return fechaDespacho >= diaObjetivo
    return fechaDespacho === diaObjetivo
  })
}, [despachos, vendedorFiltro, diaFiltro, diaObjetivo])
```

- [ ] **Step 4: Agregar la toolbar dentro de la card**

Insertar un `div` con `border-b border-slate-100 px-5 py-3` entre el header de la sección (el que contiene `Últimos despachos`, termina aprox. línea 385) y la primera rama vacía. Reemplaza este fragmento:

```tsx
          </div>

          {despachos.length === 0 ? (
```

por:

```tsx
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['hoy', 'Hoy'],
                  ['ayer', 'Ayer'],
                  ['7d', '7 días'],
                  ['todo', 'Todo'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  className={
                    diaFiltro === valor
                      ? 'rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400'
                  }
                  onClick={() => {
                    setDiaFiltro(valor)
                    setDespachoExpandido(null)
                  }}
                >
                  {etiqueta}
                </button>
              ))}
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
                value={fechaSeleccionada}
                onChange={(e) => {
                  setFechaSeleccionada(e.target.value)
                  setDiaFiltro('fecha')
                  setDespachoExpandido(null)
                }}
              />
            </div>

            <select
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none"
              value={vendedorFiltro}
              onChange={(e) => {
                setVendedorFiltro(e.target.value)
                setDespachoExpandido(null)
              }}
            >
              <option value="">Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombres} {v.apellidos}
                </option>
              ))}
            </select>
          </div>

          {despachos.length === 0 ? (
```

- [ ] **Step 5: Usar `despachosFiltrados` en el render de la lista**

1. Contador: `{despachos.length} registros` → `{despachosFiltrados.length} registros`.
2. Añadir rama vacía para filtros entre la rama `despachos.length === 0` y el `map`:

```tsx
{despachos.length === 0 ? (
  <p className="px-5 py-8 text-center text-sm text-slate-500">
    Aún no hay despachos para esta sucursal.
  </p>
) : despachosFiltrados.length === 0 ? (
  <p className="px-5 py-8 text-center text-sm text-slate-500">
    No hay despachos para el día y vendedor seleccionados.
  </p>
) : (
  <ul className="space-y-2 p-3">
    {despachosFiltrados.map((d) => {
```

3. El cierre del `map` (el `})}` existente que antes cerraba `despachos.map`) ahora cierra `despachosFiltrados.map`; no cambia.

- [ ] **Step 6: Verificar lint y build**

Run (en `frontend/`): `npm run lint` y `npm run build`
Expected: ambos sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/domains/bodega/pages/Despachos.tsx
git commit -m "feat(bodega): filtrar despachos por día y vendedor"
```

---

### Task 2: Filtrar el aside de devoluciones

**Files:**
- Modify: `frontend/src/domains/bodega/pages/Despachos.tsx` (memo `gruposDevolucion`)

**Interfaces:**
- Consumes: `despachosFiltrados` (Task 1), estados `desvProducto`, `desvEnvase`, data `productos`, `tiposEmpaque`.
- Produces: `gruposDevolucion` que solo incluye devoluciones de despachos visibles (sin cambio de firma: sigue siendo `GrupoDevolucion[]`).

- [ ] **Step 1: Filtrar los grupos por despachos visibles**

Dentro del memo `gruposDevolucion` (el que empieza con `useMemo<GrupoDevolucion[]>`), al inicio agregar:

```ts
const idsVisibles = new Set(despachosFiltrados.map((d) => d.id))
```

En el bucle `for (const dv of desvProducto)`, agregar como primera línea:

```ts
if (!idsVisibles.has(dv.despacho_id)) continue
```

En el bucle `for (const de of desvEnvase)`, agregar como primera línea:

```ts
if (!idsVisibles.has(de.despacho_id)) continue
```

Cambiar las dependencias del memo de `[desvProducto, desvEnvase, despachos, productos, tiposEmpaque]` a `[desvProducto, desvEnvase, despachosFiltrados, productos, tiposEmpaque]`.

> La búsqueda `despachos.find((x) => x.id === despachoId)` para `vendedor`/`fecha` sigue usando el estado `despachos` (datos completos) — no cambiar ese uso.

- [ ] **Step 2: Verificar lint y build**

Run (en `frontend/`): `npm run lint` y `npm run build`
Expected: ambos sin errores.

- [ ] **Step 3: Smoke test manual (opcional, requiere credenciales)**

```bash
npm run dev
```
En el navegador: entrar a `/despachos` con un usuario bodega/admin. Verificar: (1) por defecto muestra solo despachos de hoy; (2) los chips `Hoy`/`Ayer`/`7 días`/`Todo` y el calendario cambian la lista; (3) el select de vendedor filtra; (4) el aside de devoluciones refleja los mismos filtros; (5) el contador "N registros" coincide con los visibles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/domains/bodega/pages/Despachos.tsx
git commit -m "feat(bodega): alinear devoluciones del aside con filtros de despachos"
```
