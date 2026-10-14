# B7 — Retiro de Mantine (OND-c07.11)

Fecha: 2026-10-14. Base: `origin/feature/frontend-ux` (ca44d3c).

## Cambio

- `frontend/src/main.tsx`: se quitan `MantineProvider` y los imports `@mantine/core/styles.css` y `@mantine/dates/styles.css`.
- `frontend/package.json` / `package-lock.json`: desinstalados `@mantine/core`, `@mantine/dates`, `@mantine/hooks` y `dayjs` (0 referencias a mantine en el lock).
- Confirmado con `grep -rn "@mantine\|dayjs" frontend/src frontend/tests`: el único uso era `main.tsx`; ningún test lo referenciaba.

## Prueba añadida (TDD)

`frontend/src/sin-mantine.test.ts`: recorre `src/` y falla si algún `.ts/.tsx/.css` menciona `@mantine` o `dayjs`. Falló antes del cambio y pasa después.

## Bundle (`npm run build && npm run size`, con `.env.local`)

| Métrica (gzip salvo indicado) | Antes | Después | Δ |
|---|---|---|---|
| JS de entrada | 102.180 | 94.805 | -7.375 (-7,2%) |
| CSS de entrada | 43.763 | 6.865 | -36.898 (-84,3%) |
| Chunk JS más grande (sin comprimir) | 323.492 | 298.412 | -25.080 (-7,8%) |
| JS inicial total | 158.878 | 151.494 | -7.384 (-4,6%) |
| CSS inicial total | 43.763 | 6.865 | -36.898 (-84,3%) |

`bundle-budget.json` no se modificó.

## Comparación visual (Chrome headless, build antes vs. después)

Vistas: login, inicio y ventas/registrar (vendedor), despachos (bodega), producción/registrar (producción) y ranking (admin), a 375/768/1280. En todas `scrollWidth <= innerWidth` (en 768/1280 de registrar/producción 753/768 y 1265/1280 corresponden a la barra de scroll vertical).

Diferencias halladas (todas por el reset base de Mantine, no por funcionalidad):

1. `body` pasa de `line-height` 1.55 (24,8 px) a 1,5 (24 px) de Tailwind.
2. `<button>` sin clase de tamaño pasa de 16 px/24,8 px a 14 px/20 px (preflight de Tailwind en vez del reset de Mantine). Los botones con clases explícitas (`btnPrimary`, etc.) no cambian; `input`/`select` tampoco.
3. En Linux la pila tipográfica cae en otra fuente (Noto Sans en lugar de Liberation Sans) porque Mantine anteponía `Helvetica, Arial`; en macOS/Windows resuelve `-apple-system`/Segoe UI igual que antes. Las etiquetas `font-medium` se aprecian algo más marcadas.

Conclusión: nada dependía funcionalmente de los estilos de Mantine; el aspecto es el definido por Tailwind. No hizo falta tocar `index.css`. Los diálogos y focus ring usan clases Tailwind propias del proyecto; no se detectaron cambios.

Capturas (8, <300 KB): `capturas/b7-{login,ventas-registrar,ranking,despachos}-{antes,despues}-{375,768,1280}.png`.

## Verificaciones (desde `frontend/`)

- `npm run lint`: sin errores.
- `npm run build`: OK (advertencia preexistente INEFFECTIVE_DYNAMIC_IMPORT de `dashboard.ts`).
- `npm run size`: 5 métricas OK.
- `npm run test`: 52 archivos, 629 pruebas, todas verdes.

## Límites

- Comparación visual en Chrome headless sobre Linux, con datos locales (`ux-*@example.invalid`); no se probó en Safari/Windows. Sólo se capturaron 8 imágenes; el resto se contrastó por métricas computadas.
- No se ejecutó `npm run test:integration`.
