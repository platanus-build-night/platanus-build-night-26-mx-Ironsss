import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/platanus-build-night-26-mx-Ironsss/',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
