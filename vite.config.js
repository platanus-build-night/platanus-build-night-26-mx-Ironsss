import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/rehab-motion/',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
