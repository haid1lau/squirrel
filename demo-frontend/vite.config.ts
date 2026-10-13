import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // The demo needs no server: src/demo/server.ts answers the API calls in the browser.
  plugins: [react(), tailwindcss()],
})
