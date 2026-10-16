// Genera D1-propuesta-colores.html y D1-contrastes.json con contrastes WCAG calculados.
// Uso (desde la raíz del repo): node docs/archive/audits/2026-10-14/frontend-movil/D1-generar.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { hex, contraste, fmt, hexAOklch, oklchAHex } from './D1-colores-lib.mjs'

const aqui = dirname(fileURLToPath(import.meta.url))

// ---- Escala brand ----
const ACTUAL = {}
for (const k of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) ACTUAL[k] = hex(`brand-${k}`)
const H = 243 // tono de marca: brand-500..900 actuales están en 242-244
const LADDER = { 50: [0.975, 0.012], 100: [0.95, 0.026], 200: [0.905, 0.05], 300: [0.84, 0.078], 400: [0.76, 0.1], 500: [0.68, 0.11] }
const PROP_A = { ...ACTUAL } // Opción A: 600-900 intactos, se usa brand-700 como primario
const PROP_B = { ...ACTUAL }
for (const [k, [L, C]] of Object.entries(LADDER)) { PROP_A[k] = PROP_B[k] = oklchAHex(L, C, H) }
PROP_B[600] = oklchAHex(0.56, 0.113, H) // Opción B: 600 oscurecido para pasar AA con texto blanco
const L = (h) => hexAOklch(h).L
const monotona = (esc) => [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].every((k, i, a) => i === 0 || L(esc[k]) < L(esc[a[i - 1]]))

// ---- Medición ----
const filas = []
const medir = (id, descripcion, fgA, bgA, fgD, bgD, donde, nota = '') => {
  const a = contraste(fgA, bgA), d = contraste(fgD, bgD)
  filas.push({ id, descripcion, antes: { fg: hex(fgA), bg: hex(bgA), ratio: +a.toFixed(2) }, despues: { fg: hex(fgD), bg: hex(bgD), ratio: +d.toFixed(2) }, donde, nota })
  return { a, d }
}
// Colores propuestos que no son tokens existentes se pasan como hex literal.
const P600 = PROP_B[600]
medir('btn-primario-A', 'Botón primario: blanco sobre fondo (Opción A: brand-700)', 'white', 'brand-600', 'white', 'brand-700', 'lib/ui.ts btnPrimary')
medir('btn-primario-B', 'Botón primario: blanco sobre fondo (Opción B: brand-600 oscurecido)', 'white', 'brand-600', 'white', P600, 'lib/ui.ts btnPrimary')
medir('nav-activa-N1', 'Navegación activa: texto blanco (N1: brand-700 + barra)', 'white', 'brand-600', 'white', 'brand-700', 'DashboardLayout.tsx:190')
medir('nav-activa-barra', 'Navegación activa: barra blanca sobre sidebar brand-900 (no texto, mín. 3:1)', 'brand-600', 'brand-900', 'white', 'brand-900', 'DashboardLayout.tsx:190', 'Antes: el propio relleno brand-600 vs sidebar')
medir('nav-activa-N2', 'Navegación activa: N2 relleno blanco, texto brand-900', 'white', 'brand-600', 'brand-900', 'white', 'DashboardLayout.tsx:190')
medir('btn-secundario', 'Botón secundario: texto brand-800 sobre blanco', 'brand-800', 'white', 'brand-800', 'white', 'lib/ui.ts btnSecondary (14 archivos)', 'Sin cambio de texto; sólo mejora el hover (brand-50)')
medir('btn-secundario-hover', 'Botón secundario hover: brand-800 sobre brand-50', 'brand-800', 'brand-50', 'brand-800', PROP_A[50], 'lib/ui.ts btnSecondary')
medir('btn-secundario-borde', 'Botón secundario: borde brand-200 sobre blanco (no texto)', 'brand-200', 'white', PROP_A[200], 'white', 'lib/ui.ts btnSecondary', 'Decorativo: el texto y el área ya identifican el control; se mantiene la clase border-brand-200')
medir('sec-fondo-pagina', 'Texto secundario sobre fondo de página (slate-100)', 'slate-500', 'slate-100', 'slate-600', 'slate-100', '23 archivos / 76 líneas con text-slate-500')
medir('sec-blanco-400', 'Texto secundario sobre blanco con slate-400 (Dashboard dt)', 'slate-400', 'white', 'slate-600', 'white', 'pages/Dashboard.tsx:53,59,67,75')
medir('sec-blanco-500', 'Texto secundario sobre blanco con slate-500', 'slate-500', 'white', 'slate-600', 'white', 'tarjetas/formularios', 'Hoy pasa (4,76); se unifica en slate-600')
medir('error-bloque', 'Error en línea (errorBlockCls): rojo sobre red-50', 'red-600', 'red-50', 'red-700', 'red-50', 'lib/ui.ts errorBlockCls (3) y bg-red-50 text-red-600 sueltos')
medir('error-campo-blanco', 'Error de campo (errorTextCls) sobre blanco', 'red-600', 'white', 'red-700', 'white', 'lib/ui.ts errorTextCls (10)')
medir('error-campo-pagina', 'Error de campo (errorTextCls) sobre fondo de página', 'red-600', 'slate-100', 'red-700', 'slate-100', 'lib/ui.ts errorTextCls', 'Falla hoy si el campo vive fuera de una tarjeta blanca')
medir('badge-amber', 'Badge devoluciones producto: amber-700 sobre amber-100', 'amber-700', 'amber-100', 'amber-800', 'amber-100', 'Devoluciones.tsx:25, Dashboard.tsx:8 (bodega)', 'Hoy pasa al límite (4,52)')
medir('badge-emerald', 'Badge devoluciones envase: emerald-700 sobre emerald-100', 'emerald-700', 'emerald-100', 'emerald-700', 'emerald-100', 'Devoluciones.tsx:26, Dashboard.tsx:10', 'Sin cambio')
medir('badge-sky', 'Badge completo/vendedor: sky-700 sobre sky-100', 'sky-700', 'sky-100', 'sky-700', 'sky-100', 'Devoluciones.tsx:27, Clientes.tsx:19, Dashboard.tsx:7', 'Sin cambio')
medir('badge-brand', 'Badge stock/producción (minorista, ModulePage): brand-800 sobre brand-50', 'brand-800', 'brand-50', 'brand-800', PROP_A[50], 'Clientes.tsx:20, Carga.tsx:64, ModulePage.tsx:13')
medir('punto-amber', 'Punto de estado producto (no texto, mín. 3:1): amber-500 sobre blanco', 'amber-500', 'white', 'amber-600', 'white', 'Despachos.tsx:625')
medir('punto-emerald', 'Punto de estado envase (no texto, mín. 3:1): emerald-500 sobre blanco', 'emerald-500', 'white', 'emerald-600', 'white', 'Despachos.tsx:625')
medir('foco-borde', 'Foco: borde brand-600 del input sobre blanco (no texto, mín. 3:1)', 'brand-600', 'white', P600, 'white', 'lib/ui.ts inputCls')
medir('foco-outline', 'Foco: anillo sólido brand-700 2 px sobre blanco', 'brand-600', 'white', 'brand-700', 'white', 'lib/ui.ts (propuesta :focus-visible)')
medir('enlace-blanco', 'Enlace text-brand-700 sobre blanco', 'brand-700', 'white', 'brand-700', 'white', 'Ventas.tsx:99, Stock.tsx:29', 'Sin cambio')
medir('enlace-pagina', 'Enlace text-brand-700 sobre fondo de página', 'brand-700', 'slate-100', 'brand-700', 'slate-100', 'Ventas.tsx:99', 'Sin cambio (4,75)')
medir('proximamente', 'Pastilla “Próximamente”: slate-200 sobre brand-800', 'slate-200', 'brand-800', 'slate-200', 'brand-800', 'DashboardLayout.tsx:~200')
medir('quitar-actual', 'Quitar hoy (btnDanger): blanco sobre red-600', 'white', 'red-600', 'red-700', 'white', 'FilaProductoVenta.tsx:52', 'Después: variante outline red-700 sobre blanco')
medir('quitar-tonal', 'Quitar tonal: red-700 sobre red-50', 'white', 'red-600', 'red-700', 'red-50', 'FilaProductoVenta.tsx:52')

const R = Object.fromEntries(filas.map((f) => [f.id, f]))
const ok = (r, min = 4.5) => r >= min
const chip = (r, min = 4.5) => `<span class="chip ${ok(r, min) ? 'ok' : 'no'}">${fmt(r)}:1 ${ok(r, min) ? 'AA ✓' : 'falla ✗'}</span>`
const c = (id, lado, min) => chip(R[id][lado].ratio, min)

const sw = (h, texto = '') => `<span class="sw" style="background:${h}"></span>`
const escalaFila = (nombre, esc, nota) => `
<div class="escala"><h3>${nombre}</h3><p class="n">${nota} · Monótona: <b>${monotona(esc) ? 'sí ✓' : 'no ✗'}</b></p>
<div class="ramp">${[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => `<div class="step" style="background:${esc[k]};color:${contraste('white', esc[k]) >= 4.5 ? '#fff' : '#0f172a'}"><b>${k}</b><span>${esc[k]}</span><span>L ${L(esc[k]).toFixed(2)}</span></div>`).join('')}</div></div>`

const B = PROP_B, A = PROP_A
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>D1 · Propuesta de contraste y escala de color — Ondina</title>
<style>
:root{--ink:#0f172a;--mut:#475569;--bg:#f1f5f9;--card:#fff;--line:#e2e8f0;--ok:#047857;--okbg:#d1fae5;--no:#b91c1c;--nobg:#fee2e2;--b700:#2b72a3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;margin:.2em 0}h2{font-size:1.2rem;margin:1.8em 0 .4em;border-bottom:2px solid var(--line);padding-bottom:.3em}h3{font-size:1rem;margin:.2em 0}
p{margin:.4em 0}.n{color:var(--mut);font-size:.85rem}code{background:#e2e8f0;padding:0 .3em;border-radius:4px;font-size:.85em}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
.ramp{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}@media(min-width:760px){.ramp{grid-template-columns:repeat(10,1fr)}}
.step{border-radius:8px;padding:8px 6px;font-size:.72rem;display:flex;flex-direction:column;gap:2px;min-height:64px;border:1px solid rgba(0,0,0,.08)}
.escala{margin:14px 0}
.chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.75rem;font-weight:600;white-space:nowrap}.chip.ok{background:var(--okbg);color:var(--ok)}.chip.no{background:var(--nobg);color:var(--no)}
.cmp{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:760px){.cmp{grid-template-columns:1fr 1fr}}
.lado{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.lado.pag{background:#f1f5f9}.lado h4{margin:0 0 8px;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
.antes h4::before{content:"ANTES · "}.despues h4::before{content:"DESPUÉS · "}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;border-radius:8px;font-weight:600;font-size:.9rem;border:1px solid transparent;font-family:inherit}
.side{background:#1c4e70;border-radius:10px;padding:10px;width:100%;max-width:260px}.side div{padding:10px 14px;border-radius:8px;font-size:.9rem;color:#cad5e2;min-height:44px;display:flex;align-items:center}
table{border-collapse:collapse;width:100%;font-size:.8rem}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:#f8fafc;color:var(--mut)}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.sw{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.15);vertical-align:-2px;margin-right:4px}
.opt{border-left:4px solid #94a3b8;padding-left:10px;margin:8px 0}.rec{border-left-color:#2c7bb1}
.tarjeta{border:1px solid var(--line);border-radius:14px;background:#fff;padding:12px;max-width:380px}
.row{display:flex;gap:8px;align-items:center;justify-content:space-between}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%}
a{color:var(--b700)}
</style></head><body><main>
<h1>D1 · Propuesta de contraste y escala de color</h1>
<p class="n">Ondina ERP · Beads OND-c07.22 · 2026-10-14 · Fase 1: <b>sólo propuesta</b>, no se ha cambiado <code>index.css</code>, <code>lib/ui.ts</code> ni componentes. Los contrastes se calculan con la fórmula WCAG 2.x (luminancia relativa) sobre los valores reales de Tailwind v4 (oklch → sRGB) y <code>frontend/src/index.css</code>; script: <code>D1-generar.mjs</code> y <code>D1-colores-lib.mjs</code>.</p>

<div class="card"><h3>Resumen</h3>
<p>Verificado con la fórmula: el botón primario (blanco sobre <code>brand-600</code>) mide <b>${fmt(R['btn-primario-A'].antes.ratio)}:1</b>, <code>slate-500</code> sobre <code>slate-100</code> <b>${fmt(R['sec-fondo-pagina'].antes.ratio)}:1</b>, <code>red-600</code> sobre <code>red-50</code> <b>${fmt(R['error-bloque'].antes.ratio)}:1</b> y <code>slate-400</code> sobre blanco <b>${fmt(R['sec-blanco-400'].antes.ratio)}:1</b>: todos por debajo de 4,5:1 (AA texto normal).</p>
<p><b>Hallazgo que corrige el brief:</b> los badges de devoluciones no usan texto blanco sobre <code>emerald-500</code>/<code>amber-500</code>; usan <code>*-700</code> sobre <code>*-100</code> (pasan). El blanco sobre 500 sólo aparece como <i>punto de estado</i> de 8 px (<code>Despachos.tsx:625</code>), elemento no textual que exige 3:1 y hoy mide ${fmt(R['punto-emerald'].antes.ratio)}:1 / ${fmt(R['punto-amber'].antes.ratio)}:1 sobre blanco.</p>
<p><span class="chip ok">Recomendación</span> Opción B de primario (oscurecer <code>brand-600</code> a <code>${B[600]}</code>: un único token, 0 clases cambiadas), escala 50–500 monótona, <code>slate-600</code> para texto secundario, <code>red-700</code> en errores, <code>amber-800</code> en badges ámbar, navegación activa N1.</p></div>

<h2>1. Escala <code>brand</code>: actual vs propuesta</h2>
${escalaFila('Actual (index.css)', ACTUAL, 'Rompe la monotonía: 50 y 100 son más oscuros que 200; 500 más apagado que 400; 400 con tono distinto (225°).')}
${escalaFila('Propuesta · Opción A (600–900 intactos)', A, 'Sólo cambian 50–500, con tono 243° (el de 500–900 actuales). El primario pasa a usar <code>brand-700</code> (5,20:1).')}
${escalaFila('Propuesta · Opción B (600 oscurecido)', B, `Igual que A, y <code>brand-600</code> pasa de ${ACTUAL[600]} a ${B[600]} (${fmt(contraste('white', B[600]))}:1 con blanco). El primario sigue en <code>bg-brand-600</code>; hover <code>brand-700</code>.`)}
<div class="card opt rec"><b>Opciones de primario</b>
<p><b>A</b> — primario = <code>brand-700</code> existente (${fmt(R['btn-primario-A'].despues.ratio)}:1): usa un token ya aprobado y deja <code>brand-600</code> como acento; obliga a editar 9 usos de <code>bg-brand-600</code> y el hover pasa a <code>brand-800</code>.</p>
<p><b>B</b> — <code>brand-600</code> oscurecido a ${B[600]} (${fmt(R['btn-primario-B'].despues.ratio)}:1): un solo cambio en <code>index.css</code>, mantiene hover <code>brand-700</code> (${fmt(contraste('white', 'brand-700'))}:1); la diferencia reposo/hover es sutil (ΔL ${(L(B[600]) - L(ACTUAL[700])).toFixed(2)}). <b>Recomendada</b> por menor riesgo de regresión visual.</p></div>

<h2>2. Muestras antes / después</h2>

<h3>Botón primario</h3>
<div class="cmp">
<div class="lado antes"><h4>brand-600 ${ACTUAL[600]}</h4><button class="btn" style="background:${ACTUAL[600]};color:#fff">Registrar venta</button><p>${c('btn-primario-A', 'antes')}</p></div>
<div class="lado despues"><h4>Opción A · brand-700 ${ACTUAL[700]}</h4><button class="btn" style="background:${ACTUAL[700]};color:#fff">Registrar venta</button><p>${c('btn-primario-A', 'despues')}</p>
<h4 style="margin-top:12px">Opción B · brand-600 ${B[600]}</h4><button class="btn" style="background:${B[600]};color:#fff">Registrar venta</button><p>${c('btn-primario-B', 'despues')}</p></div></div>

<h3>Navegación activa (sidebar brand-900)</h3>
<div class="cmp">
<div class="lado antes"><h4>bg-brand-600 + texto blanco</h4><div class="side"><div style="background:${ACTUAL[600]};color:#fff">Ventas (activa)</div><div>Bodega</div></div><p>Texto ${c('nav-activa-N1', 'antes')} · relleno vs sidebar ${fmt(R['nav-activa-barra'].antes.ratio)}:1</p></div>
<div class="lado despues"><h4>N1 · brand-700 + barra blanca 4 px</h4><div class="side"><div style="background:${ACTUAL[700]};color:#fff;box-shadow:inset 4px 0 0 #fff">Ventas (activa)</div><div>Bodega</div></div><p>Texto ${c('nav-activa-N1', 'despues')} · barra vs sidebar ${chip(R['nav-activa-barra'].despues.ratio, 3).replace('AA ✓', '≥3 ✓')}</p>
<h4 style="margin-top:12px">N2 · relleno blanco, texto brand-900</h4><div class="side"><div style="background:#fff;color:#1c4e70;font-weight:600">Ventas (activa)</div><div>Bodega</div></div><p>Texto ${c('nav-activa-N2', 'despues')}</p></div></div>
<p class="n">Se descarta usar sólo <code>brand-700</code> sobre el sidebar sin indicador: el relleno mide ${fmt(contraste('brand-700', 'brand-900'))}:1 contra <code>brand-900</code> (el estado activo no se distingue sin color de texto).</p>

<h3>Botón secundario</h3>
<div class="cmp">
<div class="lado antes"><h4>borde brand-200 ${ACTUAL[200]} · hover brand-50 ${ACTUAL[50]}</h4><button class="btn" style="background:#fff;color:${ACTUAL[800]};border-color:${ACTUAL[200]}">Cancelar</button> <button class="btn" style="background:${ACTUAL[50]};color:${ACTUAL[800]};border-color:${ACTUAL[200]}">hover</button><p>Texto ${c('btn-secundario', 'antes')} · hover ${c('btn-secundario-hover', 'antes')}</p></div>
<div class="lado despues"><h4>borde ${A[200]} · hover ${A[50]}</h4><button class="btn" style="background:#fff;color:${A[800]};border-color:${A[200]}">Cancelar</button> <button class="btn" style="background:${A[50]};color:${A[800]};border-color:${A[200]}">hover</button><p>Texto ${c('btn-secundario', 'despues')} · hover ${c('btn-secundario-hover', 'despues')}</p><p class="n">El borde (<code>brand-200</code>, ${fmt(contraste(A[200], 'white'))}:1 vs blanco) es decorativo: el texto y el área del botón identifican el control; no se propone cambiar la clase.</p></div></div>

<h3>Texto secundario</h3>
<div class="cmp">
<div class="lado antes pag"><h4>sobre fondo de página (slate-100)</h4><p style="color:${hex('slate-500')}">Registra las unidades producidas y consulta la producción reciente.</p><p>${c('sec-fondo-pagina', 'antes')}</p></div>
<div class="lado despues pag"><h4>slate-600 ${hex('slate-600')}</h4><p style="color:${hex('slate-600')}">Registra las unidades producidas y consulta la producción reciente.</p><p>${c('sec-fondo-pagina', 'despues')}</p></div>
<div class="lado antes"><h4>sobre blanco con slate-400 (Dashboard)</h4><p style="color:${hex('slate-400')};font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">RUT</p><p>${c('sec-blanco-400', 'antes')}</p></div>
<div class="lado despues"><h4>slate-600</h4><p style="color:${hex('slate-600')};font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">RUT</p><p>${c('sec-blanco-400', 'despues')}</p></div></div>
<div class="card opt"><b>Opciones para slate-500:</b> <b>A</b> sustituir clases <code>text-slate-500</code>→<code>text-slate-600</code> (76 líneas, explícito y auditable; recomendada). <b>B</b> redefinir <code>--color-slate-500</code> en <code>@theme</code> a un gris más oscuro (1 línea; cambia el significado de un token de Tailwind y afecta también bordes/fondos que lo usen).</div>

<h3>Error en línea</h3>
<div class="cmp">
<div class="lado antes"><h4>red-600 sobre red-50</h4><p style="background:#${'fef2f2'};color:${hex('red-600')};padding:8px 12px;border-radius:8px">No fue posible guardar la venta. Intenta nuevamente.</p><p>${c('error-bloque', 'antes')}</p></div>
<div class="lado despues"><h4>red-700 sobre red-50</h4><p style="background:${hex('red-50')};color:${hex('red-700')};padding:8px 12px;border-radius:8px">No fue posible guardar la venta. Intenta nuevamente.</p><p>${c('error-bloque', 'despues')}</p></div>
<div class="lado antes pag"><h4>errorTextCls sobre fondo de página</h4><p style="color:${hex('red-600')};font-size:.75rem">La cantidad supera el disponible.</p><p>${c('error-campo-pagina', 'antes')}</p></div>
<div class="lado despues pag"><h4>red-700</h4><p style="color:${hex('red-700')};font-size:.75rem">La cantidad supera el disponible.</p><p>${c('error-campo-pagina', 'despues')}</p></div></div>

<h3>Badges de estado (devoluciones, stock, producción, roles)</h3>
<div class="cmp">
<div class="lado antes"><h4>actual</h4>
<span class="chip" style="background:${hex('amber-100')};color:${hex('amber-700')}">Productos</span> ${c('badge-amber', 'antes')}<br><br>
<span class="chip" style="background:${hex('emerald-100')};color:${hex('emerald-700')}">Envases</span> ${c('badge-emerald', 'antes')}<br><br>
<span class="chip" style="background:${hex('sky-100')};color:${hex('sky-700')}">Completo</span> ${c('badge-sky', 'antes')}<br><br>
<span class="chip" style="background:${ACTUAL[50]};color:${ACTUAL[800]}">Minorista</span> ${c('badge-brand', 'antes')}<br><br>
<span class="dot" style="background:${hex('amber-500')}"></span> producto ${chip(R['punto-amber'].antes.ratio, 3)} · <span class="dot" style="background:${hex('emerald-500')}"></span> envase ${chip(R['punto-emerald'].antes.ratio, 3)}</div>
<div class="lado despues"><h4>propuesta</h4>
<span class="chip" style="background:${hex('amber-100')};color:${hex('amber-800')}">Productos</span> ${c('badge-amber', 'despues')}<br><br>
<span class="chip" style="background:${hex('emerald-100')};color:${hex('emerald-700')}">Envases</span> ${c('badge-emerald', 'despues')}<br><br>
<span class="chip" style="background:${hex('sky-100')};color:${hex('sky-700')}">Completo</span> ${c('badge-sky', 'despues')}<br><br>
<span class="chip" style="background:${A[50]};color:${A[800]}">Minorista</span> ${c('badge-brand', 'despues')}<br><br>
<span class="dot" style="background:${hex('amber-600')}"></span> producto ${chip(R['punto-amber'].despues.ratio, 3)} · <span class="dot" style="background:${hex('emerald-600')}"></span> envase ${chip(R['punto-emerald'].despues.ratio, 3)}</div></div>
<p class="n">Los puntos son no textuales (criterio 1.4.11, 3:1). Además el significado ya está duplicado por el texto de la línea (“Producto/Envase”), por lo que el cambio es de bajo riesgo.</p>

<h3>Foco visible y enlace</h3>
<div class="cmp">
<div class="lado antes"><h4>input: borde brand-600 + anillo 30 %</h4><input readonly value="Cantidad" style="min-height:44px;border:1px solid ${ACTUAL[600]};box-shadow:0 0 0 2px ${ACTUAL[600]}4d;border-radius:8px;padding:0 12px;font:inherit;outline:none;width:100%"><p>Borde ${chip(R['foco-borde'].antes.ratio, 3).replace('AA ✓', '≥3 ✓')}</p>
<p><a href="#" style="color:${ACTUAL[700]}">Ver detalle de la venta</a> ${c('enlace-blanco', 'antes')}</p></div>
<div class="lado despues"><h4>input: borde + anillo sólido brand-700</h4><input readonly value="Cantidad" style="min-height:44px;border:1px solid ${ACTUAL[700]};box-shadow:0 0 0 2px #fff,0 0 0 4px ${ACTUAL[700]};border-radius:8px;padding:0 12px;font:inherit;outline:none;width:100%"><p>Anillo ${chip(R['foco-outline'].despues.ratio, 3).replace('AA ✓', '≥3 ✓')}</p>
<p><a href="#" style="color:${ACTUAL[700]}">Ver detalle de la venta</a> ${c('enlace-blanco', 'despues')} (sin cambio; sobre página ${c('enlace-pagina', 'despues')})</p></div></div>

<h2>3. Tarjetas móviles: “Quitar” y producción compacta</h2>
<div class="cmp">
<div class="lado antes"><h4>Quitar hoy: btnDanger a todo el ancho</h4>
<div class="tarjeta"><div class="row"><b>Hielo en bolsa 2 kg</b><span>12 u.</span></div><p class="n">Disponible 340 · $1.500</p>
<button class="btn" style="width:100%;background:${hex('red-600')};color:#fff;margin-top:6px">Quitar</button></div>
<div class="tarjeta" style="margin-top:8px"><div class="row"><b>Agua 20 L</b><span>4 u.</span></div><button class="btn" style="width:100%;background:${hex('red-600')};color:#fff;margin-top:6px">Quitar</button></div>
<p>${c('quitar-actual', 'antes')} · pesado visualmente al repetirse</p></div>
<div class="lado despues"><h4>Q1 · outline (recomendada)</h4>
<div class="tarjeta"><div class="row"><b>Hielo en bolsa 2 kg</b><span>12 u.</span></div><p class="n">Disponible 340 · $1.500</p>
<button class="btn" style="width:100%;background:#fff;color:${hex('red-700')};border-color:${hex('red-700')};margin-top:6px">Quitar</button></div>
<p>Texto y borde ${c('quitar-actual', 'despues')} sobre blanco</p>
<h4 style="margin-top:12px">Q2 · tonal</h4>
<div class="tarjeta"><div class="row"><b>Agua 20 L</b><span>4 u.</span></div>
<button class="btn" style="width:100%;background:${hex('red-50')};color:${hex('red-700')};border-color:${hex('red-200')};margin-top:6px">Quitar</button></div>
<p>${c('quitar-tonal', 'despues')} · borde red-200 decorativo</p>
<p class="n">Ambas mantienen 44 px de alto y ancho completo en móvil; sólo la rojo sólido se reserva a acciones destructivas irreversibles (p. ej. anular).</p></div></div>
<h3>Tarjeta de producción compacta</h3>
<div class="cmp">
<div class="lado antes"><h4>hoy (TablaProduccionResponsive): una columna por fila</h4>
<div class="tarjeta"><p class="n" style="margin:0">Fecha y hora</p><p style="margin:0 0 8px">14-10-2026 08:42</p><p class="n" style="margin:0">Producto</p><p style="margin:0 0 8px">Hielo en bolsa 2 kg</p><p class="n" style="margin:0">Cantidad</p><p style="margin:0 0 8px"><b>1.250</b></p><p class="n" style="margin:0">Observaciones</p><p style="margin:0">Turno mañana</p></div><p class="n">≈ 8 líneas de texto por registro.</p></div>
<div class="lado despues"><h4>propuesta: producto + cantidad en una fila</h4>
<div class="tarjeta"><div class="row"><b style="min-width:0;overflow-wrap:anywhere">Hielo en bolsa 2 kg</b><b style="font-size:1.1rem;white-space:nowrap">1.250 <span class="n" style="font-weight:400">u.</span></b></div>
<p class="n" style="margin:4px 0 0">14-10-2026 08:42 · Turno mañana</p></div>
<p>Fecha y observaciones como metadatos de segunda línea (<code>text-slate-600</code>, ${c('sec-fondo-pagina', 'despues')}); mantiene la tabla desde 640 px y el único árbol DOM.</p></div></div>

<h2>4. Tabla de cambios</h2>
<div class="card scroll"><table><thead><tr><th>Token / clase</th><th>Actual</th><th>Propuesto</th><th>Antes</th><th>Después</th><th>Dónde se usa</th></tr></thead><tbody>
${[
  ['--color-brand-50', ACTUAL[50], A[50], R['btn-secundario-hover'].antes.ratio, R['btn-secundario-hover'].despues.ratio, 'hover:bg-brand-50 y badges (9 líneas / 9 archivos)'],
  ['--color-brand-100', ACTUAL[100], A[100], null, null, 'avatares, hover Stock (3 líneas / 3 archivos)'],
  ['--color-brand-200', ACTUAL[200], A[200], null, null, 'border-brand-200 (5 líneas / 5 archivos)'],
  ['--color-brand-300', ACTUAL[300], A[300], null, null, 'sin usos directos hoy'],
  ['--color-brand-400', ACTUAL[400], A[400], null, null, 'sin usos hoy'],
  ['--color-brand-500', ACTUAL[500], A[500], null, null, 'sin usos hoy'],
  ['--color-brand-600 (Opción B)', ACTUAL[600], B[600], R['btn-primario-B'].antes.ratio, R['btn-primario-B'].despues.ratio, 'btnPrimary, nav activa, foco, píldoras (9 líneas / 8 archivos)'],
  ['btnPrimary → bg-brand-700 hover:bg-brand-800 (Opción A)', 'bg-brand-600', 'bg-brand-700', R['btn-primario-A'].antes.ratio, R['btn-primario-A'].despues.ratio, 'lib/ui.ts (24 usos en 10 archivos) + 8 usos sueltos'],
  ['Nav activa', 'bg-brand-600', 'bg-brand-700 + barra blanca', R['nav-activa-N1'].antes.ratio, R['nav-activa-N1'].despues.ratio, 'DashboardLayout.tsx:190'],
  ['text-slate-500 (texto secundario)', hex('slate-500'), hex('slate-600'), R['sec-fondo-pagina'].antes.ratio, R['sec-fondo-pagina'].despues.ratio, '76 líneas / 23 archivos'],
  ['text-slate-400 (texto)', hex('slate-400'), hex('slate-600'), R['sec-blanco-400'].antes.ratio, R['sec-blanco-400'].despues.ratio, 'pages/Dashboard.tsx (4)'],
  ['errorBlockCls / bg-red-50 text-red-600', hex('red-600'), hex('red-700'), R['error-bloque'].antes.ratio, R['error-bloque'].despues.ratio, 'lib/ui.ts + 8 líneas text-red-600'],
  ['errorTextCls', hex('red-600'), hex('red-700'), R['error-campo-pagina'].antes.ratio, R['error-campo-pagina'].despues.ratio, 'lib/ui.ts (10 usos)'],
  ['badge bodega / productos', hex('amber-700'), hex('amber-800'), R['badge-amber'].antes.ratio, R['badge-amber'].despues.ratio, 'Devoluciones.tsx:25, Dashboard.tsx:8'],
  ['punto producto', hex('amber-500'), hex('amber-600'), R['punto-amber'].antes.ratio, R['punto-amber'].despues.ratio, 'Despachos.tsx:625'],
  ['punto envase', hex('emerald-500'), hex('emerald-600'), R['punto-emerald'].antes.ratio, R['punto-emerald'].despues.ratio, 'Despachos.tsx:625'],
  ['Quitar (tarjetas)', 'btnDanger sólido', 'outline red-700 sobre blanco', R['quitar-actual'].antes.ratio, R['quitar-actual'].despues.ratio, 'FilaProductoVenta.tsx:52, Despachos.tsx:729'],
].map(([t, a, p, x, y, d]) => `<tr><td><code>${t}</code></td><td>${a.startsWith('#') ? sw(a) : ''}${a}</td><td>${p.startsWith('#') ? sw(p) : ''}${p}</td><td>${x == null ? '—' : fmt(x) + ':1'}</td><td>${y == null ? '—' : fmt(y) + ':1'}</td><td>${d}</td></tr>`).join('')}
</tbody></table></div>
<p class="n">Contrastes recalculados con <code>node D1-generar.mjs</code>; el detalle completo (${filas.length} combinaciones) queda en <code>D1-contrastes.json</code>. Los valores difieren levemente de los del brief (p. ej. ${fmt(R['error-bloque'].antes.ratio)} y no 4,41 para red-600/red-50; ${fmt(R['sec-blanco-400'].antes.ratio)} para slate-400/blanco) porque el brief usaba hex de Tailwind v3; v4 define los neutros/estados en oklch.</p>
</main></body></html>`

writeFileSync(resolve(aqui, 'D1-propuesta-colores.html'), html)
writeFileSync(resolve(aqui, 'D1-contrastes.json'), JSON.stringify({ escalaActual: ACTUAL, propuestaA: A, propuestaB: B, monotona: { actual: monotona(ACTUAL), A: monotona(A), B: monotona(B) }, contrastes: filas }, null, 2))
console.log(`OK ${filas.length} combinaciones; monótona actual=${monotona(ACTUAL)} A=${monotona(A)} B=${monotona(B)}`)
for (const f of filas) console.log(f.id.padEnd(22), fmt(f.antes.ratio).padStart(6), '→', fmt(f.despues.ratio).padStart(6))
