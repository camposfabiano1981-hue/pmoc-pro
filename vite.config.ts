import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite publicar em qualquer subcaminho (ex.: usuario.github.io/pmoc-pro/)
export default defineConfig({
  base: './',
  plugins: [react()],
  // saída somente ASCII (caracteres especiais viram escapes \uXXXX): evita problemas de codificação
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
