import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite already exposes every VITE_-prefixed variable as `import.meta.env.VITE_*`,
 * so the previous `define` block that hand-injected them into `process.env` is
 * no longer needed. Keeping it risked shipping a server-only variable to the
 * browser if someone added one to the list by mistake.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Split the largest vendor libraries out of the main bundle so a change to
    // application code does not invalidate all ~1.2 MB for returning visitors.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['motion'],
        },
      },
    },
  },
});
