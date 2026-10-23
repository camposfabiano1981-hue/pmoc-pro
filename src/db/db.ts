import Dexie, { type Table } from 'dexie';
import type {
  AnaliseAr, Ambiente, Base, Cliente, Contrato, Empresa, Equipamento, Execucao, Fornecedor, MovEstoque, Ocorrencia,
  Orcamento, OS, Peca, PlanoManutencao, Pmoc, Profissional, RegistroFluido, Rotina, Servico, Setting, Unidade,
  Oportunidade, EstudoPreco, CargoPreco,
} from './types';

export class PmocDB extends Dexie {
  clientes!: Table<Cliente, string>;
  unidades!: Table<Unidade, string>;
  ambientes!: Table<Ambiente, string>;
  equipamentos!: Table<Equipamento, string>;
  planos!: Table<PlanoManutencao, string>;
  profissionais!: Table<Profissional, string>;
  pecas!: Table<Peca, string>;
  movimentos!: Table<MovEstoque, string>;
  servicos!: Table<Servico, string>;
  fornecedores!: Table<Fornecedor, string>;
  contratos!: Table<Contrato, string>;
  pmocs!: Table<Pmoc, string>;
  os!: Table<OS, string>;
  ocorrencias!: Table<Ocorrencia, string>;
  orcamentos!: Table<Orcamento, string>;
  analisesAr!: Table<AnaliseAr, string>;
  fluidos!: Table<RegistroFluido, string>;
  rotinas!: Table<Rotina, string>;
  execucoes!: Table<Execucao, string>;
  oportunidades!: Table<Oportunidade, string>;
  estudos!: Table<EstudoPreco, string>;
  cargosPreco!: Table<CargoPreco, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('pmoc-pro');
    this.version(1).stores({
      clientes: 'id, nome, cpfCnpj',
      unidades: 'id, clienteId, nome',
      ambientes: 'id, unidadeId, nome',
      equipamentos: 'id, tag, unidadeId, ambienteId, tipo, planoId, status',
      planos: 'id, nome',
      profissionais: 'id, nome',
      pecas: 'id, codigo, descricao',
      movimentos: 'id, pecaId, data, osId',
      servicos: 'id, codigo',
      fornecedores: 'id, nome',
      contratos: 'id, clienteId, numero',
      pmocs: 'id, unidadeId',
      os: 'id, numero, status, tipo, unidadeId, dataAgendada, preventivaRef, dataAbertura',
      ocorrencias: 'id, numero, status, unidadeId',
      orcamentos: 'id, numero, status, clienteId',
      analisesAr: 'id, unidadeId, ambienteId, data',
      fluidos: 'id, equipamentoId, data',
      settings: 'key',
    });
    // v2: controle de periodicidade por equipamento
    this.version(2).stores({
      rotinas: 'id, equipamentoId, proximaExecucao, planoId',
      execucoes: 'id, rotinaId, equipamentoId, osId, data',
    });
    // v3: módulo comercial (oportunidades/licitações) e precificação
    this.version(3).stores({
      oportunidades: 'id, numero, etapa, dataSessao, clienteId',
      estudos: 'id, numero, status, oportunidadeId, clienteId',
      cargosPreco: 'id, nome',
    });
  }
}

export const db = new PmocDB();

export type TableName = Exclude<
  {
    [K in keyof PmocDB]: PmocDB[K] extends Table<infer _T, string> ? K : never;
  }[keyof PmocDB],
  'settings'
>;

export const ALL_TABLES: TableName[] = [
  'clientes', 'unidades', 'ambientes', 'equipamentos', 'planos', 'profissionais', 'pecas', 'movimentos',
  'servicos', 'fornecedores', 'contratos', 'pmocs', 'os', 'ocorrencias', 'orcamentos', 'analisesAr', 'fluidos', 'rotinas', 'execucoes',
  'oportunidades', 'estudos', 'cargosPreco',
];

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Insere ou atualiza um registro preenchendo id e carimbos de data. */
export async function saveRecord<T extends Base>(table: TableName, data: Partial<T>): Promise<T> {
  const t = db.table(table);
  const ts = nowIso();
  const rec = { ...data, id: data.id || uid(), createdAt: data.createdAt || ts, updatedAt: ts } as T;
  await t.put(rec);
  return rec;
}

export async function deleteRecord(table: TableName, id: string): Promise<void> {
  await db.table(table).delete(id);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

const PREFIXES: Record<string, string> = {
  os: 'OS',
  oc: 'OC',
  orc: 'ORC',
  pmoc: 'PMOC',
  eq: 'EQ',
  peca: 'P',
  serv: 'S',
  ct: 'CT',
  op: 'OP',
  ep: 'EP',
};

/** Gera numeração sequencial (ex.: OS-2026-00012). Anual para OS/OC/ORC. */
export async function nextNumber(kind: keyof typeof PREFIXES | string): Promise<string> {
  return db.transaction('rw', db.settings, async () => {
    const counters = await getSetting<Record<string, number>>('counters', {});
    const yearly = ['os', 'oc', 'orc', 'pmoc', 'ct', 'op', 'ep'].includes(kind);
    const year = new Date().getFullYear();
    const key = yearly ? `${kind}-${year}` : kind;
    const n = (counters[key] || 0) + 1;
    counters[key] = n;
    await setSetting('counters', counters);
    const prefix = PREFIXES[kind] || kind.toUpperCase();
    return yearly ? `${prefix}-${year}-${String(n).padStart(4, '0')}` : `${prefix}-${String(n).padStart(4, '0')}`;
  });
}

export const EMPRESA_PADRAO: Empresa = {
  razaoSocial: 'Sua Empresa de Climatização Ltda',
  fantasia: 'Sua Empresa',
  cnpj: '',
  telefone: '',
  email: '',
  cidade: '',
  uf: '',
  rodape: 'Documento gerado pelo PMOC Pro',
  corPrimaria: '#0e7490',
};

/** Movimenta estoque atualizando o saldo da peça na mesma transação. */
export async function movimentarEstoque(mov: Omit<MovEstoque, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  await db.transaction('rw', db.pecas, db.movimentos, async () => {
    const peca = await db.pecas.get(mov.pecaId);
    if (!peca) throw new Error('Peça não encontrada');
    let estoque = peca.estoque || 0;
    if (mov.tipo === 'entrada') estoque += mov.quantidade;
    else if (mov.tipo === 'saida') estoque -= mov.quantidade;
    else estoque = mov.quantidade; // ajuste = saldo informado
    const patch: Partial<Peca> = { estoque, updatedAt: nowIso() };
    // custo médio ponderado nas entradas
    if (mov.tipo === 'entrada' && mov.custoUnit && mov.custoUnit > 0) {
      const saldoAnterior = Math.max(peca.estoque || 0, 0);
      const total = saldoAnterior * (peca.custo || 0) + mov.quantidade * mov.custoUnit;
      patch.custo = Math.round((total / (saldoAnterior + mov.quantidade)) * 100) / 100;
    }
    await db.pecas.update(peca.id, patch);
    const ts = nowIso();
    await db.movimentos.add({ ...mov, id: uid(), createdAt: ts, updatedAt: ts });
  });
}

/** Desfaz um movimento (exclusão) recompondo o saldo. Ajustes não são revertidos automaticamente. */
export async function excluirMovimento(id: string): Promise<void> {
  await db.transaction('rw', db.pecas, db.movimentos, async () => {
    const mov = await db.movimentos.get(id);
    if (!mov) return;
    const peca = await db.pecas.get(mov.pecaId);
    if (peca && mov.tipo !== 'ajuste') {
      const delta = mov.tipo === 'entrada' ? -mov.quantidade : mov.quantidade;
      await db.pecas.update(peca.id, { estoque: (peca.estoque || 0) + delta, updatedAt: nowIso() });
    }
    await db.movimentos.delete(id);
  });
}

export async function exportarBackup(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { app: 'pmoc-pro', versao: 1, exportadoEm: nowIso() };
  for (const t of ALL_TABLES) out[t] = await db.table(t).toArray();
  out.settings = await db.settings.toArray();
  return out;
}

export async function importarBackup(data: Record<string, unknown>, modo: 'substituir' | 'mesclar'): Promise<void> {
  if (data.app !== 'pmoc-pro') throw new Error('Arquivo não é um backup do PMOC Pro.');
  const tables = [...ALL_TABLES.map((t) => db.table(t)), db.settings];
  await db.transaction('rw', tables, async () => {
    for (const t of [...ALL_TABLES, 'settings'] as const) {
      const rows = data[t];
      if (!Array.isArray(rows)) continue;
      if (modo === 'substituir') await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}

export async function limparTudo(): Promise<void> {
  const tables = [...ALL_TABLES.map((t) => db.table(t)), db.settings];
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear();
  });
}
