# Guía Del Agente Ondina

## Estado Actual Del Repositorio

- El repo contiene documentación, esquemas SQL y una aplicación frontend funcional en `frontend/` (React + Vite + TypeScript).
- No hay aún: `supabase/migrations/`, configuración de CI, migraciones aplicadas ni pruebas ejecutables (solo `lint` y `build`).
- El frontend requiere variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; no existe `.env.example` aún.
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

- `bd/` contiene esquemas SQL y seed. Archivos reales: `ondina_schema.sql`, `ondina_schema_supabase.sql`, `ondina_schema_supabase_v2.sql`, `rls_policies.sql`, `seed_datos_prueba.sql`, `drop_todo.sql` y `diagramas_esquemas_mermaid.md`.
- `bd/ondina_schema_supabase.sql` es el esquema canónico completo (Auth, RLS, triggers, auditoría, vistas, storage, seed). `bd/ondina_schema_supabase_v2.sql` es la propuesta simplificada con `sucursales`, pendiente de validar antes de convertir en migraciones.
- No existía `bd/ondina_sql.txt` — superado; no lo busques ni despliegues.
- Aplica el esquema solo en un entorno Supabase/PostgreSQL aislado. Los cambios definitivos van en migraciones versionadas bajo `supabase/migrations/` (aún no creado).
- Preserva los invariantes: RLS en tablas expuestas, autorización en la BD, triggers de auditoría, parámetros de negocio configurables y soft-delete/anulación.
- El stock lo mantienen los triggers de BD, no el frontend. Los ajustes de despacho agregan filas dentro de la ventana configurada; no editan ni restan filas existentes.
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