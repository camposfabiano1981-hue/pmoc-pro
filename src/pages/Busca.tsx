import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db } from '../db/db';
import { Badge, Card, PageHeader } from '../components/ui';
import { useSessao } from '../lib/sessao';
import { useLookups, equipLabel } from '../lib/lookups';
import { norm } from '../lib/format';
import { statusOs } from '../lib/catalogs';

export default function Busca() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const l = useLookups();
  const { usuario } = useSessao();
  const os = useLiveQuery(() => db.os.toArray(), []) || [];
  const oc = useLiveQuery(() => db.ocorrencias.toArray(), []) || [];
  const r = useMemo(() => {
    const nq = norm(q);
    const has = (...v: unknown[]) => norm(v.join(' ')).includes(nq);
    return {
      os: os.filter((o) => has(o.numero, o.titulo, o.descricao)).slice(0, 30),
      equip: l.equipamentos.filter((e) => has(e.tag, e.tipo, e.marca, e.modelo, e.numeroSerie, e.patrimonio)).slice(0, 30),
      clientes: l.clientes.filter((c) => has(c.nome, c.fantasia, c.cpfCnpj)).slice(0, 20),
      unidades: l.unidades.filter((u) => has(u.nome, u.cidade)).slice(0, 20),
      ambientes: l.ambientes.filter((a) => has(a.nome, a.grupo)).slice(0, 20),
      pecas: l.pecas.filter((p) => has(p.codigo, p.descricao, p.referencia)).slice(0, 20),
      oc: oc.filter((o) => has(o.numero, o.descricao)).slice(0, 20),
    };
  }, [q, os, oc, l]);
  const total = Object.values(r).reduce((a, x) => a + x.length, 0);
  const Sec = ({ title, children, n }: { title: string; n: number; children: React.ReactNode }) =>
    n ? (
      <Card title={`${title} (${n})`} bodyClass="p-0" className="mb-4">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
      </Card>
    ) : null;
  const li = 'block px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40';
  return (
    <div>
      <PageHeader title={`Resultados para "${q}"`} subtitle={`${total} resultado(s)`} icon={<Search size={20} />} />
      <Sec title="Ordens de serviço" n={r.os.length}>{r.os.map((o) => <li key={o.id}><Link className={li} to={`${usuario.perfil === 'tecnico' ? '/campo/os/' : '/os/'}${o.id}`}><b>{o.numero}</b> · {o.titulo} <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge></Link></li>)}</Sec>
      <Sec title="Equipamentos" n={r.equip.length}>{r.equip.map((e) => <li key={e.id}><Link className={li} to={`/equipamentos/${e.id}`}>{equipLabel(e, l)}</Link></li>)}</Sec>
      <Sec title="Ocorrências" n={r.oc.length}>{r.oc.map((o) => <li key={o.id}><Link className={li} to={`/ocorrencias?editar=${o.id}`}><b>{o.numero}</b> · {o.descricao}</Link></li>)}</Sec>
      <Sec title="Clientes" n={r.clientes.length}>{r.clientes.map((c) => <li key={c.id}><Link className={li} to={`/clientes?editar=${c.id}`}>{c.nome}</Link></li>)}</Sec>
      <Sec title="Unidades" n={r.unidades.length}>{r.unidades.map((u) => <li key={u.id}><Link className={li} to={`/unidades?editar=${u.id}`}>{u.nome}</Link></li>)}</Sec>
      <Sec title="Ambientes" n={r.ambientes.length}>{r.ambientes.map((a) => <li key={a.id}><Link className={li} to={`/ambientes?editar=${a.id}`}>{a.nome} {a.grupo && `(${a.grupo})`} — {l.unidadeMap.get(a.unidadeId)?.nome}</Link></li>)}</Sec>
      <Sec title="Peças" n={r.pecas.length}>{r.pecas.map((p) => <li key={p.id}><Link className={li} to={`/pecas?editar=${p.id}`}>{p.codigo} — {p.descricao}</Link></li>)}</Sec>
      {total === 0 && <Card><p className="text-sm text-slate-500">Nada encontrado.</p></Card>}
    </div>
  );
}
