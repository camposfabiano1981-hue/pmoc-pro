export type ID = string;

export interface Base {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

export type Periodicidade =
  | 'diaria'
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'quadrimestral'
  | 'semestral'
  | 'anual'
  | 'na';

export interface Cliente extends Base {
  nome: string;
  fantasia?: string;
  tipoPessoa: 'PJ' | 'PF';
  cpfCnpj?: string;
  ie?: string;
  email?: string;
  telefone?: string;
  contato?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  observacoes?: string;
  ativo: boolean;
}

/** Unidade de manutenção / edificação atendida pelo PMOC */
export interface Unidade extends Base {
  clienteId: ID;
  nome: string;
  tipoEdificacao?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
  responsavelLocal?: string;
  areaConstruida?: number;
  latitude?: string;
  longitude?: string;
  observacoes?: string;
  ativo: boolean;
}

/** Ambiente climatizado (Relação de Ambientes do PMOC) */
export interface Ambiente extends Base {
  unidadeId: ID;
  grupo?: string;
  nome: string;
  localizacao?: string;
  pavimento?: string;
  tipoAtividade?: string;
  ocupantesFixos?: number;
  ocupantesFlutuantes?: number;
  areaM2?: number;
  peDireito?: number;
  centroCusto?: string;
  observacoes?: string;
}

export type StatusEquipamento = 'operando' | 'parado' | 'manutencao' | 'desativado';

export interface Equipamento extends Base {
  tag: string;
  unidadeId: ID;
  ambienteId?: ID;
  tipo: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  patrimonio?: string;
  capacidadeBtu?: number;
  tecnologia?: string;
  tensao?: string;
  fases?: string;
  correnteNominal?: number;
  potenciaW?: number;
  fluido?: string;
  cargaFluidoKg?: number;
  modeloCondensadora?: string;
  serieCondensadora?: string;
  localCondensadora?: string;
  dataFabricacao?: string;
  dataInstalacao?: string;
  garantiaAte?: string;
  criticidade: 'A' | 'B' | 'C';
  centroCusto?: string;
  status: StatusEquipamento;
  planoId?: ID;
  /** Data da 1ª execução prevista das rotinas ao aplicar o plano */
  inicioPlano?: string;
  foto?: string;
  observacoes?: string;
}

/**
 * Rotina de manutenção do equipamento (atividade × periodicidade própria).
 * O controle de periodicidade é feito por equipamento: cada rotina guarda a
 * última execução e calcula a próxima (última + intervalo em dias).
 */
export interface Rotina extends Base {
  equipamentoId: ID;
  planoId?: ID;
  atividadeId?: ID;
  grupo: string;
  descricao: string;
  tipo: 'check' | 'medicao';
  unidade?: string;
  min?: number;
  max?: number;
  periodicidade: Periodicidade;
  intervaloDias: number;
  tempoMin: number;
  setor?: string;
  responsavelId?: ID;
  material?: string;
  ultimaExecucao?: string;
  proximaExecucao: string;
  reprogramada?: boolean;
  personalizada?: boolean;
  ativa: boolean;
  ordem?: number;
}

/** Registro de execução de uma rotina (histórico por equipamento). */
export interface Execucao extends Base {
  rotinaId: ID;
  equipamentoId: ID;
  osId?: ID;
  data: string;
  status: 'E' | 'N' | 'P';
  executorId?: ID;
  valor?: string;
  condicao?: ResultadoItem;
  obs?: string;
  tempoRealMin?: number;
}

export interface AtividadePlano {
  id: ID;
  grupo: string;
  descricao: string;
  periodicidade: Periodicidade;
  tempoMin: number;
  tipo: 'check' | 'medicao';
  unidade?: string;
  min?: number;
  max?: number;
}

export interface PlanoManutencao extends Base {
  nome: string;
  descricao?: string;
  tiposEquipamento: string[];
  norma?: string;
  atividades: AtividadePlano[];
}

export interface Certificacao {
  nome: string;
  numero?: string;
  emissao?: string;
  validade?: string;
}

export interface Profissional extends Base {
  nome: string;
  cpf?: string;
  funcao: string;
  conselho?: string;
  registro?: string;
  especialidades?: string;
  telefone?: string;
  email?: string;
  valorHora?: number;
  cor?: string;
  /** Perfil de acesso: técnico lança execuções; supervisor libera OS; gestor administra tudo */
  perfil?: 'tecnico' | 'supervisor' | 'gestor';
  pin?: string;
  setor?: string;
  admissao?: string;
  asoValidade?: string;
  cnhValidade?: string;
  certificacoes: Certificacao[];
  ativo: boolean;
  observacoes?: string;
}

export interface Peca extends Base {
  codigo: string;
  descricao: string;
  categoria?: string;
  unidade: string;
  marca?: string;
  referencia?: string;
  ncm?: string;
  custo: number;
  precoVenda: number;
  estoque: number;
  estoqueMinimo: number;
  localizacao?: string;
  fornecedorId?: ID;
  ativo: boolean;
  observacoes?: string;
}

export interface MovEstoque extends Base {
  pecaId: ID;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  custoUnit?: number;
  data: string;
  documento?: string;
  osId?: ID;
  observacoes?: string;
}

export interface Servico extends Base {
  codigo: string;
  descricao: string;
  categoria?: string;
  unidade: string;
  tempoPadraoMin?: number;
  preco: number;
  detalhes?: string;
  ativo: boolean;
}

export interface Fornecedor extends Base {
  nome: string;
  cnpj?: string;
  categoria?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  observacoes?: string;
}

export interface Contrato extends Base {
  numero: string;
  clienteId: ID;
  objeto: string;
  inicio: string;
  fim: string;
  valorMensal: number;
  diaVencimento?: number;
  slaUrgenteH?: number;
  slaAltaH?: number;
  slaMediaH?: number;
  slaBaixaH?: number;
  status: 'ativo' | 'suspenso' | 'encerrado';
  observacoes?: string;
  /** Modelo do instrumento: particular (Código Civil) ou administrativo (Lei 14.133/2021) */
  modelo?: 'privado' | 'publico';
  tipoServico?: string;
  /** Locais atendidos; vazio = todas as unidades do cliente */
  unidadesIds?: ID[];
  rtId?: ID;
  periodicidadeVisitas?: string;
  horarioAtendimento?: string;
  atendimento24h?: boolean;
  pecasInclusas?: 'nao' | 'sim' | 'limite';
  limitePecasMensal?: number;
  fluidoIncluso?: boolean;
  analiseArInclusa?: boolean;
  formaPagamento?: string;
  reajusteIndice?: string;
  renovacaoAutomatica?: boolean;
  avisoPrevioDias?: number;
  multaAtrasoPct?: number;
  jurosMesPct?: number;
  multaRescisaoPct?: number;
  descontoSlaPct?: number;
  garantiaDias?: number;
  foro?: string;
  localAssinatura?: string;
  dataAssinatura?: string;
  representanteContratante?: string;
  representanteContratada?: string;
  testemunha1?: string;
  testemunha2?: string;
  clausulasAdicionais?: string;
  /* Administração pública (Lei 14.133/2021) */
  processo?: string;
  licitacao?: string;
  dotacao?: string;
  gestorContrato?: string;
  fiscalContrato?: string;
  garantiaContratualPct?: number;
}

export interface Pmoc extends Base {
  codigo: string;
  unidadeId: ID;
  contratoId?: ID;
  rtId?: ID;
  artTipo?: string;
  artNumero?: string;
  artInicio?: string;
  artFim?: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  revisao: number;
  status: 'rascunho' | 'vigente' | 'vencido' | 'cancelado';
  sistemas?: string;
  recomendacoes?: string;
  observacoes?: string;
}

export type ResultadoItem = '' | 'ok' | 'nok' | 'corrigido' | 'na';

export type StatusExecucao = '' | 'E' | 'P' | 'N';

export interface ItemChecklist {
  rotinaId?: ID;
  atividadeId?: ID;
  grupo?: string;
  descricao: string;
  periodicidade?: Periodicidade;
  tipo: 'check' | 'medicao';
  unidade?: string;
  min?: number;
  max?: number;
  resultado: ResultadoItem;
  /** E = executado, P = pendente, N = não executado */
  execucao?: StatusExecucao;
  executorId?: ID;
  dataExecucao?: string;
  tempoPrevistoMin?: number;
  tempoRealMin?: number;
  servico?: string;
  material?: string;
  dataPrevista?: string;
  valor?: string;
  obs?: string;
}

export interface Medicoes {
  tensao?: string;
  corrente?: string;
  tInsuflamento?: string;
  tRetorno?: string;
  tExterna?: string;
  pSuccao?: string;
  pDescarga?: string;
  tLinhaSuccao?: string;
  tLinhaLiquido?: string;
  tSaturacaoSuccao?: string;
  tSaturacaoDescarga?: string;
  umidade?: string;
}

export interface ItemOsEquip {
  equipamentoId: ID;
  checklist: ItemChecklist[];
  medicoes: Medicoes;
  obs?: string;
  concluido?: boolean;
  /** Alteração da localização (destino) aplicada ao concluir a OS */
  novoAmbienteId?: ID;
}

export interface ItemPeca {
  pecaId?: ID;
  descricao: string;
  unidade?: string;
  quantidade: number;
  custoUnit: number;
  precoUnit: number;
  baixado?: boolean;
}

export interface ItemServico {
  servicoId?: ID;
  descricao: string;
  quantidade: number;
  precoUnit: number;
}

export interface Apontamento {
  profissionalId: ID;
  inicio: string;
  fim?: string;
  obs?: string;
}

export interface Foto {
  id: ID;
  dataUrl: string;
  legenda?: string;
  momento: 'antes' | 'durante' | 'depois';
  data: string;
}

export type StatusOS =
  | 'aberta'
  | 'agendada'
  | 'em_execucao'
  | 'pausada'
  | 'aguardando_peca'
  | 'concluida'
  | 'validada'
  | 'cancelada';

export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export interface OS extends Base {
  numero: string;
  tipo: string;
  prioridade: Prioridade;
  status: StatusOS;
  origem: 'manual' | 'preventiva' | 'ocorrencia' | 'orcamento';
  clienteId?: ID;
  unidadeId?: ID;
  ambienteId?: ID;
  contratoId?: ID;
  pmocId?: ID;
  ocorrenciaId?: ID;
  orcamentoId?: ID;
  titulo: string;
  solicitante?: string;
  descricao?: string;
  diagnostico?: string;
  servicoExecutado?: string;
  recomendacoes?: string;
  responsavelId?: ID;
  tecnicosIds: ID[];
  setorExecutante?: string;
  centroCusto?: string;
  fornecedorId?: ID;
  tempoPrevistoMin?: number;
  interferenciaPrevistaMin?: number;
  garantia?: string;
  observacoes?: string;
  paradaInicio?: string;
  paradaFim?: string;
  interferencia?: string;
  supervisorId?: ID;
  assinaturaSupervisor?: string;
  liberacao?: string;
  criadoPor?: string;
  dataAbertura: string;
  dataAgendada?: string;
  prazo?: string;
  inicio?: string;
  fim?: string;
  equipamentos: ItemOsEquip[];
  pecas: ItemPeca[];
  servicos: ItemServico[];
  apontamentos: Apontamento[];
  fotos: Foto[];
  deslocamento?: number;
  desconto?: number;
  assinaturaTecnico?: string;
  assinaturaCliente?: string;
  nomeAssinante?: string;
  docAssinante?: string;
  avaliacao?: number;
  preventivaRef?: string;
  /** Data programada na geração da preventiva; se a data agendada mudar, a OS conta como reprogramada */
  dataOriginal?: string;
  historico: { data: string; texto: string; usuario?: string }[];
}

export interface Ocorrencia extends Base {
  numero: string;
  tipo: string;
  status: 'nao_analisada' | 'em_analise' | 'convertida' | 'encerrada' | 'cancelada';
  prioridade: Prioridade;
  dataHora: string;
  emitente?: string;
  unidadeId?: ID;
  ambienteId?: ID;
  equipamentoId?: ID;
  descricao: string;
  limiteExecucao?: string;
  executorId?: ID;
  analise?: string;
  osId?: ID;
}

export interface Orcamento extends Base {
  numero: string;
  clienteId?: ID;
  unidadeId?: ID;
  data: string;
  validade?: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido';
  titulo: string;
  descricao?: string;
  pecas: ItemPeca[];
  servicos: ItemServico[];
  desconto?: number;
  deslocamento?: number;
  condicoes?: string;
  prazoExecucao?: string;
  garantia?: string;
  osId?: ID;
  observacoes?: string;
}

export interface AnaliseAr extends Base {
  unidadeId: ID;
  ambienteId?: ID;
  data: string;
  estacao: 'verao' | 'inverno';
  laboratorio?: string;
  laudo?: string;
  co2?: number;
  co2Ext?: number;
  fungos?: number;
  fungosExt?: number;
  aerodispersoides?: number;
  temperatura?: number;
  umidade?: number;
  velocidade?: number;
  renovacao?: number;
  observacoes?: string;
}

export interface RegistroFluido extends Base {
  equipamentoId: ID;
  data: string;
  operacao: 'carga' | 'recolhimento' | 'reciclagem' | 'descarte' | 'vazamento' | 'estanqueidade';
  fluido: string;
  quantidadeKg: number;
  cilindro?: string;
  profissionalId?: ID;
  osId?: ID;
  observacoes?: string;
}

export interface Empresa {
  razaoSocial: string;
  fantasia?: string;
  cnpj?: string;
  ie?: string;
  im?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  logo?: string;
  rodape?: string;
  corPrimaria?: string;
  /** PIN opcional para entrar como gestor (controle de acesso local) */
  pinGestor?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

/* ===================== Comercial ===================== */
export type EtapaOportunidade = 'prospeccao' | 'analise' | 'proposta' | 'disputa' | 'habilitacao' | 'ganha' | 'perdida' | 'desistencia';

/** Oportunidade comercial: licitação pública ou proposta para cliente privado (funil de vendas). */
export interface Oportunidade extends Base {
  numero: string;
  titulo: string;
  tipo: 'licitacao' | 'privado';
  etapa: EtapaOportunidade;
  clienteId?: ID;
  /** Órgão ou empresa, quando ainda não é cliente cadastrado */
  orgao?: string;
  modalidade?: string;
  criterio?: string;
  numeroEdital?: string;
  processo?: string;
  portal?: string;
  linkEdital?: string;
  cidade?: string;
  uf?: string;
  objeto?: string;
  dataSessao?: string;
  prazoPropostas?: string;
  /** Valor estimado/orçado pelo órgão (total da contratação) */
  valorEstimado?: number;
  /** Valor da nossa proposta (total da contratação) */
  valorProposta?: number;
  vigenciaMeses?: number;
  responsavelId?: ID;
  estudoId?: ID;
  contratoId?: ID;
  vencedor?: string;
  valorVencedor?: number;
  motivoResultado?: string;
  observacoes?: string;
}

/* ===================== Precificação ===================== */
export type RegimeTributario = 'mei' | 'simples' | 'presumido' | 'real';
/** Empregado CLT, sócio/titular (pró-labore) ou autônomo pago por RPA. */
export type VinculoCargo = 'clt' | 'socio' | 'autonomo';

/** Cargo da equipe com remuneração e benefícios da convenção coletiva (base do custo-hora). */
export interface CargoPreco extends Base {
  nome: string;
  /** Ausente = empregado CLT */
  vinculo?: VinculoCargo;
  cct?: string;
  /** Salário-base (CLT), pró-labore (sócio/titular) ou valor mensal pago (autônomo) */
  salarioBase: number;
  periculosidade?: boolean;
  /** Grau de insalubridade sobre o salário mínimo (%) */
  insalubridade?: number;
  outrosAdicionais?: number;
  valeTransporteDia?: number;
  valeAlimentacaoDia?: number;
  diasMes?: number;
  planoSaude?: number;
  seguroVida?: number;
  outrosBeneficios?: number;
  uniformeEpiMes?: number;
  examesTreinamentoMes?: number;
  /** Insumos de pessoal pela composição de custos ou pelos valores manuais (ausente: manual se houver valores) */
  insumosModo?: 'composicao' | 'manual';
  ativo: boolean;
  observacoes?: string;
}

/** Ferramenta ou instrumento do kit da equipe: custo mensal = depreciação + manutenção/calibração. */
export interface ItemFerramenta {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnit: number;
  vidaUtilMeses: number;
  /** Valor residual ao fim da vida útil (%) */
  residualPct?: number;
  /** Manutenção e calibração da linha por ano (R$) */
  manutencaoAnual?: number;
}

export type CategoriaPessoal = 'uniforme' | 'epi' | 'exame' | 'treinamento';

/** Item fornecido a cada empregado: uniforme, EPI (NR-6), exame (PCMSO/NR-7) ou treinamento (NR-10, NR-35…). */
export interface ItemPessoal {
  id: string;
  categoria: CategoriaPessoal;
  descricao: string;
  /** Quantidade por empregado por ano (0,5 = a cada dois anos) */
  qtdAno: number;
  valorUnit: number;
  /** Cargos a que se aplica (vazio = todos) */
  cargos?: ID[];
  /** CA do EPI, norma ou observação */
  ref?: string;
}

/** Material de consumo por equipamento atendido. */
export interface ItemInsumo {
  id: string;
  descricao: string;
  unidade: string;
  /** Consumo médio por equipamento por mês */
  consumoMes: number;
  valorUnit: number;
}

/** Veículo de atendimento: custos fixos (mensais) e variáveis (por km). */
export interface VeiculoComposicao {
  descricao: string;
  valorAquisicao: number;
  vidaUtilAnos: number;
  residualPct: number;
  /** IPVA, licenciamento e taxas por ano */
  ipvaAnual: number;
  seguroAnual: number;
  /** Rastreador, estacionamento e outros custos fixos por mês */
  outrosMensal: number;
  /** Remuneração do capital investido (% ao ano sobre o capital médio) */
  capitalPctAno: number;
  precoCombustivel: number;
  consumoKmL: number;
  /** Manutenção, óleo e lavagem (R$/km) */
  manutencaoKm: number;
  pneusKm: number;
}

export interface LinhaCusto {
  id?: string;
  descricao: string;
  valorMensal: number;
}

/** Tabelas de composição dos custos operacionais e administrativos. */
export interface ComposicaoCustos {
  ferramentas: ItemFerramenta[];
  pessoal: ItemPessoal[];
  insumos: ItemInsumo[];
  veiculo: VeiculoComposicao;
  /** Despesas fixas da empresa (administração central) */
  administrativas: LinhaCusto[];
}

export type MetodoPreco = 'tcu' | 'markup';
export type ReferenciaTcu = 'edificacoes' | 'energia';

/** Markup divisor (mercado privado): preço = custo ÷ [1 − (tributos + despesas fixas + despesas variáveis + lucro)]. */
export interface MarkupParams {
  /** Despesas fixas em % do faturamento (ausente = calculado pela composição) */
  despesasFixasPct?: number;
  comissaoPct: number;
  /** Taxas de cartão, boleto e antecipação */
  cartaoPct: number;
  inadimplenciaPct: number;
  lucroPct: number;
}

/** BDI diferenciado para materiais (Súmula TCU 253) ou margem própria no markup. */
export interface BdiMateriais {
  ativo: boolean;
  ac: number;
  s: number;
  r: number;
  g: number;
  l: number;
  /** Margem sobre materiais no método de markup (%) */
  lucroMarkup: number;
}

export interface BdiParams {
  ac: number;
  s: number;
  r: number;
  g: number;
  l: number;
  /** Prazo médio de recebimento (dias) e taxa financeira mensal (%) para a despesa financeira */
  prazoDias: number;
  taxaMes: number;
}

export interface ItemEstudo {
  id: string;
  descricao: string;
  tipoEquip?: string;
  faixa?: string;
  planoId?: ID;
  /** Horas/mês por equipamento informadas manualmente (substituem as do plano) */
  horasManual?: number;
  /** Fator de porte/acesso sobre o tempo do plano */
  fatorTempo: number;
  /** Reserva para manutenção corretiva (% sobre as horas preventivas) */
  corretivaPct: number;
  /** Materiais de consumo por equipamento/mês (R$) */
  materiaisMes: number;
  quantidade: number;
}

export interface CustoFixoEstudo {
  id: string;
  descricao: string;
  valorMensal: number;
}

/** Estudo de preço (composição da proposta) — modelo por equipamento. */
export interface EstudoPreco extends Base {
  numero: string;
  titulo: string;
  status: 'elaboracao' | 'enviado' | 'ganho' | 'perdido';
  oportunidadeId?: ID;
  clienteId?: ID;
  orgao?: string;
  modelo: 'equipamento';
  /** Serviço de engenharia (art. 59, §4º) ou serviço comum (IN 73/2022) — define os limites de exequibilidade */
  tipoServico: 'engenharia' | 'comum';
  vigenciaMeses: number;
  /** Valor estimado pelo órgão, por mês, para comparação */
  valorEstimadoMensal?: number;
  equipe: { cargoId: ID; quantidade: number }[];
  itens: ItemEstudo[];
  deslocamento: { visitasMes: number; minutosVisita: number; kmMes: number; custoKm: number };
  custosFixos: CustoFixoEstudo[];
  rateio: 'horas' | 'equipamentos';
  /** Kits de ferramentas e veículos da composição de custos alocados pelas horas (ausente = 0) */
  kits?: number;
  veiculos?: number;
  /** Método de formação do preço (ausente = BDI do TCU) */
  metodo?: MetodoPreco;
  referenciaTcu?: ReferenciaTcu;
  bdi: BdiParams;
  markup?: MarkupParams;
  bdiMateriais?: BdiMateriais;
  /** Responsável técnico pela composição */
  responsavelId?: ID;
  /** Validade da proposta (dias) */
  validadeDias?: number;
  /** ISS do município de execução (substitui o dos parâmetros) */
  issAliquota?: number;
  /** Memória da carga tributária na data da proposta (base para reequilíbrio — LC 214/2025, arts. 373 a 377) */
  tributosBase?: { data: string; regime: string; itens: { nome: string; aliquota: number }[]; total: number; porFora: number };
  observacoes?: string;
}

/** Parâmetros gerais de precificação (regime tributário, encargos, provisões, horas e BDI padrão). */
export interface ParametrosPreco {
  regime: RegimeTributario;
  /** DAS mensal do MEI (ausente = 5% do salário mínimo + R$ 5,00 de ISS) */
  meiDas?: number;
  /** Limite anual de faturamento do MEI */
  meiLimite: number;
  /** INSS patronal sobre autônomos (ausente = padrão do regime) */
  inssAutonomo?: number;
  /** Faturamento mensal médio da empresa (base das despesas fixas em % do preço) */
  faturamentoMensal: number;
  /** Receita bruta dos últimos 12 meses (Simples Nacional) */
  rbt12: number;
  /** Excluir as parcelas de IRPJ e CSLL do DAS na taxa de tributos do BDI */
  simplesExcluirIrpjCsll: boolean;
  issAliquota: number;
  /** PIS + Cofins efetivos no Lucro Real (após créditos) */
  pisCofinsReal: number;
  desonerada: boolean;
  cprbAliquota: number;
  anoBase: number;
  rat: number;
  fap: number;
  terceiros: number;
  fgts: number;
  /** Tributos calculados "por fora" do preço (cenários da reforma: CBS/IBS) */
  tributosPorFora: number;
  salarioMinimo: number;
  decimoTerceiro: number;
  feriasTerco: number;
  avisoIndenizado: number;
  fgtsAvisoIndenizado: number;
  avisoTrabalhado: number;
  multaFgts: number;
  jornadaSemanal: number;
  feriadosAno: number;
  feriasDiasUteis: number;
  ausenciasDias: number;
  produtividade: number;
  metodo: MetodoPreco;
  referenciaTcu: ReferenciaTcu;
  bdi: BdiParams;
  markup: MarkupParams;
  bdiMateriais: BdiMateriais;
  composicao: ComposicaoCustos;
  /** Outros custos mensais de cada contrato (responsável técnico, ART, seguro-garantia…) */
  custosPadrao: { descricao: string; valorMensal: number }[];
  /** Legado: materiais e custo/km informados direto (substituídos pela composição) */
  materiaisPadraoMes: number;
  custoKmPadrao: number;
}
