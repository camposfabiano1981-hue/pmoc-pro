import { db, movimentarEstoque, nextNumber, nowIso, uid } from '../db/db';
import type { Contrato, OS, Prioridade } from '../db/types';
import { OS_FINALIZADAS, PRIORIDADES } from './catalogs';
import { addHours, dateStr, diffHours, fmtDate, localDateTimeStr, todayStr } from './format';
import { estornarExecucoesDaOS, registrarExecucoesDaOS, statusItem } from './rotinas';

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

/** Tempo previsto da OS (min): informado ou soma do tempo previsto das tarefas. */
export function tempoPrevisto(os: OS): number {
  if (os.tempoPrevistoMin) return os.tempoPrevistoMin;
  return os.equipamentos.reduce((a, e) => a + e.checklist.reduce((s, c) => s + (c.tempoPrevistoMin || 0), 0), 0);
}

export function contagemTarefas(os: OS) {
  const all = os.equipamentos.flatMap((e) => e.checklist);
  const st = all.map(statusItem);
  return { total: all.length, E: st.filter((x) => x === 'E').length, P: st.filter((x) => x === 'P').length, N: st.filter((x) => x === 'N').length, vazias: st.filter((x) => !x).length };
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

export function comHistorico(os: OS, texto: string, usuario?: string): OS {
  return { ...os, historico: [...os.historico, { data: nowIso(), texto, usuario }] };
}

/**
 * Conclusão da execução: fecha apontamentos, baixa estoque (opcional), aplica alteração
 * de localização, encerra a ocorrência de origem e grava as execuções no histórico de
 * cada equipamento (atualizando última/próxima execução das rotinas).
 */
export async function concluirOS(os: OS, opts: { baixarEstoque: boolean; usuario?: string }): Promise<OS> {
  const agora = localDateTimeStr();
  let o: OS = {
    ...os,
    status: 'concluida',
    fim: os.fim || agora,
    apontamentos: os.apontamentos.map((a) => (a.fim ? a : { ...a, fim: agora })),
    equipamentos: os.equipamentos.map((e) => ({ ...e, concluido: true })),
  };
  if (opts.baixarEstoque) o = await baixarPecas(o);
  for (const item of o.equipamentos) {
    if (!item.novoAmbienteId) continue;
    const eq = await db.equipamentos.get(item.equipamentoId);
    if (eq && eq.ambienteId !== item.novoAmbienteId) {
      await db.equipamentos.update(eq.id, { ambienteId: item.novoAmbienteId, updatedAt: nowIso() });
      o = comHistorico(o, `Localização de ${eq.tag} alterada`, opts.usuario);
    }
  }
  if (o.ocorrenciaId) await db.ocorrencias.update(o.ocorrenciaId, { status: 'encerrada', updatedAt: nowIso() });
  o = comHistorico(o, 'Execução concluída — aguardando liberação', opts.usuario);
  await db.os.put({ ...o, updatedAt: nowIso() });
  await registrarExecucoesDaOS(o);
  return o;
}

/** Liberação pelo supervisor (data/hora de liberação). */
export async function liberarOS(os: OS, supervisorId: string | undefined, usuario?: string): Promise<OS> {
  const o = comHistorico({ ...os, status: 'validada', supervisorId: supervisorId || os.supervisorId, liberacao: localDateTimeStr() }, 'OS liberada pelo supervisor', usuario);
  await db.os.put({ ...o, updatedAt: nowIso() });
  await registrarExecucoesDaOS(o);
  return o;
}

/** Reabre uma OS concluída/liberada/cancelada e estorna as execuções do histórico. */
export async function reabrirOS(os: OS, usuario?: string): Promise<OS> {
  const o = comHistorico({ ...os, status: 'em_execucao', liberacao: undefined }, 'OS reaberta', usuario);
  await db.os.put({ ...o, updatedAt: nowIso() });
  await estornarExecucoesDaOS(o.id);
  return o;
}

/** Altera a data agendada mantendo a data original (a OS passa a contar como reprogramada). */
export async function reprogramarOS(id: string, data: string, usuario?: string, motivo?: string): Promise<void> {
  const os = await db.os.get(id);
  if (!os || os.dataAgendada === data) return;
  const o = comHistorico({ ...os, dataOriginal: os.dataOriginal || os.dataAgendada, dataAgendada: data, prazo: os.prazo && os.prazo < data ? data : os.prazo }, `Reprogramada de ${fmtDate(os.dataAgendada)} para ${fmtDate(data)}${motivo ? ' — ' + motivo : ''}`, usuario);
  await db.os.put({ ...o, updatedAt: nowIso() });
}

export async function excluirOS(id: string): Promise<void> {
  await estornarExecucoesDaOS(id);
  await db.os.delete(id);
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

/** OS do fluxo de preventivas (gerada pela Central ou do tipo Preventiva). */
export const ehPreventiva = (o: OS) => o.origem === 'preventiva' || o.tipo === 'Preventiva';
