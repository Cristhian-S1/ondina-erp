// LOCAL ONLY. Cleanup is coordinator-owned reset + UX reseed at session closure.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const env = Object.fromEntries(execFileSync('supabase', ['status', '-o', 'env'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]
}))
const url = env.API_URL
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url)) throw new Error('Refusing non-local API')
if (!env.SERVICE_ROLE_KEY) throw new Error('Missing local service key')
const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
async function api(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const text = await response.text()
  if (!response.ok) throw new Error(`Local API ${response.status}: ${text}`)
  return { data: text ? JSON.parse(text) : null, bytes: Buffer.byteLength(text), status: response.status, range: response.headers.get('content-range') }
}
const branch = '10000000-0000-0000-0000-000000000002'
const marker = 'e2a00710'
const id = (kind, n) => `${marker}-${String(kind).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`
const product = id(1, 1)
const command = process.argv[2] ?? 'status'
const login = async email => (await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: 'ux-local-2026' }) })).data.user.id
const expenseSeller = await login('ux-vendedor@example.invalid')
if (command === 'cleanup') {
  console.error('Do not DELETE or annul fixtures with movement/audit retention. Per coordinator approval, cleanup belongs to the coordinator via supabase db reset + the session UX seed at closure; never reset while other workers are active. This script performs no cleanup mutation.')
  process.exitCode = 2
} else if (command === 'seed') {
  const actor = await login('ux-admin-global@example.invalid')
  const { data: sellers } = await api(`/rest/v1/perfiles?select=id,nombres,apellidos&sucursal_id=eq.${branch}&rol=eq.vendedor&activo=eq.true`)
  if (!sellers.length) throw new Error('Missing fixture seller in branch 2')
  const seller = sellers[0].id
  const { data: [pack] } = await api('/rest/v1/tipos_empaque?select=id&categoria=eq.no_retornable&limit=1')
  const { data: existingProduct } = await api(`/rest/v1/productos?id=eq.${product}&select=id`)
  if (!existingProduct.length) await api('/rest/v1/productos', { method: 'POST', body: JSON.stringify({ id: product, nombre: 'P2 sintético · Hielo de prueba', tipo: 'hielo', tipo_empaque_id: pack.id, precio_base: 100, activo: true }) })
  async function balances() {
    const result = {}
    for (const table of ['stock_bodega', 'stock_envases', 'carga_vendedor']) {
      const { data } = await api(`/rest/v1/${table}?select=*&limit=1000`)
      result[table] = data.filter(row => row.producto_id !== product).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
    return result
  }
  const before = await balances()
  const inserted = {}
  async function seed(table, kind, makeRow) {
    const { data: existing } = await api(`/rest/v1/${table}?select=id&id=gte.${id(kind, 1)}&id=lte.${id(kind, 300)}&limit=1000`)
    const present = new Set(existing.map(row => row.id))
    const rows = Array.from({ length: 300 }, (_, i) => ({ id: id(kind, i + 1), ...makeRow(i + 1) })).filter(row => !present.has(row.id))
    if (rows.length) await api(`/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(rows) })
    inserted[table] = rows.length
  }
  await seed('producciones', 2, n => ({ sucursal_id: branch, producto_id: product, cantidad: 1, creado_por: actor, observaciones: `P2 paginación · Producción sintética ${n}` }))
  await seed('mermas', 3, n => ({ sucursal_id: branch, producto_id: product, cantidad: 1, creado_por: actor, motivo: `P2 paginación · Merma sintética ${n}`, despacho_id: null, tipo_empaque_id: null }))
  await seed('incidencias_produccion', 4, n => ({ sucursal_id: branch, produccion_id: null, creado_por: actor, descripcion: `P2 paginación · Incidencia sintética ${n}. Verificación local del turno.` }))
  await seed('clientes', 5, n => ({ sucursal_id: branch, vendedor_id: seller, creado_por: actor, nombre: `P2 cliente sintético ${String(n).padStart(3,'0')}`, direccion: `Calle de prueba ${n}`, tipo: 'minorista', activo: true }))
  await seed('gastos_extras', 6, n => ({ sucursal_id: '10000000-0000-0000-0000-000000000001', vendedor_id: expenseSeller, creado_por: expenseSeller, tipo: 'otra', monto: 1, motivo: `P2 paginación · Gasto sintético ${n}`, anulado: false, comprobante_url: null }))
  const after = await balances()
  const { data: syntheticStock } = await api(`/rest/v1/stock_bodega?producto_id=eq.${product}&sucursal_id=eq.${branch}&select=cantidad`)
  const proof = { marker, branch, product, seller, expenseSeller, inserted,
    existingBalancesUnchanged: JSON.stringify(before) === JSON.stringify(after), syntheticStock,
    impact: 'Production, losses, incidents and clients confined to branch 2; 300 expenses belong to UX seller in branch 1; one synthetic product is globally visible. All remain until coordinator reset/reseed.' }
  if (process.argv[3]) writeFileSync(resolve(process.argv[3]), JSON.stringify(proof,null,2)+'\n')
  console.log(JSON.stringify(proof,null,2))
} else if (command === 'status') {
  for (const [table,kind] of [['producciones',2],['mermas',3],['incidencias_produccion',4],['clientes',5],['gastos_extras',6]]) {
    const result=await api(`/rest/v1/${table}?select=id&id=gte.${id(kind,1)}&id=lte.${id(kind,300)}&limit=1000`)
    console.log(table,result.data.length)
  }
} else if (command === 'measure') {
  const { data: [seller] } = await api(`/rest/v1/perfiles?select=id&sucursal_id=eq.${branch}&rol=eq.vendedor&activo=eq.true&limit=1`)
  const results=[]
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' })
  const day = fmt.format(new Date())
  function startDay(value) {
    const ref = Date.parse(`${value}T12:00:00Z`)
    let left = ref - 36 * 3600_000, right = ref + 36 * 3600_000
    while (left < right) { const mid = Math.floor((left + right) / 2); if (fmt.format(mid) < value) left = mid + 1; else right = mid }
    return new Date(left).toISOString()
  }
  const nextDay = new Date(`${day}T12:00:00Z`); nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const dayFilter = `&creado_en=gte.${startDay(day)}&creado_en=lt.${startDay(nextDay.toISOString().slice(0, 10))}`
  const filters = {
    producciones: `sucursal_id=eq.${branch}&anulado=eq.false&order=creado_en.desc,id.desc`,
    mermas: `sucursal_id=eq.${branch}&anulado=eq.false&despacho_id=is.null&producto_id=not.is.null&order=creado_en.desc,id.desc`,
    incidencias_produccion: `sucursal_id=eq.${branch}&order=creado_en.desc,id.desc`,
    clientes: `sucursal_id=eq.${branch}&vendedor_id=eq.${seller.id}&activo=eq.true&order=nombre.asc,id.asc`,
    gastos_extras: `sucursal_id=eq.10000000-0000-0000-0000-000000000001&vendedor_id=eq.${expenseSeller}&order=creado_en.desc,id.desc${dayFilter}`,
  }
  for (const [view,table,oldLimit,size] of [['reciente','producciones',30,10],['historial','producciones',200,10],['mermas','mermas',30,10],['incidencias','incidencias_produccion',30,10],['clientes','clientes',null,20],['gastos','gastos_extras',null,20]]) {
    const select=table==='clientes'?'id,nombre,telefono,direccion,numero_local,tipo,activo,creado_en':table==='gastos_extras'?'id,tipo,monto,motivo,creado_en,anulado,vendedor_id,sucursal_id':'*'
    const before=await api(`/rest/v1/${table}?select=${select}&${filters[table]}${oldLimit?`&limit=${oldLimit}`:''}`)
    const after=await api(`/rest/v1/${table}?select=${select}&${filters[table]}&offset=0&limit=${size}`,{headers:{Prefer:'count=exact'}})
    results.push({view,before:{rows:before.data.length,bytes:before.bytes,status:before.status},after:{rows:after.data.length,bytes:after.bytes,status:after.status,contentRange:after.range},headersReductionPercent:100*(1-after.bytes/before.bytes)})
  }
  const amounts = await api(`/rest/v1/gastos_extras?select=monto&${filters.gastos_extras}&anulado=eq.false&limit=500`, { headers: { Prefer: 'count=exact' } })
  const proof={recordedAt:new Date().toISOString(),marker,branch,results,dailyAmounts:{day,rows:amounts.data.length,bytes:amounts.bytes,total:amounts.data.reduce((sum,row)=>sum+Number(row.monto),0),contentRange:amounts.range},note:'Decoded HTTP body bytes; expenses filtered to the current Santiago civil day; compact daily total is a separate request.'}
  if(process.argv[3])writeFileSync(resolve(process.argv[3]),JSON.stringify(proof,null,2)+'\n')
  console.log(JSON.stringify(proof,null,2))
} else throw new Error('Use seed, status, measure [output.json], cleanup')
