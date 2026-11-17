import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/fortune-cookies/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { app: resolve(import.meta.dirname, 'index.html'), model: resolve(import.meta.dirname, 'model.html') },
      output: {
        manualChunks: { react: ['react', 'react-dom', 'scheduler'] },
      },
    },
  },
});
