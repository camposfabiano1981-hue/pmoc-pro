import { ALL_TABLES, db, EMPRESA_PADRAO, getSetting, nextNumber, nowIso, setSetting, uid } from './db';
import { PLANOS_PADRAO, planoSugerido } from './planosPadrao';
import type {
  AnaliseAr, Ambiente, Cliente, Contrato, Equipamento, Fornecedor, Ocorrencia, Orcamento, OS, Peca, Pmoc,
  Profissional, RegistroFluido, Servico, Unidade,
} from './types';
import { addDays, dateStr, localDateTimeStr, todayStr } from '../lib/format';
import { gerarPreventivas } from '../lib/preventivas';
import { aplicarPlano, migrarRotinas, registrarExecucoesDaOS } from '../lib/rotinas';
import { RECOMENDACOES_PADRAO } from '../lib/catalogs';

const stamp = () => {
  const ts = nowIso();
  return { createdAt: ts, updatedAt: ts };
};

/** Garante planos padrão e dados da empresa. Executado em toda inicialização. */
export async function ensureBase(): Promise<void> {
  const count = await db.planos.count();
  if (count === 0) await db.planos.bulkPut(PLANOS_PADRAO);
  const emp = await db.settings.get('empresa');
  if (!emp) await setSetting('empresa', EMPRESA_PADRAO);
  await migrarRotinas();
}

export async function isInitialized(): Promise<boolean> {
  return getSetting<boolean>('initialized', false);
}

export async function markInitialized(): Promise<void> {
  await setSetting('initialized', true);
}

// gerador pseudoaleatório determinístico (demonstração reprodutível)
let s = 42;
const rnd = () => {
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
};

export async function seedDemo(): Promise<void> {
  await ensureBase();
  // uma única transação: rápido e sem disparar atualizações de tela a cada gravação
  await db.transaction('rw', [...ALL_TABLES.map((t) => db.table(t)), db.settings], seedDados);
}

async function seedDados(): Promise<void> {
  s = 42;
  await setSetting('empresa', {
    ...EMPRESA_PADRAO,
    razaoSocial: 'Clima Forte Refrigeração e Climatização Ltda (DEMONSTRAÇÃO)',
    fantasia: 'Clima Forte',
    cnpj: '00.000.000/0001-00',
    telefone: '(67) 3000-0000',
    whatsapp: '(67) 99999-0000',
    email: 'contato@exemplo.com.br',
    endereco: 'Rua Exemplo, 100 — Centro',
    cidade: 'Corumbá',
    uf: 'MS',
    cep: '79300-000',
    rodape: 'Dados fictícios de demonstração — PMOC Pro',
  });

  // ---------- Profissionais ----------
  const hoje = todayStr();
  const profs: Profissional[] = [
    {
      id: uid(), ...stamp(), nome: 'Eng. Carlos Andrade (exemplo)', cpf: '', funcao: 'Engenheiro Mecânico', perfil: 'supervisor', setor: 'Equipe PMOC com ART', conselho: 'CREA',
      registro: 'MS-000000/D', especialidades: 'Responsável técnico PMOC, projetos HVAC', telefone: '(67) 99999-0001',
      email: 'rt@exemplo.com.br', valorHora: 180, cor: '#0e7490', asoValidade: addDays(hoje, 200),
      certificacoes: [{ nome: 'NR-10 Básico', validade: addDays(hoje, 400) }, { nome: 'NR-35 Trabalho em Altura', validade: addDays(hoje, 25) }],
      ativo: true,
    },
    {
      id: uid(), ...stamp(), nome: 'João Pereira (exemplo)', funcao: 'Técnico em Refrigeração', perfil: 'tecnico', setor: 'Manutenção', conselho: 'CFT', registro: 'CFT-000001',
      especialidades: 'Split, VRF, câmara fria, brasagem', telefone: '(67) 99999-0002', valorHora: 85, cor: '#7c3aed',
      asoValidade: addDays(hoje, 90),
      certificacoes: [{ nome: 'NR-10 Básico', validade: addDays(hoje, 300) }, { nome: 'NR-35 Trabalho em Altura', validade: addDays(hoje, 150) }, { nome: 'Recolhimento de Fluidos (CTF/IBAMA)', validade: addDays(hoje, 700) }],
      ativo: true,
    },
    {
      id: uid(), ...stamp(), nome: 'Paulo Santos (exemplo)', funcao: 'Técnico em Eletrotécnica', perfil: 'tecnico', setor: 'Elétrica', conselho: 'CFT', registro: 'CFT-000002',
      especialidades: 'Comandos elétricos, automação, inversores', telefone: '(67) 99999-0003', valorHora: 85, cor: '#ea580c',
      asoValidade: addDays(hoje, -10),
      certificacoes: [{ nome: 'NR-10 SEP', validade: addDays(hoje, 220) }, { nome: 'NR-35 Trabalho em Altura', validade: addDays(hoje, -5) }],
      ativo: true,
    },
    {
      id: uid(), ...stamp(), nome: 'Marcos Lima (exemplo)', funcao: 'Ajudante', perfil: 'tecnico', setor: 'Manutenção', telefone: '(67) 99999-0004', valorHora: 40, cor: '#16a34a',
      asoValidade: addDays(hoje, 300), certificacoes: [{ nome: 'NR-35 Trabalho em Altura', validade: addDays(hoje, 360) }], ativo: true,
    },
  ];
  await db.profissionais.bulkAdd(profs);
  const [rt, tec1, tec2, ajud] = profs;

  // ---------- Fornecedores ----------
  const fornecedores: Fornecedor[] = [
    { id: uid(), ...stamp(), nome: 'Distribuidora Frio Sul (exemplo)', categoria: 'Peças e fluidos', telefone: '(67) 3000-1000', cidade: 'Campo Grande', uf: 'MS' },
    { id: uid(), ...stamp(), nome: 'Elétrica Pantaneira (exemplo)', categoria: 'Materiais elétricos', telefone: '(67) 3000-2000', cidade: 'Corumbá', uf: 'MS' },
    { id: uid(), ...stamp(), nome: 'Laboratório Ar Puro (exemplo)', categoria: 'Análise da qualidade do ar', telefone: '(67) 3000-3000', cidade: 'Campo Grande', uf: 'MS' },
  ];
  await db.fornecedores.bulkAdd(fornecedores);

  // ---------- Peças ----------
  const pecasBase: [string, string, string, number, number, number, number][] = [
    ['Capacitor 35+5 µF 440 V', 'Capacitor', 'un', 38, 75, 12, 5],
    ['Capacitor 45+5 µF 440 V', 'Capacitor', 'un', 45, 90, 8, 5],
    ['Capacitor 2,5 µF (ventilador)', 'Capacitor', 'un', 12, 30, 20, 10],
    ['Fluido refrigerante R-410A (cilindro 11,3 kg)', 'Fluido refrigerante', 'kg', 52, 110, 22.6, 11.3],
    ['Fluido refrigerante R-32 (cilindro 7 kg)', 'Fluido refrigerante', 'kg', 48, 100, 14, 7],
    ['Fluido refrigerante R-22 (cilindro 13,6 kg)', 'Fluido refrigerante', 'kg', 95, 180, 6, 6],
    ['Tubo de cobre 1/4" (rolo 15 m)', 'Tubulação de cobre', 'm', 18, 35, 30, 15],
    ['Tubo de cobre 3/8"', 'Tubulação de cobre', 'm', 26, 48, 30, 15],
    ['Isolamento elastomérico 3/8"', 'Isolamento térmico', 'm', 6, 14, 40, 20],
    ['Mangueira de dreno cristal 5/8"', 'Dreno / Bomba de dreno', 'm', 3, 8, 50, 20],
    ['Bomba de dreno mini', 'Dreno / Bomba de dreno', 'un', 180, 320, 2, 2],
    ['Sensor de temperatura NTC 10k', 'Sensor / Termistor', 'un', 22, 55, 3, 5],
    ['Controle remoto universal', 'Controle remoto', 'un', 35, 79, 6, 3],
    ['Placa eletrônica universal split', 'Placa eletrônica', 'un', 210, 420, 1, 2],
    ['Motor ventilador condensadora 1/6 cv', 'Motor ventilador', 'un', 260, 480, 1, 1],
    ['Contator 25 A bobina 220 V', 'Contator / Relé', 'un', 85, 160, 4, 2],
    ['Filtro secador 1/4"', 'Filtro secador', 'un', 18, 45, 10, 5],
    ['Limpa serpentina alcalino 5 L', 'Produto químico / Higienização', 'L', 14, 0, 25, 10],
    ['Bactericida para evaporadora 1 L', 'Produto químico / Higienização', 'L', 32, 0, 6, 4],
    ['Filtro G4 592×592×48', 'Filtro', 'un', 55, 110, 8, 6],
    ['Suporte condensadora 450 mm (par)', 'Suporte / Fixação', 'par', 45, 95, 6, 4],
    ['Vareta de solda Foscoper 5%', 'Outros', 'un', 6, 0, 30, 20],
  ];
  const pecas: Peca[] = [];
  for (const [descricao, categoria, unidade, custo, precoVenda, estoque, estoqueMinimo] of pecasBase) {
    pecas.push({
      id: uid(), ...stamp(), codigo: await nextNumber('peca'), descricao, categoria, unidade, custo, precoVenda, estoque, estoqueMinimo,
      fornecedorId: categoria === 'Contator / Relé' ? fornecedores[1].id : fornecedores[0].id, localizacao: 'Almoxarifado A', ativo: true,
    });
  }
  await db.pecas.bulkAdd(pecas);

  // ---------- Serviços ----------
  const servBase: [string, string, string, number, number][] = [
    ['Manutenção preventiva split até 12.000 BTU/h', 'Manutenção preventiva', 'serviço', 60, 150],
    ['Manutenção preventiva split 18.000–30.000 BTU/h', 'Manutenção preventiva', 'serviço', 90, 200],
    ['Manutenção preventiva split acima de 30.000 BTU/h', 'Manutenção preventiva', 'serviço', 120, 280],
    ['Higienização completa evaporadora (NBR 14679)', 'Higienização', 'serviço', 90, 220],
    ['Limpeza de condensadora', 'Higienização', 'serviço', 45, 120],
    ['Instalação split até 12.000 BTU/h (até 3 m)', 'Instalação', 'serviço', 240, 650],
    ['Instalação split 18.000–24.000 BTU/h (até 3 m)', 'Instalação', 'serviço', 300, 850],
    ['Desinstalação split', 'Desinstalação', 'serviço', 90, 250],
    ['Carga de fluido refrigerante (mão de obra)', 'Carga de gás', 'serviço', 60, 180],
    ['Localização e reparo de vazamento com brasagem', 'Manutenção corretiva', 'serviço', 120, 350],
    ['Substituição de capacitor', 'Manutenção corretiva', 'serviço', 30, 90],
    ['Substituição de compressor', 'Manutenção corretiva', 'serviço', 360, 1200],
    ['Hora técnica — técnico de refrigeração', 'Mão de obra (hora)', 'h', 60, 120],
    ['Visita técnica / diagnóstico', 'Visita técnica', 'serviço', 60, 150],
    ['Elaboração de PMOC com ART/TRT', 'Laudo / PMOC', 'serviço', 480, 1500],
    ['Coleta para análise da qualidade do ar (RE 09/2003)', 'Análise da qualidade do ar', 'ponto', 30, 380],
  ];
  const servicos: Servico[] = [];
  for (const [descricao, categoria, unidade, tempoPadraoMin, preco] of servBase) {
    servicos.push({ id: uid(), ...stamp(), codigo: await nextNumber('serv'), descricao, categoria, unidade, tempoPadraoMin, preco, ativo: true });
  }
  await db.servicos.bulkAdd(servicos);

  // ---------- Cliente / Unidades / Ambientes ----------
  const cliente: Cliente = {
    id: uid(), ...stamp(), nome: 'Indústria Modelo S.A. (exemplo)', fantasia: 'Indústria Modelo', tipoPessoa: 'PJ', cpfCnpj: '',
    email: 'facilities@exemplo.com.br', telefone: '(67) 3000-4000', contato: 'Ana Souza — Facilities', endereco: 'Rodovia Exemplo, km 10',
    numero: 'S/N', bairro: 'Zona Rural', cidade: 'Corumbá', uf: 'MS', cep: '79300-000', ativo: true,
  };
  const cliente2: Cliente = {
    id: uid(), ...stamp(), nome: 'Clínica Bem Estar (exemplo)', tipoPessoa: 'PJ', telefone: '(67) 3000-5000', cidade: 'Corumbá', uf: 'MS', ativo: true,
  };
  await db.clientes.bulkAdd([cliente, cliente2]);

  const sede: Unidade = {
    id: uid(), ...stamp(), clienteId: cliente.id, nome: 'Escritório Central', tipoEdificacao: 'Escritório / Corporativo',
    endereco: 'Av. Exemplo', numero: '1000', bairro: 'Centro', cidade: 'Corumbá', uf: 'MS', telefone: '(67) 3000-4001',
    responsavelLocal: 'Ana Souza', areaConstruida: 1450, ativo: true,
  };
  const planta: Unidade = {
    id: uid(), ...stamp(), clienteId: cliente.id, nome: 'Planta Industrial — Área 4', tipoEdificacao: 'Indústria / Mineração',
    endereco: 'Rodovia Exemplo, km 10', cidade: 'Corumbá', uf: 'MS', responsavelLocal: 'Roberto Dias', areaConstruida: 5200, ativo: true,
  };
  const clinica: Unidade = {
    id: uid(), ...stamp(), clienteId: cliente2.id, nome: 'Clínica Bem Estar — Matriz', tipoEdificacao: 'Hospital / Clínica',
    endereco: 'Rua das Flores', numero: '50', cidade: 'Corumbá', uf: 'MS', ativo: true,
  };
  await db.unidades.bulkAdd([sede, planta, clinica]);

  const ambDef: [Unidade, string, string, string, number, number, number][] = [
    [sede, 'Administrativo', 'Recepção', 'Atendimento ao público', 1, 4, 17.29],
    [sede, 'Administrativo', 'Sala RH', 'Escritório', 4, 2, 35.77],
    [sede, 'Administrativo', 'Sala dos Gerentes', 'Escritório', 4, 6, 40.82],
    [sede, 'Administrativo', 'Sala de Treinamento Tamanduá', 'Treinamento / Sala de aula', 2, 50, 52.59],
    [sede, 'Administrativo', 'Sala de Treinamento Tucano', 'Treinamento / Sala de aula', 2, 17, 34.05],
    [sede, 'TI', 'Data Center', 'Data center / TI', 0, 1, 22.0],
    [sede, 'TI', 'Sala Nobreak', 'CCM / Sala elétrica', 0, 1, 9.5],
    [sede, 'Apoio', 'Copa', 'Refeitório / Copa', 2, 2, 4.51],
    [planta, 'Usina', 'CCO Usina', 'Produção / Industrial', 2, 2, 12.78],
    [planta, 'Usina', 'CCM PB-05', 'CCM / Sala elétrica', 0, 1, 18.0],
    [planta, 'PCM', 'Sala de Planejamento', 'Escritório', 6, 3, 53.47],
    [planta, 'Saúde', 'Ambulatório', 'Ambulatório / Saúde', 2, 3, 20.35],
    [planta, 'Apoio', 'Laboratório', 'Laboratório', 1, 1, 15.29],
    [clinica, 'Atendimento', 'Recepção Clínica', 'Atendimento ao público', 2, 15, 40],
    [clinica, 'Atendimento', 'Consultório 1', 'Ambulatório / Saúde', 1, 2, 12],
  ];
  const ambientes: Ambiente[] = ambDef.map(([u, grupo, nome, tipoAtividade, ocupantesFixos, ocupantesFlutuantes, areaM2]) => ({
    id: uid(), ...stamp(), unidadeId: u.id, grupo, nome, localizacao: nome, tipoAtividade, ocupantesFixos, ocupantesFlutuantes, areaM2,
  }));
  await db.ambientes.bulkAdd(ambientes);

  // ---------- Equipamentos ----------
  const planos = await db.planos.toArray();
  const eqDef: [number, string, string, number, string][] = [
    [0, 'Split Hi-Wall', 'LG', 22000, 'R-410A'],
    [1, 'Split Hi-Wall', 'Springer', 22000, 'R-410A'],
    [1, 'Split Hi-Wall', 'Samsung', 12000, 'R-32'],
    [2, 'Split Hi-Wall', 'Consul', 22000, 'R-410A'],
    [2, 'Split Hi-Wall', 'Samsung', 12000, 'R-32'],
    [3, 'Split Piso-Teto', 'Carrier', 48000, 'R-410A'],
    [3, 'Split Piso-Teto', 'Samsung', 18000, 'R-410A'],
    [4, 'Split Hi-Wall', 'LG', 18000, 'R-32'],
    [5, 'Split Hi-Wall', 'Electrolux', 36000, 'R-410A'],
    [5, 'Split Hi-Wall', 'Electrolux', 36000, 'R-410A'],
    [6, 'Split Hi-Wall', 'Samsung', 24000, 'R-410A'],
    [7, 'Split Hi-Wall', 'Springer', 9000, 'R-22'],
    [8, 'Janela (ACJ)', 'Consul', 7500, 'R-22'],
    [9, 'Split Hi-Wall', 'Midea', 18000, 'R-410A'],
    [10, 'Split Cassete', 'Daikin', 36000, 'R-32'],
    [10, 'Split Hi-Wall', 'Gree', 24000, 'R-410A'],
    [11, 'Split Hi-Wall', 'Elgin', 12000, 'R-410A'],
    [12, 'Janela (ACJ)', 'Springer', 10000, 'R-22'],
    [13, 'Split Cassete', 'Fujitsu', 36000, 'R-410A'],
    [14, 'Split Hi-Wall', 'LG', 12000, 'R-32'],
  ];
  const correnteDe = (btu: number) => Math.round((btu / 12000) * 4.6 * 10) / 10;
  const equipamentos: Equipamento[] = [];
  for (const [ai, tipo, marca, cap, fluido] of eqDef) {
    const amb = ambientes[ai];
    const tag = await nextNumber('eq');
    equipamentos.push({
      id: uid(), ...stamp(), tag, unidadeId: amb.unidadeId, ambienteId: amb.id, tipo, marca,
      modelo: `${marca.slice(0, 3).toUpperCase()}-${cap / 1000}K`, numeroSerie: `SN${Math.floor(rnd() * 9e7 + 1e7)}`,
      patrimonio: rnd() > 0.3 ? String(Math.floor(rnd() * 9000 + 1000)) : 'S/PAT', capacidadeBtu: cap,
      tecnologia: rnd() > 0.4 ? 'Inverter' : 'Convencional (on/off)', tensao: cap >= 36000 ? '380 V' : '220 V', fases: cap >= 36000 ? 'Trifásico' : 'Monofásico',
      correnteNominal: correnteDe(cap), fluido, cargaFluidoKg: Math.round((cap / 12000) * 0.75 * 100) / 100,
      dataInstalacao: dateStr(new Date(2018 + Math.floor(rnd() * 7), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))),
      garantiaAte: rnd() > 0.7 ? addDays(hoje, Math.floor(rnd() * 200) - 30) : undefined,
      criticidade: amb.tipoAtividade?.startsWith('Data') || amb.tipoAtividade?.startsWith('CCM') || amb.tipoAtividade?.startsWith('Ambul') ? 'A' : rnd() > 0.5 ? 'B' : 'C',
      centroCusto: `CC-${100 + ai}`, status: 'operando', planoId: planoSugerido(tipo, planos)?.id, localCondensadora: 'Fachada / laje técnica',
    });
  }
  equipamentos[11].status = 'parado';
  equipamentos[11].observacoes = 'Compressor em curto — aguardando aprovação de orçamento.';
  await db.equipamentos.bulkAdd(equipamentos);

  // ---------- Contrato e PMOC ----------
  const now = new Date();
  const inicioVig = dateStr(new Date(now.getFullYear(), now.getMonth() - 6, 1));
  const fimVig = dateStr(new Date(now.getFullYear(), now.getMonth() + 6, 0));
  const contrato: Contrato = {
    id: uid(), ...stamp(), numero: await nextNumber('ct'), clienteId: cliente.id,
    objeto: 'Prestação de serviços de manutenção preventiva e corretiva em sistemas de climatização com elaboração e execução do PMOC.',
    inicio: inicioVig, fim: fimVig, valorMensal: 6800, diaVencimento: 10, slaUrgenteH: 4, slaAltaH: 24, slaMediaH: 48, slaBaixaH: 120, status: 'ativo',
  };
  await db.contratos.add(contrato);

  const pmocs: Pmoc[] = [];
  for (const u of [sede, planta]) {
    pmocs.push({
      id: uid(), ...stamp(), codigo: await nextNumber('pmoc'), unidadeId: u.id, contratoId: contrato.id, rtId: rt.id, artTipo: 'ART',
      artNumero: `0000${Math.floor(rnd() * 900000 + 100000)}`, artInicio: inicioVig, artFim: fimVig, vigenciaInicio: inicioVig, vigenciaFim: fimVig,
      revisao: 0, status: 'vigente', sistemas: 'Ar-condicionado (expansão direta: split e janela)', recomendacoes: RECOMENDACOES_PADRAO,
    });
  }
  await db.pmocs.bulkAdd(pmocs);

  // ---------- Rotinas por equipamento + histórico de execução ----------
  for (const e of equipamentos) {
    await db.equipamentos.update(e.id, { inicioPlano: inicioVig });
    await aplicarPlano(e.id, inicioVig);
  }
  const eqMap = new Map(equipamentos.map((e) => [e.id, e]));
  const mesPassado = dateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  for (let k = -6; k <= 0; k++) {
    const de = dateStr(new Date(now.getFullYear(), now.getMonth() + k, 1));
    const ate = dateStr(new Date(now.getFullYear(), now.getMonth() + k + 1, 0));
    const r = await gerarPreventivas({ unidadeIds: [sede.id, planta.id], de, ate, agrupamento: 'equipamento', responsavelId: tec1.id, tecnicosIds: [tec1.id, ajud.id] });
    const abertura = new Date(de + 'T07:30:00');
    abertura.setDate(abertura.getDate() - 3);
    for (const os of r.criadas) {
      os.dataAbertura = abertura.toISOString();
      os.historico = [{ data: os.dataAbertura, texto: 'OS gerada automaticamente pelas rotinas de manutenção dos equipamentos', usuario: 'Gestor' }];
      await db.os.put(os);
    }
    for (const os of r.criadas) {
      // deixa a preventiva do mês passado da planta em aberto para demonstrar atraso e rotinas vencidas
      if (os.unidadeId === planta.id && de.slice(0, 7) === mesPassado) continue;
      // mês corrente: só parte da sede já foi executada
      if (k === 0 && (os.unidadeId === planta.id || (os.dataAgendada || de) > addDays(hoje, -3) || rnd() > 0.75)) continue;
      const eq = eqMap.get(os.equipamentos[0].equipamentoId)!;
      const base = new Date((os.dataAgendada || de) + 'T08:00:00');
      base.setDate(base.getDate() + Math.floor(rnd() * 3));
      const inicio = new Date(base.getTime() + Math.floor(rnd() * 6) * 3600_000);
      const fim = new Date(inicio.getTime() + (0.8 + rnd() * 1.6) * 3600_000);
      const executor = rnd() > 0.35 ? tec1.id : tec2.id;
      os.status = k < -1 || (k === -1 && rnd() > 0.3) ? 'validada' : 'concluida';
      os.inicio = localDateTimeStr(inicio);
      os.fim = localDateTimeStr(fim);
      os.apontamentos = [{ profissionalId: executor, inicio: os.inicio, fim: os.fim }, { profissionalId: ajud.id, inicio: os.inicio, fim: os.fim }];
      os.servicoExecutado = 'Executadas as rotinas programadas do plano de manutenção do equipamento. Equipamento operando dentro dos parâmetros.';
      os.nomeAssinante = 'Ana Souza';
      if (os.status === 'validada') {
        os.supervisorId = rt.id;
        os.liberacao = localDateTimeStr(new Date(fim.getTime() + 20 * 3600_000));
      }
      for (const item of os.equipamentos) {
        item.concluido = true;
        for (const c of item.checklist) {
          const naoExec = rnd() > 0.97;
          c.execucao = naoExec ? 'N' : 'E';
          c.executorId = executor;
          c.dataExecucao = os.fim;
          c.tempoRealMin = c.tempoPrevistoMin ? Math.max(2, Math.round(c.tempoPrevistoMin * (0.7 + rnd() * 0.6))) : undefined;
          c.resultado = naoExec ? '' : rnd() > 0.93 ? 'corrigido' : 'ok';
          if (naoExec) c.obs = 'Ambiente ocupado — cliente não liberou a intervenção';
          if (c.tipo === 'medicao' && !naoExec) {
            if (c.unidade === 'V') c.valor = String(Math.round(214 + rnd() * 12));
            else if (c.unidade === 'A') c.valor = String(Math.round((eq.correnteNominal || 5) * (0.75 + rnd() * 0.3) * 10) / 10);
            else if (c.unidade === '°C') c.valor = String(Math.round((c.min ?? 12) + rnd() * 3));
            else if (c.unidade === 'K') c.valor = String(Math.round((c.min ?? 8) + 1 + rnd() * 3));
            else c.valor = String(Math.round(100 + rnd() * 30));
          }
        }
        item.medicoes = {
          tensao: String(Math.round(214 + rnd() * 12)),
          corrente: String(Math.round((eq.correnteNominal || 5) * (0.75 + rnd() * 0.3) * 10) / 10),
          tRetorno: String(Math.round((23 + rnd() * 2) * 10) / 10),
          tInsuflamento: String(Math.round((12 + rnd() * 3) * 10) / 10),
        };
      }
      os.historico.push({ data: os.fim, texto: 'Execução concluída', usuario: profs.find((p) => p.id === executor)?.nome });
      if (os.liberacao) os.historico.push({ data: os.liberacao, texto: 'OS liberada pelo supervisor', usuario: rt.nome });
      await db.os.put(os);
      await registrarExecucoesDaOS(os);
    }
  }

  // ---------- Corretivas / ocorrências ----------
  const equipCopa = equipamentos[11];
  const equipDC = equipamentos[8];
  const oc: Ocorrencia[] = [];
  const ocDef: [Equipamento, string, Ocorrencia['status'], Ocorrencia['prioridade'], string, number][] = [
    [equipCopa, 'Quebra', 'convertida', 'alta', 'Equipamento não liga — disjuntor desarma ao acionar o compressor.', -8],
    [equipDC, 'Anomalia crítica', 'em_analise', 'urgente', 'Temperatura do Data Center chegou a 29 °C no período da tarde.', -1],
    [equipamentos[5], 'Reclamação de conforto', 'nao_analisada', 'media', 'Sala de treinamento não gela com a sala cheia.', 0],
    [equipamentos[16], 'Vazamento', 'nao_analisada', 'media', 'Gotejamento de água na parede abaixo da evaporadora.', 0],
  ];
  for (const [eq, tipo, status, prioridade, descricao, dias] of ocDef) {
    oc.push({
      id: uid(), ...stamp(), numero: await nextNumber('oc'), tipo, status, prioridade, dataHora: localDateTimeStr(new Date(now.getTime() + dias * 86400_000)),
      emitente: 'Ana Souza', unidadeId: eq.unidadeId, ambienteId: eq.ambienteId, equipamentoId: eq.id, descricao,
    });
  }
  await db.ocorrencias.bulkAdd(oc);

  const capacitor = pecas[0];
  const corretiva1: OS = {
    id: uid(), ...stamp(), numero: await nextNumber('os'), tipo: 'Corretiva', prioridade: 'alta', status: 'aguardando_peca', origem: 'ocorrencia',
    clienteId: cliente.id, unidadeId: equipCopa.unidadeId, ambienteId: equipCopa.ambienteId, contratoId: contrato.id, ocorrenciaId: oc[0].id,
    titulo: 'Equipamento não liga — Copa', solicitante: 'Ana Souza', descricao: oc[0].descricao,
    diagnostico: 'Compressor com enrolamento em curto (resistência ôhmica 0,3 Ω entre C-R). Capacitor estufado.',
    responsavelId: tec1.id, tecnicosIds: [tec1.id, tec2.id], dataAbertura: new Date(now.getTime() - 8 * 86400_000).toISOString(),
    dataAgendada: addDays(hoje, -7), prazo: addDays(hoje, -6), inicio: localDateTimeStr(new Date(now.getTime() - 7 * 86400_000)),
    equipamentos: [{ equipamentoId: equipCopa.id, checklist: [], medicoes: { tensao: '221', corrente: '' }, obs: 'Aguardando compressor.' }],
    pecas: [{ pecaId: capacitor.id, descricao: capacitor.descricao, unidade: 'un', quantidade: 1, custoUnit: capacitor.custo, precoUnit: capacitor.precoVenda }],
    servicos: [{ servicoId: servicos[13].id, descricao: servicos[13].descricao, quantidade: 1, precoUnit: servicos[13].preco }],
    apontamentos: [{ profissionalId: tec1.id, inicio: localDateTimeStr(new Date(now.getTime() - 7 * 86400_000)), fim: localDateTimeStr(new Date(now.getTime() - 7 * 86400_000 + 5400_000)) }],
    fotos: [], historico: [{ data: nowIso(), texto: 'OS criada a partir da ocorrência ' + oc[0].numero }],
  };
  const corretiva2: OS = {
    id: uid(), ...stamp(), numero: await nextNumber('os'), tipo: 'Corretiva', prioridade: 'urgente', status: 'em_execucao', origem: 'manual',
    clienteId: cliente.id, unidadeId: equipDC.unidadeId, ambienteId: equipDC.ambienteId, contratoId: contrato.id,
    titulo: 'Alta temperatura no Data Center', solicitante: 'TI — Plantão', descricao: oc[1].descricao, responsavelId: tec1.id,
    tecnicosIds: [tec1.id], dataAbertura: new Date(now.getTime() - 20 * 3600_000).toISOString(), dataAgendada: hoje,
    prazo: hoje, inicio: localDateTimeStr(new Date(now.getTime() - 2 * 3600_000)),
    equipamentos: [{ equipamentoId: equipDC.id, checklist: [], medicoes: { tensao: '378', corrente: '14.9', tRetorno: '27.5', tInsuflamento: '22.1', pSuccao: '98', tLinhaSuccao: '17' } }],
    pecas: [], servicos: [], apontamentos: [{ profissionalId: tec1.id, inicio: localDateTimeStr(new Date(now.getTime() - 2 * 3600_000)) }], fotos: [],
    historico: [{ data: nowIso(), texto: 'OS aberta pelo plantão' }],
  };
  const concluidaCorr: OS = {
    id: uid(), ...stamp(), numero: await nextNumber('os'), tipo: 'Corretiva', prioridade: 'media', status: 'concluida', origem: 'manual',
    clienteId: cliente.id, unidadeId: equipamentos[3].unidadeId, ambienteId: equipamentos[3].ambienteId, contratoId: contrato.id,
    titulo: 'Troca de capacitor — Sala dos Gerentes', descricao: 'Equipamento desarmando.', diagnostico: 'Capacitor 35+5 µF com 22 µF medidos.',
    servicoExecutado: 'Substituído capacitor e testado funcionamento. Corrente normalizada.', responsavelId: tec2.id, tecnicosIds: [tec2.id],
    dataAbertura: new Date(now.getTime() - 35 * 86400_000).toISOString(), dataAgendada: addDays(hoje, -34),
    inicio: localDateTimeStr(new Date(now.getTime() - 34 * 86400_000)), fim: localDateTimeStr(new Date(now.getTime() - 34 * 86400_000 + 7200_000)),
    equipamentos: [{ equipamentoId: equipamentos[3].id, checklist: [], medicoes: { tensao: '219', corrente: '8.4' }, concluido: true }],
    pecas: [{ pecaId: capacitor.id, descricao: capacitor.descricao, unidade: 'un', quantidade: 1, custoUnit: capacitor.custo, precoUnit: capacitor.precoVenda, baixado: true }],
    servicos: [{ servicoId: servicos[10].id, descricao: servicos[10].descricao, quantidade: 1, precoUnit: servicos[10].preco }],
    apontamentos: [{ profissionalId: tec2.id, inicio: localDateTimeStr(new Date(now.getTime() - 34 * 86400_000)), fim: localDateTimeStr(new Date(now.getTime() - 34 * 86400_000 + 7200_000)) }],
    fotos: [], nomeAssinante: 'Ana Souza', avaliacao: 5, historico: [{ data: nowIso(), texto: 'OS concluída' }],
  };
  await db.os.bulkAdd([corretiva1, corretiva2, concluidaCorr]);
  oc[0].osId = corretiva1.id;
  await db.ocorrencias.put(oc[0]);
  await db.movimentos.add({ id: uid(), ...stamp(), pecaId: capacitor.id, tipo: 'saida', quantidade: 1, custoUnit: capacitor.custo, data: addDays(hoje, -34), osId: concluidaCorr.id, documento: concluidaCorr.numero });
  await db.movimentos.add({ id: uid(), ...stamp(), pecaId: pecas[3].id, tipo: 'entrada', quantidade: 22.6, custoUnit: 52, data: addDays(hoje, -60), documento: 'NF 1234' });

  // ---------- Orçamento ----------
  const compressor: Orcamento = {
    id: uid(), ...stamp(), numero: await nextNumber('orc'), clienteId: cliente.id, unidadeId: equipCopa.unidadeId, data: addDays(hoje, -6),
    validade: addDays(hoje, 9), status: 'enviado', titulo: 'Substituição de compressor — Split 9.000 BTU/h (Copa)',
    descricao: 'Compressor rotativo em curto. Recomenda-se também a substituição do capacitor e filtro secador, com limpeza do circuito (flushing) e nova carga de fluido.',
    pecas: [
      { descricao: 'Compressor rotativo 9.000 BTU/h R-22', unidade: 'un', quantidade: 1, custoUnit: 650, precoUnit: 1100 },
      { pecaId: pecas[16].id, descricao: pecas[16].descricao, unidade: 'un', quantidade: 1, custoUnit: pecas[16].custo, precoUnit: pecas[16].precoVenda },
      { pecaId: pecas[5].id, descricao: pecas[5].descricao, unidade: 'kg', quantidade: 0.9, custoUnit: pecas[5].custo, precoUnit: pecas[5].precoVenda },
    ],
    servicos: [{ servicoId: servicos[11].id, descricao: servicos[11].descricao, quantidade: 1, precoUnit: servicos[11].preco }],
    desconto: 0, deslocamento: 0, condicoes: '50% na aprovação e 50% na conclusão. Garantia de 90 dias para serviços e conforme fabricante para peças.',
    prazoExecucao: '3 dias úteis após aprovação', garantia: '90 dias',
  };
  await db.orcamentos.add(compressor);

  // ---------- Qualidade do ar ----------
  const analises: AnaliseAr[] = [
    { id: uid(), ...stamp(), unidadeId: sede.id, ambienteId: ambientes[3].id, data: addDays(hoje, -150), estacao: 'verao', laboratorio: fornecedores[2].nome, laudo: 'LQA-2026-0101', co2: 860, co2Ext: 410, fungos: 320, fungosExt: 410, aerodispersoides: 42, temperatura: 24.1, umidade: 55, velocidade: 0.18, renovacao: 29 },
    { id: uid(), ...stamp(), unidadeId: sede.id, ambienteId: ambientes[1].id, data: addDays(hoje, -150), estacao: 'verao', laboratorio: fornecedores[2].nome, laudo: 'LQA-2026-0102', co2: 1180, co2Ext: 410, fungos: 690, fungosExt: 380, aerodispersoides: 61, temperatura: 25.6, umidade: 68, velocidade: 0.21, renovacao: 19, observacoes: 'Recomendada adequação da renovação de ar e higienização.' },
    { id: uid(), ...stamp(), unidadeId: planta.id, ambienteId: ambientes[11].id, data: addDays(hoje, -200), estacao: 'verao', laboratorio: fornecedores[2].nome, laudo: 'LQA-2025-0388', co2: 640, co2Ext: 420, fungos: 210, fungosExt: 350, aerodispersoides: 30, temperatura: 23.4, umidade: 50, velocidade: 0.12, renovacao: 31 },
  ];
  await db.analisesAr.bulkAdd(analises);

  // ---------- Fluidos ----------
  const fl: RegistroFluido[] = [
    { id: uid(), ...stamp(), equipamentoId: equipamentos[3].id, data: addDays(hoje, -34), operacao: 'carga', fluido: 'R-410A', quantidadeKg: 0.4, profissionalId: tec2.id, observacoes: 'Complemento após reparo' },
    { id: uid(), ...stamp(), equipamentoId: equipCopa.id, data: addDays(hoje, -7), operacao: 'recolhimento', fluido: 'R-22', quantidadeKg: 0.65, cilindro: 'REC-03', profissionalId: tec1.id, osId: corretiva1.id },
    { id: uid(), ...stamp(), equipamentoId: equipDC.id, data: addDays(hoje, -90), operacao: 'estanqueidade', fluido: 'R-410A', quantidadeKg: 0, profissionalId: tec1.id, observacoes: 'Teste com nitrogênio 450 psig — sem vazamentos' },
  ];
  await db.fluidos.bulkAdd(fl);

  await setSetting('demo', true);
  await markInitialized();
}
