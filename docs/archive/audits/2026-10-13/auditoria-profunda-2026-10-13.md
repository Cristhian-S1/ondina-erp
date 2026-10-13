# Auditoría profunda de Ondina — 2026-10-13

> Fecha: 13-10-2026 (America/Santiago). Base: `develop` = `origin/develop` en `a0a8f65`. Beads: OND-c2z.
> Orquestación: Orca run `run_af5dd59a6889`. Coordinador: Claude Opus 5.5. Auditores de solo lectura: Codex `gpt-6.1-sol` (frontend, backend y seguridad) y OpenCode `deepseek-v4.1-flash` (testing+documentación y CI/CD). Receipts en [workers/README.md](workers/README.md).
> Evaluación de la auditoría anterior: [evaluacion-auditoria-2026-10-09.md](evaluacion-auditoria-2026-10-09.md).
> Este documento registra hallazgos. **No corrige nada.** Las propuestas de cambio en los trackers (§8) están pendientes de confirmación del usuario.

## 1. Diagnóstico

**El frontend compila y sus 99 pruebas pasan, pero esa evidencia no alcanza a lo que más riesgo tiene: la autorización y la integridad del inventario viven en la base de datos, y ninguna prueba las cubre.** La revisión del SQL y su ejecución en una base PostgreSQL desechable mostraron tres cosas:

1. **El repositorio no se instala desde cero.** La migración 0007 falla en una instalación limpia y su backfill de carga puede descontar dos veces en una actualización.
2. **El repositorio y producción divergen en ambos sentidos.** Las migraciones definen auditoría, reversiones, vistas y RLS de producción que el catálogo remoto del 09-10 no tenía. A la vez, el frontend consume contratos de producción que las migraciones no definen, como la columna `v_comision_vendedor.jornada`.
3. **Hay vías REST directas que saltan las reglas de negocio,** aunque la interfaz no las ofrezca:
   - un perfil desactivado puede seguir vendiendo;
   - bodega puede insertar líneas en despachos de otra sucursal;
   - bodega puede escribir saldos y carga sin pasar por una operación;
   - se puede saltar la ventana de ajuste;
   - se pueden insertar registros ya anulados que mueven stock;
   - se puede atribuir `creado_por` a otra persona.

   Además, varias compensaciones de anulación **crean** stock en lugar de conservarlo.

En CI/CD, `develop` no tiene protección de rama y ningún check es obligatorio. La integración Git de Vercel publica Production sin pasar por los cuatro revisores del environment `production`. El repositorio es público y no tiene secret scanning ni alertas de Dependabot.

**Prioridad recomendada:**
1. **Contención y verdad del esquema:** #27, #28.
2. **Autorización en la base:** #29 y #30, ampliados con las vías directas descritas.
3. **Conservación de inventario:** #32, #33 y #42.
4. **Puerta de integración:** #39 y #40.
5. Después, sesión y frontend (#36, #37, #49) y las HU de administración.

No conviene construir HU nuevas sobre las tablas de saldos actuales.

## 2. Método y límites

| Aspecto | Cómo se hizo | Límite |
| --- | --- | --- |
| Código frontend | Lectura estática completa de `frontend/src/**`, CodeGraph y `matchRoutes` del router instalado | Sin navegador, sin lector de pantalla, sin latencias controladas |
| SQL | Estado efectivo por precedencia de 0001–0010; replay en PostgreSQL 16.14 en Docker desechable, sin red ni datos reales; 12 casos sintéticos (T1–T12) | No es Supabase local completo, ni PostgreSQL 17.6, ni PostgREST; grants de fixture explícitos |
| Pruebas y dependencias | `npm run lint`, `test` (×2), `build`, `npm audit` con y sin dev | Sin `npm ci` limpio ni matriz de versiones de Node |
| CI/CD y GitHub | Lectura de workflows y `gh api` de solo lectura: protección de ramas, environments, deployments, security_and_analysis | Sin paneles de Vercel ni Supabase |
| Secretos | Patrones sobre 721 blobs alcanzables, sin imprimir valores | Sin objetos inalcanzables, forks ni logs externos |
| Trackers | Snapshots de `gh issue list` y `bd list` del 13-10 | Ningún cambio aplicado |

**No verificable en esta auditoría** (requiere catálogo o panel remoto): grants y filas visibles para `anon`, historial remoto de migraciones, triggers desplegados, publicación Realtime, buckets reales, configuración de Auth, cabeceras HTTP efectivas, backups/PITR y runtime de Vercel. No se consultó Supabase remoto; hacerlo requiere autorización explícita del usuario.

**Notación.** Severidad: crítica / alta / media / baja. Estado: confirmado (código o ensayo), probable (secuencia derivada del código, sin reproducir) o requiere verificación. `0001:627` abrevia `supabase/migrations/0001_init.sql:627`. El ID de origen remite al informe del worker.

## 3. Seguridad y autorización

| ID | Hallazgo | Sev. | Estado | Evidencia y comando | GitHub / Beads | Origen |
| --- | --- | --- | --- | --- | --- | --- |
| SEG-01 | `v_comision_vendedor` y `v_ranking_vendedores` sin `security_invoker`; otras **seis** vistas comerciales con el mismo patrón | crítica | Confirmado en código; exposición actual requiere verificación | `0001:1637,1647,1685,1693,1709,1738,1760,1775`; `rg -n 'create or replace view\|security_invoker'` | #27 / OND-8ox | S-01, SEG-N6 |
| SEG-02 | Un perfil desactivado conserva acceso: `mi_sucursal()` no mira `activo`; las ramas `auth.uid()=vendedor_id` y `registrar_venta` no exigen rol ni perfil activo | alta | Confirmado (T1: venta con perfil inactivo) | `0001:462`, `:549`, `:687`, `:750`; `0002_modulo_ventas.sql:94-105` | #29 / OND-58e, #30 / OND-ptq, #44 / OND-d40 | SEG-N1, S-03 |
| SEG-03 | INSERT directo en `despacho_detalles`/`despacho_envases` de un despacho de otra sucursal mueve su stock mediante un trigger DEFINER | alta | Confirmado (T2: stock B 100 → 97) | Políticas `0001:819`, `0006:64`; triggers `0001:1056-1088`, `0006:77-109` | #29, #30 | SEG-N2, BACK-N2 |
| SEG-04 | Bodega escribe saldos de `stock_bodega` y `stock_envases` sin operación ni auditoría; lee, escribe y borra `carga_vendedor` de cualquier sucursal; lee GPS de todas las sucursales | alta | Confirmado (T9b: saldo 777 e INSERT en sucursal ajena) | `0001:627,632,649,654,662-678,979` | #29; GPS #64 / OND-w76.7 | S-02, SEG-N4, BACK-N11 |
| SEG-05 | `creado_por` lo elige el cliente en clientes, ventas, gastos, despachos y devoluciones; `corregir_devolucion` acepta `p_creado_por` | media | Confirmado (T5) | `0001:552,690,753,783,851,895`; `0006:394,407`; `bodega/api.ts:174` | #29, #30 | SEG-N3 |
| SEG-06 | Campos que cambian la intención de una operación: `es_ajuste=false` salta la ventana de 15 min; un INSERT con `anulado=true` mueve stock y queda fuera de los indicadores | alta | Confirmado (T2, T7) | `0001:267,1071`; `0006:37,92`; `0009:56-67` | #30, #32 / OND-lpu, #66 / OND-w76.9 | SEG-N7, BACK-N3, BACK-N7 |
| SEG-07 | El bucket `comprobantes` (privado) permite a cualquier vendedor, bodega o admin leer y subir objetos sin filtro de propietario ni de sucursal | media | Confirmado en código | `0001:1005,1020,1850` | #69 / OND-w76.12, #29 | SEG-N5 |
| SEG-08 | ACL de RPC: `registrar_venta` está revocada para anon (refuta la sospecha del 09-10); `crear_despacho` y `corregir_devolucion` conservan EXECUTE PUBLIC por defecto; `search_path` está fijado pero los objetos no están calificados | media | Confirmado en código | `0003:21-34`; `0006:269,320,413` | #30 | S-03 |
| SEG-09 | El control de rol de la interfaz se evade con variantes de URL (`/stock/`, `/STOCK`). Solo afecta a la interfaz: RLS y RPC deciden el acceso real | media | Confirmado (`matchRoutes`) | `DashboardLayout.tsx:31-33`; `App.tsx:12-18` | #36 / OND-82e | FUI-N1 |
| SEG-10 | Repositorio público sin secret scanning, push protection ni alertas de Dependabot | media | Confirmado (API) | `gh api repos/Cristhian-S1/ondina-erp --jq .security_and_analysis` | #46 / OND-o5g, #38 / OND-gu3 | CICD-3 |
| SEG-11 | Historial Git: solo una clave `anon` pública en un documento eliminado; ningún `service_role` ni `.env` real | informativo | Confirmado | `git log -p -S 'service_role' --all`, escaneo de blobs | #46 | S-04 |
| SEG-12 | Sin cabeceras de seguridad ni CSP declaradas en `frontend/vercel.json` | media | Confirmado (repo) | `frontend/vercel.json:1-8` | #45 / OND-4hm | S-04 |

## 4. Base de datos, integridad y lógica de negocio

| ID | Hallazgo | Sev. | Estado | Evidencia y comando | GitHub / Beads | Origen |
| --- | --- | --- | --- | --- | --- | --- |
| BD-01 | La cadena 0001–0010 no se instala desde cero: 0007 recrea cinco triggers de 0001 | alta | Confirmado (replay estricto, exit 3) | `0001:1426`; `0007:123-135` | #28 / OND-8wi, #40 / OND-eh8 | §3, B-01 |
| BD-02 | Divergencia repo ↔ producción. Las migraciones definen 11 triggers de auditoría, la reversión de mermas, seis vistas y la RLS de producción por sucursal (0008), que no estaban en remoto el 09-10. `v_comision_vendedor` expone `mes`, pero el cliente ordena por `jornada`: sobre un esquema reconstruido, Mi comisión falla | alta | Confirmado (T10: `column jornada does not exist`) | `0001:1551-1613,1709-1712`; `ventas/api.ts:193`; `0008:52-85` | #28, #34 / OND-cop, #51 / OND-yew | B-01, B-02, BACK-N8 |
| BD-03 | El backfill de 0007 descuenta todas las ventas activas aunque 0001/0006 ya las descontaron al insertar: doble descuento en una actualización | alta | Probable | `0007:150-160` | #28, #42 / OND-vi4 | BACK-N14 |
| BD-04 | 0007 reintroduce la doble entrada de envases: se suman al vender y otra vez al devolver a bodega | alta | Confirmado (T3: 10 → 12 → 14) | `0007:53`; `0001:1201`; contradice `0006:148` | #32 / OND-lpu, #28 | BACK-N1 |
| BD-05 | Las compensaciones no conservan el inventario. Anular un despacho con devolución parcial crea stock (T4: 100 → 104). Las compensaciones usan NEW y no OLD (T6: 98 → 118). Anular, reactivar y volver a anular repite la compensación (T12: 102) | alta | Confirmado | `0006:233-241`; `0001:1341,1396,1409`; `0009:139` | #32, #61 / OND-w76.4 | B-02, BACK-N5, BACK-N6 |
| BD-06 | Editar `descuento` de la cabecera no recalcula el total; cambiar el `venta_id` de un detalle no recalcula el padre anterior | media | Confirmado (T8) | `0007:72-76` | #32, #61 | BACK-N9 |
| BD-07 | Los importes aceptan `NaN`: la RPC solo comprueba `< 0` y el CHECK `>= 0` no excluye `NaN` | alta | Confirmado (T11: `total=NaN`) | `0002:137,146`; `0001:198,218` | **sin issue** (ver §8) | BACK-N10 |
| BD-08 | La corrección de devolución no agrega duplicados por producto ni bloquea el despacho padre: dos filas de 7 pasan un tope de 10 | alta | Confirmado (T5); carrera probable | `0006:347-386`, `:169` | #33 / OND-rnd, #42 | BACK-N4 |
| BD-09 | Devoluciones de producto y envase en escrituras separadas; sin idempotencia; sin orden determinista de bloqueo | alta | Confirmado en código | `bodega/api.ts:152,182`; `0002:134`; `0006:294` | #33, #42 | B-04 |
| BD-10 | Comisiones: la regla se elige con `now()`; ranking y comisión agrupan por mes sin `America/Santiago`; la comisión usa base bruta y el ranking neta; las reglas pueden solaparse y aceptar porcentaje > 100 | alta | Confirmado en código | `0001:1696-1729`, `:141-147` | #34, #35 / OND-uoi, #63 / OND-w76.6 | B-03, BACK-N13 |
| BD-11 | Las RPC aceptan productos inactivos; `p_envases` que no sea un array se ignora sin error; la corrección omite cantidades ≤ 0 | media | Confirmado en código | `0002:134`; `0006:294-305,357,390` | #30, #65 / OND-w76.8 | BACK-N12 |
| BD-12 | Realtime: 0008 publica tres tablas, pero no `mermas`, que el frontend escucha | media | Confirmado en código | `0008:211`; `Produccion.tsx:89-101` | #48 / OND-0lg | B-05 |
| BD-13 | 36 FK sin índice de cobertura completa en el catálogo local; faltan restricciones (configuración como texto, motivo de merma solo NOT NULL) | media | Confirmado (estructura); impacto sin medir | consulta `pg_constraint`/`pg_index` del apéndice backend | #47 / OND-vrn | B-05, BACK-N13 |
| BD-14 | `v_cuadre_despacho` cruza ventas por vendedor, producto y día: con dos despachos en un día puede imputar la misma venta a ambos | media | Probable | `0001:1663` | #62 / OND-w76.5 | backend §Issues |

## 5. Frontend, UI y datos

| ID | Hallazgo | Sev. | Estado | Evidencia | GitHub / Beads | Origen |
| --- | --- | --- | --- | --- | --- | --- |
| FE-01 | Restauración de sesión: `loading` termina antes del perfil; `signOut` ignora el error; QueryClient no se limpia; el borrador de venta usa una clave global | alta | Confirmado | `AuthProvider.tsx:26-29,46-49`; `main.tsx:15-23`; `RegistrarVenta.tsx:34` | #36 / OND-82e | F-01 |
| FE-02 | Un borrador recuperado puede reaparecer después de registrar la venta (`reset(defaults)` con el borrador anterior) | media | Probable | `RegistrarVenta.tsx:77-81,116-119,145-149,219-220` | #36, #42 | FUI-N3 |
| FE-03 | Producción queda en "Cargando…" para un administrador sin sucursal | alta | Confirmado | `Produccion.tsx:55-57` | #37 / OND-y64 | F-02 |
| FE-04 | HU-02: el administrador global no puede crear clientes, y un administrador con sucursal no ve los clientes que crea para un vendedor (la consulta filtra por su propio ID) | media | Confirmado (flujo estático) | `useCrearCliente.ts:13`; `ventas/api.ts:22,50`; `useVendedoresSucursal.ts:8-10` | **sin issue** (ver §8) | FUI-N2 |
| FE-05 | Los servicios de bodega, ventas y catálogo descartan `error` y devuelven `[]` | media | Confirmado | `bodega/api.ts:43-136`; `ventas/api.ts:16-114`; `lib/catalog.ts:4-30` | #49 / OND-tyz | F-03 |
| FE-06 | Respuestas obsoletas: cambiar de sucursal en bodega o de mes en el ranking puede mostrar datos del filtro anterior; el despacho conserva el vendedor del ámbito anterior | media | Probable | `Stock.tsx:79-93`; `Despachos.tsx:167-219,268-275`; `RankingVendedores.tsx:23-39` | #49 | FUI-N4, FUI-N6 |
| FE-07 | Comisión y stock no se actualizan mientras la pantalla está abierta (sin suscripción ni intervalo; sin refetch al enfocar) | media | Confirmado | `MiComision.tsx:25-51`; `main.tsx:20` | #49, #48 | FUI-N5 |
| FE-08 | Bundle JS de 911,39 kB (258,90 kB gzip) sin carga diferida | media | Confirmado (build 13-10) | `App.tsx:4-6`; `domains/index.ts:2-5` | #50 / OND-683 | F-04 |
| FE-09 | `Database` manual paralelo al generado (`sucursal_id` nullable frente a no nullable); casts `as never` en INSERT y RPC | media | Confirmado | `types/database.ts:14-112`; `types/index.ts:19`; `produccion/api.ts:103,112`; `bodega/api.ts:147,163,177,194` | #51 / OND-yew | F-04 |
| FE-10 | Accesibilidad: campos de ventas y devoluciones sin nombre accesible; modales y sidebar sin gestión de foco ni `aria-*`; `lang="en"`; Toast sin `aria-live` | media | Confirmado (markup) | `RegistrarVenta.tsx:375-431`; `Devoluciones.tsx:581-688`; `DashboardLayout.tsx:47-58`; `index.html:2`; `Toast.tsx:12-14` | #52 / OND-53r | F-05, FUI-N7 |
| FE-11 | Se rompe la invariante "solo `api.ts` importa Supabase": `pages/Dashboard.tsx` consulta sucursales y `Produccion.tsx` maneja Realtime | baja | Confirmado | `Dashboard.tsx:3,21-28`; `Produccion.tsx:4,85-104` | #48, #49 | F-03 |
| FE-12 | Con toda la carga agotada, la sección queda vacía sin mensaje (el estado vacío se decide antes de filtrar las cantidades en cero) | baja | Confirmado | `Carga.tsx:31,39-40`; `Ventas.tsx:100-102` | #49 | FUI-N8 |
| FE-13 | El cliente no valida las variables `VITE_*` ausentes | baja | Confirmado | `lib/supabase.ts:4-7` | #53 / OND-aeo | §3 |

## 6. CI/CD, operación, pruebas y documentación

| ID | Hallazgo | Sev. | Estado | Evidencia | GitHub / Beads | Origen |
| --- | --- | --- | --- | --- | --- | --- |
| CI-01 | `develop` no tiene protección de rama; ningún branch exige checks; `main` exige 1 revisión con `enforce_admins=false` | alta | Confirmado (API) | `gh api …/branches/develop/protection` → 404; `…/main/protection` | #39 / OND-get, #57 / OND-2mt | CICD-1 |
| CI-02 | Doble publicación: la integración Git de Vercel publica Production sin pasar por los 4 revisores del environment `production`; `deploy-develop` no depende de CI | alta | Confirmado (deployments 6043883647 y 6043885207) | `gh api …/deployments`; `deploy-develop.yml:3-31`; `vercel.json` sin `git.deploymentEnabled` | #39 | C-02, C-04, CICD-2 |
| CI-03 | `migrations-check` solo busca `;` y no habría detectado el fallo de 0007; no hay workflow de migraciones ni `config.toml` | alta | Confirmado | `ci.yml:59-66` | #40 / OND-eh8 | C-01, C-18 |
| CI-04 | Cadena de CI: `vercel@latest`, actions por tag, `pull-requests: write` sin uso, secretos a nivel de repo, token interpolado en `run:`, sin `timeout-minutes` | media | Confirmado | `ci.yml:9-11,27,30`; `deploy-*.yml:25,28,61,64` | #46 / OND-o5g | C-05–C-07, CICD-4, CICD-6 |
| CI-05 | No hay rollback ni redespliegue versionado (`workflow_dispatch`) | media | Confirmado | lectura de workflows | #39 | CICD-5 |
| CI-06 | Node sin fijar (`engines`/`.nvmrc`); `deploy-develop` sin `setup-node` | baja | Confirmado | `frontend/package.json`; `deploy-develop.yml:24-25` | #53 | C-08, DOC-3 |
| CI-07 | Sin observabilidad ni restauración probada en el repo | media | Confirmado (repo) | grep sin resultados | #54 / OND-5a4, #41 / OND-uxi | C-10, C-11 |
| CI-08 | `feature/administracion` borraría 352 archivos si se fusionara; `feature/ventas` ya está absorbida | media | Confirmado | `git diff --stat develop...origin/feature/administracion` | #57 | C-26 |
| TEST-01 | 99/99 pruebas en 15 archivos, casi todas con Supabase simulado; cero pruebas SQL, pgTAP o E2E | alta | Confirmado | `npm run test`; sin `supabase/tests` | #43 / OND-5r5, #40 | T-01–T-05 |
| TEST-02 | Sin pruebas en `ProtectedRoute`, `DashboardLayout`, `AuthProvider`, `Login` ni `lib/format.ts`; sin medición de cobertura; fixtures que dependen de la fecha real | media | Confirmado | `find src -name '*.test.*'`; `vitest.config.ts:15-20`; `Despachos.test.tsx:78` | **sin issue** (ver §8) | TEST-1–TEST-3 |
| TEST-03 | `npm audit`: 9 alertas (2C/4A/3M); sin dev, 2 altas (nanoid 3.3.17, source-map-js 1.2.1, corregibles sin salto mayor); la cadena Vitest exige el salto a 5.0.4 | media | Confirmado | `npm audit --json`, `--omit=dev` | #38 / OND-gu3 | T-06–T-09 |
| DOC-01 | Enlace roto al handoff kimi-k3 eliminado | media | Confirmado | `docs/archive/README.md:7` | #56 / OND-4qp | DOC-1 |
| DOC-02 | `docs/agents/tools.md:21` describe `@mem0/opencode-plugin`, que no carga en OpenCode 2; depende del trabajo en curso en `.opencode/` | baja | Confirmado | `docs/agents/tools.md:21` | #56 | DOC-2 |
| DOC-03 | `datos_planilla_manual_fisico.md` se eliminó en `edafa8b`, aunque el 09-10 se recomendó conservarlo | baja | Confirmado | `git log --diff-filter=D` | #56 | DOC-4 |
| DOC-04 | Brechas del handoff kimi-k3 sin issue: HU-05 (#6 sin cuerpo), `envases_recibidos` siempre 0, histórico del día del vendedor, confirmación con total persistido | media | Confirmado | `useRegistrarVenta.ts:21`; `RegistrarVenta.tsx:217-223` | #6, #56 | kimi-k3 |
| DOC-05 | RNF-01 (offline) sigue en conflicto con la retirada de HU-30; la decisión está pendiente | media | Confirmado | `docs/product/requirements.md:43` | #56 | D-06 |

## 7. Correspondencia con los trackers

| Área | GitHub | Beads | Hallazgos de esta auditoría |
| --- | --- | --- | --- |
| Vistas definidoras | #27 | OND-8ox | SEG-01 |
| Esquema y migraciones | #28 | OND-8wi | BD-01, BD-02, BD-03, BD-04 |
| RLS por sucursal/identidad | #29 | OND-58e | SEG-02–SEG-07 |
| RPC y grants | #30 | OND-ptq | SEG-02, SEG-03, SEG-05, SEG-06, SEG-08, BD-11 |
| Auditoría efectiva | #31 | OND-3dk | BD-02 (ya existe en el repo; falta verificarla en remoto) |
| Conservación de stock | #32 | OND-lpu | BD-04, BD-05, BD-06, SEG-06 |
| Devolución atómica | #33 | OND-rnd | BD-08, BD-09 |
| Comisiones históricas | #34 | OND-cop | BD-02, BD-10 |
| Zona horaria | #35 | OND-uoi | BD-10 |
| Sesión y borradores | #36 | OND-82e | FE-01, FE-02, SEG-09 |
| Sucursal del admin en producción | #37 | OND-y64 | FE-03 |
| Dependencias | #38 | OND-gu3 | TEST-03, SEG-10 |
| Publicación y checks | #39 | OND-get | CI-01, CI-02, CI-05 |
| Migraciones y pgTAP en CI | #40 | OND-eh8 | CI-03, BD-01 |
| Backups | #41 | OND-uxi | CI-07 |
| Concurrencia e idempotencia | #42 | OND-vi4 | BD-03, BD-08, BD-09, FE-02 |
| Recorridos por rol | #43 | OND-5r5 | TEST-01 |
| Auth | #44 | OND-d40 | SEG-02 |
| Cabeceras/CSP | #45 | OND-4hm | SEG-12 |
| Cadena de CI y secretos | #46 | OND-o5g | CI-04, SEG-10, SEG-11 |
| Índices | #47 | OND-vrn | BD-13 |
| Realtime | #48 | OND-0lg | BD-12, FE-07, FE-11 |
| Errores y estados | #49 | OND-tyz | FE-05, FE-06, FE-07, FE-11, FE-12 |
| Lazy loading | #50 | OND-683 | FE-08 |
| Tipos | #51 | OND-yew | FE-09, BD-02 |
| Accesibilidad | #52 | OND-53r | FE-10 |
| Entorno | #53 | OND-aeo | CI-06, FE-13 |
| Observabilidad | #54 | OND-5a4 | CI-07 |
| Abuso (decisión) | #55 | OND-roo | — (sin cambios) |
| Documentación y alcance | #56 | OND-4qp | DOC-01–DOC-05 |
| Ramas y PR | #57 | OND-2mt | CI-01, CI-08 |
| HU-10 … HU-23 | #58–#70 | OND-w76.1 … OND-w76.13 | BD-10, BD-11, BD-14, SEG-04, SEG-06, SEG-07 (ver §8) |
| HU-05 | #6 | **sin espejo** | DOC-04 |

## 8. Propuesta de cambios en los trackers (pendiente de confirmación)

Ninguno de estos cambios se ha aplicado. Cada cambio de GitHub debe hacerse junto con su espejo en Beads.

### 8.1 Issues nuevos

| Propuesta | Prioridad | Criterios de aceptación | Dependencias |
| --- | --- | --- | --- |
| **[P1][Backend] Rechazar importes no finitos en ventas, gastos y reglas** (BD-07) | P1 | Las restricciones y las RPC rechazan `NaN` en precio, descuento, total, gastos y reglas, incluido el JSON en string y los casts. Prueba de rollback sin escrituras parciales. Se mantienen el cálculo decimal y los precios históricos | #28, #30, #32 |
| **[P2][Clientes] Permitir alta y consulta administrativa de clientes por sucursal y vendedor** (FE-04) | P2 | El admin global elige un ámbito explícito. La ficha creada aparece sin recargar. El vendedor sigue limitado a su cartera. Cambiar de ámbito descarta las respuestas anteriores. Pruebas negativas en servidor aislado | #29, #37 |
| **[P2][Calidad] Cubrir guards, sesión y helpers compartidos con pruebas unitarias y cobertura** (TEST-02) | P2 | Pruebas de `ProtectedRoute`/`DashboardLayout` con rol esperado y ajeno, perfil nulo e inactivo, y variantes de URL. Prueba de restauración en `AuthProvider`. Pruebas de `format.ts`. Reloj fijo en las pruebas de bodega. `vitest --coverage` con un umbral inicial documentado | #36, #43 |
| **Espejo de #6 en Beads**: `OND-w76.14`, hijo de `OND-w76` | P3 | Ver 8.3 | — |

### 8.2 Ediciones de issues existentes (título/cuerpo; prioridad sin cambios salvo indicación)

| Issue | Edición propuesta |
| --- | --- |
| #27 / OND-8ox | Ampliar a las **ocho** vistas definidoras (SEG-01). Fechar las filas 15/2 del 09-10. Añadir a la aceptación: inventario de propietario, ACL y default privileges. Mantener P0 hasta que se verifique la contención. |
| #28 / OND-8wi | Añadir BD-02 (divergencia en ambos sentidos, incluida `jornada`), BD-03 (backfill no idempotente) y BD-04. Exigir instalación limpia **y** actualización ensayada con datos sintéticos. |
| #29 / OND-58e | Reconocer que 0008/0010 ya endurecen producción, incidencias y mermas en el repo. Ampliar la matriz a `despacho_detalles`, `despacho_envases`, `carga_vendedor`, `stock_envases`, `ubicaciones`, perfiles inactivos (`mi_sucursal`) y `creado_por` (SEG-02–SEG-05, SEG-07). Corregir la referencia antigua OND-8ox → OND-58e. |
| #30 / OND-ptq | Precisar que `registrar_venta` ya está revocada para anon y que `crear_despacho` es INVOKER. Añadir rol y `activo` en `registrar_venta`, EXECUTE PUBLIC restante, autor de fila frente a autor del log, `es_ajuste`/`anulado` decididos en el servidor y validación de forma JSON y catálogo activo (SEG-06, SEG-08, BD-11). |
| #31 / OND-3dk | Retitular: "Reconciliar y verificar la auditoría efectiva de operaciones". El repo ya define 11 triggers de auditoría; falta el catálogo antes/después, el motivo en las correcciones y la auditoría de saldos y reglas. |
| #32 / OND-lpu | Añadir los casos T3–T8 y T12 como criterios: envase único entre venta, retorno y producción; anulación con devolución parcial; compensación con OLD; INSERT anulado; reactivación repetida; recálculo de descuento. |
| #33 / OND-rnd | Distinguir el registro inicial (separado) de la RPC de corrección (ya conjunta). Añadir la agregación por producto y el bloqueo del padre (BD-08). |
| #34 / OND-cop, #35 / OND-uoi | #35: sustituir "la comisión sí usa Santiago" por "ni ranking ni comisión convierten la zona en las migraciones". #34: añadir la divergencia bruto/neto, mes/jornada y el solapamiento de reglas. |
| #36 / OND-82e | Añadir SEG-09 (variantes de URL) y FE-02 (borrador que reaparece), y la limpieza de caché por identidad. |
| #38 / OND-gu3 | Actualizar a vitest 5.0.4; nanoid 3.3.18 y source-map-js 1.2.2 sin salto mayor; indicar que "sin dev" no implica que el paquete llegue al bundle. |
| #39 / OND-get | Añadir el estado verificado el 13-10: `develop` sin protección, sin checks requeridos, environment con 4 revisores, deployments duplicados (IDs) y la falta de rollback versionado (CI-01, CI-02, CI-05). |
| #40 / OND-eh8 | Añadir que el check pasa en vacío y no detecta 0007; enlazar con CI-01 para que sea obligatorio. |
| #46 / OND-o5g | Añadir: secret scanning, push protection y Dependabot deshabilitados (SEG-10); secretos a nivel de repo y token en `run:`; sin `timeout-minutes`; resultado del escaneo de historial (SEG-11). |
| #48 / OND-0lg | Añadir: el repo publica tres tablas, sin `mermas`; extraer la suscripción del componente (FE-11). |
| #49 / OND-tyz | Ampliar a ventas y catálogo, respuestas obsoletas (FE-06), frescura (FE-07), carga agotada (FE-12) y `Dashboard.tsx`. Aclarar que RLS puede devolver `[]` sin error. |
| #51 / OND-yew | Añadir la diferencia de nullable en `sucursal_id` y los casts en RPC. |
| #52 / OND-53r | Añadir `lang="es"`, título y Toast con `aria-live`; excluir despacho, que ya tiene labels. |
| #56 / OND-4qp | Añadir DOC-01–DOC-05; marcar como cumplida la coherencia de HU-05/18/30 en `docs/status/user-stories.md`. |
| #57 / OND-2mt | Añadir el impacto de `feature/administracion` (352 archivos) y que `feature/ventas` ya está absorbida. |
| #59, #60, #62 | Sustituir "la vista no existe" por "la vista existe en 0001; reconciliar con remoto y asegurar `security_invoker`". #62: añadir BD-14. |
| #64 / OND-w76.7 | Añadir que bodega lee GPS de todas las sucursales (SEG-04). |
| #66 / OND-w76.9 | La guarda temporal actual se evade con `es_ajuste=false`: la corrección de seguridad va en #30; #66 queda para la UI. |
| #69 / OND-w76.12 | Sustituir "no hay buckets" por "remoto sin buckets el 09-10; el repo crea un bucket con políticas amplias" (SEG-07). |

Sin cambios: #37, #41, #42 (solo añadir referencias), #43, #44, #45, #47, #50, #53, #54, #55, #58, #61, #63, #65, #67, #68, #70.

### 8.3 Issue #6 (HU-05) y #58

- **#6:** **no cerrarlo** como implementado ni como retirado, porque `docs/status/user-stories.md:14` deja el alcance por confirmar. Propuesta: retitular a **"[P3][Ventas] HU-05: ratificar la consulta de bidones vacíos de la ruta"**, añadir un cuerpo con la decisión pendiente, el rol, la acumulación por jornada y el origen de los envases (`envases_recibidos` hoy siempre es 0), poner las etiquetas `question` y `documentation`, y crear su espejo `OND-w76.14` bajo la épica `OND-w76` con `external_ref` a #6.
- **#58:** sin cambios. El enlace es único (`OND-w76.1`); la épica no tiene `external_ref`.
- **Beads:** añadir las dependencias reales que faltan: nuevo issue NaN → OND-8wi; nuevo issue de clientes admin → OND-58e; nuevo issue de pruebas → OND-82e.

## 9. Lo que se mantiene bien

- La transaccionalidad de `registrar_venta` y `crear_despacho`, y los bloqueos `FOR UPDATE` en movimientos.
- Precios históricos congelados en los detalles; dinero en `NUMERIC(12,2)`, cantidades enteras y `timestamptz`.
- `es_rol()` comprueba `activo`; la política de UPDATE de `perfiles` es solo para administración (no hay autoescalada local).
- Workflows con `concurrency`, `npm ci` con lockfile v3, `contents: read` en los despliegues y sin `pull_request_target`.
- Ningún secreto privilegiado en el historial alcanzable.
- Documentación reestructurada coherente: un único enlace roto en 111 enlaces revisados.
