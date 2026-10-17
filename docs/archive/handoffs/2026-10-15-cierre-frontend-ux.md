# Traspaso — Cierre de la ronda frontend-ux (2026-10-15)

Documento de trabajo local, no versionado. Recoge el estado verificado y el trabajo que queda para una sesión nueva con el contexto limpio. Sustituye al handoff `HANDOFF-2026-10-14-frontend-movil-y-operacion.md`, que ya se completó.

## 1. Estado verificado al cierre

- **Repositorio:** `/home/cristhian/Documents/ondina` (GitHub `Cristhian-S1/ondina-erp`).
  - El checkout principal está en `develop`, con cambios ajenos sin commitear (`.claude/settings.json`, `.opencode/`, `.codex/hooks.json`, etc.). **No tocarlos.**
- **`feature/frontend-ux`** (HEAD `5466c4e`):
  - Ya contiene `develop`.
  - El PR #84 está en borrador y **sólo para CI**; no fusionarlo sin orden del responsable.
  - Las 5 verificaciones están en verde: lint, build, size (5 métricas), 799 pruebas unitarias y 22 de integración. El CI de GitHub también está en verde.
  - Informe consolidado: `docs/archive/audits/2026-10-15/INFORME-FINAL.md`. **Léelo primero.**
- **PR de operación hacia `develop`, todos abiertos y sin fusionar:**
  - #87: CI y secretos (#46).
  - #88: backups en plan Pro (#41).
  - #89: observabilidad (#54).
  - #90: recuperación de contraseña (#44).
  - #91: publicación en Vercel (#39).
  - Las decisiones externas de cada uno están en el informe final.
- **Beads:**
  - Épica `OND-c07` abierta.
  - Sólo queda abierta `OND-c07.13` (#86): R1-12, R1-14 y R2-13.
- **Carpeta de pruebas del responsable:** `~/Documents/ondina-frontend-ux`, en `feature/frontend-ux`.
  - Se arranca con `.ux-local/levantar.sh` (opciones `--reset`, `--host`, `--detener`).
  - Cuentas `ux-*@example.invalid`, contraseña `ux-local-2026`.
- **Script para Windows 11:** `~/Downloads/probar-frontend-ux-windows.ps1`.
- **Sesiones de Codex y OpenCode:** borradas el 2026-10-15 por pedido del responsable.
  - La copia está en `~/Backups/sesiones-agentes/2026-10-15/` (instrucciones en su `LEEME.md`).
  - Codex no conserva historial previo.
- **No queda nada activo:** sin workers, sin runs con terminales reclamables y sin worktrees temporales.

## 2. Reglas y trampas (aprendidas; leer antes de lanzar workers)

- **Orca:** en Linux el ejecutable es `orca-ide`, nunca `orca`.
  - Cargar `orca-ide skills get orchestration` y `orca-ide skills get orca-cli`, y leer `docs/orchestration/README.md`.
  - Crear un Run nuevo.
  - Máximo 3 workers simultáneos, en worktrees `new-top-level`.
- **Modelos:**
  - Codex `gpt-6.1-sol`: técnico.
  - Claude Sonnet 5.5 `claude-sonnet-5-5`: UX/UI y revisiones.
  - OpenCode GLM-5.3-Flash (`--agent opencode2`, **sin** `--model`): mediciones y documentación. Verificar el modelo con `worker-read`.
  - **Si Codex se queda sin cupo** ("You've hit your usage limit"):
    - commit WIP del worktree;
    - `worker-abandon` del despacho y cerrar el terminal;
    - relanzar la tarea con Sonnet 5.5, o con GLM si es sencilla, partiendo del WIP (nunca `reset --hard`).
  - Si Claude (`/usage`) supera ~80 %, pausar y avisar.
- **Arrancar Codex en Orca:** el aviso "Hooks need review" puede tardar hasta 80 s.
  - Crear el terminal con `orca-ide terminal create --command 'codex --model gpt-6.1-sol'`.
  - Esperar el aviso, elegir `3` y esperar `tui-idle`.
  - Después, `worker-start --task … --terminal …`.
- **Especificaciones fuera de `/tmp`:** el `/tmp` se borra al reiniciar, así que guárdalas en `~/.cache/ondina-orq/<fecha>/`. Allí están `comun.md` y `comun-ops.md` (reglas comunes de los workers) y los scripts `lanzar-codex.sh` y `wait.py` de 2026-10-15.
- **`frontend/.env.local` real para medir el bundle:** sin él, Supabase se elimina del build y las cifras son falsas.
- **Pruebas unitarias sin `.env.local`:** también deben pasar sin él, porque así corre el CI.
  - Si una prueba importa o automockea un módulo que carga `lib/supabase.ts`, añadir `vi.mock('@/lib/supabase', () => ({ supabase: {} }))`.
  - Comprobarlo con `mv frontend/.env.local /tmp/x; npx vitest run; mv /tmp/x frontend/.env.local`.
- **`vite preview` aplica la CSP de producción.** Para Lighthouse usar `docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs`.
- **Tras `supabase db reset`, si `/auth/v1/health` da 502:** `docker restart supabase_kong_ondina-erp`.
- **Antes de publicar:**
  - ejecutar las 5 verificaciones y no publicar con fallos (`test:integration` lo ejecuta sólo el orquestador);
  - integrar con `git cherry-pick` tras revisar `git log origin/feature/frontend-ux..<rama>`;
  - publicar el informe del barrido **antes** de lanzar los workers que lo leen.
- **Límites:** no fusionar a `develop` ni a `main`; no tocar SQL ni la BD remota sin autorización; no tocar `.opencode/`.
- **Presupuesto de CSS al límite:** queda a 17 B. Si una tarea añade CSS, el CI fallará hasta que el responsable decida actualizar la línea base de `frontend/bundle-budget.json`. Pregúntaselo antes.

## 3. Trabajo pendiente (en orden sugerido)

### 3.1 Decisiones del responsable (preguntar al inicio, no asumir)

1. Si se actualiza la línea base de CSS del presupuesto (8.405/8.422 B).
2. Orden de fusión de los PR (#84 frente a #89/#90, y #87 frente a #91), si quiere que se prepare.
3. Qué hacer con la evidencia de más de 30 MB en `docs/archive/audits/`: squash al fusionar o moverla fuera del repositorio.
4. Si se prepara la propuesta de backend de R1-14.

### 3.2 Deuda técnica del frontend (OND-c07.13 / #86), con workers

- **R2-13:** extender `CampoFormulario` (o un equivalente compartido en `components/`) a los formularios de Bodega (modal de despacho y devoluciones) y de Producción (registrar, merma, incidencia).
  - Mismo patrón accesible: label estable, `aria-invalid`, `aria-describedby` y error persistente.
  - Un worker por dominio, sin solapar archivos.
- **R1-12:** dividir `frontend/src/domains/bodega/pages/Despachos.tsx` (~770 líneas): filtros, lista/historial y detalle en componentes de `bodega/components/`, sin cambiar el comportamiento.
  - Codex.
  - Revisión cruzada de Sonnet, con el barrido visual a 412×915, 768×1024, 1024×1366 y 1280×800.
- **Cierre:**
  - revisiones cruzadas;
  - las 5 verificaciones, más la suite sin `.env.local`;
  - capturas antes/después en `docs/archive/audits/<fecha>/`;
  - cerrar `OND-c07.13` dejando R1-14 como tarea de backend aparte.

### 3.3 Integración de los PR (sólo si el responsable lo pide)

- Preparar ramas de prueba locales, sin publicar, que combinen `feature/frontend-ux` con `chore/observabilidad` (#89) y con `chore/auth-recuperacion` (#90).
  - Resolver los conflictos en `App.tsx`, `main.tsx`, `ErrorBoundary.tsx`, `Login.tsx` y `ProtectedRoute.tsx`.
  - Pasar las 5 verificaciones y documentar el orden de fusión recomendado y los conflictos resueltos.
- Lo mismo para #87 y #91 en `docs/engineering/deployment.md`.

### 3.4 R1-14, propuesta de backend (sólo con autorización)

- Hoy la RPC `vendedores_sucursal` excluye a los vendedores inactivos, así que los despachos antiguos muestran "Vendedor no disponible".
- Propuesta: una RPC o vista de sólo lectura con nombre e indicador `activo` para el historial, con las mismas condiciones de rol y sucursal.
- Proponer el SQL y la prueba pgTAP **sin aplicarlo**. Leer antes `docs/engineering/database.md` y `supabase/tests/`.

## 4. Cierre esperado de la próxima sesión

- Trabajo integrado en `feature/frontend-ux` con el CI del PR #84 en verde.
- Workers liberados (`worker-list --terminal-state reclaimable` en 0) y worktrees eliminados.
- Carpeta del responsable actualizada (`git pull` en `~/Documents/ondina-frontend-ux`).
- `bd dolt push` hecho.
- Un resumen al responsable: qué se hizo, evidencia, decisiones pendientes y cómo probarlo.
