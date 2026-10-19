import { useMemo } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { Equipamento, ItemChecklist, Medicoes, Profissional, ResultadoItem, StatusExecucao } from '../db/types';
import { STATUS_EXECUCAO, periodicidadeSigla } from '../lib/catalogs';
import { fmtDate, fmtDateTime, localDateTimeStr, n2 } from '../lib/format';
import { diagnosticar } from '../lib/hvac';
import { MEDICOES_CAMPOS } from '../lib/osHelpers';
import { foraDaFaixa } from '../lib/schedule';
import { statusItem } from '../lib/rotinas';
import { Field, IconButton, Input, Select, cx } from './ui';

const CONDICOES: { v: ResultadoItem; label: string; cls: string }[] = [
  { v: 'ok', label: 'Conforme', cls: 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  { v: 'nok', label: 'Não conforme', cls: 'border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
  { v: 'corrigido', label: 'Corrigido', cls: 'border-sky-600 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  { v: 'na', label: 'N/A', cls: 'border-slate-500 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
];

export interface TaskRowProps {
  c: ItemChecklist;
  onChange: (p: Partial<ItemChecklist>) => void;
  onRemove?: () => void;
  readOnly?: boolean;
  /** Profissional logado: as execuções são lançadas em nome dele */
  executorLogado?: string;
  /** Executante sugerido quando quem lança não é um profissional (ex.: gestor transcrevendo papel) */
  executorPadrao?: string;
  profissionais: Profissional[];
  grande?: boolean;
}

/** Tarefa da OS com status de execução E/P/N, condição, medição, tempo real, material e autoria. */
export function TaskRow({ c, onChange, onRemove, readOnly, executorLogado, executorPadrao, profissionais, grande }: TaskRowProps) {
  const st = statusItem(c);
  const editable = !readOnly && !c.rotinaId && !c.atividadeId;
  const fora = c.tipo === 'medicao' && foraDaFaixa(c.valor, c.min, c.max);
  const executor = profissionais.find((p) => p.id === c.executorId);

  const marcar = (v: StatusExecucao) => {
    if (readOnly) return;
    if (st === v) {
      onChange({ execucao: '', dataExecucao: undefined });
      return;
    }
    onChange({
      execucao: v,
      executorId: executorLogado || c.executorId || executorPadrao,
      dataExecucao: localDateTimeStr(),
      resultado: v === 'E' && !c.resultado ? 'ok' : c.resultado,
    });
  };

  const tint = st === 'N' ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20' : st === 'P' ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20' : st === 'E' ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700';

  return (
    <div className={cx('rounded-lg border p-2.5', tint)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editable ? (
            <div className="flex flex-wrap items-center gap-1">
              <Input className="min-w-[180px] flex-1 py-1" value={c.descricao} placeholder="Descreva a tarefa" onChange={(e) => onChange({ descricao: e.target.value })} />
              <Select className="w-32 py-1" value={c.tipo} onChange={(e) => onChange({ tipo: e.target.value as ItemChecklist['tipo'] })}>
                <option value="check">Verificação</option>
                <option value="medicao">Medição</option>
              </Select>
              {c.tipo === 'medicao' && <Input className="w-20 py-1" placeholder="Unid." value={c.unidade || ''} onChange={(e) => onChange({ unidade: e.target.value })} />}
              {onRemove && (
                <IconButton title="Remover tarefa" onClick={onRemove}>
                  <Trash2 size={14} />
                </IconButton>
              )}
            </div>
          ) : (
            <p className={cx('text-slate-800 dark:text-slate-100', grande ? 'text-[15px]' : 'text-sm')}>
              {c.periodicidade && <span className="mr-1.5 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{periodicidadeSigla(c.periodicidade)}</span>}
              {c.descricao}
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            {[c.grupo, c.tempoPrevistoMin ? `prev. ${c.tempoPrevistoMin} min` : '', c.dataPrevista ? `prevista ${fmtDate(c.dataPrevista)}` : '', c.servico].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Status de execução">
          {STATUS_EXECUCAO.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.label}
              aria-pressed={st === s.value}
              disabled={readOnly}
              onClick={() => marcar(s.value)}
              className={cx(
                'rounded-md border font-bold disabled:cursor-not-allowed',
                grande ? 'h-10 w-11 text-base' : 'h-8 w-9 text-sm',
                st === s.value ? s.cls : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {s.value}
            </button>
          ))}
          {!editable && onRemove && !readOnly && (
            <button
              type="button"
              title="Excluir rotina desta OS"
              aria-label={`Excluir ${c.descricao}`}
              onClick={onRemove}
              className={cx('inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-600 dark:hover:bg-rose-950', grande ? 'h-10 w-10' : 'h-8 w-8')}
            >
              <Trash2 size={grande ? 16 : 14} />
            </button>
          )}
        </div>
      </div>

      {(st || c.tipo === 'medicao') && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {st === 'E' && (
            <div className="flex flex-wrap gap-1">
              {CONDICOES.map((k) => (
                <button
                  key={k.v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ resultado: k.v })}
                  className={cx('rounded-full border px-2 py-0.5 text-[11px] font-medium', c.resultado === k.v ? k.cls : 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400')}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}
          {c.tipo === 'medicao' && (
            <div className="flex items-center gap-1">
              <Input className={cx('w-24 py-1', fora && 'border-amber-500 ring-2 ring-amber-300')} inputMode="decimal" placeholder="Valor" value={c.valor || ''} disabled={readOnly} onChange={(e) => onChange({ valor: e.target.value })} />
              <span className="text-xs text-slate-500">
                {c.unidade}
                {(c.min !== undefined || c.max !== undefined) && ` (ref. ${c.min ?? '…'}–${c.max ?? '…'})`}
              </span>
              {fora && <AlertTriangle size={14} className="text-amber-500" aria-label="Fora da faixa" />}
            </div>
          )}
          {st && (
            <>
              <div className="flex items-center gap-1">
                <Input className="w-20 py-1" type="number" min={0} placeholder="min" title="Tempo real (min)" value={c.tempoRealMin ?? ''} disabled={readOnly} onChange={(e) => onChange({ tempoRealMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
                <span className="text-xs text-slate-500">min real</span>
              </div>
              <Input className="w-40 py-1" placeholder="Material usado" value={c.material || ''} disabled={readOnly} onChange={(e) => onChange({ material: e.target.value })} />
            </>
          )}
          <Input
            className={cx('min-w-[160px] flex-1 py-1', st === 'N' && !c.obs && 'border-rose-400')}
            placeholder={st === 'N' ? 'Motivo da não execução (obrigatório)' : st === 'P' ? 'O que falta / pendência' : 'Observação'}
            value={c.obs || ''}
            disabled={readOnly}
            onChange={(e) => onChange({ obs: e.target.value })}
          />
        </div>
      )}

      {st && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {executorLogado || readOnly ? (
            <span>
              Lançado por <b className="text-slate-700 dark:text-slate-200">{executor?.nome || '—'}</b> em {fmtDateTime(c.dataExecucao)}
            </span>
          ) : (
            <>
              <span>Executado por</span>
              <Select className={cx('w-auto py-0.5 text-xs', !c.executorId && 'border-rose-400')} value={c.executorId || ''} onChange={(e) => onChange({ executorId: e.target.value || undefined })}>
                <option value="">— selecione o executante —</option>
                {profissionais.filter((p) => p.ativo).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
              <Input className="w-auto py-0.5 text-xs" type="datetime-local" value={c.dataExecucao || ''} onChange={(e) => onChange({ dataExecucao: e.target.value })} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MedicoesPanel({ medicoes, onChange, eq, readOnly }: { medicoes: Medicoes; onChange: (m: Medicoes) => void; eq?: Equipamento; readOnly?: boolean }) {
  const diag = useMemo(() => diagnosticar(medicoes, eq?.fluido, eq?.correnteNominal, eq?.tensao), [medicoes, eq]);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {MEDICOES_CAMPOS.map((m) => (
          <Field key={m.key} label={`${m.label} (${m.unidade})`}>
            <Input inputMode="decimal" value={medicoes[m.key] || ''} disabled={readOnly} onChange={(e) => onChange({ ...medicoes, [m.key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">ΔT (retorno − insuflamento)</p>
          <p className="font-semibold">{diag.deltaT !== undefined ? `${n2(diag.deltaT)} K` : '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">Superaquecimento</p>
          <p className="font-semibold">
            {diag.superaquecimento !== undefined ? `${n2(diag.superaquecimento)} K` : '—'}
            {diag.tSatSuccao !== undefined && <span className="text-xs font-normal text-slate-500"> (Tsat {n2(diag.tSatSuccao)} °C)</span>}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">Sub-resfriamento</p>
          <p className="font-semibold">
            {diag.subresfriamento !== undefined ? `${n2(diag.subresfriamento)} K` : '—'}
            {diag.tSatDescarga !== undefined && <span className="text-xs font-normal text-slate-500"> (Tsat {n2(diag.tSatDescarga)} °C)</span>}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-[11px] text-slate-500">Carga elétrica</p>
          <p className="font-semibold">{diag.cargaPct !== undefined ? `${diag.cargaPct}% da nominal` : '—'}</p>
        </div>
      </div>
      {diag.alertas.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {diag.alertas.map((a) => (
            <li key={a} className="flex gap-1.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Marca como executadas todas as tarefas ainda sem status. */
export function executarPendentes(lista: ItemChecklist[], executorId?: string): ItemChecklist[] {
  const agora = localDateTimeStr();
  return lista.map((c) => (statusItem(c) ? c : { ...c, execucao: 'E', resultado: c.resultado || 'ok', executorId: executorId || c.executorId, dataExecucao: agora }));
}
