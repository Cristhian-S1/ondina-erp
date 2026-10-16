# B6 — Entrega de TypeScript estricto y presupuesto inicial

Fecha: 2026-10-13 (America/Santiago). Beads: OND-c07.9. Rama: `Cristhian-S1/fux-b1-bodega`. Base integrada: `371eec4`.

**Las cuatro verificaciones pasan y `size` muestra cinco métricas OK, con configuración local real.** El JS inicial total disminuye 279 B gzip; Supabase vuelve a un vendor precargado y las 15 páginas de dominio conservan su carga dinámica. No se subió ningún límite histórico.

## Hallazgos resueltos

| Hallazgo | Cambio | Commit |
| --- | --- | --- |
| Regresión de bundle desde B5 / A1-16 | Grupo `vendor-supabase` para `@supabase/*` y sus dependencias mediante `build.rolldownOptions.output.codeSplitting`. Sólo se añadió la sección `build` de Vite. | `0f503a2` |
| A1-15 | `strict: true` explícito en los proyectos app y node; `tsc --showConfig` lo confirma en ambos y build pasa sin cambios a código fuente ajeno. | `0f503a2` |
| A1-16 | JS inicial total = scripts de módulo de entrada + todos los modulepreloads de `index.html`; CSS inicial total = todas las hojas stylesheet iniciales. Archivos deduplicados por ruta y gzip individual. | `6f0b818` |
| A1-16, pruebas y documentación | Verificador importable, funciones de análisis/evaluación separadas, 11 pruebas con directorios temporales, nuevas bases con margen del 10 % y guía de rendimiento actualizada. | `6f0b818` |

Los valores históricos `date`, `commit`, `entryJsGzipBytes`, `entryCssGzipBytes`, `largestJsChunkRawBytes` y `headroomPercent` se compararon con la base y permanecen iguales. Los campos nuevos `initialDate` e `initialCommit` registran por separado la base del 2026-10-13, medida con la regla de build de `0f503a2`.

La regla usa la API vigente documentada por [Vite](https://vite.dev/guide/build#chunking-strategy) y [Rolldown](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup), contrastada con los tipos instalados de Vite 8.2.0/Rolldown. No se usa la forma obsoleta de `manualChunks` ni se agrupan todas las dependencias en un único vendor.

## Comparación del build real

Se creó y mantuvo `frontend/.env.local` ignorado, con URL/anon key del Supabase local; no se imprimieron ni versionaron claves. El build previo se conservó en un directorio temporal y se midió con la misma función `gzipSync` usada por el verificador nuevo.

| Métrica | Antes de B6 | Después de B6 | Límite |
| --- | ---: | ---: | ---: |
| JS de entrada gzip | 155.892 B | **102.511 B** | 105.567 B, existente |
| CSS de entrada gzip | 43.684 B | **43.684 B** | 47.853 B, existente |
| Chunk JS máximo sin comprimir | 533.027 B | **325.362 B** | 332.108 B, existente |
| JS inicial total gzip | 159.156 B | **158.877 B** | 174.765 B, nuevo |
| CSS inicial total gzip | 43.684 B | **43.684 B** | 48.053 B, nuevo |

El total JS inicial mejora **279 B (0,175 %)** y el CSS inicial no cambia. La caída de entry corresponde principalmente a separación de Supabase; no se presenta como una eliminación equivalente de bytes de la primera descarga. Los límites nuevos son `ceil(base medida × 1,10)`; las tres bases originales siguen atribuidas a `059172a`.

## Pruebas y cuatro verificaciones

TDD: la primera ejecución de los siete casos iniciales produjo siete fallos antes de la corrección; tras implementarla pasaron y se añadieron cuatro comprobaciones de cálculo/contrato. Vitest recoge `scripts/check-bundle-size.test.mjs` sin modificar su configuración. Usa el entorno jsdom existente porque el setup compartido necesita `HTMLDialogElement`; las operaciones Node y el build mínimo se ejecutan mediante APIs de Node/subprocesos.

Los **11 casos nuevos** cubren:

- Cinco métricas dentro de límite y preloads repetidos deduplicados.
- Crecimiento de preload aunque el entry disminuya y los límites históricos pasen.
- Crecimiento de una segunda hoja CSS aunque la hoja de entrada pase.
- Mensaje de fallo al faltar un recurso inicial.
- `strict` resuelto en app y node (dos casos).
- Build mínimo con la configuración real: Supabase precargado, página todavía dinámica.
- Bytes exactos de los archivos únicos; exclusión de un chunk lazy del total inicial.
- Límite redondeado aceptado y primer byte adicional rechazado.
- Presupuesto sin métrica inicial rechazado.
- Atributos HTML en distinto orden y con comillas simples; scripts clásicos fuera del cálculo.

Verificación final desde `frontend/`, con **Node 22.23.3**, mediante `npm exec --yes --package=node@22 -- npm run <script>`:

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run lint` | 0 | Sin errores/warnings de ESLint. |
| `npm run build` | 0 | TypeScript estricto y Vite completos. Persiste el aviso anterior sobre import dinámico/estático de `lib/dashboard.ts`; desaparece el aviso de chunk mayor de 500 KB. |
| `npm run size` | 0 | **Las cinco métricas OK**, cifras en la tabla anterior. |
| `npm run test` | 0 | **582 pruebas en 49 archivos**, todas pasan, incluidas las 11 nuevas. |

Además, `npx tsc -p tsconfig.app.json --showConfig` y su equivalente para node muestran `strict: true`; `git diff --check` pasa. No se ejecutó `test:integration`, reservado al coordinador.

## Chunks y carga por ruta

`npx vite build --manifest` confirmó 15 entradas dinámicas de dominio. `dist/index.html` sólo precarga `jsx-runtime` y `vendor-supabase`, además del entry; ninguna página de dominio entra en esos preloads.

Páginas que siguen diferidas: Administracion, Auditoria, Reportes, Ubicaciones, Despachos, Devoluciones, Stock, Produccion, Carga, Clientes, Gastos, MiComision, RankingVendedores, RegistrarVenta y Ventas. Dashboard conserva su import estático anterior.

Inventario completo de archivos JS antes/después (los hashes cambian al separar el vendor):

| Antes (28 chunks) | Después (29 chunks) |
| --- | --- |
| `Administracion-DCkTqrvo.js` | `Administracion-DaPPOuL4.js` |
| `Auditoria-Zc5IZYRa.js` | `Auditoria-CPnwxZ93.js` |
| `Carga-kWb1-ePg.js` | `Carga-CUdq1HJi.js` |
| `Clientes-BulI6U8U.js` | `Clientes-C-Ex9Gxk.js` |
| `Despachos-7hGAlsa3.js` | `Despachos-DqOyBufU.js` |
| `Devoluciones-CqoTbqSI.js` | `Devoluciones-Di92TQ2F.js` |
| `Dialog-nf0JYV38.js` | `Dialog-nf0JYV38.js` |
| `Gastos-Cw-O3dq3.js` | `Gastos-C7oFqLlk.js` |
| `MiComision-D3YVK7PW.js` | `MiComision-D3aiuY--.js` |
| `ModulePage-D6YQb5se.js` | `ModulePage-BSitlkDZ.js` |
| `Produccion-BfnBBUfU.js` | `Produccion-B_JQhL06.js` |
| `RankingVendedores-D_1GTMuF.js` | `RankingVendedores-C63BWKUc.js` |
| `RegistrarVenta-C6Z4_Llf.js` | `RegistrarVenta-CHPQuV3Q.js` |
| `Reportes-BejOvOXz.js` | `Reportes-_dF4V355.js` |
| `Stock-DRM2uJ4t.js` | `Stock-CGDWFlJV.js` |
| `SucursalSelector-8JmlgqPy.js` | `SucursalSelector-DSiaSF_g.js` |
| `Ubicaciones-BgXXGjCq.js` | `Ubicaciones-ChQRBBW8.js` |
| `Ventas-sxm39UAx.js` | `Ventas-CMMIj23Q.js` |
| `api-BCvGpr32.js` | `api-8F5DIxrK.js` |
| `api-BkP23nQJ.js` | `api-DL8ZvpQo.js` |
| `catalog-Ci4GpXKv.js` | `catalog-Tk4yifDX.js` |
| `format-CllW7trw.js` | `format-CllW7trw.js` |
| `index-BXn82Mwi.js` | `index-DzIRE9ib.js` |
| `jsx-runtime-B-hcVAMW.js` | `jsx-runtime-B-hcVAMW.js` |
| `toast-utils-5LsGkgRi.js` | `toast-utils-CCcGeUNP.js` |
| `useCargaVendedor-QPoFql8H.js` | `useCargaVendedor-DGXyYyO_.js` |
| `useClientesRuta-CwAH595w.js` | `useClientesRuta-CoBEuM5A.js` |
| `useJornadaSantiago-Cm2mBoGG.js` | `useJornadaSantiago-DUnEBmdu.js` |
| `—` | `vendor-supabase-BGbzfXBm.js` |

## Navegador y capturas

Chrome headless/Playwright sobre el `dist` de producción, servido temporalmente en `127.0.0.1:4187` con fallback SPA. Se inició sesión con la cuenta sintética de bodega y backend local. No hubo escrituras funcionales ni acceso a producción.

El preview normal (`4186`) aplica la CSP existente, que permite Supabase HTTPS y bloquea Auth hacia `http://127.0.0.1:54321`; se reprodujo ese rechazo y su alerta española. Para aislar la ejecución de los chunks con el backend local se usó un servidor temporal de archivos **sin los headers de producción**. No se modificó `preview`, `vercel.json`, headers ni CSP: esta prueba no acredita la política de producción ni un despliegue.

En la pasada final se navegó de nuevo a la vista después de fijar cada ancho, para medir el layout estable y no una transición CSS entre desktop/móvil.

| Vista | 375 px | 768 px | 1280 px |
| --- | --- | --- | --- |
| Login anónimo | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Despachos, bodega | 375 / 375 | 768 / 768 | 1280 / 1280 |

Celdas: `document.documentElement.scrollWidth / innerWidth`. Cero excepciones de página en la pasada final. El navegador descargó inicialmente sólo `jsx-runtime-B-hcVAMW.js`, `vendor-supabase-BGbzfXBm.js` e `index-DzIRE9ib.js`; al abrir Despachos descargó su chunk y sus dependencias (`format`, `Dialog`, `catalog`, `api`, `useJornadaSantiago`). Esto comprueba ejecución real del vendor y una navegación diferida, además de la evidencia del manifest.

Se conservan seis PNG de después, todos menores de 300 KB (máximo 238.575 B; el PNG grande de login se optimizó sin cambiar sus dimensiones):

- [Login 375](capturas/b6-login-anonimo-375.png), [768](capturas/b6-login-anonimo-768.png), [1280](capturas/b6-login-anonimo-1280.png).
- [Despachos 375](capturas/b6-despachos-bodega-375.png), [768](capturas/b6-despachos-bodega-768.png), [1280](capturas/b6-despachos-bodega-1280.png).

## Límites y entrega

- A1-15 y A1-16 quedan resueltos dentro del alcance solicitado; no hay hallazgos descartados ni parciales de B6.
- Las métricas iniciales cuentan los recursos locales declarados por el HTML, no costes de protocolo ni todas las descargas posteriores de la aplicación. La métrica máxima sigue contando también chunks lazy.
- La base de tamaño necesita configuración local real; un build sin ella no representa el bundle operativo. Las cifras usan gzip, no brotli ni una medición de red/Lighthouse nueva.
- El aviso sobre el import de dashboard y la CSP del preview hacia localhost son comportamientos preexistentes fuera de la propiedad de B6; no se cambian.
- No se editaron componentes, dominios, permisos, SQL, migraciones, configuración de tests, `.opencode/`, preview/headers/CSP ni presupuestos históricos. Sólo archivos de propiedad B6 y artefactos autorizados.
- Commits locales, sin push, merge, rebase de otras ramas ni PR; sin crear/cerrar issues de Beads. Los hooks de commit funcionaron y exportaron el tracker existente.
