import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, Columns3, Download, FileSpreadsheet, List, Plus, Search } from 'lucide-react';
import { db } from '../db/db';
import type { OS, StatusOS } from '../db/types';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, cx } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { OS_FINALIZADAS, PRIORIDADES, STATUS_OS, TIPOS_OS, prioridade, statusOs } from '../lib/catalogs';
import { fmtDate, money, norm, todayStr } from '../lib/format';
import { isAtrasada } from '../lib/osHelpers';
import { totais } from '../components/widgets';
import { exportCsv, exportXlsx } from '../lib/excel';

export default function OsList() {
  const l = useLookups();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const all = useLiveQuery(() => db.os.toArray(), []);
  const [view, setView] = useState<'lista' | 'kanban'>(() => (params.get('view') as 'kanban') || 'lista');
  const [q, setQ] = useState('');
  const f = {
    status: params.get('status') || 'abertas',
    tipo: params.get('tipo') || '',
    unidade: params.get('unidadeId') || '',
    tecnico: params.get('tecnico') || '',
    de: params.get('de') || '',
    ate: params.get('ate') || '',
  };
  const setF = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const rows = useMemo(() => {
    if (!all) return [];
    const nq = norm(q);
    const hoje = todayStr();
    return all
      .filter((o) => {
        if (f.status === 'abertas' && OS_FINALIZADAS.includes(o.status)) return false;
        if (f.status === 'atrasadas' && !isAtrasada(o, hoje)) return false;
        if (f.status && !['abertas', 'atrasadas', 'todas'].includes(f.status) && o.status !== f.status) return false;
        if (f.tipo && o.tipo !== f.tipo) return false;
        if (f.unidade && o.unidadeId !== f.unidade) return false;
        if (f.tecnico && o.responsavelId !== f.tecnico && !o.tecnicosIds.includes(f.tecnico)) return false;
        const d = o.dataAgendada || o.dataAbertura.slice(0, 10);
        if (f.de && d < f.de) return false;
        if (f.ate && d > f.ate) return false;
        if (nq) {
          const txt = [o.numero, o.titulo, o.tipo, o.descricao, l.unidadeMap.get(o.unidadeId || '')?.nome, l.clienteMap.get(o.clienteId || '')?.nome, ...o.equipamentos.map((e) => l.equipamentoMap.get(e.equipamentoId)?.tag)].join(' ');
          if (!norm(txt).includes(nq)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.dataAgendada || b.dataAbertura).localeCompare(a.dataAgendada || a.dataAbertura) || b.numero.localeCompare(a.numero));
  }, [all, q, f.status, f.tipo, f.unidade, f.tecnico, f.de, f.ate, l]);

  const exportar = async (kind: 'csv' | 'xlsx') => {
    const headers = ['Número', 'Tipo', 'Título', 'Status', 'Prioridade', 'Cliente', 'Unidade', 'Agendada', 'Prazo', 'Início', 'Fim', 'Responsável', 'Equipamentos', 'Peças (R$)', 'Serviços (R$)', 'Total (R$)'];
    const data = rows.map((o) => {
      const t = totais(o.pecas, o.servicos, o.deslocamento, o.desconto);
      return [o.numero, o.tipo, o.titulo, statusOs(o.status).label, prioridade(o.prioridade).label, l.clienteMap.get(o.clienteId || '')?.nome, l.unidadeMap.get(o.unidadeId || '')?.nome, o.dataAgendada, o.prazo, o.inicio, o.fim, l.profissionalMap.get(o.responsavelId || '')?.nome, o.equipamentos.map((e) => l.equipamentoMap.get(e.equipamentoId)?.tag).join(', '), t.pecas, t.servicos, t.total];
    });
    if (kind === 'csv') exportCsv(headers, data, `ordens-servico-${todayStr()}.csv`);
    else await exportXlsx([{ name: 'Ordens de serviço', headers, rows: data }], `ordens-servico-${todayStr()}.xlsx`);
  };

  const card = (o: OS) => {
    const st = statusOs(o.status);
    const atrasada = isAtrasada(o);
    return (
      <Link key={o.id} to={`/os/${o.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{o.numero}</span>
          <Badge className={prioridade(o.prioridade).cor}>{prioridade(o.prioridade).label}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{o.titulo}</p>
        <p className="mt-1 text-xs text-slate-500">{o.tipo} · {l.unidadeMap.get(o.unidadeId || '')?.nome || '—'}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={cx(atrasada ? 'font-semibold text-rose-600' : 'text-slate-500')}>{fmtDate(o.dataAgendada)}{atrasada && ' · atrasada'}</span>
          <span className="flex -space-x-1">
            {o.tecnicosIds.slice(0, 3).map((t) => (
              <span key={t} title={l.profissionalMap.get(t)?.nome} className="inline-block h-5 w-5 rounded-full border-2 border-white text-center text-[9px] font-bold leading-4 text-white dark:border-slate-900" style={{ background: l.profissionalMap.get(t)?.cor || '#94a3b8' }}>
                {l.profissionalMap.get(t)?.nome?.[0]}
              </span>
            ))}
          </span>
        </div>
        {view === 'lista' && <Badge className={cx('mt-2', st.cor)}>{st.label}</Badge>}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Ordens de serviço"
        subtitle={`${rows.length} OS no filtro · ${all?.length ?? 0} no total`}
        icon={<ClipboardList size={20} />}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
              <button className={cx('rounded-md px-2.5 py-1.5 text-sm', view === 'lista' && 'bg-slate-100 font-medium dark:bg-slate-800')} onClick={() => setView('lista')} title="Lista"><List size={16} /></button>
              <button className={cx('rounded-md px-2.5 py-1.5 text-sm', view === 'kanban' && 'bg-slate-100 font-medium dark:bg-slate-800')} onClick={() => setView('kanban')} title="Kanban"><Columns3 size={16} /></button>
            </div>
            <Button variant="outline" icon={<Download size={16} />} onClick={() => exportar('csv')}>CSV</Button>
            <Button variant="outline" icon={<FileSpreadsheet size={16} />} onClick={() => exportar('xlsx')}>Excel</Button>
            <Button icon={<Plus size={16} />} onClick={() => navigate('/os/nova')}>Nova OS</Button>
          </>
        }
      />
      <Card bodyClass="p-3" className="mb-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <div className="relative col-span-2 xl:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Nº, título, TAG, cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={f.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="todas">Todas</option>
            {STATUS_OS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Select value={f.tipo} onChange={(e) => setF('tipo', e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_OS.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select value={f.unidade} onChange={(e) => setF('unidadeId', e.target.value)}>
            <option value="">Todas as unidades</option>
            {l.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
          <Select value={f.tecnico} onChange={(e) => setF('tecnico', e.target.value)}>
            <option value="">Todos os técnicos</option>
            {l.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <div className="col-span-2 flex gap-1 md:col-span-1">
            <Input type="date" value={f.de} onChange={(e) => setF('de', e.target.value)} title="De" />
            <Input type="date" value={f.ate} onChange={(e) => setF('ate', e.target.value)} title="Até" />
          </div>
        </div>
      </Card>

      {!all ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList size={40} />} title="Nenhuma OS encontrada">Ajuste os filtros ou crie uma nova OS.</EmptyState></Card>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STATUS_OS.filter((s) => f.status === 'todas' || !OS_FINALIZADAS.includes(s.value) || s.value === f.status).map((s) => {
            const col = rows.filter((o) => o.status === s.value);
            return (
              <div key={s.value} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <Badge className={s.cor}>{s.label}</Badge>
                  <span className="text-xs text-slate-500">{col.length}</span>
                </div>
                <div
                  className="min-h-[120px] space-y-2 rounded-xl bg-slate-100/70 p-2 dark:bg-slate-900/60"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    const osId = e.dataTransfer.getData('text/os');
                    const o = all.find((x) => x.id === osId);
                    if (o && o.status !== s.value) await db.os.update(o.id, { status: s.value as StatusOS, historico: [...o.historico, { data: new Date().toISOString(), texto: `Status alterado para "${s.label}" (quadro)` }] });
                  }}
                >
                  {col.map((o) => (
                    <div key={o.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/os', o.id)}>
                      {card(o)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">OS</th>
                  <th className="px-3 py-2.5">Título</th>
                  <th className="px-3 py-2.5">Unidade</th>
                  <th className="px-3 py-2.5">Agendada</th>
                  <th className="px-3 py-2.5">Prazo</th>
                  <th className="px-3 py-2.5">Responsável</th>
                  <th className="px-3 py-2.5">Prioridade</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.slice(0, 500).map((o) => {
                  const st = statusOs(o.status);
                  const atrasada = isAtrasada(o);
                  return (
                    <tr key={o.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => navigate(`/os/${o.id}`)}>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{o.numero}</td>
                      <td className="px-3 py-2.5"><p className="font-medium text-slate-800 dark:text-slate-100">{o.titulo}</p><p className="text-xs text-slate-500">{o.tipo} · {o.equipamentos.length} equip.</p></td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{l.unidadeMap.get(o.unidadeId || '')?.nome || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(o.dataAgendada)}</td>
                      <td className={cx('whitespace-nowrap px-3 py-2.5', atrasada && 'font-semibold text-rose-600')}>{fmtDate(o.prazo)}{atrasada && ' ⚠'}</td>
                      <td className="px-3 py-2.5">{l.profissionalMap.get(o.responsavelId || '')?.nome || '—'}</td>
                      <td className="px-3 py-2.5"><Badge className={PRIORIDADES.find((p) => p.value === o.prioridade)?.cor}>{prioridade(o.prioridade).label}</Badge></td>
                      <td className="px-3 py-2.5"><Badge className={st.cor}>{st.label}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{money(totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 500 && <p className="p-3 text-xs text-slate-500">Mostrando 500 de {rows.length}. Refine os filtros ou exporte.</p>}
        </Card>
      )}
    </div>
  );
}
