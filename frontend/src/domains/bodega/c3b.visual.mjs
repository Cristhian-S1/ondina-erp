import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Local-only browser regression using the existing synthetic C3 return fixture.
// Point C3B_PLAYWRIGHT_MODULE at an installed module if Playwright is not in node_modules.
const { chromium } = await import(process.env.C3B_PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.C3B_BASE_URL ?? 'http://127.0.0.1:5183'
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/)
const stage = process.argv[2] ?? 'despues'
assert.ok(['antes', 'despues'].includes(stage))
const out = fileURLToPath(new URL('../../../../docs/archive/audits/2026-10-14/frontend-movil/capturas/C3B/', import.meta.url))
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' })
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-CL' })
const page = await context.newPage()
const errors = []
const writes = []
const failures = []
const results = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`))
page.on('request', request => {
  if (/rest\/v1/.test(request.url()) && request.method() !== 'GET' && !request.url().includes('rpc/vendedores_sucursal')) {
    writes.push(request.url())
  }
})

async function inspectTargets(root) {
  return root.locator('button, input, select, a[href]').evaluateAll(elements => elements
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    .map(element => ({
      name: element.getAttribute('aria-label') || element.textContent?.trim() || element.id,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })))
}

async function overflow() {
  return page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }))
}

try {
  await page.goto(base)
  await page.getByLabel('Email', { exact: true }).fill('ux-bodega@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('ux-local-2026')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL(url => !url.pathname.includes('login'))

  for (const [width, height] of [[412, 915], [375, 812], [768, 1024], [1024, 1366], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await page.goto(`${base}/despachos`)
    await page.getByRole('button', { name: 'Nuevo despacho', exact: true }).waitFor()
    await page.locator('button[aria-controls^="despacho-"]').first().waitFor()
    const list = await page.locator('main').innerText()
    const listTargets = await inspectTargets(page.locator('main'))
    if (width === 1280) await page.screenshot({ path: `${out}/despachos-${width}x${height}-${stage}.png` })

    await page.getByRole('button', { name: 'Nuevo despacho', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#despacho-vendedor').selectOption({ label: 'Valentina Rojas' })
    await dialog.locator('select[id^="despacho-producto-"]').first().selectOption({ index: 1 })
    const quantityInput = dialog.getByLabel('Cantidad', { exact: true }).first()
    await quantityInput.fill('9999999')
    await quantityInput.blur()
    const quantity = await quantityInput.evaluate(element => {
      const style = getComputedStyle(element)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      ctx.font = style.font
      return {
        value: element.value,
        width: element.getBoundingClientRect().width,
        usable: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        needed: ctx.measureText(element.value).width,
      }
    })
    const modalTargets = await inspectTargets(dialog)
    if ([412, 768].includes(width)) await page.screenshot({ path: `${out}/despacho-modal-${width}x${height}-${stage}.png` })
    const modalOverflow = await overflow()

    await page.goto(`${base}/devoluciones`)
    // Fixed existing dispatch: stable before/after even if other workers add test fixtures.
    await page.locator('main button').filter({ hasText: '#753b571b' }).first().click()
    const region = page.getByRole('region', { name: 'Productos del despacho' })
    await region.waitFor()
    const returned = await region.innerText()
    const header = await region.locator('h3').evaluate(element => ({
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
      width: element.getBoundingClientRect().width,
    }))
    const returnTargets = await inspectTargets(page.locator('main'))
    const returnOverflow = await overflow()
    if ([412, 1024].includes(width)) {
      await region.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${out}/devolucion-${width}x${height}-${stage}.png` })
    }
    results.push({ width, height, quantity, header, returned, listHasVN: /\bVN\b/.test(list), modalOverflow, overflow: returnOverflow })
    if (quantity.value !== '9.999.999' || quantity.usable < quantity.needed) failures.push(`C3-03 ${width}: numeric value clipped`)
    if (header.height > header.lineHeight + 1) failures.push(`C3-04 ${width}: section title wraps`)
    if (!/Devuelto 1/.test(returned) || /Disponible/.test(returned)) failures.push(`C3-04 ${width}: ambiguous return`)
    if (/\bVN\b/.test(list)) failures.push(`C3-05 ${width}: misleading VN avatar`)
    for (const target of [...listTargets, ...modalTargets, ...returnTargets]) {
      if (target.width < 44 || target.height < 44) failures.push(`Touch target ${width}: ${JSON.stringify(target)}`)
    }
    for (const value of [modalOverflow, returnOverflow]) {
      if (value.scroll > value.viewport) failures.push(`Overflow ${width}`)
    }
  }
} finally {
  await browser.close()
}

const evidence = { results, errors, writes, failures }
writeFileSync(`/tmp/c3b-${stage}.json`, JSON.stringify(evidence, null, 2))
console.log(JSON.stringify(evidence))
assert.deepEqual(errors, [], 'Browser errors')
assert.deepEqual(writes, [], 'Unexpected database mutation')
assert.deepEqual(failures, [], 'C3-B visual regression')
