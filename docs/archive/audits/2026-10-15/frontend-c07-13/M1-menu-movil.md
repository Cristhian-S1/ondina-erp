# M1 · Comprobación del menú lateral móvil (`DashboardLayout`)

**Fecha:** 2026-10-15 · **Tarea:** OND-c07.13 / M1 · **Rama:** `Cristhian-S1/m1-menu` @ `0ea1638`
**Origen del hallazgo:** V1-revisión K1, observación no atribuible: «En mis recargas completas el menú lateral móvil (`DashboardLayout`) apareció abierto y capturó los clics a 412–1024 px hasta cerrarlo» (`V1-revision-K1.md:41`).
**Pregunta a responder:** ¿el menú puede quedar ABIERTO y capturando clics al cargar/recargar a 412, 768 y 1024 px, o fue un artefacto del método de la revisión (estado guardado o viewport cambiado sin recargar)?
**Alcance:** sólo lectura (`frontend/src` sin modificar). No se corrigió nada (tarea explícita); los hallazgos que surjan quedan documentados para decisión del coordinador.

## 1. Método

- Entorno: Vite dev en `http://localhost:5193` (vite 8.3.4), Chromium real vía `/usr/bin/google-chrome` 155.0.8059.39 con Playwright-core 1.64.1, Node v26.3.1, Supabase local.
- Sesión: `ux-bodega@example.invalid` / contraseña local (rol bodega), login por UI en un **contexto nuevo por viewport** (412×915 móvil, 768×1024 móvil, 1024×1366, 1280×800; sin cookies ni `localStorage` heredados).
- Escenarios por contexto: **(a)** carga en frío de `/bodega/despachos` **y** de `/despachos` (nota 2), **(b)** recarga, **(c)** abrir el menú → navegar (el `NavLink` lo cierra) → recargar, **(c2)** recarga con el menú **abierto**, **(d)** 1280→412 y 412→1280 **sin recargar** (sólo desde 1280×800), **(e)** apertura manual del menú a 412 → 412→1280→412 sin recargar (contexto aparte).
- Medición en cada paso (JS en página, tras esperar 400–500 ms para la transición de 300 ms): `#menu-lateral` → `inert`, `aria-hidden`, `role`, transformación (`matrix…m41`) y rect; presencia/tamaño del overlay (`div.fixed.inset-0.z-30`); `elementFromPoint` en 3 puntos (centro del contenido, borde izquierdo, hamburguesa) para saber **qué elemento recibiría el clic**; `scrollWidth` vs `innerWidth`; `aria-expanded` del botón.
- Persistencia: revisión del código y grep de `localStorage`/`sessionStorage` en `frontend/src`: **ningún estado del menú se persiste** (sólo borradores de venta en sessionStorage con clave por usuario); `mobileOpen` vive en `useState` y muere con la página.
- Nota 1 — la sonda «hamburguesa» muestra qué hay encima del botón: con el cajón cerrado el clic llega al `svg` dentro del `button` (header); con el cajón abierto llega al `img` del `aside` (el cajón z-40 lo tapa): así se documenta la «captura de clics».
- Nota 2 — **`/bodega/despachos` no existe**: la ruta real es `/despachos` (`frontend/src/domains/bodega/index.tsx:34`); la URL pedida cae en el catch-all y redirige a `/` (`frontend/src/App.tsx:28`). El escenario (a) se cargó igual, para dejar evidencia de ambos.

## 2. Resultados

**Lectura clave** — «cerrado» = cajón fuera de pantalla (rect −256→0), `inert=true`, `aria-hidden=true`, sin overlay, clic llega al contenido (`MAIN`); «abierto» = cajón visible (rect 0→256), `inert=false`, `role=dialog` + `aria-modal`, overlay z-30 presente, clic al overlay/cajón.

### 412×915 (móvil)

| Paso | Ruta efectiva | Menú | Clics |
|---|---|---|---|
| (a) frío `/bodega/despachos` | `/` (redirect catch-all) | cerrado, `inert` | al contenido |
| (a2) frío `/despachos` | `/despachos` | cerrado, `inert` | al contenido |
| (b) recarga de `/despachos` | `/despachos` | cerrado, `inert` | al contenido |
| (c) menú abierto manual | `/despachos` | abierto, dialog | al overlay/cajón (diseño modal esperado) |
| (c) tras navegar a Inicio | `/` | cerrado, `inert` | al contenido |
| (c) recarga tras navegar | `/` | cerrado, `inert` | al contenido |
| (c2) recarga **con menú abierto** | `/` | **cerrado**, `inert` | al contenido |
| (e) menú abierto → 412→1280→412 **sin recargar** | `/` | **abierto**, dialog + overlay | **capturados** (overlay/cajón) |
| (e) tras recarga (a 1280) | `/` | panel de escritorio normal | al contenido |

### 768×1024 (tablet)

| Paso | Menú | Clics |
|---|---|---|
| (a) frío (ambas URLs) | cerrado, `inert` | al contenido |
| (b) recarga | cerrado, `inert` | al contenido |
| (c) abrir → navegar → recargar | cerrado, `inert` | al contenido |
| (c2) recarga con menú abierto | cerrado, `inert` | al contenido |

Al 768 el arranque es igual que al 412: `matchMedia('(min-width:1024px)')` (`DashboardLayout.tsx:28-36`) y el breakpoint Tailwind `lg:` actúan juntos (comprobado: overlay visible y `dialog` sólo tras apertura manual; sin saltos en el límite exacto 1024).

### 1024×1366 y 1280×800 (escritorio)

| Paso | Menú | Clics |
|---|---|---|
| (a) frío, (b) recarga, (c)/(c2) | panel lateral fijo, `inert=false`, sin overlay, 256 px | al contenido |
| (c) clic en hamburguesa | se colapsa a 64 px (`collapsed`, es el toggle escrito en `DashboardLayout.tsx:113-119`) | al contenido |
| (c) recarga | panel 256 px (estado por defecto) | al contenido |
| (d) 1280→412 sin recargar | **cerrado**, `inert`, sin overlay | al contenido |
| (d) 412→1280 sin recargar + recarga | panel normal | al contenido |

En ningún caso hubo scroll horizontal (`scrollWidth == innerWidth` en las 4 anchuras).

### Persistencia del estado

`DashboardLayout.tsx` no escribe ni restaura estado de almacenamiento (sin claves del menú en `localStorage`/`sessionStorage` de todo `frontend/src`). Toda recarga arranca con el menú cerrado.

## 3. Conclusión

**El hallazgo V1 NO es reproducible como se describió.** En contextos nuevos, con trazados explícitos de «carga en frío», «recarga» y «navegar y recargar» a 412, 768 y 1024 px, el menú siempre cargó **cerrado, `inert`, sin overlay y sin capturar clics**, incluso recargando con el menú abierto ((c2), el caso más favorable a la afirmación). Las únicas vías para el estado «abierto + capturando clics» que evidencié son: (c) apertura manual (comportamiento modal esperado) y **(e) ciclo de breakpoint sin recargar tras haber abierto el cajón** (412→1280→412 conserva `mobileOpen=true`).

El hallazgo V1 apunta a un **artefacto del método del revisor**, por alguna de estas dos vías: (1) viewport cambiado **sin recargar** después de abrir el cajón — escenario (e), que reproduce exactamente la observación «abierto y capturando clics a 412–1024 px» sin que haya habido recarga; (2) la URL `/bodega/despachos` que la revisión usaba no existe y redirige a `/`, lo que difumina qué página se medía (con esa URL la recarga tampoco reproduce el defecto). El comportamiento real que sostiene el artefacto es menor (candidato a P4): `mobileOpen` sobrevive al cambio de breakpoint sin recarga; sólo se materializa al estrechar una ventana de escritorio después de haber abierto el menú, no en el uso normal de un teléfono. No se corrigió nada (tarea de sólo lectura); queda para decisión del coordinador.

**Causa probable con archivo:línea (no corregida):** el estado no se resetea al atravesar el breakpoint — `frontend/src/components/DashboardLayout.tsx:40`: `const [mobileOpen, setMobileOpen] = useState(false)` sin ningún efecto que lo limpie cuando `desktop` (`:42`, `useSyncExternalStore` sobre la media query) cambia; `sidebarHidden` (`:43`) sólo refleja `!desktop && !mobileOpen`, y `modalAbierto` (`:47`) revive al volver a móvil con el resto de la UI intacta (el `toggleSidebar` `:113-119` y el efecto del focus-trap `:70-99` no intervienen en el cambio de media query). No hay persistencia a través de recargas; el «hasta cerrarlo» de V1 es el overlay cerrando el cajón al clic (`:125-130`), diseño modal previsto.

## 4. Evidencia

Capturas en `capturas/M1/` (4, todas < 200 KB):

| Archivo | Escenario |
|---|---|
| `412x915-frio-despachos-menu-cerrado.png` | (a2) frío /despachos a 412: cajón cerrado |
| `412x915-menu-abierto-sin-recargar-artifacto.png` | (e) vuelta 1280→412 sin recargar: cajón abierto + overlay (artefacto) |
| `768x1024-recarga-menu-cerrado.png` | (b) recarga a 768: cerrado |
| `1024x1366-frio-despachos-panel-escritorio.png` | (a2) frío a 1024: panel escritorio 256 px |

Datos completos JSON por corrida: `/tmp/opencode/m1-pw/shots-run{0..3}/resultados.json` (fuera del repo).

## 5. Límites

- No se probó pulsación táctil real (`hasTouch` emulado), navegadores distintos de Chromium, ni niveles de zoom/densidad de píxeles.
- La detección de bloqueo de clics usa `elementFromPoint` + atributos (`inert`, presencia del overlay), no clics reales sobre cada control; en el cajón abierto sí hay evidencia directa: el header queda bajo el `aside` z-40 y el contenido bajo el overlay.
- Los accesos usan cuentas de prueba del Supabase local; no se tocó producción ni la BD remota.
- El escenario (e) se construyó por script (resize programático); en un teléfono real el viewport no cambia de tamaño, así que el estado no restablecido afecta sólo a pantallas de escritorio que se estrechan.
- Tarea de sólo lectura: no se ejecutó lint/build/tests (no cambia código) y no se corrigió nada; el comportamiento del escenario (e) queda documentado para decisión del coordinador.
