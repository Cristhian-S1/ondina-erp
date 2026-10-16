// Local demo data for Ondina. Never run against production: aborts unless the API is local.
// Usage (repo root or anywhere): node scripts/demo/seed-demo.mjs
// Keys: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the environment
// (levantar-windows.ps1 passes them), otherwise read from `supabase status -o env`.
// The service_role key is only held in memory; nothing is written to disk.
// Creates (if missing) 5 ux-*@example.invalid accounts and, acting as each user through the
// same RPCs/tables as the app, seeds clients, a dispatch (load), sales, expenses, production,
// losses and incidents in Sucursal Sintética A. Re-running does not duplicate data.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(REPO, 'frontend', 'package.json'))
const { createClient } = require('@supabase/supabase-js')

function clavesDeSupabaseCli() {
  try {
    const salida = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', cwd: REPO, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] })
    return Object.fromEntries(salida.split(/\r?\n/).map((l) => /^([A-Z0-9_]+)="(.*)"$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2]]))
  } catch {
    return {}
  }
}

let URL_ = process.env.SUPABASE_URL ?? ''
let ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!URL_ || !ANON_KEY || !SERVICE_ROLE_KEY) {
  const cli = clavesDeSupabaseCli()
  URL_ ||= cli.API_URL ?? ''
  ANON_KEY ||= cli.ANON_KEY ?? ''
  SERVICE_ROLE_KEY ||= cli.SERVICE_ROLE_KEY ?? ''
}
if (!URL_ || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('No se encontraron las claves de Supabase local. Arranca Supabase (supabase start) en la carpeta del repo')
  console.error('o exporta SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY, y vuelve a ejecutar.')
  process.exit(1)
}
if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error(`Sólo Supabase local; recibido ${URL_}`)
// Tras `supabase db reset` Auth tarda en volver; si Kong queda con 502 hay que reiniciarlo.
for (let i = 0; ; i++) {
  const r = await fetch(`${URL_}/auth/v1/health`).catch(() => null)
  if (r?.ok) break
  if (i === 20) throw new Error('Auth local no responde (HTTP ' + (r?.status ?? 'sin conexión') + '). Prueba: docker restart supabase_kong_ondina-erp')
  await new Promise((res) => setTimeout(res, 2000))
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL_, SERVICE_ROLE_KEY, opts)
const A = '10000000-0000-0000-0000-000000000001'
// Local-only demo accounts on example.invalid; override with DEMO_PASSWORD if you prefer.
const PASS = process.env.DEMO_PASSWORD || 'ux-local-2026'
const P = { pol: '40000000-0000-0000-0000-000000000001', pet: '40000000-0000-0000-0000-000000000002', b10: '40000000-0000-0000-0000-000000000003', cubo: '40000000-0000-0000-0000-000000000004', saco: '40000000-0000-0000-0000-000000000005', frape: '40000000-0000-0000-0000-000000000006' }
const ok = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

// 1) Cuentas
const cuentas = [['ux-vendedor', 'vendedor', A, 'Valentina', 'Rojas'], ['ux-bodega', 'bodega', A, 'Bruno', 'Díaz'],
  ['ux-produccion', 'produccion', A, 'Paula', 'Muñoz'], ['ux-admin', 'administrador', A, 'Andrés', 'Soto'],
  ['ux-admin-global', 'administrador', null, 'Gabriela', 'Fuentes']]
const ids = {}
for (const [k, rol, suc, nombres, apellidos] of cuentas) {
  const email = `${k}@example.invalid`
  let user = null, ultimo = null
  for (let intento = 0; intento < 10 && !user; intento++) {
    const r = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
    user = r.data?.user ?? null; ultimo = r.error
    if (!user && /already/i.test(r.error?.message ?? '')) break
    if (!user) await new Promise((res) => setTimeout(res, 2000)) // Auth puede seguir arrancando tras un reset
  }
  if (!user && !/already/i.test(ultimo?.message ?? '')) throw new Error(`crear ${k}: ${ultimo?.message ?? JSON.stringify(ultimo)}`)
  if (!user) {
    // Ya existe: obtenemos su id iniciando sesión con la contraseña conocida.
    const c = createClient(URL_, ANON_KEY, opts)
    user = ok(await c.auth.signInWithPassword({ email, password: PASS }), `login ${k} (ya existente)`).user
  }
  ids[k] = user.id
  ok(await admin.from('perfiles').upsert({ id: user.id, sucursal_id: suc, nombres, apellidos, rol, activo: true }), `perfil ${k}`)
}
console.log(`Cuentas listas (contraseña ${PASS}):`, Object.keys(ids).map((k) => `${k}@example.invalid`).join(', '))

async function como(k) {
  const c = createClient(URL_, ANON_KEY, opts)
  ok(await c.auth.signInWithPassword({ email: `${k}@example.invalid`, password: PASS }), `login ${k}`)
  return c
}

// Evita duplicar datos si ya se sembró antes.
const { count } = await admin.from('clientes').select('id', { count: 'exact', head: true }).eq('vendedor_id', ids['ux-vendedor'])
const yaVentas = count > 0
const { count: nProd } = await admin.from('producciones').select('id', { count: 'exact', head: true }).eq('creado_por', ids['ux-produccion'])
const yaProd = nProd > 0
if (yaVentas && yaProd) { console.log('Los datos de prueba ya existen; no se duplican. (Para empezar de cero: supabase db reset --local y vuelve a ejecutar.)'); process.exit(0) }

if (!yaVentas) {
// 2) Stock de bodega suficiente (sólo saldo inicial sintético en la sucursal A)
const { data: empaques } = await admin.from('tipos_empaque').select('id')
ok(await admin.from('stock_envases').upsert(empaques.map((e) => ({ sucursal_id: A, tipo_empaque_id: e.id, cantidad: 1000 })), { onConflict: 'sucursal_id,tipo_empaque_id' }), 'stock envases')
ok(await admin.from('stock_bodega').upsert(Object.values(P).map((producto_id) => ({ sucursal_id: A, producto_id, cantidad: 500 })), { onConflict: 'sucursal_id,producto_id' }), 'stock')

// 3) Bodega despacha carga al vendedor
const bodega = await como('ux-bodega')
ok(await bodega.rpc('crear_despacho', { p_sucursal_id: A, p_vendedor_id: ids['ux-vendedor'], p_despachador_id: ids['ux-bodega'], p_creado_por: ids['ux-bodega'],
  p_lineas: [{ producto_id: P.pol, cantidad: 40 }, { producto_id: P.pet, cantidad: 30 }, { producto_id: P.b10, cantidad: 20 }, { producto_id: P.cubo, cantidad: 60 }, { producto_id: P.saco, cantidad: 25 }, { producto_id: P.frape, cantidad: 15 }],
  p_envases: [], p_idempotency_key: randomUUID() }), 'despacho')
console.log('Despacho creado: carga asignada a ux-vendedor')

// 4) Vendedor: clientes, ventas y gastos
const vend = await como('ux-vendedor')
const clientes = [['Almacén Don Pedro', 'Av. Libertad 1234', '+56 9 1234 5678', 'mayorista'], ['Minimarket La Esquina', 'Calle Prat 456', '+56 9 8765 4321', 'minorista'],
  ['Botillería El Puerto', 'Blanco 789, local 3', null, 'minorista'], ['Restaurante Brisa Marina', 'Costanera 1500', '+56 9 5555 1212', 'mayorista'],
  ['Feria Sra. Marta', 'Puesto 22, Feria Libre', null, 'ocasional']]
for (const [nombre, direccion, telefono, tipo] of clientes) {
  ok(await vend.from('clientes').insert({ nombre, direccion, telefono, numero_local: null, tipo, vendedor_id: ids['ux-vendedor'], sucursal_id: A, creado_por: ids['ux-vendedor'], activo: true }), `cliente ${nombre}`)
}
const { data: cli } = await vend.from('clientes').select('id, nombre').eq('vendedor_id', ids['ux-vendedor']).order('nombre')
const ventas = [[0, 'efectivo', [[P.pol, 10, 1000], [P.cubo, 20, 400]], 0], [1, 'transferencia', [[P.pet, 5, 1000], [P.saco, 6, 400]], 500],
  [3, 'efectivo', [[P.b10, 4, 1200], [P.frape, 5, 450]], 0]]
for (const [i, metodo, lineas, descuento] of ventas) {
  ok(await vend.rpc('registrar_venta', { p_cliente_id: cli[i].id, p_metodo_pago: metodo, p_descuento: descuento, p_observaciones: 'Venta de prueba UX',
    p_detalles: lineas.map(([producto_id, cantidad, precio_unitario]) => ({ producto_id, cantidad, precio_unitario, envases_recibidos: 0 })), p_idempotency_key: randomUUID() }), `venta ${cli[i].nombre}`)
}
for (const [tipo, monto, motivo] of [['combustible', 15000, 'Carga de bencina camioneta'], ['otra', 3500, 'Estacionamiento centro']]) {
  ok(await vend.from('gastos_extras').insert({ tipo, monto, motivo, vendedor_id: ids['ux-vendedor'], sucursal_id: A, creado_por: ids['ux-vendedor'], anulado: false, comprobante_url: null }), 'gasto')
}
console.log('Vendedor: 5 clientes, 3 ventas y 2 gastos')

}
if (!yaProd) {
// 5) Producción: registros, merma e incidencia
const prod = await como('ux-produccion')
for (const [producto_id, cantidad, obs] of [[P.pol, 120, 'Turno mañana'], [P.cubo, 300, null], [P.saco, 80, 'Lote para feria'], [P.pet, 60, null]]) {
  ok(await prod.from('producciones').insert([{ sucursal_id: A, producto_id, cantidad, observaciones: obs, creado_por: ids['ux-produccion'] }]), 'producción')
}
ok(await prod.from('mermas').insert([{ sucursal_id: A, producto_id: P.cubo, tipo_empaque_id: null, despacho_id: null, cantidad: 12, motivo: 'Bolsas rotas en el sellado', creado_por: ids['ux-produccion'] }]), 'merma')
ok(await prod.from('incidencias_produccion').insert({ sucursal_id: A, produccion_id: null, descripcion: 'La selladora se detuvo 20 minutos por sobrecalentamiento.', creado_por: ids['ux-produccion'] }), 'incidencia')
console.log('Producción: 4 registros, 1 merma y 1 incidencia')
}
console.log('Listo. Inicia la app con: npm run dev  (http://localhost:5173)')
