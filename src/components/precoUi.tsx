import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ParametrosPreco } from '../db/types';
import { Badge, Field, Input, cx } from './ui';
import { comPadroes, type Farol } from '../lib/precificacao';
import { carregarParametros, salvarParametros } from '../lib/precificacaoDb';

const paraTexto = (v: number | undefined) => (v === undefined || v === null || Number.isNaN(v) ? '' : String(v).replace('.', ','));

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
        onFocus={() => (foco.current = true)}
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
  const restaurar = () => setP(comPadroes(null));
  return [p, upd, restaurar, salvo];
}
