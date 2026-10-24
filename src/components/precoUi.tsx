import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import type { ParametrosPreco } from '../db/types';
import { Badge, Button, Field, IconButton, Input, Select, cx } from './ui';
import { comPadroes, type Farol } from '../lib/precificacao';
import { carregarParametros, salvarParametros } from '../lib/precificacaoDb';

const vazio = (v: number | undefined) => v === undefined || v === null || Number.isNaN(v);
/** Exibe no padrão brasileiro, com separador de milhar (95.000; 0,25; 1.234,5). */
const paraTexto = (v: number | undefined) => (vazio(v) ? '' : (v as number).toLocaleString('pt-BR', { maximumFractionDigits: 6 }));
/** Durante a edição, sem separador de milhar para não confundir com o decimal (95000; 0,25). */
const paraEdicao = (v: number | undefined) => (vazio(v) ? '' : String(v).replace('.', ','));

/** Lê número digitado no padrão brasileiro (1.234,56) ou com ponto decimal (0.42). */
export function lerNumero(t: string): number | undefined {
  const s = t.replace(/\s/g, '').replace(/^R\$/, '');
  if (s === '') return undefined;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** Campo numérico com rótulo, sufixo (%, R$, h…) e ajuda. Aceita vírgula ou ponto. */
export function Num({
  label,
  value,
  onChange,
  suffix,
  prefix,
  step = 'any',
  help,
  className,
  disabled,
  placeholder,
  min,
}: {
  label?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  prefix?: string;
  step?: string;
  help?: ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
}) {
  const [txt, setTxt] = useState(paraTexto(value));
  const foco = useRef(false);
  useEffect(() => {
    if (!foco.current) setTxt(paraTexto(value));
  }, [value]);
  const input = (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">{prefix}</span>}
      <Input
        inputMode="decimal"
        type="text"
        step={step}
        min={min}
        disabled={disabled}
        placeholder={placeholder}
        className={cx('tabular-nums', prefix && 'pl-8', suffix && 'pr-9')}
        value={txt}
        onFocus={() => {
          foco.current = true;
          setTxt(paraEdicao(value));
        }}
        onBlur={() => {
          foco.current = false;
          setTxt(paraTexto(value));
        }}
        onChange={(e) => {
          const t = e.target.value;
          setTxt(t);
          const n = lerNumero(t);
          if (n === undefined) onChange(undefined);
          else if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
    </div>
  );
  if (!label) return <div className={className}>{input}</div>;
  return (
    <Field label={label} help={help} className={className}>
      {input}
    </Field>
  );
}

export function FarolBadge({ f, faixa }: { f: Farol; faixa?: readonly [number, number] }) {
  const cls = f === 'dentro' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : f === 'abaixo' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200';
  const txt = f === 'dentro' ? 'na faixa' : f === 'abaixo' ? 'abaixo da faixa' : 'acima da faixa';
  return (
    <Badge className={cls}>
      {txt}
      {faixa && ` (${faixa[0].toLocaleString('pt-BR')}–${faixa[1].toLocaleString('pt-BR')}%)`}
    </Badge>
  );
}

export const pct = (n: number | undefined, casas = 2) => `${(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const num = (n: number | undefined, casas = 2) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Parâmetros de precificação editáveis com gravação automática. */
export function useParametrosEditaveis(): [ParametrosPreco | null, (patch: Partial<ParametrosPreco>) => void, () => void, boolean] {
  const [p, setP] = useState<ParametrosPreco | null>(null);
  const [salvo, setSalvo] = useState(true);
  const carregado = useRef(false);
  useEffect(() => {
    carregarParametros().then((x) => {
      setP(x);
      setTimeout(() => (carregado.current = true), 0);
    });
  }, []);
  useEffect(() => {
    if (!p || !carregado.current) return;
    setSalvo(false);
    const t = setTimeout(async () => {
      await salvarParametros(p);
      setSalvo(true);
    }, 500);
    return () => clearTimeout(t);
  }, [p]);
  const upd = (patch: Partial<ParametrosPreco>) => setP((x) => (x ? { ...x, ...patch } : x));
  // restaura tributos, encargos, horas e formação do preço; mantém as tabelas da composição de custos
  const restaurar = () => setP((x) => ({ ...comPadroes(null), ...(x ? { composicao: x.composicao, custosPadrao: x.custosPadrao, faturamentoMensal: x.faturamentoMensal } : {}) }));
  return [p, upd, restaurar, salvo];
}

/* ---------------- Tabela editável (composição de custos) ---------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ColunaTabela<T> {
  key: string;
  label: ReactNode;
  /** Campo editável da linha */
  campo?: string;
  tipo?: 'texto' | 'numero' | 'moeda' | 'select';
  opcoes?: { value: string; label: string }[];
  sufixo?: string;
  placeholder?: string;
  /** Largura e alinhamento da coluna */
  className?: string;
  direita?: boolean;
  /** Valor calculado (somente leitura) */
  calc?: (linha: T, i: number) => ReactNode;
  /** Célula personalizada */
  render?: (linha: T, set: (patch: Partial<T>) => void, i: number) => ReactNode;
}

/** Tabela com linhas editáveis, colunas calculadas, inclusão da lista sugerida e resumo. */
export function TabelaEditavel<T extends object>({
  linhas,
  colunas,
  onChange,
  novaLinha,
  sugeridos,
  chave,
  resumo,
  vazio,
  minWidth = 'min-w-[720px]',
}: {
  linhas: T[];
  colunas: ColunaTabela<T>[];
  onChange: (linhas: T[]) => void;
  novaLinha: () => T;
  /** Lista sugerida: oferece incluir as linhas que ainda não estão na tabela */
  sugeridos?: T[];
  chave?: (l: T) => string;
  resumo?: ReactNode;
  vazio?: string;
  minWidth?: string;
}) {
  const set = (i: number, patch: Partial<T>) => onChange(linhas.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const faltando = sugeridos && chave ? sugeridos.filter((x) => !linhas.some((l) => chave(l) === chave(x))) : [];
  const celula = (c: ColunaTabela<T>, l: T, i: number) => {
    if (c.render) return c.render(l, (patch) => set(i, patch), i);
    if (c.calc) return c.calc(l, i);
    if (!c.campo) return null;
    const v = (l as Record<string, any>)[c.campo];
    const muda = (x: unknown) => set(i, { [c.campo as string]: x } as Partial<T>);
    if (c.tipo === 'numero' || c.tipo === 'moeda') return <Num value={v} prefix={c.tipo === 'moeda' ? 'R$' : undefined} suffix={c.sufixo} placeholder={c.placeholder} onChange={(n) => muda(n ?? 0)} />;
    if (c.tipo === 'select')
      return (
        <Select value={v ?? ''} onChange={(e) => muda(e.target.value)}>
          {c.opcoes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      );
    return <Input value={v ?? ''} placeholder={c.placeholder} onChange={(e) => muda(e.target.value)} />;
  };
  return (
    <div>
      <div className="overflow-x-auto">
        <table className={cx('w-full table-fixed text-sm', minWidth)}>
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              {colunas.map((c) => <th key={c.key} className={cx('px-2 py-2 font-semibold', c.direita && 'text-right', c.className)}>{c.label}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={(chave?.(l) || 'l') + i} className="border-t border-slate-100 dark:border-slate-800">
                {colunas.map((c) => <td key={c.key} className={cx('px-2 py-1', c.direita && 'text-right tabular-nums', c.className)}>{celula(c, l, i)}</td>)}
                <td className="px-1 py-1 text-right">
                  <IconButton title="Remover linha" className="hover:text-rose-600" onClick={() => onChange(linhas.filter((_, k) => k !== i))}><Trash2 size={15} /></IconButton>
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr><td colSpan={colunas.length + 1} className="p-4 text-center text-sm text-slate-500">{vazio || 'Nenhuma linha.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => onChange([...linhas, novaLinha()])}>Adicionar linha</Button>
          {faltando.length > 0 && (
            <Button size="sm" variant="ghost" icon={<ListPlus size={14} />} onClick={() => onChange([...linhas, ...faltando.map((x) => structuredClone(x))])}>
              Incluir {faltando.length} {faltando.length === 1 ? 'item' : 'itens'} da lista sugerida
            </Button>
          )}
        </div>
        {resumo && <div className="ml-auto text-right text-sm">{resumo}</div>}
      </div>
    </div>
  );
}

/** Linha de resumo "rótulo ............ valor". */
export function LinhaResumo({ rotulo, valor, forte, dica }: { rotulo: ReactNode; valor: ReactNode; forte?: boolean; dica?: ReactNode }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 border-b border-slate-100 py-1 text-sm last:border-0 dark:border-slate-800', forte && 'font-semibold')}>
      <span>
        {rotulo}
        {dica && <span className="block text-xs font-normal text-slate-500">{dica}</span>}
      </span>
      <span className="whitespace-nowrap tabular-nums">{valor}</span>
    </div>
  );
}
