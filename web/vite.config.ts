import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api calls go to the FastAPI app (uvicorn on port 8000).
// The same /api paths are used in production, so the front end never needs a different URL.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
