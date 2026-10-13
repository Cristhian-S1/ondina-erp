// B4 / OND-5gi.8 / #48 / BD-12: verify that Realtime postgres_changes respects RLS per subscriber.
// LOCAL ONLY. It inserts synthetic rows as the database owner and mutates one fixture's
// activo flag, restoring it at the end. Never point it at a remote project.
//
// Required environment (from `supabase status -o env --workdir <workdir>` on the local stack):
//   SUPABASE_URL         e.g. http://127.0.0.1:55321
//   SUPABASE_ANON_KEY    local anon key
//   SUPABASE_JWT_SECRET  local JWT secret (signs the synthetic subscriber tokens)
//   LOCAL_DB_URL         e.g. postgresql://postgres:postgres@127.0.0.1:55322/postgres (psql)
// Run from the repository root after synthetic_volume.psql or a clean reset:
//   node supabase/tests/perf/realtime-rls-check.mjs
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'

// supabase-js is a frontend dependency; load its CommonJS build from frontend/.
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')

const env = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}
const URL_API = env('SUPABASE_URL')
const ANON = env('SUPABASE_ANON_KEY')
const SECRET = env('SUPABASE_JWT_SECRET')
const DB = env('LOCAL_DB_URL')
if (!/127\.0\.0\.1|localhost/.test(URL_API)) throw new Error('Refusing to run against a non-local URL')

const SUC_A = '10000000-0000-0000-0000-000000000001'
const SUC_B = '10000000-0000-0000-0000-000000000002'
const PROD_A = '20000000-0000-0000-0001-000000000003'
const PROD_B = '20000000-0000-0000-0002-000000000003'
const PRODUCTO = '40000000-0000-0000-0000-000000000001'
const CREADOR = { [SUC_A]: PROD_A, [SUC_B]: PROD_B }

const base64url = (input) => Buffer.from(input).toString('base64url')
const jwt = (sub) => {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }))
  const signature = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}
const psql = (sql) => execFileSync('psql', [DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()

// Subscribe as `uid` to INSERT events on producciones and mermas for one branch filter.
async function subscribe(label, uid, sucursalFilter) {
  const client = createClient(URL_API, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  client.realtime.setAuth(jwt(uid))
  const events = []
  const channel = client.channel(`b4-${label}-${randomUUID()}`)
  for (const table of ['producciones', 'mermas']) {
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `sucursal_id=eq.${sucursalFilter}` },
      (payload) => events.push({ table, id: payload.new.id, sucursal: payload.new.sucursal_id }))
  }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: subscription timeout`)), 15000)
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(error ?? new Error(status)) }
    })
  })
  return { client, channel, events }
}

const insertRows = (sucursal) => {
  const produccionId = randomUUID()
  const mermaId = randomUUID()
  psql(`insert into public.producciones(id, sucursal_id, producto_id, cantidad, creado_por)
        values ('${produccionId}', '${sucursal}', '${PRODUCTO}', 3, '${CREADOR[sucursal]}');`)
  psql(`insert into public.mermas(id, sucursal_id, producto_id, cantidad, motivo, creado_por)
        values ('${mermaId}', '${sucursal}', '${PRODUCTO}', 1, 'Realtime RLS check', '${CREADOR[sucursal]}');`)
  return { produccionId, mermaId }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// Poll until the expected deliveries arrive (or the window closes) so slow WAL delivery is not a false negative.
async function waitUntil(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !predicate()) await wait(250)
}
const results = []
const check = (name, ok) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`) }

const cleanups = []
try {
  // 1. Own-branch production user receives producciones and mermas inserts for branch A.
  const own = await subscribe('own-A', PROD_A, SUC_A)
  cleanups.push(() => own.client.removeAllChannels())
  // 2. Production user of branch B subscribes with a forged filter for branch A: must receive nothing.
  const other = await subscribe('other-B-filter-A', PROD_B, SUC_A)
  cleanups.push(() => other.client.removeAllChannels())
  // 3. Positive control for branch B.
  const ownB = await subscribe('own-B', PROD_B, SUC_B)
  cleanups.push(() => ownB.client.removeAllChannels())

  const rowsA = insertRows(SUC_A)
  const rowsB = insertRows(SUC_B)
  await waitUntil(() => own.events.length >= 2 && ownB.events.length >= 2)
  await wait(1000) // leave time for any unexpected delivery to the negative subscriber

  const mineA = own.events.map((e) => e.id)
  check('own-branch subscriber receives its producciones insert', mineA.includes(rowsA.produccionId))
  check('own-branch subscriber receives its mermas insert (BD-12 publication)', own.events.some((e) => e.table === 'mermas' && e.id === rowsA.mermaId))
  check('other-branch subscriber receives no branch-A rows (RLS + filter)', other.events.length === 0)
  check('branch-B subscriber receives its own branch-B rows (control)', ownB.events.some((e) => e.id === rowsB.produccionId))
  check('branch-B subscriber receives no branch-A rows', ownB.events.every((e) => e.sucursal === SUC_B))

  // 4. Deactivated profile: RLS helpers return no role/branch, so inserts must not be delivered.
  psql(`update public.perfiles set activo = false where id = '${PROD_A}';`)
  try {
    const inactive = await subscribe('inactive-A', PROD_A, SUC_A)
    cleanups.push(() => inactive.client.removeAllChannels())
    insertRows(SUC_A)
    await wait(3000)
    check('inactive profile receives no branch-A rows even with a valid JWT', inactive.events.length === 0)
  } finally {
    psql(`update public.perfiles set activo = true where id = '${PROD_A}';`)
  }
} finally {
  for (const cleanup of cleanups) await cleanup()
}

const failed = results.filter((ok) => !ok).length
console.log(failed === 0 ? `All ${results.length} Realtime RLS checks passed.` : `${failed} of ${results.length} Realtime RLS checks failed.`)
process.exit(failed === 0 ? 0 : 1)
