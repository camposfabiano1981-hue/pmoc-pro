import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Calculator, Copy, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { db, nextNumber, nowIso, uid } from '../../db/db';
import type { EstudoPreco } from '../../db/types';
import { Badge, Button, Card, EmptyState, IconButton, Input, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
import { useLookups } from '../../lib/lookups';
import { fmtDate, money, norm } from '../../lib/format';
import { calcularEstudo } from '../../lib/precificacao';
import { criarEstudo, useParametrosPreco } from '../../lib/precificacaoDb';

export const STATUS_ESTUDO: { value: EstudoPreco['status']; label: string; cor: string }[] = [
  { value: 'elaboracao', label: 'Em elaboração', cor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  { value: 'enviado', label: 'Proposta enviada', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200' },
  { value: 'ganho', label: 'Ganho', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { value: 'perdido', label: 'Perdido', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
];
export const statusEstudo = (v: string) => STATUS_ESTUDO.find((s) => s.value === v) || STATUS_ESTUDO[0];

export default function EstudosPage() {
  const l = useLookups();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const params = useParametrosPreco();
  const estudos = useLiveQuery(() => db.estudos.toArray(), []);
  const cargos = useLiveQuery(() => db.cargosPreco.toArray(), []) || [];
  const oportunidades = useLiveQuery(() => db.oportunidades.toArray(), []) || [];
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const linhas = useMemo(() => {
    if (!estudos || !params) return [];
    const ctx = { params, cargos: new Map(cargos.map((c) => [c.id, c])), planos: l.planoMap };
    return estudos
      .map((e) => ({ e, r: calcularEstudo(e, ctx) }))
      .filter(({ e }) => (!status || e.status === status) && (!q || norm([e.numero, e.titulo, e.orgao, l.clienteMap.get(e.clienteId || '')?.nome].join(' ')).includes(norm(q))))
      .sort((a, b) => b.e.updatedAt.localeCompare(a.e.updatedAt));
  }, [estudos, params, cargos, l.planoMap, l.clienteMap, q, status]);

  const novo = async () => {
    const e = await criarEstudo();
    navigate(`/precificacao/${e.id}`);
  };
  const duplicar = async (e: EstudoPreco) => {
    const ts = nowIso();
    const copia: EstudoPreco = { ...structuredClone(e), id: uid(), createdAt: ts, updatedAt: ts, numero: await nextNumber('ep'), titulo: `${e.titulo} (cópia)`, status: 'elaboracao', oportunidadeId: undefined, tributosBase: undefined };
    await db.estudos.add(copia);
    toast(`Estudo ${copia.numero} criado.`);
    navigate(`/precificacao/${copia.id}`);
  };
  const excluir = async (e: EstudoPreco) => {
    if (!(await confirm({ title: 'Excluir estudo', message: `Excluir o estudo ${e.numero} — ${e.titulo}?`, confirmText: 'Excluir', danger: true }))) return;
    await db.estudos.delete(e.id);
    if (e.oportunidadeId) await db.oportunidades.update(e.oportunidadeId, { estudoId: undefined, updatedAt: nowIso() });
    toast('Estudo excluído.');
  };

  return (
    <div>
      <PageHeader
        title="Estudos de preço"
        subtitle="Composição do preço de manutenção por equipamento: horas do PMOC × custo-hora + insumos + BDI"
        icon={<Calculator size={20} />}
        actions={<Button icon={<Plus size={16} />} onClick={novo}>Novo estudo</Button>}
      />
      {cargos.filter((c) => c.ativo && c.salarioBase > 0).length === 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Antes do primeiro estudo, cadastre a equipe em <Link to="/precificacao/equipe" className="font-semibold underline">Equipe e custo-hora</Link> (salários da CCT), preencha a <Link to="/precificacao/custos" className="font-semibold underline">Composição de custos</Link> e confira o regime em <Link to="/precificacao/tributos" className="font-semibold underline">Tributos e formação do preço</Link>.
        </p>
      )}
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Buscar estudo, cliente, órgão…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas as situações</option>
            {STATUS_ESTUDO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
        {estudos && estudos.length === 0 ? (
          <EmptyState icon={<Calculator size={28} />} title="Nenhum estudo de preço">
            Crie um estudo para montar a proposta de uma licitação ou contrato, ou abra pela oportunidade em Comercial.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2">Nº</th>
                  <th className="px-3 py-2">Estudo</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2 text-right">Equip.</th>
                  <th className="px-3 py-2 text-right">Preço mensal</th>
                  <th className="px-3 py-2 text-right">Total da vigência</th>
                  <th className="px-3 py-2">Atualizado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ e, r }) => {
                  const op = oportunidades.find((o) => o.id === e.oportunidadeId);
                  const st = statusEstudo(e.status);
                  return (
                    <tr key={e.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => navigate(`/precificacao/${e.id}`)}>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{e.numero}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{e.titulo}</span>
                        <span className="block text-xs text-slate-500">{[l.clienteMap.get(e.clienteId || '')?.nome || e.orgao, op && `${op.numero}${op.numeroEdital ? ' · edital ' + op.numeroEdital : ''}`].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-3 py-2"><Badge className={st.cor}>{st.label}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.quantidade}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.precoMensal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.precoVigencia)}<span className="block text-[11px] text-slate-500">{e.vigenciaMeses} meses</span></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(e.updatedAt)}</td>
                      <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Link to={`/precificacao/${e.id}/imprimir`}><IconButton title="Imprimir composição"><Printer size={15} /></IconButton></Link>
                          <IconButton title="Duplicar" onClick={() => duplicar(e)}><Copy size={15} /></IconButton>
                          <IconButton title="Excluir" onClick={() => excluir(e)}><Trash2 size={15} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
