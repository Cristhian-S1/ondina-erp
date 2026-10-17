// Local-only browser evidence runner. Requires the already-running Vite server on :5173.
const path = require('node:path')
const os = require('node:os')
const { chromium } = require(process.env.O2_PLAYWRIGHT_MODULE || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const root = path.resolve(__dirname, '../../../../..')
const { createClient } = require(path.join(root, 'frontend/node_modules/@supabase/supabase-js'))
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const out = root + '/docs/archive/audits/2026-10-14/frontend-movil/capturas/O2'
const status = execFileSync('supabase', ['status', '-o', 'env'], {cwd:root, encoding:'utf8',stdio:['ignore','pipe','pipe']})
const env = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(m=>[m[1],m[2]]))
if (new URL(env.API_URL).hostname !== '127.0.0.1') throw Error('local only')
const opts = {auth:{persistSession:false,autoRefreshToken:false}}
const admin = createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts)
const client = createClient(env.API_URL,env.ANON_KEY,opts)
const email = `o2-visual-${Date.now()}@example.invalid`
const originalPassword = 'O2-Visual-Original2026'
const changedPassword = 'O2-Visual-Cambiada2026'
const assert = (condition,message) => { if(!condition) throw Error(message) }
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 const created = await admin.auth.admin.createUser({email,password:originalPassword,email_confirm:true})
 assert(!created.error,'create fixture')
 const userId = created.data.user.id
 let browser
 const results=[]
 try {
  browser = await chromium.launch({headless:true,executablePath:process.env.O2_CHROME_EXECUTABLE || '/usr/bin/google-chrome'})
  const context=await browser.newContext()
  const page=await context.newPage()
  const errors=[], profileRequests=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text())})
  page.on('request',r=>{if(r.url().includes('/rest/v1/perfiles'))profileRequests.push(r.url().split('?')[0])})
  const shot = async(name,w,h)=>{
    await page.screenshot({path:`${out}/${name}-${w}x${h}-despues.png`,fullPage:true})
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('input,button,a')].map(e=>({tag:e.tagName,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}))}))
    assert(layout.scroll<=w,'horizontal overflow '+name)
    assert(layout.controls.every(c=>c.height>=44),'touch target below 44px '+name)
    results.push({name,viewport:`${w}x${h}`,...layout})
  }
  for(const [w,h] of [[412,915],[768,1024],[1280,900]]) {
    await page.setViewportSize({width:w,height:h})
    await page.goto('http://127.0.0.1:5173/recuperar')
    await page.getByRole('heading',{name:'Recuperar contraseña',exact:true}).waitFor()
    await shot('recuperar',w,h)
  }
  await page.setViewportSize({width:412,height:915})
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button',{name:'Enviar enlace'}).click()
  await page.getByRole('status').filter({hasText:'Si el correo está registrado'}).waitFor()
  await shot('recuperar-enviado',412,915)
  const link=await admin.auth.admin.generateLink({type:'recovery',email})
  assert(!link.error,'generate recovery link')
  const verified=await client.auth.verifyOtp({type:'recovery',token_hash:link.data.properties.hashed_token})
  assert(!verified.error,'verify recovery')
  const s=verified.data.session
  const hash=new URLSearchParams({access_token:s.access_token,refresh_token:s.refresh_token,type:'recovery',expires_in:'3600',token_type:'bearer'})
  await page.goto('http://127.0.0.1:5173/restablecer#'+hash)
  await page.getByLabel('Nueva contraseña').waitFor()
  assert(profileRequests.length===0,'ERP profile queried during recovery')
  for(const [w,h] of [[412,915],[768,1024],[1280,900]]) {
    await page.setViewportSize({width:w,height:h})
    await shot('restablecer',w,h)
  }
  await page.reload()
  await page.getByLabel('Nueva contraseña').waitFor()
  await page.goto('http://127.0.0.1:5173/ventas')
  await page.getByLabel('Nueva contraseña').waitFor()
  assert(page.url().endsWith('/restablecer'),'protected route not isolated')
  const another=await context.newPage()
  await another.goto('http://127.0.0.1:5173/')
  await another.getByLabel('Nueva contraseña').waitFor()
  assert(another.url().endsWith('/restablecer'),'new tab not isolated')
  await another.close()
  assert(profileRequests.length===0,'profile fetched on recovery reload')
  await page.setViewportSize({width:412,height:915})
  await page.getByLabel('Nueva contraseña').fill('corta')
  await page.getByLabel('Confirmar contraseña').fill('otra')
  await page.getByRole('button',{name:'Guardar contraseña'}).click()
  await page.getByText('Usa al menos 10 caracteres.',{exact:true}).waitFor()
  assert(await page.getByLabel('Nueva contraseña').evaluate(e=>e===document.activeElement),'validation focus')
  await shot('restablecer-validacion',412,915)
  await page.getByLabel('Nueva contraseña').fill(changedPassword)
  await page.getByLabel('Confirmar contraseña').fill(changedPassword)
  await page.getByRole('button',{name:'Guardar contraseña'}).click()
  await page.getByRole('status').filter({hasText:'Contraseña actualizada'}).waitFor()
  assert(page.url().endsWith('/login'),'did not return to login')
  const login=await client.auth.signInWithPassword({email,password:changedPassword})
  assert(!login.error,'new password login failed')
  await client.auth.signOut()
  for(const [w,h] of [[412,915],[768,1024],[1280,900]]) {
    await page.setViewportSize({width:w,height:h})
    await page.goto('http://127.0.0.1:5173/restablecer#error=access_denied&error_code=otp_expired')
    await page.getByRole('alert').filter({hasText:'El enlace expiró'}).waitFor()
    await shot('restablecer-enlace-invalido',w,h)
  }
  assert(errors.length===0,'browser console errors')
  fs.writeFileSync(out+'/verificacion.json',JSON.stringify({date:new Date().toISOString(),results,consoleErrors:errors,profileRequests,flow:['real PASSWORD_RECOVERY callback','reload','protected route','new tab','validation focus','updateUser','signOut','login with changed password','invalid callback']},null,2))
  console.log(JSON.stringify({screenshots:results.length,consoleErrors:errors.length,profileRequests:profileRequests.length,flow:'PASS'}))
 } finally {
  if(browser)await browser.close()
  try {
   const restored=await admin.auth.admin.updateUserById(userId,{password:originalPassword})
   assert(!restored.error,'restore original password')
   const login=await client.auth.signInWithPassword({email,password:originalPassword})
   assert(!login.error,'verify original password')
   await client.auth.signOut()
  } finally {
   assert(!(await admin.auth.admin.deleteUser(userId)).error,'delete visual fixture')
  }
 }
})().catch(()=>{console.error('O2 browser verification failed; inspect locally without recording recovery URLs.');process.exitCode=1})
