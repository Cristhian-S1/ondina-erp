// Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module if needed.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const out = resolve(process.argv[2] ?? '../docs/archive/audits/2026-10-14/frontend-movil/capturas/P1')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const results = []
try {
  for (const [phase, url] of [['antes', 'http://127.0.0.1:5178'], ['despues', 'http://127.0.0.1:5177']]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    const responses = []
    const requestFailures = []
    const consoleErrors = []
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 250)) })
    page.on('requestfailed', request => {
      const parsed = new URL(request.url())
      requestFailures.push({ path: parsed.pathname, failure: request.failure()?.errorText })
    })
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
      if (response.url().includes('/rest/v1/')) responses.push({ url: response.url().replace(/http:\/\/127\.0\.0\.1:54321/, ''), status: response.status() })
    })
    await page.goto(url)
    await page.locator('#login-email').fill('ux-bodega@example.invalid')
    await page.locator('#login-password').fill('ux-local-2026')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(u => !u.pathname.includes('login'))
    for (const [view, heading] of [['despachos', 'Despachos'], ['devoluciones', 'Devoluciones']]) {
      await page.goto(`${url}/${view}`)
      if (phase === 'antes') await page.getByRole('button', { name: 'Reintentar' }).waitFor()
      else {
        await page.getByRole('heading', { name: heading, exact: true }).waitFor()
        await page.getByRole('navigation', { name: 'Paginación de despachos' }).waitFor()
        await page.waitForFunction(() => document.querySelector('nav[aria-label="Paginación de despachos"]')?.getAttribute('aria-busy') === 'false')
      }
      for (const [width, height] of [[412, 915], [375, 812], [768, 1024], [1024, 1366], [1280, 800]]) {
        await page.setViewportSize({ width, height })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'))
        const proof = await page.evaluate(() => {
          const pager = document.querySelector('nav[aria-label="Paginación de despachos"]')
          const targets = pager ? Array.from(pager.querySelectorAll('button')).map(button => {
            const rect = button.getBoundingClientRect()
            return { label: button.getAttribute('aria-label'), width: rect.width, height: rect.height, disabled: button.disabled }
          }) : []
          return { scrollWidth: document.documentElement.scrollWidth, innerWidth, pager: pager?.textContent, targets }
        })
        if (proof.scrollWidth > width) throw new Error(`Overflow ${phase} ${view} ${width}: ${proof.scrollWidth}`)
        if (proof.targets.some(t => t.width < 44 || t.height < 44)) throw new Error('Touch target below 44px')
        const file = `${view}-${width}x${height}-${phase}.png`
        await page.screenshot({ path: resolve(out, file), fullPage: true })
        if (phase === 'despues') {
          await page.getByRole('navigation', { name: 'Paginación de despachos' }).scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(out, `${view}-${width}x${height}-paginacion.png`) })
          await page.evaluate(() => window.scrollTo(0, 0))
        }
        results.push({ phase, view, width, height, file, ...proof })
      }
      if (phase === 'despues') {
        const nextResponse = page.waitForResponse(response => {
          const parsed = new URL(response.url())
          return parsed.pathname === '/rest/v1/despachos' && parsed.searchParams.get('offset') === '20'
        })
        await page.getByRole('button', { name: 'Página siguiente' }).click()
        const response = await nextResponse
        const secondRows = await response.json()
        await page.waitForFunction(() => document.querySelector('nav[aria-label="Paginación de despachos"]')?.getAttribute('aria-busy') === 'false')
        if (secondRows.length !== 20 || !response.ok()) throw new Error('Invalid server page 2')
        results.push({ phase, view, pageNavigation: true, secondRows: secondRows.length,
          secondFirstId: secondRows[0].id, secondLastId: secondRows.at(-1).id })
      }
    }
    results.push({ phase, pageErrors: errors, requestFailures, consoleErrors, failedApi: responses.filter(r => r.status >= 400),
      dispatchRequests: responses.filter(r => r.url.startsWith('/rest/v1/despachos?')),
      childRequests: phase === 'despues' ? responses.filter(r => /\/rest\/v1\/(despacho_detalles|despacho_envases|devoluciones_productos|devoluciones_envases)\?/.test(r.url)) : undefined })
    if (phase === 'despues') {
      if (errors.length || requestFailures.length || consoleErrors.length || responses.some(r => r.status >= 400)) throw new Error('Unexpected browser error after pagination')
      for (const response of responses.filter(r => /\/(despacho_detalles|despacho_envases|devoluciones_productos|devoluciones_envases)\?/.test(r.url))) {
        const ids = new URL(response.url, url).searchParams.get('despacho_id')
        if (ids?.startsWith('in.(') && ids.slice(4, -1).split(',').length > 20) throw new Error('Unbounded child request')
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
  writeFileSync(resolve(out, 'visual.json'), JSON.stringify(results, null, 2) + '\n')
}
console.log(JSON.stringify(results.filter(r => r.width || r.pageErrors || r.pageNavigation).map(r => ({ ...r, childRequests: undefined, dispatchRequests: undefined, failedApi: r.failedApi?.map(x => ({ status: x.status })) })), null, 2))
