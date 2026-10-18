import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type {
  Ambiente, Cliente, Contrato, Empresa, Equipamento, Fornecedor, Peca, PlanoManutencao, Pmoc, Profissional, Servico, Unidade,
} from '../db/types';
import { EMPRESA_PADRAO } from '../db/db';

export interface Lookups {
  ready: boolean;
  empresa: Empresa;
  clientes: Cliente[];
  unidades: Unidade[];
  ambientes: Ambiente[];
  equipamentos: Equipamento[];
  planos: PlanoManutencao[];
  profissionais: Profissional[];
  pecas: Peca[];
  servicos: Servico[];
  fornecedores: Fornecedor[];
  contratos: Contrato[];
  pmocs: Pmoc[];
  clienteMap: Map<string, Cliente>;
  unidadeMap: Map<string, Unidade>;
  ambienteMap: Map<string, Ambiente>;
  equipamentoMap: Map<string, Equipamento>;
  planoMap: Map<string, PlanoManutencao>;
  profissionalMap: Map<string, Profissional>;
  pecaMap: Map<string, Peca>;
  servicoMap: Map<string, Servico>;
  fornecedorMap: Map<string, Fornecedor>;
  contratoMap: Map<string, Contrato>;
  pmocMap: Map<string, Pmoc>;
}

const empty: Lookups = {
  ready: false,
  empresa: EMPRESA_PADRAO,
  clientes: [], unidades: [], ambientes: [], equipamentos: [], planos: [], profissionais: [], pecas: [], servicos: [], fornecedores: [], contratos: [], pmocs: [],
  clienteMap: new Map(), unidadeMap: new Map(), ambienteMap: new Map(), equipamentoMap: new Map(), planoMap: new Map(), profissionalMap: new Map(),
  pecaMap: new Map(), servicoMap: new Map(), fornecedorMap: new Map(), contratoMap: new Map(), pmocMap: new Map(),
};

const Ctx = createContext<Lookups>(empty);
export const useLookups = () => useContext(Ctx);

const byName = <T extends { nome?: string }>(a: T, b: T) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
const toMap = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));

export function LookupsProvider({ children }: { children: ReactNode }) {
  const data = useLiveQuery(async () => {
    const [empresa, clientes, unidades, ambientes, equipamentos, planos, profissionais, pecas, servicos, fornecedores, contratos, pmocs] = await Promise.all([
      db.settings.get('empresa'),
      db.clientes.toArray(),
      db.unidades.toArray(),
      db.ambientes.toArray(),
      db.equipamentos.toArray(),
      db.planos.toArray(),
      db.profissionais.toArray(),
      db.pecas.toArray(),
      db.servicos.toArray(),
      db.fornecedores.toArray(),
      db.contratos.toArray(),
      db.pmocs.toArray(),
    ]);
    return {
      empresa: { ...EMPRESA_PADRAO, ...((empresa?.value as Empresa) || {}) },
      clientes: clientes.sort(byName),
      unidades: unidades.sort(byName),
      ambientes: ambientes.sort(byName),
      equipamentos: equipamentos.sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR', { numeric: true })),
      planos: planos.sort(byName),
      profissionais: profissionais.sort(byName),
      pecas: pecas.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      servicos: servicos.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      fornecedores: fornecedores.sort(byName),
      contratos,
      pmocs,
    };
  }, []);

  const value = useMemo<Lookups>(() => {
    if (!data) return empty;
    return {
      ready: true,
      ...data,
      clienteMap: toMap(data.clientes),
      unidadeMap: toMap(data.unidades),
      ambienteMap: toMap(data.ambientes),
      equipamentoMap: toMap(data.equipamentos),
      planoMap: toMap(data.planos),
      profissionalMap: toMap(data.profissionais),
      pecaMap: toMap(data.pecas),
      servicoMap: toMap(data.servicos),
      fornecedorMap: toMap(data.fornecedores),
      contratoMap: toMap(data.contratos),
      pmocMap: toMap(data.pmocs),
    };
  }, [data]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function equipLabel(e?: Equipamento, l?: Lookups): string {
  if (!e) return '—';
  const amb = l?.ambienteMap.get(e.ambienteId || '')?.nome;
  return `${e.tag} · ${e.tipo}${e.marca ? ' ' + e.marca : ''}${e.capacidadeBtu ? ' ' + (e.capacidadeBtu / 1000).toLocaleString('pt-BR') + 'k BTU' : ''}${amb ? ' — ' + amb : ''}`;
}
