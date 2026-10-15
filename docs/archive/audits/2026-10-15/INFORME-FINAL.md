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

## Decisiones pendientes y limitaciones

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
