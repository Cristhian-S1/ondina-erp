// Optional real-browser regression checks; see C3C-entrega.md for invocation.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')


const base = process.env.ONDINA_URL ?? 'http://127.0.0.1:5196'
assert.equal(new URL(base).hostname, '127.0.0.1', 'This check targets local fixtures only')
const captures = process.env.C3C_CAPTURE_DIR
if (captures) mkdirSync(captures, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' })
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-CL' })
const page = await context.newPage()
const errors = [], writes = [], results = []
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => {
  if (request.url().includes('/rest/v1/') && request.method() !== 'GET') writes.push(request.url())
})
try {
  await page.goto(base)
  await page.getByLabel('Email', { exact: true }).fill('ux-produccion@example.invalid')
  await page.getByLabel('Contraseña', { exact: true }).fill('ux-local-2026')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL(url => !url.pathname.includes('login'))
  for (const [width, height] of [[360, 800], [375, 812], [412, 915], [768, 1024], [1024, 1366], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    for (const view of ['registrar', 'historial', 'indicadores', 'incidencias']) {
      await page.goto(`${base}/produccion/${view}`)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && !document.body.textContent.includes('Cargando productos...'))
      const mobile = width < 640
      if (view === 'incidencias') {
        assert.equal(await page.getByRole('tablist').count(), mobile ? 1 : 0, 'C3-09 mobile tabs only')
        if (mobile) {
          assert.equal(await page.getByRole('tabpanel').count(), 1)
          assert.equal(await page.getByRole('button', { name: 'Registrar merma', exact: true }).isVisible(), false)
          await page.getByRole('tab', { name: 'Mermas', exact: true }).click()
          assert.equal(await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).isVisible(), false)
        } else {
          assert.equal(await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).isVisible(), true)
          assert.equal(await page.getByRole('button', { name: 'Registrar merma', exact: true }).isVisible(), true)
        }
        await page.locator('#campo-merma-producto').selectOption({ index: 1 })
        await page.getByText(/^Disponible: [\d.]+$/).waitFor()
        const quantity = page.locator('#campo-merma-cantidad')
        await quantity.fill('9999999')
        assert.equal(await quantity.getAttribute('aria-invalid'), 'true', 'C3-12 live stock validation')
        assert.match(await quantity.getAttribute('aria-describedby'), /campo-merma-cantidad-error/)
        assert.equal(await quantity.inputValue(), '9.999.999', 'Excess quantity is preserved')
        await page.getByText(/^Excede el stock en bodega:/).waitFor()
        // No write is needed to test the stock limit.
      }
      const metrics = await page.evaluate(() => {
        const visible = element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0
        const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
        const rows = [...document.querySelectorAll('[data-testid="tarjeta-registro"]')].filter(visible)
        const numericRows = rows.filter(row => row.tagName === 'TR')
        const cards = numericRows.map(row => [...row.querySelectorAll('td')].map(cell => ({ ...box(cell), font: getComputedStyle(cell).fontSize, label: box(cell.querySelector('span')) })))
        const kpis = [...document.querySelectorAll('article')].filter(visible).map(box)
        const dates = [...document.querySelectorAll('input[type="date"]')].map(box)
        const small = [...document.querySelectorAll('main button, main input, main select, main textarea, [role="tab"]')].filter(visible).map(box).filter(r => r.width < 44 || r.height < 44)
        return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, documentHeight: document.documentElement.scrollHeight, small, cards, kpis, dates }
      })
      assert.ok(metrics.scrollWidth <= width, `${view}/${width}: no horizontal overflow`)
      assert.deepEqual(metrics.small, [], `${view}/${width}: 44px controls`)
      if (view === 'registrar' || view === 'historial') {
        assert.ok(metrics.dates.every(date => date.width >= 140), `C3-07 ${view}/${width}: date text has space`)
        assert.ok(Math.abs(metrics.dates[0].y - metrics.dates[1].y) < 2, 'C3-07 Desde/Hasta on one row')
      }
      if (mobile && (view === 'historial' || view === 'incidencias')) {
        assert.ok(metrics.cards.length, 'C3-06 requires populated local fixtures')
        for (const row of metrics.cards) {
          assert.ok(Math.abs(row[1].y - row[2].y) < 5, 'C3-06 product and quantity share row')
          assert.equal(row[3].font, '12px', 'C3-06 free text is metadata')
          assert.ok(row[3].label.width <= 1, 'C3-06 metadata label visually hidden')
        }
      }
      if (view === 'indicadores' && mobile) {
        assert.equal(metrics.kpis.length, 2)
        assert.ok(Math.abs(metrics.kpis[0].y - metrics.kpis[1].y) < 2, 'C3-08 KPIs share row from 360px')
        assert.ok(metrics.cards.length, 'C3-08 requires populated local fixtures')
        for (const row of metrics.cards) assert.ok(Math.abs(row[1].y - row[2].y) < 2, 'C3-08 units and records share row')
      }
      results.push({ view, viewport: `${width}x${height}`, ...metrics })
      const capture = (width === 412 && ['historial', 'indicadores', 'incidencias'].includes(view)) || (width === 768 && view === 'incidencias') || (width === 1024 && view === 'historial') || (width === 1280 && view === 'registrar')
      if (captures && capture) await page.screenshot({ path: `${captures}/${view}-${width}x${height}-despues.png` })
    }
  }
  assert.deepEqual(errors, [], 'No runtime exceptions')
  assert.deepEqual(writes, [], 'No database writes')
  if (process.env.C3C_RESULT) writeFileSync(process.env.C3C_RESULT, JSON.stringify({ results, errors, writes }, null, 2))
  console.log(`PASS: ${results.length} view/viewport checks; no overflow, small controls, runtime exceptions or database writes`)
} finally {
  await browser.close()
}
