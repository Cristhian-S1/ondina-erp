import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const out = resolve(process.argv[2] ?? 'docs/archive/audits/2026-10-14/frontend-movil/capturas/P2')
mkdirSync(out,{recursive:true})
const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'] })
const branch='10000000-0000-0000-0000-000000000002'
const seller='20000000-0000-0000-0002-000000000004'
const results=[]
const views=[
 {name:'reciente',path:'/produccion/registrar',heading:'Producción reciente',nav:'Paginación de producción reciente',resource:'producciones',size:10},
 {name:'historial',path:'/produccion/historial',heading:'Historial de producción',nav:'Paginación del historial de producción',resource:'producciones',size:10},
 {name:'incidencias',path:'/produccion/incidencias',heading:'Incidencias recientes',nav:'Paginación de incidencias',resource:'incidencias_produccion',size:10},
 {name:'mermas',path:'/produccion/incidencias',heading:'Mermas recientes',nav:'Paginación de mermas',resource:'mermas',size:10},
 {name:'clientes',path:'/clientes',heading:'Clientes',nav:'Paginación de clientes',resource:'clientes',size:20},
 {name:'gastos',path:'/gastos',heading:'Gastos de hoy',nav:'Paginación de gastos',resource:'gastos_extras',size:20},
]
try{
 for(const[phase,url]of[['antes','http://127.0.0.1:5188'],['despues','http://127.0.0.1:5187']]){
  for(const role of ['admin-global','vendedor']){
   const context=await browser.newContext({timezoneId:'America/Santiago',viewport:{width:1280,height:800}})
   const page=await context.newPage()
   const errors=[],failures=[],consoleErrors=[],requests=[],pending=[]
   page.on('pageerror',error=>errors.push(error.message))
   page.on('requestfailed',request=>failures.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}))
   page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text().slice(0,250))})
   page.on('response',response=>{
    if(!response.url().includes('/rest/v1/'))return
    pending.push((async()=>{
     const body=await response.body();let data;try{data=JSON.parse(body.toString())}catch{}
     requests.push({url:response.url().replace('http://127.0.0.1:54321',''),status:response.status(),bytes:body.length,rows:Array.isArray(data)?data.length:undefined,contentRange:response.headers()['content-range'],firstId:data?.[0]?.id,lastId:data?.at?.(-1)?.id})
    })().catch(error=>errors.push(error.message)))
   })
   await page.goto(url)
   await page.locator('#login-email').fill(`ux-${role}@example.invalid`)
   await page.locator('#login-password').fill('ux-local-2026')
   await page.locator('button[type="submit"]').click()
   await page.waitForURL(u=>!u.pathname.includes('login'))
   for(const view of views.filter(v=>role==='vendedor'?v.name==='gastos':v.name!=='gastos')){
    await page.goto(url+view.path)
    if(role==='admin-global'){
     await page.getByRole('combobox',{name:/^Sucursal/}).selectOption(branch)
     if(view.name==='clientes')await page.getByRole('combobox',{name:/^Vendedor responsable/}).selectOption(seller)
    }
    const heading=page.getByRole('heading',{name:view.heading,exact:true})
    await heading.waitFor()
    const target=view.name==='clientes'?page.locator('main'):page.locator('section').filter({has:heading}).first()
    if(phase==='despues'){
     await page.getByRole('navigation',{name:view.nav}).waitFor()
     await page.waitForFunction(label=>document.querySelector(`nav[aria-label="${label}"]`)?.getAttribute('aria-busy')==='false',view.nav)
    }else{
     if(view.name==='clientes')await page.locator('tbody tr').first().waitFor()
     else if(view.name==='gastos')await target.locator('ul > li').first().waitFor()
     else await target.getByTestId('tarjeta-registro').first().waitFor()
    }
    for(const[width,height]of[[412,915],[375,812],[768,1024],[1024,1366],[1280,800]]){
     await page.setViewportSize({width,height})
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
     await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'))
     await heading.evaluate(element=>element.scrollIntoView({block:'start'}))
     await page.evaluate(()=>window.scrollBy(0,-80))
     const proof=await target.evaluate((element,label)=>{
      const pager=document.querySelector(`nav[aria-label="${label}"]`)
      const candidates=element.querySelectorAll('[data-testid="tarjeta-registro"],tbody tr,ul > li')
      const visibleRows=Array.from(new Set(candidates)).filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).length
      const targets=pager?Array.from(pager.querySelectorAll('button')).map(button=>{const r=button.getBoundingClientRect();return{label:button.getAttribute('aria-label'),width:r.width,height:r.height,disabled:button.disabled}}):[]
      return{scrollWidth:document.documentElement.scrollWidth,innerWidth,documentHeight:document.documentElement.scrollHeight,sectionHeight:element.getBoundingClientRect().height,visibleRows,pager:pager?.textContent,targets}
     },view.nav)
     if(proof.scrollWidth>width)throw new Error(`Overflow ${phase} ${view.name} ${width}: ${proof.scrollWidth}`)
     if(proof.targets.some(t=>t.width<44||t.height<44))throw new Error('Small touch target')
     if(phase==='despues'&&proof.visibleRows>view.size)throw new Error(`Too many rows ${view.name}: ${proof.visibleRows}`)
     const file=`${view.name}-${width}x${height}-${phase}.png`
     await page.screenshot({path:resolve(out,file)})
     if(phase==='despues'){
      await page.getByRole('navigation',{name:view.nav}).scrollIntoViewIfNeeded()
      await page.screenshot({path:resolve(out,`${view.name}-${width}x${height}-paginacion.png`)})
     }
     results.push({phase,view:view.name,width,height,file,...proof})
    }
    if(phase==='despues'){
     const next=page.waitForResponse(response=>{const u=new URL(response.url());return u.pathname===`/rest/v1/${view.resource}`&&u.searchParams.get('offset')===String(view.size)})
     await page.getByRole('navigation',{name:view.nav}).getByRole('button',{name:'Página siguiente'}).click()
     const response=await next;const rows=await response.json()
     await page.waitForFunction(label=>document.querySelector(`nav[aria-label="${label}"]`)?.getAttribute('aria-busy')==='false',view.nav)
     if(rows.length!==view.size||!response.ok())throw new Error(`Invalid second page ${view.name}`)
     results.push({phase,view:view.name,pageNavigation:true,rows:rows.length,firstId:rows[0].id,lastId:rows.at(-1).id})
    }
   }
   await Promise.all(pending)
   results.push({phase,role,pageErrors:errors,requestFailures:failures,consoleErrors,requests})
   if(phase==='despues'&&(errors.length||failures.length||consoleErrors.length||requests.some(r=>r.status>=400)))throw new Error('Browser errors after pagination')
   await context.close()
  }
 }
}finally{
 await browser.close()
 writeFileSync(resolve(out,'visual.json'),JSON.stringify(results,null,2)+'\n')
}
console.log(JSON.stringify(results.filter(r=>r.width||r.pageNavigation||r.pageErrors).map(r=>({...r,requests:undefined})),null,2))
