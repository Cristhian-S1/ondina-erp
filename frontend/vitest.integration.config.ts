import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Suite de integración (B5, issue #43): recorridos por rol contra un Supabase
// local aislado. No reemplaza la suite unitaria: incluye solo `*.journey.ts`
// para que `vitest run` (config por defecto) no los recoja.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.journey.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
})
