# X1 — Documentar backups/PITR como requisito futuro del plan Pro (GitHub #41, Beads OND-u8c y OND-uxi)

Fecha: 2026-10-14. Rol: documentación (OpenCode). Rama: `docs/supabase-backups-plan-pro` desde `origin/develop` (6903f59), commits locales, sin push.

## Qué cambió

- **Nuevo documento de operación `docs/engineering/backups.md`** (inglés, fechado 2026-10-14): estado actual del plan gratuito (sin backups gestionados ni PITR, con citas y URLs oficiales consultadas hoy), procedimiento manual vigente con `supabase db dump` (roles/esquema/datos por separado según CLI 2.111.0), almacenamiento fuera del repo y cifrado, restauración de ensayo local verificada, requisito y checklist para el plan Pro (RPO/RTO propuestos pendientes de ratificación), criterios de aceptación de #41 y riesgos mientras tanto. Marcadores "decide el responsable" en custodia de claves, destino off-site, frecuencia/retención, RPO/RTO y responsable operativo.
- **Enlaces nuevos:** fila en `docs/README.md` ("Recover the database or plan backups"), párrafo en `docs/engineering/database.md` (Change workflow) y línea de `docs/engineering/deployment.md` que menciona #41. Sin cambios en SQL, migraciones, workflows ni código.

## Verificación (comandos ejecutados contra la BD LOCAL, 127.0.0.1:54322, sin credenciales remotas; volcados en /tmp/opencode, fuera del repo y sin commitear)

- `supabase --version` → 2.111.0 (coincide con la CLI fijada en `.github/workflows/ci.yml`; el `--help` de `db dump` no tiene `--schema-only`: el volcado de esquema es la forma por defecto).
- Vaciados locales (salidas resumidas, sin datos): `roles.sql` 370 B (solo ajustes de roles; roles reservados filtrados), `schema.sql` 141 kB (24 `CREATE TABLE IF NOT EXISTS`: 23 `public` + 1 `private`; extensiones pg_net/btree_gist/pg_stat_statements/pgcrypto/supabase_vault/uuid-ossp; excluye esquemas gestionados auth/storage), `data.sql` 2,4 MB (`COPY` para 23 tablas `public`, 22 `auth`, 1 `private`, 5 `storage`, 1 `supabase_functions`; empieza con `SET session_replication_role = replica`; excluye los libros `storage.migrations` y `supabase_functions.migrations`).
- Restauración canónica (roles → esquema → `SET session_replication_role = replica` → datos, una sesión psql con `--single-transaction`, `ON_ERROR_STOP=1`) verificada en BD de ensayo `restore_x1`: primero falló sin andamiaje (3 errores reales y útiles: `GRANT SET ON PARAMETER log_min_messages` denegado para el rol `postgres` local — el súper-usuario del stack `supabase_admin` sí puede; no existen los esquemas `extensions`/`vault` ni la publicación `supabase_realtime` en una BD vacía — son piezas gestionadas por la plataforma que ya existen en cualquier proyecto Supabase real). Con ese andamiaje (`pg_dump --schema-only -n auth -n storage -n supabase_functions` + esquemas extensions/vault + publication), la restauración completa terminó sin error.
- **Round trip idéntico:** re-vaciado de `restore_x1` y restauración en `restore_x2`; los fingerprints de 37 relaciones (conteo + md5 por fila, método de `supabase/tests/rehearse-upgrade.sh`) son idénticos. Diferencias con la BD origen explicadas por escritura concurrente (la BD local compartida mutó entre el dump y la comparación: +10 usuarios de auth, +108 auditoría) — evidencia adicional de que el backup real debe tomarse del remoto con escritores serializados.
- Limpieza: bases `restore_x1`/`restore_x2` eliminadas y temporales del contenedor borradas; el stack local quedó como estaba (sin cambios de datos propios de este trabajo).

## Fuentes oficiales citadas (consultadas 2026-10-14)

- Cifras de plan sin inventar: retención/precio tomados solo de `supabase.com/pricing` (backups automáticos: Free "not included", Pro 7 días; PITR $100/mes por retención de 7 días) y `supabase.com/docs/guides/platform/backups` (recomendación para free tier: `db dump` + off-site; PITR requiere compute Small; RPO peor caso 2 min; PITR desactiva los backups diarios; los backups no incluyen objetos de Storage).
- Procedimiento canónico: `supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore` y `supabase.com/docs/reference/cli/supabase-db-dump`; notas de restauración y de qué no va en los dumps: `supabase.com/docs/guides/self-hosting/restore-from-platform`; regla "nunca en repositorio público": `supabase.com/docs/guides/deployment/ci/backups`.

## Límites

- El proyecto no se toca: no se ejecutó `db dump` contra el remoto ni se usaron credenciales remotas; `supabase db push`, reset de BD y `npm run test:integration` quedan fuera de alcance.
- Cifras de plan verificadas solo en la documentación oficial del día; si Supabase cambia precios/retención, revisar antes de contratar. La restauración canónica en un proyecto real de plataforma (nuevo) no se pudo verificar localmente; el doc lo señala y da el fallback verificado con el súper-usuario local.
- Estado operación: pendiente de ratificar responsable/cronograma/custodia; sin backups programados todavía.
