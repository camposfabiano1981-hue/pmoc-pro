import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRange, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { db, nowIso, uid } from '../db/db';
import type { Equipamento, Periodicidade, Rotina } from '../db/types';
import { PERIODICIDADES, SETORES, diasDaPeriodicidade } from '../lib/catalogs';
import { fmtDate, todayStr } from '../lib/format';
import { useLookups } from '../lib/lookups';
import { useSessao } from '../lib/sessao';
import { STATUS_ROTINA, aplicarPlano, proximaData, statusRotina } from '../lib/rotinas';
import { Badge, Button, Card, Field, IconButton, Input, Modal, Select, cx, useConfirm, useToast } from './ui';

function RotinaRow({ r, editavel, nExec }: { r: Rotina; editavel: boolean; nExec: number }) {
  const l = useLookups();
  const confirm = useConfirm();
  const [f, setF] = useState(r);
  useEffect(() => setF(r), [r]);
  const salvar = (patch: Partial<Rotina>) => db.rotinas.update(r.id, { ...patch, updatedAt: nowIso() });
  const st = statusRotina(r);
  const ro = !editavel;
  return (
    <tr className={cx('border-t border-slate-100 align-top dark:border-slate-800', !r.ativa && 'opacity-50')}>
      <td className="min-w-[220px] px-2 py-1.5">
        {r.planoId ? (
          <p className="text-sm">{r.descricao}</p>
        ) : (
          <Input className="py-1" value={f.descricao} disabled={ro} onChange={(e) => setF({ ...f, descricao: e.target.value })} onBlur={() => f.descricao !== r.descricao && salvar({ descricao: f.descricao })} />
        )}
        <p className="text-[11px] text-slate-500">{r.grupo}{r.personalizada && ' · personalizada'}</p>
      </td>
      <td className="px-1 py-1.5">
        <Select className="w-32 py-1" value={r.periodicidade} disabled={ro} onChange={(e) => { const p = e.target.value as Periodicidade; salvar({ periodicidade: p, intervaloDias: diasDaPeriodicidade(p), personalizada: true }); }}>
          {PERIODICIDADES.filter((p) => p.value !== 'na').map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
      </td>
      <td className="px-1 py-1.5">
        <Input className="w-20 py-1" type="number" min={1} value={f.intervaloDias} disabled={ro} onChange={(e) => setF({ ...f, intervaloDias: Number(e.target.value) })} onBlur={() => f.intervaloDias !== r.intervaloDias && f.intervaloDias > 0 && salvar({ intervaloDias: f.intervaloDias, personalizada: true, proximaExecucao: r.ultimaExecucao ? proximaData(r.ultimaExecucao, f.intervaloDias) : r.proximaExecucao })} />
      </td>
      <td className="px-1 py-1.5">
        <Input className="w-16 py-1" type="number" min={0} value={f.tempoMin} disabled={ro} onChange={(e) => setF({ ...f, tempoMin: Number(e.target.value) })} onBlur={() => f.tempoMin !== r.tempoMin && salvar({ tempoMin: f.tempoMin })} />
      </td>
      <td className="px-1 py-1.5">
        <Input className="w-32 py-1" list="dl-setor-rot" value={f.setor || ''} disabled={ro} onChange={(e) => setF({ ...f, setor: e.target.value })} onBlur={() => f.setor !== r.setor && salvar({ setor: f.setor })} />
      </td>
      <td className="px-1 py-1.5">
        <Select className="w-36 py-1" value={r.responsavelId || ''} disabled={ro} onChange={(e) => salvar({ responsavelId: e.target.value || undefined })}>
          <option value="">—</option>
          {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </td>
      <td className="whitespace-nowrap px-1 py-1.5 text-sm">{r.ultimaExecucao ? fmtDate(r.ultimaExecucao) : '—'}</td>
      <td className="px-1 py-1.5">
        <Input className="w-36 py-1" type="date" value={r.proximaExecucao} disabled={ro} onChange={(e) => e.target.value && salvar({ proximaExecucao: e.target.value, reprogramada: true })} />
        {r.reprogramada && <p className="text-[10px] text-amber-600">reprogramada</p>}
      </td>
      <td className="px-1 py-1.5"><Badge className={STATUS_ROTINA[st].cor}>{STATUS_ROTINA[st].label}</Badge></td>
      <td className="whitespace-nowrap px-1 py-1.5">
        {editavel && (
          <>
            <input type="checkbox" className="mr-1 h-4 w-4 align-middle" title="Rotina ativa" checked={r.ativa} onChange={(e) => salvar({ ativa: e.target.checked })} />
            {!r.planoId && (
              <IconButton
                title="Excluir rotina"
                onClick={async () => {
                  if (nExec) {
                    await salvar({ ativa: false });
                    return;
                  }
                  if (await confirm({ message: 'Excluir esta rotina personalizada?', danger: true, confirmText: 'Excluir' })) await db.rotinas.delete(r.id);
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

/** Plano de manutenção próprio do equipamento: periodicidade, última e próxima execução por rotina. */
export default function RotinasEquipamento({ eq }: { eq: Equipamento }) {
  const l = useLookups();
  const toast = useToast();
  const { pode } = useSessao();
  const editavel = pode('cadastrar');
  const rotinas = useLiveQuery(() => db.rotinas.where('equipamentoId').equals(eq.id).toArray(), [eq.id]) || [];
  const execucoes = useLiveQuery(() => db.execucoes.where('equipamentoId').equals(eq.id).toArray(), [eq.id]) || [];
  const [aplicar, setAplicar] = useState(false);
  const [inicio, setInicio] = useState(todayStr());
  const [verInativas, setVerInativas] = useState(false);
  const lista = rotinas.filter((r) => verInativas || r.ativa).sort((a, b) => Number(b.ativa) - Number(a.ativa) || (a.ordem ?? 0) - (b.ordem ?? 0));
  const cont = { vencida: 0, a_vencer: 0, em_dia: 0, inativa: 0 };
  rotinas.forEach((r) => cont[statusRotina(r)]++);
  const execPor = new Map<string, number>();
  execucoes.forEach((e) => execPor.set(e.rotinaId, (execPor.get(e.rotinaId) || 0) + 1));
  const rotMap = new Map(rotinas.map((r) => [r.id, r]));
  const historico = [...execucoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 60);

  const novaRotina = async () => {
    const ts = nowIso();
    await db.rotinas.add({ id: uid(), createdAt: ts, updatedAt: ts, equipamentoId: eq.id, grupo: 'Personalizada', descricao: 'Nova rotina', tipo: 'check', periodicidade: 'mensal', intervaloDias: 30, tempoMin: 10, setor: 'Manutenção', proximaExecucao: todayStr(), ativa: true, personalizada: true, ordem: 999 });
  };

  return (
    <>
      <Card
        title={`Plano de manutenção do equipamento — ${rotinas.filter((r) => r.ativa).length} rotina(s)`}
        className="mt-4"
        bodyClass="p-0"
        actions={
          <>
            <Badge className={STATUS_ROTINA.vencida.cor}>{cont.vencida} vencida(s)</Badge>
            <Badge className={STATUS_ROTINA.a_vencer.cor}>{cont.a_vencer} a vencer</Badge>
            <Badge className={STATUS_ROTINA.em_dia.cor}>{cont.em_dia} em dia</Badge>
            <Link to={`/cronograma?unidade=${eq.unidadeId}&equipamento=${eq.id}`}><Button size="sm" variant="outline" icon={<CalendarRange size={14} />}>Cronograma</Button></Link>
            {editavel && <Button size="sm" variant="outline" icon={<RefreshCw size={14} />} onClick={() => setAplicar(true)}>Aplicar plano modelo</Button>}
            {editavel && <Button size="sm" icon={<Plus size={14} />} onClick={novaRotina}>Rotina</Button>}
          </>
        }
      >
        <datalist id="dl-setor-rot">{SETORES.map((s) => <option key={s} value={s} />)}</datalist>
        <p className="px-4 pt-3 text-xs text-slate-500">
          A periodicidade é controlada por equipamento: a próxima execução = última execução lançada pela equipe técnica + intervalo (dias). Alterar a data da próxima execução reprograma a rotina.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Rotina</th>
                <th className="px-1 py-2">Periodicidade</th>
                <th className="px-1 py-2">Dias</th>
                <th className="px-1 py-2">Min</th>
                <th className="px-1 py-2">Setor</th>
                <th className="px-1 py-2">Responsável</th>
                <th className="px-1 py-2">Últ. exec.</th>
                <th className="px-1 py-2">Próxima</th>
                <th className="px-1 py-2">Situação</th>
                <th className="px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => <RotinaRow key={r.id} r={r} editavel={editavel} nExec={execPor.get(r.id) || 0} />)}
              {lista.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Sem rotinas. {editavel ? 'Aplique um plano modelo ou crie uma rotina.' : ''}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {cont.inativa > 0 && (
          <label className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500">
            <input type="checkbox" checked={verInativas} onChange={(e) => setVerInativas(e.target.checked)} /> Mostrar {cont.inativa} rotina(s) inativa(s)
          </label>
        )}
      </Card>

      <Card title={`Histórico de execuções (${execucoes.length})`} className="mt-4" bodyClass="p-0">
        <div className="max-h-[360px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Rotina</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Condição / valor</th>
                <th className="px-3 py-2">Executado por</th>
                <th className="px-3 py-2">OS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {historico.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-1.5">{fmtDate(e.data)}</td>
                  <td className="px-3 py-1.5">{rotMap.get(e.rotinaId)?.descricao || '—'}</td>
                  <td className="px-3 py-1.5">
                    <Badge className={e.status === 'E' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : e.status === 'N' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}>{e.status}</Badge>
                  </td>
                  <td className="px-3 py-1.5 text-xs">{[e.condicao === 'nok' ? 'Não conforme' : e.condicao === 'corrigido' ? 'Corrigido' : e.condicao === 'ok' ? 'Conforme' : '', e.valor].filter(Boolean).join(' · ')}{e.obs && <span className="block text-slate-500">{e.obs}</span>}</td>
                  <td className="px-3 py-1.5">{l.profissionalMap.get(e.executorId || '')?.nome || '—'}</td>
                  <td className="px-3 py-1.5">{e.osId ? <Link className="text-brand-700 hover:underline dark:text-brand-300" to={`/os/${e.osId}`}>abrir</Link> : '—'}</td>
                </tr>
              ))}
              {historico.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhuma execução registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={aplicar}
        onClose={() => setAplicar(false)}
        title="Aplicar plano modelo ao equipamento"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAplicar(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                const r = await aplicarPlano(eq.id, inicio);
                toast(`${r.criadas} rotina(s) criada(s), ${r.atualizadas} atualizada(s).`);
                setAplicar(false);
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>Plano modelo: <b>{l.planoMap.get(eq.planoId || '')?.nome || 'nenhum (defina no cadastro do equipamento)'}</b></p>
          <p className="text-slate-500">Cria as rotinas que faltam e atualiza a descrição das existentes. Periodicidades personalizadas e o histórico são mantidos.</p>
          <Field label="1ª execução das novas rotinas"><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
