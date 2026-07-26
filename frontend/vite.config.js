import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// Generate a version file during build to bypass CDN cache
const buildTime = Date.now().toString();
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}
fs.writeFileSync('public/version.json', JSON.stringify({ version: buildTime }));

// https://vite.dev/config/
export default defineConfig({
  base: '/monster-arena-web/',
  plugins: [
    tailwindcss(),
    react()
  ],
  define: {
    '__APP_VERSION__': JSON.stringify(buildTime)
  }
})
