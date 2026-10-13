import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

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
