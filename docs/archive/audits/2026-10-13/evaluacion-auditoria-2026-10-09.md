# Evaluación de la auditoría 2026-10-09, área por área

> Fecha de evaluación: 13-10-2026 (America/Santiago). Base revisada: `develop` = `origin/develop` en `a0a8f65`. Beads: OND-c2z. Orca: run `run_af5dd59a6889`.
> Documento evaluado: [auditoría integral 2026-10-09](../2026-10-09/auditoria-integral-2026-10-09.md), con su [informe inicial](../2026-10-09/auditoria-inicial-2026-10-09.md) como antecedente.
> Evidencia detallada por área: [informes de workers](workers/README.md). Auditoría nueva consolidada: [auditoria-profunda-2026-10-13.md](auditoria-profunda-2026-10-13.md).

## Cómo leer los veredictos

| Veredicto | Significado |
| --- | --- |
| **Confirmada** | Sigue siendo cierta en el código, la configuración o la API de GitHub consultados el 13-10. |
| **Refutada** | El código actual la contradice. |
| **Desactualizada** | Fue cierta el 09-10, pero los cambios posteriores (sobre todo documentación) la dejaron sin efecto. |
| **Parcial** | Una parte se sostiene y otra no, o requiere una precisión importante. |
| **No verificable** | Depende del catálogo remoto de Supabase, de paneles de Vercel o de una prueba de navegador. Esta evaluación no tuvo ese acceso. Se conserva como evidencia fechada del 09-10, no como estado actual. |

**Hallazgo de fondo.** La auditoría del 09-10 mezcló dos fuentes sin separarlas: el **catálogo remoto** de Supabase y el **código del repositorio**. Varias "carencias" que describió (vistas ausentes, auditoría solo en `despacho_envases`, mermas sin reversión, RLS de producción sin sucursal) son del catálogo remoto. **Las migraciones 0001–0010 sí definen esos objetos.** El desfase entre repositorio y producción es, por tanto, mayor y de otra naturaleza que la descrita: el repo pretende más de lo que existe en producción, y además no se puede instalar desde cero porque 0007 falla. La nueva redacción debe distinguir siempre "estado remoto observado el 09-10" de "estado definido por las migraciones".

## Errores de trazabilidad (tracker)

| Ubicación en el documento | Error | Corrección |
| --- | --- | --- |
| §4, encabezado S-02 (línea 109) | Asigna S-02 a **OND-8ox** | S-02 → **#29 / OND-58e** |
| §4, encabezado S-03 (línea 120) | Asigna S-03 a **OND-8ox** | S-03 → **#30 / OND-ptq** |
| §13, tabla de issues (línea 374) | Describe OND-8ox como "vistas … y autorización correcta de RPC/tablas" | OND-8ox (#27) cubre **solo S-01**. La tabla debe añadir OND-58e (#29) y OND-ptq (#30) |
| §13, tabla de issues | Usa solo IDs de Beads; omite los GitHub #27–#57 publicados el 10-10 | Añadir columna GitHub |

Afirmaciones del handoff del 12-10 que también se evaluaron:

- "#58 está enlazado dos veces en Beads": **refutada.** Solo `OND-w76.1` tiene `external_ref` a #58. La épica `OND-w76` no tiene `external_ref` y solo menciona #58 en sus notas como enlace del hijo (`bd show OND-w76 --json`). No hay nada que corregir; basta con conservar la convención épica sin enlace e hijo con enlace.
- "#6 no tiene espejo en Beads": **confirmada.** Además, #6 tiene el cuerpo vacío y no tiene etiquetas (`gh issue view 6`).
- "Los hallazgos de `kimi-k3-frontend-ventas.md` están cubiertos en otra parte" (mensaje del commit `a0a8f65`): **parcial.** El archivo era un handoff de implementación de agosto, no una lista de hallazgos. Quedan sin issue específico: HU-05 (solo #6, sin cuerpo ni espejo), `envases_recibidos` por detalle de venta (el hook fija 0), el histórico del día del vendedor y la confirmación con total persistido. Además, su eliminación dejó un enlace roto en `docs/archive/README.md:7`. Detalle en [frontend-ui-datos.md](workers/frontend-ui-datos.md#cobertura-del-archivo-kimi-k3-eliminado-en-a0a8f65).

---

## §1 Diagnóstico general y evidencia principal

| Afirmación | Veredicto | Evidencia 13-10 | Redacción propuesta |
| --- | --- | --- | --- |
| El frontend compila; 99 pruebas pasan | Confirmada | `npm run lint` = 0, `npm run build` = 0, `npm run test` = 15 archivos / 99 pruebas, en dos corridas ([testing](workers/testing-documentacion.md)) | — |
| El sitio publicado responde HTTP 200 | No verificable | No se hicieron llamadas a producción | Fechar como observación del 09-10. |
| El backend no se reconstruye desde cero | Confirmada | Replay estricto en PostgreSQL 16.14 desechable: 0001–0006 aplican y 0007 falla (`0007_fix_triggers_ventas.sql:123` frente a `0001_init.sql:1426`) ([backend](workers/backend-schema-rpc.md)) | "… falla en 0007, que recrea cinco triggers ya creados por 0001 (cuatro de venta_detalles y uno de anulación de ventas)". |
| Exposición anónima comprobada de información comercial | No verificable hoy | El código confirma vistas sin `security_invoker`; las migraciones no conceden SELECT explícito a `anon`. Los conteos 15/2 son del catálogo remoto | "El 09-10, `anon` leyó 15 y 2 filas; el código sigue definiendo las vistas como definidor. Falta verificar la contención en remoto". |
| "Diferencias importantes entre SQL local y base real" | Confirmada, con otro sentido | Las migraciones contienen auditoría, reversión de mermas, seis vistas y RLS de producción reforzada que el catálogo del 09-10 no mostraba. El frontend consulta `v_comision_vendedor.jornada`, columna que las migraciones no crean (definen `mes`) | "El repositorio define objetos que no estaban en producción, y producción expone contratos (p. ej. `jornada`) que el repositorio no define". |
| Tabla "Supabase: 23 tablas con RLS" | No verificable | Catálogo remoto | Fechar. |
| Tabla "Migraciones: 0001–0006 aplican; 0007 falla" | Confirmada | Reproducido el 13-10 | — |
| Tabla "Beads funcional; hooks reparados" | Confirmada | `core.hooksPath=.beads/hooks`, cinco hooks presentes, remoto `origin` configurado (`bd dolt remote list`) | — |
| Tabla "Navegador: carga permanente de producción, redirección a login" | Confirmada en código | `AuthProvider.tsx:26-29`, `Produccion.tsx:55-57`. No se repitió en navegador | "Mecanismo confirmado en código el 13-10; la reproducción visual es del 09-10". |

## §2 Herramientas e integraciones

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| Ref Supabase, Vercel `READY`, 403 con teamId, protección de rama ilegible | No verificable / parcial | La protección de rama **sí se leyó** el 13-10 con `gh api`: `develop` sin protección y `main` con 1 revisión, sin checks requeridos | Sustituir "la lectura de protección devolvió 403" por el resultado del 13-10. |
| CodeGraph 1.6.0, Mem0 con cinco memorias, Context7/Tavily, Computer Use | No verificable | Descripción de la sesión de origen | Mantener como contexto histórico. No aporta estado operativo. |
| `opencode.json` no demuestra MCP en Codex | Desactualizada | `opencode.json` de la raíz fue eliminado (`97f9258`). `.opencode/opencode.json` tiene trabajo en curso ajeno a esta auditoría | — |

## §3 Repositorio y capacidad de reinicio

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| Ramas: ventas 23/79, bodega 0/54, producción 0/44, administración 3/89 | Confirmada (adelanto) | `feature/administracion` 3 adelante: un merge eliminaría 352 archivos (38.598 líneas, incluidas todas las `.agents/skills`). `feature/ventas` 23 adelante, pero su HU-08/09 ya está en develop ([CI/CD](workers/ci-cd-operacion.md)) | Añadir el impacto destructivo de `feature/administracion`. |
| Tres stashes conservados | Confirmada | `git stash list` = 3 | — |
| El cliente no valida variables `VITE_*` ausentes | Confirmada | `frontend/src/lib/supabase.ts:4-7` | — |
| Node local 26, CI 22, Vercel 24.x; sin `.nvmrc`/`engines` | Parcial | Local v26.3.1 y CI 22 (`ci.yml:32`). `deploy-develop.yml` no fija Node. No hay `engines` ni `.nvmrc`. El runtime de Vercel requiere el panel | "CI fija 22; deploy-develop no fija runtime; el runtime de Vercel no es verificable desde el repo". |
| No existe `supabase/config.toml` | Confirmada | `supabase/` solo contiene `migrations/` y `.gitignore` | — |
| 0007 recrea `trg_venta_detalle_insert` | Confirmada y ampliada | También duplica los tres triggers de total y el de anulación (`0007:126,129,132,135`) | Ver §1. |
| "0008–0010 aplicaron en la base parcial" | Confirmada | El replay diagnóstico (eliminando los cinco triggers duplicados en la base desechable) aplica 0007–0010 | Añadir que el éxito diagnóstico **no** acredita una instalación limpia. |

## §4 Seguridad y autorización

### S-01 — Vistas de comisión y ranking (#27 / OND-8ox)

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| Sin `security_invoker=true` | Confirmada | `0001_init.sql:1693`, `:1709`; sin sustitución posterior | — |
| SELECT para `anon` y `authenticated`; 15 y 2 filas | No verificable | Las migraciones no contienen `GRANT SELECT … TO anon` sobre esas vistas. Los grants efectivos dependen de los defaults del proyecto | "El 09-10, el catálogo remoto concedía SELECT y devolvió 15/2 filas. Verificar ACL, propietario y default privileges antes de dar la contención por hecha". |
| Exposición limitada a dos vistas | **Refutada por omisión** | Otras seis vistas tampoco usan `security_invoker`: `v_stock_actual` (`0001:1637`), `v_cuadre_despacho` (`:1647`), `v_ventas_diarias` (`:1685`), `v_clientes_inactivos` (`:1738`), `v_historial_cliente` (`:1760`), `v_ventas_producto` (`:1775`) ([seguridad SEG-N6](workers/seguridad-revision.md)) | Ampliar S-01 a las ocho vistas definidoras. |

### S-02 — Políticas por sucursal e identidad (#29 / OND-58e, no OND-8ox)

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| `producciones`/`incidencias_produccion` solo comprueban rol | Parcial | Cierto en 0001 (`:951`, `:956`, `:967`, `:972`). **0008 lo sustituye** por sucursal y autor (`0008:52,60,72,85`) | "El catálogo remoto del 09-10 no tenía el endurecimiento que 0008 define; 0008 no es instalable limpiamente mientras 0007 falle". |
| `stock_bodega` INSERT/UPDATE sin sucursal | Confirmada | `0001:627`, `:632`. Ensayo T9b: bodega crea saldo en sucursal ajena y fija su saldo propio a 777 | Precisar que el UPDATE también está limitado por el SELECT (no se movió una fila invisible). |
| `mermas` SELECT sin sucursal; INSERT estricto | Confirmada | SELECT `0001:922`; INSERT final `0010:145` | — |
| `clientes` DELETE administrativo | Confirmada | `0001:567`. La FK de ventas (`:208`) impide borrar clientes con ventas | "Permite borrar clientes sin ventas; no hay borrado en cascada de ventas". |
| (Omitido) Ramas por identidad que ignoran `activo` | **Nuevo** | `mi_sucursal()` (`0001:462`) no comprueba `activo`; las ramas `auth.uid() = vendedor_id` de clientes, ventas y gastos tampoco | Añadir: un perfil desactivado con JWT vigente conserva acceso ([SEG-N1](workers/seguridad-revision.md)). |
| (Omitido) `despacho_detalles`/`despacho_envases`, `carga_vendedor`, `stock_envases`, `ubicaciones` | **Nuevo** | INSERT de líneas en despachos ajenos mueve stock (T2: 100 → 97). Bodega lee y escribe carga de cualquier sucursal. GPS legible por bodega sin sucursal | Ampliar la matriz de S-02 a estas tablas. |

### S-03 — RPC y SECURITY DEFINER (#30 / OND-ptq, no OND-8ox)

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| 16/19 funciones accesibles según advisors | No verificable | Conteos remotos | Fechar. Distinguir funciones `RETURNS trigger` de RPC. |
| `registrar_venta` no exige rol ni perfil activo | Confirmada | `0002_modulo_ventas.sql:94`, `:102`, `:105`. Ensayo T1: un perfil inactivo registra una venta | — |
| Insinuación de `registrar_venta` ejecutable por `anon` | Refutada (código) | `0003:21`, `:24`, `:34` revocan PUBLIC y anon. El bloque silencia errores (`:27`), así que la ACL remota debe comprobarse | "En el código final está revocado para anon; verificar la ACL desplegada". |
| Venta de administrador global con sucursal nula | Parcial | `perfiles.sucursal_id` es NOT NULL en `0001:70` y en los tipos generados; la nulabilidad remota no es verificable | "Las migraciones no permiten admin sin sucursal; producción sí lo tenía el 09-10: es parte del desfase de esquema". |
| `corregir_devolucion` exige admin y confía en `p_creado_por` | Confirmada | Guarda `0006:343`; autor `:394`, `:407`. Ensayo T5. El log de auditoría sí usa `auth.uid()` (`0001:1517`) | "Permite atribuir la fila a otro perfil; no falsifica el log de auditoría". |
| "Usar `search_path` controlado" | Parcial | Las funciones públicas fijan `public` y las privadas fijan vacío (`0008:31`, `:40`, 0009/0010) | "Ya hay `search_path` fijado; falta calificar objetos y revisar CREATE/TEMP". |
| (Omitido) `crear_despacho` es SECURITY INVOKER | **Precisión** | `0006:269`. Sin REVOKE PUBLIC (`:320`, `:413`) | No clasificarlo como bypass de definidor. |
| (Omitido) `creado_por` y `es_ajuste` controlados por el cliente | **Nuevo** | INSERT de clientes, ventas, gastos, despachos y devoluciones no exige `creado_por = auth.uid()`. `es_ajuste=false` evade la ventana de 15 min (`0001:1071`). INSERT con `anulado=true` mueve stock (T7) | Añadir a S-03 o S-02 ([SEG-N3, SEG-N7](workers/seguridad-revision.md)). |

### S-04 — Auth, navegador y protección operativa

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| Protección de contraseñas filtradas desactivada | No verificable | Configuración Auth remota | Fechar (#44). |
| Sin CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | Confirmada (repo) | `frontend/vercel.json` sin `headers`; `index.html` sin CSP | "El repositorio no declara cabeceras; las efectivas no se re-verificaron". |
| Sin claves privadas en documentación | Confirmada y ampliada | Escaneo de 721 blobs alcanzables: solo una clave `anon` pública en `docs/setup-vercel-supabase-github.md` (eliminado en `edafa8b`); ningún `service_role` | Añadir que el repo es **público sin secret scanning, push protection ni alertas de Dependabot** (API 13-10). |

## §5 Base de datos, integridad y rendimiento

| ID / afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| B-01: diez archivos locales frente a cinco versiones remotas | No verificable | Diez archivos confirmados; historial remoto no consultado | Fechar. |
| B-01: `perfiles.sucursal_id` nullable en remoto, NOT NULL local | Parcial | NOT NULL local confirmado (`0001:70`); remoto no verificable | — |
| B-01: faltan seis vistas documentadas | **Refutada para el repositorio** | Las seis se crean en `0001_init.sql:1637`–`:1775` y ninguna se elimina | "Faltaban en el catálogo remoto del 09-10; las migraciones sí las definen". |
| B-02: solo `despacho_envases` tiene trigger de auditoría | **Refutada para el repositorio** | 0001 crea auditoría general (`:1551`–`:1613`), 0006 la de envases y 0008 la de incidencias: 11 triggers de auditoría | "El catálogo remoto del 09-10 solo tenía la de envases; el repo define 11". |
| B-02: `mermas` sin trigger de reversión al anular | **Refutada para el repositorio** | Función `0001:1390`, trigger `:1462`; 0010 solo reemplaza el INSERT | Igual que la fila anterior. Añadir que la reversión existente compensa mal (ver BD-05). |
| B-02: UPDATE de detalles no compensa carga | Confirmada y ampliada | `0007:129` recalcula el total pero no el movimiento. Lo mismo ocurre en despachos, devoluciones, producción y mermas | — |
| B-02: reactivar un anulado no repone movimientos | Confirmada y ampliada | Ensayo T12: anular, reactivar y volver a anular deja el stock en 102 desde 100 | "La compensación se puede repetir; la anulación no es idempotente". |
| B-03: reglas elegidas por `now()` | Confirmada | `0001:1729` | — |
| B-03: ranking sin America/Santiago; "la comisión sí convierte" | **Parcial** | Ranking `0001:1696` y comisión `:1712` usan ambos `date_trunc('month', …)` sin zona. Solo el diseño `bd/vistas.sql:112` usa jornada chilena | "Ni ranking ni comisión convierten la zona horaria en las migraciones". |
| B-03: base de comisión antes del descuento | Confirmada | `0001:1714`, `:1719`. El ranking local suma `ventas.total` (neto) | Añadir la divergencia bruto/neto entre las vistas. |
| B-04: venta y despacho transaccionales con FOR UPDATE | Confirmada | `0002:118,134`; `0006:290-304` | Precisar que `crear_despacho` es INVOKER. |
| B-04: sin orden determinista de bloqueo | Confirmada | Iteraciones JSON sin ORDER BY (`0002:134`, `0006:294`) | Riesgo de deadlock no reproducido. |
| B-04: devoluciones producto/envase separadas | Confirmada | `frontend/src/domains/bodega/api.ts:152`, `:182` | Precisar que la RPC de **corrección** ya es conjunta (`0006:327`). |
| B-04: sin idempotencia | Confirmada | Sin clave de solicitud en tablas ni RPC | — |
| B-05: publicación Realtime vacía en remoto | No verificable | 0008 publica `producciones`, `incidencias_produccion` y `stock_envases` (`0008:211`) | — |
| B-05: 0008 no publica `mermas` | Confirmada | El frontend escucha `mermas` (`Produccion.tsx:89-101`) | — |
| B-05: no hay buckets de Storage | **Parcial** | 0001 crea el bucket privado `comprobantes` (`:1850`) con SELECT sin propietario (`:1020`) | "Remoto sin buckets el 09-10; el repo crea el bucket con políticas amplias que leen comprobantes de terceros". |
| B-05: 48 FK sin índice, 21 initplan, 2 índices sin uso | No verificable | El catálogo diagnóstico local tiene 36 FK sin índice de cobertura completa | Fechar. No comparar como si fuera el mismo catálogo. |
| B-05: backups/PITR sin verificar | No verificable | Sin acceso al panel | — |

**Omisiones graves de §5** (detalle en [backend](workers/backend-schema-rpc.md)): 0007 reintroduce la doble entrada de envases (BACK-N1). Anular un despacho con devolución parcial crea stock: 100 → 104 (BACK-N5). La compensación usa los valores NEW, no OLD (BACK-N6). Un INSERT ya anulado mueve inventario (BACK-N7). La vista de comisión de las migraciones no tiene la columna `jornada` que pide el cliente (BACK-N8). Los importes aceptan `NaN` (BACK-N10). El backfill de 0007 puede descontar dos veces (BACK-N14).

## §6 Frontend, experiencia y arquitectura

| ID / afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| F-01: `loading` termina antes del perfil | Confirmada | `AuthProvider.tsx:26-29` | — |
| F-01: `signOut` descarta el error | Confirmada | `AuthProvider.tsx:46-49` | — |
| F-01: QueryClient sin limpiar | Confirmada | `main.tsx:15-23`; sin `queryClient.clear` | Precisar que varias claves sí incluyen el ID del usuario. |
| F-01: borrador global en sessionStorage | Confirmada y ampliada | `RegistrarVenta.tsx:34`. Además, un borrador recuperado puede reaparecer tras registrar la venta (FUI-N3) | — |
| F-01: llamada asíncrona dentro del callback de Auth | Parcial | `void loadPerfil` sin await; deadlock no demostrado | — |
| F-02: producción bloqueada para admin sin sucursal | Confirmada | `Produccion.tsx:55-57` retorna antes del `finally` | — |
| F-02: stock y despachos tienen selector | Parcial | Selectores presentes, pero eligen la primera sucursal automáticamente y no descartan respuestas tardías (FUI-N4) | — |
| F-03: lecturas de bodega descartan `error` | Confirmada y ampliada | `bodega/api.ts:43-136`, y también `ventas/api.ts` y `lib/catalog.ts` | Ampliar a ventas y catálogo. |
| F-03: "no se ha demostrado un bypass general de roles por URL" | **Parcial** | `DashboardLayout.tsx:31-33` compara literalmente: `/stock/` o `/STOCK` resuelven la ruta y evaden el control de rol de la interfaz (prueba con `matchRoutes`) | "Las variantes con barra final o mayúsculas evaden el control visual; la protección decisiva sigue siendo RLS/RPC". Severidad media. |
| F-03: Realtime dentro del componente | Confirmada | `Produccion.tsx:4,85-104`. También `pages/Dashboard.tsx:3,21-28` consulta Supabase directamente | — |
| F-04: JS 911,39 kB / CSS 289,61 kB | Confirmada | Re-medido el 13-10: mismos valores; advertencia de chunk > 500 kB | — |
| F-04: `Database` manual frente a generado; `as never[]` | Confirmada | `types/database.ts:14-112`; casts en `produccion/api.ts:103,112` y `bodega/api.ts:147,163,177,194` | Incluir los casts de RPC. |
| F-04: producción carga conjuntos innecesarios; sin paginación | Parcial | Producción limita a 30/200/30; bodega trae todos los despachos | — |
| F-04: sin refetch al enfocar | Confirmada | `main.tsx:18-20` | Añadir que comisión y stock no se refrescan solos (FUI-N5). |
| F-05: formato de miles, duplicados, tarjetas móviles | Parcial | Mecanismos presentes; sin QA visual el 13-10 | — |
| F-05: campos sin nombre accesible | Confirmada, acotada | Ventas y devoluciones sin label. **Despacho sí** tiene labels `sr-only` (`Despachos.tsx:789-845`) | Excluir despacho. |
| F-05: foco de modales y sidebar móvil | Confirmada | Sin `aria-modal`, `aria-expanded` ni gestión de Escape | Añadir `lang="en"` en `index.html` y Toast sin `aria-live` (FUI-N7). |
| F-05: punto rojo fijo y Excel deshabilitado | Confirmada | `DashboardLayout.tsx:127-134`; `Stock.tsx:157-158` | — |

## §7 Funcionalidades y alcance real

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| El resumen "16 completas, 3 parciales" mezcla capas | Desactualizada | `docs/status/user-stories.md` lo sustituyó con Present/Partial/Placeholder | — |
| HU-01–04 implementados | Parcial | HU-02 falla para admin global y el admin no ve los clientes creados para un vendedor (FUI-N2). HU-01 sin histórico del vendedor | Usar la [matriz del frontend](workers/frontend-ui-datos.md#sección-7-hu-01-a-hu-31-vista-exclusivamente-desde-frontend). |
| HU-05 retirada del frontend | Parcial | Sin UI de vendedor, pero `docs/status/user-stories.md:14` deja el alcance "por confirmar" y #6 sigue abierto sin cuerpo | "Decisión de alcance pendiente (#6)". |
| HU-08/09 implementados | Parcial | La consulta de comisión ordena por `jornada`, que las migraciones no crean: fallaría sobre un esquema reconstruido (BACK-N8) | — |
| HU-10/14/16 placeholder; HU-11/12/15/17 sin UI | Confirmada | Páginas `ModulePage` | Las vistas de HU-11/12 **sí** están en las migraciones. |
| HU-19–23 presentes | Parcial | Bloqueo F-02; HU-23 sigue siendo un formulario de merma (#70) | — |
| HU-26 "ventana en trigger" | **Parcial** | La ventana se evade enviando `es_ajuste=false` (BACK-N3) | "La ventana existe, pero es eludible desde el cliente". |
| HU-27/28 por INSERT separados | Confirmada | — | — |
| HU-18/30 retiradas; contradicción con RNF-01 | Confirmada | `requirements.md:43` conserva RNF-01; decisión pendiente en #56 | — |

## §8 Navegador y verificación ejecutada

No se repitió en navegador. Los mecanismos de código de cada observación (redirección a login, spinner de producción, validaciones vacías, formato de miles, opciones duplicadas deshabilitadas) siguen presentes. **Veredicto: no verificable como comportamiento actual; confirmado como mecanismo.** La reproducción por rol sigue pendiente (#43).

## §9 CI/CD, GitHub y Vercel

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| `migrations-check` solo busca `;` | Confirmada | `ci.yml:63-66`; pasa en vacío (`:59-61`) y no detectaría el fallo de 0007 | — |
| `deploy-develop` despliega sin depender de CI | Confirmada | Sin `needs`. El 13-10, CI quedó `cancelled` y el deploy terminó `success` | — |
| Environment `production` en YAML; reviewers no acreditables | Confirmada y ahora verificable | API: 4 reviewers y política de rama `main` | Sustituir por el dato verificado. |
| Despliegues por Git integration y por CLI para el mismo commit | Confirmada | `main@38b60b0`: `vercel[bot]` Production 03:15:46Z y Actions 03:17:58Z (éxito). `develop@a0a8f65` (13-10): Preview y development | "La vía Git publica Production sin pasar por los reviewers del environment". |
| `vercel@latest`, actions por tag, `pull-requests: write` | Confirmada | `deploy-*.yml`; `ci.yml:9-11` | — |
| Faltan monitorización y restauración probada | Confirmada (repo) | Sin evidencia en el repo | — |
| (Omitido) `develop` sin protección; ningún check requerido | **Nuevo** | `gh api …/branches/develop/protection` → 404; `main` sin `required_status_checks`, `enforce_admins=false` | Añadir. |
| (Omitido) Sin `timeout-minutes`, sin `workflow_dispatch` de rollback, secretos a nivel de repo | **Nuevo** | [CI/CD](workers/ci-cd-operacion.md) | Añadir. |
| Dependencias: 9 alertas (2C/4A/3M); 2 altas sin dev | Confirmada | Mismo resultado el 13-10 | Actualizar: npm propone **vitest 5.0.4** (no 5.0.3); nanoid y source-map-js se corrigen sin salto mayor. |

## §10 Documentación y archivos innecesarios

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| README contradictorio; AGENTS con `bd statistics` | Desactualizada (corregida) | `README.md` vigente; `AGENTS.md:16` usa `bd stats` | — |
| `docs/estado-historias-usuario.md`, `setup-vercel…`, `merge-pr-guide`, `plan-mejoras-ventas`, `superpowers`, handoffs | Desactualizada | Reestructuración `55d6c0f`/`edafa8b`: retirados o sustituidos | — |
| "Conservar `datos_planilla_manual_fisico.md`" | No cumplida | Eliminado en `edafa8b`; recuperable desde Git | Ratificar la retirada o archivarlo con rótulo histórico (#56). |
| Contradicción offline / cierre de jornada | Confirmada | Sigue pendiente de decisión comercial | — |
| `bd/*.sql` como referencia de diseño | Confirmada, con matiz | El diseño diverge de las migraciones en RLS de producción, ranking/comisión, envases y excepciones administrativas | "`bd/` no es una definición única ni coherente; las migraciones son la fuente operativa". |
| (Omitido) enlace roto al handoff kimi-k3 | **Nuevo** | `docs/archive/README.md:7` | Corregir en #56. |

## §11 Beads

| Afirmación | Veredicto | Evidencia |
| --- | --- | --- |
| Remoto `origin` por SSH; hooks en `.beads/hooks` | Confirmada | `bd dolt remote list`, `git config core.hooksPath` |
| Exports retirados del tracking | Confirmada | `git ls-files .beads` solo lista configuración y hooks |
| Recuperación de 29 issues / 4 memorias | No verificable | Prueba de la sesión de origen; hoy hay 71 issues y 6 memorias |

## §12 Skills del proyecto

| Afirmación | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- |
| 15 skills validadas | Desactualizada | Hoy hay **19** (`.agents/skills/`); `docs/skills.md:22` documenta las cuatro añadidas | Usar el conteo de `docs/skills.md`. |

## §13 Verificación y continuación

| Afirmación | Veredicto | Redacción propuesta |
| --- | --- | --- |
| Tabla de issues | **Errónea** en OND-8ox (ver "Errores de trazabilidad") | Sustituir por la tabla de la [auditoría profunda](auditoria-profunda-2026-10-13.md#7-correspondencia-con-los-trackers). |
| "Comenzar por OND-8ox y OND-8wi" | Confirmada con matiz | Mantener #27 y #28 primero. Añadir #29/#30 (autorización directa por REST, reproducida en aislamiento) y #32 (conservación de inventario) antes de cualquier funcionalidad nueva. |

## Límites de esta evaluación

- Las afirmaciones del 09-10 se contrastaron con el código, la configuración y la API de GitHub actuales; no se aceptaron por estar escritas.
- No se consultó Supabase remoto, Vercel ni HTTP de producción. Todo lo que depende de ellos queda como "no verificable" y conserva su fecha original.
- Las pruebas SQL del worker backend se hicieron en PostgreSQL 16.14 desechable, con Auth/Storage mínimos y grants de fixture. No equivalen a Supabase local completo, a PostgreSQL 17.6 ni a PostgREST.
- No hubo navegador, lector de pantalla ni pruebas de concurrencia.
- No se hicieron commits, push, despliegues, `supabase db push` ni cambios en GitHub.
