import type {
  BdiMateriais,
  BdiParams,
  CargoPreco,
  CategoriaPessoal,
  ComposicaoCustos,
  EstudoPreco,
  ItemEstudo,
  ItemFerramenta,
  ItemInsumo,
  ItemPessoal,
  LinhaCusto,
  MarkupParams,
  MetodoPreco,
  ParametrosPreco,
  PlanoManutencao,
  ReferenciaTcu,
  RegimeTributario,
  VeiculoComposicao,
  VinculoCargo,
} from '../db/types';
import { PERIODICIDADES } from './catalogs';

/**
 * Motor de precificação de serviços de manutenção (licitações e contratos).
 * Referências: IN SEGES/MP 5/2017 (planilha de custos, aplicável à Lei 14.133 pela IN SEGES/ME 98/2022),
 * Acórdão TCU 2622/2013 (fórmula e faixas do BDI; BDI diferenciado de materiais — Súmula TCU 253),
 * LC 123/2006 (Simples Nacional, Anexo III, e MEI), Lei 14.973/2024 (reoneração gradual da folha),
 * LC 214/2025 (reforma tributária) e o markup divisor usado no mercado privado (Sebrae).
 */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const REGIMES: { value: RegimeTributario; label: string }[] = [
  { value: 'mei', label: 'MEI — Microempreendedor Individual (SIMEI)' },
  { value: 'simples', label: 'Simples Nacional — Anexo III (serviços de manutenção)' },
  { value: 'presumido', label: 'Lucro Presumido' },
  { value: 'real', label: 'Lucro Real' },
];

export const VINCULOS: { value: VinculoCargo; label: string; curto: string }[] = [
  { value: 'clt', label: 'Empregado CLT', curto: 'CLT' },
  { value: 'socio', label: 'Sócio ou titular (pró-labore)', curto: 'Pró-labore' },
  { value: 'autonomo', label: 'Autônomo / diarista (RPA)', curto: 'Autônomo' },
];
export const vinculoDe = (v?: VinculoCargo) => VINCULOS.find((x) => x.value === (v || 'clt')) || VINCULOS[0];

/* ===================== Listas sugeridas da composição de custos ===================== */
const f = (id: string, descricao: string, vidaUtilMeses: number, residualPct = 0): ItemFerramenta => ({ id, descricao, quantidade: 1, valorUnit: 0, vidaUtilMeses, residualPct, manutencaoAnual: 0 });
/** Kit básico de uma equipe de manutenção de climatização (valores a informar). */
export const FERRAMENTAS_SUGERIDAS: ItemFerramenta[] = [
  f('f-vacuo', 'Bomba de vácuo de duplo estágio', 48, 10),
  f('f-manifold', 'Manifold digital com sondas de temperatura', 48),
  f('f-balanca', 'Balança eletrônica para carga de fluido', 48),
  f('f-recolhedora', 'Recolhedora de fluido refrigerante', 60, 10),
  f('f-detector', 'Detector eletrônico de vazamentos', 48),
  f('f-vacuometro', 'Vacuômetro digital', 48),
  f('f-lavadora', 'Lavadora de alta pressão (higienização)', 36),
  f('f-alicate', 'Alicate amperímetro e multímetro', 48),
  f('f-medicao', 'Termo-higrômetro, termômetro infravermelho e anemômetro', 48),
  f('f-tubos', 'Kit flangeador, curvador, cortador e expansor de tubos', 36),
  f('f-furadeira', 'Furadeira e parafusadeira a bateria', 36),
  f('f-escada', 'Escadas (extensível e de abrir)', 60),
  f('f-nitrogenio', 'Cilindro de nitrogênio com regulador', 120),
  f('f-manuais', 'Ferramentas manuais (maleta completa)', 24),
  f('f-limpeza', 'Kit de higienização (bolsa coletora, pulverizador, escovas)', 12),
];

const pe = (id: string, categoria: CategoriaPessoal, descricao: string, qtdAno: number, ref?: string): ItemPessoal => ({ id, categoria, descricao, qtdAno, valorUnit: 0, ref });
/** Uniformes, EPI (NR-6), exames (NR-7) e treinamentos (NR-10, NR-35) por empregado. */
export const PESSOAL_SUGERIDO: ItemPessoal[] = [
  pe('p-camisa', 'uniforme', 'Camisa de uniforme', 4),
  pe('p-calca', 'uniforme', 'Calça de uniforme', 3),
  pe('p-botina', 'epi', 'Calçado de segurança sem componentes metálicos', 2, 'NR-6'),
  pe('p-oculos', 'epi', 'Óculos de proteção', 4, 'NR-6'),
  pe('p-luvas', 'epi', 'Luvas de proteção (vaqueta e nitrílica)', 24, 'NR-6'),
  pe('p-auricular', 'epi', 'Protetor auricular', 12, 'NR-6'),
  pe('p-pff2', 'epi', 'Respirador PFF2 (higienização)', 24, 'NR-6'),
  pe('p-capacete', 'epi', 'Capacete com jugular', 1, 'NR-35'),
  pe('p-cinto', 'epi', 'Cinturão paraquedista com talabarte duplo', 0.5, 'NR-35'),
  pe('p-aso', 'exame', 'ASO periódico e exames complementares (trabalho em altura)', 1, 'NR-7'),
  pe('p-admissao', 'exame', 'ASO admissional e demissional (rotatividade)', 0.3, 'NR-7'),
  pe('p-nr35', 'treinamento', 'Trabalho em altura — reciclagem a cada 2 anos', 0.5, 'NR-35'),
  pe('p-nr10', 'treinamento', 'Segurança em eletricidade — reciclagem a cada 2 anos', 0.5, 'NR-10'),
];

const ins = (id: string, descricao: string, unidade: string, consumoMes: number): ItemInsumo => ({ id, descricao, unidade, consumoMes, valorUnit: 0 });
/** Materiais de consumo por equipamento/mês (média de um split; ajuste à sua realidade). */
export const INSUMOS_SUGERIDOS: ItemInsumo[] = [
  ins('i-limpa', 'Limpador de serpentina (alcalino/ácido)', 'L', 0.08),
  ins('i-bactericida', 'Bactericida/fungicida para higienização', 'L', 0.05),
  ins('i-dreno', 'Pastilha ou tablete para bandeja e dreno', 'un', 0.5),
  ins('i-panos', 'Panos, estopa e sacos de lixo', 'vb', 1),
  ins('i-fitas', 'Fitas, abraçadeiras e isolamento térmico', 'vb', 1),
  ins('i-fluido', 'Fluido refrigerante para complemento (média)', 'kg', 0.03),
];

const adm = (descricao: string): LinhaCusto => ({ id: descricao, descricao, valorMensal: 0 });
/** Despesas fixas da empresa (administração central). */
export const ADMINISTRATIVAS_SUGERIDAS: LinhaCusto[] = [
  adm('Aluguel, condomínio e IPTU do escritório/oficina'),
  adm('Energia, água e internet'),
  adm('Telefonia'),
  adm('Contabilidade'),
  adm('Software de gestão e sistemas'),
  adm('Salários e encargos do pessoal administrativo'),
  adm('Pró-labore dos sócios (parcela administrativa)'),
  adm('Marketing, site e anúncios'),
  adm('Anuidades (CREA/CFT), alvarás e licenças'),
  adm('Seguro empresarial e de responsabilidade civil'),
  adm('Tarifas bancárias'),
  adm('Material de escritório e limpeza'),
];

export const VEICULO_PADRAO: VeiculoComposicao = {
  descricao: 'Veículo utilitário de atendimento',
  valorAquisicao: 0,
  vidaUtilAnos: 5,
  residualPct: 40,
  ipvaAnual: 0,
  seguroAnual: 0,
  outrosMensal: 0,
  capitalPctAno: 0,
  precoCombustivel: 0,
  consumoKmL: 10,
  manutencaoKm: 0,
  pneusKm: 0,
};

export const COMPOSICAO_PADRAO: ComposicaoCustos = {
  ferramentas: FERRAMENTAS_SUGERIDAS,
  pessoal: PESSOAL_SUGERIDO,
  insumos: INSUMOS_SUGERIDOS,
  veiculo: VEICULO_PADRAO,
  administrativas: ADMINISTRATIVAS_SUGERIDAS,
};

export const CUSTOS_CONTRATO_PADRAO: { descricao: string; valorMensal: number }[] = [
  { descricao: 'Responsável técnico (horas de engenharia) e ART/TRT', valorMensal: 0 },
  { descricao: 'Supervisão / administração local do contrato', valorMensal: 0 },
  { descricao: 'Seguro-garantia e despesas de habilitação', valorMensal: 0 },
];

/** Limite anual de faturamento do MEI (LC 123/2006, art. 18-A, §1º). */
export const MEI_LIMITE = 81000;

export const PARAMETROS_PADRAO: ParametrosPreco = {
  regime: 'simples',
  meiLimite: MEI_LIMITE,
  faturamentoMensal: 30000,
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
  metodo: 'tcu',
  referenciaTcu: 'edificacoes',
  bdi: { ac: 4, s: 0.4, r: 1, g: 0.4, l: 7, prazoDias: 30, taxaMes: 1 },
  markup: { comissaoPct: 0, cartaoPct: 0, inadimplenciaPct: 1, lucroPct: 10 },
  bdiMateriais: { ativo: false, ac: 3.45, s: 0.24, r: 0.85, g: 0.24, l: 5.11, lucroMarkup: 5 },
  composicao: COMPOSICAO_PADRAO,
  custosPadrao: CUSTOS_CONTRATO_PADRAO,
  materiaisPadraoMes: 0,
  custoKmPadrao: 0,
};

/** Linhas antigas de veículo e ferramentas, agora calculadas pela composição: saem quando estão zeradas. */
const LEGADO_CONTRATO = /^(Veículo de atendimento|Ferramentas e instrumentos|Celular, internet e software)/;

export function comPadroes(p?: Partial<ParametrosPreco> | null): ParametrosPreco {
  const c = p?.composicao;
  return {
    ...PARAMETROS_PADRAO,
    ...(p || {}),
    bdi: { ...PARAMETROS_PADRAO.bdi, ...(p?.bdi || {}) },
    markup: { ...PARAMETROS_PADRAO.markup, ...(p?.markup || {}) },
    bdiMateriais: { ...PARAMETROS_PADRAO.bdiMateriais, ...(p?.bdiMateriais || {}) },
    composicao: {
      ferramentas: c?.ferramentas || COMPOSICAO_PADRAO.ferramentas,
      pessoal: c?.pessoal || COMPOSICAO_PADRAO.pessoal,
      insumos: c?.insumos || COMPOSICAO_PADRAO.insumos,
      veiculo: { ...VEICULO_PADRAO, ...(c?.veiculo || {}) },
      administrativas: c?.administrativas || COMPOSICAO_PADRAO.administrativas,
    },
    custosPadrao: (p?.custosPadrao || CUSTOS_CONTRATO_PADRAO).filter((x) => x.valorMensal || !LEGADO_CONTRATO.test(x.descricao)),
  };
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

/** DAS mensal do MEI de serviços: 5% do salário mínimo (INSS) + R$ 5,00 (ISS). */
export function dasMei(p: Pick<ParametrosPreco, 'meiDas' | 'salarioMinimo'>): number {
  return p.meiDas ?? round2(p.salarioMinimo * 0.05 + 5);
}

export function tributosFaturamento(p: ParametrosPreco, issOverride?: number): TributosCalculo {
  const iss = issOverride ?? p.issAliquota;
  const itens: Tributo[] = [];
  let simples: SimplesCalculo | undefined;
  if (p.regime === 'mei') {
    itens.push({ nome: 'DAS-MEI: valor fixo mensal, não incide sobre o preço', aliquota: 0, obs: `R$ ${fmt(dasMei(p))}/mês, somado às despesas fixas` });
  } else if (p.regime === 'simples') {
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
  if (p.regime === 'mei') {
    itens.push({ nome: 'INSS patronal (CPP) do empregado do MEI', aliquota: 3, obs: 'LC 123, art. 18-C' }, { nome: 'FGTS', aliquota: p.fgts });
  } else if (p.regime === 'simples') {
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

/** INSS patronal sobre autônomos (contribuinte individual) pelo regime: dentro do DAS no Simples/MEI, 20% nos demais. */
export function inssAutonomoPadrao(p: ParametrosPreco): number {
  if (p.regime === 'mei' || p.regime === 'simples') return 0;
  return 20 * (p.desonerada ? fatorReoneracao(p.anoBase).folha : 1);
}

/** Contribuição patronal sobre a remuneração de quem não é empregado CLT (pró-labore ou RPA). */
export function encargoVinculo(v: VinculoCargo, p: ParametrosPreco): { aliquota: number; nome: string } {
  if (v === 'clt') return { aliquota: encargosGrupoA(p).total, nome: 'Encargos do Grupo A' };
  if (v === 'autonomo') {
    const nome = p.regime === 'mei' || p.regime === 'simples' ? 'Contribuição patronal sobre autônomo (dentro do DAS)' : 'INSS patronal sobre autônomo (RPA)';
    return { aliquota: p.inssAutonomo ?? inssAutonomoPadrao(p), nome };
  }
  if (p.regime === 'mei') return { aliquota: 0, nome: 'INSS do titular recolhido no DAS-MEI' };
  if (p.regime === 'simples') return { aliquota: 0, nome: 'CPP sobre pró-labore dentro do DAS (Anexo III)' };
  return { aliquota: 20 * (p.desonerada ? fatorReoneracao(p.anoBase).folha : 1), nome: 'INSS patronal sobre pró-labore' };
}

/* ===================== Composição de custos ===================== */
export const CATEGORIAS_PESSOAL: { value: CategoriaPessoal; label: string }[] = [
  { value: 'uniforme', label: 'Uniformes' },
  { value: 'epi', label: 'EPI' },
  { value: 'exame', label: 'Exames' },
  { value: 'treinamento', label: 'Treinamentos' },
];

export const pessoalMensal = (i: Pick<ItemPessoal, 'qtdAno' | 'valorUnit'>) => ((i.qtdAno || 0) * (i.valorUnit || 0)) / 12;

/** Uniformes, EPI, exames e treinamentos que se aplicam ao cargo (itens sem cargos marcados valem para todos). */
export function custoPessoalCargo(cargoId: string | undefined, comp: ComposicaoCustos): { itens: ItemPessoal[]; porCategoria: Record<CategoriaPessoal, number>; total: number } {
  const itens = comp.pessoal.filter((i) => !i.cargos?.length || (!!cargoId && i.cargos.includes(cargoId)));
  const porCategoria: Record<CategoriaPessoal, number> = { uniforme: 0, epi: 0, exame: 0, treinamento: 0 };
  for (const i of itens) porCategoria[i.categoria] += pessoalMensal(i);
  return { itens, porCategoria, total: Object.values(porCategoria).reduce((a, b) => a + b, 0) };
}

/** Cargos antigos com valores manuais continuam manuais; os demais usam a composição. */
export function modoInsumos(c: Partial<CargoPreco>): 'composicao' | 'manual' {
  return c.insumosModo ?? (c.uniformeEpiMes || c.examesTreinamentoMes ? 'manual' : 'composicao');
}

/** Depreciação linear (descontado o residual) + manutenção e calibração. */
export function ferramentaMensal(x: ItemFerramenta): number {
  const dep = x.vidaUtilMeses > 0 ? ((x.quantidade || 0) * (x.valorUnit || 0) * (1 - (x.residualPct || 0) / 100)) / x.vidaUtilMeses : 0;
  return dep + (x.manutencaoAnual || 0) / 12;
}

export function custoFerramentas(comp: ComposicaoCustos): { mensal: number; investimento: number } {
  return {
    mensal: comp.ferramentas.reduce((a, x) => a + ferramentaMensal(x), 0),
    investimento: comp.ferramentas.reduce((a, x) => a + (x.quantidade || 0) * (x.valorUnit || 0), 0),
  };
}

export interface CustoVeiculo {
  depreciacao: number;
  capital: number;
  impostosSeguro: number;
  outros: number;
  fixoMensal: number;
  combustivelKm: number;
  variavelKm: number;
}

/** Custo fixo mensal (depreciação, capital, IPVA, seguro, outros) e variável por km (combustível, manutenção, pneus). */
export function custoVeiculo(v: VeiculoComposicao): CustoVeiculo {
  const valor = v.valorAquisicao || 0;
  const residual = (valor * (v.residualPct || 0)) / 100;
  const depreciacao = v.vidaUtilAnos > 0 ? (valor - residual) / (v.vidaUtilAnos * 12) : 0;
  const capital = (((valor + residual) / 2) * (v.capitalPctAno || 0)) / 100 / 12;
  const impostosSeguro = ((v.ipvaAnual || 0) + (v.seguroAnual || 0)) / 12;
  const outros = v.outrosMensal || 0;
  const combustivelKm = v.consumoKmL > 0 ? (v.precoCombustivel || 0) / v.consumoKmL : 0;
  return { depreciacao, capital, impostosSeguro, outros, fixoMensal: depreciacao + capital + impostosSeguro + outros, combustivelKm, variavelKm: combustivelKm + (v.manutencaoKm || 0) + (v.pneusKm || 0) };
}

export const insumoMensal = (i: Pick<ItemInsumo, 'consumoMes' | 'valorUnit'>) => (i.consumoMes || 0) * (i.valorUnit || 0);
export const insumosPorEquipamento = (comp: ComposicaoCustos) => comp.insumos.reduce((a, i) => a + insumoMensal(i), 0);

/** Materiais por equipamento/mês sugeridos para um item do estudo (composição × fator de porte). */
export function materiaisSugeridos(p: ParametrosPreco, fator = 1): number {
  return round2((insumosPorEquipamento(p.composicao) || p.materiaisPadraoMes || 0) * (fator || 1));
}

/** Custo/km do veículo da composição (ou o valor informado direto, nas configurações antigas). */
export const custoKmSugerido = (p: ParametrosPreco) => round2(custoVeiculo(p.composicao.veiculo).variavelKm || p.custoKmPadrao || 0);

/** Despesas fixas da empresa (+ DAS do MEI) e o peso delas sobre o faturamento médio. */
export function despesasFixas(p: ParametrosPreco): { itens: LinhaCusto[]; total: number; pct: number } {
  const itens = p.composicao.administrativas.filter((x) => x.valorMensal);
  if (p.regime === 'mei') itens.push({ id: 'das-mei', descricao: 'DAS-MEI (INSS do titular + ISS)', valorMensal: dasMei(p) });
  const total = itens.reduce((a, x) => a + (x.valorMensal || 0), 0);
  return { itens, total, pct: p.faturamentoMensal > 0 ? (total / p.faturamentoMensal) * 100 : 0 };
}

/** Horas disponíveis e produtivas por mês de um empregado (descontados feriados, férias e ausências). */
export function horasMes(p: ParametrosPreco): { disponiveis: number; produtivas: number; diasAno: number } {
  const diasAno = Math.max(0, 260 - p.feriadosAno - p.feriasDiasUteis - p.ausenciasDias);
  const disponiveis = (diasAno * (p.jornadaSemanal / 5)) / 12;
  return { diasAno, disponiveis, produtivas: (disponiveis * p.produtividade) / 100 };
}

export interface CustoCargo {
  vinculo: VinculoCargo;
  remuneracao: number;
  periculosidade: number;
  insalubridade: number;
  modulo21: number;
  modulo22: number;
  /** % de encargos aplicado no submódulo 2.2 (ou sobre o pró-labore/RPA) */
  grupoA: number;
  encargoNome: string;
  vt: number;
  va: number;
  modulo23: number;
  modulo3: number;
  insumos: number;
  insumosModo: 'composicao' | 'manual';
  insumosDetalhe?: Record<CategoriaPessoal, number>;
  total: number;
  horasProdutivas: number;
  custoHora: number;
}

/**
 * Custo mensal de quem executa o serviço.
 * CLT — planilha da IN 5/2017: Módulo 1 (remuneração), 2.1 (13º, férias e 1/3), 2.2 (encargos sobre 1 + 2.1),
 * 2.3 (benefícios), 3 (provisão para rescisão) e insumos de pessoal.
 * Pró-labore e autônomo — remuneração + contribuição patronal do regime + benefícios + insumos (sem provisões trabalhistas).
 * As ausências reduzem as horas produtivas.
 */
export function custoCargo(c: Partial<CargoPreco>, p: ParametrosPreco): CustoCargo {
  const vinculo = c.vinculo || 'clt';
  const salario = c.salarioBase || 0;
  const dias = c.diasMes ?? 22;
  const insumosModo = modoInsumos(c);
  const pess = insumosModo === 'composicao' ? custoPessoalCargo(c.id, p.composicao) : undefined;
  const insumos = pess ? pess.total : (c.uniformeEpiMes || 0) + (c.examesTreinamentoMes || 0);
  const horasProdutivas = horasMes(p).produtivas;
  const fechar = (k: Omit<CustoCargo, 'vinculo' | 'insumos' | 'insumosModo' | 'insumosDetalhe' | 'total' | 'horasProdutivas' | 'custoHora'>): CustoCargo => {
    const total = k.remuneracao + k.modulo21 + k.modulo22 + k.modulo23 + k.modulo3 + insumos;
    return { ...k, vinculo, insumos, insumosModo, insumosDetalhe: pess?.porCategoria, total, horasProdutivas, custoHora: horasProdutivas > 0 ? total / horasProdutivas : 0 };
  };
  if (vinculo !== 'clt') {
    const remuneracao = salario + (c.outrosAdicionais || 0);
    const enc = encargoVinculo(vinculo, p);
    const vt = vinculo === 'autonomo' ? (c.valeTransporteDia || 0) * dias : 0;
    const va = vinculo === 'autonomo' ? (c.valeAlimentacaoDia || 0) * dias : 0;
    return fechar({
      remuneracao,
      periculosidade: 0,
      insalubridade: 0,
      modulo21: 0,
      modulo22: (remuneracao * enc.aliquota) / 100,
      grupoA: enc.aliquota,
      encargoNome: enc.nome,
      vt,
      va,
      modulo23: vt + va + (c.planoSaude || 0) + (c.seguroVida || 0) + (c.outrosBeneficios || 0),
      modulo3: 0,
    });
  }
  const periculosidade = c.periculosidade ? salario * 0.3 : 0;
  const insalubridade = ((c.insalubridade || 0) / 100) * p.salarioMinimo;
  const remuneracao = salario + periculosidade + insalubridade + (c.outrosAdicionais || 0);
  const modulo21 = (remuneracao * (p.decimoTerceiro + p.feriasTerco)) / 100;
  const grupoA = encargosGrupoA(p).total;
  const vt = Math.max(0, (c.valeTransporteDia || 0) * dias - salario * 0.06);
  const va = (c.valeAlimentacaoDia || 0) * dias;
  return fechar({
    remuneracao,
    periculosidade,
    insalubridade,
    modulo21,
    modulo22: ((remuneracao + modulo21) * grupoA) / 100,
    grupoA,
    encargoNome: 'Encargos do Grupo A',
    vt,
    va,
    modulo23: vt + va + (c.planoSaude || 0) + (c.seguroVida || 0) + (c.outrosBeneficios || 0),
    modulo3: (remuneracao * (p.avisoIndenizado + p.fgtsAvisoIndenizado + p.avisoTrabalhado * (1 + grupoA / 100) + p.multaFgts)) / 100,
  });
}

/** Ferramentas e veículo da composição por hora produtiva da equipe. */
export function custosHora(p: ParametrosPreco): { ferramentas: number; veiculo: number; horas: number } {
  const horas = horasMes(p).produtivas;
  if (horas <= 0) return { ferramentas: 0, veiculo: 0, horas };
  return { ferramentas: custoFerramentas(p.composicao).mensal / horas, veiculo: custoVeiculo(p.composicao.veiculo).fixoMensal / horas, horas };
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
export type Quartis = readonly [number, number, number];
export interface ReferenciaBdi {
  label: string;
  ac: Quartis;
  sg: Quartis;
  r: Quartis;
  df: Quartis;
  l: Quartis;
  total: Quartis;
}

/** 1º quartil, médio e 3º quartil do Acórdão TCU 2622/2013-Plenário, por tipo de obra/serviço. */
export const REFERENCIAS_BDI: Record<ReferenciaTcu | 'materiais', ReferenciaBdi> = {
  edificacoes: { label: 'Construção e manutenção de edificações', ac: [3, 4, 5.5], sg: [0.8, 0.8, 1], r: [0.97, 1.27, 1.27], df: [0.59, 1.23, 1.39], l: [6.16, 7.4, 8.96], total: [20.34, 22.12, 25] },
  energia: { label: 'Estações e redes de distribuição de energia elétrica', ac: [5.29, 5.92, 7.93], sg: [0.25, 0.51, 0.56], r: [1, 1.48, 1.97], df: [1.01, 1.07, 1.11], l: [8, 8.31, 9.51], total: [24, 25.84, 27.86] },
  materiais: { label: 'Fornecimento de materiais e equipamentos (BDI diferenciado)', ac: [1.5, 3.45, 4.49], sg: [0.3, 0.48, 0.82], r: [0.56, 0.85, 0.89], df: [0.85, 0.85, 1.11], l: [3.5, 5.11, 6.22], total: [11.1, 14.02, 16.8] },
};

/** Faixa entre o 1º e o 3º quartil. */
export const faixaQ = (q: Quartis): readonly [number, number] => [q[0], q[2]];

/** Faixas de edificações (compatibilidade). */
export const FAIXAS_BDI = {
  ac: faixaQ(REFERENCIAS_BDI.edificacoes.ac),
  sg: faixaQ(REFERENCIAS_BDI.edificacoes.sg),
  r: faixaQ(REFERENCIAS_BDI.edificacoes.r),
  df: faixaQ(REFERENCIAS_BDI.edificacoes.df),
  l: faixaQ(REFERENCIAS_BDI.edificacoes.l),
  total: faixaQ(REFERENCIAS_BDI.edificacoes.total),
} as const;

/** Componentes de um quartil da referência (S e G dividem a parcela de seguro + garantia). */
export function componentesDoQuartil(ref: ReferenciaBdi, k: 0 | 1 | 2): Pick<BdiParams, 'ac' | 's' | 'r' | 'g' | 'l'> {
  return { ac: ref.ac[k], s: round2(ref.sg[k] / 2), g: round2(ref.sg[k] - round2(ref.sg[k] / 2)), r: ref.r[k], l: ref.l[k] };
}

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

/* ===================== Markup (mercado privado) ===================== */
export interface CalculoMarkup {
  tributos: number;
  despesasFixas: number;
  variaveis: number;
  lucro: number;
  soma: number;
  divisor: number;
  multiplicador: number;
  /** BDI equivalente sobre o custo direto (%) */
  bdi: number;
  valido: boolean;
}

/**
 * Markup divisor: preço = custo direto ÷ [1 − (tributos + despesas fixas + despesas variáveis + lucro)],
 * todos em % do preço de venda. Multiplicador = 1 ÷ divisor; BDI equivalente = multiplicador − 1.
 */
export function calcMarkup(m: MarkupParams, tributos: number, despesasFixasPct: number, lucro = m.lucroPct): CalculoMarkup {
  const variaveis = (m.comissaoPct || 0) + (m.cartaoPct || 0) + (m.inadimplenciaPct || 0);
  const soma = tributos + despesasFixasPct + variaveis + (lucro || 0);
  const valido = soma < 95;
  const divisor = Math.max(0.05, 1 - soma / 100);
  const multiplicador = 1 / divisor;
  return { tributos, despesasFixas: despesasFixasPct, variaveis, lucro: lucro || 0, soma, divisor, multiplicador, bdi: (multiplicador - 1) * 100, valido };
}

/* ===================== Formação do preço (BDI do TCU ou markup) ===================== */
export interface FormacaoPreco {
  metodo: MetodoPreco;
  referencia: ReferenciaBdi;
  bdi: number;
  bdiSemLucro: number;
  /** Despesa financeira do BDI do TCU */
  df: number;
  markup?: CalculoMarkup;
  /** Despesas fixas usadas no markup (% do faturamento) e se vieram da composição */
  despesasFixasPct?: number;
  despesasFixasCalculadas?: boolean;
  materiais: { ativo: boolean; bdi: number; bdiSemLucro: number; markup?: CalculoMarkup };
}

type CamposFormacao = Pick<EstudoPreco, 'metodo' | 'referenciaTcu' | 'bdi' | 'markup' | 'bdiMateriais'>;

export function formacaoPreco(e: CamposFormacao, p: ParametrosPreco, tributos: number): FormacaoPreco {
  const metodo = e.metodo || 'tcu';
  const referencia = REFERENCIAS_BDI[e.referenciaTcu || p.referenciaTcu || 'edificacoes'];
  const bm: BdiMateriais | undefined = e.bdiMateriais;
  if (metodo === 'markup') {
    const m: MarkupParams = { ...p.markup, ...(e.markup || {}) };
    const calculadas = m.despesasFixasPct === undefined || m.despesasFixasPct === null;
    const dfPct = calculadas ? despesasFixas(p).pct : (m.despesasFixasPct as number);
    const mk = calcMarkup(m, tributos, dfPct);
    const mk0 = calcMarkup(m, tributos, dfPct, 0);
    // materiais com margem própria: sem rateio das despesas fixas, com tributos e despesas variáveis
    const mkMat = bm?.ativo ? calcMarkup(m, tributos, 0, bm.lucroMarkup) : undefined;
    const mkMat0 = bm?.ativo ? calcMarkup(m, tributos, 0, 0) : undefined;
    return {
      metodo,
      referencia,
      bdi: mk.bdi,
      bdiSemLucro: mk0.bdi,
      df: 0,
      markup: mk,
      despesasFixasPct: dfPct,
      despesasFixasCalculadas: calculadas,
      materiais: mkMat && mkMat0 ? { ativo: true, bdi: mkMat.bdi, bdiSemLucro: mkMat0.bdi, markup: mkMat } : { ativo: false, bdi: mk.bdi, bdiSemLucro: mk0.bdi },
    };
  }
  const { bdi, df } = calcBdi(e.bdi, tributos);
  const bdiSemLucro = calcBdi({ ...e.bdi, l: 0 }, tributos).bdi;
  let materiais: FormacaoPreco['materiais'] = { ativo: false, bdi, bdiSemLucro };
  if (bm?.ativo) {
    const b2: BdiParams = { ac: bm.ac, s: bm.s, r: bm.r, g: bm.g, l: bm.l, prazoDias: e.bdi.prazoDias, taxaMes: e.bdi.taxaMes };
    materiais = { ativo: true, bdi: calcBdi(b2, tributos).bdi, bdiSemLucro: calcBdi({ ...b2, l: 0 }, tributos).bdi };
  }
  return { metodo, referencia, bdi, bdiSemLucro, df, materiais };
}

/* ===================== Estudo de preço (modelo por equipamento) ===================== */
export interface ResultadoItem {
  item: ItemEstudo;
  horasPreventivas: number;
  horasCorretivas: number;
  horasUnit: number;
  custoMO: number;
  /** Ferramentas e veículo (custo por hora da composição × horas) */
  custoEquip: number;
  materiais: number;
  rateio: number;
  custoDireto: number;
  precoUnit: number;
  precoUnitSemLucro: number;
  totalMensal: number;
}

export interface AlertaPreco {
  nivel: 'info' | 'atencao' | 'critico';
  texto: string;
}

export interface ResultadoEstudo {
  custoHoraEquipe: number;
  equipe: { cargoId: string; nome: string; quantidade: number; custoHora: number; vinculo: VinculoCargo }[];
  /** Ferramentas e veículo por hora (já multiplicados pela quantidade de kits/veículos) */
  ferramentasHora: number;
  veiculoHora: number;
  custoHoraOperacional: number;
  precoHoraTecnica: number;
  tributos: TributosCalculo;
  formacao: FormacaoPreco;
  bdi: number;
  df: number;
  bdiSemLucro: number;
  itens: ResultadoItem[];
  quantidade: number;
  horasMes: number;
  maoDeObraMensal: number;
  equipamentosMensal: number;
  materiaisMensal: number;
  deslocamentoMensal: number;
  custosFixosMensal: number;
  custoDiretoMensal: number;
  precoMensal: number;
  precoAnual: number;
  precoVigencia: number;
  precoMensalComPorFora: number;
  lanceMinimoMensal: number;
  alertasRegime: AlertaPreco[];
  comparacao?: { pct: number; alertas: AlertaPreco[]; garantiaAdicional: number };
}

export function horasItem(it: ItemEstudo, planos: Map<string, Pick<PlanoManutencao, 'atividades'>>): { prev: number; corr: number; total: number } {
  const base = it.horasManual !== undefined && it.horasManual !== null && !Number.isNaN(it.horasManual) ? it.horasManual : horasPlanoMes(planos.get(it.planoId || ''));
  const prev = base * (it.fatorTempo || 1);
  const corr = (prev * (it.corretivaPct || 0)) / 100;
  return { prev, corr, total: prev + corr };
}

type CamposEstudo = Pick<
  EstudoPreco,
  'equipe' | 'itens' | 'deslocamento' | 'custosFixos' | 'rateio' | 'bdi' | 'issAliquota' | 'vigenciaMeses' | 'valorEstimadoMensal' | 'tipoServico' | 'metodo' | 'referenciaTcu' | 'markup' | 'bdiMateriais' | 'kits' | 'veiculos'
>;

export function calcularEstudo(e: CamposEstudo, ctx: { params: ParametrosPreco; cargos: Map<string, CargoPreco>; planos: Map<string, Pick<PlanoManutencao, 'atividades'>> }): ResultadoEstudo {
  const { params } = ctx;
  const equipe = e.equipe
    .map((m) => {
      const c = ctx.cargos.get(m.cargoId);
      return { cargoId: m.cargoId, nome: c?.nome || '—', quantidade: m.quantidade || 0, custoHora: c ? custoCargo(c, params).custoHora : 0, vinculo: (c?.vinculo || 'clt') as VinculoCargo };
    })
    .filter((m) => m.quantidade > 0);
  const custoHoraEquipe = equipe.reduce((a, m) => a + m.custoHora * m.quantidade, 0);
  const ch = custosHora(params);
  const ferramentasHora = ch.ferramentas * Math.max(0, e.kits || 0);
  const veiculoHora = ch.veiculo * Math.max(0, e.veiculos || 0);
  const tributos = tributosFaturamento(params, e.issAliquota);
  const formacao = formacaoPreco(e, params, tributos.total);
  const { bdi, bdiSemLucro } = formacao;
  const mat = formacao.materiais;

  const base = e.itens.map((it) => ({ it, h: horasItem(it, ctx.planos), qtd: Math.max(0, it.quantidade || 0) }));
  const quantidade = base.reduce((a, b) => a + b.qtd, 0);
  const horasMesTotal = base.reduce((a, b) => a + b.h.total * b.qtd, 0);
  const d = e.deslocamento;
  const deslocamentoMensal = (d.visitasMes || 0) * ((d.minutosVisita || 0) / 60) * custoHoraEquipe + (d.kmMes || 0) * (d.custoKm || 0);
  const custosFixosMensal = e.custosFixos.reduce((a, c) => a + (c.valorMensal || 0), 0);
  const indiretos = deslocamentoMensal + custosFixosMensal;

  const itens: ResultadoItem[] = base.map(({ it, h, qtd }) => {
    const custoMO = h.total * custoHoraEquipe;
    const custoEquip = h.total * (ferramentasHora + veiculoHora);
    const materiais = it.materiaisMes || 0;
    const rateio =
      qtd > 0
        ? e.rateio === 'equipamentos'
          ? quantidade > 0 ? indiretos / quantidade : 0
          : horasMesTotal > 0 ? (indiretos * (h.total * qtd)) / horasMesTotal / qtd : 0
        : 0;
    const servicos = custoMO + custoEquip + rateio;
    const custoDireto = servicos + materiais;
    const precoUnit = round2(servicos * (1 + bdi / 100) + materiais * (1 + mat.bdi / 100));
    return {
      item: it,
      horasPreventivas: h.prev,
      horasCorretivas: h.corr,
      horasUnit: h.total,
      custoMO,
      custoEquip,
      materiais,
      rateio,
      custoDireto,
      precoUnit,
      precoUnitSemLucro: round2(servicos * (1 + bdiSemLucro / 100) + materiais * (1 + mat.bdiSemLucro / 100)),
      totalMensal: round2(precoUnit * qtd),
    };
  });

  const soma = (k: 'custoMO' | 'custoEquip' | 'materiais' | 'custoDireto') => itens.reduce((a, i) => a + i[k] * Math.max(0, i.item.quantidade || 0), 0);
  const precoMensal = round2(itens.reduce((a, i) => a + i.totalMensal, 0));
  const lanceMinimoMensal = round2(itens.reduce((a, i) => a + i.precoUnitSemLucro * Math.max(0, i.item.quantidade || 0), 0));
  const vig = Math.max(1, e.vigenciaMeses || 12);
  const custoHoraOperacional = custoHoraEquipe + ferramentasHora + veiculoHora;
  const res: ResultadoEstudo = {
    custoHoraEquipe,
    equipe,
    ferramentasHora,
    veiculoHora,
    custoHoraOperacional,
    precoHoraTecnica: round2(custoHoraOperacional * (1 + bdi / 100)),
    tributos,
    formacao,
    bdi,
    df: formacao.df,
    bdiSemLucro,
    itens,
    quantidade,
    horasMes: horasMesTotal,
    maoDeObraMensal: soma('custoMO'),
    equipamentosMensal: soma('custoEquip'),
    materiaisMensal: soma('materiais'),
    deslocamentoMensal,
    custosFixosMensal,
    custoDiretoMensal: soma('custoDireto'),
    precoMensal,
    precoAnual: round2(precoMensal * 12),
    precoVigencia: round2(precoMensal * vig),
    precoMensalComPorFora: round2(precoMensal * (1 + (tributos.porFora || 0) / 100)),
    lanceMinimoMensal,
    alertasRegime: alertasDoRegime(params, round2(precoMensal * 12), equipe, formacao),
  };
  if (e.valorEstimadoMensal && e.valorEstimadoMensal > 0) res.comparacao = analisarExequibilidade(precoMensal, e.valorEstimadoMensal, e.tipoServico, vig);
  return res;
}

/** Alertas do regime tributário e do método (limite do MEI, empregado único, markup inviável). */
export function alertasDoRegime(p: ParametrosPreco, precoAnual: number, equipe: { quantidade: number; vinculo: VinculoCargo }[], formacao: FormacaoPreco): AlertaPreco[] {
  const a: AlertaPreco[] = [];
  if (formacao.markup && !formacao.markup.valido) a.push({ nivel: 'critico', texto: 'A soma de tributos, despesas e lucro chegou a 95% do preço: o markup ficou inviável. Revise os percentuais.' });
  if (p.regime !== 'mei') return a;
  const limite = p.meiLimite || MEI_LIMITE;
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (precoAnual > limite * 1.2) {
    a.push({ nivel: 'critico', texto: `Só este contrato fatura ${brl(precoAnual)} por ano, mais de 20% acima do limite do MEI (${brl(limite)}): o desenquadramento retroage a 1º de janeiro e a empresa passa a recolher como ME no Simples Nacional. Precifique como Simples Nacional.` });
  } else if (precoAnual > limite) {
    a.push({ nivel: 'critico', texto: `Só este contrato fatura ${brl(precoAnual)} por ano, acima do limite do MEI (${brl(limite)}). O excesso de até 20% é tributado à parte e a empresa deixa o MEI no ano seguinte.` });
  } else if (precoAnual > limite * 0.5) {
    a.push({ nivel: 'atencao', texto: `Este contrato representa ${Math.round((precoAnual / limite) * 100)}% do limite anual do MEI (${brl(limite)}). Some com o restante do faturamento antes de assumir.` });
  }
  const empregados = equipe.filter((m) => m.vinculo === 'clt').reduce((s, m) => s + m.quantidade, 0);
  if (empregados > 1) a.push({ nivel: 'atencao', texto: 'O MEI pode ter apenas um empregado (LC 123/2006, art. 18-C). Cadastre o titular como “sócio ou titular (pró-labore)”.' });
  return a;
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
