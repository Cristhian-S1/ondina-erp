const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
import{writeFileSync}from'node:fs'
const out='docs/archive/audits/2026-10-14/frontend-movil/capturas/P2'
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:375,height:812},timezoneId:'America/Santiago'})
const product='e2a00710-0001-4000-8000-000000000001',ids=new Set(),offsets=[]
const label='Paginación del historial de producción'
try{
 await page.goto('http://127.0.0.1:5187');await page.locator('#login-email').fill('ux-admin-global@example.invalid');await page.locator('#login-password').fill('ux-local-2026');await page.locator('button[type=submit]').click();await page.waitForURL(u=>!u.pathname.includes('login'))
 await page.goto('http://127.0.0.1:5187/produccion/historial');await page.getByRole('combobox',{name:/^Sucursal/}).selectOption('10000000-0000-0000-0000-000000000002')
 await page.getByRole('navigation',{name:label}).waitFor()
 const request=(offset)=>page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/rest/v1/producciones'&&u.searchParams.get('producto_id')===`eq.${product}`&&u.searchParams.get('offset')===String(offset)})
 let responsePromise=request(0)
 await page.getByRole('combobox',{name:/^Producto/}).selectOption(product)
 let response=await responsePromise
 for(let current=1;current<=30;current++){
  const rows=await response.json();rows.forEach(r=>ids.add(r.id));offsets.push((current-1)*10)
  await page.waitForFunction(label=>document.querySelector(`nav[aria-label="${label}"]`)?.getAttribute('aria-busy')==='false',label)
  if(current<30){responsePromise=request(current*10);await page.getByRole('navigation',{name:label}).getByRole('button',{name:'Página siguiente'}).click();response=await responsePromise}
 }
 const nav=page.getByRole('navigation',{name:label})
 const lastStatus=await nav.innerText()
 const disabled=await nav.getByRole('button',{name:'Página siguiente'}).isDisabled()
 if(ids.size!==300||!disabled||!lastStatus.includes('Página 30 de 30'))throw new Error('Incomplete traversal')
 await nav.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/historial-375x812-ultima.png`})
 await page.getByRole('combobox',{name:/^Producto/}).selectOption('')
 await page.waitForFunction(label=>document.querySelector(`nav[aria-label="${label}"]`)?.textContent.includes('Página 1 de'),label)
 const result={syntheticProduct:product,pages:30,uniqueIds:ids.size,offsets,lastStatus,nextDisabled:disabled,resetAfterClearingProduct:await nav.innerText()}
 writeFileSync(`${out}/recorrido-historial.json`,JSON.stringify(result,null,2)+'\n');console.log(result)
}finally{await browser.close()}
