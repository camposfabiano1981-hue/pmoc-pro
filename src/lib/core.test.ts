import { projetar, proximaData, rotinasDoPlano, statusRotina } from './rotinas';
import { marcarRotina } from './marcas';
import { inteiroPorExtenso, valorPorExtenso } from './extenso';
import { clausulasContrato, mesesVigencia, ordinal } from './contrato';
import type { Equipamento, Rotina } from '../db/types';
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
