import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const vercelConfig = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const previewHeaders = Object.fromEntries(
  vercelConfig.headers.filter((entry) => entry.source === '/(.*)').flatMap((entry) => entry.headers.map(({ key, value }) => [key, value])),
)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
  },
  preview: { headers: previewHeaders },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Evita que los imports del shell fusionen Supabase con la entrada (A1-16).
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              includeDependenciesRecursively: true,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
