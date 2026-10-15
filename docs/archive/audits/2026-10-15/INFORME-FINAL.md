# Informe final — Mejora del frontend de Ondina (OND-c07), 2026-10-13 a 2026-10-15

- **Rama:** `feature/frontend-ux`. Se partió de `develop` `40c152b` y ya incluye los últimos cambios de `develop`.
- **PR #84:** en borrador y sólo para CI. No se fusionó: la integración la decide el responsable.
- **Alcance:** calidad, rendimiento, usabilidad y responsividad del frontend, con prioridad para teléfono y tablet.
  - Sin HU del Sprint 2.
  - Sin cambios de SQL, migraciones ni configuración externa.
- **Orquestación:** Orca, con un máximo de 3 workers:
  - Codex `gpt-6.1-sol` para la parte técnica.
  - Claude Sonnet 5.5 para UX/UI y revisiones.
  - OpenCode GLM-5.3-Flash para mediciones y documentación.
  - Cada lote pasó una revisión cruzada (Sonnet revisa a Codex y viceversa).

## Antes y después

| Indicador | Antes (A3, 2026-10-13) | Después (C4, 2026-10-15) |
| --- | --- | --- |
| CSS inicial (gzip) | 43,7 KB | 8,4 KB (−81 %): se retiró Mantine y el CSS va incrustado |
| JS inicial total (gzip) | 158,9 KB | 149,3 KB (−6 %) |
| Bytes transferidos en primera carga | 206–209 KB | −12 % a −19 % según la ruta |
| Lighthouse, accesibilidad | 92–95 | 100 en las 15 combinaciones (5 perfiles × 3 rutas) |
| Lighthouse, rendimiento | 96–97 (móvil y tablet), 100 (escritorio) | 97–98 (móvil y tablet), 100 (escritorio); TBT 0 y CLS 0 |
| Desbordes horizontales | 3 rutas a 375 px | 0 en 280 combinaciones (5 roles × 5 viewports) más 80 estados |
| Controles táctiles < 44 px | 1 | 0 |
| Pruebas unitarias | 529 | 799 |
| Integración contra Supabase local | 22 | 22 |

Las mediciones son locales (Supabase local, Lighthouse 12.8.2 con Chrome 155) y siguen el método documentado en `2026-10-13/frontend-ux/A3-linea-base.md`, `2026-10-14/frontend-movil/Q1-lighthouse-base.md` y `2026-10-15/frontend-movil/C4-lighthouse-final.md`.

## Qué cambió

- **Base común:**
  - Menú móvil accesible (ciclo de foco, `inert` en el fondo, Escape).
  - Componentes compartidos: `EstadoVista`, `InputNumerico` (sólo dígitos, miles es-CL, flechas ±1, error en tiempo real) y `Paginacion`.
  - Helpers de fecha con zona America/Santiago.
  - Colores aprobados (D1/D2) con contraste AA.
  - Mantine y dayjs retirados.
  - TypeScript `strict` y presupuesto de bundle de cinco métricas.
- **Ventas:**
  - Una tarjeta por producto, con umbral tabla/tarjeta según el ancho del contenedor.
  - Errores enlazados al campo (`CampoFormulario`).
  - Resumen de venta sin redirección.
  - Máximo de productos según el catálogo.
  - Confirmación explícita de ventas de $0.
  - Ranking con mes en hora de Santiago.
- **Bodega:**
  - Sin mezcla de datos entre sucursales.
  - Modal de despacho por tarjetas, alineado y con validación en vivo.
  - Devoluciones en secciones, con advertencia (no bloqueo) de envases en exceso.
  - Paginación en servidor.
- **Producción:**
  - Un error ya no se muestra como cero o lista vacía.
  - Consultas por sección, paginación y tarjetas compactas.
  - Pestañas Incidencias/Mermas en móvil.
  - Validación en vivo de mermas contra el stock de bodega y de producción contra envases vacíos.
  - "Hoy" se renueva a medianoche.
- **Calidad:**
  - Se arregló una prueba intermitente y se reforzaron los tiempos de espera.
  - Las pruebas unitarias pasan sin `frontend/.env.local`, igual que en CI.

El detalle por lote está en `2026-10-13/frontend-ux/` (A1–A3, B1–B7, F1–F3, C1–C2), `2026-10-14/frontend-movil/` (M1, M2, P1, P2, Q1, L1, D1, D2, C3, C3A–C3D, R5, R6, FX5, FX6) y `2026-10-15/frontend-movil/C4-lighthouse-final.md`.

## Trabajo de operación (PR hacia `develop`, sin fusionar)

| PR | Tema | Pendiente del responsable |
| --- | --- | --- |
| #87 | Escaneo de secretos y revisión de dependencias (#46) | Activar *secret scanning*, *push protection* y mover secretos a environments |
| #88 | Backups/PITR como requisito del plan Pro (#41) | Decidir el plan |
| #89 | Errores del frontend correlacionados y sintético de salud de sólo lectura (#54) | Cuenta de monitoreo, secretos, servicio de errores y canal de alertas |
| #90 | Recuperación de contraseña y corte de cuentas desactivadas (#44) | Aprobar `https://ondina-erp.vercel.app/restablecer`, definir la URL estable de desarrollo, SMTP, y decidir CAPTCHA/MFA |
| #91 | Publicar sólo con CI verde del commit exacto; plan de #39 | Protección de ramas, `enforce_admins`, autoaprobación de producción y secretos de Vercel (diff exacto en `2026-10-15/operacion/O4-plan-39.md`, rama `chore/vercel-unificar`) |

## Actualización 2026-10-15 (sesión 2: OND-c07.13)

Evidencia en `2026-10-15/frontend-c07-13/`. Orquestación con Orca (Run `run_d281c7e81cb3`): Codex `gpt-6.1-sol` (K1, F1, V2, I1), Claude Sonnet 5.5 (K2, K3, F2, V1, V3) y OpenCode GLM-5.3-Flash (M1).

- **Decisiones del responsable:**
  - Se actualizó la línea base de CSS a 8.405 B (límite 9.246 B) en `69070fc`.
  - La evidencia de más de 30 MB se resolverá con *squash* al fusionar.
  - Se aprobaron el ensayo de integración de los PR y la propuesta de R1-14.
- **R2-13:**
  - `CampoFormulario` pasó a `components/` y ganó las props opcionales `id`, `descripcionId` y `alerta`; Ventas no cambia.
  - Bodega (modal de despacho, líneas y Devoluciones) y Producción (registrar, incidencia y merma) usan el patrón accesible.
  - Los errores de envío se anuncian con `role="alert"`, y el error se anuncia antes que la ayuda.
  - Entregas K1/K2 y correcciones F1/F2, tras las revisiones cruzadas V1 y V2.
- **R1-12:** `Despachos.tsx` pasó de 776 a 85 líneas, con filtros, historial, detalle y modal en `bodega/components/`. El borrador del modal sobrevive a los estados de carga y error.
- **R1-14:** propuesta de RPC aditiva `vendedores_historial_sucursal`, con la misma compuerta de rol y sucursal y una prueba pgTAP.
  - Sólo se validó en Supabase local, dentro de una transacción con `ROLLBACK`; no se aplicó nada.
  - Documento: `R1-14-propuesta.md`. Tarea de backend: `OND-c07.23`.
- **Integración de los PR (I1):** se recomienda fusionar #87 → #91 y después #84 → #89 → #90. Las ramas de ensayo son locales y no se publicaron: `prueba/integ-84-89-90`, `prueba/integ-87-91` y `prueba/integ-conjunta-87-91-84-89-90`.
  - Hay conflictos sólo en importaciones de `App.tsx` y en documentación y workflows; están resueltos y documentados.
  - #90 necesita un ajuste en el guard del bundle para su marcador de recuperación (commit `aeaf8e8` de la rama de ensayo).
- **Verificación:**
  - Lint, build, size y 824 pruebas unitarias (también sin `.env.local`) más 22 de integración en `feature/frontend-ux`.
  - En el ensayo conjunto, 872 pruebas unitarias y 24 de integración.
  - Barrido visual V3 aprobado a 412, 768, 1024 y 1280 px.
- **Pendiente menor:** `OND-c07.24` (P4), el menú móvil sigue abierto si se cambia de breakpoint sin recargar (M1). Lo observado en V1 al recargar fue un artefacto del método.

## Decisiones pendientes y limitaciones (al cierre de la sesión 1)

1. **Presupuesto de CSS:** el CSS de entrada mide 8.405 B y el límite es 8.422 B. Creció un 9,8 % por la UI móvil aprobada. Hay que decidir si se actualiza la línea base de `frontend/bundle-budget.json`; si no, el próximo cambio de estilos hará fallar el CI.
2. **Orden de integración:** #84 se solapa con #89 y #90 en `App.tsx`, `main.tsx`, `ErrorBoundary.tsx`, `Login.tsx` y `ProtectedRoute.tsx`, y #87 se solapa con #91 en `docs/engineering/deployment.md`. Conviene fusionar una y rebasar la otra.
3. **Tamaño de la evidencia:** pasa de 30 MB en `docs/archive/audits/`. Antes de fusionar, decidir si se hace *squash* o se mueve fuera del repositorio.
4. **Fuera del frontend:**
   - R1-14: ver nombres de vendedores inactivos requiere un cambio en la RPC `vendedores_sucursal`.
   - R2-04: idempotencia de "registrar producción" (se decidió aceptar duplicados).
5. **Deuda técnica (OND-c07.13):**
   - R1-12: `Despachos.tsx` sigue siendo grande.
   - R2-13: `CampoFormulario` todavía no se usa en Bodega ni en Producción.

## Cómo probar

En esta máquina, desde `~/Documents/ondina-frontend-ux`, ejecutar `.ux-local/levantar.sh` (con `--reset` para datos limpios y `--host` para el teléfono). Cuentas `ux-vendedor@`, `ux-bodega@`, `ux-produccion@`, `ux-admin@` y `ux-admin-global@` con dominio `example.invalid` y contraseña `ux-local-2026`. En Windows 11 se usa `~/Downloads/probar-frontend-ux-windows.ps1`.

Verificaciones, desde `frontend/`: `npm run lint && npm run build && npm run size && npm run test && npm run test:integration`. Para reproducir el CI, la suite unitaria también debe pasar sin `frontend/.env.local`.
