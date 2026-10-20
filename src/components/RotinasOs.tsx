import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardList, Search, Trash2 } from 'lucide-react';
import { db, nowIso } from '../db/db';
import type { ItemChecklist, OS, Rotina } from '../db/types';
import { Badge, Button, Input, Modal, cx } from './ui';
import { prazoRotina } from './ProgramarPreventiva';
import { OS_FINALIZADAS, periodicidadeLabel } from '../lib/catalogs';
import { addDays, fmtDate, fmtHoras, todayStr } from '../lib/format';
import { statusItem } from '../lib/rotinas';

/** Onde a rotina está programada em outra OS aberta (e se já foi lançada lá). */
interface EmOutraOS {
  osId: string;
  numero: string;
  lancada: boolean;
}

function mapaOutrasOS(outras: OS[]): Map<string, EmOutraOS> {
  const m = new Map<string, EmOutraOS>();
  for (const o of outras)
    for (const it of o.equipamentos)
      for (const c of it.checklist) if (c.rotinaId) m.set(c.rotinaId, { osId: o.id, numero: o.numero, lancada: !!statusItem(c) });
  return m;
}

const outrasOSAbertas = (equipamentoId: string, osId: string) =>
  db.os.filter((o) => o.id !== osId && !OS_FINALIZADAS.includes(o.status) && o.equipamentos.some((e) => e.equipamentoId === equipamentoId)).toArray();

export interface Transferencia {
  rotina: Rotina;
  osId: string;
  numero: string;
}

/**
 * Rotinas ativas do equipamento que ainda não estão nesta OS: livres, programadas em outra OS
 * aberta sem lançamento (podem ser transferidas) e já lançadas em outra OS (ficam onde estão).
 */
export async function rotinasDisponiveis(equipamentoId: string, osId: string, checklist: ItemChecklist[]): Promise<{ livres: Rotina[]; transferiveis: Transferencia[]; lancadasEmOutra: number }> {
  const [rotinas, outras] = await Promise.all([db.rotinas.where('equipamentoId').equals(equipamentoId).toArray(), outrasOSAbertas(equipamentoId, osId)]);
  const nestaOS = new Set(checklist.map((c) => c.rotinaId).filter(Boolean));
  const emOutra = mapaOutrasOS(outras);
  const candidatas = rotinas.filter((r) => r.ativa && !nestaOS.has(r.id)).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const out = { livres: [] as Rotina[], transferiveis: [] as Transferencia[], lancadasEmOutra: 0 };
  for (const r of candidatas) {
    const o = emOutra.get(r.id);
    if (!o) out.livres.push(r);
    else if (o.lancada) out.lancadasEmOutra++;
    else out.transferiveis.push({ rotina: r, osId: o.osId, numero: o.numero });
  }
  return out;
}

/** Retira as rotinas (ainda sem lançamento) das outras OS, registrando a transferência no histórico delas. */
export async function transferirRotinas(itens: Transferencia[], destino: string, usuario?: string): Promise<void> {
  const porOS = new Map<string, Set<string>>();
  for (const t of itens) (porOS.get(t.osId) || porOS.set(t.osId, new Set()).get(t.osId)!).add(t.rotina.id);
  for (const [osId, ids] of porOS) {
    const os = await db.os.get(osId);
    if (!os) continue;
    const ts = nowIso();
    await db.os.put({
      ...os,
      equipamentos: os.equipamentos.map((e) => ({ ...e, checklist: e.checklist.filter((c) => !(c.rotinaId && ids.has(c.rotinaId) && !statusItem(c))) })),
      historico: [...os.historico, { data: ts, texto: `${ids.size} rotina(s) transferida(s) para a OS ${destino}`, usuario }],
      updatedAt: ts,
    });
  }
}

/**
 * Seleção individual das rotinas do equipamento para incluir na OS. Mostra a situação de
 * cada rotina (vencida / a vencer), as que já estão nesta OS e as que estão em outra OS aberta;
 * estas, se ainda não lançadas, podem ser transferidas para esta OS.
 */
export function IncluirRotinasModal({ open, equipamentoId, osId, osNumero, usuario, checklist, onClose, onIncluir }: {
  open: boolean;
  equipamentoId: string;
  osId: string;
  osNumero: string;
  usuario?: string;
  checklist: ItemChecklist[];
  onClose: () => void;
  onIncluir: (rotinas: Rotina[]) => void;
}) {
  const hoje = todayStr();
  const rotinas = useLiveQuery(() => (open ? db.rotinas.where('equipamentoId').equals(equipamentoId).toArray() : []), [open, equipamentoId]) || [];
  const outras = useLiveQuery(() => (open ? outrasOSAbertas(equipamentoId, osId) : []), [open, osId, equipamentoId]) || [];
  const emOutra = useMemo(() => mapaOutrasOS(outras), [outras]);
  const nestaOS = useMemo(() => new Set(checklist.map((c) => c.rotinaId).filter(Boolean)), [checklist]);
  const ativas = rotinas.filter((r) => r.ativa && r.equipamentoId === equipamentoId).sort((a, b) => a.proximaExecucao.localeCompare(b.proximaExecucao) || (a.ordem ?? 0) - (b.ordem ?? 0));
  const selecionavel = (r: Rotina) => !nestaOS.has(r.id) && !emOutra.get(r.id)?.lancada;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (open) {
      setSel(new Set());
      setBusca('');
    }
  }, [open, equipamentoId]);

  const visiveis = ativas.filter((r) => !busca || `${r.descricao} ${r.grupo}`.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => Number(!selecionavel(a)) - Number(!selecionavel(b)));
  const escolhidas = ativas.filter((r) => sel.has(r.id) && selecionavel(r));
  const transferir = escolhidas.filter((r) => emOutra.has(r.id));
  const marcar = (filtro: (r: Rotina) => boolean) => setSel(new Set(ativas.filter((r) => selecionavel(r) && filtro(r)).map((r) => r.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const incluir = async () => {
    setOcupado(true);
    try {
      if (transferir.length) await transferirRotinas(transferir.map((r) => ({ rotina: r, ...emOutra.get(r.id)! })), osNumero, usuario);
      onIncluir(escolhidas);
      onClose();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Incluir rotinas do equipamento"
      footer={
        <Button icon={<ClipboardList size={16} />} disabled={!escolhidas.length || ocupado} onClick={incluir}>
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
              const pode = selecionavel(r);
              const pz = prazoRotina(r.proximaExecucao, hoje);
              return (
                <tr key={r.id} className={cx('border-t border-slate-100 dark:border-slate-800', !pode && 'opacity-60')}>
                  <td className="px-2 py-1.5">
                    <input type="checkbox" aria-label={r.descricao} disabled={!pode} checked={aqui || sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <label className="cursor-pointer" onClick={() => pode && toggle(r.id)}>
                      {r.descricao}
                      <span className="block text-[11px] text-slate-500">{[r.grupo, r.tempoMin ? `${r.tempoMin} min` : ''].filter(Boolean).join(' · ')}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{periodicidadeLabel(r.periodicidade)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                    {aqui ? (
                      <Badge>Já nesta OS</Badge>
                    ) : outra ? (
                      <Badge className={outra.lancada ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'}>
                        {outra.lancada ? `Já lançada na OS ${outra.numero}` : `Na OS ${outra.numero} · será transferida`}
                      </Badge>
                    ) : (
                      <Badge className={pz.cls}>{fmtDate(r.proximaExecucao)} · {pz.texto}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visiveis.length && <tr><td colSpan={4} className="p-4 text-center text-slate-500">{ativas.length ? 'Nenhuma rotina encontrada.' : 'Equipamento sem rotinas ativas. Aplique um plano na ficha do equipamento.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {escolhidas.length} selecionada(s) · {fmtHoras(escolhidas.reduce((a, r) => a + (r.tempoMin || 0), 0) / 60)} previstas.
        {transferir.length > 0 && <b className="text-blue-700 dark:text-blue-300"> {transferir.length} sairão da outra OS e passarão para esta.</b>}
        {' '}Rotinas já lançadas em outra OS não podem ser repetidas.
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
