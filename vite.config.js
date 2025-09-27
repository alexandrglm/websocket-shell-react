// ============================================
// vite.config.js
// ============================================
/*
 * Revisar port / host en prod (Render suele admitir de todo)
 *
 * sourcemaps en false para seguridad, pero desactivalo en dev si necesario
 * 
 * 
*/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({

  plugins: [react()],
    define: {
      global: 'globalThis',
      'process.env': {
        REACT_APP_SHELL_URI: JSON.stringify(process.env.REACT_APP_SHELL_URI)
      }
    },
  server: {
    // revisar port en render o heroku
    port: 7777,
    host: '0.0.0.0',
    proxy: {
      '/socket.io': 'http://localhost:3001',
      '/status': 'http://localhost:3001',
      '/auth': 'http://localhost:3001'
    }
  
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client']
        }
      }
    }
  }
})