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
  foto?: string;
  observacoes?: string;
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

export interface ItemChecklist {
  atividadeId?: ID;
  grupo?: string;
  descricao: string;
  periodicidade?: Periodicidade;
  tipo: 'check' | 'medicao';
  unidade?: string;
  min?: number;
  max?: number;
  resultado: ResultadoItem;
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
  historico: { data: string; texto: string }[];
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
}

export interface Setting {
  key: string;
  value: unknown;
}
