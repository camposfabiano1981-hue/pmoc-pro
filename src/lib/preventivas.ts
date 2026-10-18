import { db, nextNumber, nowIso, uid } from '../db/db';
import type { Equipamento, ID, ItemOsEquip, OS, Rotina } from '../db/types';
import { OS_FINALIZADAS } from './catalogs';
import { fmtDate } from './format';
import { itemDeRotina } from './rotinas';

export type Agrupamento = 'equipamento' | 'ambiente' | 'unidade';

export interface GerarParams {
  unidadeIds: ID[];
  de: string;
  ate: string;
  agrupamento: Agrupamento;
  /** Data fixa de agendamento; vazio = usa a data prevista de cada equipamento */
  dataAgendada?: string;
  responsavelId?: ID;
  tecnicosIds?: ID[];
  setor?: string;
  dryRun?: boolean;
}

export interface GerarResultado {
  criadas: OS[];
  rotinas: number;
  jaProgramadas: number;
}

/**
 * Gera OS preventivas a partir das rotinas de cada equipamento cuja próxima execução
 * cai até a data final (inclui vencidas). Rotinas que já estão em OS aberta não são duplicadas.
 */
export async function gerarPreventivas(p: GerarParams): Promise<GerarResultado> {
  const [rotinas, equipamentos, ambientes, unidades, pmocs, abertas] = await Promise.all([
    db.rotinas.toArray(),
    db.equipamentos.toArray(),
    db.ambientes.toArray(),
    db.unidades.toArray(),
    db.pmocs.toArray(),
    db.os.filter((o) => !OS_FINALIZADAS.includes(o.status)).toArray(),
  ]);
  const programadas = new Set(abertas.flatMap((o) => o.equipamentos.flatMap((e) => e.checklist.map((c) => c.rotinaId).filter(Boolean))));
  const ambMap = new Map(ambientes.map((a) => [a.id, a]));
  const uniMap = new Map(unidades.map((u) => [u.id, u]));
  const porEquip = new Map<string, Rotina[]>();
  for (const r of rotinas) {
    if (!r.ativa) continue;
    (porEquip.get(r.equipamentoId) || porEquip.set(r.equipamentoId, []).get(r.equipamentoId)!).push(r);
  }
  const out: GerarResultado = { criadas: [], rotinas: 0, jaProgramadas: 0 };

  for (const unidadeId of p.unidadeIds) {
    const unidade = uniMap.get(unidadeId);
    const pmoc = pmocs.find((x) => x.unidadeId === unidadeId && x.status === 'vigente');
    const equips = equipamentos.filter((e) => e.unidadeId === unidadeId && e.status !== 'desativado');
    const grupos = new Map<string, { label: string; equip?: Equipamento; ambienteId?: ID; itens: ItemOsEquip[]; datas: string[]; setores: string[]; tempo: number }>();

    for (const eq of equips) {
      const devidas = (porEquip.get(eq.id) || []).filter((r) => r.proximaExecucao <= p.ate).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      const livres = devidas.filter((r) => !programadas.has(r.id));
      out.jaProgramadas += devidas.length - livres.length;
      if (!livres.length) continue;
      out.rotinas += livres.length;
      const key = p.agrupamento === 'unidade' ? 'geral' : p.agrupamento === 'ambiente' ? eq.ambienteId || 'sem-ambiente' : eq.id;
      const amb = ambMap.get(eq.ambienteId || '');
      const label =
        p.agrupamento === 'equipamento'
          ? `${eq.tag} ${eq.tipo}${amb ? ' — ' + amb.nome : ''}`
          : p.agrupamento === 'ambiente'
            ? amb?.nome || 'Sem ambiente'
            : unidade?.nome || '';
      const g = grupos.get(key) || { label, equip: p.agrupamento === 'equipamento' ? eq : undefined, ambienteId: p.agrupamento === 'unidade' ? undefined : eq.ambienteId, itens: [], datas: [], setores: [], tempo: 0 };
      g.itens.push({ equipamentoId: eq.id, checklist: livres.map(itemDeRotina), medicoes: {}, obs: '' });
      g.datas.push(...livres.map((r) => r.proximaExecucao));
      g.setores.push(...livres.map((r) => r.setor || '').filter(Boolean));
      g.tempo += livres.reduce((a, r) => a + (r.tempoMin || 0), 0);
      grupos.set(key, g);
    }

    for (const [key, g] of grupos) {
      const prevista = g.datas.sort()[0];
      const dataAgendada = p.dataAgendada || (prevista < p.de ? p.de : prevista);
      const setor = p.setor || moda(g.setores) || 'Manutenção';
      const ts = nowIso();
      out.criadas.push({
        id: uid(),
        createdAt: ts,
        updatedAt: ts,
        numero: p.dryRun ? '(prévia)' : await nextNumber('os'),
        tipo: 'Preventiva',
        prioridade: g.equip?.criticidade === 'A' ? 'alta' : 'media',
        status: 'agendada',
        origem: 'preventiva',
        clienteId: unidade?.clienteId,
        unidadeId,
        ambienteId: g.ambienteId,
        contratoId: pmoc?.contratoId,
        pmocId: pmoc?.id,
        titulo: `Preventiva — ${g.label}`,
        descricao: `Manutenção preventiva programada pelo plano de manutenção de cada equipamento${pmoc ? ` (${pmoc.codigo})` : ''}. Prevista para ${fmtDate(prevista)}.`,
        responsavelId: p.responsavelId,
        tecnicosIds: p.tecnicosIds || (p.responsavelId ? [p.responsavelId] : []),
        setorExecutante: setor,
        centroCusto: g.equip?.centroCusto,
        tempoPrevistoMin: g.tempo,
        dataAbertura: ts,
        dataAgendada,
        prazo: p.ate,
        equipamentos: g.itens,
        pecas: [],
        servicos: [],
        apontamentos: [],
        fotos: [],
        preventivaRef: `${unidadeId}|${p.de}|${p.ate}|${key}`,
        historico: [{ data: ts, texto: 'OS gerada automaticamente pelas rotinas de manutenção dos equipamentos' }],
      });
    }
  }
  if (!p.dryRun && out.criadas.length) await db.os.bulkAdd(out.criadas);
  return out;
}

function moda(arr: string[]): string | undefined {
  const c = new Map<string, number>();
  for (const x of arr) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
