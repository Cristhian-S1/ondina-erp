// C3 — estados que importan (modales, errores, paginación) a 5 viewports. Uso: node c3-estados.mjs <salida> [filtro]
import { writeFileSync, mkdirSync } from 'node:fs'
import { abrir, VIEWPORTS, esperar } from './c3-lib.mjs'
const [salida, filtro] = process.argv.slice(2)
mkdirSync(salida, { recursive: true })
const V = 'ux-vendedor@example.invalid', B = 'ux-bodega@example.invalid', P = 'ux-produccion@example.invalid'
const H = (cuerpo) => `(async () => { const h = window.__h; ${cuerpo} })()`

const NUEVO_DESPACHO = H(`
  h.boton('Nuevo despacho').click()
  const d = await h.hasta(() => document.querySelector('dialog[open]'))
  const vend = await h.hasta(() => d.querySelector('select'))
  await h.hasta(() => vend.options.length > 1)
  h.poner(vend, vend.options[1].value); await h.sleep(200)
  for (let i = 1; i < 3; i++) { h.boton('+ Agregar producto', d).click(); await h.sleep(150) }
  const sel = () => [...d.querySelectorAll('select')].filter((s) => /^despacho-producto-/.test(s.id))
  await h.hasta(() => sel().length === 3)
  sel().forEach((s) => { const o = [...s.options].find((x) => x.value && !x.disabled); h.poner(s, o.value) })
  await h.sleep(200)
  const c = [...d.querySelectorAll('input')].filter((x) => /^despacho-cantidad-/.test(x.id))
  h.poner(c[0], '4'); h.poner(c[1], '999999'); h.poner(c[2], '12'); await h.sleep(300)
  h.boton('Registrar despacho', d)?.click(); await h.sleep(500)`)

const DEVOLUCION = H(`
  await h.hasta(() => document.querySelector('aside ul li button'))
  const bs = [...document.querySelectorAll('aside ul li button')]
  bs[0].click(); await h.sleep(900)
  // fuerza advertencia de envases: cantidades altas en los inputs de envases buenos
  const ins = [...document.querySelectorAll('input')].filter((i) => /envase|bueno/i.test(i.id + i.getAttribute('aria-label') + (i.closest('label')?.textContent ?? '')))
  ins.slice(0, 2).forEach((i) => h.poner(i, '1500')); await h.sleep(400)`)

const VENTA = H(`
  const cu = () => [...document.querySelectorAll('[data-testid=linea-producto-venta]')]
  await h.hasta(() => cu().length >= 2)
  const filas = cu()
  filas.forEach((f) => { const s = f.querySelector('select'); const o = [...s.options].find((x) => x.value && !x.disabled && ![...document.querySelectorAll('[data-testid=linea-producto-venta] select')].some((y) => y !== s && y.value === x.value)); if (o) h.poner(s, o.value) })
  await h.sleep(300)
  const nums = filas.map((f) => f.querySelectorAll('input[inputmode=numeric]')[0])
  h.poner(nums[0], '2'); h.poner(nums[1], '999999'); await h.sleep(400)`)

const PAGINA2 = (n) => H(`
  const b = [...document.querySelectorAll('nav[aria-label*="aginaci"] button, [aria-label*="aginaci"] button')].find((x) => /Siguiente/.test(x.textContent))
  if (b) { b.click(); await h.sleep(900) }`)

const ESC = [
  ['login', null, '/login', null],
  ['menu-movil', V, '/', H(`const b = document.querySelector('button[aria-label*="enú"],button[aria-label*="enu"],button[aria-controls]'); b?.click(); await h.sleep(500)`)],
  ['despacho-modal-error', B, '/despachos', NUEVO_DESPACHO, true],
  ['despachos-lista', B, '/despachos', H(`await h.sleep(800)`)],
  ['devolucion-detalle', B, '/devoluciones', DEVOLUCION],
  ['venta-2-lineas-error', V, '/ventas/registrar', VENTA],
  ['produccion-registrar', P, '/produccion/registrar', H(`await h.sleep(900)`)],
  ['produccion-registrar-p2', P, '/produccion/registrar', PAGINA2()],
  ['produccion-historial', P, '/produccion/historial', H(`await h.sleep(900)`)],
  ['produccion-indicadores', P, '/produccion/indicadores', H(`await h.sleep(900)`)],
  ['produccion-incidencias', P, '/produccion/incidencias', H(`await h.sleep(900)`)],
  ['clientes', V, '/clientes', H(`await h.sleep(900)`)],
  ['gastos', V, '/gastos', H(`await h.sleep(900)`)],
  ['stock', B, '/stock', H(`await h.sleep(900)`)],
  ['ranking', V, '/ranking-vendedores', H(`await h.sleep(900)`)],
  ['mi-comision', V, '/mi-comision', H(`await h.sleep(900)`)],
]
const c = await abrir(9466)
const med = []
let actual = 'x'
for (const [nombre, correo, ruta, prep, modal] of ESC) {
  if (filtro && !nombre.includes(filtro)) continue
  if (correo && correo !== actual) { await c.sesion(correo); actual = correo }
  if (!correo && actual !== null) { await c.ir('/login', 300); await c.evaluar('localStorage.clear()'); actual = null }
  for (const [w, h] of VIEWPORTS) {
    await c.viewport(w, h); c.consola.length = 0
    await c.ir(ruta, 1100)
    let err = null
    if (prep) try { await c.evaluar(prep) } catch (e) { err = String(e.message).slice(0, 200) }
    await esperar(300)
    const m = await c.medir()
    med.push({ estado: nombre, w, h, sw: m.sw, iw: m.iw, desborde: m.sw > m.iw, alto: m.alto, chicos: m.chicos, consola: [...c.consola], err })
    console.log(nombre.padEnd(26), `${w}x${h}`.padEnd(10), m.sw > m.iw ? `DESBORDE ${m.sw}>${m.iw}` : 'ok', `alto=${m.alto}`, `<44=${m.chicos.length}`, `cons=${c.consola.length}`, err ? 'PREP: ' + err : '')
    await c.captura(`${salida}/${nombre}-${w}x${h}.png`, { modal: !!modal })
  }
}
writeFileSync(`${salida}/estados.json`, JSON.stringify(med, null, 1))
c.cerrar()
