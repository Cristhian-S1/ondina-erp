# C3-A — Registrar venta: umbral por contenedor y tarjeta compacta

- **Fecha:** 2026-10-15 · **Base:** `d5c95ec` · **Defectos:** C3-01 (P2), C3-02 (P3) del barrido C3.

## Qué cambió

- **C3-01:** el cambio tabla/tarjeta ya no usa `lg:` (viewport) sino `@4xl:` (Tailwind 4, container query de 56 rem) sobre un wrapper `@container` del bloque de productos. A 1024×1366 con menú lateral el contenedor mide 718 px → tarjetas; a 1280×800 mide 974 px → tabla. Árbol RHF único (misma fila, sólo CSS).
- **C3-02:** tarjeta con "Disponible" como metadato a la derecha del nombre (etiqueta sobre valor), Cantidad (60 %) y Precio (40 %) en una fila desde 360 px (50/50 desde `sm`), y Subtotal + Quitar en una sola fila. Relleno menor en móvil.
- **Barra fija:** `pb-28` del formulario se mantiene y se añade `scroll-mb-28` a inputs/selects (sólo bajo `sm`) para que el foco no quede bajo la barra de total.
- Se conservan: tarjeta con borde, "Línea N" + nombre, Quitar en contorno rojo, error en vivo bajo el input.

## Archivos

- `frontend/src/domains/ventas/components/FilaProductoVenta.tsx`
- `frontend/src/domains/ventas/pages/RegistrarVenta.tsx`
- `frontend/src/domains/ventas/pages/RegistrarVenta.test.tsx` (prueba nueva C3-01/C3-02)
- `docs/archive/audits/2026-10-14/frontend-movil/C3A-capturar.mjs` (script CDP) y `capturas/C3A/`

## Verificación

`npm run lint`, `build`, `size` (presupuesto OK; CSS +7,2 % vs base) y `test` (64 archivos, 772 pruebas) en verde. `test:integration` no se ejecutó (lo hace el coordinador).

## Evidencia (3 líneas, una con "Excede tu carga"; `capturas/C3A/registrar-venta-<WxH>-{antes,despues}.webp`, ≤ 52 KB)

| Viewport | Modo antes → después | Alto tarjeta antes → después | Alto documento antes → después | scrollWidth ≤ innerWidth | Controles < 44 px |
|---|---|---|---|---|---|
| 412×915 | tarjeta → tarjeta | 444 → 310 px | 2.636 → 2.206 | sí | 0 |
| 375×812 | tarjeta → tarjeta | 444 → 310 px | 2.636 → 2.206 | sí | 0 |
| 768×1024 | tarjeta → tarjeta | 364 → 298 px | 2.129 → 1.931 | sí | 0 |
| 1024×1366 | **tabla (angosta) → tarjeta** | 153 → 298 px | 1.484 → 1.931 | sí | 0 |
| 1280×800 | tabla → tabla | 113 → 113 px | 1.348 → 1.348 | sí | 0 |

Medidas crudas: `capturas/C3A/medidas-{antes,despues}.json`.

## Límites

- Chrome headless con emulación de viewport; sin dispositivo físico ni teclado virtual (el scroll-margin no se probó con teclado real).
- La tarjeta de teléfono baja 30 % (444 → 310 px) pero sigue siendo una tarjeta por producto con selector, cantidad/precio y subtotal; no se eliminó la etiqueta "Producto N" del selector por accesibilidad.
- Con nombres largos y disponibilidad de 6 cifras el nombre se trunca (con `truncate`) a 375 px.
