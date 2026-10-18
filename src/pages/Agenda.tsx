import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { Badge, Button, Card, PageHeader, Select, cx } from '../components/ui';
import { useSessao } from '../lib/sessao';
import { useLookups } from '../lib/lookups';
import { MESES, dateStr, todayStr } from '../lib/format';
import { statusOs } from '../lib/catalogs';
import { isAtrasada } from '../lib/osHelpers';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Agenda() {
  const l = useLookups();
  const { usuario } = useSessao();
  const hoje = new Date();
  const [ref, setRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [tecnico, setTecnico] = useState('');
  const [sel, setSel] = useState(todayStr());
  const osList = useLiveQuery(() => db.os.toArray(), []) || [];

  const porDia = useMemo(() => {
    const m: Record<string, typeof osList> = {};
    for (const o of osList) {
      if (o.status === 'cancelada') continue;
      if (tecnico && o.responsavelId !== tecnico && !o.tecnicosIds.includes(tecnico)) continue;
      const d = o.dataAgendada || o.dataAbertura.slice(0, 10);
      (m[d] ||= []).push(o);
    }
    return m;
  }, [osList, tecnico]);

  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const hojeStr = todayStr();
  const doDia = porDia[sel] || [];

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="OS programadas por data — preventivas, corretivas e visitas"
        icon={<CalendarDays size={20} />}
        actions={
          <>
            <Select className="w-auto" value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
              <option value="">Todos os técnicos</option>
              {l.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            {usuario.perfil !== 'tecnico' && <Link to="/os/nova"><Button>Nova OS</Button></Link>}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card
          title={<span className="text-base">{MESES[ref.getMonth()]} de {ref.getFullYear()}</span>}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}><ChevronLeft size={16} /></Button>
              <Button size="sm" variant="outline" onClick={() => { setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1)); setSel(hojeStr); }}>Hoje</Button>
              <Button size="sm" variant="outline" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}><ChevronRight size={16} /></Button>
            </>
          }
          bodyClass="p-2"
        >
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500">
            {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const k = dateStr(d);
              const lista = porDia[k] || [];
              const outro = d.getMonth() !== ref.getMonth();
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSel(k)}
                  className={cx(
                    'min-h-[64px] rounded-lg border p-1 text-left align-top transition sm:min-h-[96px]',
                    sel === k ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 dark:border-slate-700',
                    outro ? 'bg-slate-50 opacity-60 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900',
                  )}
                >
                  <span className={cx('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', k === hojeStr ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-200')}>{d.getDate()}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {lista.slice(0, 3).map((o) => {
                      const cor = l.profissionalMap.get(o.responsavelId || '')?.cor || '#64748b';
                      return (
                        <div key={o.id} className="hidden truncate rounded px-1 text-[10px] font-medium text-white sm:block" style={{ background: isAtrasada(o) ? '#e11d48' : cor }}>
                          {o.tipo === 'Preventiva' ? 'PRV' : o.tipo.slice(0, 3).toUpperCase()} {o.numero.slice(-4)}
                        </div>
                      );
                    })}
                    {lista.length > 0 && <span className="block text-[10px] text-slate-500 sm:hidden">{lista.length} OS</span>}
                    {lista.length > 3 && <span className="hidden text-[10px] text-slate-500 sm:block">+{lista.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title={`OS em ${sel.split('-').reverse().join('/')}`} bodyClass="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {doDia.map((o) => (
              <li key={o.id}>
                <Link to={`${usuario.perfil === 'tecnico' ? '/campo/os/' : '/os/'}${o.id}`} className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{o.numero}</span>
                    <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm font-medium">{o.titulo}</p>
                  <p className="text-xs text-slate-500">{o.tipo} · {l.unidadeMap.get(o.unidadeId || '')?.nome} · {l.profissionalMap.get(o.responsavelId || '')?.nome || 'sem responsável'}</p>
                </Link>
              </li>
            ))}
            {doDia.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma OS nesta data.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
