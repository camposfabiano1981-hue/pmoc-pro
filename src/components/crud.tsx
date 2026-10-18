import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Download, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { db, deleteRecord, nextNumber, saveRecord, type TableName } from '../db/db';
import type { Base } from '../db/types';
import { useLookups, type Lookups } from '../lib/lookups';
import { maskCpfCnpj, norm, todayStr, validaDoc } from '../lib/format';
import { exportCsv, exportXlsx } from '../lib/excel';
import { useSessao, type Perfil } from '../lib/sessao';
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, cx, useConfirm, useToast } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyRec = Record<string, any>;

export interface FieldCtx {
  value: any;
  onChange: (v: any) => void;
  form: AnyRec;
  setForm: (patch: AnyRec) => void;
  lookups: Lookups;
}

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'datetime' | 'select' | 'ref' | 'checkbox' | 'email' | 'tel' | 'color' | 'doc' | 'custom';
  required?: boolean;
  options?: (string | { value: string; label: string })[];
  ref?: {
    list: (l: Lookups) => AnyRec[];
    label?: (r: AnyRec, l: Lookups) => string;
    filter?: (r: AnyRec, form: AnyRec) => boolean;
  };
  span?: 1 | 2 | 3 | 4;
  section?: string;
  placeholder?: string;
  help?: ReactNode | ((form: AnyRec, l: Lookups) => ReactNode);
  step?: string;
  suggestions?: string[] | ((l: Lookups) => string[]);
  hidden?: (form: AnyRec) => boolean;
  render?: (ctx: FieldCtx) => ReactNode;
  onChangeEffect?: (value: any, form: AnyRec, l: Lookups) => AnyRec | undefined;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (row: AnyRec, l: Lookups) => ReactNode;
  value?: (row: AnyRec, l: Lookups) => string | number | undefined;
  className?: string;
  noExport?: boolean;
}

export interface FilterDef {
  key: string;
  label: string;
  options: (l: Lookups, rows: AnyRec[]) => { value: string; label: string }[];
  test: (row: AnyRec, value: string, l: Lookups) => boolean;
}

export interface EntityConfig {
  table: TableName;
  title: string;
  singular: string;
  icon: ReactNode;
  subtitle?: ReactNode;
  fields: FieldDef[];
  columns: ColumnDef[];
  searchText: (row: AnyRec, l: Lookups) => string;
  defaults: (l: Lookups) => AnyRec;
  numbering?: { field: string; kind: string };
  validate?: (form: AnyRec, l: Lookups) => string | null | Promise<string | null>;
  filters?: FilterDef[];
  rowActions?: (row: AnyRec, l: Lookups) => ReactNode;
  headerActions?: ReactNode;
  topContent?: (rows: AnyRec[], l: Lookups) => ReactNode;
  detailPath?: (row: AnyRec) => string;
  sort?: { key: string; dir: 'asc' | 'desc' };
  beforeDelete?: (row: AnyRec) => Promise<string | null>;
  beforeSave?: (form: AnyRec, l: Lookups) => AnyRec | Promise<AnyRec>;
  /** Executado após salvar (ex.: aplicar plano nas rotinas do equipamento) */
  afterSave?: (rec: AnyRec, anterior: AnyRec | null) => Promise<string | void>;
  /** Perfis que apenas consultam (sem incluir/editar/excluir) */
  somenteLeituraPara?: Perfil[];
  formSize?: 'md' | 'lg' | 'xl';
}

function optionList(o: FieldDef['options']): { value: string; label: string }[] {
  return (o || []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x));
}

export function FieldInput({ f, form, setForm, lookups }: { f: FieldDef; form: AnyRec; setForm: (p: AnyRec) => void; lookups: Lookups }) {
  const value = form[f.name];
  const onChange = (v: any) => {
    const extra = f.onChangeEffect?.(v, { ...form, [f.name]: v }, lookups) || {};
    setForm({ [f.name]: v, ...extra });
  };
  const listId = `dl-${f.name}`;
  const sugg = typeof f.suggestions === 'function' ? f.suggestions(lookups) : f.suggestions;
  switch (f.type) {
    case 'custom':
      return <>{f.render?.({ value, onChange, form, setForm, lookups })}</>;
    case 'textarea':
      return <Textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={4} />;
    case 'number':
    case 'money':
      return (
        <Input
          type="number"
          inputMode="decimal"
          step={f.step || (f.type === 'money' ? '0.01' : 'any')}
          value={value ?? ''}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'date':
      return <Input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'datetime':
      return <Input type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'checkbox':
      return (
        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {f.placeholder || 'Sim'}
        </label>
      );
    case 'color':
      return <Input type="color" className="h-10 p-1" value={value || '#0e7490'} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— selecione —</option>
          {optionList(f.options).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case 'ref': {
      const all = f.ref!.list(lookups).filter((r) => !f.ref!.filter || f.ref!.filter(r, form) || r.id === value);
      return (
        <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— selecione —</option>
          {all.map((r) => (
            <option key={r.id} value={r.id}>
              {f.ref!.label ? f.ref!.label(r, lookups) : r.nome || r.descricao || r.id}
            </option>
          ))}
        </Select>
      );
    }
    case 'doc': {
      const ok = validaDoc(value);
      return (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(maskCpfCnpj(e.target.value))}
          placeholder="CPF ou CNPJ"
          className={ok === false ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30' : ''}
        />
      );
    }
    default:
      return (
        <>
          <Input type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'} value={value ?? ''} placeholder={f.placeholder} list={sugg ? listId : undefined} onChange={(e) => onChange(e.target.value)} />
          {sugg && (
            <datalist id={listId}>
              {sugg.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      );
  }
}

const SPAN = { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' };

export function EntityFormFields({ fields, form, setForm, lookups }: { fields: FieldDef[]; form: AnyRec; setForm: (p: AnyRec) => void; lookups: Lookups }) {
  const sections: { name: string; fields: FieldDef[] }[] = [];
  for (const f of fields) {
    if (f.hidden?.(form)) continue;
    const name = f.section || '';
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, fields: [] }));
    s.fields.push(f);
  }
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <div key={s.name}>
          {s.name && <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">{s.name}</h4>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {s.fields.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                required={f.required}
                className={cx('col-span-1', SPAN[f.span || 2])}
                help={typeof f.help === 'function' ? f.help(form, lookups) : f.help}
              >
                <FieldInput f={f} form={form} setForm={setForm} lookups={lookups} />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EntityFormModal({ cfg, initial, open, onClose, onSaved }: { cfg: EntityConfig; initial: AnyRec | null; open: boolean; onClose: () => void; onSaved?: (r: AnyRec) => void }) {
  const lookups = useLookups();
  const toast = useToast();
  const [form, setFormState] = useState<AnyRec>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setFormState(initial ? structuredClone(initial) : cfg.defaults(lookups));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);
  const setForm = (patch: AnyRec) => setFormState((f) => ({ ...f, ...patch }));

  const save = async () => {
    for (const f of cfg.fields) {
      if (f.required && !f.hidden?.(form) && (form[f.name] === undefined || form[f.name] === '' || form[f.name] === null)) {
        toast(`Preencha o campo "${f.label}".`, 'warning');
        return;
      }
    }
    const err = await cfg.validate?.(form, lookups);
    if (err) {
      toast(err, 'warning');
      return;
    }
    setSaving(true);
    try {
      let data = { ...form };
      if (cfg.numbering && !data[cfg.numbering.field]) data[cfg.numbering.field] = await nextNumber(cfg.numbering.kind);
      if (cfg.beforeSave) data = await cfg.beforeSave(data, lookups);
      const rec = await saveRecord(cfg.table, data as Partial<Base>);
      const extra = await cfg.afterSave?.(rec as AnyRec, initial?.id ? initial : null);
      toast(`${cfg.singular} salvo(a) com sucesso.${extra ? ' ' + extra : ''}`);
      onSaved?.(rec as AnyRec);
      onClose();
    } catch (e) {
      toast('Erro ao salvar: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(initial?.id ? 'Editar ' : 'Novo(a) ') + cfg.singular.toLowerCase()}
      size={cfg.formSize || 'lg'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <EntityFormFields fields={cfg.fields} form={form} setForm={setForm} lookups={lookups} />
    </Modal>
  );
}

function cellText(row: AnyRec, c: ColumnDef, l: Lookups): string | number {
  if (c.value) return c.value(row, l) ?? '';
  const v = row[c.key];
  return v === undefined || v === null ? '' : typeof v === 'object' ? '' : v;
}

export function EntityPage({ cfg }: { cfg: EntityConfig }) {
  const lookups = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rows = useLiveQuery(() => db.table(cfg.table).toArray(), [cfg.table]) as AnyRec[] | undefined;
  const [q, setQ] = useState(params.get('q') || '');
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    cfg.filters?.forEach((f) => {
      const v = params.get(f.key);
      if (v) init[f.key] = v;
    });
    return init;
  });
  const [sort, setSort] = useState(cfg.sort || { key: cfg.columns[0].key, dir: 'asc' as const });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [editing, setEditing] = useState<AnyRec | null>(null);
  const [open, setOpen] = useState(false);
  const { usuario, pode } = useSessao();
  const leitura = !!cfg.somenteLeituraPara?.includes(usuario.perfil);
  const podeExcluir = pode('excluir');

  useEffect(() => {
    if (params.get('novo') === '1') {
      setEditing(null);
      setOpen(true);
      params.delete('novo');
      setParams(params, { replace: true });
    }
    const editId = params.get('editar');
    if (editId && rows) {
      const r = rows.find((x) => x.id === editId);
      if (r) {
        setEditing(r);
        setOpen(true);
      }
      params.delete('editar');
      setParams(params, { replace: true });
    }
  }, [params, rows, setParams]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const nq = norm(q);
    let out = rows.filter((r) => !nq || norm(cfg.searchText(r, lookups)).includes(nq));
    for (const f of cfg.filters || []) {
      const v = filters[f.key];
      if (v) out = out.filter((r) => f.test(r, v, lookups));
    }
    const col = cfg.columns.find((c) => c.key === sort.key);
    if (col) {
      out = [...out].sort((a, b) => {
        const va = cellText(a, col, lookups);
        const vb = cellText(b, col, lookups);
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, q, filters, sort, cfg, lookups]);

  useEffect(() => setPage(0), [q, filters, pageSize]);

  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const exportCols = cfg.columns.filter((c) => !c.noExport);

  const doExport = async (kind: 'csv' | 'xlsx') => {
    const headers = exportCols.map((c) => c.label);
    const data = filtered.map((r) => exportCols.map((c) => cellText(r, c, lookups)));
    const name = `${cfg.table}-${todayStr()}`;
    if (kind === 'csv') exportCsv(headers, data, name + '.csv');
    else await exportXlsx([{ name: cfg.title, headers, rows: data }], name + '.xlsx');
  };

  const remove = async (r: AnyRec) => {
    const block = await cfg.beforeDelete?.(r);
    if (block) {
      toast(block, 'warning');
      return;
    }
    if (!(await confirm({ title: `Excluir ${cfg.singular.toLowerCase()}`, message: 'Esta ação não pode ser desfeita. Deseja continuar?', danger: true, confirmText: 'Excluir' }))) return;
    await deleteRecord(cfg.table, r.id);
    toast(`${cfg.singular} excluído(a).`);
  };

  const duplicate = (r: AnyRec) => {
    const copy = structuredClone(r);
    delete copy.id;
    delete copy.createdAt;
    if (cfg.numbering) delete copy[cfg.numbering.field];
    setEditing(copy);
    setOpen(true);
  };

  const openRow = (r: AnyRec) => {
    if (cfg.detailPath) navigate(cfg.detailPath(r));
    else if (leitura) return;
    else {
      setEditing(r);
      setOpen(true);
    }
  };

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle ?? `${rows?.length ?? 0} registro(s)`}
        icon={cfg.icon}
        actions={
          <>
            {cfg.headerActions}
            <Button variant="outline" icon={<Download size={16} />} onClick={() => doExport('csv')}>
              CSV
            </Button>
            <Button variant="outline" icon={<FileSpreadsheet size={16} />} onClick={() => doExport('xlsx')}>
              Excel
            </Button>
            {!leitura && (
              <Button
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                Novo
              </Button>
            )}
          </>
        }
      />
      {cfg.topContent && rows && cfg.topContent(rows, lookups)}
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar…" className="pl-9" />
          </div>
          {cfg.filters?.map((f) => (
            <Select
              key={f.key}
              className="w-auto min-w-[150px] max-w-[240px]"
              value={filters[f.key] || ''}
              onChange={(e) => setFilters((x) => ({ ...x, [f.key]: e.target.value }))}
            >
              <option value="">{f.label}: todos</option>
              {f.options(lookups, rows || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
        {!rows ? (
          <p className="p-6 text-sm text-slate-500">Carregando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={cfg.icon} title="Nenhum registro encontrado">
            Clique em <b>Novo</b> para cadastrar.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  {cfg.columns.map((c) => (
                    <th
                      key={c.key}
                      className={cx('cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-semibold', c.className)}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => openRow(r)}>
                    {cfg.columns.map((c) => (
                      <td key={c.key} className={cx('px-3 py-2.5 align-top text-slate-700 dark:text-slate-200', c.className)}>
                        {c.render ? c.render(r, lookups) : String(cellText(r, c, lookups) || '—')}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center">
                        {cfg.rowActions?.(r, lookups)}
                        {!leitura && (
                          <>
                            <IconButton
                              title="Editar"
                              onClick={() => {
                                setEditing(r);
                                setOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton title="Duplicar" onClick={() => duplicate(r)}>
                              <Copy size={15} />
                            </IconButton>
                          </>
                        )}
                        {!leitura && podeExcluir && (
                          <IconButton title="Excluir" className="hover:text-rose-600" onClick={() => remove(r)}>
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
            <span>
              {filtered.length} de {rows?.length} registro(s)
            </span>
            <div className="flex items-center gap-2">
              <Select className="w-auto py-1 text-xs" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[25, 50, 100, 500].map((n) => (
                  <option key={n} value={n}>
                    {n} / pág.
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span>
                {page + 1}/{pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
      <EntityFormModal cfg={cfg} initial={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
