import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow connections from other devices on network
    port: 3001,
    strictPort: true, // Don't switch to another port if 3001 is taken
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 300000, // 5 minute timeout for AI vision operations
        proxyTimeout: 300000,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - load first
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // MUI - large, load separately
          'mui-vendor': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
// Charts - only needed on dashboard
          'charts-vendor': ['recharts'],
        },
      },
    },
  },
  base: '/', // Firebase hosting serves from root
})
