import { db, nextNumber, nowIso, uid } from '../db/db';
import type { Equipamento, ID, OS, Pmoc } from '../db/types';
import { dateStr } from './format';
import { itemEquipamento, monthIndex, monthIndexFromStr } from './schedule';

export type Agrupamento = 'unidade' | 'ambiente' | 'equipamento';

export interface GerarParams {
  pmocIds: ID[];
  ano: number;
  mes0: number;
  agrupamento: Agrupamento;
  dia?: number;
  responsavelId?: ID;
  tecnicosIds?: ID[];
  dryRun?: boolean;
}

export interface GerarResultado {
  criadas: OS[];
  ignoradas: number;
  semAtividade: number;
}

/** Gera as OS preventivas de um mês a partir dos PMOCs vigentes, sem duplicar as já geradas. */
export async function gerarPreventivas(p: GerarParams): Promise<GerarResultado> {
  const [pmocs, equipamentos, planos, ambientes, unidades, existentes] = await Promise.all([
    db.pmocs.bulkGet(p.pmocIds),
    db.equipamentos.toArray(),
    db.planos.toArray(),
    db.ambientes.toArray(),
    db.unidades.toArray(),
    db.os.where('preventivaRef').above('').toArray(),
  ]);
  const refsExistentes = new Set(existentes.filter((o) => o.status !== 'cancelada').map((o) => o.preventivaRef));
  const planoMap = new Map(planos.map((x) => [x.id, x]));
  const ambMap = new Map(ambientes.map((x) => [x.id, x]));
  const uniMap = new Map(unidades.map((x) => [x.id, x]));
  const target = monthIndex(p.ano, p.mes0);
  const mesStr = `${p.ano}-${String(p.mes0 + 1).padStart(2, '0')}`;
  const dataAgendada = dateStr(new Date(p.ano, p.mes0, Math.min(p.dia || 10, 28)));
  const out: GerarResultado = { criadas: [], ignoradas: 0, semAtividade: 0 };

  for (const pmoc of pmocs.filter(Boolean) as Pmoc[]) {
    const start = monthIndexFromStr(pmoc.vigenciaInicio) ?? target;
    const fim = monthIndexFromStr(pmoc.vigenciaFim);
    if (target < start || (fim !== null && target > fim)) continue;
    const unidade = uniMap.get(pmoc.unidadeId);
    const equips = equipamentos.filter((e) => e.unidadeId === pmoc.unidadeId && e.status !== 'desativado' && e.planoId);
    const grupos = new Map<string, { label: string; ambienteId?: ID; itens: ReturnType<typeof itemEquipamento>[] }>();

    for (const eq of equips as Equipamento[]) {
      const item = itemEquipamento(eq, planoMap.get(eq.planoId!), target, start);
      if (!item.checklist.length) {
        out.semAtividade++;
        continue;
      }
      let key = 'geral';
      let label = '';
      let ambienteId: ID | undefined;
      if (p.agrupamento === 'ambiente') {
        key = eq.ambienteId || 'sem-ambiente';
        ambienteId = eq.ambienteId;
        label = ` — ${ambMap.get(eq.ambienteId || '')?.nome || 'Sem ambiente'}`;
      } else if (p.agrupamento === 'equipamento') {
        key = eq.id;
        ambienteId = eq.ambienteId;
        label = ` — ${eq.tag}`;
      }
      const g = grupos.get(key) || { label, ambienteId, itens: [] };
      g.itens.push(item);
      grupos.set(key, g);
    }

    for (const [key, g] of grupos) {
      const ref = `${pmoc.id}|${mesStr}|${key}`;
      if (refsExistentes.has(ref)) {
        out.ignoradas++;
        continue;
      }
      const ts = nowIso();
      const os: OS = {
        id: uid(),
        createdAt: ts,
        updatedAt: ts,
        numero: p.dryRun ? '(prévia)' : await nextNumber('os'),
        tipo: 'Preventiva',
        prioridade: 'media',
        status: 'agendada',
        origem: 'preventiva',
        clienteId: unidade?.clienteId,
        unidadeId: pmoc.unidadeId,
        ambienteId: g.ambienteId,
        contratoId: pmoc.contratoId,
        pmocId: pmoc.id,
        titulo: `Preventiva PMOC ${String(p.mes0 + 1).padStart(2, '0')}/${p.ano} — ${unidade?.nome || ''}${g.label}`,
        descricao: `Manutenção preventiva programada conforme ${pmoc.codigo}. ${g.itens.length} equipamento(s).`,
        responsavelId: p.responsavelId,
        tecnicosIds: p.tecnicosIds || [],
        dataAbertura: ts,
        dataAgendada,
        prazo: dateStr(new Date(p.ano, p.mes0 + 1, 0)),
        equipamentos: g.itens,
        pecas: [],
        servicos: [],
        apontamentos: [],
        fotos: [],
        preventivaRef: ref,
        historico: [{ data: ts, texto: 'OS gerada automaticamente pelo cronograma do PMOC' }],
      };
      out.criadas.push(os);
    }
  }
  if (!p.dryRun && out.criadas.length) await db.os.bulkAdd(out.criadas);
  return out;
}
