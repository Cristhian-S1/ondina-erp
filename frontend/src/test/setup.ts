import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// Q1 2026-10-14 (OND-c07.19): el presupuesto por defecto de 1 s de findBy*/waitFor
// produjo falsos fallos bajo saturación de CPU (medido: 1/15 corridas con carga
// falló en findByRole con el HTML correcto, a escala ~3x de latencia). 3 s mantiene
// los fallos reales ágiles y amortigua la necesidad de esperas arbitrarias.
configure({ asyncUtilTimeout: 3000 })

vi.stubGlobal('__APP_VERSION__', 'dev')

// jsdom lacks the native modal lifecycle; browsers provide inertness and Escape.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
  this.querySelector<HTMLElement>('[autofocus], button, input, select, textarea, [tabindex]')?.focus()
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}

afterEach(() => {
  cleanup()
})
