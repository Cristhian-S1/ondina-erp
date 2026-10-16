# B5 — Shell y componentes compartidos (OND-c07.8): entrega

Rama `Cristhian-S1/fux-b5-shell`. Commits locales, sin push.

## Hallazgos resueltos
| ID | Commit | Resumen |
|---|---|---|
| UX-09 | f67a74e | `fmtFecha` / `fmtFechaHora` en `lib/format.ts` (es-CL, America/Santiago, `dd-mm-aaaa`, `hh:mm`, `—` si vacío/inválido). |
| A1-14 | f5a4a28 | `thCls` pasa de slate-400 (2,45:1 sobre slate-50) a slate-600 (**7,24:1**). Pie de versión slate-400 → slate-500 (4,55:1 sobre slate-50; 4,76:1 sobre blanco). |
| A1-19, UX-18 | d881c94 | Login: error con `role="alert"` + `aria-describedby`/`aria-invalid`; `inputCls` (min-h-11); botón de contraseña 44×44 con `aria-pressed`; submit con `btnPrimary`. |
| UX-20 | d881c94 | Toast: cierre 44×44 con nombre "Cerrar notificación". |
| UX-11 | d881c94, c56cd79 | `components/EstadoVista.tsx`; usado en los Suspense de `domains/administracion/index.tsx`. |
| A1-11 | c56cd79, 3e6bd7e | Drawer móvil: `role="dialog"` `aria-modal` "Menú principal", ciclo Tab/Shift+Tab, contenido de fondo `inert`, Escape, retorno de foco, botón "Cerrar menú". Desktop sin cambios. |
| UX-14 | c56cd79, 3e6bd7e | Campana retirada (no tenía acción; el punto rojo era falso). Drawer móvil muestra nombre, rol y sucursal. `document.title` = "<sección> · Ondina". |
| UX-03 | c56cd79 | `ModulePage` con "Próximamente", texto honesto y enlace "Volver al inicio"; badge "Próximamente" en menú para `/reportes`, `/ubicaciones`, `/administracion`, `/auditoria`. Rutas y permisos intactos. |

## API pública para B1–B4
```ts
// lib/format.ts
fmtFecha(valor: string | Date | null | undefined): string      // "14-01-2026"
fmtFechaHora(valor: string | Date | null | undefined): string  // "14-01-2026 23:30"
// components/EstadoVista.tsx (export default)
<EstadoVista variante="cargando" mensaje?="..." />                                    // role="status"
<EstadoVista variante="vacio" mensaje="..." accion?={<ReactNode/>} />
<EstadoVista variante="error" mensaje?="..." onReintentar?={() => void refetch()} />  // role="alert" + botón Reintentar (btnSecondary)
```
`lib/ui.ts#fmtFecha` (formato corto legado `dd-mm hh:mm`) se mantiene **sin cambios de comportamiento** y queda `@deprecated`; los lotes consumidores deben migrar a `lib/format`.
`ModulePage` ahora requiere contexto de Router (usa `Link`).

## Descartado / parcial
- Los fallbacks de Suspense de `ventas`, `bodega` y `produccion` no se tocaron (fuera de propiedad): B1–B4 deben usar `EstadoVista`.
- Badge "Próximamente" definido en `DashboardLayout` (`PROXIMAMENTE`), porque `NavItem` (`types/module.ts`) es ajeno.
- Otros slate-400 de ayuda en `pages/Dashboard.tsx` (etiquetas RUT/sucursal) quedan fuera de propiedad; `lib/ui.ts` no tenía más slate-400.
- Nombre de sucursal en el drawer: import dinámico de `lib/dashboard` (sin `useQuery`) para no exigir `QueryClientProvider` ni instanciar Supabase al cargar el layout (`App.test.tsx`, ajeno, lo requeriría).

## Pruebas añadidas
`lib/format.test.ts` (fechas, 3), `lib/ui.test.ts` (contraste thCls), `pages/Login.test.tsx` (4), `components/EstadoVista.test.tsx` (6), `components/Toast.test.tsx` (+1, nombre actualizado), `components/ModulePage.test.tsx` (1), `components/DashboardLayout.test.tsx` (+7: modal/inert, ciclo de foco, cerrar menú, sin campana, usuario en drawer, Próximamente, document.title).

## Verificaciones (desde `frontend/`)
- `npm run lint`: sin errores.
- `npm run build`: OK.
- `npm run size`: OK (JS de entrada 87.725 B gzip vs presupuesto 105.567; presupuesto sin cambios).
- `npm run test`: 47 archivos, 552 pruebas, todas verdes.

## Verificación visual
Chrome headless (CDP), Supabase local, cuenta `ux-admin@`. `/login` (con error), `/` y `/reportes` a 375/768/1280: `scrollWidth <= innerWidth` en todos; `document.title` correcto; drawer a 375 con `role=dialog` y contenido `inert`. 6 capturas JPEG en `capturas/b5-*.jpg` (<40 KB).

## Límites
- Sin lector de pantalla real; el ciclo de foco se verificó con jsdom y la apertura del drawer en Chrome.
- 768 sólo medido, sin captura. `npm run test:integration` no se ejecutó (lo corre el coordinador).
