# L1 — Partición de primera carga, CSS y logo del drawer

**Fecha:** 2026-10-14 (America/Santiago). **Beads:** OND-c07.21, parte 2 técnica; el contraste pertenece a otra entrega. **Base:** `de0338c`, rama `Cristhian-S1/l1-lighthouse`. **Código medido:** `d99c7c7`; commits previos `c2bcd87` y `4886842`. Trabajo local, sin push, merge, PR, SQL ni escrituras de datos de negocio.

## Resultado y alcance

El login ya no descarga el árbol autenticado: shell, tablero, metadatos de dominios y observadores de consultas se importan en paralelo después de que `ProtectedRoute` acepta la sesión. Las páginas de formulario ya eran diferidas; Zod y React Hook Form estaban fuera del boot set y siguen así. Los proveedores de sesión y QueryClient permanecen disponibles desde el inicio para conservar la recuperación de sesión y la limpieza de datos al cambiar de identidad.

La hoja global completa se incrusta en el HTML antes del primer pintado. No hay intercambio asíncrono de estilos, ni extracción manual de un subconjunto que pudiera omitir clases. `cssCodeSplit: false` evita que las rutas lazy pidan nuevamente la misma hoja. El build conserva el asset CSS externo y vuelve a enlazarlo si una futura CSP prohíbe inline; **no se modifica `vercel.json`**. Su `style-src` ya contiene `'unsafe-inline'`; el plugin comprueba esa condición.

El logo deja de estar incrustado como data URI dentro del JS. Vite emite `logo-WtfTBHUb.jpg` (3.722 B), y el drawer solamente asigna `src` cuando es visible; mantiene 40×40 px y `decoding="async"`. Se usa el breakpoint real del shell, **1024 px**, de modo que también cubre tablet de 768 px. El login solicita el logo visible y el drawer oculto no lo solicita.

### Archivos de producto

| Archivo | Cambio |
| --- | --- |
| `frontend/src/App.tsx` | `lazy` + `Promise.all` para layout, tablero y metadatos; mismas rutas, permisos y redirecciones. |
| `frontend/src/components/DashboardLayout.tsx` | Fuente del logo condicionada a visibilidad, dimensiones explícitas y decodificación asíncrona. |
| `frontend/vite.config.ts` | Inline de CSS de producción permitido por CSP, hoja global única y logo externo con hash. |
| `frontend/scripts/check-bundle-size.mjs` | Cuenta el contenido CSS inline real en las métricas de entrada y total inicial. |
| `frontend/scripts/check-bundle-size.test.mjs` | Build real con sourcemaps: exclusión del shell/dominos/formularios del boot, logo externo, CSS inline íntegro y sin referencia redundante desde JS; regresiones de presupuesto CSS inline y mezcla inline/enlazado. |
| `frontend/bundle-budget.json` | Baja las cinco bases y conserva el margen de 10%; ningún presupuesto aumenta. |

No se modificaron `main.tsx`, `ProtectedRoute.tsx`, `lib/supabase.ts`, `domains/index.ts`, **ningún `domains/*/index.tsx`**, páginas ni `domains/*/api.ts`. No hay conflictos de ownership con los workers de Bodega, Producción o Ventas.

## Método y evidencia

Se reutilizan sin modificar `scripts/run-q1-baseline.mjs` y `scripts/servidor-local-a3.mjs`, con `.env.local` real y Supabase LOCAL `http://127.0.0.1:54321`. El servidor de L1 usa el puerto 5193 para no interferir con otros workers; aplica las mismas cabeceras y la excepción local documentada de `connect-src`. No se usa `vite preview`.

Lighthouse **12.8.2**, `/usr/bin/google-chrome`, cache HTTP fría por corrida, sesión real por el formulario, mismos cinco perfiles y tres rutas, tres corridas por celda. Comparación histórica contra [Q1-lighthouse-base.md](Q1-lighthouse-base.md) y `lighthouse-base/**`; la campaña final está en `lighthouse-L1/**`.

También se hicieron tres corridas móviles de control sobre la base del checkout (`lighthouse-L1-before`) y tres sobre un candidato que sólo incrustaba el CSS (`lighthouse-L1-css-inline`). Las campañas `lighthouse-L1-intermedio` y `lighthouse-L1-logo-intermedio` se interrumpieron al detectar, respectivamente, el logo todavía incrustado y la petición redundante de CSS al abrir rutas; son diagnósticos parciales y **no** sustituyen la campaña final. Se conservan sus logs y LHR comprimidos.

`scripts/l1-capturas.mjs` deriva del driver CDP de Q1 y añade administración, apertura/cierre por Escape del drawer, foco, dimensiones y recursos solicitados. `scripts/l1-build-analysis.mjs` reproduce el ensayo de partición del SDK en directorios temporales, sin alterar el dist operativo. `scripts/l1-comparison.mjs` obtiene las medianas de los LHR, incluida la contabilidad explícita del CSS inline.

## Bytes antes/después

Inventario gzip **nivel 9**, igual que `chunks.json` de Q1. No mezclar estos valores con los bytes transferidos que informa Lighthouse ni con gzip predeterminado de `npm run size`.

| Recurso / conjunto | Q1 raw B | L1 raw B | Q1 gzip B | L1 gzip B | Diferencia gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Entry JS | 328.027 | 294.354 | 103.387 | 91.245 | −12.142 (−11,74%) |
| `vendor-supabase` | 214.047 | 214.047 | 54.467 | 54.467 | 0 |
| JS compartido inicial (`ui` → `jsx-runtime`) | 10.172 | 8.774 | 3.800 | 3.328 | −472 |
| CSS global (externo → inline) | 37.418 | 39.850 | 7.368 | 7.643 | +275 |
| Boot set JS + CSS | 589.664 | 557.025 | 169.022 | 156.683 | −12.339 (−7,30%) |

El JPEG externo se solicita cuando se usa; sus 3.722 B no se cuentan como JS/CSS. El CSS actual ya medía 39.815 B raw / 7.625 B gzip **antes** de L1 en este checkout, frente a 37.418/7.368 de la evidencia Q1; el incremento restante de L1 es 35 B raw / 18 B gzip. La mejora del CSS está en eliminar la petición bloqueante, no en reducir su contenido.

Con `cssCodeSplit: false`, el manifest declara `style.css` por separado. El colector histórico de Q1, que sigue imports estáticos, muestra sólo 149.040 B gzip de JS en `chunks.json.bootSet`; **ese número no es el boot set comparable completo**. [bundle-measurements.json](lighthouse-L1/bundle-measurements.json) añade una vez los 7.643 B del CSS inline y conserva la semántica JS + CSS de Q1. El verificador de presupuesto también mide el CSS inline: no se reporta falsamente CSS de cero bytes.

### Auditorías y medianas de las 15 combinaciones

| Perfil | Página | Performance antes → después | LCP ms antes → después | Transferido B antes → después | Sin usar B antes → después | CSS bloqueante antes → después | Logo offscreen antes → después |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile | login | 98 → 98 | 1965 → 1961 | 175450 → 166798 | 102759 → 94359 | 3/3 → 0/3 | 0/3 → 0/3 |
| mobile | portada | 97 → 98 | 2267 → 2127 | 177063 → 178069 | 90993 → 84832 | 3/3 → 0/3 | 3/3 → 0/3 |
| mobile | administracion | 97 → 98 | 2260 → 2125 | 178375 → 179399 | 89961 → 87514 | 3/3 → 0/3 | 3/3 → 0/3 |
| movil-412x915 | login | 98 → 98 | 1966 → 1963 | 175450 → 166798 | 102759 → 94359 | 3/3 → 0/3 | 0/3 → 0/3 |
| movil-412x915 | portada | 97 → 97 | 2266 → 2269 | 177063 → 178069 | 90993 → 84832 | 3/3 → 0/3 | 3/3 → 0/3 |
| movil-412x915 | administracion | 97 → 98 | 2260 → 2125 | 178375 → 179399 | 89961 → 87514 | 3/3 → 0/3 | 3/3 → 0/3 |
| tablet-768x1024 | login | 98 → 98 | 1965 → 1963 | 175450 → 166798 | 102759 → 94359 | 3/3 → 0/3 | 0/3 → 0/3 |
| tablet-768x1024 | portada | 97 → 98 | 2268 → 2160 | 177063 → 178069 | 90993 → 84832 | 3/3 → 0/3 | 3/3 → 0/3 |
| tablet-768x1024 | administracion | 97 → 98 | 2260 → 2122 | 178375 → 179399 | 89961 → 87514 | 3/3 → 0/3 | 3/3 → 0/3 |
| tablet-1024x1366 | login | 98 → 98 | 1966 → 1961 | 175450 → 166798 | 102759 → 94359 | 3/3 → 0/3 | 0/3 → 0/3 |
| tablet-1024x1366 | portada | 97 → 97 | 2267 → 2344 | 177063 → 182486 | 90993 → 82672 | 3/3 → 0/3 | 0/3 → 0/3 |
| tablet-1024x1366 | administracion | 97 → 98 | 2261 → 2202 | 178375 → 183816 | 89961 → 85354 | 3/3 → 0/3 | 0/3 → 0/3 |
| desktop | login | 100 → 100 | 459 → 452 | 175450 → 166798 | 102759 → 94359 | 0/3 → 0/3 | 0/3 → 0/3 |
| desktop | portada | 100 → 100 | 539 → 487 | 177063 → 182486 | 90993 → 82672 | 1/3 → 0/3 | 0/3 → 0/3 |
| desktop | administracion | 100 → 100 | 532 → 509 | 178375 → 183816 | 89961 → 85354 | 0/3 → 0/3 | 0/3 → 0/3 |

**Campaña final: 45 corridas, 0 fallos, 481 s.** `render-blocking-resources` y `offscreen-images` tienen score 1 en las 45 corridas. `unused-javascript` sigue apareciendo en 45/45, con menos bytes en cada una de las 15 medianas. Accessibility conserva 94–95 por el contraste pendiente; Best Practices queda en 100 en todas las medianas. TBT mediano 0 ms y CLS mediano 0 en las 15 celdas.

Detalle de bytes sin usar (medianas del perfil mobile; `comparison.json` conserva los otros perfiles):

| Ruta | Entry sin usar Q1 → L1 B | Supabase sin usar Q1 → L1 B |
| --- | ---: | ---: |
| Login | 57.132 → 48.732 | 45.627 → 45.627 |
| Portada | 47.265 → 41.104 | 43.728 → 43.728 |
| Administración | 46.233 → 43.786 | 43.728 → 43.728 |

La transferencia total del login baja **8.652 B (−4,93%)**. La navegación autenticada fría sube **1.006–1.024 B** en anchos menores de 1024 px y **5.423–5.441 B** donde el logo está visible: la separación en más chunks y el JPEG externo tienen costes propios, aunque el boot set y el JS sin usar disminuyan. No se afirma ahorro de transferencia total para esas rutas. El mayor LCP mediano de portada en 1024×1366 pasa de 2267 a 2344 ms (+77 ms); mantiene performance 97 y no se oculta en la tabla. Los demás scores medianos se mantienen o mejoran. La medición compartida no permite atribuir causalmente cada variación de latencia.

## Por qué se conserva el SDK Supabase único

El análisis de sourcemaps atribuye aproximadamente 206.875 B generados a React DOM, 38.191 al router y 26.137 al núcleo de Query dentro del cierre inicial. QueryClient se usa para invalidar datos privados al cambiar de sesión; moverlo detrás del login exigiría cambiar ese contrato. El shell, los metadatos y `queryObserver` quedan fuera del cierre inicial; la prueba del build lo comprueba. Zod/RHF permanecen en los chunks de formulario, no se fuerzan a un vendor precargado.

El SDK mantiene imports estáticos a Auth, PostgREST, Realtime, Storage y Functions. El constructor del cliente crea las piezas de Auth/REST/Realtime y mantiene el enlace de tokens. Partir archivos del mismo cliente no difiere esos imports: el ensayo carga **ocho** recursos JS iniciales en vez de tres y sube su suma gzip nivel 9 de **149.040 a 151.342 B (+2.302 B, +1,54%)**. Las partes separadas miden Auth 22.931 B, PostgREST 4.979 B, Realtime/Phoenix 16.216 B, Storage/Iceberg 6.983 B, Functions 1.292 B y envoltorio/dependencias 4.365 B gzip. Todo sigue en el cierre estático.

Se conserva, por tanto, el cliente único de `lib/supabase.ts`. Auth y la lectura de `perfiles` por REST son necesarias antes de autorizar rutas; eliminar Realtime/Storage requeriría otro contrato de cliente y cambios de servicios fuera del ownership. No se crean dos gestores de sesión ni se sustituye el SDK por llamadas manuales. El experimento completo y la atribución de bytes están en [supabase-partition.json](lighthouse-L1/supabase-partition.json). La atribución por sourcemap es aproximada para bytes minificados; gzip sólo se calcula por recurso completo. Referencia de API: [inicialización de supabase-js](https://supabase.com/docs/reference/javascript/initializing).

## Decisión sobre CSS y coste de cache

En el control móvil de este checkout, sólo incrustar CSS bajó el LCP mediano de **1965 a 1822 ms**; las tres corridas tuvieron CLS 0 y `render-blocking-resources` pasó de 0,5 a 1. El candidato definitivo además externaliza el logo: esa solicitud visible del login consume parte del ahorro de primer pintado. La tabla final muestra el efecto combinado y no atribuye automáticamente los 143 ms del experimento al resultado final.

Se acepta el inline completo de una hoja de ~7,6 KB gzip por el foco en primera navegación móvil y la comprobación de igualdad visual. El HTML pasa de ~0,6 KB a ~40,5 KB raw (~8,1 KB gzip); una nueva navegación de documento vuelve a transferir ese CSS, mientras una hoja externa podría reutilizar cache. La navegación SPA conserva el documento y no repite la transferencia. No se descargan dos copias: el driver verifica cero solicitudes `.css` en login, portada, administración y drawer abierto. Si la hoja crece sustancialmente, conviene reevaluar esta decisión; el presupuesto reducido detecta ese crecimiento.

## Verificación y capturas

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Verde, sin hallazgos. |
| `npm run build -- --manifest` | Verde con configuración real; manifest adicional para medición. |
| `npm run size` | Las cinco métricas verdes; presupuestos menores. |
| `npm run test` | **741/741, 59 archivos**, verde. No se ejecutó `test:integration`. |

Prueba roja antes de la partición: el build real contenía `src/domains/` en el cierre inicial (`red-partition.log`). Pruebas rojas antes del soporte inline: el verificador rechazaba la ausencia de link CSS y omitía la suma del CSS inline (`red-css.log`). Ambas pasan con la implementación; la suite mantiene los casos de autorización y normalización de rutas de `App.test.tsx` y los de foco/modal del drawer. Logs en `lighthouse-L1/`.

Bases del presupuesto: entry JS **91.391**, CSS **7.656**, chunk mayor raw **294.354**, JS inicial **149.349**, CSS inicial **7.656** B. Son menores que las cinco bases anteriores (95.970 / 43.502 / 301.916 / 158.877 / 43.684). La hoja única final mide 7.667 B gzip predeterminado, 11 B más que la base ajustada en `c2bcd87`; queda dentro del límite **8.422 B**, sin subir presupuesto. Los demás límites son 100.531 / 323.790 / 164.284 B.

**18 pares de capturas, 36 PNG**, comprimidos sin pérdida: login, portada y administración en los cinco viewports, más drawer abierto en los tres viewports menores de 1024 px. Los **18 pares tienen cero píxeles distintos** ([comparacion-pixeles.json](capturas/L1/comparacion-pixeles.json)); no se cambian tipografía, colores ni geometría. Las verificaciones [antes](capturas/L1/verificacion-viewport-antes.json) y [después](capturas/L1/verificacion-viewport-despues.json) muestran cero overflow horizontal y cero objetivos menores de 44 px. Después: logo 40×40, cero peticiones del logo en drawer oculto, logo presente al abrir y foco restaurado tras Escape.

| Viewport | Evidencia representativa antes / después |
| --- | --- |
| 412×915 | [Login antes](capturas/L1/login-412x915-antes.png) / [después](capturas/L1/login-412x915-despues.png); [drawer antes](capturas/L1/drawer-412x915-antes.png) / [después](capturas/L1/drawer-412x915-despues.png). |
| 375×812 | [Portada antes](capturas/L1/portada-375x812-antes.png) / [después](capturas/L1/portada-375x812-despues.png). |
| 768×1024 | [Administración antes](capturas/L1/administracion-768x1024-antes.png) / [después](capturas/L1/administracion-768x1024-despues.png); [drawer después](capturas/L1/drawer-768x1024-despues.png). |
| 1024×1366 | [Portada antes](capturas/L1/portada-1024x1366-antes.png) / [después](capturas/L1/portada-1024x1366-despues.png). |
| 1280×800 | [Administración antes](capturas/L1/administracion-1280x800-antes.png) / [después](capturas/L1/administracion-1280x800-despues.png). |

## Reproducción

Desde la raíz, con `.env.local` local ya configurado:

```sh
npm run lint --prefix frontend
npm run build --prefix frontend -- --manifest
npm run size --prefix frontend
npm run test --prefix frontend
node docs/archive/audits/2026-10-14/frontend-movil/scripts/servidor-local-a3.mjs --port 5193 --supabase http://127.0.0.1:54321
```

En otra terminal:

```sh
node docs/archive/audits/2026-10-14/frontend-movil/scripts/run-q1-baseline.mjs --base http://127.0.0.1:5193 --runs 3 --out docs/archive/audits/2026-10-14/frontend-movil/lighthouse-L1
node docs/archive/audits/2026-10-14/frontend-movil/scripts/l1-comparison.mjs
node docs/archive/audits/2026-10-14/frontend-movil/scripts/l1-build-analysis.mjs
node docs/archive/audits/2026-10-14/frontend-movil/scripts/l1-capturas.mjs --base http://127.0.0.1:5193 --stage despues
```

## Límites y entrega

La medición es local, con CPU/red simuladas y carga variable del host; no es una garantía de producción. `unused-javascript` continúa abierto para el núcleo de React/router/Query y Supabase: esta entrega reduce los bytes iniciales y documenta el límite del SDK, no elimina todo el código sin usar. `color-contrast` no se modifica y sigue a cargo del worker de color. No se cierra OND-c07.21 por completo porque contiene esa parte independiente.

Commits locales de producto/presupuesto: `c2bcd87` (partición/CSS/logo/verificador), `4886842` (presupuestos menores), `d99c7c7` (evitar CSS redundante). El commit de evidencia añade este informe, los tres scripts de L1, las capturas y los resultados comprimidos. Integración y pruebas de integración quedan en manos del coordinador.
