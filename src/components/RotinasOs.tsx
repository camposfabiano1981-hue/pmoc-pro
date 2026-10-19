import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, Search, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import type { ItemChecklist, Rotina } from '../db/types';
import { Badge, Button, Input, Modal, cx } from './ui';
import { prazoRotina } from './ProgramarPreventiva';
import { OS_FINALIZADAS, periodicidadeLabel } from '../lib/catalogs';
import { addDays, fmtDate, fmtHoras, todayStr } from '../lib/format';
import { statusItem } from '../lib/rotinas';

/**
 * Seleção individual das rotinas do equipamento para incluir na OS. Mostra a situação de
 * cada rotina (vencida / a vencer), as que já estão nesta OS e as que estão em outra OS aberta.
 */
export function IncluirRotinasModal({ open, equipamentoId, osId, checklist, onClose, onIncluir }: {
  open: boolean;
  equipamentoId: string;
  osId: string;
  checklist: ItemChecklist[];
  onClose: () => void;
  onIncluir: (rotinas: Rotina[]) => void;
}) {
  const hoje = todayStr();
  const rotinas = useLiveQuery(() => (open ? db.rotinas.where('equipamentoId').equals(equipamentoId).toArray() : []), [open, equipamentoId]) || [];
  const outras = useLiveQuery(
    () => (open ? db.os.filter((o) => o.id !== osId && !OS_FINALIZADAS.includes(o.status) && o.equipamentos.some((e) => e.equipamentoId === equipamentoId)).toArray() : []),
    [open, osId, equipamentoId],
  ) || [];
  const emOutra = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of outras) for (const it of o.equipamentos) for (const c of it.checklist) if (c.rotinaId) m.set(c.rotinaId, o.numero);
    return m;
  }, [outras]);
  const nestaOS = useMemo(() => new Set(checklist.map((c) => c.rotinaId).filter(Boolean)), [checklist]);
  const ativas = rotinas.filter((r) => r.ativa && r.equipamentoId === equipamentoId).sort((a, b) => a.proximaExecucao.localeCompare(b.proximaExecucao) || (a.ordem ?? 0) - (b.ordem ?? 0));
  const livre = (r: Rotina) => !nestaOS.has(r.id) && !emOutra.has(r.id);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  useEffect(() => {
    if (open) {
      setSel(new Set());
      setBusca('');
    }
  }, [open, equipamentoId]);

  const visiveis = ativas.filter((r) => !busca || `${r.descricao} ${r.grupo}`.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => Number(!livre(a)) - Number(!livre(b)));
  const escolhidas = ativas.filter((r) => sel.has(r.id) && livre(r));
  const marcar = (filtro: (r: Rotina) => boolean) => setSel(new Set(ativas.filter((r) => livre(r) && filtro(r)).map((r) => r.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Incluir rotinas do equipamento"
      footer={
        <Button icon={<ClipboardList size={16} />} disabled={!escolhidas.length} onClick={() => { onIncluir(escolhidas); onClose(); }}>
          Incluir selecionadas ({escolhidas.length})
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder="Filtrar rotinas…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => marcar((r) => r.proximaExecucao <= addDays(hoje, 15))}>Vencidas e a vencer (15 dias)</Button>
        <Button size="sm" variant="outline" onClick={() => marcar(() => true)}>Todas</Button>
        <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Limpar</Button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="w-8 px-2 py-1.5" />
              <th className="px-2 py-1.5">Rotina</th>
              <th className="px-2 py-1.5">Periodicidade</th>
              <th className="px-2 py-1.5">Situação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => {
              const outra = emOutra.get(r.id);
              const aqui = nestaOS.has(r.id);
              const pz = prazoRotina(r.proximaExecucao, hoje);
              return (
                <tr key={r.id} className={cx('border-t border-slate-100 dark:border-slate-800', (aqui || outra) && 'opacity-60')}>
                  <td className="px-2 py-1.5">
                    <input type="checkbox" aria-label={r.descricao} disabled={aqui || !!outra} checked={aqui || sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <label className="cursor-pointer" onClick={() => livre(r) && toggle(r.id)}>
                      {r.descricao}
                      <span className="block text-[11px] text-slate-500">{[r.grupo, r.tempoMin ? `${r.tempoMin} min` : ''].filter(Boolean).join(' · ')}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{periodicidadeLabel(r.periodicidade)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                    {aqui ? <Badge>Já nesta OS</Badge> : outra ? <Badge className="bg-blue-600 text-white">Na OS {outra}</Badge> : <Badge className={pz.cls}>{fmtDate(r.proximaExecucao)} · {pz.texto}</Badge>}
                  </td>
                </tr>
              );
            })}
            {!visiveis.length && <tr><td colSpan={4} className="p-4 text-center text-slate-500">{ativas.length ? 'Nenhuma rotina encontrada.' : 'Equipamento sem rotinas ativas. Aplique um plano na ficha do equipamento.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {escolhidas.length} selecionada(s) · {fmtHoras(escolhidas.reduce((a, r) => a + (r.tempoMin || 0), 0) / 60)} previstas. Rotinas já programadas em outra OS aberta não podem ser repetidas.
      </p>
    </Modal>
  );
}

/** Confirmação de exclusão de uma tarefa/rotina da OS, com opção de desativar a rotina no equipamento. */
export function RemoverTarefaModal({ tarefa, podeDesativar, onClose, onConfirmar }: {
  tarefa?: ItemChecklist;
  podeDesativar: boolean;
  onClose: () => void;
  onConfirmar: (desativar: boolean) => void;
}) {
  const st = tarefa ? statusItem(tarefa) : '';
  const rotina = !!tarefa?.rotinaId;
  return (
    <Modal
      open={!!tarefa}
      onClose={onClose}
      size="md"
      title={rotina ? 'Excluir rotina da OS' : 'Excluir tarefa da OS'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {rotina && podeDesativar && (
            <Button variant="outline" icon={<Trash2 size={16} />} onClick={() => onConfirmar(true)} title="A atividade não se aplica a este equipamento">
              Excluir e desativar no equipamento
            </Button>
          )}
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => onConfirmar(false)}>Excluir desta OS</Button>
        </>
      }
    >
      <p className="text-sm font-medium text-slate-900 dark:text-white">{tarefa?.descricao || 'Tarefa sem descrição'}</p>
      {st && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Esta tarefa já foi lançada como <b>{st}</b>. Ao excluir, o lançamento é descartado.
        </p>
      )}
      {rotina && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li><b>Excluir desta OS:</b> a rotina continua no plano do equipamento e volta para “A programar” na data prevista.</li>
          {podeDesativar && <li><b>Excluir e desativar no equipamento:</b> use quando a atividade não se aplica a este equipamento; ela deixa de aparecer no cronograma e no PMOC (pode ser reativada na ficha do equipamento).</li>}
        </ul>
      )}
    </Modal>
  );
}
