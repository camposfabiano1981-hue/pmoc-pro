import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// identificação da versão publicada (commit + data do build), usada para avisar o usuário de atualizações
const commit = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();
const BUILD = new Date().toISOString();
const VERSAO = `${commit}-${BUILD.slice(0, 16).replace(/\D/g, '')}`;

/** Gera dist/version.json, consultado pelo app para detectar uma nova publicação. */
function versionJson(): Plugin {
  return {
    name: 'pmoc-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ versao: VERSAO, commit, build: BUILD }) });
    },
  };
}

// base './' permite publicar em qualquer subcaminho (ex.: usuario.github.io/pmoc-pro/)
export default defineConfig({
  base: './',
  plugins: [react(), versionJson()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSAO),
    __APP_BUILD__: JSON.stringify(BUILD),
  },
  // saída somente ASCII (caracteres especiais viram escapes \uXXXX): evita problemas de codificação
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
