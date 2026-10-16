# I1 · Ensayo local de integración de PR

Fecha: 2026-10-15, sesión s2. Responsable: Codex. Worktree: `k1-bodega`.

## Veredicto y orden recomendado

Los dos ensayos solicitados y un ensayo conjunto adicional terminaron correctamente. Recomiendo integrar **#87 → #91** para establecer los controles de CI/despliegue y después **#84 → #89 → #90** para partir del shell y las rutas diferidas antes de añadir observabilidad y recuperación. Esta recomendación es técnica: #84 sigue descrita como PR draft de CI y «do not merge»; el responsable debe levantar esa restricción y obtener las revisiones correspondientes antes de una integración real.

Dentro del grupo frontend, el orden alternativo #89 → #90 → #84 no reduce los conflictos: un preensayo virtual con `git merge-tree --write-tree` encontró dos bloques de importaciones en `App.tsx`, igual que el orden solicitado. No se creó `prueba/integ-89-90-84`, porque no se cumplió la condición de una reducción clara. El preensayo resolvió la unión de importaciones en un índice temporal; no modificó el árbol de trabajo.

El ensayo conjunto reutiliza los merges ya resueltos de frontend sobre el ensayo CI. Comprueba el estado final de ambos grupos, pero no pretende medir el número de conflictos de cada rebase individual del orden global recomendado. Los conflictos adicionales entre grupos se documentan abajo para que esos rebases no descarten controles.

No hubo push, creación de PR, comentarios en GitHub, cambios de configuración remota, despliegues ni ejecución de SQL. No se ejecutó `test:integration`. Los merges pueden incorporar archivos que ya pertenecían a los PR; no se escribieron cambios de esquema ni se aplicaron configuraciones Supabase. Se preservaron las ramas y los worktrees de otras sesiones.

## Referencias congeladas

Se ejecutó `git fetch origin` y se leyeron, mediante `gh pr view <n>`, las descripciones de las cinco entregas. Todas apuntaban a `develop`.

| Referencia | SHA ensayado |
| --- | --- |
| `origin/develop` | `6903f59e66bcd49c1c14b20fbfe57271b0c7a353` |
| [#84 · frontend UX](https://github.com/Cristhian-S1/ondina-erp/pull/84) | `8d2a3e86b17e7d8be2f9ba3b4907214a72d4e8c1` |
| [#89 · observabilidad](https://github.com/Cristhian-S1/ondina-erp/pull/89) | `c4f40badd745ba30952ff666373210b6a508f0e0` |
| [#90 · recuperación](https://github.com/Cristhian-S1/ondina-erp/pull/90) | `55846b8679a3dd0100376bbcdcd7665cb54fa173` |
| [#87 · CI hardening](https://github.com/Cristhian-S1/ondina-erp/pull/87) | `3ced55a93c6b2bc3c4488470ea6ed9f57047a144` |
| [#91 · Vercel](https://github.com/Cristhian-S1/ondina-erp/pull/91) | `4f84cec2aaf8e52b6eb5040e05a845e01c7d2520` |

| Rama local de ensayo | SHA final | Composición |
| --- | --- | --- |
| `prueba/integ-84-89-90` | `aeaf8e82915aa4f04deccdf633fe0cc607396ee3` | develop + #84 + #89 + #90 + ajuste del guard de bundle |
| `prueba/integ-87-91` | `5a31780f5b7d0419179ae0fdcf44808bfbd08437` | develop + #87 + #91 |
| `prueba/integ-conjunta-87-91-84-89-90` | `426215cf3b3bd7c90076e0ce55c50b22169abf28` | ensayo CI + ensayo frontend, con las resoluciones entre grupos |

El informe se entrega en `Cristhian-S1/i1-informe`, creada desde el SHA indicado de `origin/feature/frontend-ux`; esa rama contiene únicamente el informe nuevo. Las ramas de ensayo no se han publicado.

## Conflictos y resoluciones

Las líneas siguientes corresponden al resultado de la rama indicada. Para inspeccionar una resolución completa sin depender de números de línea: `git show --remerge-diff <SHA-del-merge> -- <archivo>`.

### Grupo frontend: dos conflictos de importación en un único archivo, `App.tsx`

1. **#84 sobre develop:** sin conflictos; merge `67cefc02b9b5344194d98c1ba51c9764947de1ea`.
2. **#89 después de #84:** un bloque de importaciones, `frontend/src/App.tsx:1`. Se unieron `lazy`, `Suspense` y `useSyncExternalStore`, además de los imports de observabilidad. Merge `c060c04cee3508569d6237c7ded930c329af462e`. Se mantuvieron `AuthenticatedRoutes` y su importación paralela diferida del layout, dashboard y dominios, y el aviso con referencia de mutación de #89.
3. **#90 después de #89:** un bloque de importaciones en el mismo lugar; se conservó la misma unión. Merge `7b04fdbbe3b31c33cb5b45117b973e48f7838139`. Las rutas públicas de recuperación se integraron automáticamente fuera de `ProtectedRoute`; no se duplicaron registros ni se adelantó la descarga del shell autenticado.

`main.tsx`, `ErrorBoundary.tsx`, `Login.tsx` y `ProtectedRoute.tsx` se fusionaron automáticamente, pero se revisó su resultado. Evidencia en `prueba/integ-84-89-90`:

- `frontend/src/main.tsx:14` conserva `MutationCache` observable; `:25` conserva la supresión del log crudo de errores capturados y `:30` contiene el único montaje productivo de `ErrorBoundary`.
- `frontend/src/App.tsx:9` mantiene el shell diferido; `:47` suscribe la referencia de mutaciones; `:58` registra una vez cada ruta pública `/login`, `/recuperar` y `/restablecer`.
- `frontend/src/pages/Login.tsx:54` y `:69` conservan labels e ids; `:62` y `:78` vinculan el error; `:82` conserva el botón para mostrar contraseña; `:94` muestra el estado tras restablecerla y `:109` conserva el enlace de recuperación.
- `frontend/src/components/ProtectedRoute.tsx:12` desvía una sesión de recuperación antes de evaluar perfil y roles. `frontend/src/context/AuthProvider.tsx:73` bloquea perfiles inactivos y `:97` identifica recuperación antes de cargar el perfil ERP. Se conserva el aislamiento de caché por identidad y sucursal.
- Una comprobación de los arrays `routes` de los dominios encontró **20 rutas únicas**. No se confundieron las entradas de navegación con registros de rutas; los comodines anidados pertenecen a árboles distintos y son intencionales.

### Grupo CI/despliegue: dos bloques en `deployment.md`

4. **#87 sobre develop:** sin conflictos; merge `529d0cfb4f510b28e907fbb9a9df32dd95bc87f9`.
5. **#91 después de #87:** dos bloques en `docs/engineering/deployment.md`, merge `5a31780f5b7d0419179ae0fdcf44808bfbd08437`:
   - **Bloque “Workflows pin actions”, línea 15:** se conservaron el stack aislado de migraciones/pgTAP/recorridos locales, la ausencia de migraciones de producción y la afirmación de que los jobs de despliegue no aplican SQL.
   - **Bloque “Repository deployment controls”, líneas 23–39:** se conservaron íntegros el gate de CI del SHA exacto, fallo cerrado, concurrencia, comandos de rollback, controles externos del entorno y límites de publicación desde fuente de #91. Se añadió el párrafo de trabajo operativo separado de #87. “Enforcing the CSP” se actualizó a verificación operativa de la CSP ya aplicada, acorde con `frontend/vercel.json`; no se reintrodujo la afirmación de que la CSP sólo está en report-only.

La tabla mantiene el enlace al workflow de seguridad de #87. Los workflows de despliegue se fusionaron sin conflictos.

### Ensayo conjunto: cinco bloques adicionales en tres archivos

La precomprobación entre los grupos detectó solapes adicionales a los indicados originalmente. Se resolvieron realmente en el merge `426215cf3b3bd7c90076e0ce55c50b22169abf28`:

6. **`.github/workflows/health.yml`, bloque del job, líneas 29–33:** unión de `permissions: { issues: write }` de #87 con `concurrency: { group: health-production, cancel-in-progress: false }` de #89. Se mantiene `permissions: {}` al nivel del workflow (`:20`) y la lectura sintética acotada de catálogo de #89. No se restituyeron permisos globales amplios.
7. **`docs/README.md`, tabla de selección de referencias:** se conservaron las dos filas, CI security y Observability.
8. **`docs/engineering/deployment.md:17`, bloque de CSP:** se conservaron tanto la preservación del archivo completo de #91 como la comprobación de los headers efectivos de #89.
9. **`docs/engineering/deployment.md:23`, bloque de controles y trabajo pendiente:** se mantuvo el runbook completo de #91 y la advertencia sobre límites de migraciones aisladas de #87. Se descartó la frase antigua de #89 que presentaba migraciones/pgTAP en CI como no implementados; no se confundió la implementación aislada con reconciliación remota ni preparación de producción.
10. **`docs/engineering/deployment.md:47`, tabla de secretos:** se mantuvo la localización propuesta de secretos Vercel en entornos protegidos de #91 y se añadieron las filas opcionales de credenciales de monitor y colector de errores de #89. Las configuraciones externas continúan siendo acciones del responsable, no hechos aplicados por el ensayo.

El árbol `frontend/` del ensayo conjunto es idéntico al del ensayo frontend (`git diff prueba/integ-84-89-90..prueba/integ-conjunta-87-91-84-89-90 -- frontend` vacío).

## Corrección necesaria para integrar #84 y #90

La primera suite produjo **871 pruebas correctas y una fallida**. El guard de aislamiento de bundle de #84 prohibía cualquier fuente bajo `src/domains/`, pero #90 necesita importar estáticamente el marcador puro `src/domains/auth/recovery-session.ts` para reconocer recuperación antes de cargar el perfil ERP. Ese módulo sólo maneja el marcador de sesión; no importa páginas, APIs ni el shell.

Commit local `aeaf8e82915aa4f04deccdf633fe0cc607396ee3`, `test(integration): allow recovery marker in login bootstrap`: en `frontend/scripts/check-bundle-size.test.mjs:160` se permite **únicamente ese archivo exacto**, incluyendo el límite de fin de ruta. Continúan prohibidos los demás módulos de dominio, `DashboardLayout`, `Dashboard`, `zod`, `react-hook-form` y `queryObserver` en la carga inicial. No se cambiaron los presupuestos, los timeouts ni la implementación de recuperación. El commit está en el ensayo frontend y por ascendencia en el conjunto; debe incorporarse al PR de recuperación al actualizarlo sobre #84.

## Verificación ejecutada

Node **22.23.3**, conforme con `frontend/.nvmrc`. Se usó la `.env.local` real del worktree con Supabase local para build/size y la primera suite. Para la segunda suite se retiró temporalmente con restauración mediante `trap`; el archivo quedó restaurado. No se copiaron secretos al informe.

| Verificación | Ensayo #84/#89/#90 | Ensayo conjunto |
| --- | --- | --- |
| `npm run lint` | PASS | PASS |
| `npm run build` | PASS | PASS |
| `npm run size` | PASS | PASS |
| `npm run test` | 872/872, 74 archivos | 872/872, 74 archivos |
| `npx vitest run` sin `.env.local` | 872/872, 74 archivos | 872/872, 74 archivos |

Mediciones de ambos árboles frontend: JS de entrada gzip **92.432 B / 100.531 B**; CSS inicial **8.441 B / 9.246 B**; mayor chunk JS sin comprimir **297.637 B / 323.790 B**; JS inicial gzip **150.390 B / 164.284 B**. Los valores después de la barra son presupuestos.

En el ensayo #87/#91 se analizaron los cuatro workflows tocados con PyYAML **6.0.3** (`BaseLoader`, comprobación de `on` y `jobs`) y `bash -n` para los bloques `run`, sustituyendo expresiones `${{ ... }}` por un literal antes de analizar, sin ejecutarlas:

| Workflow | YAML | Bloques shell |
| --- | --- | --- |
| `deploy-develop.yml` | PASS | 5 PASS |
| `deploy-prod.yml` | PASS | 10 PASS |
| `health.yml` | PASS | 4 PASS |
| `security.yml` | PASS | 3 PASS |

Se repitió la validación sintáctica sobre el ensayo conjunto y se comprobaron explícitamente los permisos mínimos y la concurrencia del monitor. `actionlint` no estaba disponible. YAML y `bash -n` no verifican semántica completa de expresiones de GitHub, capacidades de tokens ni settings efectivos; esas verificaciones corresponden al CI real. No se ejecutaron workflows, Gitleaks remoto, deploys ni recorridos de BD.

### Comprobación en navegador real

Chrome headless con Playwright, servidor local del ensayo frontend: **13 comprobaciones correctas**, sin errores de página ni escrituras REST de negocio observadas. En **412×915, 768×1024, 1024×1366 y 1280×800** se abrió login y su enlace de recuperación, el formulario público `/recuperar` y `/restablecer` sin enlace válido. En todas esas vistas `document.documentElement.scrollWidth === innerWidth`. Con `ux-bodega@example.invalid` a 412×915 se abrió Despachos, se abrió el menú móvil y se cerró con Escape, comprobando el retorno del foco al disparador y ausencia de desborde. No se pidió un correo de recuperación, no se cambió ninguna contraseña y no se desactivó ninguna cuenta. El login sí crea una sesión Auth local. No se realizó una auditoría completa de tamaños táctiles ni una nueva campaña de capturas, que no forman parte de la aceptación específica I1.

## Reproducción local exacta de los ensayos

Usar un worktree propio y limpio. Estas referencias congeladas evitan atribuir el resultado a cambios futuros de `origin`; los nombres `repro/` deben estar libres. Cada `git merge` conflictivo requiere las uniones descritas arriba, `git add <archivos-resueltos>` y `git commit` antes del siguiente paso.

```bash
# Ensayo frontend, desde el develop congelado.
git switch -c repro/i1-84-89-90 6903f59e66bcd49c1c14b20fbfe57271b0c7a353
git merge --no-ff 8d2a3e86b17e7d8be2f9ba3b4907214a72d4e8c1
git merge --no-ff c4f40badd745ba30952ff666373210b6a508f0e0
# Resolver importaciones de App.tsx y terminar este merge.
git merge --no-ff 55846b8679a3dd0100376bbcdcd7665cb54fa173
# Resolver importaciones de App.tsx y terminar este merge.
git cherry-pick aeaf8e82915aa4f04deccdf633fe0cc607396ee3

# Ensayo CI independiente.
git switch -c repro/i1-87-91 6903f59e66bcd49c1c14b20fbfe57271b0c7a353
git merge --no-ff 3ced55a93c6b2bc3c4488470ea6ed9f57047a144
git merge --no-ff 4f84cec2aaf8e52b6eb5040e05a845e01c7d2520
# Resolver los dos bloques de deployment.md y terminar el merge.

# Ensayo conjunto; resolver los cinco bloques documentados y terminar.
git switch -c repro/i1-conjunta repro/i1-87-91
git merge --no-ff repro/i1-84-89-90
```

Como comprobación del resultado, comparar árboles con los SHA entregados, no SHA de commits nuevos: `git diff aeaf8e8 repro/i1-84-89-90`, `git diff 5a31780 repro/i1-87-91` y `git diff 426215c repro/i1-conjunta` deben quedar vacíos. Los nuevos merges tendrán SHA distintos por sus mensajes, fechas y padres de reproducción.

Desde `frontend/`, con Node 22 y una configuración local válida:

```bash
npm run lint
npm run build
npm run size
npm run test
# Segunda suite; ejecutar el bloque en una subshell para restaurar el entorno.
(
  i1_env_backup=$(mktemp /tmp/i1-env.XXXXXX)
  mv .env.local "$i1_env_backup"
  trap 'mv "$i1_env_backup" .env.local' EXIT
  npx vitest run
)
```

## Secuencia para la integración real por el responsable

Estos son pasos futuros; no se ejecutaron publicaciones ni merges reales durante I1. Usar un worktree de integración separado, conservar las revisiones de los PR y volver a medir si cambia cualquiera de sus cabezas. No integrar la rama conjunta como sustituto de los cinco PR.

1. Comprobar que #87 sigue basado en el `develop` actual; si ha avanzado, actualizarlo mediante rebase y ejecutar sus verificaciones. Después de revisión y CI, el responsable integra **#87** en `develop`.
2. Tras ese merge: `git fetch origin`; actualizar **#91** sobre el nuevo `origin/develop`. Resolver `deployment.md` como los puntos 4–5, conservando las filas de seguridad. CI/revisión y merge de **#91**.
3. Tras #91: `git fetch origin`; actualizar **#84** sobre `origin/develop`, conservando los controles recién integrados. Reconciliar cualquier texto de despliegue/CSP con los puntos 8–10. Mantener #84 sin integrar hasta que el responsable levante expresamente su estado draft/«do not merge». Ejecutar sus gates y obtener revisión; después integrar **#84**.
4. Tras #84: `git fetch origin`; actualizar **#89** sobre `origin/develop`. Mantener `lazy`, `Suspense` y `useSyncExternalStore`, un único boundary, la caché observable y el shell diferido. Si aparecen conflictos entre grupos, aplicar los puntos 6–10: permisos por job **y** concurrencia, las dos filas del índice y los runbooks completos. Ejecutar gates y validación de workflows antes del merge de **#89**.
5. Tras #89: `git fetch origin`; actualizar **#90** sobre `origin/develop`. Mantener las rutas públicas fuera del guard, el login accesible y el bloqueo de cuenta inactiva. Incorporar el ajuste exacto del guard de bundle con `git cherry-pick aeaf8e82915aa4f04deccdf633fe0cc607396ee3` si no está ya presente. Ejecutar gates con y sin `.env.local`; revisar y hacer merge de **#90**.
6. Tras #90: volver a obtener `origin/develop`, ejecutar los gates completos del resultado final y los recorridos `test:integration` a cargo del coordinador. Cualquier PR aún abierto que incluya estos archivos debe rebasarse sobre ese resultado antes de su propia revisión/merge. La promoción a `main` y los controles externos de Vercel/Auth/monitorización son decisiones separadas del responsable.

Para cada actualización de la lista, usar una copia de revisión nueva, evitando mover una rama que esté abierta en otro worktree. Ejemplo exacto para #91; repetir sustituyendo el nombre por `feature/frontend-ux`, `chore/observabilidad` y `chore/auth-recuperacion` en los pasos siguientes:

```bash
git fetch origin
git switch -c revision/i1-pr-91 origin/chore/vercel-unificar
git rebase origin/develop
# Si hay conflicto: resolver el bloque conservando ambas intenciones,
# git add <archivo-resuelto> y git rebase --continue; repetir hasta terminar.
```

El responsable debe trasladar la actualización revisada a la rama del PR siguiendo su política de publicación; aquí no se prescribe ni ejecuta una publicación forzada. Rebasar la próxima entrega inmediatamente después de cada merge reduce el contexto simultáneo de resolución; refrescar también las restantes antes de integrarlas, porque el SHA congelado de este ensayo deja de representar su nueva base. Resolver por bloques; no usar `--ours`/`--theirs` sobre el archivo completo.

## Límites y trabajo restante

El resultado prueba composición local, build, presupuesto, pruebas unitarias, rutas y un smoke de navegador. No prueba SMTP/CAPTCHA/MFA, permisos remotos, entornos protegidos, secretos, entrega real de alertas, settings Vercel ni migraciones remotas. Las comprobaciones aisladas de pgTAP descritas por los workflows no se ejecutaron en I1. El único cambio adicional de integración que debe pasar a una entrega real es el guard de bundle señalado; las demás modificaciones propias son resoluciones de conflicto y este informe. Quedan la revisión/autorización de los responsables, el CI de las cabezas rebasadas y `test:integration` del coordinador.
