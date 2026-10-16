# Traspaso — Frontend móvil, paginación y plan de operación (2026-10-14)

Documento de trabajo local (no versionado) para la siguiente sesión. Resume el estado verificado al 2026-10-14, las decisiones del responsable y las instrucciones para ejecutar el siguiente bloque de trabajo.

## 1. Estado de partida (verificado)

- **Repositorio:** `/home/cristhian/Documents/ondina` (GitHub `Cristhian-S1/ondina-erp`).
  - El checkout principal está en `develop` y tiene cambios ajenos sin commitear: `.claude/settings.json`, `.opencode/`, `.codex/hooks.json` y otros. **No tocarlos.**
- **Rama de trabajo del frontend:** `feature/frontend-ux` (HEAD `4809b1a`).
  - Ya contiene `develop` (PR #79 y #85 fusionados).
  - **PR #84** en borrador hacia `develop`. Está en espera por decisión del responsable: **no fusionarlo** y mantenerlo sin conflictos.
- **Carpeta de pruebas del responsable:** `~/Documents/ondina-frontend-ux` (worktree de `feature/frontend-ux`).
  - Se levanta con `~/Documents/ondina-frontend-ux/.ux-local/levantar.sh` (opciones `--sin-pull`, `--reset`, `--host`, `--detener`).
  - El script de datos de prueba está en `.ux-local/seed-ux.mjs`.
  - Cuentas: `ux-vendedor@`, `ux-bodega@`, `ux-produccion@`, `ux-admin@`, `ux-admin-global@` (dominio `example.invalid`), contraseña `ux-local-2026`.
- **Script para Windows 11:** `~/Downloads/probar-frontend-ux-windows.ps1` y su `LEEME`.
- **Evidencia de la ronda anterior:** `docs/archive/audits/2026-10-13/frontend-ux/` en `feature/frontend-ux`. Lo importante:
  - informes A1, A2 y A3 (línea base);
  - entregas B1–B7 y FX;
  - F1–F3 (feedback de escritorio ya resuelto);
  - C1 y C2 (medición y barrido final);
  - `INFORME-FINAL.md`.
- **Componentes compartidos ya disponibles:**
  - `components/InputNumerico.tsx`: sólo dígitos, miles es-CL, flechas ±1 y error en tiempo real.
  - `components/EstadoVista.tsx`.
  - `lib/format.ts` (`fmtFecha`, `fmtFechaHora`).
  - `domains/ventas/components/CampoFormulario.tsx`.
  - Las convenciones están en `docs/engineering/frontend.md`.
- **Beads:** la épica es `OND-c07`. Abiertos: `OND-c07.10` (paginación), `OND-c07.13` (GitHub #86) y `OND-c07.19` (prueba intermitente).
- **Feedback del responsable:**
  - `frontend_feedback.md`: escritorio, ya implementado.
  - `frontend_feedback_mobile.txt`: **móvil, pendiente**. Ambos están en la raíz del repo y no están versionados.

## 2. Decisiones del responsable (no reabrir)

1. **#41 (backups de Supabase): no es viable por ahora.**
   - Los backups gestionados y la recuperación a un punto en el tiempo (PITR) requieren el **plan Pro** de Supabase.
   - Ya se comentó en #41 y `OND-uxi` quedó diferido.
   - **Tarea pendiente:** dejarlo documentado en `docs/` (operación/base de datos), con fecha, como requisito futuro al contratar Pro, junto con el procedimiento manual vigente (`supabase db dump`).
2. **OND-c07.14 (cerrado):**
   - Las ventas con total $0 mantienen la **confirmación explícita** actual.
   - Registrar producción **puede aceptar duplicados**.
3. **OND-c07.10:** paginar el historial de despachos **y todas las vistas de tipo historial o lista que crecen sin límite**.
   - Incluye devoluciones, producción reciente, historial, incidencias, mermas, ventas, clientes y gastos si aplica.
   - Los filtros ayudan, pero no bastan.
4. **OND-c07.13 → GitHub #86:** prioridad de UX móvil.
5. **La mayoría de los usuarios usará teléfono o tablet.** La responsividad y la visualización móvil son la máxima prioridad del frontend.

## 3. Roles y orquestación

- **Orquestador principal: Claude Opus 5.5** con Orca (`orca-ide`; en Linux **nunca** `orca`).
  - Cargar `orca-ide skills get orchestration` y `orca-ide skills get orca-cli`.
  - Leer `docs/orchestration/README.md`.
  - Crear un Run nuevo.
  - Máximo **3 workers simultáneos**, worktrees `new-top-level` desde `origin/feature/frontend-ux`.
- **Workers:**
  - **Codex `gpt-6.1-sol`** (`--agent codex --model gpt-6.1-sol`): implementación técnica (paginación, API, React Query, accesibilidad, pruebas).
  - **Claude Sonnet 5.5** (`--agent claude --model claude-sonnet-5-5`): UX/UI móvil, diseño de tarjetas, `DESIGN.md` y revisión visual.
  - **OpenCode GLM-5.3-Flash** (`--agent opencode2`, sin `--model`): mediciones (Lighthouse), investigación de la prueba intermitente y documentación.
    - El TUI de OpenCode 2 no admite `--model`. Verificar en pantalla (`worker-read`) que muestra `GLM-5.3-Flash`.
- **Computer use y navegadores:** las pruebas visuales se hacen con los plugins disponibles.
  - Claude Code: navegador embebido de Orca (`orca-ide tab create`, `snapshot`, `screenshot`, `exec --command "set viewport W H"`).
    - `orca-ide computer` no saca capturas en Linux.
  - Codex: plugins `computer_use`, `browser_use` y `chrome`, ya activos en `~/.codex/config.toml`.
  - Alternativa: Chrome headless o Playwright con `/usr/bin/google-chrome`, y Lighthouse 12.8.2 (`npx -y lighthouse@12.8.2`).
- **Viewports obligatorios:**
  - teléfono **412×915** (el del responsable) y **375×812**;
  - tablet **768×1024** y **1024×1366**;
  - escritorio **1280**.
- **Reglas de cupo:** si Codex muestra "5h limit" bajo, o Claude (`/usage`) supera ~80 % de la sesión, **pausar los workers** (commit WIP local, sin `worker_done`) y avisar al responsable. Haiku 5.5 sólo sustituye a Codex si su cupo está agotado.

## 4. Trampas conocidas (leer antes de empezar)

- **Medir siempre con `frontend/.env.local` real** (`VITE_SUPABASE_URL=http://127.0.0.1:54321` y `ANON_KEY` de `supabase status -o env`). Sin ese archivo, `lib/supabase.ts` lanza un error al importarse y el bundle sale artificialmente pequeño.
- **`vite preview` aplica la CSP de producción** y bloquea Supabase local. Para Lighthouse usar `docs/archive/audits/2026-10-13/frontend-ux/scripts/servidor-local-a3.mjs`.
- **Tras `supabase db reset`, Kong puede responder 502 en `/auth/v1/health`.** Arreglarlo con `docker restart supabase_kong_ondina-erp`.
- **Codex en Orca se detiene en "Hooks need review".** Crear el terminal con `orca-ide terminal create --command 'codex --model gpt-6.1-sol'`, esperar hasta 80 s el aviso, elegir `3` (sin confiar), esperar `tui-idle` y luego `worker-start --task … --terminal …`.
- **El scratchpad de `/tmp` se borra al reiniciar el equipo.** Guardar las especificaciones de tareas en un directorio persistente, por ejemplo `~/.cache/ondina-orq/`.
- **Antes de publicar, ejecutar las 5 verificaciones y no publicar con fallos:** `npm run lint`, `npm run build`, `npm run size`, `npm run test` y `npm run test:integration` (este último sólo el orquestador; comparte la BD local).
- **Conflictos con develop:** si `develop` avanza (Dependabot), traerlo a `feature/frontend-ux` con merge, regenerar `package-lock.json` desde el de develop sin Mantine/dayjs y conservar el `bundle-budget.json` de la rama si las métricas caben.
- **Workers:** integrar con `git cherry-pick` tras revisar `git log origin/feature/frontend-ux..<rama>` (que no arrastre commits ajenos). No hacer merge ni push a `develop` o `main`.

## 5. Trabajo de frontend (rama `feature/frontend-ux`)

### 5.1 Feedback móvil (`frontend_feedback_mobile.txt`), prioridad 1

Patrón común: **una tarjeta por producto o registro** en móvil. Cada tarjeta lleva borde, separación visual clara, encabezado con el nombre del producto, controles alineados y acción de quitar visible. Mantener un único árbol de controles RHF (sin duplicar inputs entre móvil y escritorio).

1. **Ventas — Registrar venta:** cada producto en su propia tarjeta individual. Hoy todo queda dentro de una sola tarjeta y no se distingue un producto de otro.
2. **Bodega — Nuevo despacho (modal):** misma separación por tarjeta para cada línea de producto.
3. **Bodega — Devoluciones:**
   - destacar con más fuerza las secciones "Productos del despacho" y "Envases" (encabezados con fondo o borde y color distinto, icono, conteo);
   - en 412×915 aprovechar el ancho: dos columnas o input a la derecha de la cantidad disponible, en lugar del valor arriba y un input largo debajo.
4. **Producción:**
   - Registrar producción: la lista "Producción reciente" en tarjetas.
   - Lo mismo en Historial, en "Totales por producto" de Indicadores y en Incidencias/mermas recientes, todos paginados (ver 5.2).
5. Revisar con el mismo criterio todas las demás vistas en teléfono y tablet (ver #86): Stock ("Desconocido", N-01), Clientes, Gastos, Ranking y Mi comisión.

**Aceptación:**
- Capturas antes/después a 412×915, 375×812, 768×1024 y 1024×1366.
- `scrollWidth <= innerWidth` en todas.
- Controles táctiles ≥ 44 px.
- Pruebas que verifiquen la estructura de tarjetas.

### 5.2 Paginación de historiales (OND-c07.10), prioridad 1

- **Paginación en servidor** (`range`/`limit` de PostgREST con `count: 'exact'` o paginación por cursor de fecha) en `api.ts` de cada dominio, combinada con los filtros existentes.
- **Ámbito:** historial de despachos (A1-08), devoluciones, producción reciente e historial, incidencias, mermas, ventas, clientes y gastos si crecen sin límite.
- **Componente compartido** de paginación accesible y táctil, apto para móvil: "Anterior / Siguiente" con "Página X de Y", o "Cargar más" en listas de tarjetas.
  - Elegir un patrón y documentarlo en `docs/engineering/frontend.md`.
- React Query con la clave incluyendo página y filtros, `placeholderData` para no parpadear, e invalidación correcta tras mutaciones.
- No cambiar el SQL salvo que haga falta un índice. En ese caso, primero proponerlo y pedir autorización (las migraciones no se aplican en remoto sin conciliación).
- **Aceptación:**
  - pruebas de páginas, filtros y vacíos;
  - medición del tamaño de las respuestas antes y después con muchos registros sintéticos (sembrar ≥ 300 registros locales).

### 5.3 OND-c07.19 — prueba unitaria intermitente, prioridad 2

- **Síntoma:** 1 fallo en 14 corridas de `npm run test` mientras 3 workers compilaban; no se identificó la prueba.
- **Investigar:**
  - correr la suite en bucle con carga simulada (`stress`/compilaciones paralelas);
  - registrar el nombre con `--reporter=verbose`;
  - revisar pruebas con `setTimeout`, `waitFor` largos, fechas reales (`Date.now`, medianoche, zona America/Santiago) y debounce (p. ej. `PersistenciaBorradorVenta` con 250 ms).
- **Corregir** con relojes falsos o esperas deterministas, sin subir timeouts a ciegas.

### 5.4 Lighthouse, prioridad 2

- Re-medir con el método de A3/C1 (`scripts/run-a3-baseline.mjs`) añadiendo los perfiles 412×915 y tablet.
- Investigar y corregir lo que queda por debajo de 100:
  - **`color-contrast`**, relacionado con `DESIGN.md` (sección 5.5);
  - **`unused-javascript`**, unos 450 ms simulados: revisar el chunk de entrada, `vendor-supabase` y los imports de rutas;
  - **CSS bloqueante**;
  - **logo fuera de pantalla.**
- Documentar el antes/después.

### 5.5 Revisión de `DESIGN.md`, prioridad 2

`DESIGN.md` está desactualizado respecto del código y tiene problemas de contraste (medidos con la fórmula WCAG):

| Combinación | Contraste | Estado |
| --- | --- | --- |
| Texto blanco sobre `brand-600` (`#3284bd`, botón primario y navegación activa) | **4,06:1** | No cumple AA (4,5:1) en texto normal |
| `slate-500` sobre `slate-100` (descripciones sobre el fondo de página) | 4,34:1 | No cumple |
| `red-600` sobre `red-50` (error en línea) | 4,41:1 | No cumple por poco |
| Texto blanco sobre `emerald-500` / `amber-500` (badges de devoluciones) | 2,54:1 / 2,15:1 | No cumple |
| `slate-400` como texto secundario sobre blanco | 2,56:1 | No cumple (ya corregido en `thCls`, pero `DESIGN.md` lo sigue recomendando) |
| Texto blanco sobre `brand-700` | 5,20:1 | Cumple |
| `brand-800` sobre blanco (`btnSecondary`) | 6,82:1 | Cumple |

**Otras inconsistencias:**
- la escala `brand` no es monótona: `brand-50` (`#cbebfc`) y `brand-100` son más oscuros que `brand-200`, y `brand-500` (`#749ccc`) es más apagado que `brand-400`;
- se menciona la campana de notificaciones (retirada) y `fmtFecha` de `lib/ui.ts` (obsoleto);
- falta documentar `EstadoVista`, `InputNumerico`, `CampoFormulario`, tarjetas móviles y paginación;
- no se indica que Mantine ya no existe;
- hay erratas ("Uso typical", "Cada roltiene").

**Acciones (Sonnet, con aprobación visual del responsable antes de aplicar cambios de color):**
- botón primario y navegación activa con `brand-700` o un `brand-600` más oscuro que cumpla ≥ 4,5:1;
- reordenar la escala `brand` para que sea monótona;
- textos secundarios ≥ `slate-600` sobre `slate-100`;
- errores con `red-700`;
- badges con texto oscuro sobre fondos `-100`;
- actualizar `DESIGN.md` y `docs/engineering/frontend.md`.

Medir de nuevo `color-contrast` en Lighthouse.

## 6. Plan de operación y seguridad (#46, #39, #44, #54)

Estos issues afectan GitHub, Vercel y Supabase. Trabajar en **ramas propias desde `develop`** (por ejemplo `chore/ci-hardening`), separadas de `feature/frontend-ux`, con PR hacia `develop`.

**Ningún cambio de configuración en paneles o APIs externas** (protección de ramas, environments, Vercel, Supabase Auth, secretos) se aplica sin confirmación explícita del responsable. Primero se presenta el plan con el diff exacto de configuración.

### 6.1 #46 — Proteger secretos y dependencias del CI (Beads OND-o5g), primero

1. Inventario de workflows (`.github/workflows/*.yml`): permisos por job, `timeout-minutes`, interpolación de secretos en `run:` y uso de `vercel@latest`.
2. **Fijar** todas las Actions por SHA (con comentario de versión) y Vercel CLI por versión exacta. Dependabot de `github-actions` mantiene las actualizaciones revisables.
3. **Permisos mínimos:** `permissions: contents: read` por defecto; escritura sólo donde haga falta. Quitar `pull-requests: write` si no se usa.
4. **Detección de secretos en PR:** gitleaks o trufflehog fijado por SHA, con un fixture sintético que debe hacer fallar el CI sin imprimir el valor.
5. **Revisión de dependencias:** `actions/dependency-review-action` en PR, diferenciando riesgos de runtime y de desarrollo.
6. **Proponer al responsable** (configuración del repo): activar secret scanning, push protection y alertas de Dependabot; mover los secretos de Vercel a environments.
7. **Aceptación:** los criterios del issue; evidencia sin secretos.

### 6.2 #39 — Unificar la publicación en Vercel (Beads OND-get)

1. **Diagnóstico:** doble publicación (integración Git de Vercel y GitHub Actions) para el mismo commit; `develop` sin protección; `main` con `enforce_admins=false`.
2. **Propuesta recomendada:**
   - desactivar los despliegues automáticos por Git en Vercel (`git.deploymentEnabled` en `vercel.json` o desde el panel);
   - publicar sólo desde Actions tras el CI verde (`needs: build`);
   - producción con aprobación del environment `production`;
   - `workflow_dispatch` con `ref` para redesplegar o hacer rollback.
3. **Protección de ramas (con autorización):** checks obligatorios del CI en `develop` y `main`; revisar `enforce_admins`.
4. **Ensayos:** un check fallido que impida publicar, una publicación correcta en preview y un rollback inocuo, documentando commit/artefacto/entorno.
5. Mantener la conservación de la CSP de `frontend/vercel.json`. No aplicar SQL automático en la publicación.

### 6.3 #44 — Supabase Auth: recuperación, sesiones y protección (Beads OND-d40)

1. **Revisar** (en modo lectura, vía `supabase` CLI/MCP con permisos del responsable) la configuración de Auth disponible en el **plan gratuito**:
   - altas deshabilitadas (ya cerradas);
   - redirect URLs limitadas a producción y desarrollo;
   - longitud y complejidad de contraseña;
   - límites de tasa;
   - expiración de JWT y refresco.
2. **Protección contra contraseñas filtradas:** verificar si está disponible en el plan; si requiere Pro, documentarlo como #41.
3. **Recuperación de contraseña:** flujo en el frontend (pantalla para solicitarla y para fijar la nueva) con mensajes en español. Probarlo con Mailpit local (`http://127.0.0.1:54324`). Valorar SMTP propio para producción (requiere decisión).
4. **Cuenta desactivada:** comprobar que `perfiles.activo=false` corta el acceso a los datos aunque el JWT siga vigente (RLS); prueba de integración.
5. **CAPTCHA (Turnstile):** evaluar y proponer; sólo implementarlo con aprobación.
6. **MFA administrativa:** proponer una política; decide el responsable.

### 6.4 #54 — Observabilidad y alertas (Beads OND-5a4)

1. **Estado:** existe `health.yml` (disponibilidad cada 30 minutos, con issue de incidente). Falta un recorrido sintético, la captura de errores del frontend y la correlación por versión.
2. **Propuesta de bajo costo** (decide el responsable):
   - errores del frontend con un `ErrorBoundary` global y un reporte mínimo y depurado (sin tokens, RUT, teléfonos ni montos individuales) hacia un servicio gratuito (p. ej. Sentry Developer) o, como mínimo, hacia los logs de Vercel;
   - versión (`__APP_VERSION__`) y entorno en cada evento.
3. **Recorrido sintético seguro:** login con una cuenta de monitoreo de sólo lectura y lectura de una vista, **sin crear ventas**, en el workflow de salud.
4. **Alertas:** al canal acordado, con pasos de respuesta y sin ruido. Documentar umbrales, responsable y retención en `docs/`.
5. No activar servicios de pago recurrentes sin aprobación.

## 7. Orden sugerido (oleadas, máximo 3 workers)

1. **Oleada 1:**
   - Codex: paginación compartida (componente + API) en despachos y devoluciones.
   - Sonnet: tarjetas móviles en Registrar venta y Nuevo despacho.
   - OpenCode: investigación de OND-c07.19 y línea base de Lighthouse con 412×915 y tablet.
2. **Oleada 2:**
   - Codex: paginación en producción, ventas, clientes y gastos.
   - Sonnet: Devoluciones a dos columnas, tarjetas de Producción e Indicadores, Stock (N-01).
   - OpenCode: documentación de #41 (plan Pro) y del patrón de paginación.
3. **Oleada 3:**
   - Sonnet: propuesta de colores y actualización de `DESIGN.md` (presentar antes de aplicar).
   - Codex: plan e implementación de la parte en el repositorio de #46 en `chore/ci-hardening`.
   - Revisiones cruzadas (Sonnet revisa a Codex y viceversa).
4. **Oleada 4:**
   - barrido final móvil y tablet (C2 extendido) y re-medición de Lighthouse;
   - planes detallados de #39, #44 y #54 para aprobación;
   - informe antes/después.

## 8. Cierre esperado

- Todo el frontend integrado en `feature/frontend-ux`, sin conflictos con `develop`, con CI verde en el PR #84 y las 5 verificaciones en verde.
- La carpeta del responsable actualizada (`git pull` en `~/Documents/ondina-frontend-ux` o `levantar.sh`).
- Workers liberados (`worker-list --terminal-state reclaimable` en 0), worktrees eliminados y `bd dolt push`.
- Un informe final con: mejoras realizadas, evidencia (capturas por viewport), decisiones pendientes para el responsable (colores, configuración externa de #39/#44/#46/#54) y cómo probar.
