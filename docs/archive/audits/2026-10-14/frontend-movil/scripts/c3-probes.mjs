// C3 — sondas puntuales (validaciones del feedback). Uso: node c3-probes.mjs <salida>
import { writeFileSync, mkdirSync } from 'node:fs'
import { abrir, esperar } from './c3-lib.mjs'
const salida = process.argv[2]; mkdirSync(salida, { recursive: true })
const c = await abrir(9477)
const out = {}
const H = (b) => `(async () => { const h = window.__h; ${b} })()`
// 1) Letras y pegado en InputNumerico (Registrar venta, vendedor, 412)
await c.sesion('ux-vendedor@example.invalid'); await c.viewport(412, 915); await c.ir('/ventas/registrar', 1500)
await c.evaluar(`document.querySelector('[data-testid=linea-producto-venta] input[inputmode=numeric]').focus()`)
await c.cdp('Input.insertText', { text: 'abc12x' })
out.letras_en_cantidad = await c.evaluar(`document.querySelector('[data-testid=linea-producto-venta] input[inputmode=numeric]').value`)
for (const ch of '1234567') await c.cdp('Input.dispatchKeyEvent', { type: 'char', text: ch })
out.miles_en_cantidad = await c.evaluar(`document.querySelector('[data-testid=linea-producto-venta] input[inputmode=numeric]').value`)
// 2) Confirmar sin cliente ni producto → errores
await c.ir('/ventas/registrar', 1500)
await c.evaluar(H(`const b=h.boton('Confirmar venta'); b?.click(); await h.sleep(600)`))
out.confirmar_vacio = await c.evaluar(`[...document.querySelectorAll('[role=alert],.text-red-700')].map(e=>e.textContent.trim().slice(0,120)).slice(0,6)`)
await c.captura(`${salida}/venta-confirmar-vacio-412.png`)
// 3) Máximo de líneas en Nuevo despacho
await c.sesion('ux-bodega@example.invalid'); await c.ir('/despachos', 1500)
await c.evaluar(H(`h.boton('Nuevo despacho').click(); const d = await h.hasta(()=>document.querySelector('dialog[open]'));
  for (let i=0;i<10;i++){ const b=h.boton('+ Agregar producto', d); if(!b||b.disabled) break; b.click(); await h.sleep(120) } await h.sleep(300)`))
out.despacho_lineas_max = await c.evaluar(`(()=>{const d=document.querySelector('dialog[open]'); const b=[...d.querySelectorAll('button')].find(x=>/Agregar producto/.test(x.textContent)); return {lineas:d.querySelectorAll('[data-testid=linea-despacho]').length, agregarDeshabilitado: !!b?.disabled, aviso: [...d.querySelectorAll('p,span')].map(e=>e.textContent.trim()).find(t=>/Máximo/.test(t)) ?? null}})()`)
await c.captura(`${salida}/despacho-max-lineas-412.png`, { modal: true, max: 4500 })
// 4) Paginación 2 de Producción reciente
await c.sesion('ux-produccion@example.invalid'); await c.ir('/produccion/registrar', 1500)
await c.evaluar(H(`[...document.querySelectorAll('button')].find(b=>/Siguiente/.test(b.textContent)).click(); await h.sleep(1000)`))
out.prod_pagina2 = await c.evaluar(`(document.body.innerText.match(/Página \\d+ de \\d+ · [\\d.]+ registros/)||[])[0]`)
await c.captura(`${salida}/produccion-pagina2-412.png`)
// 5) Filtro de producción reciente: aplica fecha futura → vacío
out.consola = [...c.consola]
writeFileSync(`${salida}/sondas.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1))
c.cerrar()
