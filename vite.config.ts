/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: true
    },
  test: {
    // Tests live next to what they test, as `*.test.ts`.
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
