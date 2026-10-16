# V2 · Revisión cruzada de K2 y K3

Fecha: 2026-10-15, America/Santiago. Beads: `OND-c07.13`. Task: `task_c85c08b2a8e0`. Dispatch: `ctx_106d29d6ae7b`.

## Veredictos

| Entrega | Veredicto | Motivo |
| --- | --- | --- |
| K2 (`2b1f48d`, `ec10ef9`) | **Aprobar con cambios; corregir V2-01 antes de integrar como equivalente** | Validaciones, foco, pestañas, mensajes, vínculos y unicidad de errores funcionan; se pierde el anuncio semántico de errores de envío, incluido un envío con Enter sin cambio de foco. |
| K3 (`af13d7e`, sólo propuesta) | **Aprobar la propuesta con observaciones P3** | El SQL conserva la compuerta vigente y la minimización de datos; completar negativos de pgTAP y detallar la reversión antes de convertirlo en migración ejecutable. Esta revisión no autoriza aplicar SQL. |

**Hallazgos: 1 P2 y 2 P3; ningún P1 identificado en el material revisado.** El resultado satisfactorio de esta tarea significa revisión entregada, no aceptación sin condiciones de las dos entregas.

## Alcance y evidencia

Se revisó `/home/cristhian/orca/workspaces/ondina/k2-produccion`, HEAD `af13d7e`, con base `origin/feature/frontend-ux = 69070fce076e542ef7c675c428ce4a9e0f2f089f`. Al cerrar V2, el worktree había avanzado a `25b0932` únicamente por el informe/capturas V1; `git diff af13d7e..25b0932 -- frontend/src/domains/produccion` está vacío, por lo que código, pruebas y propuesta revisados no cambiaron. Las referencias de K2/K3 siguientes corresponden al snapshot `af13d7e`; las referencias a CampoFormulario extendido corresponden a K1 `ac666f0`, disponible en esta rama.

El diff completo contiene 13 archivos: tres archivos de Producción, dos documentos y ocho capturas K2. Se revisaron el código anterior con `git show 69070fc:<ruta>`, el diff y las fuentes actuales de la RPC/helpers/políticas en las migraciones versionadas. No se ejecutó SQL directo ni se modificó esquema o datos de negocio durante V2; el navegador sólo hizo las lecturas de aplicación necesarias.

## V2-01 · P2 · K2 pierde `role="alert"` en errores de envío y el foco no siempre cambia

**Evidencia:**

- Base `69070fc`, `frontend/src/domains/produccion/pages/Produccion.tsx:101-102`: `errorCampo()` renderizaba el párrafo del error de envío con `role="alert"`; en `:182-185` incluía producto y cantidad de producción.
- K2, `frontend/src/domains/produccion/pages/Produccion.tsx:178-179`, `:193`, `:209-213`: selects/textareas delegan el error al CampoFormulario original sin rol; cantidades delegan el error a InputNumerico, cuyo párrafo tampoco tiene rol ni región viva (`frontend/src/components/InputNumerico.tsx:126`).
- K2, `frontend/src/components/CampoFormulario.tsx:21-22`: atributos enlazados correctamente, pero párrafo sin rol. El componente extendido de K1 añade `alerta` de forma optativa en `frontend/src/components/CampoFormulario.tsx:15-29`.
- K2, `frontend/src/domains/produccion/pages/Produccion.branch.test.tsx:263-270`: la aserción original del rol se sustituyó por texto visible y único; `:308-315` comprueba foco/estado, no el anuncio. El cambio se reconoce en `docs/archive/audits/2026-10-15/frontend-c07-13/K2-entrega.md:20,37`.

**Reproducción real:** con `ux-produccion@example.invalid`, abrir `/produccion/registrar`, elegir un producto, vaciar Cantidad y pulsar Enter manteniendo ese input enfocado. En 412×915, 768×1024, 1024×1366 y 1280×800 aparece «La cantidad debe ser un número entero mayor que cero.»; `aria-invalid="true"`, descripción existente y un único mensaje. Antes y después del envío el foco permanece en Cantidad. El párrafo tiene `role=null` y `aria-live=null`.

**Consecuencia:** se pierde una señal que existía para el error de envío, justo en una ruta donde `focus()` no cambia el contexto. Se confirma la regresión de marcado/contrato; no se afirma haber medido el habla de un lector de pantalla ni que todos los errores sin alert infrinjan WCAG. Cuando el foco sí se mueve a otro control inválido, su descripción es un mecanismo válido de descubrimiento. La distinción de mensajes sin cambio de contexto está explicada por [W3C, SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Corrección propuesta:** integrar primero `ac666f0` y usar `alerta` en los errores de envío. En las cantidades, hacer que **sólo CampoFormulario sea dueño del error**, con `error={errorEnvases ?? errores['produccion-cantidad']}` o `error={errorStockMerma ?? errores['merma-cantidad']}` y `alerta={!!errores[clave]}`; InputNumerico recibe atributos/valor/handlers, sin otro `error`. Para merma, pasar la ayuda como `descripcionId={productoMermaId ? 'disponible-merma' : undefined}` al campo y retirar el override directo de `aria-describedby` del input. Al retirar `error` de InputNumerico, combinar `atributos.className` con `ctrlExtra` en vez de sobrescribirlo con `ctrlCls`, para mantener el borde inválido que entrega CampoFormulario. Así se conserva un párrafo, el borde inválido y ayuda + error, y no se añaden anuncios a cada pulsación de validación en vivo que antes no los tenía.

**Validación propuesta:** restaurar las expectativas de `role="alert"` para los errores enviados de producto, cantidad, descripción y motivo; añadir el envío por Enter con foco ya en la cantidad y comprobar el rol del único mensaje descrito. Conservar los siete casos nuevos de K2 de label/ARIA/unicidad y la prueba de ayuda Disponible. Añadir `alerta` sólo al CampoFormulario exterior de Cantidad, sin trasladar allí el error, **no** corrige el caso: ese componente no renderiza el mensaje que actualmente pertenece a InputNumerico.

## V2-02 · P3 · K3 no prueba la identidad ausente ni al llamador inactivo

**Evidencia:** `docs/archive/audits/2026-10-15/frontend-c07-13/R1-14-propuesta.md:83-121` incluye 16 aserciones: contrato de columnas, definer/search_path, grants, bodega A, administración A/global, vendedor, producción, anon y allow-list. Los vendedores de fixture en `:73-78` son **destinatarios inactivos**, no llamadores inactivos. Ningún caso desactiva el perfil Bodega/Administrador que llama a la RPC ni elimina/omite su identidad/perfil.

**Consecuencia:** la suite propuesta no detectaría una futura retirada accidental de las condiciones de identidad/actividad de esta función. No se ha identificado un bypass en el SQL: `:53-55` llama a los helpers correctos, y `private.es_rol` ya exige `activo` (`supabase/migrations/20261013181647_harden_database_security.sql:5-8`). Es una brecha de cobertura de seguridad, no un fallo de autorización demostrado.

**Corrección propuesta:** añadir casos con rol SQL `authenticated` y: JWT sin `sub`, UUID sin perfil, perfil Bodega inactivo y administrador global inactivo; todos deben obtener cero filas para cualquier sucursal. Mantener anon como `42501`, distinto de la denegación de negocio por conjunto vacío. Aislar cada identidad de prueba y restaurar el fixture al terminar. Añadir también un rechazo de inserción de despacho a un vendedor inactivo para fijar el contrato complementario de la RPC original y `despachos_insert_b6`, que la nueva lectura no debe relajar.

**Validación propuesta:** ejecutar el archivo nuevo y la suite SQL completa con el runner que interpreta TAP, sólo en un entorno aislado autorizado. El `throws_ok(..., '42501', null, ...)` propuesto en `:117` tiene la firma correcta: el null omite la comparación del mensaje localizado, según [documentación de pgTAP](https://pgtap.org/documentation.html#throws_ok). Los 16 PASS impresos en el documento son evidencia reportada por K3, no una ejecución SQL de V2.

## V2-03 · P3 · K3 debe concretar la reversión y el orden con el frontend

**Evidencia:** `docs/archive/audits/2026-10-15/frontend-c07-13/R1-14-propuesta.md:167-171` remite correctamente a reconciliación/verificación, pero resume la reversión como `drop function ...;` y revertir frontend. No precisa si ese DDL irá en una **migración nueva**, el orden con los clientes publicados ni la comprobación posterior de ledger/grants/RPC. `supabase/reconciliation.md:358-374` exige backup/restauración, estado fresco, ensayo, autorización, dry-run, ledger y revisión de fallos; prohíbe tratar una reparación de metadata como reversión de SQL ejecutado.

**Consecuencia:** el resumen puede interpretarse como un DROP ad hoc fuera del historial de migraciones. La propuesta no modifica datos y su fallback de activos reduce el riesgo del cliente (`:160`), pero eso no sustituye el control de la API ni del ledger. No se aplicó la reversión ni se afirma que ya se haya divergido el esquema.

**Corrección propuesta:** indicar que retirar el endpoint se hace mediante una nueva migración revisada, sin editar ni marcar revertida la migración ya aplicada. Publicar/verificar primero el frontend que deja de consumirla o confirma el fallback; después retirar la función. Registrar el diff esperado y verificar ledger, revocación de EXECUTE, RPC original, lectura del historial y ausencia de cambios en perfiles/despachos/saldos. Explicitar la transacción conjunta de CREATE/COMMENT/REVOKE/GRANT y la inspección del owner en el despliegue; la recomendación de evitar ventanas entre creación y ACL consta en [PostgreSQL, SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

**Validación propuesta:** ensayo de aplicar/retirar en un proyecto aislado con la misma cadena, pruebas TAP de permisos/rol/sucursal y evidencia del ledger antes/después; aplicación remota sólo con las autorizaciones de operación vigentes. Es una precisión del futuro plan, no autorización de V2 para ejecutarlo.

## Comprobaciones positivas de K2

- `Produccion.tsx:108-111` conserva el cálculo de límite de envases y saldo de merma. En `:114-166` no cambia payload, validadores, invalidación, mensajes de éxito/fallo ni borradores; sólo cambia el selector del foco de merma.
- `:88-98` mantiene el primer error pendiente y usa selectores `data-campo` constantes del código. Las seis claves son de dominio, no valores introducidos por el usuario. El foco al primer campo inválido pasó en Chrome y en la suite.
- `:178-180,193,209-213` tiene un label `htmlFor` estable por control. En cantidades, CampoFormulario no recibe error y InputNumerico sí: actualmente produce exactamente un párrafo de error. `InputNumerico.tsx:40,82-85,126` añade el ID de ese error y el estado inválido; el override de la ayuda en merma es correcto con la API actual.
- La cantidad de merma describe `disponible-merma` y su único error. En los datos locales leídos, el saldo fue 100 y se mostró «Excede el stock en bodega: disponibles 100.» al ingresar 9.999.999, sin truncar el valor ni enviar una escritura.
- `TabsIncidencias.tsx` no cambia. En teléfono, cambiar Incidencias → Mermas → Incidencias → Mermas conserva la cantidad y los controles montados; en tablet/escritorio están disponibles ambos formularios. Los textos del JSX y los validadores se conservan; el select inválido ahora añade borde rojo.
- No se detectaron cambios de lógica de stock ni nuevos accesos Supabase en presentación. El uso de `aria-invalid="false"` antes de error es una normalización válida frente al atributo ausente previo.

## Integración de K1 y K2/K3

K2 no toca `components/CampoFormulario.tsx`; K1 sí, de modo aditivo y retrocompatible. Se ejecutó sobre K1 `e50c0c8`:

```bash
git -C /home/cristhian/orca/workspaces/ondina/k2-produccion \
  diff --binary --full-index origin/feature/frontend-ux..af13d7e > /tmp/v2-k2k3.patch
git apply --check /tmp/v2-k2k3.patch
```

Resultado: **salida 0, sin conflictos** para el diff completo, incluidos binarios. No se aplicó el parche. Un primer intento sin `--binary --full-index` fue rechazado por el formato de las capturas; no fue un conflicto de código. Las rutas nuevas de documentos/capturas tampoco colisionan con K1.

- `alerta`: debe usarse para resolver V2-01, incluyendo la transferencia de dueño de los errores numéricos descrita arriba.
- `descripcionId`: conviene usarlo al transferir la cantidad de merma al CampoFormulario, para combinar la ayuda y el error sin override que descarte IDs.
- `id`: opcional. `data-campo` funciona y los IDs de `useId` se mantienen en un mismo montaje; no es obligatorio restaurar `campo-*`. Puede utilizarse si se quiere mantener referencias externas estables, conservando los selectores del script visual de K2.

La compatibilidad por props y la aplicación limpia están comprobadas estáticamente. No se cherry-pickeó ni se ejecutó una suite combinada K1+K2: los tests de rama K2 y los gates de rama K1 se informan por separado.

## Comprobaciones positivas de K3

La función propuesta en `R1-14-propuesta.md:49-62` es SQL STABLE, definer y read-only; usa `public.perfiles` y helpers `private.*` con `search_path=''`. La búsqueda cualificada y los privilegios acotados siguen las recomendaciones de [PostgreSQL sobre funciones definer](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

La compuerta de `:53-55` coincide con `supabase/migrations/20261013200000_b6_revision_fixes.sql:274-276`: rol Bodega/Administrador, perfil activo y sucursal propia salvo administrador global. Los helpers de `supabase/migrations/20261013181647_harden_database_security.sql:5-29` derivan identidad de `auth.uid()` y rol/sucursal de perfiles activos; no confían en metadata editable ni en el rol SQL del definer. Identidad ausente, perfil ausente o inactivo no pasan esas condiciones. El parámetro de sucursal filtra datos incluso para el administrador global; null no significa listar todas.

El cambio de datos es deliberado: se elimina el filtro de vendedor activo, manteniendo rol vendedor y sucursal; añade sólo `activo` a `id/nombres/apellidos`. No expone RUT, teléfono ni correo ni concede SELECT adicional sobre perfiles. La FK de `supabase/migrations/20261013000000_remote_baseline.sql:1758` respalda la pertenencia de los despachos a la sucursal del perfil. La RPC original conserva el filtro activo para nuevos despachos.

`REVOKE ... FROM public, anon` y `GRANT ... TO authenticated, service_role` coinciden con la RPC original (`B6:280-281`). Un grant de service_role no sustituye la compuerta de JWT: sin identidad, la función no obtiene un roster automáticamente. No se observa SQL dinámico ni interpolación de nombres/argumentos.

La prueba propuesta usa transacción/rollback, fixtures sintéticos, metadatos de contrato, comparación de sucursales y roles y extiende la allow-list vigente de `supabase/tests/002_security.test.sql:75-77`. Su forma es coherente; los riesgos de cobertura se delimitan en V2-02. El plan respeta aplicar backend antes de publicar el consumidor y mantener separados el roster histórico y el selector activo.

## Verificación ejecutada y límites

Las pruebas unitarias, los cuatro gates y el servidor Vite de K2 usaron Node **22.23.3**. No se instalaron dependencias; K2 ya tenía `node_modules`.

| Comprobación | Rama/entorno | Resultado fresco |
| --- | --- | --- |
| `npx vitest run src/domains/produccion` | K2 `af13d7e` | **199/199, 17 archivos**, salida 0 |
| Chrome real, `/usr/bin/google-chrome`, cuenta Producción | K2 servido en 127.0.0.1:5190 | **28 escenarios de campos, 4 viewports**, salida 0 |
| `npm run lint` | K1 `e50c0c8`, código sin cambios | PASS |
| `npm run build` | K1 `e50c0c8` | PASS |
| `npm run size` | K1 `e50c0c8` | PASS, CSS 8.405 B / límite 9.246 B |
| `npm run test` | K1 `e50c0c8` | **810/810, 70 archivos**, salida 0 |
| `npx vitest run` sin `.env.local` | K1 `e50c0c8` | **810/810, 70 archivos**, salida 0; env restaurado |
| `git apply --check` | K2/K3 sobre K1 | PASS, sin aplicar |
| SQL propuesto / pgTAP | Ninguna BD | **No ejecutados en V2**; 16 PASS son evidencia documental de K3 |

| Viewport | scrollWidth registrar / incidencias | Controles visibles <44 px | Enter conserva foco en cantidad inválida sin rol vivo |
| --- | --- | --- | --- |
| 412×915 | 412 / 412 | 0 | Reproducido |
| 768×1024 | 768 / 768 | 0 | Reproducido |
| 1024×1366 | 1024 / 1024 | 0 | Reproducido |
| 1280×800 | 1280 / 1280 | 0 | Reproducido |

En cada viewport se comprobaron producto de producción, envío de cantidad por Enter, límite de envases en vivo, descripción de incidencia, producto de merma, límite de stock/ayuda y motivo. No hubo errores JavaScript ni peticiones REST de escritura de dominio. La autenticación fue local; no se registraron producciones, incidencias ni mermas. No se guardaron nuevas capturas para V2: la evidencia es DOM/mediciones y los artefactos existentes de K2, sin modificar estos últimos.

No se ejecutó `test:integration`, no hubo migraciones, psql, resets ni consultas SQL directas a la BD. No se modificó código en ninguno de los worktrees ni se aplicó el parche de integración. El único archivo versionado nuevo de V2 es este informe; su commit es `docs(audit): revisión V2 de K2 y K3`.
