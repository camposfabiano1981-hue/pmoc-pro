import { useEffect, useState } from 'react';
import { IS_EMBED } from './env';

export const VERSAO = __APP_VERSION__;
export const BUILD = __APP_BUILD__;

const INTERVALO = 5 * 60_000;

/** Consulta o version.json publicado e indica quando há uma versão mais nova que a carregada. */
export function useNovaVersao(): boolean {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || IS_EMBED || nova) return;
    let ativo = true;
    const checar = async () => {
      try {
        const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const v = (await r.json()) as { versao?: string };
        if (ativo && v.versao && v.versao !== VERSAO) setNova(true);
      } catch {
        /* sem conexão: tenta de novo depois */
      }
    };
    const aoVoltar = () => document.visibilityState === 'visible' && checar();
    checar();
    const t = window.setInterval(checar, INTERVALO);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      ativo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [nova]);
  return nova;
}

/** Descarta o cache do service worker e recarrega a página com a versão nova. */
export async function atualizarApp(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    const ks = (await window.caches?.keys()) || [];
    await Promise.all(ks.map((k) => caches.delete(k)));
  } finally {
    window.location.reload();
  }
}
