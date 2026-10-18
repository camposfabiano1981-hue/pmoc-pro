import type { Periodicidade, Prioridade, StatusOS } from '../db/types';

export const TIPOS_EQUIPAMENTO = [
  'Split Hi-Wall',
  'Split Piso-Teto',
  'Split Cassete',
  'Split Duto (Built-in)',
  'Multi-Split',
  'Janela (ACJ)',
  'Portátil',
  'VRF/VRV - Evaporadora',
  'VRF/VRV - Condensadora',
  'Self Contained',
  'Rooftop',
  'Chiller',
  'Fan Coil',
  'Fancolete',
  'Climatizador / AHU',
  'Torre de Resfriamento',
  'Bomba de Água Gelada',
  'Exaustor / Ventilador',
  'Cortina de Ar',
  'Câmara Fria',
  'Balcão / Expositor Refrigerado',
  'Bebedouro / Purificador',
  'Desumidificador',
  'Outro',
];

export const MARCAS = [
  'Carrier', 'Springer', 'Midea', 'LG', 'Samsung', 'Daikin', 'Fujitsu', 'Gree', 'Elgin', 'Consul', 'Electrolux',
  'Philco', 'Komeco', 'Agratto', 'Hitachi', 'Trane', 'York', 'Hisense', 'TCL', 'Britânia', 'Admiral', 'Tecumseh',
  'Embraco', 'Danfoss', 'Bitzer', 'Copeland', 'Mitsubishi Electric', 'Toshiba', 'Panasonic',
];

/** Potencial de aquecimento global (GWP, IPCC AR4 — base usada no Protocolo de Kigali). */
export const FLUIDOS: { nome: string; gwp: number; odp: number; obs?: string }[] = [
  { nome: 'R-410A', gwp: 2088, odp: 0 },
  { nome: 'R-32', gwp: 675, odp: 0, obs: 'Levemente inflamável (A2L)' },
  { nome: 'R-22', gwp: 1810, odp: 0.055, obs: 'HCFC em eliminação (Protocolo de Montreal)' },
  { nome: 'R-134a', gwp: 1430, odp: 0 },
  { nome: 'R-404A', gwp: 3922, odp: 0 },
  { nome: 'R-407C', gwp: 1774, odp: 0 },
  { nome: 'R-507A', gwp: 3985, odp: 0 },
  { nome: 'R-448A', gwp: 1387, odp: 0 },
  { nome: 'R-449A', gwp: 1397, odp: 0 },
  { nome: 'R-454B', gwp: 466, odp: 0, obs: 'A2L' },
  { nome: 'R-1234yf', gwp: 4, odp: 0, obs: 'A2L' },
  { nome: 'R-290', gwp: 3, odp: 0, obs: 'Propano — inflamável (A3)' },
  { nome: 'R-600a', gwp: 3, odp: 0, obs: 'Isobutano — inflamável (A3)' },
  { nome: 'R-717', gwp: 0, odp: 0, obs: 'Amônia — tóxico (B2L)' },
  { nome: 'R-744', gwp: 1, odp: 0, obs: 'CO₂ — alta pressão' },
  { nome: 'R-141b', gwp: 725, odp: 0.11, obs: 'Usado para limpeza (flushing)' },
];

export const gwpDe = (fluido?: string) => FLUIDOS.find((f) => f.nome === fluido)?.gwp ?? 0;

export const PERIODICIDADES: { value: Periodicidade; label: string; sigla: string; meses: number; vezesMes: number }[] = [
  { value: 'diaria', label: 'Diária', sigla: 'D', meses: 0, vezesMes: 22 },
  { value: 'semanal', label: 'Semanal', sigla: 'S', meses: 0, vezesMes: 4 },
  { value: 'quinzenal', label: 'Quinzenal', sigla: 'Q', meses: 0, vezesMes: 2 },
  { value: 'mensal', label: 'Mensal', sigla: 'M', meses: 1, vezesMes: 1 },
  { value: 'bimestral', label: 'Bimestral', sigla: 'B', meses: 2, vezesMes: 1 },
  { value: 'trimestral', label: 'Trimestral', sigla: 'T', meses: 3, vezesMes: 1 },
  { value: 'quadrimestral', label: 'Quadrimestral', sigla: 'QD', meses: 4, vezesMes: 1 },
  { value: 'semestral', label: 'Semestral', sigla: 'SE', meses: 6, vezesMes: 1 },
  { value: 'anual', label: 'Anual', sigla: 'A', meses: 12, vezesMes: 1 },
  { value: 'na', label: 'Não se aplica', sigla: 'N/A', meses: -1, vezesMes: 0 },
];

export const periodicidadeLabel = (p?: Periodicidade) => PERIODICIDADES.find((x) => x.value === p)?.label ?? '—';
export const periodicidadeSigla = (p?: Periodicidade) => PERIODICIDADES.find((x) => x.value === p)?.sigla ?? '';

export const TIPOS_OS = [
  'Preventiva',
  'Corretiva',
  'Preditiva',
  'Inspeção',
  'Higienização',
  'Instalação',
  'Desinstalação',
  'Emergencial',
  'Visita técnica',
  'Análise da qualidade do ar',
];

export const STATUS_OS: { value: StatusOS; label: string; cor: string }[] = [
  { value: 'aberta', label: 'Aberta', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
  { value: 'agendada', label: 'Agendada', cor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200' },
  { value: 'em_execucao', label: 'Em execução', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  { value: 'pausada', label: 'Pausada', cor: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  { value: 'aguardando_peca', label: 'Aguardando peça', cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' },
  { value: 'concluida', label: 'Concluída', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { value: 'validada', label: 'Validada', cor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200' },
  { value: 'cancelada', label: 'Cancelada', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
];
export const statusOs = (s: StatusOS) => STATUS_OS.find((x) => x.value === s) ?? STATUS_OS[0];
export const OS_FINALIZADAS: StatusOS[] = ['concluida', 'validada', 'cancelada'];

export const PRIORIDADES: { value: Prioridade; label: string; cor: string; horasPadrao: number }[] = [
  { value: 'baixa', label: 'Baixa', cor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', horasPadrao: 120 },
  { value: 'media', label: 'Média', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', horasPadrao: 48 },
  { value: 'alta', label: 'Alta', cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200', horasPadrao: 24 },
  { value: 'urgente', label: 'Urgente', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200', horasPadrao: 4 },
];
export const prioridade = (p: Prioridade) => PRIORIDADES.find((x) => x.value === p) ?? PRIORIDADES[1];

export const TIPOS_OCORRENCIA = ['Quebra', 'Processo', 'Anomalia simples', 'Anomalia crítica', 'Chamado', 'Reclamação de conforto', 'Vazamento'];

export const STATUS_OCORRENCIA = [
  { value: 'nao_analisada', label: 'Não analisada', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  { value: 'em_analise', label: 'Em análise', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  { value: 'convertida', label: 'Convertida em OS', cor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200' },
  { value: 'encerrada', label: 'Encerrada', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { value: 'cancelada', label: 'Cancelada', cor: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
];

export const STATUS_ORCAMENTO = [
  { value: 'rascunho', label: 'Rascunho', cor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'enviado', label: 'Enviado', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
  { value: 'aprovado', label: 'Aprovado', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { value: 'recusado', label: 'Recusado', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  { value: 'convertido', label: 'Convertido em OS', cor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200' },
];

export const STATUS_EQUIPAMENTO = [
  { value: 'operando', label: 'Operando', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { value: 'manutencao', label: 'Em manutenção', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  { value: 'parado', label: 'Parado', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  { value: 'desativado', label: 'Desativado', cor: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
];

export const CRITICIDADES = [
  { value: 'A', label: 'A — Crítico (data center, saúde, processo)' },
  { value: 'B', label: 'B — Importante (escritórios, atendimento)' },
  { value: 'C', label: 'C — Baixo impacto' },
];

export const TIPOS_ATIVIDADE_AMBIENTE = [
  'Administrativo', 'Escritório', 'Sala de reunião', 'Treinamento / Sala de aula', 'Atendimento ao público',
  'Data center / TI', 'CCM / Sala elétrica', 'Laboratório', 'Ambulatório / Saúde', 'Refeitório / Copa', 'Cozinha',
  'Comércio / Loja', 'Hotelaria', 'Auditório', 'Produção / Industrial', 'Depósito / Almoxarifado', 'Vestiário',
  'Portaria / Guarita', 'Residencial',
];

export const TIPOS_EDIFICACAO = [
  'Escritório / Corporativo', 'Indústria / Mineração', 'Hospital / Clínica', 'Escola / Universidade', 'Órgão público',
  'Comércio / Shopping', 'Hotel', 'Banco / Agência', 'Supermercado', 'Condomínio', 'Residência', 'Outro',
];

export const FUNCOES = [
  'Técnico em Refrigeração', 'Técnico em Eletrotécnica', 'Mecânico de Refrigeração', 'Eletricista', 'Ajudante',
  'Supervisor', 'Engenheiro Mecânico', 'Engenheiro Eletricista', 'Responsável Técnico', 'Administrativo',
];

export const CERTIFICACOES = [
  'NR-10 Básico', 'NR-10 SEP', 'NR-35 Trabalho em Altura', 'NR-33 Espaço Confinado', 'NR-12 Máquinas',
  'NR-06 EPI', 'Manuseio de Fluidos Inflamáveis (R-290/R-32)', 'Recolhimento de Fluidos (CTF/IBAMA)',
  'Brasagem', 'Primeiros Socorros', 'Direção Defensiva',
];

export const CATEGORIAS_PECA = [
  'Capacitor', 'Compressor', 'Motor ventilador', 'Placa eletrônica', 'Sensor / Termistor', 'Controle remoto',
  'Filtro', 'Fluido refrigerante', 'Tubulação de cobre', 'Isolamento térmico', 'Dreno / Bomba de dreno',
  'Contator / Relé', 'Disjuntor', 'Cabo elétrico', 'Válvula', 'Filtro secador', 'Produto químico / Higienização',
  'Suporte / Fixação', 'Correia', 'Rolamento', 'Turbina / Hélice', 'Outros',
];

export const UNIDADES_MEDIDA = ['un', 'pç', 'm', 'kg', 'L', 'cx', 'rolo', 'kit', 'par', 'h', 'serviço'];

export const CATEGORIAS_SERVICO = [
  'Manutenção preventiva', 'Manutenção corretiva', 'Higienização', 'Instalação', 'Desinstalação',
  'Carga de gás', 'Elétrica', 'Mão de obra (hora)', 'Visita técnica', 'Laudo / PMOC', 'Análise da qualidade do ar',
];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

/** Padrões referenciais da RE ANVISA nº 09/2003 (qualidade do ar interior em ambientes climatizados). */
export const RE09 = {
  fungosMax: 750, // UFC/m³
  relacaoIEMax: 1.5,
  co2Max: 1000, // ppm
  aerodispersoidesMax: 80, // µg/m³
  velocidadeMax: 0.25, // m/s a 1,5 m do piso
  renovacaoMin: 27, // m³/h/pessoa
  verao: { tMin: 23, tMax: 26, urMin: 40, urMax: 65 },
  inverno: { tMin: 20, tMax: 22, urMin: 35, urMax: 65 },
};

export const NORMAS = [
  { ref: 'Lei Federal nº 13.589/2018', desc: 'Dispõe sobre a manutenção de instalações e equipamentos de sistemas de climatização de ambientes (obrigatoriedade do PMOC).' },
  { ref: 'Portaria GM/MS nº 3.523/1998', desc: 'Regulamento técnico de medidas básicas de limpeza e manutenção de sistemas de climatização; Anexo I — modelo de PMOC.' },
  { ref: 'Resolução ANVISA RE nº 09/2003', desc: 'Padrões referenciais de qualidade do ar interior em ambientes climatizados artificialmente.' },
  { ref: 'Lei Federal nº 6.437/1977', desc: 'Infrações à legislação sanitária federal e sanções.' },
  { ref: 'ABNT NBR 13971:2014', desc: 'Sistemas de refrigeração, condicionamento de ar, ventilação e aquecimento — Manutenção programada.' },
  { ref: 'ABNT NBR 16401-1/2/3', desc: 'Instalações de ar-condicionado — Projeto, conforto térmico e qualidade do ar interior.' },
  { ref: 'ABNT NBR 14679', desc: 'Sistemas de condicionamento de ar e ventilação — Execução de serviços de higienização.' },
  { ref: 'ABNT NBR 15848', desc: 'Sistemas de ar-condicionado e ventilação — Procedimentos e requisitos relativos à qualidade do ar interior.' },
  { ref: 'ABNT NBR 5410', desc: 'Instalações elétricas de baixa tensão.' },
  { ref: 'NR-06', desc: 'Equipamentos de Proteção Individual — EPI.' },
  { ref: 'NR-10', desc: 'Segurança em instalações e serviços em eletricidade.' },
  { ref: 'NR-12', desc: 'Segurança no trabalho em máquinas e equipamentos.' },
  { ref: 'NR-26', desc: 'Sinalização de segurança.' },
  { ref: 'NR-33', desc: 'Segurança e saúde nos trabalhos em espaços confinados.' },
  { ref: 'NR-35', desc: 'Trabalho em altura.' },
  { ref: 'CREA / CFT — ART / TRT', desc: 'Anotação (ART) ou Termo (TRT) de Responsabilidade Técnica do responsável pelo PMOC.' },
];

export const RECOMENDACOES_PADRAO = `RECOMENDAÇÕES AOS USUÁRIOS EM SITUAÇÕES DE FALHA DO EQUIPAMENTO E OUTRAS DE EMERGÊNCIA (Portaria GM/MS nº 3.523/98 — Anexo I)

1. Em caso de falha, ruído anormal, cheiro de queimado, fumaça ou vazamento de água: desligue imediatamente o equipamento no controle e no disjuntor exclusivo e comunique a equipe de manutenção.
2. Não tente abrir, consertar ou lavar o equipamento. Intervenções somente por profissional habilitado.
3. Em caso de vazamento de fluido refrigerante (chiado, gelo excessivo, odor), ventile o ambiente, evacue pessoas e não acione chaves elétricas próximas, sobretudo em equipamentos com fluidos inflamáveis (R-32, R-290).
4. Em situação de incêndio, desligue o sistema de climatização para não propagar fumaça pelos dutos e siga o plano de emergência da edificação.
5. Mantenha portas e janelas fechadas durante o funcionamento; não obstrua grelhas de insuflamento e retorno.
6. Mantenha a temperatura de operação entre 23 °C e 26 °C (verão) e evite variações bruscas.
7. Não armazene produtos químicos, alimentos ou materiais no interior das casas de máquinas ou próximos às unidades.
8. Abra chamado imediato quando houver queda de rendimento, gotejamento, odores desagradáveis ou desconforto térmico.
9. Ocupantes com sintomas respiratórios recorrentes (Síndrome do Edifício Doente) devem ser reportados ao responsável para avaliação da qualidade do ar.`;

export const TERMO_RT = `Declaro, para os devidos fins, que sou o Responsável Técnico pela elaboração e acompanhamento deste Plano de Manutenção, Operação e Controle — PMOC, em conformidade com a Lei nº 13.589/2018, a Portaria GM/MS nº 3.523/1998, a Resolução ANVISA RE nº 09/2003 e as normas técnicas da ABNT aplicáveis, comprometendo-me a manter disponíveis os registros das atividades executadas.`;
