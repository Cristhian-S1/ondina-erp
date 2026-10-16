// LOCAL ONLY. The coordinator owns reset + UX reseed after all workers finish.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const env = Object.fromEntries(execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
}).trim().split('\n').map(line => {
  const i = line.indexOf('=')
  return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]
}))
const url = env.API_URL
if (url !== 'http://127.0.0.1:54321' && url !== 'http://localhost:54321') throw new Error('Refusing a non-local API URL')
if (!env.SERVICE_ROLE_KEY) throw new Error('Local service key unavailable')
const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
async function request(path, options = {}, allowFailure = false) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const body = await response.text()
  if (!response.ok && !allowFailure) throw new Error(`Local API ${response.status}: ${body}`)
  return { status: response.status, data: body && response.ok ? JSON.parse(body) : null, bytes: Buffer.byteLength(body), count: response.headers.get('content-range') }
}
const prefix = 'e1b0de00-707c-4ad2-8e26-'
const ids = Array.from({ length: 300 }, (_, i) => `${prefix}${String(i + 1).padStart(12, '0')}`)
const idFilter = `id=gte.${ids[0]}&id=lte.${ids.at(-1)}`
const command = process.argv[2] ?? 'status'
if (command === 'cleanup') {
  console.error('DELETE is forbidden by proteger_movimiento_b3. Per coordinator approval, do not annul these headers. Cleanup belongs to the coordinator: supabase db reset followed by the existing UX seed, only at session closure. This script never resets the database.')
  process.exitCode = 2
} else if (command === 'seed') {
  const login = async email => (await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password: 'ux-local-2026' }),
  })).data.user.id
  const bodegaId = await login('ux-bodega@example.invalid')
  const vendedorId = await login('ux-vendedor@example.invalid')
  if (!bodegaId || !vendedorId) throw new Error('Expected local UX accounts are missing')
  const { data: [bodega] } = await request(`/rest/v1/perfiles?id=eq.${bodegaId}&select=id,sucursal_id`)
  if (!bodega?.sucursal_id) throw new Error('Expected UX branch is missing')
  const { data: existing } = await request(`/rest/v1/despachos?${idFilter}&select=id&limit=1000`)
  const present = new Set(existing.map(d => d.id))
  const balances = async () => {
    const result = {}
    for (const table of ['stock_bodega', 'stock_envases', 'carga_vendedor']) {
      const { data } = await request(`/rest/v1/${table}?select=*&limit=1000`)
      result[table] = data.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
    return result
  }
  const before = await balances()
  const rows = ids.filter(id => !present.has(id)).map(id => ({ id, sucursal_id: bodega.sucursal_id,
    vendedor_id: vendedorId, despachador_id: bodegaId, creado_por: bodegaId }))
  if (rows.length) await request('/rest/v1/despachos', { method: 'POST', body: JSON.stringify(rows) })
  const after = await balances()
  const proof = { marker: prefix, inserted: rows.length, existing: present.size, syntheticTotal: 300,
    sucursalId: bodega.sucursal_id, balancesUnchanged: JSON.stringify(before) === JSON.stringify(after),
    cleanup: 'Coordinator reset + UX reseed at session closure; no annulment, no DELETE, no SQL changes.' }
  if (process.argv[3]) writeFileSync(resolve(process.argv[3]), JSON.stringify(proof, null, 2) + '\n')
  console.log(JSON.stringify(proof, null, 2))
} else if (command === 'status') {
  const result = await request(`/rest/v1/despachos?${idFilter}&select=id&limit=1000`, { headers: { Prefer: 'count=exact' } })
  console.log(JSON.stringify({ marker: prefix, count: result.data.length, contentRange: result.count }))
} else if (command === 'measure') {
  const { data: [first] } = await request(`/rest/v1/despachos?${idFilter}&select=sucursal_id&limit=1`)
  if (!first) throw new Error('Seed first')
  async function measure(paged) {
    const rows = []
    const head = await request(`/rest/v1/despachos?select=*&sucursal_id=eq.${first.sucursal_id}&order=creado_en.desc,id.desc${paged ? '&offset=0&limit=20' : ''}`, { headers: paged ? { Prefer: 'count=exact' } : {} })
    rows.push({ resource: 'despachos', bytes: head.bytes, rows: head.data.length, status: head.status, contentRange: head.count })
    const pageIds = head.data.map(d => d.id).join(',')
    for (const table of ['despacho_detalles', 'despacho_envases', 'devoluciones_productos', 'devoluciones_envases']) {
      const result = await request(`/rest/v1/${table}?select=*&despacho_id=in.(${pageIds})${table.startsWith('devoluciones') ? '&anulado=eq.false' : ''}`, {}, true)
      rows.push({ resource: table, bytes: result.bytes, rows: result.data?.length ?? null, status: result.status })
    }
    return { resources: rows, bytes: rows.reduce((sum, item) => sum + item.bytes, 0) }
  }
  const result = { recordedAt: new Date().toISOString(), marker: prefix, before: await measure(false), after: await measure(true),
    note: 'Decoded HTTP response body bytes, same local branch, all dates; headers only fixture, no stock movements.' }
  if (process.argv[3]) writeFileSync(resolve(process.argv[3]), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
} else throw new Error('Use seed, status, measure [output.json], or cleanup')
