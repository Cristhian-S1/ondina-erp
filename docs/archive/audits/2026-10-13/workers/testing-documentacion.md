# Testing y Documentación — verificación de la auditoría 2026-10-09

Worker: Testing y Documentación (opencode / deepseek-v4.1-flash) · Orca `run_af5dd59a6889` · Beads OND-c2z · 2026-10-13.
Checkout compartido `develop` en `a0a8f65` (solo lectura; el único archivo escrito es este informe). Comandos permitidos ejecutados desde `frontend/`.

## Resumen

1. Ejecuté `npm run lint`, `npm run test -- --reporter=dot` (dos veces), `npm run build`, `npm audit --json` y `npm audit --omit=dev --json`. Todo reproducible: lint/build exit 0, suite 99/99 en dos corridas consecutivas sin fallos ni advertencias de `act`.
2. Se confirma el perfil del 09-10 en pruebas: **15 archivos, 99 pruebas, capas mayormente simuladas** (73/99 usan mocks; 44 son servicios con cliente Supabase simulado) y **cero pruebas contra RLS/triggers/pgTAP reales**, sin suite E2E ni k6.
3. Build sin regresión de tamaño: JS 911,39 kB (258,90 gzip) y CSS 289,61 kB (43,26 gzip), con la advertencia de chunk >500 kB aún presente; `tsc -b` sin errores.
4. `npm audit` mantiene **9 alertas (2 críticas, 4 altas, 3 moderadas)**; sin desarrollo quedan **2 altas: nanoid 3.3.17 y source-map-js 1.2.1**. La Vite transitoria vulnerable sigue siendo la 5.4.21 anidada en vitest/vite-node, no la Vite directa 8.2.0. El arreglo de la cadena Vitest exige salto mayor (npm propone hoy vitest 5.0.4; la auditoría decía 5.0.3).
5. La documentación fue reestructurada después del 09-10 (commits `55d6c0f`, `edafa8b`): casi todas las afirmaciones de la sección 10 quedaron desactualizadas y la mayoría de las correcciones de la sección 7 ya no aplican.
6. Revisé 111 enlaces relativos y sus anclas en 31 archivos Markdown: **1 enlace roto**, en `docs/archive/README.md` hacia el handoff kimi-k3 eliminado en `a0a8f65`; no quedan referencias activas a los archivos borrados en `97f9258` (lockfile y `opencode.json` de la raíz).
7. Hallazgos nuevos relevantes: cobertura automatizada ausente en 7/16 páginas (todo el dominio administración, guards de rol, auth y `lib/`); prosa de Mem0 en `docs/agents/tools.md` desalineada con el estado real del plugin; y detalles menores de fijación de Node y fechas base.
8. Todos los comandos citados en la documentación vigente (`bd prime/ready/stats/...`, `codegraph explore/sync/status`, scripts npm, `scripts/bootstrap-beads.sh`, `orca skills get`) existen y responden; `--claim` de `bd update` está disponible.

## Evaluación de afirmaciones de la auditoría 2026-10-09

Evidencia de comandos abreviada: `lint=0`, `test=0 (15 files/99 tests, ×2)`, `build=0`, `audit=1 (hallazgos)`, `audit --omit=dev=1`.

| ID | Afirmación (resumen) | Veredicto | Evidencia | Redacción propuesta |
| --- | --- | --- | --- | --- |
| T-01 | "99/99 pruebas, 15 archivos" | confirmada | `npm run test -- --reporter=dot`: `Test Files 15 passed (15)`, `Tests 99 passed (99)` en dos corridas (00:30 y 00:33) | — |
| T-02 | "Predominan servicios simulados" | confirmada | 12/15 archivos mockean `@/lib/supabase`; 44 pruebas son de servicios con cliente simulado y 29 de páginas con `api`/`catalog` simulados; solo 26 son lógica pura (schemas/validación/calculo) | — |
| T-03 | "no prueban RLS ni triggers reales" | confirmada | No existe `supabase/tests/`, pgTAP ni pruebas SQL; todas las interacciones Supabase están mockeadas (`vi.mock`); `supabase/` solo contiene `.gitignore` y `migrations/0001-0010` | — |
| T-04 | "No hubo Playwright MCP disponible" / sin suite E2E | confirmada | Sin `playwright.config`, `cypress`, `e2e/`, `k6/` ni specs equivalentes; `.playwright-mcp/` solo contiene logs ignorados de agosto (`.gitignore:27`, `git check-ignore` lo confirma) | — |
| T-05 | Sección 13: recomendar pgTAP por rol (transacciones/rollback) | confirmada (recomendación vigente) | `ci.yml` `migrations-check` (líneas 48–71) solo comprueba la presencia de `;`; no hay entorno Supabase local versionado (`supabase/config.toml` ausente) | — |
| T-06 | OND-gu3: "9 alertas: 2 críticas, 4 altas, 3 moderadas" | confirmada | `npm audit --json` → `{"critical":2,"high":4,"moderate":3,"total":9}`: críticas tinypool 1.1.1 y vitest 2.1.9; altas brace-expansion 5.0.9, nanoid 3.3.17, source-map-js 1.2.1 y vite 5.4.21 (anidada); moderadas @vitest/mocker, esbuild, vite-node | — |
| T-07 | "Al excluir desarrollo permanecen 2 altas: nanoid y source-map-js" | confirmada | `npm audit --omit=dev --json` → 2 high: nanoid (rango `<3.3.18`) y source-map-js (`1.0.0–1.2.1`). Cadenas: nanoid←postcss@8.5.25←vite@8.2.0 (y @tailwindcss); source-map-js←@tailwindcss/node@4.3.3 y postcss | — |
| T-08 | "La recomendación automática para Vitest implica un cambio mayor a 5.0.3" | parcial / desactualizada en la versión | `npm audit` hoy reporta `fixAvailable: vitest@5.0.4 (isSemVerMajor: true)`; el fondo (salto mayor obligatorio) sigue vigente. Nota: nanoid y source-map-js sí tienen arreglo no mayor (`fixAvailable: true`) | "npm propone vitest 5.0.4 (cambio mayor); nanoid/source-map-js se corrigen sin salto mayor" |
| T-09 | "No significa que la Vite directa 8.2.0 sea esa versión vulnerable" | confirmada | El advisory [`vite <=6.4.2`](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) apunta solo a `node_modules/vitest/node_modules/vite` y `node_modules/vite-node/node_modules/vite` (ambas 5.4.21); `npm run build` usa `vite v8.2.0` | — |
| T-10 | "migrations-check solo busca un punto y coma" | confirmada | `.github/workflows/ci.yml:63-71`: `grep -q ";"` por archivo, "Sintaxis SQL basica OK" | — |
| D-01 | README "contradice su propio contenido; exigía un archivo inexistente" | desactualizada (corregida) | `README.md:1-47`: describe el estado real, quick start válido (`frontend/.env.example` existe), enlaces correctos | — |
| D-02 | AGENTS.md con "comando bd statistics inválido" | desactualizada (corregida) | `AGENTS.md:16` usa `bd prime`/`bd stats`, ambos funcionan (`bd stats` y `bd prime` existen en bd 1.0.4) | — |
| D-03 | "docs/estado-historias-usuario.md" como inventario histórico | desactualizada (reemplazada) | Sustituida por `docs/status/user-stories.md` + `docs/product/stories/`; sin referencias activas al nombre viejo fuera de informes archivados | — |
| D-04 | Sección 10: mover/eliminar setup-vercel, merge-pr-guide, plan-mejoras, superpowers, handoffs, verificacion-preview, referencia_archivos | mayormente desactualizada; un enlace nuevo roto | Esos archivos ya no están en el árbol activo y no se referencian salvo en informes archivados; **pero** `docs/archive/README.md:7` enlaza `audits/2026-10-09/kimi-k3-frontend-ventas.md`, eliminado en `a0a8f65` (ver DOC-1) | Eliminar/actualizar el enlace de la fila 2026-10-09 del índice de archivo |
| D-05 | Sección 7: "16 completas, 3 parciales…", HU-13 duplicada, HU-06 "eliminada" | desactualizada (matriz reescrita) | `docs/status/user-stories.md` usa Present/Partial/Placeholder y cita HU-13 una sola vez; HU-06 figura "Deferred"; "no copy historical test counts" (línea 54) | — |
| D-06 | RNF offline (RNF-01) contra HU-30 retirada y cierre (HU-18) | parcial (contradicción subsiste, correctamente señalada) | `docs/product/requirements.md:43` conserva RNF-01; `docs/product/context.md:48` la registra como decisión pendiente ("Offline y cierre"); `docs/status/user-stories.md:52` y `stories/README.md:13` explican la retirada sin reclamar entrega. OND-4qp sigue abierto | — |
| D-07 | "docs/datos_planilla_manual_fisico.md / reunión: conservar" | no cumplida en el árbol activo | Eliminado en `edafa8b` (2026-10-12, "streamline skills and project documentation"); copia solo en `.local-backups/2026-10-12-english-docs/source/docs/` (ignorado) y en Git; nada lo enlaza (ver DOC-4) | Ratificar con negocio la retirada o trasladarlo a `docs/archive/` con rótulo histórico |
| D-08 | "bd/*.sql: conservar" | confirmada | `bd/` mantiene 9 archivos (`auditoria.sql`, `ondina_schema_supabase.sql`, `rls_policies.sql`, `triggers_negocio.sql`, `vistas.sql`, etc.) | — |

## Hallazgos nuevos

### TEST-1 — Cobertura automatizada ausente en 7/16 páginas y en piezas sensibles · severidad media · confirmado

- **Evidencia:** páginas sin prueba: `frontend/src/domains/administracion/pages/{Administracion,Auditoria,Reportes,Ubicaciones}.tsx`, `frontend/src/domains/ventas/pages/{Ventas,MiComision,RankingVendedores}.tsx`; sin pruebas los componentes de guardia/routing `frontend/src/components/ProtectedRoute.tsx` y `DashboardLayout.tsx`, `AuthProvider`/`Login` (`frontend/src/context/AuthProvider.tsx`, `frontend/src/pages/Login.tsx`) y `frontend/src/lib/{format,errors,catalog,ui}.ts`. Con prueba: 9/16 páginas (bodega ×3, producción ×1, ventas ×5).
- **Comando:** `find src -name "*.test.*"` (15 archivos) contra `find src/domains -path "*pages*" -name "*.tsx" -not -name "*.test.tsx"` (16 páginas).
- **Impacto:** las rutas de autorización visual (`ProtectedRoute`/`DashboardLayout`) y el formato es-CL (usado en toda la UI) no tienen regresión automatizada; un cambio en guards o en `format.ts` solo se detectaría en pruebas de páginas concretas o manualmente. La brecha de administración es coherente con ser placeholder, pero el guard y `format.ts` son código activo.
- **Issue:** parcialmente relacionado con #43 / OND-5r5 (que cubre recorridos reales por rol, no unitarias). `sin issue (proponer)`: **"Cubrir con pruebas unitarias guards de rol, auth y helpers compartidos"**. Criterios de aceptación: (1) pruebas de `ProtectedRoute`/`DashboardLayout` para rol esperado/no esperado, perfil nulo e inactivo; (2) pruebas de `format.ts` (formatMiles/parseMiles/formatMilesInput) incluyendo entradas vacías; (3) al menos una prueba de restauración de sesión en `AuthProvider` (carrera OND-82e documentada); (4) `npm run test` y lint verdes.

### TEST-2 — Sin medición de cobertura ni umbral en CI · severidad baja · confirmado

- **Evidencia:** `frontend/package.json:6-13` no define script de cobertura; `frontend/vitest.config.ts:15-20` no configura `coverage`; no hay dependencia `@vitest/coverage-*`; `ci.yml:39-46` corre lint/build/test sin métrica de cobertura.
- **Comando:** lectura de `package.json`, `vitest.config.ts`, `ci.yml`; `grep -c engines` y búsqueda de `coverage` sin resultados.
- **Impacto:** la cobertura efectiva (72,3 % de archivos de prueba sobre páginas, 0 en administración) no es visible ni accionable en revisiones; el hallazgo TEST-1 puede repetirse sin que CI lo señale.
- **Issue:** `sin issue (proponer)`: **"Publicar cobertura de pruebas Vitest con umbral mínimo acordado"**. Criterios: (1) `vitest run --coverage` reproducible en local y CI; (2) umbral inicial conservador documentado (p. ej. líneas ≥ 60 %) que no rompa la integración actual; (3) el informe/artefacto queda disponible en CI; (4) sin cambios de alcance funcional.

### TEST-3 — Fixtures dependientes de la fecha real sin congelar el tiempo · severidad baja · probable

- **Evidencia:** `frontend/src/domains/bodega/pages/Despachos.test.tsx:78` y `frontend/src/domains/bodega/pages/Devoluciones.test.tsx:78` construyen `creado_en: new Date().toISOString()` para alimentar filtros "Hoy" (`Despachos.tsx:130` `diaFiltro` inicial `'hoy'`). No se usa `vi.useFakeTimers`/`setSystemTime` en ningún test.
- **Comando:** `npm run test -- --reporter=dot` ×2 (ambas 99/99, sin flake observado); grep de `new Date(|useFakeTimers`.
- **Impacto:** si la creación del fixture y el filtro de la página caen a distinto lado de la medianoche local, la prueba puede volverse intermitente; no se observó en dos corridas. Riesgo bajo pero eliminable fijando el reloj.
- **Issue:** `sin issue (proponer)`; puede resolverse dentro de una tarea de mantenimiento de pruebas o al endurecer #43. Criterios: (1) `vi.setSystemTime` con hora fija en las pruebas de bodega dependientes de "hoy"; (2) las dos corridas de la suite siguen verdes; (3) sin cambios de comportamiento.

### DOC-1 — Enlace roto en `docs/archive/README.md` hacia el handoff kimi-k3 eliminado · severidad media · confirmado

- **Evidencia:** `docs/archive/README.md:7` enlaza `audits/2026-10-09/kimi-k3-frontend-ventas.md`; el archivo fue eliminado por `a0a8f65` ("docs(audits): remove superseded kimi-k3 frontend ventas audit", 2026-10-13 00:04). El propio README indica (línea 11) que los walkthroughs obsoletos son recuperables en Git `55d6c0f`; el handoff kimi-k3 está entre ellos.
- **Comando:** verificador de enlaces (111 enlaces en 31 `.md`) + `git show --stat a0a8f65`.
- **Impacto:** un lector del índice histórico recibe un 404; rompe la promesa de "cada evidencia referenciada existe". Es el único enlace roto del árbol de documentación.
- **Issue:** relacionado con #56 / OND-4qp (documentación). Edición sugerida (una línea): quitar el enlace `[Kimi handoff](audits/2026-10-09/kimi-k3-frontend-ventas.md)` de esa fila o sustituirlo por "(handoff kimi-k3 retirado; recuperable en Git `55d6c0f`)" al estilo de la línea 11.

### DOC-2 — `docs/agents/tools.md` afirma que el repo declara `@mem0/opencode-plugin`; desalineado con el estado real · severidad media · confirmado (estado de trabajo) / parcial (HEAD)

- **Evidencia:** `docs/agents/tools.md:21` — "The repo declares `@mem0/opencode-plugin`; verify compatibility with the installed client". En HEAD, `.opencode/opencode.json` solo contiene `"plugin": ["@mem0/opencode-plugin"]`; en el árbol de trabajo esa entrada ya fue eliminada (cambio sin commitear de otra sesión) y existe el plugin local `.opencode/plugins/mem0/` (`index.ts`, 7 skills `mem0-*`, `index.test.ts`, `README.md`). La tarea OND-aor (cerrada) documenta que el paquete npm es API V1 y falla al cargar en OpenCode 2 (`PluginModule.LoadError`; upstream mem0ai/mem0#7602).
- **Comando:** `git show HEAD:.opencode/opencode.json`; `cat .opencode/opencode.json`; `find .opencode/plugins -type f`.
- **Impacto:** la guía de herramientas envía a verificar un plugin que ya no es la vía soportada y que se sabe incompatible con OpenCode 2; un agente nuevo seguiría el camino roto. El cambio local reducirá el problema cuando se integre, pero la frase debe actualizarse entonces (y hoy ya es inexacta en el árbol de trabajo).
- **Issue:** relacionado con #56 / OND-4qp; referencia OND-aor (cerrado). Edición sugerida: "OpenCode 2 monta el plugin local `.opencode/plugins/mem0` (identidad Mem0 desde el remote Git); el paquete npm `@mem0/opencode-plugin` ≤0.4.1 es API V1 y no carga en OpenCode 2". Confirmar antes que el cambio de `.opencode/` esté commiteado en la rama de integración.

### DOC-3 — Sin pin de versión Node pese a la recomendación del README · severidad baja · confirmado

- **Evidencia:** `README.md:12` ("Use Node.js 22.12 or later"); `frontend/package.json:1-48` sin campo `engines`; no existe `.nvmrc` en raíz ni en `frontend/`; `ci.yml:32` y `deploy-prod.yml:30` usan `node-version: 22`; el host local corre `v26.3.1` (no certificado con la suite en esta auditoría).
- **Comando:** `node --version`; `grep -c engines frontend/package.json` (0); `ls .nvmrc` (ausente); grep `node-version` en workflows.
- **Impacto:** los tres entornos (local 26, CI 22, Vercel por verificar) no comparten una política fija; la instalación limpia bajo las tres versiones sigue sin certificarse. Ya cubierto por #53 / OND-aeo; el README podría ser más preciso mientras tanto.
- **Issue:** #53 / OND-aeo. Edición sugerida (opcional): en README, "Desarrollo/CI con Node 22 (CI fija `node-version: 22`); no hay pin `engines`/`.nvmrc` todavía (ver #53)".

### DOC-4 — `datos_planilla_manual_fisico.md` retirado del árbol activo pese a la recomendación "Conservar" · severidad baja · confirmado

- **Evidencia:** eliminado en `edafa8b` (2026-10-12, 70 líneas, "docs(agents): streamline skills and project documentation"). Los únicos restos: `.local-backups/2026-10-12-english-docs/source/docs/datos_planilla_manual_fisico.md` (directorio ignorado por Git, `git check-ignore .local-backups/`) y el historial Git. Nada en `docs/` lo enlaza. La auditoría 2026-10-09 pedía "Conservar; revisar cualquier dato personal antes de compartir nuevos extractos".
- **Comando:** `git log --diff-filter=D -- docs/datos_planilla_manual_fisico.md`; verificación de existencia en backup y de referencias (sin resultados en el árbol activo).
- **Impacto:** evidencia de levantamiento de negocio (planilla manual) ya no vive en el árbol documental; queda recuperable por Git, pero si el equipo la consideraba fuente de requisitos, el README de docs ("Remove obsolete walkthroughs…") no cubre este caso explícitamente.
- **Issue:** relacionado con #56 / OND-4qp. Acción sugerida: ratificar la retirada o reincorporarlo rotulado como histórico si aporta a las decisiones comerciales pendientes.

### DOC-5 — Fecha/commit base del estado de HU queda por detrás de HEAD (solo docs después) · severidad baja · confirmado

- **Evidencia:** `docs/status/user-stories.md:3` — "Code review baseline: `develop` commit `55d6c0f`, 2026-10-12". HEAD es `a0a8f65`; `git log 55d6c0f..develop -- frontend/ supabase/ bd/` no devuelve commits, es decir, ningún cambio de código o esquema desde la base declarada (solo docs/configuración: `97f9258`, `26318d3`, `bae1ca2`, `a0a8f65`).
- **Comando:** `git log --oneline 55d6c0f..develop -- frontend/ supabase/ bd/` (vacío); `git rev-parse HEAD`.
- **Impacto:** bajo; la matriz sigue describiendo el mismo código, pero un lector puede creer que `55d6c0f` es HEAD. Sugerencia: añadir "(última revisión de código; HEAD de documentación `a0a8f65`)" o bumpear la base en la próxima revisión.
- **Issue:** relacionado con #56 / OND-4qp.

## Issues revisados

Lectura de los snapshots de trackers (sin editar); contexto de Beads y GitHub al 2026-10-13.

- **#38 · OND-gu3 — "[P1][Seguridad] Actualizar dependencias vulnerables y el lockfile con regresión" (abierto).** Sigue **preciso**. Sugerencias concretas: (1) añadir al cuerpo la evidencia del 13-10: `npm audit` = 9 (2C/4A/3M) igual que el 09-10; `--omit=dev` = 2 altas con versiones instaladas nanoid 3.3.17 y source-map-js 1.2.1; cadenas postcss/@tailwindcss y vite anidada 5.4.21; (2) precisar el arreglo: nanoid→3.3.18 y source-map-js→1.2.2 son no mayores; la cadena Vitest (tinypool 1.1.1, esbuild, @vitest/mocker, vite-node, vite 5.4.21 anidada) requiere salto mayor — npm hoy propone **vitest 5.0.4** (el cuerpo dice 5.0.3); (3) mantener la advertencia vigente de no confundir la Vite directa 8.2.0 (no vulnerable) con la transitoria; (4) los criterios de aceptación existentes ("escalar/limpiar tras el cambio, harness verde, auditoría actual documentada") siguen siendo los correctos.
- **#43 · OND-5r5 — "[P1][Calidad] Probar recorridos completos de cada rol contra Supabase aislado" (abierto).** Sigue **preciso**. Evidencia adicional útil: la suite actual no toca RLS/triggers (todo simulado), no hay E2E/k6 y `migrations-check` solo valida `;`; esto refuerza que los recorridos por rol no están cubiertos por lo existente. No requiere cambios de redacción; sugerir enlazar este informe y mantener la dependencia con #40 (pgTAP/CI). Considerar añadir como sub-ítem la brecha de pruebas unitarias de guards/auth (TEST-1) si se decide ampliar alcance.
- **#56 · OND-4qp — "[P2][Documentación] Ratificar alcance, dominio y estado verificable de las HU" (abierto).** **Parcialmente avanzado** por la reestructuración documental (matriz reescrita, stories por dominio, README/AGENTS al día, HU-05/18/30 descritas coherentemente). Ediciones sugeridas: (1) marcar en el checklist que "HU-05/18/30… coherentemente" ya se cumple en `docs/status/user-stories.md:52` y `stories/README.md:12-14`; (2) añadir la corrección de DOC-1 (enlace kimi-k3) como evidencia de mantenimiento de referencias; (3) incorporar las decisiones pendientes de DOC-2 (mem0) y DOC-4 (planilla manual); (4) mantener abierta la ratificación de negocio (offline/cierre, ventana 10–20, descuentos/comisión), que sigue sin resolver.
- **#53 · OND-aeo — "[P2][Repositorio] Hacer reproducible el entorno de desarrollo y configuración" (abierto).** Sigue **preciso**. Añadir al problema: no existe `engines` ni `.nvmrc` (README dice "Node 22.12 or later"; CI usa 22; host local v26.3.1); la raíz no tiene `package.json`, por lo que el hook Orca soportado es `npm ci --prefix frontend` según `docs/orchestration/setup.md:33` (evidencia del `ERR_PNPM_NO_PKG_MANIFEST`). Criterio de aceptación sugerido: "existe un pin de runtime (engines/.nvmrc) replicado por CI/Vercel y una instalación limpia lo respeta". Dependencia con #28 vigente.

## Límites

- **No verifiqué el catálogo remoto** de Supabase ni escrituras contra él: las afirmaciones de RLS/triggers/vistas remotas quedan fuera de mi área y corresponden a otros workers; aquí solo constaté que **no existen pruebas SQL** que las cubran.
- **No ejecuté `npm ci` ni instalación limpia** (prohibido por la tarea): el cumplimiento del lockfile y la reproducibilidad exacta bajo Node 22 no quedaron certificados; tampoco `npm audit fix`.
- **No comparé el histórico de advisories**: solo el estado actual de `npm audit`. La fecha exacta de publicación/cambio de cada advisory no es verificable sin red adicional.
- **Configuración remota de Vercel/GitHub** (reviewers, protección de ramas, Node runtime en Vercel, proyectos) no verificada: solo comparé lo declarado en `docs/engineering/deployment.md` contra los workflows del repositorio, que coinciden.
- **Orca/Codex/Claude/OpenCode**: verifiqué sintaxis de los comandos `orca` citados y `orca skills get` como humo, pero no el comportamiento de clientes ni la selección de skills; los comandos de Orca dependen del ejecutable de la sesión (`setup.md` lo advierte).
- **Idioma de las 19 skills**: la afirmación "All 19 entrypoints use English" (`docs/skills.md:22`) no se validó skill por skill en esta pasada; el informe archivado del 12-10 documenta esa verificación estructural, que no repetí.
- **Fechas futuras**: "hoy" = 2026-10-13; los conteos de npm pueden cambiar si se actualizan dependencias o advisories después de esta fecha.
