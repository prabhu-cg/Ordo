import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

/**
 * The security headers live in vercel.json, which is what production serves. The local preview serves the same
 * ones, so the tests run against the real policy and a blocked script or style shows up before release.
 */
const vercel = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8'),
) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const securityHeaders = Object.fromEntries(
  (vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely, the app often. Keeping them in their own files means a new release does not make
        // people download React, Radix or Dexie again, and no single file is large.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 40,
            },
            { name: 'radix', test: /node_modules[\\/]@radix-ui[\\/]/, priority: 30 },
            { name: 'dnd', test: /node_modules[\\/]@dnd-kit[\\/]/, priority: 30 },
            { name: 'data', test: /node_modules[\\/](dexie|zod)[\\/]/, priority: 30 },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { headers: securityHeaders },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
