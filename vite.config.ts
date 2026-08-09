/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // PORT lets a second dev server run beside a first one without editing this
    // file; 5173 stays the default when nothing sets it.
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    open: true
    },
  test: {
    // Tests live next to what they test, as `*.test.ts`.
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
