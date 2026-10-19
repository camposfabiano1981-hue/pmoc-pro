import type { Execucao, OS, Rotina } from '../db/types';
import { OS_FINALIZADAS } from './catalogs';
import { projetar } from './rotinas';

/** Situação de uma rotina em uma data (legenda do PMOC e do cronograma). */
export type Marca = 'P' | 'R' | 'E' | 'N';

export const MARCAS: Record<Marca, { label: string; desc: string; cls: string; cor: string; texto: string }> = {
  P: { label: 'Programado', desc: 'Previsto pela periodicidade do equipamento ou com OS gerada', cls: 'bg-blue-600 text-white', cor: '#2563eb', texto: '#ffffff' },
  R: { label: 'Reprogramado', desc: 'Data alterada em relação à programação original', cls: 'bg-yellow-400 text-yellow-950', cor: '#facc15', texto: '#422006' },
  E: { label: 'Executado', desc: 'Lançado como executado (E) pela equipe técnica', cls: 'bg-green-600 text-white', cor: '#16a34a', texto: '#ffffff' },
  N: { label: 'Não executado', desc: 'Lançado como N/pendente ou com a data vencida sem execução', cls: 'bg-red-600 text-white', cor: '#dc2626', texto: '#ffffff' },
};

export const ORDEM_MARCAS: Marca[] = ['P', 'R', 'E', 'N'];
const PRIORIDADE: Marca[] = ['E', 'N', 'R', 'P'];

export interface Programacao {
  osId: string;
  data: string;
  numero: string;
  reprogramada: boolean;
}

/** Rotinas presentes em OS abertas (programadas), por rotina. */
export function programacoesAbertas(oss: OS[]): Map<string, Programacao[]> {
  const m = new Map<string, Programacao[]>();
  for (const o of oss) {
    if (OS_FINALIZADAS.includes(o.status)) continue;
    const data = o.dataAgendada || o.dataAbertura.slice(0, 10);
    const reprogramada = !!o.dataOriginal && o.dataOriginal !== data;
    for (const it of o.equipamentos)
      for (const c of it.checklist) if (c.rotinaId) (m.get(c.rotinaId) || m.set(c.rotinaId, []).get(c.rotinaId)!).push({ osId: o.id, data, numero: o.numero, reprogramada });
  }
  return m;
}

export interface CelulaMarca {
  m: Marca;
  n: number;
  info: string[];
}

/**
 * Marca cada data (ou mês, conforme `chave`) da rotina no intervalo:
 * executado e não executado vêm do histórico; datas previstas e OS abertas contam como
 * programadas (ou reprogramadas); data passada sem execução conta como não executada.
 */
export function marcarRotina(
  r: Rotina,
  o: { de: string; ate: string; hoje: string; execs?: Execucao[]; programadas?: Programacao[]; chave?: (d: string) => string },
): Record<string, CelulaMarca> {
  const chave = o.chave || ((d: string) => d);
  const out: Record<string, CelulaMarca> = {};
  const put = (d: string, m: Marca, info: string) => {
    const k = chave(d);
    const atual = out[k];
    if (!atual) out[k] = { m, n: 1, info: [info] };
    else {
      atual.n++;
      atual.info.push(info);
      if (PRIORIDADE.indexOf(m) < PRIORIDADE.indexOf(atual.m)) atual.m = m;
    }
  };
  const progs = o.programadas || [];
  for (const d of projetar(r, o.de, o.ate)) {
    // a data devida que já está em OS aberta é representada pela própria OS
    if (d === r.proximaExecucao && progs.length) continue;
    if (d < o.hoje) put(d, 'N', 'Vencida sem execução');
    else if (d === r.proximaExecucao && r.reprogramada) put(d, 'R', 'Reprogramada');
    else put(d, 'P', 'Prevista pela periodicidade');
  }
  for (const p of progs) {
    if (p.data < o.de || p.data > o.ate) continue;
    if (p.data < o.hoje) put(p.data, 'N', `OS ${p.numero} vencida sem execução`);
    else put(p.data, p.reprogramada || r.reprogramada ? 'R' : 'P', `OS ${p.numero}${p.reprogramada ? ' reprogramada' : ''}`);
  }
  for (const e of o.execs || []) {
    if (e.rotinaId !== r.id || e.data < o.de || e.data > o.ate) continue;
    put(e.data, e.status === 'E' ? 'E' : 'N', e.status === 'E' ? 'Executada' : e.status === 'N' ? `Não executada${e.obs ? ': ' + e.obs : ''}` : 'Pendente');
  }
  return out;
}
