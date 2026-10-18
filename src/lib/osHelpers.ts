import { db, movimentarEstoque, nextNumber, nowIso, uid } from '../db/db';
import type { Contrato, OS, Prioridade } from '../db/types';
import { OS_FINALIZADAS, PRIORIDADES } from './catalogs';
import { addHours, dateStr, diffHours, localDateTimeStr, todayStr } from './format';

export function prazoSla(prioridade: Prioridade, contrato?: Contrato, base = new Date()): string {
  const h =
    (contrato &&
      { urgente: contrato.slaUrgenteH, alta: contrato.slaAltaH, media: contrato.slaMediaH, baixa: contrato.slaBaixaH }[prioridade]) ||
    PRIORIDADES.find((p) => p.value === prioridade)!.horasPadrao;
  return dateStr(addHours(base, h));
}

export function novaOS(partial: Partial<OS> = {}): OS {
  const ts = nowIso();
  return {
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
    numero: '',
    tipo: 'Corretiva',
    prioridade: 'media',
    status: 'aberta',
    origem: 'manual',
    titulo: '',
    tecnicosIds: [],
    dataAbertura: ts,
    dataAgendada: todayStr(),
    equipamentos: [],
    pecas: [],
    servicos: [],
    apontamentos: [],
    fotos: [],
    historico: [{ data: ts, texto: 'OS criada' }],
    ...partial,
  };
}

export async function criarOS(os: OS): Promise<OS> {
  const rec = { ...os, numero: os.numero || (await nextNumber('os')) };
  await db.os.put(rec);
  return rec;
}

export function isAtrasada(os: OS, hoje = todayStr()): boolean {
  if (OS_FINALIZADAS.includes(os.status)) return false;
  const limite = os.prazo || os.dataAgendada;
  return !!limite && limite < hoje;
}

/** Horas trabalhadas (homem-hora) a partir dos apontamentos. */
export function horasTrabalhadas(os: OS): number {
  return os.apontamentos.reduce((acc, a) => {
    const h = diffHours(a.fim || (os.status === 'em_execucao' ? localDateTimeStr() : a.inicio), a.inicio);
    return acc + Math.max(0, h || 0);
  }, 0);
}

/** Dá baixa no estoque das peças da OS ainda não baixadas. */
export async function baixarPecas(os: OS): Promise<OS> {
  const pecas = [...os.pecas];
  for (let i = 0; i < pecas.length; i++) {
    const p = pecas[i];
    if (!p.pecaId || p.baixado || !p.quantidade) continue;
    await movimentarEstoque({ pecaId: p.pecaId, tipo: 'saida', quantidade: p.quantidade, custoUnit: p.custoUnit, data: todayStr(), osId: os.id, documento: os.numero });
    pecas[i] = { ...p, baixado: true };
  }
  return { ...os, pecas };
}

export const MEDICOES_CAMPOS: { key: keyof OS['equipamentos'][number]['medicoes']; label: string; unidade: string }[] = [
  { key: 'tensao', label: 'Tensão', unidade: 'V' },
  { key: 'corrente', label: 'Corrente', unidade: 'A' },
  { key: 'tRetorno', label: 'T. retorno', unidade: '°C' },
  { key: 'tInsuflamento', label: 'T. insuflamento', unidade: '°C' },
  { key: 'tExterna', label: 'T. externa', unidade: '°C' },
  { key: 'umidade', label: 'UR ambiente', unidade: '%' },
  { key: 'pSuccao', label: 'P. sucção', unidade: 'psig' },
  { key: 'tLinhaSuccao', label: 'T. linha sucção', unidade: '°C' },
  { key: 'pDescarga', label: 'P. descarga', unidade: 'psig' },
  { key: 'tLinhaLiquido', label: 'T. linha líquido', unidade: '°C' },
];
