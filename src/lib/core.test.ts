import { projetar, proximaData, rotinasDoPlano, statusRotina } from './rotinas';
import { marcarRotina } from './marcas';
import { inteiroPorExtenso, valorPorExtenso } from './extenso';
import { clausulasContrato, mesesVigencia, ordinal } from './contrato';
import type { CargoPreco, Equipamento, Rotina } from '../db/types';
import {
  COMPOSICAO_PADRAO,
  FAIXAS_BDI,
  PARAMETROS_PADRAO,
  REFERENCIAS_BDI,
  VEICULO_PADRAO,
  alertasDoRegime,
  analisarExequibilidade,
  calcBdi,
  calcMarkup,
  calcularEstudo,
  componentesDoQuartil,
  custoCargo,
  custoPessoalCargo,
  custoVeiculo,
  custosHora,
  dasMei,
  despesasFixas,
  encargoVinculo,
  encargosGrupoA,
  farol,
  ferramentaMensal,
  formacaoPreco,
  horasMes,
  horasPlanoMes,
  round2,
  simplesAnexoIII,
  tributosFaturamento,
} from './precificacao';
import { describe, expect, it } from 'vitest';
import { isDue, monthIndex, matrizAnual, foraDaFaixa } from './schedule';
import { diagnosticar, tSat } from './hvac';
import { parseNum, validaCnpj, validaCpf } from './format';
import { tipoPadrao } from './importer';
import { PLANO_SPLIT } from '../db/planosPadrao';

describe('cronograma', () => {
  const start = monthIndex(2026, 0);
  it('mensal é devida todo mês a partir do início', () => {
    expect(isDue('mensal', monthIndex(2026, 5), start)).toBe(true);
    expect(isDue('mensal', monthIndex(2025, 11), start)).toBe(false);
  });
  it('trimestral cai em jan/abr/jul/out', () => {
    const meses = Array.from({ length: 12 }, (_, m) => isDue('trimestral', monthIndex(2026, m), start));
    expect(meses.map((x, i) => (x ? i : -1)).filter((i) => i >= 0)).toEqual([0, 3, 6, 9]);
  });
  it('semestral atravessa o ano a partir de setembro', () => {
    const s = monthIndex(2026, 8);
    expect(isDue('semestral', monthIndex(2027, 2), s)).toBe(true);
    expect(isDue('semestral', monthIndex(2027, 1), s)).toBe(false);
  });
  it('N/A nunca é devida', () => {
    expect(isDue('na', start, start)).toBe(false);
  });
  it('matriz anual tem 12 colunas por atividade', () => {
    const mz = matrizAnual(PLANO_SPLIT, 2026, start);
    expect(mz.length).toBe(PLANO_SPLIT.atividades.length);
    expect(mz.every((r) => r.length === 12)).toBe(true);
  });
  it('detecta medição fora da faixa', () => {
    expect(foraDaFaixa('250', 198, 242)).toBe(true);
    expect(foraDaFaixa('220', 198, 242)).toBe(false);
    expect(foraDaFaixa('', 198, 242)).toBe(false);
  });
});

describe('termodinâmica', () => {
  it('R-410A: ~118 psig ≈ 4,4 °C de saturação', () => {
    const t = tSat('R-410A', 118)!;
    expect(t).toBeGreaterThan(3.5);
    expect(t).toBeLessThan(5.5);
  });
  it('calcula superaquecimento e ΔT', () => {
    const d = diagnosticar({ pSuccao: '118', tLinhaSuccao: '12', tRetorno: '25', tInsuflamento: '13' }, 'R-410A');
    expect(d.deltaT).toBe(12);
    expect(d.superaquecimento!).toBeGreaterThan(6);
    expect(d.superaquecimento!).toBeLessThan(9);
  });
  it('alerta sobrecarga de corrente', () => {
    const d = diagnosticar({ corrente: '12' }, 'R-410A', 9);
    expect(d.alertas.some((a) => a.includes('sobrecarga'))).toBe(true);
  });
});

describe('utilitários', () => {
  it('valida CPF e CNPJ', () => {
    expect(validaCpf('529.982.247-25')).toBe(true);
    expect(validaCpf('111.111.111-11')).toBe(false);
    expect(validaCnpj('11.222.333/0001-81')).toBe(true);
    expect(validaCnpj('11.222.333/0001-82')).toBe(false);
  });
  it('interpreta capacidades de planilha', () => {
    expect(parseNum('18K')).toBe(18000);
    expect(parseNum('12.000')).toBe(12000);
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum(9000)).toBe(9000);
  });
  it('normaliza tipos de equipamento', () => {
    expect(tipoPadrao('AR SPLIT')).toBe('Split Hi-Wall');
    expect(tipoPadrao('JANELA')).toBe('Janela (ACJ)');
    expect(tipoPadrao('Piso Teto')).toBe('Split Piso-Teto');
  });
});


describe('rotinas por equipamento', () => {
  const eq = { id: 'eq1', tag: 'EQ-1', unidadeId: 'u', tipo: 'Split Hi-Wall', criticidade: 'B', status: 'operando', createdAt: '', updatedAt: '' } as Equipamento;
  const rot = (p: Partial<Rotina>): Rotina => ({ id: 'r', createdAt: '', updatedAt: '', equipamentoId: 'eq1', grupo: '', descricao: 'x', tipo: 'check', periodicidade: 'mensal', intervaloDias: 30, tempoMin: 10, proximaExecucao: '2026-01-10', ativa: true, ...p });

  it('cria rotinas do plano com intervalo em dias e ignora N/A', () => {
    const rs = rotinasDoPlano(eq, PLANO_SPLIT, '2026-01-01');
    expect(rs.length).toBe(PLANO_SPLIT.atividades.filter((a) => a.periodicidade !== 'na').length);
    expect(rs.find((r) => r.periodicidade === 'trimestral')?.intervaloDias).toBe(90);
    expect(rs.every((r) => r.proximaExecucao === '2026-01-01')).toBe(true);
  });
  it('projeta datas a partir da próxima execução', () => {
    expect(projetar(rot({}), '2026-01-01', '2026-03-31')).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
    expect(projetar(rot({ intervaloDias: 15 }), '2026-01-01', '2026-01-31')).toEqual(['2026-01-10', '2026-01-25']);
    expect(projetar(rot({ ativa: false }), '2026-01-01', '2026-03-31')).toEqual([]);
  });
  it('mensal, trimestral e anual avançam por mês de calendário', () => {
    expect(proximaData('2026-01-31', 30)).toBe('2026-02-28');
    expect(proximaData('2026-11-15', 90)).toBe('2027-02-15');
    expect(proximaData('2026-02-10', 365)).toBe('2027-02-10');
    expect(proximaData('2026-02-10', 7)).toBe('2026-02-17');
  });
  it('classifica a situação da rotina', () => {
    expect(statusRotina(rot({ proximaExecucao: '2026-01-05' }), '2026-01-10')).toBe('vencida');
    expect(statusRotina(rot({ proximaExecucao: '2026-01-12' }), '2026-01-10')).toBe('a_vencer');
    expect(statusRotina(rot({ proximaExecucao: '2026-03-01' }), '2026-01-10')).toBe('em_dia');
  });
});

describe('legenda de cores (programado / reprogramado / executado / não executado)', () => {
  const r: Rotina = { id: 'r1', createdAt: '', updatedAt: '', equipamentoId: 'eq1', grupo: '', descricao: 'Limpar filtros', tipo: 'check', periodicidade: 'mensal', intervaloDias: 30, tempoMin: 10, proximaExecucao: '2026-03-10', ativa: true };
  const mes = (d: string) => d.slice(0, 7);
  it('data futura é programada, data passada sem execução é não executada', () => {
    const m = marcarRotina(r, { de: '2026-01-01', ate: '2026-05-31', hoje: '2026-04-15', chave: mes });
    expect(m['2026-03'].m).toBe('N');
    expect(m['2026-04'].m).toBe('N');
    expect(m['2026-05'].m).toBe('P');
  });
  it('reprogramada fica amarela e execução prevalece', () => {
    const m = marcarRotina({ ...r, reprogramada: true }, { de: '2026-03-01', ate: '2026-03-31', hoje: '2026-03-01' });
    expect(m['2026-03-10'].m).toBe('R');
    const e = marcarRotina(r, { de: '2026-03-01', ate: '2026-03-31', hoje: '2026-03-20', chave: mes, execs: [{ id: 'x', createdAt: '', updatedAt: '', rotinaId: 'r1', equipamentoId: 'eq1', data: '2026-03-12', status: 'E' }] });
    expect(e['2026-03'].m).toBe('E');
  });
  it('OS aberta representa a data devida; OS com data alterada é reprogramada', () => {
    const m = marcarRotina(r, { de: '2026-03-01', ate: '2026-03-31', hoje: '2026-03-01', programadas: [{ osId: 'o', numero: 'OS-1', data: '2026-03-15', reprogramada: true }] });
    expect(m['2026-03-10']).toBeUndefined();
    expect(m['2026-03-15'].m).toBe('R');
  });
});

describe('contrato', () => {
  it('escreve valores por extenso', () => {
    expect(valorPorExtenso(1530.5)).toBe('mil quinhentos e trinta reais e cinquenta centavos');
    expect(valorPorExtenso(2500)).toBe('dois mil e quinhentos reais');
    expect(valorPorExtenso(1)).toBe('um real');
    expect(valorPorExtenso(101)).toBe('cento e um reais');
    expect(valorPorExtenso(1_000_000)).toBe('um milhão de reais');
    expect(valorPorExtenso(6800)).toBe('seis mil e oitocentos reais');
    expect(inteiroPorExtenso(12)).toBe('doze');
  });
  it('calcula meses de vigência e ordinais', () => {
    expect(mesesVigencia('2026-01-01', '2026-12-31')).toBe(12);
    expect(mesesVigencia('2026-03-15', '2027-03-14')).toBe(12);
    expect(ordinal(0)).toBe('PRIMEIRA');
    expect(ordinal(11)).toBe('DÉCIMA SEGUNDA');
  });
  it('monta cláusulas do modelo particular e do público', () => {
    const base = { id: 'c', createdAt: '', updatedAt: '', numero: 'CT-1', clienteId: 'x', objeto: 'Manutenção', inicio: '2026-01-01', fim: '2026-12-31', valorMensal: 1000, status: 'ativo' as const };
    const priv = clausulasContrato({ ct: base, empresa: { razaoSocial: 'Empresa' } });
    expect(priv.some((c) => c.titulo === 'DA RESCISÃO')).toBe(true);
    expect(priv.find((c) => c.titulo === 'DO PREÇO E DO PAGAMENTO')!.paragrafos[0].t).toContain('mil reais');
    const pub = clausulasContrato({ ct: { ...base, modelo: 'publico' }, empresa: { razaoSocial: 'Empresa' } });
    expect(pub.some((c) => c.titulo === 'DA GESTÃO E FISCALIZAÇÃO')).toBe(true);
    expect(pub.map((c) => c.paragrafos.map((p) => p.t).join(' ')).join(' ')).toContain('14.133/2021');
  });
});

describe('precificação', () => {
  it('alíquota efetiva do Simples Nacional (Anexo III)', () => {
    const s = simplesAnexoIII(360000);
    expect(s.faixa).toBe(2);
    expect(s.efetiva).toBeCloseTo(8.6, 6); // (360.000 × 11,2% − 9.360) ÷ 360.000
    expect(Object.values(s.tributos).reduce((a, b) => a + b, 0)).toBeCloseTo(8.6, 6);
    expect(simplesAnexoIII(100000).efetiva).toBeCloseTo(6, 6);
  });
  it('limita o ISS do Simples a 5% e redistribui aos federais', () => {
    const s = simplesAnexoIII(3000000); // 5ª faixa: 16,812% efetiva; ISS 33,5% → 5,63% → limitado a 5%
    expect(s.faixa).toBe(5);
    expect(s.tributos.iss).toBeCloseTo(5, 6);
    expect(Object.values(s.tributos).reduce((a, b) => a + b, 0)).toBeCloseTo(s.efetiva, 6);
  });
  it('encargos do grupo A e CPRB por regime (reoneração 2026)', () => {
    expect(encargosGrupoA({ ...PARAMETROS_PADRAO, regime: 'simples' }).total).toBe(8);
    expect(encargosGrupoA({ ...PARAMETROS_PADRAO, regime: 'presumido' }).total).toBeCloseTo(36.8, 6);
    const des = { ...PARAMETROS_PADRAO, regime: 'presumido' as const, desonerada: true, anoBase: 2026 };
    expect(encargosGrupoA(des).total).toBeCloseTo(26.8, 6); // INSS 10% sobre a folha em 2026
    expect(tributosFaturamento(des).itens.find((i) => i.nome.startsWith('CPRB'))!.aliquota).toBeCloseTo(2.7, 6); // 60% de 4,5%
    expect(tributosFaturamento({ ...PARAMETROS_PADRAO, regime: 'presumido', issAliquota: 5 }).total).toBeCloseTo(8.65, 6);
  });
  it('BDI pela fórmula do Acórdão TCU 2622/2013', () => {
    const { bdi, df } = calcBdi({ ac: 4, s: 0.4, r: 1, g: 0.4, l: 7, prazoDias: 30, taxaMes: 1 }, 8.65);
    expect(df).toBeCloseTo(1, 6);
    expect(bdi).toBeCloseTo(((1.058 * 1.01 * 1.07) / (1 - 0.0865) - 1) * 100, 6);
    expect(farol(4, FAIXAS_BDI.ac)).toBe('dentro');
    expect(farol(10, FAIXAS_BDI.l)).toBe('acima');
  });
  it('horas do plano e custo-hora do cargo', () => {
    expect(horasPlanoMes(PLANO_SPLIT)).toBeCloseTo(2.41, 1); // ≈ 28,9 h/ano pelo plano Split/Janela
    const h = horasMes(PARAMETROS_PADRAO); // 222 dias × 8,8 h ÷ 12
    expect(h.disponiveis).toBeCloseTo(162.8, 1);
    const c = custoCargo({ salarioBase: 2000 }, { ...PARAMETROS_PADRAO, regime: 'simples' });
    expect(c.remuneracao).toBe(2000);
    expect(c.modulo21).toBeCloseTo(2000 * 0.2043, 6);
    expect(c.custoHora).toBeCloseTo(c.total / h.produtivas, 6);
    expect(custoCargo({ salarioBase: 2000, periculosidade: true, insalubridade: 20 }, PARAMETROS_PADRAO).remuneracao).toBeCloseTo(2000 + 600 + 324.2, 6);
  });
  it('estudo de preço: rateio, preço unitário, total e exequibilidade', () => {
    const cargos = new Map([['t', { id: 't', nome: 'Técnico', salarioBase: 3000, ativo: true, createdAt: '', updatedAt: '' } as CargoPreco]]);
    const planos = new Map([[PLANO_SPLIT.id, PLANO_SPLIT]]);
    const r = calcularEstudo(
      {
        equipe: [{ cargoId: 't', quantidade: 1 }],
        itens: [{ id: '1', descricao: 'Split', planoId: PLANO_SPLIT.id, fatorTempo: 1, corretivaPct: 10, materiaisMes: 5, quantidade: 10 }],
        deslocamento: { visitasMes: 0, minutosVisita: 0, kmMes: 0, custoKm: 0 },
        custosFixos: [{ id: 'f', descricao: 'Veículo', valorMensal: 500 }],
        rateio: 'horas',
        bdi: PARAMETROS_PADRAO.bdi,
        vigenciaMeses: 12,
        valorEstimadoMensal: 10000,
        tipoServico: 'engenharia',
      },
      { params: PARAMETROS_PADRAO, cargos, planos },
    );
    const it = r.itens[0];
    expect(it.rateio).toBeCloseTo(50, 6);
    expect(it.horasCorretivas).toBeCloseTo(it.horasPreventivas * 0.1, 6);
    expect(it.precoUnit).toBeCloseTo(round2(it.custoDireto * (1 + r.bdi / 100)), 6);
    expect(r.precoMensal).toBeCloseTo(it.precoUnit * 10, 6);
    expect(r.lanceMinimoMensal).toBeLessThan(r.precoMensal);
    expect(analisarExequibilidade(7000, 10000, 'engenharia', 12).alertas.some((a) => a.texto.includes('75%'))).toBe(true);
    expect(analisarExequibilidade(8000, 10000, 'engenharia', 12).garantiaAdicional).toBe(24000);
    expect(analisarExequibilidade(4500, 10000, 'comum', 12).alertas.some((a) => a.texto.includes('50%'))).toBe(true);
  });
  it('MEI: DAS fixo, encargos do empregado e alertas de limite', () => {
    const mei = { ...PARAMETROS_PADRAO, regime: 'mei' as const, faturamentoMensal: 6000 };
    expect(dasMei(mei)).toBeCloseTo(86.05, 6); // 5% de R$ 1.621 + R$ 5 de ISS
    expect(tributosFaturamento(mei).total).toBe(0);
    expect(encargosGrupoA(mei).total).toBe(11); // 3% de CPP + 8% de FGTS
    expect(encargoVinculo('socio', mei).aliquota).toBe(0);
    expect(despesasFixas(mei).total).toBeCloseTo(86.05, 6);
    const f = formacaoPreco({ metodo: 'markup', bdi: PARAMETROS_PADRAO.bdi }, mei, 0);
    const alertas = alertasDoRegime(mei, 100000, [{ quantidade: 2, vinculo: 'clt' }], f);
    expect(alertas.some((a) => a.nivel === 'critico' && a.texto.includes('limite do MEI'))).toBe(true);
    expect(alertas.some((a) => a.texto.includes('apenas um empregado'))).toBe(true);
    expect(alertasDoRegime(mei, 30000, [{ quantidade: 1, vinculo: 'clt' }], f)).toHaveLength(0);
  });
  it('vínculos: pró-labore e autônomo sem provisões trabalhistas', () => {
    const pres = { ...PARAMETROS_PADRAO, regime: 'presumido' as const };
    const socio = custoCargo({ vinculo: 'socio', salarioBase: 5000 }, pres);
    expect(socio.modulo21).toBe(0);
    expect(socio.modulo3).toBe(0);
    expect(socio.modulo22).toBeCloseTo(1000, 6); // 20% de INSS patronal sobre o pró-labore
    expect(custoCargo({ vinculo: 'socio', salarioBase: 5000 }, PARAMETROS_PADRAO).modulo22).toBe(0); // Simples: CPP no DAS
    const aut = custoCargo({ vinculo: 'autonomo', salarioBase: 2000, valeAlimentacaoDia: 25, diasMes: 20 }, pres);
    expect(aut.modulo22).toBeCloseTo(400, 6);
    expect(aut.modulo23).toBeCloseTo(500, 6);
    expect(custoCargo({ vinculo: 'autonomo', salarioBase: 2000 }, { ...pres, inssAutonomo: 0 }).modulo22).toBe(0);
  });
  it('composição: ferramentas, veículo e itens de pessoal por cargo', () => {
    expect(ferramentaMensal({ id: 'x', descricao: '', quantidade: 2, valorUnit: 1200, vidaUtilMeses: 48, residualPct: 10, manutencaoAnual: 120 })).toBeCloseTo((2 * 1200 * 0.9) / 48 + 10, 6);
    const v = custoVeiculo({ ...VEICULO_PADRAO, valorAquisicao: 100000, vidaUtilAnos: 5, residualPct: 40, ipvaAnual: 3000, seguroAnual: 3000, precoCombustivel: 6, consumoKmL: 10, manutencaoKm: 0.2, pneusKm: 0.1 });
    expect(v.depreciacao).toBeCloseTo(1000, 6); // R$ 60.000 em 60 meses
    expect(v.fixoMensal).toBeCloseTo(1500, 6);
    expect(v.variavelKm).toBeCloseTo(0.9, 6);
    const comp = {
      ...COMPOSICAO_PADRAO,
      pessoal: [
        { id: 'a', categoria: 'epi' as const, descricao: 'Botina', qtdAno: 2, valorUnit: 120 },
        { id: 'b', categoria: 'treinamento' as const, descricao: 'NR-10', qtdAno: 0.5, valorUnit: 480, cargos: ['ele'] },
      ],
    };
    expect(custoPessoalCargo('tec', comp).total).toBeCloseTo(20, 6);
    expect(custoPessoalCargo('ele', comp).total).toBeCloseTo(40, 6);
    expect(custoCargo({ id: 'ele', salarioBase: 0 }, { ...PARAMETROS_PADRAO, composicao: comp }).insumos).toBeCloseTo(40, 6);
    expect(custoCargo({ id: 'ele', salarioBase: 0, uniformeEpiMes: 70 }, { ...PARAMETROS_PADRAO, composicao: comp }).insumos).toBe(70); // cargo antigo, manual
  });
  it('markup divisor, quartis do TCU e BDI diferenciado de materiais', () => {
    const m = calcMarkup({ comissaoPct: 2, cartaoPct: 1, inadimplenciaPct: 1, lucroPct: 10 }, 6, 10);
    expect(m.soma).toBe(30);
    expect(m.multiplicador).toBeCloseTo(1 / 0.7, 6);
    expect(m.bdi).toBeCloseTo((1 / 0.7 - 1) * 100, 6);
    expect(calcMarkup({ comissaoPct: 0, cartaoPct: 0, inadimplenciaPct: 0, lucroPct: 50 }, 30, 20).valido).toBe(false);
    expect(componentesDoQuartil(REFERENCIAS_BDI.edificacoes, 1)).toEqual({ ac: 4, s: 0.4, g: 0.4, r: 1.27, l: 7.4 });
    const f = formacaoPreco({ metodo: 'tcu', bdi: PARAMETROS_PADRAO.bdi, bdiMateriais: { ...PARAMETROS_PADRAO.bdiMateriais, ativo: true } }, PARAMETROS_PADRAO, 8.65);
    expect(f.materiais.ativo).toBe(true);
    expect(f.materiais.bdi).toBeLessThan(f.bdi);
    // quartil médio de materiais com PIS + Cofins (3,65%) e DF de 0,85%: 15,28%, como nas planilhas que aplicam o acórdão
    expect(calcBdi({ ...componentesDoQuartil(REFERENCIAS_BDI.materiais, 1), prazoDias: 30, taxaMes: 0.85 }, 3.65).bdi).toBeCloseTo(15.28, 2);
  });
  it('estudo: ferramentas e veículo pelas horas e materiais com BDI próprio', () => {
    const p = {
      ...PARAMETROS_PADRAO,
      composicao: { ...COMPOSICAO_PADRAO, ferramentas: [{ id: 'k', descricao: 'Kit', quantidade: 1, valorUnit: 12000, vidaUtilMeses: 60, residualPct: 0, manutencaoAnual: 0 }] },
      bdiMateriais: { ...PARAMETROS_PADRAO.bdiMateriais, ativo: true },
    };
    const cargos = new Map([['t', { id: 't', nome: 'Técnico', salarioBase: 3000, ativo: true, createdAt: '', updatedAt: '' } as CargoPreco]]);
    const base = {
      equipe: [{ cargoId: 't', quantidade: 1 }],
      itens: [{ id: '1', descricao: 'Split', horasManual: 2, fatorTempo: 1, corretivaPct: 0, materiaisMes: 10, quantidade: 1 }],
      deslocamento: { visitasMes: 0, minutosVisita: 0, kmMes: 0, custoKm: 0 },
      custosFixos: [],
      rateio: 'horas' as const,
      bdi: PARAMETROS_PADRAO.bdi,
      vigenciaMeses: 12,
      tipoServico: 'engenharia' as const,
      bdiMateriais: p.bdiMateriais,
    };
    const r = calcularEstudo({ ...base, kits: 1 }, { params: p, cargos, planos: new Map() });
    const it = r.itens[0];
    expect(r.ferramentasHora).toBeCloseTo(200 / custosHora(p).horas, 6);
    expect(it.custoEquip).toBeCloseTo(2 * r.ferramentasHora, 6);
    expect(it.precoUnit).toBeCloseTo(round2((it.custoMO + it.custoEquip) * (1 + r.bdi / 100) + 10 * (1 + r.formacao.materiais.bdi / 100)), 6);
    expect(r.precoHoraTecnica).toBeCloseTo(round2(r.custoHoraOperacional * (1 + r.bdi / 100)), 6);
    expect(calcularEstudo(base, { params: p, cargos, planos: new Map() }).equipamentosMensal).toBe(0); // estudo antigo, sem kits
  });
});
