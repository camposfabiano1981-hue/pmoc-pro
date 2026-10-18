import type { AtividadePlano, Periodicidade, PlanoManutencao } from './types';

type A = [grupo: string, descricao: string, periodicidade: Periodicidade, tempoMin: number, medicao?: { unidade: string; min?: number; max?: number }];

let seq = 0;
function atividades(prefix: string, list: A[]): AtividadePlano[] {
  return list.map(([grupo, descricao, periodicidade, tempoMin, med]) => ({
    id: `${prefix}-${++seq}`,
    grupo,
    descricao,
    periodicidade,
    tempoMin,
    tipo: med ? 'medicao' : 'check',
    unidade: med?.unidade,
    min: med?.min,
    max: med?.max,
  }));
}

const ts = '2026-01-01T00:00:00.000Z';
const base = (id: string, nome: string, descricao: string, tipos: string[], norma: string, list: A[]): PlanoManutencao => ({
  id,
  nome,
  descricao,
  tiposEquipamento: tipos,
  norma,
  atividades: atividades(id, list),
  createdAt: ts,
  updatedAt: ts,
});

/** Anexo I da Portaria GM/MS 3.523/98 — periodicidades sugeridas (ajuste conforme NBR 13971 e fabricante). */
export const PLANO_PORTARIA = base(
  'plano-portaria-3523',
  'Portaria GM/MS 3.523/98 — Anexo I (completo)',
  'Modelo integral do Plano de Manutenção, Operação e Controle do Anexo I da Portaria 3.523/98. Periodicidades sugeridas — ajuste ao sistema real e às recomendações do fabricante.',
  ['Fan Coil', 'Self Contained', 'Rooftop', 'Climatizador / AHU', 'Split Duto (Built-in)'],
  'Portaria GM/MS 3.523/98; ABNT NBR 13971',
  [
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar e eliminar sujeira, danos e corrosão no gabinete, na moldura da serpentina e na bandeja', 'mensal', 10],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Limpar a bandeja e o dreno de água de condensação', 'mensal', 10],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar a operação dos controles de vazão', 'mensal', 5],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar a operação de drenagem de água da bandeja', 'mensal', 5],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar o estado de conservação do isolamento termoacústico', 'mensal', 5],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar a vedação dos painéis de fechamento do gabinete', 'mensal', 5],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Verificar a tensão das correias para evitar escorregamento', 'mensal', 5],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Lavar as bandejas e serpentinas com remoção do biofilme (lodo), sem uso de produtos desengraxantes e corrosivos', 'trimestral', 40],
    ['a) Condicionador de ar (expansão direta e água gelada)', 'Limpar o gabinete do condicionador e ventiladores (carcaça e rotor)', 'trimestral', 30],
    ['b) Filtros de ar (secos)', 'Verificar e eliminar sujeira, danos e corrosão', 'mensal', 5],
    ['b) Filtros de ar (secos)', 'Medir o diferencial de pressão', 'mensal', 5, { unidade: 'Pa' }],
    ['b) Filtros de ar (secos)', 'Verificar e eliminar as frestas dos filtros', 'mensal', 5],
    ['b) Filtros de ar (secos)', 'Limpar (quando recuperável) ou substituir (quando descartável) o elemento filtrante', 'mensal', 15],
    ['b) Filtros de ar (embebidos em óleo)', 'Verificar e eliminar sujeira, danos e corrosão', 'na', 5],
    ['b) Filtros de ar (embebidos em óleo)', 'Medir o diferencial de pressão', 'na', 5, { unidade: 'Pa' }],
    ['b) Filtros de ar (embebidos em óleo)', 'Verificar e eliminar as frestas dos filtros', 'na', 5],
    ['b) Filtros de ar (embebidos em óleo)', 'Lavar o filtro com produto desengraxante e inodoro', 'na', 20],
    ['b) Filtros de ar (embebidos em óleo)', 'Pulverizar com óleo inodoro e escorrer, mantendo uma fina película de óleo', 'na', 10],
    ['c) Ventiladores', 'Verificar e eliminar sujeira, danos e corrosão', 'mensal', 5],
    ['c) Ventiladores', 'Verificar a fixação', 'mensal', 5],
    ['c) Ventiladores', 'Verificar o ruído dos mancais', 'mensal', 5],
    ['c) Ventiladores', 'Lubrificar os mancais', 'trimestral', 10],
    ['c) Ventiladores', 'Verificar a tensão das correias para evitar escorregamento', 'mensal', 5],
    ['c) Ventiladores', 'Verificar a operação dos amortecedores de vibração', 'mensal', 5],
    ['c) Ventiladores', 'Verificar a instalação dos protetores de polias e correias', 'mensal', 5],
    ['c) Ventiladores', 'Verificar a operação dos controles de vazão', 'mensal', 5],
    ['c) Ventiladores', 'Verificar a drenagem de água', 'mensal', 5],
    ['c) Ventiladores', 'Limpar interna e externamente a carcaça e o rotor', 'trimestral', 20],
    ['d) Casa de máquinas do condicionador de ar', 'Verificar e eliminar sujeira e água', 'mensal', 10],
    ['d) Casa de máquinas do condicionador de ar', 'Verificar e eliminar corpos estranhos', 'mensal', 5],
    ['d) Casa de máquinas do condicionador de ar', 'Verificar e eliminar obstruções no retorno e na tomada de ar externo', 'mensal', 5],
    ['Aquecedores de ar', 'Verificar e eliminar sujeira, danos e corrosão', 'na', 5],
    ['Aquecedores de ar', 'Verificar o funcionamento dos dispositivos de segurança', 'na', 5],
    ['Aquecedores de ar', 'Limpar a face de passagem do fluxo de ar', 'na', 10],
    ['Umidificador de ar com tubo difusor', 'Verificar e eliminar sujeira, danos e corrosão', 'na', 5],
    ['Umidificador de ar com tubo difusor', 'Verificar a operação da válvula de controle', 'na', 5],
    ['Umidificador de ar com tubo difusor', 'Ajustar a gaxeta da haste da válvula de controle', 'na', 5],
    ['Umidificador de ar com tubo difusor', 'Purgar a água do sistema', 'na', 5],
    ['Umidificador de ar com tubo difusor', "Verificar o tamponamento da caixa d'água de reposição", 'na', 5],
    ['Umidificador de ar com tubo difusor', 'Verificar o funcionamento dos dispositivos de segurança', 'na', 5],
    ['Umidificador de ar com tubo difusor', 'Verificar o estado das linhas de distribuição de vapor e de condensado', 'na', 5],
    ['Tomada de ar externo', 'Verificar e eliminar sujeira, danos e corrosão', 'mensal', 5],
    ['Tomada de ar externo', 'Verificar a fixação', 'mensal', 5],
    ['Tomada de ar externo', 'Medir o diferencial de pressão', 'mensal', 5, { unidade: 'Pa' }],
    ['Tomada de ar externo', 'Medir a vazão', 'semestral', 15, { unidade: 'm³/h' }],
    ['Tomada de ar externo', 'Verificar e eliminar as frestas dos filtros', 'mensal', 5],
    ['Tomada de ar externo', 'Verificar o acionamento mecânico do registro de ar (damper)', 'mensal', 5],
    ['Tomada de ar externo', 'Limpar (quando recuperável) ou substituir (quando descartável) o elemento filtrante', 'mensal', 10],
    ['Registro de ar (damper) de retorno', 'Verificar e eliminar sujeira, danos e corrosão', 'trimestral', 5],
    ['Registro de ar (damper) de retorno', 'Verificar seu acionamento mecânico', 'trimestral', 5],
    ['Registro de ar (damper) de retorno', 'Medir a vazão', 'semestral', 10, { unidade: 'm³/h' }],
    ['Registro de ar (damper) corta-fogo', 'Verificar o certificado de teste', 'anual', 5],
    ['Registro de ar (damper) corta-fogo', 'Verificar e eliminar sujeira nos elementos de fechamento, travas e reabertura', 'semestral', 10],
    ['Registro de ar (damper) corta-fogo', 'Verificar o posicionamento do indicador de condição (aberto ou fechado)', 'semestral', 5],
    ['Registro de ar (damper) de gravidade', 'Verificar e eliminar sujeira, danos e corrosão', 'semestral', 5],
    ['Registro de ar (damper) de gravidade', 'Verificar seu acionamento mecânico', 'semestral', 5],
    ['Registro de ar (damper) de gravidade', 'Lubrificar os mancais', 'semestral', 5],
    ['e) Dutos, acessórios e caixa pleno', 'Verificar e eliminar sujeira (interna e externa), danos e corrosão', 'semestral', 30],
    ['e) Dutos, acessórios e caixa pleno', 'Verificar a vedação das portas de inspeção em operação normal', 'semestral', 10],
    ['e) Dutos, acessórios e caixa pleno', 'Verificar e eliminar danos no isolamento térmico', 'semestral', 15],
    ['e) Dutos, acessórios e caixa pleno', 'Verificar a vedação das conexões', 'semestral', 10],
    ['Bocas de ar para insuflamento e retorno', 'Verificar e eliminar sujeira, danos e corrosão', 'mensal', 10],
    ['Bocas de ar para insuflamento e retorno', 'Verificar a fixação', 'mensal', 5],
    ['Bocas de ar para insuflamento e retorno', 'Medir a vazão', 'semestral', 15, { unidade: 'm³/h' }],
    ['Dispositivos de bloqueio e balanceamento', 'Verificar e eliminar sujeira, danos e corrosão', 'semestral', 5],
    ['Dispositivos de bloqueio e balanceamento', 'Verificar o funcionamento', 'semestral', 5],
    ['f) Ambientes climatizados', 'Verificar e eliminar sujeira, odores desagradáveis, fontes de ruído, infiltrações, armazenagem de produtos químicos, fontes de calor excessivo e de geração de microrganismos', 'mensal', 10],
    ['g) Torre de resfriamento', 'Verificar e eliminar sujeira, danos e corrosão', 'na', 15],
  ],
);

const SPLIT_TIPOS = ['Split Hi-Wall', 'Split Piso-Teto', 'Split Cassete', 'Multi-Split', 'Janela (ACJ)', 'Portátil', 'Split Duto (Built-in)'];

export const PLANO_SPLIT = base(
  'plano-split',
  'Split / Janela — Preventiva completa',
  'Rotina para equipamentos de expansão direta (hi-wall, piso-teto, cassete, janela). Inclui medições elétricas e termodinâmicas para diagnóstico preditivo.',
  SPLIT_TIPOS,
  'Portaria 3.523/98; NBR 13971; NBR 14679; manual do fabricante',
  [
    ['Evaporadora', 'Limpar / lavar filtros de ar (tela)', 'mensal', 15],
    ['Evaporadora', 'Lavar e limpar frente plástica e gabinete', 'mensal', 10],
    ['Evaporadora', 'Verificar dreno e bandeja de condensado (desobstruir)', 'mensal', 10],
    ['Evaporadora', 'Verificar e limpar serpentina do evaporador', 'mensal', 15],
    ['Evaporadora', 'Verificar infiltrações de água da condensação na parede ou suporte', 'mensal', 5],
    ['Evaporadora', 'Ajustar botões de controle / testar controle remoto e pilhas', 'mensal', 5],
    ['Evaporadora', 'Verificar e testar funcionamento do termostato e chave seletora', 'mensal', 5],
    ['Evaporadora', 'Verificar turbina, mancais e ruídos/vibrações anormais', 'mensal', 5],
    ['Evaporadora', 'Higienização completa da evaporadora com produto bactericida/fungicida biodegradável (NBR 14679)', 'trimestral', 60],
    ['Condensadora', 'Limpar serpentina do condensador (lavagem com água/jato de baixa pressão)', 'semestral', 40],
    ['Condensadora', 'Verificar fixação, suportes, coxins e corrosão da condensadora', 'semestral', 10],
    ['Condensadora', 'Verificar hélice, motor do ventilador e grade de proteção', 'semestral', 10],
    ['Circuito frigorífico', 'Verificar isolamento térmico das linhas de cobre', 'semestral', 10],
    ['Circuito frigorífico', 'Inspecionar vazamentos de fluido refrigerante (espuma / detector eletrônico)', 'semestral', 15],
    ['Circuito frigorífico', 'Medir pressão de sucção', 'trimestral', 10, { unidade: 'psig' }],
    ['Circuito frigorífico', 'Calcular superaquecimento', 'trimestral', 5, { unidade: 'K', min: 5, max: 12 }],
    ['Elétrica', 'Medir tensão de alimentação', 'mensal', 5, { unidade: 'V', min: 198, max: 242 }],
    ['Elétrica', 'Medir corrente de funcionamento do aparelho', 'mensal', 5, { unidade: 'A' }],
    ['Elétrica', 'Verificar cabo de alimentação, tomada/disjuntor e aterramento', 'mensal', 5],
    ['Elétrica', 'Reapertar conexões elétricas e bornes', 'semestral', 10],
    ['Elétrica', 'Medir capacitância do capacitor de partida/permanente', 'semestral', 10, { unidade: 'µF' }],
    ['Desempenho', 'Medir temperatura de insuflamento', 'mensal', 5, { unidade: '°C', min: 10, max: 16 }],
    ['Desempenho', 'Medir temperatura de retorno / ambiente', 'mensal', 5, { unidade: '°C', min: 23, max: 26 }],
    ['Desempenho', 'Calcular diferencial de temperatura (ΔT retorno − insuflamento)', 'mensal', 2, { unidade: 'K', min: 8, max: 14 }],
    ['Ambiente', 'Verificar sujeira, odores, fontes de calor e obstruções no ambiente climatizado', 'mensal', 5],
  ],
);

export const PLANO_VRF = base(
  'plano-vrf',
  'VRF / VRV — Sistema de fluxo variável',
  'Unidades internas e condensadoras de sistemas VRF/VRV, incluindo leitura de alarmes e histórico de falhas no controle central.',
  ['VRF/VRV - Evaporadora', 'VRF/VRV - Condensadora'],
  'NBR 13971; manual do fabricante',
  [
    ['Unidade interna', 'Limpar filtros de ar', 'mensal', 15],
    ['Unidade interna', 'Verificar bandeja, dreno e bomba de condensado', 'mensal', 10],
    ['Unidade interna', 'Limpar serpentina e turbina com produto bactericida', 'trimestral', 45],
    ['Unidade interna', 'Verificar válvula de expansão eletrônica (EEV) e sensores', 'semestral', 10],
    ['Condensadora', 'Limpar serpentinas do condensador', 'semestral', 60],
    ['Condensadora', 'Verificar ventiladores, motores e grades', 'trimestral', 15],
    ['Condensadora', 'Verificar nível e aspecto do óleo (visor), quando aplicável', 'semestral', 10],
    ['Condensadora', 'Medir pressões de sucção e descarga', 'trimestral', 15, { unidade: 'psig' }],
    ['Condensadora', 'Medir corrente dos compressores (inverter e fixo)', 'trimestral', 10, { unidade: 'A' }],
    ['Controle', 'Ler códigos de alarme e histórico no controle central', 'mensal', 10],
    ['Controle', 'Verificar comunicação entre unidades (barramento)', 'trimestral', 10],
    ['Elétrica', 'Medir tensão e desequilíbrio entre fases (máx. 2%)', 'trimestral', 10, { unidade: '%', max: 2 }],
    ['Elétrica', 'Reapertar bornes, contatores e verificar aquecimento (termografia)', 'semestral', 20],
    ['Circuito frigorífico', 'Inspecionar vazamentos e isolamento das tubulações', 'semestral', 20],
  ],
);

export const PLANO_CHILLER = base(
  'plano-chiller',
  'Chiller + Água Gelada',
  'Resfriadores de líquido, bombas e circuito hidrônico. Registro de parâmetros operacionais (log sheet).',
  ['Chiller', 'Bomba de Água Gelada'],
  'NBR 13971; manual do fabricante',
  [
    ['Operação', 'Registrar temperatura de entrada/saída de água gelada', 'diaria', 5, { unidade: '°C' }],
    ['Operação', 'Registrar pressões de sucção/descarga e corrente de cada compressor', 'diaria', 10],
    ['Operação', 'Verificar alarmes do painel e histórico de falhas', 'semanal', 10],
    ['Compressor', 'Verificar nível de óleo, aquecedor de cárter e ruídos', 'mensal', 15],
    ['Compressor', 'Analisar óleo (acidez/umidade)', 'anual', 30],
    ['Condensador', 'Limpar serpentina (ar) ou verificar incrustação dos tubos (água)', 'semestral', 120],
    ['Evaporador', 'Verificar ΔT e perda de carga do evaporador', 'mensal', 10, { unidade: 'K' }],
    ['Hidrônica', 'Verificar bombas: vedação, mancais, vibração e corrente', 'mensal', 20],
    ['Hidrônica', 'Limpar filtros Y e verificar tanque de expansão', 'trimestral', 30],
    ['Hidrônica', 'Análise e tratamento químico da água', 'mensal', 20],
    ['Elétrica', 'Reapertar conexões, verificar contatores e relés de proteção', 'semestral', 40],
    ['Elétrica', 'Medir resistência de isolamento dos motores (megômetro)', 'anual', 30, { unidade: 'MΩ' }],
    ['Segurança', 'Testar pressostatos, fluxostato e intertravamentos', 'semestral', 30],
  ],
);

export const PLANO_FANCOIL = base(
  'plano-fancoil',
  'Fan Coil / Self Contained / AHU',
  'Climatizadores com ventilador centrífugo, filtros e dutos (aplicar em conjunto com o plano da Portaria 3.523 para dutos).',
  ['Fan Coil', 'Fancolete', 'Self Contained', 'Rooftop', 'Climatizador / AHU'],
  'Portaria 3.523/98; NBR 13971; NBR 16401-3',
  [
    ['Filtragem', 'Verificar/limpar filtros G4 e registrar perda de carga', 'mensal', 15, { unidade: 'Pa' }],
    ['Filtragem', 'Substituir filtros finos (F5–F9) conforme perda de carga final', 'semestral', 30],
    ['Gabinete', 'Limpar bandeja, dreno e sifão; aplicar pastilha bactericida', 'mensal', 15],
    ['Gabinete', 'Lavar serpentina com remoção de biofilme', 'trimestral', 60],
    ['Ventilação', 'Verificar tensão e alinhamento de correias e polias', 'mensal', 10],
    ['Ventilação', 'Lubrificar mancais do ventilador e motor', 'trimestral', 15],
    ['Ventilação', 'Medir corrente do motor do ventilador', 'mensal', 5, { unidade: 'A' }],
    ['Hidrônica', 'Verificar válvula de 2/3 vias e atuador', 'trimestral', 10],
    ['Expansão direta', 'Medir pressões e superaquecimento (self contained)', 'trimestral', 20, { unidade: 'K', min: 5, max: 12 }],
    ['Desempenho', 'Medir temperaturas de insuflamento e retorno', 'mensal', 10, { unidade: '°C' }],
    ['Ar externo', 'Verificar tomada de ar externo, damper e vazão de renovação', 'trimestral', 15],
  ],
);

export const PLANO_TORRE = base(
  'plano-torre',
  'Torre de Resfriamento',
  'Controle microbiológico (Legionella), tratamento de água e componentes mecânicos.',
  ['Torre de Resfriamento'],
  'Portaria 3.523/98; NBR 13971',
  [
    ['Bacia e enchimento', 'Verificar e eliminar sujeira, danos e corrosão', 'mensal', 20],
    ['Bacia e enchimento', 'Limpar bacia e enchimento; remover lodo e incrustações', 'trimestral', 120],
    ['Tratamento de água', 'Verificar dosagem de biocida e inibidor de corrosão', 'semanal', 10],
    ['Tratamento de água', 'Análise microbiológica da água (incl. Legionella)', 'trimestral', 15],
    ['Mecânica', 'Verificar ventilador, redutor (nível de óleo), correias e mancais', 'mensal', 20],
    ['Mecânica', 'Verificar boia de reposição e eliminadores de gotas', 'mensal', 10],
    ['Elétrica', 'Medir corrente do motor do ventilador', 'mensal', 5, { unidade: 'A' }],
  ],
);

export const PLANO_REFRIGERACAO = base(
  'plano-refrigeracao',
  'Câmara Fria / Refrigeração Comercial',
  'Câmaras frigoríficas, balcões e expositores. Foco em segurança alimentar, degelo e estanqueidade.',
  ['Câmara Fria', 'Balcão / Expositor Refrigerado', 'Bebedouro / Purificador'],
  'NBR 13971; manual do fabricante; RDC ANVISA 216/2004 (boas práticas)',
  [
    ['Operação', 'Registrar temperatura interna da câmara/expositor', 'diaria', 2, { unidade: '°C' }],
    ['Evaporador', 'Verificar formação de gelo e ciclo de degelo (resistências/timer)', 'mensal', 15],
    ['Evaporador', 'Limpar serpentina, bandeja e dreno (com resistência de dreno)', 'trimestral', 40],
    ['Condensador', 'Limpar condensador e verificar ventiladores', 'mensal', 20],
    ['Circuito frigorífico', 'Medir pressões de sucção/descarga e superaquecimento', 'trimestral', 20, { unidade: 'K' }],
    ['Circuito frigorífico', 'Verificar visor de líquido, filtro secador e vazamentos', 'trimestral', 15],
    ['Isolamento', 'Verificar gaxetas e vedação das portas, cortina de PVC e painéis', 'mensal', 10],
    ['Elétrica', 'Medir tensão e corrente do compressor', 'mensal', 5, { unidade: 'A' }],
    ['Elétrica', 'Verificar controlador eletrônico, sensores e alarmes', 'mensal', 10],
    ['Segurança', 'Testar alarme de pessoa presa / abertura interna da porta', 'mensal', 5],
  ],
);

export const PLANO_VENTILACAO = base(
  'plano-ventilacao',
  'Exaustão / Ventilação / Cortina de Ar',
  'Exaustores, ventiladores e cortinas de ar.',
  ['Exaustor / Ventilador', 'Cortina de Ar', 'Desumidificador'],
  'NBR 13971',
  [
    ['Ventilador', 'Limpar rotor, carcaça e grelhas', 'trimestral', 20],
    ['Ventilador', 'Verificar fixação, ruído e vibração', 'mensal', 5],
    ['Ventilador', 'Lubrificar mancais / verificar correias', 'trimestral', 10],
    ['Elétrica', 'Medir corrente do motor', 'trimestral', 5, { unidade: 'A' }],
    ['Filtros', 'Limpar ou substituir filtros (quando houver)', 'mensal', 10],
  ],
);

export const PLANOS_PADRAO: PlanoManutencao[] = [
  PLANO_SPLIT,
  PLANO_PORTARIA,
  PLANO_VRF,
  PLANO_CHILLER,
  PLANO_FANCOIL,
  PLANO_TORRE,
  PLANO_REFRIGERACAO,
  PLANO_VENTILACAO,
];

/** Sugere o plano padrão adequado a um tipo de equipamento. */
export function planoSugerido(tipo: string, planos: PlanoManutencao[]): PlanoManutencao | undefined {
  return planos.find((p) => p.tiposEquipamento.includes(tipo)) ?? planos.find((p) => p.id === PLANO_SPLIT.id);
}
