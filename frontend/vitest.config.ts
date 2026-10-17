import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Q1 2026-10-14 (OND-c07.19): el timeout por defecto de 5 s produjo falsos fallos
    // en blanco cuando la máquina está saturada (medido: con loadavg ≈ 31, varios
    // tests superaron los 5 s sin ser defectuosos; 1/1 corridas con 6 pruebas
    // >5 s y 13/15 verdes en el mismo bucle con carga). 15 s sigue fallando rápido
    // ante colgadas reales y absorbe la latencia de spawnSync/compilación.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      // Solo tabla en consola: evita artefactos que ESLint no ignora (coverage/ está en .gitignore)
      reporter: ['text'],
      // Mide todo src; los archivos sin importar en pruebas también cuentan (TEST-02)
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/types/database-generated.types.ts',
      ],
      // Umbral global conservador: medido 2026-10-13 (líneas 70,12 %, ramas 59,68 %)
      thresholds: {
        lines: 69,
        branches: 58,
        functions: 60,
        statements: 66,
      },
    },
  },
})
