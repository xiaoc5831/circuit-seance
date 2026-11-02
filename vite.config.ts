import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  base: process.env.VITE_BASE_URL || '/',
  assetsInclude: ['**/*.net', '**/*.sp'],
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
