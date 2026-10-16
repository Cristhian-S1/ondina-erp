# R3 — Revisión cruzada de B5, B4 y B7

Fecha: **2026-10-14**. Revisor: Codex. Beads/lotes: B5 shell y compartidos, B4 ventas de lectura, B7 retiro de Mantine.
Despacho: `task_b839444cffce` / `ctx_7f8a4818fad0`.
Snapshot revisado: **`14c9dd1`**, tras `git fetch origin && git reset --hard origin/feature/frontend-ux`.

## Veredicto por lote

| Lote | Veredicto | Motivo |
| --- | --- | --- |
| B5 | **Requiere corrección** | R3-02: nombre de sucursal de otro ámbito tras actualizar el perfil y fallar la lectura. R3-03 es una limitación del contrato del helper; R3-05 es deuda previa del shell. Drawer, login, EstadoVista y placeholders pasan las comprobaciones descritas. |
| B4 | **Requiere corrección** | R3-01: ranking obsoleto tras una venta durante el período fresco de caché. R3-04: recorte del histórico que no existía en el selector anterior. |
| B7 | **Aprobado dentro del alcance verificado** | Dependencias/imports retirados, build y presupuesto correctos; sin estilos rotos observados en los recorridos locales. Su prueba estática no demuestra por sí sola equivalencia visual. |

**Dos hallazgos P2 y tres P3; ninguno P0/P1.** La revisión no corrige código ni acredita producción. Los controles verdes de la suite existente conviven con una regresión adicional reproducida mediante una prueba temporal roja.

Commits revisados en la rama integrada:

- B5: `c285e2d` (fechas), `9ea468c` (contraste), `987aef7` (login/Toast/EstadoVista), `9de9617` (drawer/Próximamente/títulos), `9d46897` (lectura dinámica de sucursal).
- B4: `06327c4` (ranking/comisión), `9ee9b08` (copy por rol/estados/Clientes).
- B7: `0b77e62` (main, manifiestos y prueba de dependencias).

Se contrastaron A1-tecnico.md, A2-ux-ui.md y las entregas B5/B4/B7; sus hashes originales de worktree no siempre coinciden con los integrados por cherry-pick. La evidencia de líneas siguiente corresponde al snapshot revisado.

## Hallazgos

### R3-01 | P2 | B4 — El ranking conserva el valor anterior al volver de registrar una venta

**Evidencia:** `frontend/src/domains/ventas/hooks/useRankingVendedores.ts:23`, `frontend/src/main.tsx:16`, `frontend/src/main.tsx:18`, `frontend/src/domains/ventas/hooks/useRegistrarVenta.ts:49`, `frontend/src/domains/ventas/hooks/useRegistrarVenta.ts:51`. [Captura del ranking tras confirmar](capturas/r3-ranking-cache-vendedor-375.png).

**Problema:** B4 sustituyó la lectura en cada montaje por una consulta cuya clave es `['ventas','ranking', mes, perfilId, sucursalId, rol]`. Hereda 30 segundos de `staleTime` y `refetchOnWindowFocus: false`. El éxito de venta invalida carga, histórico y comisión, pero ninguna coincide con ranking. Volver inmediatamente al ranking muestra importe y posición anteriores, sin otra petición ni acción de actualizar. El fallo no se soluciona por el nuevo ámbito de la clave: faltó invalidar los datos derivados de la mutación.

**Reproducción:** en Chrome, sesión local real del vendedor y navegación SPA, se interceptaron exclusivamente las respuestas de clientes/carga, ranking, registro de venta y resumen para evitar escrituras en BD. El ranking respondió inicialmente `$2.000`; tras la respuesta exitosa del registro, la respuesta preparada para una nueva lectura era `$3.000`. Se recorrió Ranking → Registrar venta → confirmar → Ir a Ventas → Ranking, se esperó el montaje final con drawer cerrado y red en reposo, dentro de los 30 segundos. Resultado: **1 petición de ranking, 1 POST de registro interceptado y 1 lectura de resumen; permanecen `$2.000` y “1 venta”**. Es reproducción del comportamiento real de hooks/router/caché con respuestas sintéticas, no una venta persistida ni evidencia de cálculo SQL incorrecto.

**Corrección propuesta:** invalidar el prefijo `['ventas','ranking']` al confirmar una venta y en cualquier otra mutación existente que cambie el agregado; coordinar el cambio del hook de escritura con su propietario. Añadir una prueba de navegación con QueryClient compartido, `staleTime` real, sin esperar 30 segundos ni provocar foco: la segunda visita debe consultar/mostrar el total nuevo; una venta fallida no debe invalidar.

### R3-02 | P2 | B5 — El drawer conserva la sucursal anterior al cambiar el perfil y fallar la lectura nueva

**Evidencia:** `frontend/src/components/DashboardLayout.tsx:49`, `frontend/src/components/DashboardLayout.tsx:55`, `frontend/src/components/DashboardLayout.tsx:59`, `frontend/src/components/DashboardLayout.tsx:60`, `frontend/src/components/DashboardLayout.tsx:159`. Camino de actualización real del perfil sin desmontaje: `frontend/src/context/AuthProvider.tsx:74` y `frontend/src/context/AuthProvider.tsx:78`.

**Problema:** `sucursalNombre` guarda sólo un nombre, sin identificar a qué usuario/sucursal pertenece. El cleanup impide aplicar una respuesta tardía, pero cambiar `sucursalId` no borra ni invalida el valor ya mostrado. Si B falla, el `catch` vacío conserva A; la expresión de render prefiere ese nombre a “Sucursal asignada”. La caché de React Query se limpia cuando cambia el ámbito del perfil, pero este estado independiente queda intacto. El usuario ve una sucursal equivocada al actualizar sus permisos/ámbito. Esto es un defecto de información de contexto; no se demostró acceso a datos no autorizados.

**Reproducción:** prueba temporal fuera del repositorio que monta el `DashboardLayout` real con AuthContext y MemoryRouter. Se abre el drawer con sucursal A, se resuelve su nombre, se actualiza el mismo perfil a sucursal B y se rechaza la nueva lectura. La llamada B está comprobada; la aserción que exige retirar “Sucursal A” **falla** porque sigue en el `<p>` de sucursal. No se modificó la app ni se actualizaron perfiles de la BD para reproducirlo.

**Corrección propuesta:** almacenar el nombre junto con identidad/sucursal y renderizarlo sólo si coincide con el ámbito actual, o reutilizar una consulta con clave de ámbito. En error/cambio de sucursal, mostrar el fallback del ámbito nuevo. Mantener la protección frente a respuestas tardías y probar A→B tanto con rechazo como con respuesta demorada y éxito, incluyendo cerrar/reabrir el menú.

### R3-03 | P3 | B5 — El helper desplaza un día las fechas de calendario sin hora

**Evidencia:** `frontend/src/lib/format.ts:60`, `frontend/src/lib/format.ts:62`, `frontend/src/lib/format.ts:71`, `frontend/src/lib/format.ts:77`; cobertura actual en `frontend/src/lib/format.test.ts:85`.

**Problema:** ambos helpers aceptan `string` y pasan `AAAA-MM-DD` a `new Date`, que representa medianoche UTC. Al formatear ese instante en Santiago, una fecha de calendario pasa al día anterior. Ejemplos ejecutados contra la función real en Node y Chrome:

| Entrada | `fmtFecha` actual | `fmtFechaHora` actual |
| --- | --- | --- |
| `2026-01-15` | `14-01-2026` | `14-01-2026 21:00` |
| `2026-07-15` | `14-07-2026` | `14-07-2026 20:00` |

No se encontró dentro de las vistas revisadas un consumidor que hoy pase una fecha sólo-día a estos helpers: Clientes pasa `creado_en`, e Indicadores pasa objetos Date. Por eso se clasifica como **P3 de contrato compartido**, sin afirmar una fecha actualmente incorrecta en esas pantallas.

**Corrección propuesta:** distinguir una fecha civil de un timestamp. `fmtFecha` debe validar y preservar los componentes de `AAAA-MM-DD`; para `fmtFechaHora`, definir si se rechaza una fecha sin hora o se exige un instante explícito. No sustituir Santiago por la zona del navegador ni aplicar un offset fijo. Probar fechas civiles de verano/invierno y años bisiestos, manteniendo los casos de timestamps/DST.

### R3-04 | P3 | B4 — El reemplazo del picker recorta el histórico a cuatro años calendario

**Evidencia:** `frontend/src/domains/ventas/pages/RankingVendedores.tsx:12`, `frontend/src/domains/ventas/pages/RankingVendedores.tsx:24`, `frontend/src/domains/ventas/pages/RankingVendedores.tsx:67`. Comparación: versión anterior a `06327c4`, `MonthPickerInput` con `maxDate` y sin `minDate`. La entrega B4 reconoce el límite; HU-08 en `docs/product/stories/sales.md:103` no fija esa restricción.

**Problema:** con la fecha local de revisión se ofrecen únicamente 2026, 2025, 2024 y 2023. No es posible seleccionar diciembre de 2022, aunque el selector anterior permitía períodos históricos anteriores. No se observó un registro local de 2022 ocultado; el defecto confirmado es el recorte de navegación y su efecto futuro al conservar datos durante más años, no pérdida de filas.

**Corrección propuesta:** preservar el rango histórico anterior al retirar Mantine, por ejemplo con un control nativo de mes que limite sólo el máximo al mes actual o una selección de año que permita el histórico completo. Si se desea una política de retención/rango, obtener una decisión explícita de producto. Probar cambio a un año anterior al límite actual y el ajuste diciembre→año actual, donde sí corresponde impedir un mes futuro.

### R3-05 | P3 | Shell — “Cerrar sesión” pierde su nombre accesible al colapsar en escritorio (preexistente)

**Evidencia:** `frontend/src/components/DashboardLayout.tsx:201`, `frontend/src/components/DashboardLayout.tsx:208`, `frontend/src/components/DashboardLayout.tsx:209`. El mismo patrón ya está en `9de9617^:frontend/src/components/DashboardLayout.tsx:129` y `:137`.

**Problema:** a 1280 px, al colapsar a 64 px, se oculta con `lg:hidden` el único texto del botón; su icono no aporta nombre y el botón no tiene `aria-label`/title. Chrome confirma **0 botones con nombre accesible “Cerrar sesión”** en ese estado. Los enlaces del menú sí reciben `title` al colapsar. No se imputa este defecto a B5 ni a la retirada de Mantine: es deuda previa en el mismo shell revisado.

**Corrección propuesta:** añadir un nombre accesible permanente al botón, conservando el texto visible cuando esté expandido. Probar en un navegador con CSS aplicado o usar un nombre explícito comprobable en DOM; jsdom no reproduce por sí solo el efecto de `lg:hidden`.

## Comprobaciones satisfactorias y límites de las pruebas existentes

- **Drawer móvil:** comprobados en Chrome, vendedor/admin a 375 y 768: diálogo con nombre, fondo inerte, ciclo real con Tab y Shift+Tab, Escape y restauración al botón. Redimensionar abierto a 1280 retira diálogo/inert y devuelve foco; al volver a móvil se reabre por conservar `mobileOpen`. No produjo bloqueo de foco; esa política no se eleva a defecto sin requisito de cierre al cruzar el breakpoint. Las pruebas existentes de DashboardLayout ejercitan los handlers, pero fijan `matchMedia.matches=false` y no simulan el resize ni el cambio de sucursal, por lo que no detectan R3-02.
- **Login:** error real de contraseña local incorrecta con `role=alert`, texto seguro y asociación a campos; controles de al menos 44 px, cambio de visibilidad con `aria-pressed`, segundo intento y entrada correcta. Se revisaron 375/768/1280. Su prueba de altura verifica clases, no geometría; la geometría se comprobó en Chrome.
- **EstadoVista:** estados y acciones funcionan en DOM; reintento invoca el callback y no implica una mutación. El componente es de presentación y depende del mensaje seguro que entregue su consumidor. No se encontró en las vistas revisadas un uso que filtre texto técnico al usuario.
- **Ranking:** el mes de Santiago se calcula con `formatToParts`, sin UTC; meses futuros se deshabilitan y `cambiar` ajusta el mes al volver al año actual. La clave incluye mes, identidad, sucursal y rol; no es un mecanismo de autorización. Roles de rutas/menu siguen siendo vendedor/administrador. Las pruebas ejercitan carga/error/reintento, mes y fila propia; el test del hook sólo verifica una clave y un refetch, sin cambiar identidad/rol/sucursal y sin visitar otra pantalla. El test de nombre largo comprueba la clase `truncate`, no su anchura real.
- **Mi comisión:** conserva título en carga/error, etiquetas Agua/Hielo, nombres de jornada sin `capitalize` global y lecturas concurrentes. Se observó con datos sintéticos locales una venta y base $2.000, sin regla de comisión; mostró $0 y “Sin definir”. La invalidación de comisión ya está en B3 integrado. No se usó esta observación para auditar la fórmula SQL.
- **Copy/Clientes:** vendedor y admin muestran el copy distinto en Ventas/Carga/Clientes. La selección de sucursal/vendedor de admin sigue siendo requisito para leer su cartera y crear clientes; el botón inicial está deshabilitado hasta completarla. Se observó cliente local con datos, tarjeta a 375 y tabla a 768/1280. El estado “Próximamente” de Reportes conserva título y regreso al inicio.
- **Fechas/DST:** los timestamps se formatean con la zona IANA correcta, sin offset manual. Se comprobaron el retroceso `2026-04-05T02:59Z → 04-04 23:59` / `03:00Z → 04-04 23:00` y el salto `2026-09-06T03:59Z → 05-09 23:59` / `04:00Z → 06-09 01:00`. El defecto de fecha civil R3-03 es independiente del DST.
- **Import dinámico de dashboard:** persiste la advertencia `INEFFECTIVE_DYNAMIC_IMPORT`, consistente con `DashboardLayout.tsx:57` y el import estático en `pages/Dashboard.tsx:3` (la página es eager en `App.tsx:5`). Ese import no separa un chunk y la lectura del drawer tampoco reutiliza la consulta `dashboard-sucursal`. Es una observación de rendimiento conocida, no una nueva regresión B7 ni prueba de que el cliente Supabase esté diferido en el bundle.
- **B7/tests:** `package.json` y lock no contienen las cuatro dependencias retiradas. `sin-mantine.test.ts:14` hace un escaneo textual de .ts/.tsx/.css bajo src; detecta referencias, incluyendo comentarios, pero no estilos ni comportamiento real y no comprueba el manifiesto/lock. Se complementó con build, búsqueda en manifiestos y navegador. No se detectaron estilos rotos en las vistas observadas; no se afirma equivalencia visual en todos los sistemas operativos.

## Verificación fresca del snapshot

Ejecutada desde `frontend/`, `.env.local` ignorado con Supabase `http://127.0.0.1:54321` y su anon key local; cuentas `ux-*@example.invalid`. No se modificaron archivos de aplicación, SQL, datos/perfiles de la BD ni configuración versionada.

| Control | Resultado |
| --- | --- |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0; advertencia conocida de import dinámico de dashboard. |
| `npm run size` | Exit 0, 5 métricas OK. |
| `npm run test` | Exit 0; **650 pruebas / 52 archivos**. |
| Prueba temporal adicional de sucursal | **1 prueba falla como se esperaba**, exponiendo R3-02; fuera del repositorio y de la suite anterior. |

Tamaños actuales en las unidades impresas por `size`: JS entrada gzip **94.793** (presupuesto 105.567), CSS entrada **7.046** (47.853), mayor chunk JS **298.407** (332.108), JS inicial total **151.439** (174.765), CSS inicial total **7.046** (48.053). No se subieron presupuestos.

Chrome headless/Playwright, Vite local en 5184, altura 850 px: **27 combinaciones** — login anónimo; inicio/ranking/clientes/mi comisión como vendedor; inicio/ranking/clientes/reportes como admin; cada una en 375/768/1280. Todas con `scrollWidth === innerWidth`; cero errores JavaScript de página observados en esa matriz. El drawer abierto estable también mide 375/375. Se revisaron capturas temporales de esas pantallas y se conservan sólo cuatro, menores a 300 KB:

- [Login con error, anónimo 375](capturas/r3-login-error-anon-375.png).
- [Inicio con drawer estable, admin 375](capturas/r3-drawer-admin-375.png).
- [Ranking con caché obsoleta, vendedor 375](capturas/r3-ranking-cache-vendedor-375.png).
- [Reportes, admin 1280](capturas/r3-reportes-admin-1280.png).

Los scripts temporales de revisión viven bajo `/tmp/ondina-b3-browser/r3-*` y las salidas en `/tmp/r3-*`; son evidencia auxiliar de esta sesión, no un mecanismo durable de pruebas. Para corregir, convertir las reproducciones descritas en regresiones versionadas por el implementador.

No se ejecutó `test:integration`, no se probó producción, no se usaron datos reales y no se verificó lector de pantalla/dispositivo físico/Safari. La matriz visual usa Auth y lecturas locales reales; la reproducción controlada del ranking intercepta respuestas y no acredita el agregado SQL. No se hicieron push/merge/PR ni correcciones de código.
