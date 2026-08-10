# Guía Del Agente Ondina

## Estado Actual Del Repositorio

- El repo contiene documentación, esquemas SQL, una aplicación frontend funcional en `frontend/` (React + Vite + TypeScript), migraciones versionadas en `supabase/migrations/` (0001 a 0005), CI/CD con GitHub Actions (`.github/workflows/`), `frontend/vercel.json` y pruebas ejecutables (`lint`, `build`, `test`).
- Las migraciones se aplican manualmente con `supabase db push --linked` (no automatizadas en CI). Ver `docs/setup-vercel-supabase-github.md` para el flujo completo de configuración de Vercel, Supabase y GitHub.
- El frontend requiere variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; existe `frontend/.env.example` como plantilla.
- El módulo de ventas cubre HU-01 a HU-04, HU-07, HU-08 (ranking de vendedores) y HU-09 (consulta de comisión). HU-05 (bidones vacíos) se eliminó del frontend; la vista `v_bidones_vacios_vendedor` queda en la BD para bodega/HU-28. HU-06 (boletas/factura) y Storage upload para receipts (HU-07) están fuera de scope este sprint.
- Se agregó Mantine UI (`@mantine/core`, `@mantine/dates`, `@mantine/hooks`) + `dayjs` para componentes complejos como MonthPickerInput (selector de mes en ranking). El resto del frontend sigue con Tailwind CSS.
- Los datos de la base local de Beads viven en `.beads/`; se limpió el historial de un proyecto anterior: el tracker está vacío y `config.yaml` solo tiene `repos.primary = "."`.

## Fuente De Verdad

- `README.md` y `docs/` son la fuente principal de alcance, ramas, convenciones, y modelos. Lee `README.md` antes de tocar código o SQL.
- `docs/Plan De Desarrollo.md` documenta el alcance y el stack elegido.
- `docs/Problematica.md`, `docs/Requerimentos RF y RNF.md` y `docs/Historias de Usuario.md` contienen requisitos del negocio. Trata lo pendiente en las notas como no resuelto.
- No existe `AGENTS_para_equipo_desarrollo.md` (referenciado en `README.md`). No lo busques; la convención real de código/Git/seguridad está en `README.md` y `AGENTS.md`.

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

## Base De Datos

- `bd/` contiene esquemas SQL, objetos y seed. Archivos reales: `ondina_schema_supabase.sql`, `rls_policies.sql`, `triggers_negocio.sql`, `auditoria.sql`, `vistas.sql`, `seed.sql`, `drop_todo.sql` y `diagramas_esquemas_mermaid.md`.
- `bd/ondina_schema_supabase.sql` es el esquema relacional final. Las políticas RLS, triggers de negocio, auditoría, vistas y datos semilla se aplican como archivos separados (`rls_policies.sql`, `triggers_negocio.sql`, `auditoria.sql`, `vistas.sql`, `seed.sql`) en el orden documentado en cada cabecera, antes de convertir en migraciones.
- No existía `bd/ondina_sql.txt` — superado; no lo busques ni despliegues.
- Aplica el esquema solo en un entorno Supabase/PostgreSQL aislado. Los cambios definitivos van en migraciones versionadas bajo `supabase/migrations/` (0001 a 0005 ya creadas).
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
- Además existen ramas de trabajo locales transitorias: `work/*`, `context/*`, `contextura/*`, `integration/*` y `clean/*`. No las uses como base nueva; nace de `develop`.
- Commits con Conventional Commits, en español, en imperativo, máximo 72 caracteres: `<tipo>(<alcance>): <descripción> [HU-XX]`.

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