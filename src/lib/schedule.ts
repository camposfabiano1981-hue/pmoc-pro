import type { AtividadePlano, Equipamento, ItemChecklist, ItemOsEquip, OS, Periodicidade, PlanoManutencao } from '../db/types';
import { PERIODICIDADES } from './catalogs';

/** Índice absoluto de mês (ano*12 + mês0) — permite cálculo entre anos. */
export const monthIndex = (year: number, month0: number) => year * 12 + month0;

export function monthIndexFromStr(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return monthIndex(Number(m[1]), Number(m[2]) - 1);
}

/**
 * Indica se uma atividade com determinada periodicidade é devida no mês alvo,
 * considerando o mês de início do plano como referência (mês da 1ª execução).
 */
export function isDue(per: Periodicidade, target: number, start: number): boolean {
  const p = PERIODICIDADES.find((x) => x.value === per);
  if (!p || p.value === 'na') return false;
  if (p.meses === 0) return true; // diária, semanal, quinzenal: todo mês
  if (target < start) return false;
  return (target - start) % p.meses === 0;
}

export function vezesNoMes(per: Periodicidade): number {
  return PERIODICIDADES.find((x) => x.value === per)?.vezesMes ?? 0;
}

export function atividadesDevidas(plano: PlanoManutencao | undefined, target: number, start: number): AtividadePlano[] {
  if (!plano) return [];
  return plano.atividades.filter((a) => isDue(a.periodicidade, target, start));
}

/** Horas planejadas de um plano em um mês (considera repetições de diária/semanal/quinzenal). */
export function horasPlanejadas(plano: PlanoManutencao | undefined, target: number, start: number): number {
  return atividadesDevidas(plano, target, start).reduce((acc, a) => acc + (a.tempoMin * vezesNoMes(a.periodicidade)) / 60, 0);
}

export function checklistDe(atividades: AtividadePlano[]): ItemChecklist[] {
  return atividades.map((a) => ({
    atividadeId: a.id,
    grupo: a.grupo,
    descricao: a.descricao,
    periodicidade: a.periodicidade,
    tipo: a.tipo,
    unidade: a.unidade,
    min: a.min,
    max: a.max,
    resultado: '',
    valor: '',
    obs: '',
  }));
}

export function itemEquipamento(equip: Equipamento, plano: PlanoManutencao | undefined, target: number | null, start: number): ItemOsEquip {
  const atividades = plano ? (target === null ? plano.atividades.filter((a) => a.periodicidade !== 'na') : atividadesDevidas(plano, target, start)) : [];
  return { equipamentoId: equip.id, checklist: checklistDe(atividades), medicoes: {}, obs: '', concluido: false };
}

/** Matriz anual atividade × mês (para o plano/cronograma do PMOC). */
export function matrizAnual(plano: PlanoManutencao, year: number, startIdx: number): boolean[][] {
  return plano.atividades.map((a) => Array.from({ length: 12 }, (_, m) => isDue(a.periodicidade, monthIndex(year, m), startIdx)));
}

/** Situação de um equipamento em um mês para o cronograma de execução. */
export type SituacaoMes = 'nao_programado' | 'programado' | 'executado' | 'atrasado' | 'em_andamento';

export function situacaoMes(
  equipId: string,
  plano: PlanoManutencao | undefined,
  year: number,
  month0: number,
  startIdx: number,
  osList: OS[],
  hoje = new Date(),
): SituacaoMes {
  const target = monthIndex(year, month0);
  const devido = atividadesDevidas(plano, target, startIdx).length > 0;
  const key = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  const doMes = osList.filter(
    (o) =>
      o.status !== 'cancelada' &&
      o.tipo === 'Preventiva' &&
      o.equipamentos.some((e) => e.equipamentoId === equipId) &&
      ((o.preventivaRef && o.preventivaRef.includes(`|${key}|`)) || (o.dataAgendada || o.dataAbertura).startsWith(key)),
  );
  const exec = doMes.some((o) => o.status === 'concluida' || o.status === 'validada');
  if (exec) return 'executado';
  if (!devido && doMes.length === 0) return 'nao_programado';
  const hojeIdx = monthIndex(hoje.getFullYear(), hoje.getMonth());
  if (doMes.some((o) => o.status === 'em_execucao')) return 'em_andamento';
  if (target < hojeIdx) return 'atrasado';
  return 'programado';
}

/** Avalia valor medido vs. faixa (min/max). */
export function foraDaFaixa(valor: string | undefined, min?: number, max?: number): boolean {
  if (valor === undefined || valor === '') return false;
  const v = Number(String(valor).replace(',', '.'));
  if (!isFinite(v)) return false;
  if (min !== undefined && v < min) return true;
  if (max !== undefined && v > max) return true;
  return false;
}
