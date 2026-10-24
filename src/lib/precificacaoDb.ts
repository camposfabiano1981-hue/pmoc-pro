import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, nextNumber, nowIso, setSetting, uid } from '../db/db';
import type { CargoPreco, Contrato, EstudoPreco, Oportunidade, ParametrosPreco } from '../db/types';
import { CONTRATO_PADRAO } from './contrato';
import { addDays, todayStr } from './format';
import { comPadroes, custoKmSugerido } from './precificacao';

export const PARAMS_KEY = 'precificacao';

export async function carregarParametros(): Promise<ParametrosPreco> {
  return comPadroes(await getSetting<Partial<ParametrosPreco> | null>(PARAMS_KEY, null));
}

export async function salvarParametros(p: ParametrosPreco): Promise<void> {
  await setSetting(PARAMS_KEY, p);
}

/** Parâmetros de precificação (com os valores-padrão para o que ainda não foi configurado). */
export function useParametrosPreco(): ParametrosPreco | undefined {
  return useLiveQuery(async () => comPadroes((await db.settings.get(PARAMS_KEY))?.value as Partial<ParametrosPreco> | undefined), []);
}

export const CARGOS_SUGERIDOS: Omit<CargoPreco, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { nome: 'Técnico em refrigeração e climatização', vinculo: 'clt', salarioBase: 0, periculosidade: true, diasMes: 22, insumosModo: 'composicao', ativo: true },
  { nome: 'Ajudante / auxiliar de refrigeração', vinculo: 'clt', salarioBase: 0, periculosidade: true, diasMes: 22, insumosModo: 'composicao', ativo: true },
  { nome: 'Eletricista de manutenção', vinculo: 'clt', salarioBase: 0, periculosidade: true, diasMes: 22, insumosModo: 'composicao', ativo: true },
];

export async function criarCargosSugeridos(): Promise<void> {
  const ts = nowIso();
  await db.cargosPreco.bulkAdd(CARGOS_SUGERIDOS.map((c) => ({ ...c, id: uid(), createdAt: ts, updatedAt: ts })));
}

/** Novo estudo com equipe (técnico + ajudante, se cadastrados), método de preço, BDI e custos da composição. */
export async function criarEstudo(partial: Partial<EstudoPreco> = {}): Promise<EstudoPreco> {
  const p = await carregarParametros();
  const cargos = (await db.cargosPreco.toArray()).filter((c) => c.ativo);
  const clt = (c: CargoPreco) => (c.vinculo || 'clt') === 'clt';
  const achar = (re: RegExp) => cargos.find((c) => re.test(c.nome) && clt(c)) || cargos.find((c) => re.test(c.nome));
  const tecnico = achar(/t[eé]cnico/i);
  const ajudante = achar(/ajudante|auxiliar/i);
  const equipe = [tecnico, ajudante].filter((c): c is CargoPreco => !!c).map((c) => ({ cargoId: c.id, quantidade: 1 }));
  const ts = nowIso();
  const e: EstudoPreco = {
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
    numero: await nextNumber('ep'),
    titulo: 'Novo estudo de preço',
    status: 'elaboracao',
    modelo: 'equipamento',
    tipoServico: 'engenharia',
    vigenciaMeses: 12,
    equipe: equipe.length ? equipe : cargos.slice(0, 1).map((c) => ({ cargoId: c.id, quantidade: 1 })),
    itens: [],
    deslocamento: { visitasMes: 0, minutosVisita: 0, kmMes: 0, custoKm: custoKmSugerido(p) },
    custosFixos: p.custosPadrao.map((c) => ({ id: uid(), descricao: c.descricao, valorMensal: c.valorMensal })),
    rateio: 'horas',
    kits: 1,
    veiculos: 1,
    metodo: p.metodo,
    referenciaTcu: p.referenciaTcu,
    bdi: { ...p.bdi },
    markup: { ...p.markup },
    bdiMateriais: { ...p.bdiMateriais },
    validadeDias: 60,
    ...partial,
  };
  await db.estudos.add(e);
  return e;
}

/** Abre (ou cria) o estudo de preço vinculado à oportunidade. */
export async function estudoDaOportunidade(op: Oportunidade): Promise<EstudoPreco> {
  if (op.estudoId) {
    const e = await db.estudos.get(op.estudoId);
    if (e) return e;
  }
  const vig = op.vigenciaMeses || 12;
  const e = await criarEstudo({
    titulo: op.titulo,
    oportunidadeId: op.id,
    clienteId: op.clienteId,
    orgao: op.orgao,
    vigenciaMeses: vig,
    valorEstimadoMensal: op.valorEstimado ? Math.round((op.valorEstimado / vig) * 100) / 100 : undefined,
  });
  await db.oportunidades.update(op.id, { estudoId: e.id, updatedAt: nowIso() });
  return e;
}

/** Cria o contrato a partir da oportunidade ganha (modelo público para licitações). */
export async function contratoDaOportunidade(op: Oportunidade): Promise<Contrato> {
  if (!op.clienteId) throw new Error('Vincule um cliente à oportunidade antes de gerar o contrato.');
  const vig = op.vigenciaMeses || 12;
  const inicio = todayStr();
  const fim = (() => {
    const d = new Date(inicio + 'T12:00:00');
    d.setMonth(d.getMonth() + vig);
    return addDays(d.toISOString().slice(0, 10), -1);
  })();
  const ts = nowIso();
  const empresa = (await db.settings.get('empresa'))?.value as { cidade?: string } | undefined;
  const c: Contrato = {
    ...CONTRATO_PADRAO,
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
    numero: await nextNumber('ct'),
    clienteId: op.clienteId,
    status: 'ativo',
    objeto: op.objeto || op.titulo,
    inicio,
    fim,
    valorMensal: op.valorProposta ? Math.round((op.valorProposta / vig) * 100) / 100 : 0,
    modelo: op.tipo === 'licitacao' ? 'publico' : 'privado',
    licitacao: op.tipo === 'licitacao' ? [op.modalidade, op.numeroEdital && `nº ${op.numeroEdital}`].filter(Boolean).join(' ') : undefined,
    processo: op.processo,
    localAssinatura: empresa?.cidade,
    foro: op.cidade || empresa?.cidade,
    slaUrgenteH: 4,
    slaAltaH: 24,
    slaMediaH: 48,
    slaBaixaH: 120,
    observacoes: `Gerado a partir da oportunidade ${op.numero}.`,
  } as Contrato;
  await db.contratos.add(c);
  await db.oportunidades.update(op.id, { contratoId: c.id, updatedAt: nowIso() });
  return c;
}
