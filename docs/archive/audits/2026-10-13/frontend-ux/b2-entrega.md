# B2 — Entrega de Producción

Fecha de verificación: 2026-10-13, America/Santiago. Rama: `Cristhian-S1/fux-b2-produccion`. Base recibida: `ac385d6` de `origin/feature/frontend-ux`. Tarea: Beads `OND-c07.5`, Orca `task_545c1babb4a4`, despacho `ctx_6cd206990593`.

La implementación del dominio está terminada. Lint, build y tests pasan; las cinco secciones caben en los tres anchos pedidos. **`npm run size` continúa fallando por una regresión preexistente de la base**, reproducida sin cambios B2 y aceptada expresamente por el coordinador para esta entrega; no se presenta como una cuarta verificación verde.

## Hallazgos resueltos y commits

| Hallazgo | Resultado | Commit |
| --- | --- | --- |
| A1-05 | Historial e Indicadores separan carga, error, vacío y éxito; Reintentar consulta el recurso concreto. Los datos retenidos en caché se ocultan tras un fallo; las métricas sin dato válido muestran `—`. | `33d417cfc6f66969bda4eb748e35560a7c302c43` |
| A1-07 | Consultas independientes por sección; Historial/Indicadores comienzan sin esperar productos, mermas o incidencias. Stock y empaques se solicitan en paralelo y se unen al resolver ambos. Invalidación por recurso, identidad y sucursal; suscripción Realtime con limpieza y rechazo de callbacks antiguos. | `2dca87ab294b4311d48947be354a6f1afb4d57b2` |
| A1-10, UX-02 | Grids de mínimo cero, hijos `min-w-0` y texto largo con ajuste de línea; tablas como tarjetas bajo 640 px en un único árbol. Historial, mermas, producción reciente y desglose de indicadores usan el mismo componente del dominio. | `33d417c` + `2dca87a` |
| UX-12 | Producción, merma e incidencia notifican éxito/error mediante `useToast`/`Toast`; conservan campos ante error, permiten cierre y usan el temporizador compartido. Los errores de lectura usan `EstadoVista` con reintento. | `2dca87a` |
| UX-13 | Título y descripción por sección, selector administrativo bajo el título y cinco enlaces existentes visibles bajo `lg`; selección activa comprobada en navegador. | `2dca87a` |
| UX-09 | Todas las fechas visibles usan `fmtFechaHora`; períodos de indicadores usan el día de Santiago mediante `fmtFecha`, incluso en navegador UTC. Sin segundos; zona indicada en la interfaz. Los controles nativos `type=date` mantienen sus valores y restricciones. | `33d417c` + `2dca87a` |
| UX-11, parte Producción | Carga, error, vacío y fallback de página usan `EstadoVista`; formularios conservan valores al fallar una lectura y al consultar otra sección. | `33d417c` + `2dca87a` |

## Pruebas

Se añadieron 29 casos netos: el dominio pasa 141 pruebas en 11 archivos; la suite completa pasa 581 pruebas en 48 archivos. Se observaron fallos antes de corregir los estados, consultas, formato de fechas, tablas, títulos y notificaciones.

- Primer error y recuperación específica de Historial/Indicadores; error tras éxito, tanto al cambiar la versión como al invalidar la misma entrada de caché. No se representan ceros, mensajes vacíos ni filas anteriores como resultado válido de una lectura fallida.
- Historial/Indicadores no solicitan recursos de otras secciones y pueden resolver mientras el catálogo sigue pendiente; las mermas resuelven mientras las incidencias siguen pendientes.
- Stock comienza antes de resolver empaques; se conserva la normalización de retornables.
- Realtime informa el recurso, invalida exclusivamente sus consultas, conserva filtros de sucursal y elimina canales al cambiar identidad/sucursal o desmontar. Las mutaciones invalidan sólo sus recursos afectados; producción también invalida envases.
- Filas únicas con etiquetas de tarjeta para historial/mermas y fecha `12-10-2026 23:15` a partir de `2026-10-13T02:15:59Z`.
- Toast cerrable en éxitos/errores, conservación de campos de las tres mutaciones, desaparición automática de validación y limpieza de notificación al cambiar sección sin borrar el formulario.
- Título y navegación de las cinco secciones antes de elegir sucursal administrativa; se conservan las regresiones anteriores de ámbito y respuestas tardías.
- Períodos de 1/7/30 días de Santiago comprobados con reloj UTC cerca del cambio de día.

## Cuatro verificaciones obligatorias

Ejecutadas desde `frontend/`, sobre el código entregado:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | **Exit 0**, sin errores ni warnings. |
| `npm run build` | **Exit 0**, TypeScript y Vite correctos. Conserva dos avisos preexistentes: import estático/dinámico de `lib/dashboard.ts` y chunk mayor a 500 KB. |
| `npm run test` | **Exit 0**, 48/48 archivos, 581/581 pruebas. No se ejecutó `test:integration`. |
| `npm run size` | **Exit 1**, JS de entrada y chunk máximo ya exceden el presupuesto en la base. CSS dentro del presupuesto. Excepción de entrega confirmada por el coordinador; corrección a cargo de B6. |

Comparación con una extracción limpia de `ac385d6` mediante `git archive`, construida con el mismo `node_modules` y la misma configuración local pública:

| Métrica (bytes) | Base limpia `ac385d6` | B2 final | Delta B2/base | Límite aprobado del presupuesto |
| --- | ---: | ---: | ---: | ---: |
| JS de entrada gzip | 155.858 | 155.899 | +41; **+0,0263 %** | 105.567 |
| Chunk JS máximo sin comprimir | 532.971 | 533.067 | +96; **+0,0180 %** | 332.108 |
| CSS de entrada gzip | 43.673 | 43.795 | +122; +0,2794 % | **47.853 — verde** |

El coordinador confirmó que B5 cambió la distribución del chunk de Supabase en el arranque con `.env.local` real y que B6 corregirá la partición y la medición del conjunto inicial. Autorizó `outcome succeeded` con lint/build/test verdes, incremento menor al 0,1 % en las dos métricas JS ya fallidas y CSS dentro de su propio presupuesto; ambas condiciones se cumplen. No se modificaron `bundle-budget.json`, `vite.config.ts` ni archivos compartidos.

## Navegador y capturas

Chrome headless con Playwright contra `http://127.0.0.1:5184`, cuenta local `ux-produccion@example.invalid` y zona del navegador **UTC**. Autenticación, productos, empaques y stock de envases reales del Supabase local. Para poblar y tensionar el layout se interceptaron únicamente respuestas del navegador con producción, historial, indicadores, mermas e incidencias sintéticas, incluyendo cadenas largas sin espacios; **no son saldos reales ni se insertaron estos registros en la base**.

Cada celda indica `scrollWidth / innerWidth`; las 15 mediciones cumplen `document.documentElement.scrollWidth <= innerWidth`:

| Sección | 375 px | 768 px | 1280 px |
| --- | --- | --- | --- |
| Registrar producción | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Envases | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Historial | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Indicadores | 375 / 375 | 768 / 768 | 1280 / 1280 |
| Incidencias y mermas | 375 / 375 | 768 / 768 | 1280 / 1280 |

Se comprobó además en navegador el estado activo de los cinco enlaces y la conversión efectiva de tablas (`thead: none` a 375; `table-header-group` a 768/1280). Historial e Indicadores superaron la inyección de 503 en primer acceso y tras éxito, ocultaron datos inválidos y recuperaron con su botón Reintentar. Cero errores JavaScript de página durante el recorrido.

Ocho capturas después, todas menores de 300 KB:

- [Registrar, 375](capturas/b2-produccion_registrar-produccion-375.png)
- [Envases, 375](capturas/b2-produccion_envases-produccion-375.png)
- [Historial, 375](capturas/b2-produccion_historial-produccion-375.png)
- [Historial, 1280](capturas/b2-produccion_historial-produccion-1280.png)
- [Indicadores, 375](capturas/b2-produccion_indicadores-produccion-375.png)
- [Indicadores, 768](capturas/b2-produccion_indicadores-produccion-768.png)
- [Incidencias, 375](capturas/b2-produccion_incidencias-produccion-375.png)
- [Incidencias, 1280](capturas/b2-produccion_incidencias-produccion-1280.png)

## Límites y pendientes

Ningún hallazgo funcional asignado se descartó. La única aceptación parcial es la verificación global `size`, con la excepción y evidencia anteriores; B6 debe volver a ejecutar esa puerta al integrar su corrección.

No se verificó entrega de eventos Realtime del servidor ni publicación remota de tablas: se conservaron y probaron el contrato de suscripción, filtros, invalidación y limpieza. Las mutaciones se verificaron con Vitest/Testing Library y servicios simulados; el recorrido visual no insertó datos. El selector administrativo y la separación de ámbitos tienen pruebas unitarias; el recorrido visual con datos corresponde al rol producción. No hubo pruebas de integración, SQL, migraciones, acceso a producción, cambios de permisos/rutas, push, merge, rebase ni PR. Se creó únicamente el `.env.local` ignorado solicitado con URL/anon key del Supabase local. Los cambios versionados se limitan al dominio de Producción y a este informe/capturas de entrega.
