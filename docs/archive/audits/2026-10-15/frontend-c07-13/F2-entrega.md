# F2 · Correcciones de V2 en Producción y K3 (2026-10-15)

Base: `integ/c07-13` (0ea1638), rama `Cristhian-S1/f2-produccion`. Sin push ni merge.

## Qué cambió
- **V2-01 (P2).** `pages/Produccion.tsx`: los tres formularios pasan `error` + `alerta={!!errores[campo]}` a `CampoFormulario`, así los errores de envío se anuncian con `role="alert"` bajo el campo. En cantidades, `CampoFormulario` es el único dueño del mensaje (`InputNumerico` ya no recibe `error`; sólo atributos), con borde inválido combinado y `descripcionId="disponible-merma"` para la merma. Los errores en vivo (envases/stock) no llevan `alert`; al enviar con exceso de stock ahora se registra el error de envío (`invalidar`) y se anuncia, en lugar de sólo mover el foco.
- **V2-02/V2-03 (P3).** `R1-14-propuesta.md`: cinco casos pgTAP nuevos (sin `sub`, identidad sin perfil, bodega inactivo, administrador global inactivo, despacho a vendedor inactivo denegado), salida re-ejecutada y reversión/orden backend→frontend concretos.

## Archivos
`frontend/src/domains/produccion/pages/Produccion.tsx`, `…/Produccion.branch.test.tsx`, `R1-14-propuesta.md`, esta entrega y `capturas/F2/`. `CampoFormulario.tsx` no se tocó.

## Pruebas
- Regresión Enter con el foco ya en Cantidad (`role="alert"`, un solo mensaje, foco conservado) y error en vivo sin alert / con alert al enviar. Las pruebas comprueban que `aria-describedby` contenga los ids, sin depender del orden.
- `npm run lint`, `build`, `size` (CSS 8.405 B), `test` (70 archivos / 819) y suite sin `.env.local` (819): verde.
- SQL (`begin; … rollback;` en Supabase local): 21 aserciones OK; la función no persiste.

## Evidencia visual (Chrome, `ux-produccion@example.invalid`)
`capturas/F2/`: registrar 412×915, merma 412×915, incidencia 1024×1366, merma 1024×1366 (errores visibles). `scrollWidth` = 412 / 1024 (sin desborde); en merma el error es `role=alert`, el campo conserva el foco y `aria-describedby` incluye `disponible-merma` y el error. Sin escrituras (peticiones no-GET abortadas).

## Límites
Sólo se capturaron 412 y 1024; no se midió habla de lector de pantalla.
