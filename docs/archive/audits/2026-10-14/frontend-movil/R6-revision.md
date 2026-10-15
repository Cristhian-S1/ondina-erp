# R6 — Revisión cruzada de C3-A, C3-D y D2

Fecha de ejecución: **2026-10-15, America/Santiago**. Revisor: Codex, entregas de Sonnet. Rama: `Cristhian-S1/r6-revision`. Snapshot auditado: **`96b6a1c8d7bf6521126ed1cc8e9ee33b811aabdf`**, coincidente con la referencia local `origin/feature/frontend-ux`; es posterior al `4809b1a` del contexto común. El directorio fechado 2026-10-14 conserva la agrupación documental de esta campaña.

**Resultado: C3-A aprobar con cambios; C3-D aprobar; D2 aprobar.** Hay **3 hallazgos P3**, sin P0, P1 ni P2 reproducidos en el alcance. Los defectos son de presentación y visibilidad del foco; no se observó pérdida de valores ni una escritura de negocio durante la revisión.

## Alcance y procedencia

Se revisaron `AGENTS.md`, `README.md`, `docs/README.md`, `docs/engineering/frontend.md`, `DESIGN.md`, [C3-barrido-final.md](C3-barrido-final.md), [C3A-entrega.md](C3A-entrega.md), [C3D-entrega.md](C3D-entrega.md), [D2-entrega.md](D2-entrega.md) y la propuesta D1 referenciada por D2. Se localizaron las entregas con `git log --oneline origin/feature/frontend-ux -25` y se contrastaron los diffs con el código integrado:

| Lote | Implementación integrada | Informe integrado | Veredicto |
| --- | --- | --- | --- |
| C3-A · Registrar venta | `071f415` · tarjeta/tabla por contenedor y tarjeta compacta | `2cded7f` | **Aprobar con cambios**: R6-01 a R6-03. El problema de tablet C3-01 sí está resuelto. |
| C3-D · iconos y Paginacion | `a9ab0a7` | `c5f7479` | **Aprobar**: iconos diferenciados y paginación correcta con cero, una y varias páginas. |
| D2 · color aprobado | `fa579c4`; complemento de producción/InputNumerico `05b863a` | `d5c95ec` | **Aprobar**: tokens, N1, textos y Quitar coinciden con D1/`DESIGN.md`. |

Los hashes `028a308`/`a01e0de` del informe D2 corresponden a su entrega original; los hashes anteriores son los que aparecen en la historia integrada. Los cambios posteriores de C3-B/C3-C están presentes, pero esta revisión no sustituye sus revisiones específicas.

El código de la aplicación fue de **solo lectura**. Los únicos archivos entregados son este informe y cuatro PNG en `capturas/R6/`. Se copió el `.env.local` autorizado al checkout, ignorado por Git, con URL local `http://127.0.0.1:54321`. Su health devolvió HTTP 200. El intento de `npm run dev -- --port 5191 --strictPort` encontró el puerto ocupado por el servidor de `r5-revision`; se informó al coordinador y se usó **5192** sin detener el proceso ajeno.

## Hallazgos accionables

### R6-01 | severidad P3 | Cantidad de siete cifras recortada a 375 px

**Evidencia:** `frontend/src/domains/ventas/components/FilaProductoVenta.tsx:48` y `:50`; el espacio fijo de las flechas está en `frontend/src/components/InputNumerico.tsx:121`. [Captura 375×812](capturas/R6/venta-cantidad-375x812.png).

**Problema:** con Bidón POL, escribir `1234567` en Cantidad y salir del campo deja el valor real `1.234.567`, pero el input tiene `clientWidth=75`, `scrollWidth=88` y sólo **51 px útiles** después del padding. El texto mide **63,56 px** y queda cortado a la derecha en reposo (`scrollLeft=0`). El objetivo táctil sigue superando 44 px y el documento no desborda, por lo que las métricas generales no detectan el recorte. La cantidad ensayada excede la carga y se marca correctamente como inválida: el defecto afecta a la lectura/corrección del valor introducido, sin permitir una venta inválida.

Es una regresión de la compactación: antes de `071f415`, Cantidad ocupaba ambas columnas bajo `sm`; ahora comparte la fila en una proporción 60/40 desde 360 px, con dos botones de 44 px y sus separaciones dentro de la parte de Cantidad. A 412 px el mismo texto sí cabe: 74 px útiles.

**Corrección propuesta:** establecer un ancho útil mínimo para el texto numérico, contando padding, flechas y separaciones; usar el ancho real de la tarjeta para decidir cuándo compartir la fila, reajustar la proporción o apilar campos si no cabe. Mantener las flechas de 44×44 y el único árbol RHF. Verificar `1.234.567` completo después de blur a 375/412 px, además de conservar el error vinculado.

### R6-02 | severidad P3 | Cantidad y Precio no alinean sus inputs cuando la etiqueta se envuelve

**Evidencia:** `frontend/src/domains/ventas/components/FilaProductoVenta.tsx:30`, `:48` y `:53`; la etiqueta está en `frontend/src/domains/ventas/components/CampoFormulario.tsx:20`. [Captura 412×915](capturas/R6/venta-alineacion-412x915.png).

**Problema:** en la tarjeta de Bidón POL a 412 px, “Cantidad de Bidón POL” ocupa una línea y “Precio unitario de Bidón POL” ocupa dos. El input Cantidad empieza en **y=257** y Precio en **y=277**: desfase de **20 px**, también reproducido a 375 px. Las celdas comparten fila, pero cada `CampoFormulario` calcula su altura de etiqueta de manera independiente. El error bajo Cantidad sigue siendo legible y enlazado por ARIA; no es un defecto de envío de datos.

**Corrección propuesta:** reservar una altura común para las etiquetas de esta pareja o usar una composición de filas compartidas para etiquetas/controles/errores, manteniendo el mismo registro RHF. Comprobar productos con etiquetas de una y dos líneas y errores presentes/ausentes; evitar alinear todo el bloque por su borde inferior, porque un error podría volver a mover el input.

### R6-03 | severidad P3 | La barra fija cubre parcialmente Quitar durante la navegación con Tab

**Evidencia:** `frontend/src/domains/ventas/pages/RegistrarVenta.tsx:246`, `frontend/src/domains/ventas/components/FilaProductoVenta.tsx:59` y `frontend/src/domains/ventas/components/ResumenFormularioVenta.tsx:27`. [Captura del foco 412×915](capturas/R6/venta-foco-412x915.png).

**Problema:** con tres líneas iniciales, primera cantidad/precio `1234567`, partir del selector Cliente y avanzar con Tab llega al Quitar de la tercera tarjeta con foco. El botón ocupa **y=815–859**, mientras la barra fija comienza en **y=846**: sus **13 px inferiores quedan cubiertos**. El margen añadido en C3-A sólo alcanza `input` y `select`, no a los botones de las filas. `pb-28` permite llegar al final del documento, pero no garantiza que cada foco quede enteramente sobre la barra.

Se clasifica como límite residual de la protección de foco de C3-A, no como prueba de que el botón quede totalmente oculto ni de un incumplimiento automático de WCAG 2.4.11. La barra fija ya existía antes de este lote.

**Corrección propuesta:** extender la reserva de desplazamiento a los botones enfocables del contenido o aplicar `scroll-padding-bottom` al contenedor que realmente desplaza; conservar la barra y verificar el resultado real con Tab/Shift+Tab. Aceptación: rectángulo del control enfocado y su indicador completos por encima de la barra a 375/412 px, sin un efecto que quite foco al usuario.

## Verificación en navegador real

Chrome headless mediante Playwright, ejecutable `/usr/bin/google-chrome`, Vite de **este checkout** en `http://127.0.0.1:5192`, Supabase local. Inicio por `/login` con las cuentas de prueba vendedor y administrador de la tarea. Viewports CSS, sin dispositivo físico ni teclado virtual.

**Matriz principal: 30 combinaciones** = 2 roles × 3 rutas (`/ventas/registrar`, `/gastos`, `/clientes`) × 5 tamaños. **Matriz adicional D2: 20 combinaciones** = administrador × 5 rutas (`/`, `/stock`, `/despachos`, `/devoluciones`, `/produccion/historial`) × los 4 tamaños principales. **50/50 sin overflow horizontal global ni objetivos visibles menores de 44×44 px**; se excluyeron elementos ocultos y descendientes de `inert`. Esto no excluye el recorte interno R6-01 ni la superposición R6-03.

| Viewport | Contenedor productos con menú expandido | Modo vendedor / admin | Overflow global / objetivos <44 en matriz principal | Sonda numérica |
| --- | --- | --- | --- | --- |
| 412×915 | 378 px | tarjeta / tarjeta | ninguno / 0 | `1.234.567` cabe; desfase de inputs 20 px |
| 375×812 (adicional del contexto común) | 341 px | tarjeta / tarjeta | ninguno / 0 | Cantidad recortada; desfase 20 px |
| 768×1024 | 718 px | tarjeta / tarjeta | ninguno / 0 | texto completo; inputs alineados |
| 1024×1366 | 718 px | tarjeta / tarjeta | ninguno / 0 | texto completo; inputs alineados |
| 1280×800 | 974 px | tabla / tabla | ninguno / 0 | texto completo |

[Captura de las tarjetas a 1024×1366](capturas/R6/venta-tarjetas-1024x1366.png). Además se alternó el menú **en el mismo viewport 1024×1366**: el contenedor pasó de **718 a 910 px**, y la fila de `flex` a `table-row`. Se conservaron seis inputs de producto (tres cantidades y tres precios), sus valores y tres selects: evidencia de que el umbral responde al contenedor y no duplica formularios.

Sondas de comportamiento realizadas:

- Cantidad `12` → ArrowUp `13` → ArrowDown `12`; quitar la primera fila preservó el `12` y las etiquetas del producto de la siguiente. La lista usa `field.id` como key (`RegistrarVenta.tsx:271`).
- Confirmar con Cliente vacío produjo foco en `select[name=clienteId]`, `aria-invalid=true`, objetivo de 44 px y posición visible. “Excede tu carga” permaneció asociado al input por `aria-describedby` con `aria-invalid=true`.
- Drawer de ambos roles a 412: Shift+Tab desde Cerrar menú permaneció dentro del diálogo y llegó a Cerrar sesión; Escape devolvió el foco a “Alternar menú lateral”. Los SVG de Ranking y Comisión fueron distintos en el menú vendedor. El administrador no tiene Mi comisión, según la configuración de roles existente.
- Gastos vacío: “0 registros”, cero botones de página en ambos roles y todos los anchos. Clientes vendedor: “5 registros”, cero botones. Clientes admin sin selección: estado de selección pendiente y sin paginación; no se confunde con cartera vacía.
- Historial de producción admin a 412: Siguiente anunció “Página 2 de 10 · 93 registros” y Anterior volvió a “Página 1 de 10 · 93 registros”. Se ejercitó así el consumidor real de Paginacion con varias páginas, sin crear datos.
- Las sesiones y las sondas terminadas no registraron errores de página ni errores/advertencias de consola en la matriz principal. En la matriz adicional se controlaron excepciones de página. Las peticiones REST fueron GET y ocho POST a la RPC de **lectura** `vendedores_sucursal`; no se invocó una mutación de negocio.

## Calidad, accesibilidad y pruebas

**C3-A:** un `useForm`, un `useFieldArray` y una fila por `field.id`; se mantiene `CampoFormulario`/`InputNumerico`, con refs, labels y mensajes vinculados. El diff cambia CSS y no introduce efectos, accesos Supabase, claves Query ni duplicación de lógica de dominio. `ResumenFormularioVenta` conserva su `useWatch` y no fue reimplementado. El cambio por ancho de contenedor funciona, con las tres salvedades anteriores.

La prueba añadida en `frontend/src/domains/ventas/pages/RegistrarVenta.test.tsx:440` comprueba clases, estructura y cantidad de controles; **no prueba geometría renderizada**. La aserción de `pb-28`/`scroll-mb-28` en `:460` tampoco prueba que el foco no quede tapado. Es una comprobación estructural útil para detectar duplicación, pero seguiría pasando con los tres problemas reproducidos. Al corregirlos, añadir comprobaciones de navegador de ancho interno, posiciones y superposición; no sustituirlas por más aserciones de nombres de clases.

**C3-D:** `Paginacion.tsx:15–24` conserva nav etiquetada, `aria-busy`, status/live polite, botones nativos, extremos deshabilitados y objetivos de 44 px cuando hay varias páginas. Las pruebas de `Paginacion.test.tsx` sí ejercitan cero/una/múltiples páginas, callbacks, extremos y carga; las pruebas de consumidores se actualizaron al contrato nuevo. `icons.test.tsx:6` comprueba SVG decorativo y formas distintas, pero no el enlace ruta→icono; ese enlace se contrastó con `ventas/index.tsx:63–73` y el menú real. No hay dependencia nueva.

**D2:** tokens 50–600 iguales a los valores aprobados; 700–900 conservados. N1 usa `bg-brand-700`, texto blanco y barra blanca de 4 px; Quitar reutiliza `btnDangerOutline`, con borde/texto `red-700` sobre blanco. Los textos secundarios y errores revisados usan las clases aprobadas. Se recalcularon contrastes con el lector de tokens existente `D1-colores-lib.mjs`, sin regenerar sus archivos:

| Par | Contraste actual recalculado |
| --- | --- |
| blanco / brand-600 `#2c7bb1` | 4,590:1 |
| blanco / brand-700 `#2b72a3` | 5,200:1 |
| slate-600 / slate-100 | 6,923:1 |
| red-700 / blanco | 6,421:1 |
| red-700 / red-50 | 5,870:1 |
| blanco / amber-600 (punto, no textual) | 3,199:1 |
| blanco / emerald-600 (punto, no textual) | 3,653:1 |

Las pruebas D2 de `lib/ui.test.ts` fijan clases y altura mínima declarada; la geometría de objetivos y estos cálculos aportan verificación adicional. El Lighthouse 14/14 de D2 es evidencia **documentada por su entrega**, no una nueva ejecución R6. No se detectaron cambios a reglas de negocio, autorización o flujo de consultas por el diff de color. El catálogo global y la carga por perfil mantienen sus claves anteriores; esta revisión no certifica todas las claves del proyecto ni la seguridad de base de datos.

## Controles ejecutados en R6

Desde `frontend/`, sobre el snapshot indicado y con `.env.local` local:

| Comando | Resultado fresco |
| --- | --- |
| `npm run lint` | PASS, salida 0 |
| `npm run build` | PASS, salida 0 |
| `npm run size` | PASS, cinco métricas dentro del presupuesto |
| `npm run test` | PASS, **66 archivos / 786 pruebas**, salida 0 |

Presupuesto, en **bytes** con punto como separador de miles: JS entrada gzip **91.395** frente a 100.531; CSS entrada/inicial gzip **8.343** frente a 8.422 (+9,0% respecto de base); mayor chunk JS **294.375** frente a 323.790; JS inicial total gzip **149.353** frente a 164.284. El CSS queda cerca del límite, pero no lo supera y R6 no lo modifica.

No se ejecutó `test:integration`, no se reinició la base, no se crearon fixtures ni datos masivos, no se modificaron código, SQL, `supabase/` o `.opencode/`, y no se hizo push/merge/PR. Los scripts y logs de la revisión quedaron temporales en `/tmp/r6-*`; las mediciones relevantes y las cuatro capturas se conservan aquí. Las cantidades extremas fueron entradas temporales del formulario, sin confirmar una venta válida. Los datos locales compartidos pueden cambiar por otras sesiones; el conteo de 93 registros es una observación de este momento.

## Entrega y límites de aceptación

**C3-A se puede integrar con cambios acotados** a la distribución y protección de foco de la tarjeta: resolver R6-01/R6-02/R6-03 y comprobarlos en navegador. **C3-D y D2 quedan aprobados en el alcance revisado.** No se requiere una decisión nueva de color o negocio para las correcciones propuestas.

Esta es una revisión local del frontend, con datos sintéticos y cuentas de prueba; no certifica producción, RLS/RPC, dispositivos físicos, lectores de pantalla ni teclado virtual. El foco parcial de R6-03 se observó con teclado de escritorio emulado a ancho móvil. Los controles disabled se midieron como objetivos cuando eran visibles, pero no se exige a su color el contraste de controles activos.
