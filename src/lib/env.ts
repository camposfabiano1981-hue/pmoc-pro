/** Build de demonstração embutida (sem impressão/downloads): VITE_EMBED=1 */
export const IS_EMBED = import.meta.env.VITE_EMBED === '1';
/** Carrega os dados de demonstração automaticamente no primeiro acesso: VITE_DEMO=1 */
export const AUTO_DEMO = import.meta.env.VITE_DEMO === '1';

export function aviso(texto: string): void {
  window.dispatchEvent(new CustomEvent('pmoc-aviso', { detail: texto }));
}

export function imprimir(): void {
  if (IS_EMBED) aviso('Impressão e PDF ficam disponíveis na versão instalada (GitHub Pages ou npm run dev).');
  else window.print();
}
