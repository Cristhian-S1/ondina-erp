# C3-C · Entrega de Producción

Fecha de ejecución: **2026-10-15, America/Santiago**. Se conserva la carpeta del barrido del 2026-10-14 solicitado.

Rama: `Cristhian-S1/c3c-produccion`. Base efectiva al comenzar: `c5f7479a81c3328604c3e0133fa17c1e973fd3db` (ya incluía C3-A y C3-D; posterior al `4809b1a` del encargo). Despacho: `task_004b0791e167` / `ctx_3e50c74c65ab`.

## Resultado y alcance

Se corrigieron C3-06, C3-07, C3-08, C3-09, C3-12 y la deuda R2-08, R2-09, R2-11. Los cambios de aplicación y pruebas están exclusivamente en `frontend/src/domains/produccion/`; la documentación y las 12 capturas están en esta carpeta de auditoría. No se modificaron SQL, migraciones, `.opencode/`, dependencias ni archivos de otros dominios. Los commits son locales, sin push, merge ni PR.

| Hallazgo | Cambio y evidencia de código | Verificación |
| --- | --- | --- |
| C3-12 / E9 | `pages/Produccion.tsx:114` deriva la disponibilidad del producto y el error en vivo; `:158` impide enviar una merma que exceda el stock; `:218` usa `InputNumerico` con error y descripción ARIA. `api.ts:167` reutiliza `obtenerStockBodega` de la API existente, sin SQL nuevo. `hooks/useDatosProduccion.ts:38` consulta stock sólo para Incidencias, con identidad/sucursal en la clave. | Pruebas de exceso sin envío ni recorte del borrador, corrección inmediata, reducción de stock tras refetch, saldo cero, error de lectura/reintento y conservación de campos. Cuenta real local de Producción: `Disponible: 100`; cantidad `9.999.999` conserva valor y muestra error asociado. |
| C3-06 | `components/TablaProduccionResponsive.tsx:21` conserva producto/cantidad en una fila; oculta visualmente etiquetas de texto libre en tarjetas compactas y usa metadato de 12 px, hasta dos líneas, sólo bajo 640 px. Historial y Mermas ya pasaban `cantidad: true`; faltaba compactar el texto libre. | Aserciones de navegador sobre alineación, tamaño y etiqueta oculta en Historial/Mermas a 360, 375 y 412. Tarjetas de Historial observadas: 122 → 94 px. Tabla de escritorio y texto completo desde 640 px. |
| C3-07 | `components/FiltrosProduccion.tsx:17`: Producto a todo el ancho, Desde/Hasta en dos columnas desde 360 px, Limpiar en su propia fila compacta; se elimina la distribución de cuatro columnas que estrechaba las fechas. | Navegador: Desde/Hasta alineados, ancho ≥140 px en las seis anchuras. A 1280, fechas de Registrar: 119,5 → 261 px, sin recorte visual. Las pruebas previas de rango inválido y Limpiar permanecen verdes. |
| C3-08 | `components/IndicadoresProduccion.tsx:44`: KPI en dos columnas desde 360 px; `:56` usa resumen numérico para presentar Unidades y Registros juntos debajo del producto. | Navegador: KPI y métricas por producto alineados a 360, 375 y 412. Tarjeta por producto observada: 158 → 78 px. |
| C3-09 | `components/TabsIncidencias.tsx:14` aplica pestañas sólo bajo 640 px: `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, foco itinerante, flechas, Home/End. Ambos formularios permanecen montados una sola vez; el panel inactivo tiene `hidden`. En tablet/escritorio se exponen ambos bloques con sus grids originales. | Pruebas de semántica, teclado, borrador al alternar y transición a tablet sin duplicar ni reemplazar inputs; limpieza del listener. Navegador: sólo un panel accesible en móvil, ambos formularios visibles desde 640. |
| R2-08 | `HistorialProduccion.tsx:16` e `IndicadoresProduccion.tsx:16`: se elimina `versionDatos` y `perfilId` es obligatorio. Se actualizan consumidores/pruebas y las pruebas de refetch usan filtros o invalidación real. | Prueba de clave exacta de Historial: `['produccion','u1','s1','historial','','','',1]`; búsqueda de `versionDatos` sin coincidencias en el dominio. |
| R2-09 | `IndicadoresProduccion.tsx:24` reutiliza `useJornadaSantiago` e `inicioPeriodo` (hoy en `lib/jornada.ts`, FX5 R5-03). La jornada reactiva forma parte de la clave y fija ambos extremos de la lectura. | Reloj simulado: `2026-10-15T02:59:59Z` → `03:00:00Z`; cambia jornada `2026-10-14` → `2026-10-15`, crea una clave nueva y lee el nuevo “hoy”. Se conservan las pruebas de períodos de 7/30 días en Santiago. |
| R2-11 | `api.ts:171`: tópico único por montaje mediante secuencia local (sin `crypto.randomUUID`, FX5 R5-02); cleanup asíncrono con `await removeChannel` y `catch`. Se conserva la guardia de callbacks tardíos del hook. | Prueba de tópicos simultáneos distintos y rechazo de cleanup resuelto sin promesa no manejada. Pruebas de desmontaje, cambio de identidad/sucursal y callbacks obsoletos verdes. |

**Corrección FX5 (2026-10-15, R5-01):** la entrega original afirmaba incorrectamente que el stock se actualizaba con Realtime de `stock_bodega`; esa tabla no está publicada. FX5 elimina ese listener e invalida la lectura de stock ante eventos publicados de `producciones` y `mermas`, y tras las mutaciones propias de esos recursos. La lectura tiene `staleTime: 30_000`; la actualización manual y el foco siempre vuelven a leerla. Un despacho de otra sesión no genera un evento publicado para esta lectura: requiere foco o actualización manual. Una lectura fallida muestra `Disponible: —`, ofrece Reintentar y bloquea Registrar merma; no se representa como saldo cero. Una lectura válida sin fila del producto se interpreta como saldo cero, según el patrón existente de stock.

## Archivos

Primer commit, `6260ce6` — stock de merma, pestañas y cleanup Realtime:

- `api.ts`, `api.realtime.test.ts`.
- `hooks/useDatosProduccion.ts`, `hooks/useDatosProduccion.test.tsx`.
- `pages/Produccion.tsx`, `pages/Produccion.test.tsx`, `pages/Produccion.branch.test.tsx`.
- `components/TabsIncidencias.tsx`, `components/TabsIncidencias.test.tsx`.

Segundo commit, `feac659` — compactación, jornada y eliminación de prop muerta:

- `components/TablaProduccionResponsive.tsx`, `components/FiltrosProduccion.tsx`.
- `components/HistorialProduccion.tsx`, `components/HistorialProduccion.test.tsx`.
- `components/IndicadoresProduccion.tsx`, `components/IndicadoresProduccion.test.tsx`.
- `components/EstadosProduccion.test.tsx`, `components/PaginacionProduccion.test.tsx`.
- `C3C.visual.mjs`, verificador reproducible con Chrome real y Playwright opcional.

Todos estos nombres son relativos a `frontend/src/domains/produccion/`. Un tercer commit contiene este informe y las capturas. Los hooks existentes de commit se ejecutaron y anunciaron la exportación de 117 issues de Beads; no se desactivaron hooks. `OND-c07.13` continúa abierto porque contiene pendientes de otros lotes y R2-13; este worker no cierra ese conjunto.

## Pruebas y gates

Ejecutados desde `frontend/`:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | PASS, sin errores. |
| `npm run build` | PASS, TypeScript y Vite. |
| `npm run size` | PASS: JS inicial gzip 149,350 KB / presupuesto 164,284; CSS inicial gzip 8,301 KB / 8,422. |
| `npm run test` | **783/783 PASS, 66 archivos**, ejecución final de 10,04 s. |

La fase roja anterior a los cambios tuvo **4 fallos / 35 PASS**: faltaban disponibilidad/validación, tabs, jornada en clave y cleanup seguro. La suite final añade nueve casos de regresión respecto a los 774 de la base. `git diff --check` pasa. No se ejecutó `npm run test:integration`, según el encargo.

Navegador: `/usr/bin/google-chrome`, Playwright, idioma `es-CL`, Vite en `http://127.0.0.1:5196`, Supabase local `http://127.0.0.1:54321`, cuenta `ux-produccion@example.invalid`. Se reutilizaron registros locales poblados; la verificación no envió escrituras a `/rest/v1/`.

Comando reproducible desde la raíz del worktree, con Vite ya iniciado y la instalación disponible de Playwright:

```bash
PLAYWRIGHT_MODULE=/home/cristhian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
C3C_RESULT=/tmp/c3c-browser-assertions.json \
node frontend/src/domains/produccion/C3C.visual.mjs
```

`PLAYWRIGHT_MODULE` también admite otra instalación de Playwright; sin esa variable, el script busca `playwright` por resolución normal. `ONDINA_URL` cambia el puerto local; el script exige host `127.0.0.1`. `C3C_CAPTURE_DIR` es opcional para regenerar las seis capturas después. No se instala Playwright en el proyecto.

Resultado: **PASS, 24 combinaciones** (Registrar, Historial, Indicadores, Incidencias × seis viewports), con aserciones de layout, stock, tabs, ausencia de excepciones y cero escrituras. Los controles visibles revisados en el contenido de Producción miden al menos 44×44 px; `document.documentElement.scrollWidth <= innerWidth` en todas las combinaciones.

| Viewport | Vistas verificadas | Overflow horizontal | Controles <44 px | Resultado específico |
| --- | --- | --- | --- | --- |
| 360×800 | 4 | 0 | 0 | Umbral de KPI y fechas en dos columnas; tabs y tarjetas compactas. |
| 375×812 | 4 | 0 | 0 | Formulario único visible por tab y validación en vivo. |
| 412×915 | 4 | 0 | 0 | Historial 2.310 → 1.930 px de documento; Indicadores 989 → 915; Incidencias 4.186 → 2.269 con Mermas activa y error visible. |
| 768×1024 | 4 | 0 | 0 | Ambas secciones de Incidencias visibles; estructura de tablet conservada. |
| 1024×1366 | 4 | 0 | 0 | Tabla de Historial, filtros y campos sin recorte. |
| 1280×800 | 4 | 0 | 0 | Registrar con fechas de 261 px; ambos formularios de Incidencias visibles. |

Los altos son observaciones de los registros presentes durante esta sesión, no presupuestos de rendimiento ni garantías sobre otros conjuntos de datos. La comparación de Incidencias contrapone ambos bloques apilados antes con el panel Mermas activo después, incluyendo el error de exceso.

## Capturas antes/después

**12 PNG**, optimización sin pérdida, **máximo 129.418 bytes**, total **913.969 bytes**; todos por debajo de 200.000 bytes. Se inspeccionaron visualmente las cuatro capturas principales después, además de ejecutar las aserciones geométricas en las 24 combinaciones.

| Vista / viewport | Antes | Después |
| --- | --- | --- |
| Historial · 412×915 | [Antes](capturas/C3C/historial-412x915-antes.png) | [Después](capturas/C3C/historial-412x915-despues.png) |
| Indicadores · 412×915 | [Antes](capturas/C3C/indicadores-412x915-antes.png) | [Después](capturas/C3C/indicadores-412x915-despues.png) |
| Incidencias · 412×915 | [Antes](capturas/C3C/incidencias-412x915-antes.png) | [Después: Mermas y error de stock](capturas/C3C/incidencias-412x915-despues.png) |
| Incidencias · 768×1024 | [Antes](capturas/C3C/incidencias-768x1024-antes.png) | [Después](capturas/C3C/incidencias-768x1024-despues.png) |
| Historial · 1024×1366 | [Antes](capturas/C3C/historial-1024x1366-antes.png) | [Después](capturas/C3C/historial-1024x1366-despues.png) |
| Registrar · 1280×800 | [Antes](capturas/C3C/registrar-1280x800-antes.png) | [Después](capturas/C3C/registrar-1280x800-despues.png) |

## Límites

- Evidencia funcional/visual sobre Supabase local y la cuenta de Producción indicada; no se verificó la BD remota ni una matriz nueva de roles/RLS.
- No se creó una merma real: la validación de exceso se comprobó sin POST; el caso de escritura válida y las invalidaciones se verificaron con mocks de la API.
- Realtime y medianoche se verificaron con pruebas deterministas de eventos/reloj. No se esperó una medianoche real ni se provocó un cambio de stock mediante otra sesión.
- El stock mostrado es una lectura orientativa susceptible a movimientos concurrentes; el servidor sigue siendo la autoridad al registrar la merma. Los errores del servidor conservan su feedback existente mediante Toast.
- No se realizó auditoría completa con lector de pantalla. Se verificaron roles, asociaciones ARIA, foco, teclado y exposición de paneles con Testing Library y Chrome.
- Chrome de esta máquina muestra `mm/dd/yyyy` en el control nativo de fecha aunque el contexto use `es-CL`; ahora hay ancho suficiente. Las fechas visibles de registros siguen en America/Santiago.
- Continúan fuera de alcance los demás hallazgos C3 y R2-13. La integración por cherry-pick corresponde al coordinador.
