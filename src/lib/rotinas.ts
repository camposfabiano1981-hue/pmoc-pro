import { db, getSetting, nowIso, setSetting, uid } from '../db/db';
import type { Equipamento, Execucao, ItemChecklist, OS, PlanoManutencao, Rotina } from '../db/types';
import { diasDaPeriodicidade } from './catalogs';
import { addDays, diffDays, todayStr } from './format';

/** Cria as rotinas de um equipamento a partir de um plano modelo. */
export function rotinasDoPlano(eq: Equipamento, plano: PlanoManutencao, inicio: string): Rotina[] {
  const ts = nowIso();
  return plano.atividades
    .filter((a) => a.periodicidade !== 'na')
    .map((a, i) => ({
      id: uid(),
      createdAt: ts,
      updatedAt: ts,
      equipamentoId: eq.id,
      planoId: plano.id,
      atividadeId: a.id,
      grupo: a.grupo,
      descricao: a.descricao,
      tipo: a.tipo,
      unidade: a.unidade,
      min: a.min,
      max: a.max,
      periodicidade: a.periodicidade,
      intervaloDias: diasDaPeriodicidade(a.periodicidade),
      tempoMin: a.tempoMin,
      setor: 'Manutenção',
      proximaExecucao: inicio,
      ativa: true,
      ordem: i,
    }));
}

/**
 * Aplica (ou atualiza) o plano modelo do equipamento nas suas rotinas:
 * cria as atividades que faltam, atualiza textos das não personalizadas e
 * desativa rotinas de um plano anterior.
 */
export async function aplicarPlano(eqId: string, inicio?: string): Promise<{ criadas: number; atualizadas: number }> {
  const eq = await db.equipamentos.get(eqId);
  const out = { criadas: 0, atualizadas: 0 };
  if (!eq) return out;
  const atuais = await db.rotinas.where('equipamentoId').equals(eqId).toArray();
  const plano = eq.planoId ? await db.planos.get(eq.planoId) : undefined;
  const ts = nowIso();
  const updates: Rotina[] = [];
  for (const r of atuais) {
    if (r.planoId && r.planoId !== eq.planoId && r.ativa && !r.personalizada) updates.push({ ...r, ativa: false, updatedAt: ts });
  }
  if (plano) {
    const base = inicio || eq.inicioPlano || todayStr();
    const novas = rotinasDoPlano(eq, plano, base).filter((n) => {
      const existente = atuais.find((r) => r.atividadeId === n.atividadeId && r.planoId === plano.id);
      if (!existente) return true;
      if (!existente.personalizada) {
        updates.push({
          ...existente,
          grupo: n.grupo,
          descricao: n.descricao,
          tipo: n.tipo,
          unidade: n.unidade,
          min: n.min,
          max: n.max,
          tempoMin: n.tempoMin,
          periodicidade: n.periodicidade,
          intervaloDias: n.intervaloDias,
          ordem: n.ordem,
          ativa: true,
          updatedAt: ts,
        });
        out.atualizadas++;
      }
      return false;
    });
    out.criadas = novas.length;
    if (novas.length) await db.rotinas.bulkAdd(novas);
  }
  if (updates.length) await db.rotinas.bulkPut(updates);
  return out;
}

export async function sincronizarPlanoNosEquipamentos(planoId: string): Promise<number> {
  const eqs = await db.equipamentos.where('planoId').equals(planoId).toArray();
  for (const e of eqs) await aplicarPlano(e.id);
  return eqs.length;
}

/** Datas previstas da rotina dentro do intervalo [de, ate] a partir da próxima execução. */
export function projetar(r: Rotina, de: string, ate: string): string[] {
  if (!r.ativa || !r.proximaExecucao || r.intervaloDias <= 0) return [];
  const out: string[] = [];
  let d = r.proximaExecucao;
  let guard = 0;
  // quando vencida, a projeção continua a partir da data devida (atraso aparece no próprio dia devido)
  while (d <= ate && guard++ < 800) {
    if (d >= de) out.push(d);
    d = addDays(d, r.intervaloDias);
  }
  return out;
}

export type StatusRotina = 'vencida' | 'a_vencer' | 'em_dia' | 'inativa';

export function statusRotina(r: Rotina, hoje = todayStr(), janela = 7): StatusRotina {
  if (!r.ativa) return 'inativa';
  const d = diffDays(r.proximaExecucao, hoje) ?? 0;
  if (d < 0) return 'vencida';
  if (d <= janela) return 'a_vencer';
  return 'em_dia';
}

export const STATUS_ROTINA: Record<StatusRotina, { label: string; cor: string }> = {
  vencida: { label: 'Vencida', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  a_vencer: { label: 'A vencer', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  em_dia: { label: 'Em dia', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  inativa: { label: 'Inativa', cor: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

/** Item de checklist de OS gerado a partir de uma rotina. */
export function itemDeRotina(r: Rotina): ItemChecklist {
  return {
    rotinaId: r.id,
    atividadeId: r.atividadeId,
    grupo: r.grupo,
    descricao: r.descricao,
    periodicidade: r.periodicidade,
    tipo: r.tipo,
    unidade: r.unidade,
    min: r.min,
    max: r.max,
    tempoPrevistoMin: r.tempoMin,
    servico: r.setor,
    material: r.material,
    dataPrevista: r.proximaExecucao,
    resultado: '',
    execucao: '',
    valor: '',
    obs: '',
  };
}

/** Status de execução de um item (compatível com registros antigos que só tinham "resultado"). */
export function statusItem(c: ItemChecklist): '' | 'E' | 'P' | 'N' {
  if (c.execucao) return c.execucao;
  if (c.resultado && c.resultado !== 'na') return 'E';
  return '';
}

/** Recalcula última e próxima execução das rotinas a partir do histórico (em lote). */
export async function recalcularRotinas(ids: string[]): Promise<void> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return;
  const [rotinas, execs] = await Promise.all([db.rotinas.bulkGet(unicos), db.execucoes.where('rotinaId').anyOf(unicos).toArray()]);
  const ultima = new Map<string, string>();
  for (const e of execs) if (e.status === 'E' && (!ultima.has(e.rotinaId) || e.data > ultima.get(e.rotinaId)!)) ultima.set(e.rotinaId, e.data);
  const ts = nowIso();
  const updates: Rotina[] = [];
  for (const r of rotinas) {
    if (!r) continue;
    const ult = ultima.get(r.id);
    if (ult === r.ultimaExecucao) continue;
    updates.push(ult ? { ...r, ultimaExecucao: ult, proximaExecucao: addDays(ult, r.intervaloDias), reprogramada: false, updatedAt: ts } : { ...r, ultimaExecucao: undefined, updatedAt: ts });
  }
  if (updates.length) await db.rotinas.bulkPut(updates);
}

/** Grava no histórico de cada equipamento as execuções lançadas na OS e atualiza as rotinas. */
export async function registrarExecucoesDaOS(os: OS): Promise<void> {
  const ts = nowIso();
  const regs: Execucao[] = [];
  const dataPadrao = (os.fim || os.inicio || ts).slice(0, 10);
  for (const item of os.equipamentos) {
    for (const c of item.checklist) {
      if (!c.rotinaId) continue;
      const st = statusItem(c);
      if (!st) continue;
      regs.push({
        id: `${os.id}:${c.rotinaId}`,
        createdAt: ts,
        updatedAt: ts,
        rotinaId: c.rotinaId,
        equipamentoId: item.equipamentoId,
        osId: os.id,
        data: (c.dataExecucao || dataPadrao).slice(0, 10),
        status: st,
        executorId: c.executorId || os.responsavelId,
        valor: c.valor,
        condicao: c.resultado,
        obs: c.obs,
        tempoRealMin: c.tempoRealMin,
      });
    }
  }
  const antigos = await db.execucoes.where('osId').equals(os.id).toArray();
  const novosIds = new Set(regs.map((r) => r.id));
  const remover = antigos.filter((a) => !novosIds.has(a.id));
  if (remover.length) await db.execucoes.bulkDelete(remover.map((r) => r.id));
  if (regs.length) await db.execucoes.bulkPut(regs);
  await recalcularRotinas([...regs.map((r) => r.rotinaId), ...remover.map((r) => r.rotinaId)]);
}

/** Remove as execuções de uma OS (cancelamento, reabertura ou exclusão). */
export async function estornarExecucoesDaOS(osId: string): Promise<void> {
  const antigos = await db.execucoes.where('osId').equals(osId).toArray();
  if (!antigos.length) return;
  await db.execucoes.bulkDelete(antigos.map((a) => a.id));
  await recalcularRotinas(antigos.map((a) => a.rotinaId));
}

/**
 * Migração para o controle por equipamento: cria rotinas para equipamentos com plano
 * e reconstrói o histórico a partir das OS concluídas existentes.
 */
export async function migrarRotinas(): Promise<void> {
  if (await getSetting<boolean>('rotinasV2', false)) return;
  await db.transaction('rw', [db.equipamentos, db.pmocs, db.rotinas, db.planos, db.os, db.execucoes, db.settings], migrar);
}

async function migrar(): Promise<void> {
  const [equips, pmocs, rotinasExist] = await Promise.all([db.equipamentos.toArray(), db.pmocs.toArray(), db.rotinas.toArray()]);
  const comRotina = new Set(rotinasExist.map((r) => r.equipamentoId));
  for (const eq of equips) {
    if (!eq.planoId || comRotina.has(eq.id)) continue;
    const pmoc = pmocs.find((p) => p.unidadeId === eq.unidadeId && p.status === 'vigente');
    await aplicarPlano(eq.id, eq.inicioPlano || pmoc?.vigenciaInicio || todayStr());
  }
  const rotinas = await db.rotinas.toArray();
  const chave = new Map(rotinas.map((r) => [`${r.equipamentoId}|${r.atividadeId}`, r]));
  const oss = await db.os.toArray();
  for (const os of oss) {
    let mudou = false;
    for (const item of os.equipamentos) {
      for (const c of item.checklist) {
        if (c.rotinaId || !c.atividadeId) continue;
        const r = chave.get(`${item.equipamentoId}|${c.atividadeId}`);
        if (!r) continue;
        c.rotinaId = r.id;
        if (!c.execucao && c.resultado && c.resultado !== 'na') c.execucao = 'E';
        mudou = true;
      }
    }
    if (mudou) await db.os.put(os);
    if (mudou && (os.status === 'concluida' || os.status === 'validada')) await registrarExecucoesDaOS(os);
  }
  await setSetting('rotinasV2', true);
}
