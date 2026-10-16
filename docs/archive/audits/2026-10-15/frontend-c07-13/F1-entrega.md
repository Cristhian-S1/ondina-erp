# F1 · Correcciones de V1 en Bodega

Fecha: 2026-10-15, America/Santiago. Beads `OND-c07.13`; task `task_a0ddee62f589`; dispatch `ctx_25f1c660310a`.
Rama `Cristhian-S1/f1-bodega`, creada con árbol limpio desde `integ/c07-13` en **0ea1638**, sin reset. Alcance: V1-01, V1-02 y V1-03 completados.

## Cambios

- **V1-01:** `frontend/src/domains/bodega/components/ModalNuevoDespacho.tsx:115-125` muestra «Selecciona un vendedor.», «Selecciona un producto.» o «Ingresa una cantidad mayor que cero.» bajo el campo correspondiente, conservando foco y `role="alert"`. El texto original queda como resumen cuando se quitaron todas las líneas. Se mantienen las reglas de stock/bandejas y la selección de líneas válidas.
- **V1-02:** `frontend/src/components/CampoFormulario.tsx:28` concatena `<id>-error` antes de `descripcionId` cuando existe error; al corregirlo conserva sólo la ayuda. Se actualizaron su prueba y la frase autorizada de `docs/engineering/frontend.md:74`. Las props y los IDs no cambian.
- **V1-03:** `frontend/src/domains/bodega/pages/Despachos.tsx:42-52,84-88` renderiza carga/error dentro del mismo árbol y conserva siempre montado `ModalNuevoDespacho`. Durante el estado completo sin datos lo mantiene cerrado para no operar con recursos incompletos; al recuperarse reaparece con el borrador anterior. Se conserva vendedor, producto, cantidad, bandejas manuales y el nodo del input. El aislamiento por identidad/sucursal sigue en `AmbitoBodega`; no se modifica su contrato. La página queda en **91 líneas**.

## Pruebas y gates

Node **22.23.3**, comandos desde `frontend/`. Se añadieron cinco casos de Bodega (tres mensajes y dos transiciones sin datos), se actualizaron dos expectativas de mensajes existentes y el caso compartido del orden de descripción.

| Verificación | Resultado |
| --- | --- |
| Regresiones antes de corregir | **6 fallos / 39 verdes**, causas esperadas |
| `npx vitest run src/domains/bodega/pages/Despachos.test.tsx src/components/CampoFormulario.test.tsx` | **45/45** |
| `npm run lint` | PASS, salida 0 |
| `npm run build` | PASS, salida 0 |
| `npm run size` | PASS, CSS inicial **8.405 B**, límite **9.246 B**, cinco métricas verdes |
| `npm run test` | **822/822, 70 archivos**, salida 0 |
| Suite completa sin `.env.local` | **822/822, 70 archivos**, salida 0; env restaurado |
| `git diff --check` | PASS |

La regresión V1-03 usa las consultas reales de React Query con servicios de lectura simulados: `client.resetQueries({ queryKey: ['bodega'] })` elimina los datos del mismo ámbito, se observa carga completa y se resuelve o rechaza el catálogo. En el caso rechazado se reintenta la lectura. Al recuperarse se comprueban todos los valores, la identidad del input y que no hubo registro. No es una recarga de navegador ni persistencia entre sesiones.

## Navegador y capturas posteriores

Chrome real con Playwright, `ux-bodega@example.invalid`, Supabase local y Vite en `127.0.0.1:5192`. Se verificaron los tres mensajes de despacho, su descripción/estado inválido/foco, el resumen sin líneas y el orden error → ayuda en Devoluciones, en los cuatro viewports. No hubo errores de consola/JavaScript ni peticiones REST de escritura de dominio; las escrituras de negocio estaban interceptadas y bloqueadas como resguardo.

| Viewport | scrollWidth modal | Controles visibles <44 px | Mensajes y orden accesible |
| --- | ---: | ---: | --- |
| 412×915 | 412 | 0 | PASS |
| 768×1024 | 768 | 0 | PASS |
| 1024×1366 | 1024 | 0 | PASS |
| 1280×800 | 1280 | 0 | PASS |

También se comprobó `dialog.scrollWidth <= dialog.clientWidth`. Las cuatro capturas requeridas muestran Producto/Cantidad en error a teléfono y tablet, sin reescalar; en teléfono el modal está desplazado al control enfocado. Se inspeccionaron visualmente y se cuantizó la paleta para reducir tamaño.

| Captura | Bytes |
| --- | ---: |
| [modal-cantidad-1024x1366-despues.png](capturas/F1/modal-cantidad-1024x1366-despues.png) | 41360 |
| [modal-cantidad-412x915-despues.png](capturas/F1/modal-cantidad-412x915-despues.png) | 17184 |
| [modal-producto-1024x1366-despues.png](capturas/F1/modal-producto-1024x1366-despues.png) | 41908 |
| [modal-producto-412x915-despues.png](capturas/F1/modal-producto-412x915-despues.png) | 17752 |

## Commits y límites

1. `3e4c27e` — `fix(forms): announce field errors before additional help`.
2. `e4861a2` — `fix(bodega): preserve dispatch drafts and clarify field validation`.
3. Informe/capturas en el commit `docs(bodega): record F1 fixes and visual evidence`.

No se tocó `domains/produccion/**`, SQL, `supabase/`, `.opencode/` ni la BD remota; no hubo push, merge ni PR. El cambio compartido está expresamente autorizado en F1 y se notificó al coordinador para la integración con el worker de Producción. No se ejecutó `test:integration`, reservado al coordinador. La preservación durante estados completos se acredita con la regresión de consultas; el barrido real verifica mensajes, ARIA, medidas y capturas. Integración y verificación conjunta con la entrega paralela quedan al coordinador.
