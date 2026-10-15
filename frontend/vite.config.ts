import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
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

function inlineInitialCss(): Plugin {
  return {
    name: 'ondina-inline-initial-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        // Keep the external stylesheet if a future stricter CSP forbids inline CSS.
        const csp = previewHeaders['Content-Security-Policy'] ?? ''
        if (!/style-src\s+[^;]*'unsafe-inline'/.test(csp)) return html
        return html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (tag, href: string) => {
          const asset = context.bundle?.[href.replace(/^\//, '')]
          if (!asset || asset.type !== 'asset') return tag
          const css = typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)
          // Complete initial CSS is present before the first paint; no async style swap.
          return `<style data-bundle-css="${href}">${css}</style>`
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
  },
  preview: { headers: previewHeaders },
  build: {
    // A hidden drawer must not transfer the logo inside a shared JavaScript chunk.
    assetsInlineLimit: (filePath) => filePath.replaceAll('\\', '/').endsWith('/assets/logo.jpg') ? false : undefined,
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
  plugins: [react(), tailwindcss(), inlineInitialCss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
