import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter = the dist/ folder works on any static host
// (GitHub Pages, Cloudflare Pages, or just opening from a file server)
// with zero server configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
})
