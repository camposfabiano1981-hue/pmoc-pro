import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ensureBase } from './db/seed';
import './index.css';

// aplica o tema salvo antes do primeiro render (evita "piscar")
try {
  const t = localStorage.getItem('pmoc-theme') || document.documentElement.getAttribute('data-theme');
  const dark = t ? t === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', !!dark);
} catch {
  /* armazenamento indisponível */
}

ensureBase()
  .catch((e) => console.error('Falha ao inicializar o banco local', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });

// PWA: funciona offline em campo (apenas em produção e fora de iframes)
if ('serviceWorker' in navigator && import.meta.env.PROD && window.self === window.top && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
