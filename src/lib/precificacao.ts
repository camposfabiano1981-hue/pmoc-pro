import type { BdiParams, CargoPreco, EstudoPreco, ItemEstudo, ParametrosPreco, PlanoManutencao } from '../db/types';
import { PERIODICIDADES } from './catalogs';

/**
 * Motor de precificação de serviços de manutenção (licitações e contratos).
 * Referências: IN SEGES/MP 5/2017 (planilha de custos, aplicável à Lei 14.133 pela IN SEGES/ME 98/2022),
 * Acórdão TCU 2622/2013 (fórmula e faixas do BDI), LC 123/2006 (Simples Nacional, Anexo III),
 * Lei 14.973/2024 (reoneração gradual da folha) e LC 214/2025 (reforma tributária).
 */

export const PARAMETROS_PADRAO: ParametrosPreco = {
  regime: 'simples',
  rbt12: 360000,
  simplesExcluirIrpjCsll: false,
  issAliquota: 5,
  pisCofinsReal: 9.25,
  desonerada: false,
  cprbAliquota: 4.5,
  anoBase: new Date().getFullYear(),
  rat: 3,
  fap: 1,
  terceiros: 5.8,
  fgts: 8,
  tributosPorFora: 0,
  salarioMinimo: 1621,
  decimoTerceiro: 8.33,
  feriasTerco: 12.1,
  avisoIndenizado: 0.42,
  fgtsAvisoIndenizado: 0.03,
  avisoTrabalhado: 1.94,
  multaFgts: 3.2,
  jornadaSemanal: 44,
  feriadosAno: 12,
  feriasDiasUteis: 22,
  ausenciasDias: 4,
  produtividade: 85,
  bdi: { ac: 4, s: 0.4, r: 1, g: 0.4, l: 7, prazoDias: 30, taxaMes: 1 },
  custosPadrao: [
    { descricao: 'Veículo de atendimento (depreciação, seguro, IPVA, manutenção)', valorMensal: 0 },
    { descricao: 'Ferramentas e instrumentos (depreciação e calibração)', valorMensal: 0 },
    { descricao: 'Celular, internet e software de gestão', valorMensal: 0 },
    { descricao: 'Responsável técnico (horas de engenharia) e ART', valorMensal: 0 },
    { descricao: 'Supervisão / administração local do contrato', valorMensal: 0 },
  ],
  materiaisPadraoMes: 0,
  custoKmPadrao: 0,
};

export function comPadroes(p?: Partial<ParametrosPreco> | null): ParametrosPreco {
  return { ...PARAMETROS_PADRAO, ...(p || {}), bdi: { ...PARAMETROS_PADRAO.bdi, ...(p?.bdi || {}) }, custosPadrao: p?.custosPadrao || PARAMETROS_PADRAO.custosPadrao };
}

export interface Tributo {
  nome: string;
  aliquota: number;
  /** Não entra na taxa de tributos do BDI (ex.: IRPJ/CSLL quando excluídos) */
  excluido?: boolean;
  obs?: string;
}

/* ===================== Simples Nacional — Anexo III ===================== */
const REP = (irpj: number, csll: number, cofins: number, pis: number, cpp: number, iss: number) => ({ irpj, csll, cofins, pis, cpp, iss });
/** LC 123/2006, Anexo III (redação da LC 155/2016): faixas, alíquota nominal, parcela a deduzir e repartição dos tributos (%). */
export const ANEXO_III = [
  { faixa: 1, ate: 180000, aliquota: 6, deducao: 0, rep: REP(4, 3.5, 12.82, 2.78, 43.4, 33.5) },
  { faixa: 2, ate: 360000, aliquota: 11.2, deducao: 9360, rep: REP(4, 3.5, 14.05, 3.05, 43.4, 32) },
  { faixa: 3, ate: 720000, aliquota: 13.5, deducao: 17640, rep: REP(4, 3.5, 13.64, 2.96, 43.4, 32.5) },
  { faixa: 4, ate: 1800000, aliquota: 16, deducao: 35640, rep: REP(4, 3.5, 13.64, 2.96, 43.4, 32.5) },
  { faixa: 5, ate: 3600000, aliquota: 21, deducao: 125640, rep: REP(4, 3.5, 12.82, 2.78, 43.4, 33.5) },
  { faixa: 6, ate: 4800000, aliquota: 33, deducao: 648000, rep: REP(35, 15, 16.03, 3.47, 30.5, 0) },
];

export interface SimplesCalculo {
  faixa: number;
  nominal: number;
  deducao: number;
  efetiva: number;
  acimaDoLimite: boolean;
  tributos: { irpj: number; csll: number; cofins: number; pis: number; cpp: number; iss: number };
}

/** Alíquota efetiva do Simples (art. 18, §1º-A): (RBT12 × alíquota − parcela a deduzir) ÷ RBT12, com repartição e teto de 5% do ISS. */
export function simplesAnexoIII(rbt12: number): SimplesCalculo {
  const receita = Math.max(0, rbt12 || 0);
  const f = ANEXO_III.find((x) => receita <= x.ate) || ANEXO_III[ANEXO_III.length - 1];
  const efetiva = receita > 0 ? ((receita * f.aliquota) / 100 - f.deducao) / receita * 100 : f.aliquota;
  const t = {
    irpj: (efetiva * f.rep.irpj) / 100,
    csll: (efetiva * f.rep.csll) / 100,
    cofins: (efetiva * f.rep.cofins) / 100,
    pis: (efetiva * f.rep.pis) / 100,
    cpp: (efetiva * f.rep.cpp) / 100,
    iss: (efetiva * f.rep.iss) / 100,
  };
  // o ISS efetivo é limitado a 5%; o excedente vai para os tributos federais, na proporção da repartição
  if (t.iss > 5) {
    const excedente = t.iss - 5;
    t.iss = 5;
    const fed = f.rep.irpj + f.rep.csll + f.rep.cofins + f.rep.pis + f.rep.cpp;
    t.irpj += (excedente * f.rep.irpj) / fed;
    t.csll += (excedente * f.rep.csll) / fed;
    t.cofins += (excedente * f.rep.cofins) / fed;
    t.pis += (excedente * f.rep.pis) / fed;
    t.cpp += (excedente * f.rep.cpp) / fed;
  }
  return { faixa: f.faixa, nominal: f.aliquota, deducao: f.deducao, efetiva, acimaDoLimite: receita > 4800000, tributos: t };
}

/* ===================== Reoneração da folha (Lei 14.973/2024) ===================== */
/** Fração da contribuição sobre a folha (20%) e da CPRB devidas no ano, para empresas na desoneração. */
export function fatorReoneracao(ano: number): { folha: number; receita: number } {
  if (ano <= 2024) return { folha: 0, receita: 1 };
  if (ano === 2025) return { folha: 0.25, receita: 0.8 };
  if (ano === 2026) return { folha: 0.5, receita: 0.6 };
  if (ano === 2027) return { folha: 0.75, receita: 0.4 };
  return { folha: 1, receita: 0 };
}

/* ===================== Tributos sobre o faturamento ===================== */
export interface TributosCalculo {
  regime: ParametrosPreco['regime'];
  itens: Tributo[];
  /** Taxa de tributos "por dentro" usada no BDI (I) */
  total: number;
  /** Tributos "por fora" (cenário da reforma) */
  porFora: number;
  simples?: SimplesCalculo;
}

export function tributosFaturamento(p: ParametrosPreco, issOverride?: number): TributosCalculo {
  const iss = issOverride ?? p.issAliquota;
  const itens: Tributo[] = [];
  let simples: SimplesCalculo | undefined;
  if (p.regime === 'simples') {
    simples = simplesAnexoIII(p.rbt12);
    const t = simples.tributos;
    itens.push(
      { nome: 'IRPJ (parcela do DAS)', aliquota: t.irpj, excluido: p.simplesExcluirIrpjCsll },
      { nome: 'CSLL (parcela do DAS)', aliquota: t.csll, excluido: p.simplesExcluirIrpjCsll },
      { nome: 'Cofins (parcela do DAS)', aliquota: t.cofins },
      { nome: 'PIS/Pasep (parcela do DAS)', aliquota: t.pis },
      { nome: 'CPP — previdência patronal (parcela do DAS)', aliquota: t.cpp },
    );
    if (simples.faixa < 6) itens.push({ nome: 'ISS (parcela do DAS)', aliquota: t.iss });
    else itens.push({ nome: 'ISS (recolhido fora do DAS na 6ª faixa)', aliquota: iss });
  } else {
    if (p.regime === 'presumido') itens.push({ nome: 'PIS (cumulativo)', aliquota: 0.65 }, { nome: 'Cofins (cumulativo)', aliquota: 3 });
    else itens.push({ nome: 'PIS + Cofins (efetivo, não cumulativo)', aliquota: p.pisCofinsReal });
    itens.push({ nome: 'ISS', aliquota: iss });
    if (p.desonerada) {
      const f = fatorReoneracao(p.anoBase);
      if (f.receita > 0) itens.push({ nome: `CPRB (${Math.round(f.receita * 100)}% de ${fmt(p.cprbAliquota)}% em ${p.anoBase})`, aliquota: p.cprbAliquota * f.receita });
    }
  }
  const total = itens.filter((i) => !i.excluido).reduce((a, i) => a + i.aliquota, 0);
  return { regime: p.regime, itens, total, porFora: p.tributosPorFora || 0, simples };
}

/* ===================== Encargos e custo da mão de obra ===================== */
export function encargosGrupoA(p: ParametrosPreco): { itens: Tributo[]; total: number } {
  const itens: Tributo[] = [];
  if (p.regime === 'simples') {
    itens.push({ nome: 'FGTS', aliquota: p.fgts }, { nome: 'INSS patronal, RAT e terceiros', aliquota: 0, obs: 'recolhidos dentro do DAS (Anexo III)' });
  } else {
    const inss = p.desonerada ? 20 * fatorReoneracao(p.anoBase).folha : 20;
    itens.push(
      { nome: p.desonerada ? `INSS patronal (${fmt(inss)}% em ${p.anoBase} — reoneração gradual)` : 'INSS patronal', aliquota: inss },
      { nome: `RAT/SAT (${fmt(p.rat)}% × FAP ${fmt(p.fap)})`, aliquota: p.rat * p.fap },
      { nome: 'Terceiros (salário-educação, Sistema S, Sebrae, Incra)', aliquota: p.terceiros },
      { nome: 'FGTS', aliquota: p.fgts },
    );
  }
  return { itens, total: itens.reduce((a, i) => a + i.aliquota, 0) };
}

/** Horas disponíveis e produtivas por mês de um empregado (descontados feriados, férias e ausências). */
export function horasMes(p: ParametrosPreco): { disponiveis: number; produtivas: number; diasAno: number } {
  const diasAno = Math.max(0, 260 - p.feriadosAno - p.feriasDiasUteis - p.ausenciasDias);
  const disponiveis = (diasAno * (p.jornadaSemanal / 5)) / 12;
  return { diasAno, disponiveis, produtivas: (disponiveis * p.produtividade) / 100 };
}

export interface CustoCargo {
  remuneracao: number;
  periculosidade: number;
  insalubridade: number;
  modulo21: number;
  modulo22: number;
  grupoA: number;
  vt: number;
  va: number;
  modulo23: number;
  modulo3: number;
  insumos: number;
  total: number;
  horasProdutivas: number;
  custoHora: number;
}

/**
 * Custo mensal do empregado no padrão da planilha da IN 5/2017:
 * Módulo 1 (remuneração), 2.1 (13º, férias e 1/3), 2.2 (encargos sobre 1 + 2.1), 2.3 (benefícios),
 * 3 (provisão para rescisão) e insumos de pessoal. As ausências reduzem as horas produtivas.
 */
export function custoCargo(c: Partial<CargoPreco>, p: ParametrosPreco): CustoCargo {
  const salario = c.salarioBase || 0;
  const periculosidade = c.periculosidade ? salario * 0.3 : 0;
  const insalubridade = ((c.insalubridade || 0) / 100) * p.salarioMinimo;
  const remuneracao = salario + periculosidade + insalubridade + (c.outrosAdicionais || 0);
  const modulo21 = (remuneracao * (p.decimoTerceiro + p.feriasTerco)) / 100;
  const grupoA = encargosGrupoA(p).total;
  const modulo22 = ((remuneracao + modulo21) * grupoA) / 100;
  const dias = c.diasMes ?? 22;
  const vt = Math.max(0, (c.valeTransporteDia || 0) * dias - salario * 0.06);
  const va = (c.valeAlimentacaoDia || 0) * dias;
  const modulo23 = vt + va + (c.planoSaude || 0) + (c.seguroVida || 0) + (c.outrosBeneficios || 0);
  const modulo3 = (remuneracao * (p.avisoIndenizado + p.fgtsAvisoIndenizado + p.avisoTrabalhado * (1 + grupoA / 100) + p.multaFgts)) / 100;
  const insumos = (c.uniformeEpiMes || 0) + (c.examesTreinamentoMes || 0);
  const total = remuneracao + modulo21 + modulo22 + modulo23 + modulo3 + insumos;
  const horasProdutivas = horasMes(p).produtivas;
  return { remuneracao, periculosidade, insalubridade, modulo21, modulo22, grupoA, vt, va, modulo23, modulo3, insumos, total, horasProdutivas, custoHora: horasProdutivas > 0 ? total / horasProdutivas : 0 };
}

/* ===================== Horas técnicas pelo plano do PMOC ===================== */
export function execucoesAno(periodicidade: string): number {
  const p = PERIODICIDADES.find((x) => x.value === periodicidade);
  if (!p || p.meses < 0) return 0;
  return p.meses > 0 ? 12 / p.meses : p.vezesMes * 12;
}

/** Horas/mês de manutenção preventiva de um equipamento pelo plano (Σ tempo × execuções no ano ÷ 12). */
export function horasPlanoMes(plano?: Pick<PlanoManutencao, 'atividades'>): number {
  if (!plano) return 0;
  return plano.atividades.reduce((a, x) => a + (x.tempoMin || 0) * execucoesAno(x.periodicidade), 0) / 60 / 12;
}

export const FAIXAS_BTU: { id: string; label: string; max: number; fator: number }[] = [
  { id: 'ate12', label: 'até 12.000 BTU/h', max: 12000, fator: 1 },
  { id: 'ate24', label: '12.001 a 24.000 BTU/h', max: 24000, fator: 1.1 },
  { id: 'ate36', label: '24.001 a 36.000 BTU/h', max: 36000, fator: 1.25 },
  { id: 'ate60', label: '36.001 a 60.000 BTU/h', max: 60000, fator: 1.4 },
  { id: 'acima60', label: 'acima de 60.000 BTU/h', max: Infinity, fator: 1.6 },
];

export function faixaBtu(btu?: number) {
  if (!btu) return undefined;
  return FAIXAS_BTU.find((f) => btu <= f.max);
}

/* ===================== BDI (Acórdão TCU 2622/2013) ===================== */
/** Faixas de referência (1º e 3º quartis) do Acórdão 2622/2013 para obras de edificação — usadas como referência para serviços de engenharia. */
export const FAIXAS_BDI = {
  ac: [3, 5.5],
  sg: [0.8, 1],
  r: [0.97, 1.27],
  df: [0.59, 1.39],
  l: [6.16, 8.96],
  total: [20.34, 25],
} as const;

export function despesaFinanceira(b: Pick<BdiParams, 'prazoDias' | 'taxaMes'>): number {
  return (Math.pow(1 + (b.taxaMes || 0) / 100, (b.prazoDias || 0) / 30) - 1) * 100;
}

/** BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) ÷ (1 − I)] − 1 */
export function calcBdi(b: BdiParams, tributos: number): { bdi: number; df: number } {
  const df = despesaFinanceira(b);
  const bdi = (((1 + (b.ac + b.s + b.r + b.g) / 100) * (1 + df / 100) * (1 + b.l / 100)) / (1 - tributos / 100) - 1) * 100;
  return { bdi, df };
}

export type Farol = 'dentro' | 'abaixo' | 'acima';
export function farol(valor: number, faixa: readonly [number, number]): Farol {
  if (valor < faixa[0] - 1e-9) return 'abaixo';
  if (valor > faixa[1] + 1e-9) return 'acima';
  return 'dentro';
}

/* ===================== Estudo de preço (modelo por equipamento) ===================== */
export interface ResultadoItem {
  item: ItemEstudo;
  horasPreventivas: number;
  horasCorretivas: number;
  horasUnit: number;
  custoMO: number;
  materiais: number;
  rateio: number;
  custoDireto: number;
  precoUnit: number;
  precoUnitSemLucro: number;
  totalMensal: number;
}

export interface ResultadoEstudo {
  custoHoraEquipe: number;
  equipe: { cargoId: string; nome: string; quantidade: number; custoHora: number }[];
  tributos: TributosCalculo;
  bdi: number;
  df: number;
  bdiSemLucro: number;
  itens: ResultadoItem[];
  quantidade: number;
  horasMes: number;
  deslocamentoMensal: number;
  custosFixosMensal: number;
  custoDiretoMensal: number;
  precoMensal: number;
  precoAnual: number;
  precoVigencia: number;
  precoMensalComPorFora: number;
  lanceMinimoMensal: number;
  comparacao?: { pct: number; alertas: { nivel: 'info' | 'atencao' | 'critico'; texto: string }[]; garantiaAdicional: number };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function horasItem(it: ItemEstudo, planos: Map<string, Pick<PlanoManutencao, 'atividades'>>): { prev: number; corr: number; total: number } {
  const base = it.horasManual !== undefined && it.horasManual !== null && !Number.isNaN(it.horasManual) ? it.horasManual : horasPlanoMes(planos.get(it.planoId || ''));
  const prev = base * (it.fatorTempo || 1);
  const corr = (prev * (it.corretivaPct || 0)) / 100;
  return { prev, corr, total: prev + corr };
}

export function calcularEstudo(
  e: Pick<EstudoPreco, 'equipe' | 'itens' | 'deslocamento' | 'custosFixos' | 'rateio' | 'bdi' | 'issAliquota' | 'vigenciaMeses' | 'valorEstimadoMensal' | 'tipoServico'>,
  ctx: { params: ParametrosPreco; cargos: Map<string, CargoPreco>; planos: Map<string, Pick<PlanoManutencao, 'atividades'>> },
): ResultadoEstudo {
  const { params } = ctx;
  const equipe = e.equipe
    .map((m) => {
      const c = ctx.cargos.get(m.cargoId);
      return { cargoId: m.cargoId, nome: c?.nome || '—', quantidade: m.quantidade || 0, custoHora: c ? custoCargo(c, params).custoHora : 0 };
    })
    .filter((m) => m.quantidade > 0);
  const custoHoraEquipe = equipe.reduce((a, m) => a + m.custoHora * m.quantidade, 0);
  const tributos = tributosFaturamento(params, e.issAliquota);
  const { bdi, df } = calcBdi(e.bdi, tributos.total);
  const bdiSemLucro = calcBdi({ ...e.bdi, l: 0 }, tributos.total).bdi;

  const base = e.itens.map((it) => {
    const h = horasItem(it, ctx.planos);
    return { it, h, qtd: Math.max(0, it.quantidade || 0) };
  });
  const quantidade = base.reduce((a, b) => a + b.qtd, 0);
  const horasMesTotal = base.reduce((a, b) => a + b.h.total * b.qtd, 0);
  const d = e.deslocamento;
  const deslocamentoMensal = (d.visitasMes || 0) * ((d.minutosVisita || 0) / 60) * custoHoraEquipe + (d.kmMes || 0) * (d.custoKm || 0);
  const custosFixosMensal = e.custosFixos.reduce((a, c) => a + (c.valorMensal || 0), 0);
  const indiretos = deslocamentoMensal + custosFixosMensal;

  const itens: ResultadoItem[] = base.map(({ it, h, qtd }) => {
    const custoMO = h.total * custoHoraEquipe;
    const materiais = it.materiaisMes || 0;
    const rateio =
      qtd > 0
        ? e.rateio === 'equipamentos'
          ? quantidade > 0 ? indiretos / quantidade : 0
          : horasMesTotal > 0 ? (indiretos * (h.total * qtd)) / horasMesTotal / qtd : 0
        : 0;
    const custoDireto = custoMO + materiais + rateio;
    const precoUnit = round2(custoDireto * (1 + bdi / 100));
    return {
      item: it,
      horasPreventivas: h.prev,
      horasCorretivas: h.corr,
      horasUnit: h.total,
      custoMO,
      materiais,
      rateio,
      custoDireto,
      precoUnit,
      precoUnitSemLucro: round2(custoDireto * (1 + bdiSemLucro / 100)),
      totalMensal: round2(precoUnit * qtd),
    };
  });

  const precoMensal = round2(itens.reduce((a, i) => a + i.totalMensal, 0));
  const lanceMinimoMensal = round2(itens.reduce((a, i) => a + i.precoUnitSemLucro * Math.max(0, i.item.quantidade || 0), 0));
  const vig = Math.max(1, e.vigenciaMeses || 12);
  const res: ResultadoEstudo = {
    custoHoraEquipe,
    equipe,
    tributos,
    bdi,
    df,
    bdiSemLucro,
    itens,
    quantidade,
    horasMes: horasMesTotal,
    deslocamentoMensal,
    custosFixosMensal,
    custoDiretoMensal: itens.reduce((a, i) => a + i.custoDireto * Math.max(0, i.item.quantidade || 0), 0),
    precoMensal,
    precoAnual: round2(precoMensal * 12),
    precoVigencia: round2(precoMensal * vig),
    precoMensalComPorFora: round2(precoMensal * (1 + (tributos.porFora || 0) / 100)),
    lanceMinimoMensal,
  };
  if (e.valorEstimadoMensal && e.valorEstimadoMensal > 0) res.comparacao = analisarExequibilidade(precoMensal, e.valorEstimadoMensal, e.tipoServico, vig);
  return res;
}

/**
 * Comparação com o valor estimado pela Administração.
 * Engenharia: < 75% = presunção relativa de inexequibilidade (Lei 14.133, art. 59, §4º; TCU Ac. 465/2024 e 803/2024);
 * < 85% = garantia adicional (art. 59, §5º). Serviço comum: < 50% = indício (IN SEGES/ME 73/2022, art. 34).
 */
export function analisarExequibilidade(precoMensal: number, estimadoMensal: number, tipo: EstudoPreco['tipoServico'], vigenciaMeses: number) {
  const pct = (precoMensal / estimadoMensal) * 100;
  const alertas: { nivel: 'info' | 'atencao' | 'critico'; texto: string }[] = [];
  let garantiaAdicional = 0;
  if (pct > 100) alertas.push({ nivel: 'critico', texto: 'Acima do valor estimado: risco de desclassificação se o edital fixar o estimado como preço máximo.' });
  if (tipo === 'engenharia') {
    if (pct < 75) alertas.push({ nivel: 'critico', texto: 'Abaixo de 75% do orçado: presunção relativa de inexequibilidade (art. 59, §4º). Prepare a demonstração de exequibilidade para a diligência (TCU, Acórdãos 465/2024 e 803/2024).' });
    if (pct < 85) {
      garantiaAdicional = round2((estimadoMensal - precoMensal) * vigenciaMeses);
      alertas.push({ nivel: 'atencao', texto: `Abaixo de 85% do orçado: será exigida garantia adicional equivalente à diferença (art. 59, §5º).` });
    }
  } else if (pct < 50) {
    alertas.push({ nivel: 'critico', texto: 'Abaixo de 50% do estimado: indício de inexequibilidade, sujeito a diligência (IN SEGES/ME 73/2022, art. 34).' });
  }
  if (!alertas.length) alertas.push({ nivel: 'info', texto: 'Dentro dos limites de exequibilidade em relação ao valor estimado.' });
  return { pct, alertas, garantiaAdicional };
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** Razão entre o tempo real lançado nas OS e o tempo previsto das tarefas (calibração dos tempos-padrão). */
export function fatorHistorico(tarefas: { tempoPrevistoMin?: number; tempoRealMin?: number }[]): { fator: number; n: number } | null {
  let prev = 0;
  let real = 0;
  let n = 0;
  for (const t of tarefas) {
    if (!t.tempoPrevistoMin || !t.tempoRealMin) continue;
    prev += t.tempoPrevistoMin;
    real += t.tempoRealMin;
    n++;
  }
  return n >= 10 && prev > 0 ? { fator: real / prev, n } : null;
}
