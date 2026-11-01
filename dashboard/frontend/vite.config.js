import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'      // keep your existing react line
import tailwindcss from '@tailwindcss/vite'   // NEW: Tailwind plugin

export default defineConfig({
  plugins: [react(), tailwindcss()],          // NEW: add tailwindcss()
})