# Guía Del Agente Ondina

## Estado Actual Del Repositorio

- El repo contiene documentación, esquemas SQL, una aplicación frontend funcional en `frontend/` (React + Vite + TypeScript), migraciones versionadas en `supabase/migrations/` (0001 a 0010), CI/CD con GitHub Actions (`.github/workflows/`), `frontend/vercel.json` y pruebas ejecutables (`lint`, `build`, `test`).
- Las migraciones se aplican manualmente con `supabase db push --linked` o vía Supabase MCP (no automatizadas en CI). Ver `docs/setup-vercel-supabase-github.md` para el flujo completo de configuración de Vercel, Supabase y GitHub.
- El frontend requiere variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; existe `frontend/.env.example` como plantilla.
- El módulo de ventas cubre HU-01 a HU-04, HU-07, HU-08 (ranking de vendedores) y HU-09 (consulta de comisión). HU-05 (bidones vacíos) se eliminó del frontend; la vista `v_bidones_vacios_vendedor` queda en la BD para bodega/HU-28. HU-06 (boletas/factura) y Storage upload para receipts (HU-07) están fuera de scope este sprint.
- **Fixes HU-01 (2026-08-17):** productos duplicados deshabilitados dinámicamente en RegistrarVenta (captura del return de `register()` para no pisar el `onChange` de RHF); columna Disponible se actualiza instantáneamente al seleccionar producto; cantidad 0 permitida en validación Zod (`.min(0)` en vez de `.positive()`) y filtrada en `onSubmit`; sidebar sin dual-highlight en `/ventas/registrar` (NavLink `end` dinámico para rutas padre con sub-rutas).
- **Mejoras HU-01/HU-02/HU-07 (2026-08-21):** consenso de UI con `errorTextCls`/`errorBlockCls`/`inputErrorCls` en `lib/ui.ts`; Toast unificado (verde éxito, rojo error) en RegistrarVenta, Gastos y RegistrarCliente; máximo 6 productos por venta con botón deshabilitado; Toast rojo al submit sin productos válidos; tabla responsive con CSS single-view (tarjetas en móvil <640px sin duplicar RHF); responsividad en todas las páginas de ventas (375px y 768px); `docs/convenciones-frontend.md` con reglas de mensajes, errores, Toast y comentarios.
- **Fix compatibilidad Zod v4 (2026-08-21):** upgrade `@hookform/resolvers` v3.10.0 → v5.9.1. Causa raíz: v3 detectaba `ZodError` via `error.errors` pero Zod v4 renombró a `.issues`, causando `Uncaught ZodError` y mensajes de validación invisibles. v5 detecta `Zod4Error` correctamente. Tipos `z.input` agregados a schemas para separar input (con `coerce` unknown) de output (con number).
- **Fixes HU-03 (2026-08-17):** `obtenerCargaVendedor` usa alias `producto:productos()` para que el nombre llegue correctamente; Carga.tsx y Ventas.tsx filtran items con `cantidad === 0`.
- **Fix HU-09 (commit 027cc22 de Laoch-11):** `obtenerCantidadVentasJornada` cuenta ventas reales del día en vez de sumar `ventas_del_tipo` de la vista de comisión.
- El módulo de bodega cubre HU-13 (despachos, devoluciones de productos y envases, stock). El módulo de producción cubre HU-19 a HU-23.
- Se agregó Mantine UI (`@mantine/core`, `@mantine/dates`, `@mantine/hooks`) + `dayjs` para componentes complejos como MonthPickerInput (selector de mes en ranking). El resto del frontend sigue con Tailwind CSS.
- Tests: 95 total (ventas 29, bodega 29, producción 34) en 15 archivos. Ver `docs/estado-historias-usuario.md` para el detalle por HU.
- Los datos de la base local de Beads viven en `.beads/`; se reinicializó el tracker con prefix `OND` el 2026-08-17. `config.yaml` tiene `repos.primary = "."` y `sync.remote` configurado.
- Los archivos `.agents/skills/` contienen las skills de trabajo (ask-matt, codebase-design, supabase, etc.) y deben versionarse; no se deben borrar en merges entre ramas.

## Fuente De Verdad

- `README.md` y `docs/` son la fuente principal de alcance, ramas, convenciones, y modelos. Lee `README.md` antes de tocar código o SQL.
- `docs/Plan De Desarrollo.md` documenta el alcance y el stack elegido.
- `docs/Problematica.md`, `docs/Requerimentos RF y RNF.md` y `docs/Historias de Usuario.md` contienen requisitos del negocio. Trata lo pendiente en las notas como no resuelto.
- No existe `AGENTS_para_equipo_desarrollo.md` (referenciado en `README.md`). No lo busques; la convención real de código/Git/seguridad está en `README.md` y `AGENTS.md`.
- Para el estado detallado de cada HU (completas, parciales, placeholders, sin UI), ver `docs/estado-historias-usuario.md`. Resumen: 16 completas, 3 parciales, 4 placeholders (administración), 4 sin UI, 2 eliminadas.

## Frontend

Comandos reales (en `frontend/`, se necesita Node 22+):

```bash
npm install
npm run dev        # servidor de desarrollo Vite
npm run build      # tsc -b && vite build
npm run lint       # eslint .
```

- TypeScript estricto con `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, y `verbatimModuleSyntax`. Usa `import type` para imports solo de tipos (obligatorio por `verbatimModuleSyntax`).
- Los dominios se componen como módulos en `frontend/src/domains/index.ts` y cada uno expone un `DomainModule`. La lógica de tu dominio debe quedar en `frontend/src/domains/<dominio>/`, no fuera.
- No accedas a Supabase desde componentes de presentación; usa el cliente compartido en `frontend/src/lib/supabase.ts` y los servicios de cada dominio.
- Componentes en `PascalCase`, hooks `useCamelCase`, utilidades `camelCase`, carpetas `kebab-case`, mensajes al usuario en español.
- **Convenciones de UI y comentarios:** ver `docs/convenciones-frontend.md` para reglas de mensajes de validación, errores, Toast y comentarios de código. Resumen: usar `errorTextCls`/`errorBlockCls`/`inputErrorCls` de `lib/ui.ts` para todos los errores (no strings inline). Toast verde en éxito, rojo en error. Comentarios `//` en español explicando el por qué, marcar HU relacionada.

## Base De Datos

- `bd/` contiene esquemas SQL, objetos y seed. Archivos reales: `ondina_schema_supabase.sql`, `rls_policies.sql`, `triggers_negocio.sql`, `auditoria.sql`, `vistas.sql`, `seed.sql`, `drop_todo.sql` y `diagramas_esquemas_mermaid.md`.
- `bd/ondina_schema_supabase.sql` es el esquema relacional final. Las políticas RLS, triggers de negocio, auditoría, vistas y datos semilla se aplican como archivos separados (`rls_policies.sql`, `triggers_negocio.sql`, `auditoria.sql`, `vistas.sql`, `seed.sql`) en el orden documentado en cada cabecera, antes de convertir en migraciones.
- No existía `bd/ondina_sql.txt` — superado; no lo busques ni despliegues.
- Aplica el esquema solo en un entorno Supabase/PostgreSQL aislado. Los cambios definitivos van en migraciones versionadas bajo `supabase/migrations/` (0001 a 0010 creadas).
- Preserva los invariantes: RLS en tablas expuestas, autorización en la BD, triggers de auditoría, parámetros de negocio configurables y soft-delete/anulación.
- El stock lo mantienen los triggers de BD, no el frontend. Los ajustes de despacho agregan filas dentro de la ventana configurada; no editan ni restan filas existentes.
- Las anulaciones (`anulado: false → true`) reversan los movimientos de stock mediante triggers en `triggers_negocio.sql` (sección 8): venta devuelve carga y resta envases; despacho devuelve stock_bodega y quita carga; devoluciones, producciones y mermas revertían su efecto. Una posterior reactivación NO restaura movimientos.
- Auditoría: `auditoria.sql` aplica `fn_auditoria` (con `anulado` → `ANULACION`) a ventas, despachos, producciones, gastos, mermas y devoluciones; y `fn_auditoria_simple` (INSERT/UPDATE sin ANULACION) a `venta_detalles` y `despacho_detalles`. El bloque de devoluciones/detalles está marcado "SUJETO A CAMBIOS" hasta confirmsar con el equipo si los detalles deben ser corregibles.
- Vistas: `vistas.sql` expone `v_stock_actual`, `v_cuadre_despacho`, `v_ventas_diarias`, `v_ranking_vendedores`, `v_comision_vendedor`, `v_clientes_inactivos`, `v_historial_cliente` (RF-04/HU-11) y `v_ventas_producto` (HU-14). RF-20 (documentos boleta/factura) no se materializa como objeto aparte; se consulta desde `ventas`.
- Índices: el esquema define índices sobre `sucursal_id`, `vendedor_id`, `creado_en`, `venta_id`, `despacho_id`, `producto_id` y `(tabla, registro_id)` en auditoria.
- Nunca guardes contraseñas en tablas de la aplicación; la autenticación pertenece a Supabase Auth y `perfiles.id` referencia `auth.users.id`.

## Ramas Y Flujo De Trabajo

- Ramas de dominio: `feature/ventas`, `feature/bodega`, `feature/produccion`, `feature/administracion`.
- `main` publicación/protección, `develop` integración. Las ramas de dominio nacen de `develop` y se integran por PR con squash.
- **Protección de `main` (configurada 2026-08-14):** `enforce_admins: false` (admin puede push directo), `required_pull_request_reviews: 1` (el resto del equipo necesita PR + 1 aprobación), `allow_force_pushes: false`, `allow_deletions: false`. El admin puede hacer commit + push directo a `main`; el workflow `deploy-prod.yml` se dispara en push a `main` y el deploy a producción requiere aprobación manual vía el environment `production` de GitHub Actions.
- Además existen ramas de trabajo locales transitorias: `work/*`, `context/*`, `contextura/*`, `integration/*` y `clean/*`. No las uses como base nueva; nace de `develop`.
- Commits con Conventional Commits, en español, en imperativo, máximo 72 caracteres: `<tipo>(<alcance>): <descripción> [HU-XX]`.
- La sección anterior sobre beads ha sido reemplazada por la integración de Beads más abajo.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Seguimiento De Issues Con Beads

Este proyecto usa **bd (beads)** para el seguimiento de issues. Ejecuta `bd prime` para ver el contexto completo del flujo y los comandos.

```bash
bd ready              # encontrar trabajo disponible
bd show <id>          # ver detalles de un issue
bd update <id> --claim  # reclamar un issue
bd close <id>         # cerrar un issue
bd statistics         # resumen del proyecto
```

### Reglas

- Usa `bd` para el seguimiento de TODAS las tareas; no uses TodoWrite, markdown TODO ni tablas de seguimiento por fuera de `bd`.
- Ejecuta `bd prime` para el flujo detallado de cierre de sesión y las referencias.
- Usa `bd remember <texto>` para memoria persistente; no uses archivos `MEMORY.md`.
- `config.yaml` de beads solo debe tener `repos.primary = "."`; no agregues la sección `additional`.
- `.beads/embeddeddolt/` es la fuente de datos local y NO se versiona. `.beads/issues.jsonl` es un export pasivo que el hook de beads regenera con cada commit; se eliminó del tracking en git y no debe volver a añadirse. Borrar `issues.jsonl` no borra los datos reales (viven en `embeddeddolt/`), y beads puede reimportar desde ese export al cambiar de rama vía `import.auto`. Para limpiar del todo, borra del Dolt local con `bd delete` y luego quita el export en git.

<!-- END BEATS INTEGRATION -->

## Cierre De Sesión

Al acabar abandonar una sesión, NO estás completo hasta que `git push` tenga éxito.

1. Crea issues para el trabajo pendiente.
2. Ejecuta las verificaciones de calidad si hubo código (`npm run lint` y `npm run build` en `frontend/`).
3. Actualiza el estado de los issues (cierra lo hecho, marca en progreso lo que quede).
4. Push obligatorio:
   ```bash
   git pull --rebase
   git push
   git status   # debe mostrar "up to date with origin"
   ```
5. Limpia: descarta `git stash` y poda ramas remotas.
6. Verifica que todo esté commiteado y pusheado.
7. Deja contexto del hand‑off para la siguiente sesión.

Nunca dejes que la rama local quede por push; resolver y reintentar hasta que push tenga éxito.

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
