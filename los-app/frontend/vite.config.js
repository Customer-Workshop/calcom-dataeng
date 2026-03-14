import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Manual chunk splitting for optimal caching and parallel loading.
    // Vendor chunks change rarely → long cache TTL.
    // Page chunks change with features → short cache TTL.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['recharts', 'lucide-react'],
          'vendor-state': ['zustand', 'axios'],
          'vendor-forms': ['react-hook-form'],
        },
      },
    },
    // Increase chunk size warning limit (dashboards are data-heavy)
    chunkSizeWarningLimit: 600,
    // Source maps for production debugging (disable for max performance)
    sourcemap: false,
    // Minify with esbuild (faster than terser)
    minify: 'esbuild',
    target: 'es2020',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
