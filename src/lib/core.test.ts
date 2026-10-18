import { projetar, rotinasDoPlano, statusRotina } from './rotinas';
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
    expect(projetar(rot({}), '2026-01-01', '2026-03-31')).toEqual(['2026-01-10', '2026-02-09', '2026-03-11']);
    expect(projetar(rot({ ativa: false }), '2026-01-01', '2026-03-31')).toEqual([]);
  });
  it('classifica a situação da rotina', () => {
    expect(statusRotina(rot({ proximaExecucao: '2026-01-05' }), '2026-01-10')).toBe('vencida');
    expect(statusRotina(rot({ proximaExecucao: '2026-01-12' }), '2026-01-10')).toBe('a_vencer');
    expect(statusRotina(rot({ proximaExecucao: '2026-03-01' }), '2026-01-10')).toBe('em_dia');
  });
});
