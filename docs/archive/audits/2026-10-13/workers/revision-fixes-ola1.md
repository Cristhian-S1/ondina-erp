# W6 — Revisión de seguridad del diff integrado de la ola 1

## Resumen

- **Fecha:** 2026-10-13, America/Santiago.
- **Tarea:** OND-42q.6; Orca `task_8f81c6755489`, dispatch `ctx_c264275082cb`.
- **Rama de revisión:** `Cristhian-S1/fix-w6-revision`.
- **Base y extremo revisados:** `8e13d32..758eeff9dbf642225a6aa9aee6ec684382768969` (W1 sesión/guards/borradores, W2 datos/lazy/a11y y W3 CI/CD; 46 archivos).
- **Método:** diff, código actual y dependencias instaladas; reproducciones locales con Node, React/jsdom y Supabase simulado; ninguna consulta a Supabase/Vercel ni navegador de producción. No existe `.codegraph/` en este worktree.
- **Resultado:** dos bloqueadores de aceptación confirmados, REV-1 y REV-2. El guard de rol todavía se evade con letras codificadas y la identidad anterior sigue expuesta hasta el temporizador de sesión. REV-3 a REV-6 son límites y seguimientos que deben conservarse; no equivalen a una vulneración remota demostrada.
- **Regresión automatizada:** `npm run lint`, `npm run build` y `npm run test`, ejecutados una sola vez cada uno desde `frontend/`, terminaron con **exit 0**; **185/185 pruebas, 23/23 archivos**. Las pruebas existentes no cubren los dos bloqueadores reproducidos.

La revisión cumple su alcance de solo lectura: el único archivo versionado que se añade es este informe. No se corrigen los hallazgos ni se escriben trackers, configuración remota, datos o migraciones.

## Hallazgos

### REV-1 — El guard de rol no usa la misma decodificación que el router

- **Severidad:** media; evasión de autorización de interfaz, sin prueba de evasión de RLS/RPC.
- **Evidencia:** `frontend/src/components/DashboardLayout.tsx:43-45` compara `useLocation().pathname` mediante `matchPath` y permite continuar si no encuentra elemento de navegación. `frontend/src/App.tsx:12-18` protege sesión, pero no entrega `roles` a `ProtectedRoute`. `/stock` admite solo bodega/administrador en `frontend/src/domains/bodega/index.tsx:26`.
- **Reproducción:** React Router **7.18.2**, instalado en este worktree, resuelve `matchRoutes([{path:'/stock'}], '/%73tock')` hacia `/stock`, mientras que `matchPath({path:'/stock',end:true,caseSensitive:false}, '/%73tock')` devuelve `null`. Un montaje local del **DashboardLayout actual**, con MemoryRouter, perfil vendedor y navegación/rutas simuladas, mostró `HOME_ALLOWED` para `/stock`, `/STOCK`, `/stock/`, pero **`STOCK_RESTRICTED` para `/%73tock`**. También discrepan `/sto%63k`, `/ventas/%72egistrar` y `/%61dministracion`.
- **Consecuencia:** un usuario autenticado con otro rol puede montar una página restringida y disparar sus lecturas. La carga diferida conserva este mismo guard y, por tanto, conserva la evasión. No se infiere acceso efectivo a filas o escrituras de base de datos.
- **Recomendación:** asociar los roles al objeto de ruta efectivamente resuelto y hacer que el guard use esa misma resolución/decodificación, o colocar una restricción explícita de roles en cada ruta. Evitar depender de que una comparación independiente encuentre un enlace de menú. Añadir pruebas por rol con segmentos codificados y las variantes de la matriz siguiente.
- **¿Bloquea integración?: Sí**, para aceptar como corregido SEG-09 / FE-01 / #36 / OND-82e.

Matriz local con `new URL('http://local.test' + raw).pathname` seguida de **las dos funciones del router instalado**; «ninguna» indica que no se resuelve esa ruta restringida:

| Entrada | Pathname normalizado por URL | Guard `matchPath` | Ruta `matchRoutes` | Resultado |
| --- | --- | --- | --- | --- |
| `/stock` | `/stock` | `/stock` | `/stock` | Coherente |
| `/STOCK` | `/STOCK` | `/stock` | `/stock` | Coherente, sin sensibilidad a mayúsculas |
| `/stock/` | `/stock/` | `/stock` | `/stock` | Coherente |
| `/stock//` | `/stock//` | `/stock` | `/stock` | Coherente |
| `//stock` | `//stock` | ninguna | ninguna | No evade esta ruta |
| `/stock/..` | `/` | ninguna de las restringidas | ninguna de las restringidas | Inicio |
| `/x/../stock` | `/stock` | `/stock` | `/stock` | Coherente tras normalizar |
| `/%2e%2e/stock` | `/stock` | `/stock` | `/stock` | Coherente tras normalizar |
| `/stock ` | `/stock` | `/stock` | `/stock` | URL elimina el espacio final literal |
| `/stock%20` | `/stock%20` | ninguna | ninguna | No evade esta ruta |
| `/stock%2F` | `/stock%2F` | ninguna | ninguna | No evade esta ruta |
| `/%2Fstock` | `/%2Fstock` | ninguna | ninguna | No evade esta ruta |
| `/ventas%2Fregistrar` | `/ventas%2Fregistrar` | ninguna | ninguna | No evade esta ruta |
| `/%73tock` | `/%73tock` | ninguna | `/stock` | **Evasión** |
| `/sto%63k` | `/sto%63k` | ninguna | `/stock` | **Evasión** |
| `/ventas/%72egistrar` | `/ventas/%72egistrar` | ninguna | `/ventas/registrar` | **Evasión** |
| `/%61dministracion` | `/%61dministracion` | ninguna | `/administracion` | **Evasión** |

Comando mínimo reproducible desde `frontend/`, sin red:

```sh
node --input-type=module <<'JS'
import { matchPath, matchRoutes } from './node_modules/react-router/dist/development/index.mjs'
for (const path of ['/stock', '/STOCK', '/stock/', '/%73tock', '/stock%2F']) {
  console.log(path,
    Boolean(matchPath({ path: '/stock', end: true, caseSensitive: false }, path)),
    matchRoutes([{ path: '/stock' }], path)?.at(-1)?.route.path ?? null)
}
JS
```

### REV-2 — La identidad anterior permanece visible hasta el temporizador

- **Severidad:** alta; incumplimiento del aislamiento visual y del estado local durante el cambio de identidad.
- **Evidencia:** `frontend/src/context/AuthProvider.tsx:71-80` invalida la versión de las consultas, pero difiere **toda** la transición mediante `setTimeout(0)`. `perfil=null`, `loading`, limpieza de QueryClient y borrador solo se ejecutan dentro de `loadSession`, en `AuthProvider.tsx:31-41`. `ProtectedRoute.tsx:12-22` sigue entregando el Outlet mientras conserva el perfil anterior y `loading=false`.
- **Reproducción:** se transpilaron en memoria el AuthProvider actual y sus imports, se montó con React/jsdom y un QueryClient real y se simuló A→B. Se retuvo únicamente el callback del temporizador para observar la frontera de forma determinista; no se alteró el archivo. Tras `SIGNED_IN(B)` y antes del timer, el DOM aún contenía `{"id":"user-A","activo":true,"loading":false}`, `getQueryData(['private'])` devolvía `A private data` y la clave del borrador A conservaba `A draft`. Después del timer, el DOM pasó a B, la caché quedó `undefined` y el borrador A quedó `null`.
- **Consecuencia:** el cambio de sesión no cierra inmediatamente las pantallas/controles del usuario anterior. La ventana dura hasta el siguiente timer, no hasta terminar la consulta de perfil. Es una exposición local confirmada; no se ha demostrado que una mutación aproveche esa ventana ni que el servidor la autorice.
- **Recomendación:** invalidar perfil y estado de presentación y limpiar datos de la identidad anterior al recibir el evento diferente; diferir únicamente la consulta a Supabase para no ejecutarla dentro de su callback de Auth. Preservar el camino rápido para la misma identidad ya cargada. Probar explícitamente la frontera **antes** de ejecutar timers, partiendo de un perfil ya cargado y con datos privados.
- **¿Bloquea integración?: Sí**, por el requisito explícito de que no pueda renderizarse información del usuario anterior. La prueba actual `AuthProvider.test.tsx:147-159` comprueba el estado después de arrancar la segunda consulta; `AuthProvider.test.tsx:161-177` parte de una primera consulta todavía pendiente, por lo que no detectan este caso.

### REV-3 — `activo` se comprueba al cargar, pero no se revalida en una sesión ya cargada

- **Severidad:** media; vigencia del perfil y sus permisos en el cliente.
- **Evidencia:** `frontend/src/context/AuthProvider.tsx:56-60` sí rechaza un perfil recibido con `activo=false`. Sin embargo, `AuthProvider.tsx:77` retorna para cualquier evento de la misma identidad ya cargada, sin distinguir `TOKEN_REFRESHED`, `USER_UPDATED` o `SIGNED_IN`; `ProtectedRoute.tsx:19-20` solo usa perfil/rol, no una comprobación remota de actividad.
- **Reproducción:** en el montaje local anterior se cambió la respuesta simulada del perfil B a `activo=false`; se emitieron los tres eventos para B y se esperó después de cada uno. El DOM permaneció `{"id":"user-B","activo":true,"loading":false}` y el contador de consultas de perfil permaneció en **2**, correspondiente a las cargas iniciales A y B.
- **Consecuencia:** una cuenta desactivada después de iniciar sesión puede continuar usando la interfaz con el perfil anterior. Esto no prueba que el backend acepte sus operaciones. Lo mismo requiere atención para cambios remotos de rol/sucursal.
- **Recomendación:** revalidar perfil en segundo plano mediante una política explícita de frescura/invalidez, manteniendo montados los formularios mientras el perfil sigue siendo válido. Si la revalidación confirma inactividad/cambio de identidad, cerrar acceso y limpiar datos; exigir también control efectivo en el servidor.
- **¿Bloquea integración?: No** para el rechazo inicial implementado por W1; **sí impide afirmar la garantía absoluta** «una cuenta inactiva no puede usar la app» durante toda la sesión. Conservar como seguimiento de #36 / OND-82e y de autorización backend.

### REV-4 — El contrato de errores seguros sigue incompleto fuera de las lecturas corregidas

- **Severidad:** media; exposición de nombres de funciones, relaciones o restricciones a la interfaz.
- **Evidencia:** `frontend/src/domains/ventas/api.ts:148-159,173-174` traduce cuatro casos conocidos, pero retorna el mensaje original para otros errores de `registrar_venta`; `RegistrarVenta.tsx:248-253` lo muestra. `ventas/api.ts:56,144` retorna mensajes crudos de clientes/gastos, mostrados en `RegistrarCliente.tsx:64-73` y `Gastos.tsx:39-48`. `frontend/src/lib/errors.ts:20-27` conserva mensajes desconocidos y `P0001`, y lo usa bodega (`bodega/api.ts:158,175,188,206`). En producción hay errores lanzados con `error.message` (`produccion/api.ts:31,44,62,78,91`) y sus componentes muestran `cause.message` (`HistorialProduccion.tsx:29,65`; `IndicadoresProduccion.tsx:39,49`).
- **Reproducción:** `registrarVenta` actual, transpilado en memoria con `rpc` simulado, recibió `Could not find the function public.registrar_venta(p_cliente_id) in the schema cache` y devolvió **ese mismo texto** en `error`, que el formulario lleva al Toast. No hubo consulta al servidor.
- **Consecuencia:** W2 protege correctamente sus nuevas lecturas genéricas, pero no establece un contrato global de mensajes seguros. Los caminos indicados son preexistentes, no una fuga nueva atribuible a los nuevos `throw` de W2. No se encontraron `console.error` nuevos con el objeto de perfil/Supabase; el antiguo log del perfil fue retirado.
- **Recomendación:** definir un catálogo de mensajes públicos con fallback genérico para errores desconocidos; permitir únicamente mensajes de negocio expresamente reconocidos. Probar errores de caché de esquema/funciones/restricciones y comprobar que la interfaz no muestra el texto crudo. Mantener los campos al fallar.
- **¿Bloquea integración?: No**, como deuda preexistente fuera del saneamiento de lecturas de W2; **impide dar por cumplido el contrato global de errores solicitado**. No usar el resultado de este informe para cerrar toda exposición de errores.

### REV-5 — Los triggers excluyen PR, pero no identifican al repositorio autorizado

- **Severidad:** baja; endurecimiento de ejecución en forks, sin exposición confirmada de secretos.
- **Evidencia:** `.github/workflows/ci.yml:3-7,84-85` deja desplegar solo en `push` a `refs/heads/develop`, pero no exige `github.repository == 'Cristhian-S1/ondina-erp'`. `deploy-prod.yml:3-12` y `deploy-develop.yml:8-15` tampoco tienen ese guard. El remoto local identifica `Cristhian-S1/ondina-erp`; no se consultó configuración remota.
- **Consecuencia:** el YAML no habilita deploys por `pull_request` ni `pull_request_target`, pero una copia en un fork con Actions habilitado satisface la expresión en su propio push a develop. Los secretos del repositorio original no se trasladan por ello; sin secretos propios válidos el deploy fallará. No se observó ni se inició ejecución en forks.
- **Recomendación:** añadir una condición de repositorio canónico a los jobs/workflows que publican, además de evento/ref, y documentar las protecciones de environments por separado.
- **¿Bloquea integración?: No** por ausencia de una vía demostrada hacia credenciales del upstream, pero la afirmación literal «el job no puede ejecutarse en forks» **no queda satisfecha por este YAML**.

### REV-6 — El redespliegue manual de producción puede verificar y publicar commits distintos

- **Severidad:** media; integridad de la publicación manual.
- **Evidencia:** `.github/workflows/deploy-prod.yml:8-12` permite rama/tag y usa `main` como valor predeterminado; los jobs `verify` y `deploy` hacen checkouts independientes del mismo texto mutable (`deploy-prod.yml:35,71`) y el deploy espera a verify/environment (`deploy-prod.yml:61,64-66`).
- **Escenario verificable por lectura:** se lanza un dispatch con `ref=main`; verify resuelve el commit A, la rama avanza a B mientras espera deploy/aprobación, y el segundo checkout puede resolver B. El nombre del environment por sí solo no fija un SHA ni prueba que existan revisores. No se ejecutó este escenario en Actions ni se consultaron reglas remotas.
- **Consecuencia:** no puede garantizarse que lint/build/test correspondan al código publicado por el camino manual. El push automático sin input usa `github.sha` y no tiene este problema.
- **Recomendación:** resolver una sola vez la ref solicitada a un SHA, exponer ese SHA como output del job de verificación y usarlo en el checkout de deploy; incluirlo en la aprobación/evidencia de release. Como alternativa, exigir SHA completo en el dispatch.
- **¿Bloquea integración?: No** para el push automático revisado; **resolver antes de confiar en el nuevo rollback/redespliegue manual de producción**.

## Verificaciones OK

### Sesión, logout y conservación de formularios

- La restauración espera el perfil y descarta respuestas antiguas mediante versión/flag de actividad (`AuthProvider.tsx:31-68,83-100`). Las pruebas de perfil pendiente, perfil ausente, respuesta tardía y getSession superado pasan. REV-2 delimita la ventana que estas pruebas no cubren.
- Un perfil **cargado** con `activo=false` se rechaza con mensaje español (`AuthProvider.tsx:56-57`; prueba `AuthProvider.test.tsx:62-66`). REV-3 delimita la revocación posterior.
- Después de ejecutar la transición de identidad se limpia QueryClient y la clave heredada/del usuario saliente (`AuthProvider.tsx:7-14,34-36`); la reproducción A→B verificó ambos borrados. QueryClient.clear no debe interpretarse como una revocación de permisos del servidor.
- Borrador por usuario, validación de su estructura y remonte del formulario por identidad (`RegistrarVenta.tsx:35,52-73,117-126`). Las siete pruebas de borrador pasan, incluida la eliminación tras éxito y defaults frescos al remontar. No se restaura el borrador de otro usuario.
- Para la misma identidad ya cargada, el camino rápido no modifica perfil/loading y conserva los formularios montados (`AuthProvider.tsx:77`; tres casos en `AuthProvider.test.tsx:120-135`). El refresco de token no desmonta el formulario; la recomendación de REV-3 debe conservar este comportamiento.
- Logout fallido no vacía perfil/caché/borrador y muestra un mensaje genérico; el botón absorbe la promesa rechazada (`AuthProvider.tsx:109-116`; `DashboardLayout.tsx:114`). Logout correcto limpia datos y perfil (`AuthProvider.tsx:117-123`). Ambas pruebas pasan. El proveedor no registra el error crudo; repropagar `cause` no produjo una fuga en el consumidor actual, que lo captura.
- Los nuevos fallos de lectura en ventas/bodega/catálogo lanzan mensajes españoles constantes (`ventas/api.ts:26,72,86,99,118`; `bodega/api.ts:53-144`; `lib/catalog.ts:10,21,32`). Los formularios mantienen sus valores al fallar la mutación: venta resetea solo con `res.id` (`RegistrarVenta.tsx:239-253`), gastos después del retorno por error (`Gastos.tsx:39-48`) y producción/merma después del retorno por mensaje (`Produccion.tsx:126-130,161-172`). Las pruebas de fallo que preservan datos pasan; REV-4 limita el saneamiento de los mensajes.

### Actions, secretos y concurrencia

Las consultas autorizadas, de solo lectura, terminaron con exit 0 y devolvieron objetos de tipo **commit**; no fue necesario desreferenciar tags anotados:

| Comando | SHA devuelto | SHA del YAML | Resultado |
| --- | --- | --- | --- |
| `gh api repos/actions/checkout/git/ref/tags/v4.4.0` | `11d5960a326750d5838078e36cf38b85af677262` | El mismo | Coincide |
| `gh api repos/actions/setup-node/git/ref/tags/v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | El mismo | Coincide |

Referencias primarias: [checkout v4.4.0](https://api.github.com/repos/actions/checkout/git/refs/tags/v4.4.0) y [setup-node v4.4.0](https://api.github.com/repos/actions/setup-node/git/refs/tags/v4.4.0). Las apariciones de `uses` en los tres workflows usan esos SHA completos; Vercel CLI usa `63.1.2` en lugar de `latest` (`ci.yml:107`, `deploy-develop.yml:45`, `deploy-prod.yml:74`).

- Un PR no ejecuta el deploy automático: `ci.yml:84-85` exige éxito de build/migrations-check y evento push/develop; los otros workflows no escuchan PR. REV-5 separa esto de la ejecución en forks.
- Las referencias a `secrets.VERCEL_*` están únicamente en el `env` del paso de deploy (`ci.yml:111-114`; `deploy-develop.yml:49-52`; `deploy-prod.yml:78-81`). No se pasan a build/test/migrations-check; no se interpolan directamente dentro del script shell. Permisos declarados de GitHub: `contents: read`. Esto verifica el uso declarado, no el almacenamiento/alcance real de los secretos en GitHub.
- `cancel-in-progress:true` existe solo en jobs de build/migrations-check de CI (`ci.yml:19-21,53-55`). El job automático de deploy usa su grupo con **false** (`ci.yml:90-92`), los workflows manual/prod también usan **false** (`deploy-develop.yml:20-22`; `deploy-prod.yml:17-19`). Un nuevo push puede cancelar validaciones, pero esa configuración no cancela un deploy ya en ejecución. No garantiza ausencia de cancelación manual o por timeout.
- Los grupos automático y manual de desarrollo son diferentes (`deploy-develop` frente a `deploy-dev-${{ github.workflow }}`); no serializan entre sí. Esto deja posible solapamiento, aunque no cancela un deploy en vuelo. No se ejercitó una carrera remota.
- YAML de los tres workflows parseado con PyYAML `BaseLoader`; `frontend/vercel.json` parseado con JSON. No se sustituyó el parser por una ejecución de Actions.

### Headers, dist y carga diferida

- El build local produjo **27 chunks JS**. Entrada: `index-DRvG2Lip.js`, **301,77 kB / 96,74 kB gzip**; chunks separados para RegistrarVenta, Stock, Produccion, RankingVendedores y demás páginas. CSS principal: **290,06 kB / 43,34 kB gzip**. No hubo advertencia de chunk superior a 500 kB.
- `frontend/dist/index.html:5,8-10` apunta al favicon, JS de entrada, modulepreload de Supabase y CSS mediante URLs del mismo origen; se comprobó que los cuatro archivos existen. Los imports de páginas se generan como assets locales. No hay script inline en ese HTML ni una CDN necesaria para esas referencias.
- `frontend/vercel.json:16` declara **Content-Security-Policy-Report-Only**: no bloquea recursos por CSP. Además, `script-src 'self'`, estilos `'self' 'unsafe-inline'`, imágenes/fuentes `'self' data:` son compatibles con los assets locales observados; `connect-src 'self' https://*.supabase.co wss://*.supabase.co` contempla REST/Auth por HTTPS y Realtime por WSS de los dominios estándar de Supabase. `Produccion.tsx:85-108` usa Realtime. No se necesita `unsafe-eval` para los módulos estáticos observados. No se ha verificado un dominio Supabase personalizado ni la CSP de un despliegue real.
- `nosniff`, Referrer-Policy y X-Frame-Options no alteran esas URLs de assets o las conexiones REST/Auth/WSS. La compatibilidad de `nosniff` depende de que el host entregue MIME correcto, no comprobado remotamente. `DENY` impide embeber la app en un iframe, sin afectar el uso superior normal. La política solo reporta CSP y no incluye un endpoint de recolección; no prueba observabilidad ni enforcement.
- **HU-16 futura:** `frontend/vercel.json:14` impone `geolocation=()`, que sí deshabilita la API de geolocalización aunque la CSP sea Report-Only. Hoy Ubicaciones es placeholder (`docs/status/user-stories.md:30`); el monitoreo GPS está previsto en `docs/product/stories/administration.md:81-91`. Revisar esa directiva al implementar captura de ubicación en el dispositivo, preservando permisos del usuario y las restricciones por rol. No es una regresión de una función GPS actualmente implementada.
- Todos los elementos de dominio siguen anidados bajo `ProtectedRoute` y `DashboardLayout` (`App.tsx:12-20`). Los Suspense se colocan **dentro de cada elemento de ruta** (`ventas/index.tsx:68-75`, `bodega/index.tsx:28-31`, y equivalentes producción/administración), de modo que esperar un chunk no crea una ruta paralela sin sesión ni retira los guards superiores. La importación lazy no es autorización de datos. REV-1 afecta al guard existente, no a una nueva vía creada por Suspense.

### Regresiones ejecutadas

| Comando desde `frontend/` | Exit | Resultado |
| --- | --- | --- |
| `npm run lint` | 0 | ESLint sin errores |
| `npm run build` | 0 | TypeScript + Vite 8.2.0; 1152 módulos; assets/chunks generados |
| `npm run test` | 0 | Vitest 2.1.9; 185 pruebas, 23 archivos; duración 2,82 s |

Se esperó/verificó previamente `frontend/node_modules/.package-lock.json`; no se ejecutó npm install/ci. Los logs completos de esta ejecución están en `/tmp/w6-lint.log`, `/tmp/w6-build.log`, `/tmp/w6-test.log` del entorno de revisión y son temporales. Las reproducciones adicionales fueron scripts Node por stdin, sin añadir archivos de pruebas ni ejecutar una segunda vez la suite.

## Límites

- No hubo consultas a Supabase/Vercel, despliegues, push, modificaciones de GitHub/Beads, SQL ni navegador contra producción. Solo se consultaron por `gh api` los dos tags públicos de actions autorizados.
- No se verificaron RLS/RPC efectivos, revocación de tokens, Auth/Storage remotos, políticas de branch/environment, origen real de secretos ni la integración Git de Vercel. El informe no acredita seguridad o disponibilidad de producción y no cierra los hallazgos de backend ni los controles remotos de CI-01/CI-02 del audit de base.
- Los errores se simularon; el mensaje PostgREST demuestra propagación en el cliente, no la existencia de un error de esquema en el servidor actual. Las reproducciones React/jsdom usan el componente actual transpilado con dependencias locales y dobles de Auth/navegación; no son un E2E de navegador.
- La matriz usa normalización WHATWG URL y el router instalado; no se atribuye al browser una normalización distinta observada en producción. `%2F`, dobles barras, `..` y espacios se verificaron sin hallar evasión en esos casos concretos; las letras codificadas sí la reproducen.
- El build permite inspeccionar recursos y estructura, pero no demuestra una configuración de entorno Supabase funcional en ejecución ni las cabeceras realmente servidas por Vercel. No se añadieron credenciales al build o al informe.
- Las guías/status pueden conservar texto anterior a la ola, por ejemplo `docs/engineering/deployment.md` describe el trigger previo de develop y `docs/status/user-stories.md` mantiene la carrera de restauración. Se usaron el diff y el código como evidencia actual, sin modificar esos documentos fuera de propiedad.
- Solo este informe se incluye en el commit de revisión; se omiten los hooks de Beads al comprometerlo para cumplir la prohibición de escrituras en `.beads/`. Los artefactos de build permanecen ignorados. La integración y cualquier corrección de REV-1/REV-2 corresponden al coordinador/implementadores autorizados.
