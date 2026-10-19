import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, ClipboardPlus, Play } from 'lucide-react';
import { db } from '../db/db';
import { Badge, Button, Field, Input, Modal, Select, cx, useToast } from './ui';
import { useLookups } from '../lib/lookups';
import { assinaturaUsuario, useSessao } from '../lib/sessao';
import { OS_FINALIZADAS, periodicidadeLabel } from '../lib/catalogs';
import { addDays, diffDays, fmtDate, fmtHoras, todayStr } from '../lib/format';
import { programarRotinas, reprogramarRotinas } from '../lib/preventivas';

/** Situação da próxima execução em texto curto (vencida há X dias / vence em X dias). */
export function prazoRotina(proxima: string, hoje = todayStr()): { texto: string; cls: string } {
  const d = diffDays(proxima, hoje) ?? 0;
  if (d < 0) return { texto: `Vencida há ${-d} dia(s)`, cls: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' };
  if (d === 0) return { texto: 'Vence hoje', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' };
  return { texto: `Vence em ${d} dia(s)`, cls: d <= 7 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' };
}

/**
 * Lançamento rápido de preventiva de um equipamento: escolhe as rotinas (vencidas e a vencer
 * já marcadas) e programa a OS ou executa na hora (abre a tela do técnico).
 */
export function ProgramarPreventivaModal({ equipamentoId, onClose, horizonte = 15 }: { equipamentoId?: string; onClose: () => void; horizonte?: number }) {
  const l = useLookups();
  const toast = useToast();
  const navigate = useNavigate();
  const { usuario, pode } = useSessao();
  const hoje = todayStr();
  const eq = l.equipamentoMap.get(equipamentoId || '');
  const rotinas = useLiveQuery(() => (equipamentoId ? db.rotinas.where('equipamentoId').equals(equipamentoId).toArray() : []), [equipamentoId]) || [];
  const abertas = useLiveQuery(() => (equipamentoId ? db.os.filter((o) => !OS_FINALIZADAS.includes(o.status) && o.equipamentos.some((e) => e.equipamentoId === equipamentoId)).toArray() : []), [equipamentoId]) || [];
  const emOS = useMemo(() => {
    const m = new Map<string, { id: string; numero: string }>();
    for (const o of abertas) for (const it of o.equipamentos) for (const c of it.checklist) if (c.rotinaId) m.set(c.rotinaId, { id: o.id, numero: o.numero });
    return m;
  }, [abertas]);
  const ativas = rotinas.filter((r) => r.ativa && r.equipamentoId === equipamentoId).sort((a, b) => a.proximaExecucao.localeCompare(b.proximaExecucao) || (a.ordem ?? 0) - (b.ordem ?? 0));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [iniciado, setIniciado] = useState(false);
  const [data, setData] = useState(hoje);
  const [resp, setResp] = useState(usuario.profissionalId || '');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setIniciado(false);
    setData(hoje);
    setResp(usuario.profissionalId || '');
  }, [equipamentoId, hoje, usuario.profissionalId]);
  useEffect(() => {
    if (iniciado || !ativas.length) return;
    setSel(new Set(ativas.filter((r) => !emOS.has(r.id) && r.proximaExecucao <= addDays(hoje, horizonte)).map((r) => r.id)));
    setIniciado(true);
  }, [ativas, emOS, iniciado, hoje, horizonte]);

  const escolhidas = ativas.filter((r) => sel.has(r.id) && !emOS.has(r.id));
  const tempo = escolhidas.reduce((a, r) => a + (r.tempoMin || 0), 0);
  const osExistentes = [...new Map([...emOS.values()].map((o) => [o.id, o])).values()];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const programar = async (executar: boolean) => {
    if (!eq || !escolhidas.length) return;
    setOcupado(true);
    try {
      const os = await programarRotinas({ equipamentoId: eq.id, rotinaIds: escolhidas.map((r) => r.id), data: executar ? hoje : data, responsavelId: (executar && usuario.profissionalId) || resp || undefined, usuario: assinaturaUsuario(usuario) });
      if (!os) return;
      toast(executar ? `OS ${os.numero} criada — lance as tarefas.` : `OS ${os.numero} programada para ${fmtDate(os.dataAgendada)}.`);
      onClose();
      if (executar) navigate(`/campo/os/${os.id}`);
    } finally {
      setOcupado(false);
    }
  };
  const reprogramar = async () => {
    if (!escolhidas.length || data === hoje) return;
    await reprogramarRotinas(escolhidas.map((r) => r.id), data);
    toast(`${escolhidas.length} rotina(s) reprogramada(s) para ${fmtDate(data)}.`);
    onClose();
  };

  return (
    <Modal
      open={!!equipamentoId}
      onClose={onClose}
      size="lg"
      title={eq ? `Preventiva — ${eq.tag} · ${eq.tipo}` : 'Preventiva'}
      footer={
        <>
          {pode('gerir_os') && (
            <Button variant="outline" icon={<CalendarClock size={16} />} disabled={!escolhidas.length || data === hoje} onClick={reprogramar} title="Muda a próxima execução das rotinas marcadas, sem gerar OS">
              Reprogramar rotinas
            </Button>
          )}
          {pode('gerir_os') && (
            <Button variant="secondary" icon={<ClipboardPlus size={16} />} disabled={!escolhidas.length || ocupado} onClick={() => programar(false)}>
              Programar OS
            </Button>
          )}
          <Button variant="success" icon={<Play size={16} />} disabled={!escolhidas.length || ocupado} onClick={() => programar(true)}>
            Executar agora
          </Button>
        </>
      }
    >
      {eq && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {l.unidadeMap.get(eq.unidadeId)?.nome} · {l.ambienteMap.get(eq.ambienteId || '')?.nome} — marque as rotinas que entram nesta preventiva. Já vêm marcadas as vencidas e as que vencem em até {horizonte} dias.
        </p>
      )}
      {osExistentes.length > 0 && (
        <div className="mb-3 rounded-lg bg-blue-50 p-2.5 text-sm text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
          Já existe OS aberta para este equipamento:{' '}
          {osExistentes.map((o) => (
            <Link key={o.id} to={`/campo/os/${o.id}`} onClick={onClose} className="mr-2 font-semibold underline">{o.numero} (lançar execução)</Link>
          ))}
        </div>
      )}
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="w-8 px-2 py-1.5">
                <input type="checkbox" aria-label="Marcar todas" checked={ativas.length > 0 && ativas.every((r) => emOS.has(r.id) || sel.has(r.id))} onChange={(e) => setSel(new Set(e.target.checked ? ativas.filter((r) => !emOS.has(r.id)).map((r) => r.id) : []))} />
              </th>
              <th className="px-2 py-1.5">Rotina</th>
              <th className="px-2 py-1.5">Periodicidade</th>
              <th className="px-2 py-1.5">Próxima</th>
            </tr>
          </thead>
          <tbody>
            {ativas.map((r) => {
              const os = emOS.get(r.id);
              const pz = prazoRotina(r.proximaExecucao, hoje);
              return (
                <tr key={r.id} className={cx('border-t border-slate-100 dark:border-slate-800', os && 'opacity-60')}>
                  <td className="px-2 py-1.5"><input type="checkbox" aria-label={r.descricao} disabled={!!os} checked={!os && sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="px-2 py-1.5">{r.descricao}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{periodicidadeLabel(r.periodicidade)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                    {os ? <Badge className="bg-blue-600 text-white">Na OS {os.numero}</Badge> : <Badge className={pz.cls}>{fmtDate(r.proximaExecucao)} · {pz.texto}</Badge>}
                  </td>
                </tr>
              );
            })}
            {!ativas.length && <tr><td colSpan={4} className="p-4 text-center text-slate-500">Equipamento sem rotinas. Aplique um plano de manutenção na ficha do equipamento.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Data programada" help="Para “Programar OS” ou “Reprogramar”">
          <Input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Técnico responsável" className="sm:col-span-2">
          <Select value={resp} onChange={(e) => setResp(e.target.value)} disabled={usuario.perfil === 'tecnico'}>
            <option value="">— definir depois —</option>
            {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {escolhidas.length} rotina(s) · tempo previsto {fmtHoras(tempo / 60)}. <b>Executar agora</b> cria a OS para hoje e abre a tela de lançamento (E / P / N). Ao concluir e liberar, a próxima data de cada rotina é recalculada pela periodicidade.
      </p>
    </Modal>
  );
}
