// C3 — matriz ruta × rol × viewport. Uso: node c3-matriz.mjs  → ../capturas/C3/matriz.json
import { writeFileSync } from 'node:fs'
import { abrir, VIEWPORTS, esperar } from './c3-lib.mjs'
const R = { v: 'ux-vendedor@example.invalid', b: 'ux-bodega@example.invalid', p: 'ux-produccion@example.invalid', a: 'ux-admin@example.invalid', g: 'ux-admin-global@example.invalid' }
const ventas = ['/ventas', '/ventas/registrar', '/clientes', '/carga', '/gastos', '/ranking-vendedores']
const bodega = ['/despachos', '/devoluciones', '/stock']
const prod = ['/produccion/registrar', '/produccion/envases', '/produccion/historial', '/produccion/indicadores', '/produccion/incidencias']
const admin = ['/reportes', '/ubicaciones', '/administracion', '/auditoria']
const rutas = {
  v: ['/', ...ventas, '/mi-comision'], b: ['/', ...bodega], p: ['/', ...prod],
  a: ['/', ...ventas, ...bodega, ...prod, ...admin], g: ['/', ...ventas, ...bodega, ...prod, ...admin],
}
const c = await abrir()
const filas = []
for (const rol of Object.keys(R)) {
  await c.sesion(R[rol])
  for (const ruta of rutas[rol]) for (const [w, h] of VIEWPORTS) {
    await c.viewport(w, h); c.consola.length = 0
    await c.ir(ruta, 1000); await esperar(500)
    const m = await c.medir()
    const f = { rol, ruta, w, h, final: m.ruta, h1: m.h1, sw: m.sw, iw: m.iw, desborde: m.sw > m.iw, alto: m.alto, chicos: m.chicos, consola: [...c.consola] }
    filas.push(f)
    if (f.desborde || f.chicos.length || f.consola.length || m.ruta !== ruta) console.log(rol, ruta, `${w}x${h}`, f.desborde ? `DESBORDE ${m.sw}>${m.iw}` : '', `chicos=${f.chicos.length}`, `consola=${f.consola.length}`, m.ruta !== ruta ? 'REDIR ' + m.ruta : '')
  }
}
writeFileSync(new URL('../capturas/C3/matriz.json', import.meta.url), JSON.stringify(filas))
console.log('filas', filas.length)
c.cerrar()
