import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRange, ChevronDown, ChevronRight, Printer, Wand2 } from 'lucide-react';
import { db } from '../db/db';
import type { Rotina } from '../db/types';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Toggle, cx, useConfirm, useToast } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { useSessao } from '../lib/sessao';
import { OS_FINALIZADAS, SETORES } from '../lib/catalogs';
import { MESES, MESES_CURTOS, addDays, dateStr, fmtDate, fmtHoras, todayStr } from '../lib/format';
import { gerarPreventivas, type Agrupamento } from '../lib/preventivas';
import { projetar } from '../lib/rotinas';
import { imprimir } from '../lib/env';

type Marca = 'E' | 'N' | 'P' | '!' | 'R' | 'X' | '';

const MARCAS: Record<Exclude<Marca, ''>, { cls: string; label: string }> = {
  X: { cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200', label: 'Previsto (pela periodicidade)' },
  P: { cls: 'bg-indigo-600 text-white', label: 'Programado (OS gerada)' },
  R: { cls: 'bg-amber-400 text-amber-950', label: 'Reprogramado' },
  E: { cls: 'bg-emerald-600 text-white', label: 'Executado' },
  N: { cls: 'bg-rose-100 text-rose-800 ring-1 ring-rose-400 dark:bg-rose-950 dark:text-rose-200', label: 'Não executado' },
  '!': { cls: 'bg-rose-600 text-white', label: 'Vencido' },
};

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const POR_PAGINA = 25;

export default function Cronograma() {
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const { pode } = useSessao();
  const [params] = useSearchParams();
  const pmocParam = l.pmocMap.get(params.get('pmoc') || '');
  const hoje = new Date();
  const hojeStr = todayStr();
  const [unidadeId, setUnidadeId] = useState(params.get('unidade') || pmocParam?.unidadeId || '');
  const [equipId, setEquipId] = useState(params.get('equipamento') || '');
  const [setor, setSetor] = useState('');
  const [visao, setVisao] = useState<'diaria' | 'anual'>('diaria');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes0, setMes0] = useState(hoje.getMonth());
  const [soPrevistas, setSoPrevistas] = useState(true);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(0);
  const [gen, setGen] = useState(false);

  const unidade = l.unidadeMap.get(unidadeId) || l.unidades.find((u) => l.pmocs.some((p) => p.unidadeId === u.id && p.status === 'vigente')) || l.unidades[0];
  const de = visao === 'diaria' ? dateStr(new Date(ano, mes0, 1)) : `${ano}-01-01`;
  const ate = visao === 'diaria' ? dateStr(new Date(ano, mes0 + 1, 0)) : `${ano}-12-31`;
  const cols = useMemo(() => {
    if (visao === 'anual') return MESES_CURTOS.map((m, i) => ({ key: `${ano}-${String(i + 1).padStart(2, '0')}`, label: m, sub: '', fds: false }));
    const n = new Date(ano, mes0 + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(ano, mes0, i + 1);
      return { key: dateStr(d), label: String(i + 1).padStart(2, '0'), sub: DIAS_SEMANA[d.getDay()], fds: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, [visao, ano, mes0]);

  const rotinas = useLiveQuery(() => db.rotinas.toArray(), []) || [];
  const execs = useLiveQuery(() => db.execucoes.where('data').between(de, ate, true, true).toArray(), [de, ate]) || [];
  const abertas = useLiveQuery(() => db.os.filter((o) => !OS_FINALIZADAS.includes(o.status)).toArray(), []) || [];

  const programadas = useMemo(() => {
    const m = new Map<string, { data: string; numero: string }[]>();
    for (const o of abertas)
      for (const it of o.equipamentos)
        for (const c of it.checklist) if (c.rotinaId) (m.get(c.rotinaId) || m.set(c.rotinaId, []).get(c.rotinaId)!).push({ data: o.dataAgendada || o.dataAbertura.slice(0, 10), numero: o.numero });
    return m;
  }, [abertas]);
  const execPorRotina = useMemo(() => {
    const m = new Map<string, typeof execs>();
    for (const e of execs) (m.get(e.rotinaId) || m.set(e.rotinaId, []).get(e.rotinaId)!).push(e);
    return m;
  }, [execs]);

  const chave = (d: string) => (visao === 'diaria' ? d : d.slice(0, 7));

  const marcar = (r: Rotina): Record<string, { m: Marca; n: number }> => {
    const out: Record<string, { m: Marca; n: number }> = {};
    const prio: Marca[] = ['E', 'N', 'P', '!', 'R', 'X', ''];
    const put = (d: string, m: Marca) => {
      const k = chave(d);
      const atual = out[k];
      if (!atual) out[k] = { m, n: 1 };
      else {
        atual.n++;
        if (prio.indexOf(m) < prio.indexOf(atual.m)) atual.m = m;
      }
    };
    for (const d of projetar(r, de, ate)) put(d, d === r.proximaExecucao && d < hojeStr ? '!' : d === r.proximaExecucao && r.reprogramada ? 'R' : 'X');
    for (const p of programadas.get(r.id) || []) if (p.data >= de && p.data <= ate) put(p.data, 'P');
    for (const e of execPorRotina.get(r.id) || []) put(e.data, e.status === 'E' ? 'E' : e.status === 'N' ? 'N' : 'P');
    return out;
  };

  const equips = l.equipamentos.filter((e) => e.unidadeId === unidade?.id && e.status !== 'desativado' && (!equipId || e.id === equipId));
  const porEquip = useMemo(() => {
    const m = new Map<string, Rotina[]>();
    for (const r of rotinas) if (r.ativa && (!setor || r.setor === setor)) (m.get(r.equipamentoId) || m.set(r.equipamentoId, []).get(r.equipamentoId)!).push(r);
    for (const arr of m.values()) arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return m;
  }, [rotinas, setor]);

  const linhas = useMemo(
    () =>
      equips
        .map((e) => ({
          e,
          rows: (porEquip.get(e.id) || []).map((r) => ({ r, marcas: marcar(r) })).filter((x) => !soPrevistas || Object.keys(x.marcas).length || x.r.proximaExecucao < hojeStr),
        }))
        .filter((g) => g.rows.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [equips, porEquip, de, ate, programadas, execPorRotina, soPrevistas, visao],
  );

  const daUnidade = rotinas.filter((r) => r.ativa && equips.some((e) => e.id === r.equipamentoId));
  const vencidas = daUnidade.filter((r) => r.proximaExecucao < hojeStr).length;
  const aVencer = daUnidade.filter((r) => r.proximaExecucao >= hojeStr && r.proximaExecucao <= addDays(hojeStr, 7)).length;
  const execE = execs.filter((x) => x.status === 'E' && equips.some((e) => e.id === x.equipamentoId)).length;
  const execN = execs.filter((x) => x.status === 'N' && equips.some((e) => e.id === x.equipamentoId)).length;
  const totPorCol = cols.map((c) => linhas.reduce((a, g) => a + g.rows.reduce((s, x) => s + (x.marcas[c.key] && ['X', 'R', '!', 'P'].includes(x.marcas[c.key].m) ? (x.r.tempoMin || 0) * x.marcas[c.key].n : 0), 0), 0));
  const pageLinhas = linhas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));

  const reprogramar = async (r: Rotina, dia: string) => {
    if (visao !== 'diaria' || !pode('gerir_os')) return;
    const eq = l.equipamentoMap.get(r.equipamentoId);
    if (!(await confirm({ title: 'Reprogramar rotina', message: `Reprogramar a próxima execução de "${r.descricao}" (${eq?.tag}) de ${fmtDate(r.proximaExecucao)} para ${fmtDate(dia)}?`, confirmText: 'Reprogramar' }))) return;
    await db.rotinas.update(r.id, { proximaExecucao: dia, reprogramada: true, updatedAt: new Date().toISOString() });
    toast('Rotina reprogramada.');
  };

  return (
    <div>
      <PageHeader
        title="Cronograma de manutenção por equipamento"
        subtitle="Previsão pela periodicidade de cada rotina, programado (OS gerada), executado e vencido"
        icon={<CalendarRange size={20} />}
        actions={
          <>
            <Button variant="outline" icon={<Printer size={16} />} onClick={imprimir}>Imprimir</Button>
            {pode('gerir_os') && <Button icon={<Wand2 size={16} />} onClick={() => setGen(true)}>Gerar OS preventivas</Button>}
          </>
        }
      />
      <Card className="mb-4 print:hidden" bodyClass="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Unidade" className="min-w-[220px] flex-1">
            <Select value={unidade?.id || ''} onChange={(e) => { setUnidadeId(e.target.value); setEquipId(''); setPagina(0); }}>
              {l.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>
          <Field label="Equipamento" className="min-w-[200px] flex-1">
            <Select value={equipId} onChange={(e) => { setEquipId(e.target.value); setPagina(0); }}>
              <option value="">Todos</option>
              {l.equipamentos.filter((e) => e.unidadeId === unidade?.id).map((e) => <option key={e.id} value={e.id}>{e.tag} · {e.tipo}</option>)}
            </Select>
          </Field>
          <Field label="Setor executante">
            <Select value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Todos</option>
              {SETORES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Visão">
            <Select value={visao} onChange={(e) => setVisao(e.target.value as 'diaria' | 'anual')}>
              <option value="diaria">Previsão diária (mês)</option>
              <option value="anual">Anual (meses)</option>
            </Select>
          </Field>
          {visao === 'diaria' && (
            <Field label="Mês">
              <Select value={mes0} onChange={(e) => setMes0(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Ano">
            <Input type="number" className="w-24" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </Field>
          <Toggle checked={soPrevistas} onChange={setSoPrevistas} label="Só rotinas com movimento" />
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Rotinas ativas" value={daUnidade.length} hint={`${equips.length} equipamento(s)`} />
        <Stat label="Vencidas" value={vencidas} tone={vencidas ? 'red' : 'green'} />
        <Stat label="A vencer (7 dias)" value={aVencer} tone="amber" />
        <Stat label="Executadas no período" value={execE} tone="green" hint={execN ? `${execN} não executada(s)` : undefined} />
        <Stat label="Horas previstas no período" value={fmtHoras(totPorCol.reduce((a, b) => a + b, 0) / 60)} tone="violet" />
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(MARCAS).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cx('inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', v.cls)}>{k}</span>
            {v.label}
          </span>
        ))}
        {visao === 'diaria' && pode('gerir_os') && <span className="text-slate-500">· Clique em um dia vazio para reprogramar a próxima execução da rotina.</span>}
      </div>

      <Card bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="sticky left-0 z-10 min-w-[260px] bg-slate-50 px-2 py-1.5 text-left dark:bg-slate-800">Rotina / plano de manutenção</th>
                <th className="px-1.5 py-1.5 text-left">Últ. exec.</th>
                <th className="px-1.5 py-1.5">Per.</th>
                <th className="px-1.5 py-1.5 text-left">Setor</th>
                <th className="px-1.5 py-1.5">Exec.</th>
                {cols.map((c) => (
                  <th key={c.key} className={cx('w-7 px-0 py-1 text-center font-semibold', c.fds && 'bg-slate-100 dark:bg-slate-700/60', c.key === hojeStr && 'text-brand-700 dark:text-brand-300')}>
                    {c.label}
                    {c.sub && <span className="block text-[9px] font-normal text-slate-500">{c.sub}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageLinhas.map(({ e, rows }) => {
                const fechado = fechados.has(e.id);
                const venc = rows.filter((x) => x.r.proximaExecucao < hojeStr).length;
                return (
                  <FragmentRows key={e.id}>
                    <tr className="border-t-2 border-slate-200 bg-brand-50/60 dark:border-slate-700 dark:bg-brand-950/40">
                      <td colSpan={5 + cols.length} className="px-2 py-1.5">
                        <button className="flex items-center gap-1.5 text-left font-semibold text-brand-900 dark:text-brand-100" onClick={() => setFechados((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}>
                          {fechado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          Aplicação: {e.tag} — {e.tipo} {e.marca} {e.capacidadeBtu ? `${(e.capacidadeBtu / 1000).toLocaleString('pt-BR')}k BTU` : ''} · {l.ambienteMap.get(e.ambienteId || '')?.nome}
                          <Badge className="ml-1">{rows.length} rotina(s)</Badge>
                          {venc > 0 && <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">{venc} vencida(s)</Badge>}
                        </button>
                        <Link to={`/equipamentos/${e.id}`} className="ml-6 text-[11px] text-brand-700 hover:underline dark:text-brand-300">ficha e plano do equipamento</Link>
                      </td>
                    </tr>
                    {!fechado &&
                      rows.map(({ r, marcas }) => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                          <td className="sticky left-0 bg-white px-2 py-1 dark:bg-slate-900" title={r.grupo}>
                            {r.descricao}
                          </td>
                          <td className={cx('whitespace-nowrap px-1.5 py-1', r.proximaExecucao < hojeStr && 'font-semibold text-rose-600')} title={`Próxima: ${fmtDate(r.proximaExecucao)}`}>
                            {r.ultimaExecucao ? fmtDate(r.ultimaExecucao) : '—'}
                          </td>
                          <td className="px-1.5 py-1 text-center tabular-nums">{r.intervaloDias}</td>
                          <td className="whitespace-nowrap px-1.5 py-1">{r.setor}</td>
                          <td className="px-1.5 py-1 text-center tabular-nums">{fmtHoras((r.tempoMin || 0) / 60)}</td>
                          {cols.map((c) => {
                            const mk = marcas[c.key];
                            return (
                              <td key={c.key} className={cx('px-0 py-0.5 text-center', c.fds && 'bg-slate-50 dark:bg-slate-800/40')}>
                                {mk ? (
                                  <span title={`${MARCAS[mk.m as Exclude<Marca, ''>].label}${mk.n > 1 ? ` (${mk.n}×)` : ''}`} className={cx('inline-flex h-5 w-6 items-center justify-center rounded text-[10px] font-bold', MARCAS[mk.m as Exclude<Marca, ''>].cls)}>
                                    {visao === 'anual' && mk.n > 1 && mk.m === 'X' ? mk.n : mk.m}
                                  </span>
                                ) : visao === 'diaria' && pode('gerir_os') ? (
                                  <button type="button" aria-label={`Reprogramar para ${fmtDate(c.key)}`} className="h-5 w-6 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40" onClick={() => reprogramar(r, c.key)} />
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </FragmentRows>
                );
              })}
              {linhas.length === 0 && (
                <tr><td colSpan={5 + cols.length} className="p-8 text-center text-slate-500">Nenhuma rotina no período. Verifique se os equipamentos têm plano de manutenção aplicado.</td></tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                  <td className="sticky left-0 bg-slate-50 px-2 py-1.5 dark:bg-slate-800" colSpan={5}>Tempo previsto (h) — todas as páginas</td>
                  {totPorCol.map((m, i) => <td key={i} className="px-0 py-1.5 text-center text-[10px] tabular-nums">{m ? (m / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : ''}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {paginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
            <span>{linhas.length} equipamento(s) com rotinas</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
              <span>{pagina + 1}/{paginas}</span>
              <Button size="sm" variant="outline" disabled={pagina >= paginas - 1} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      <GerarModal open={gen} onClose={() => setGen(false)} unidadeId={unidade?.id} de={visao === 'diaria' ? de : dateStr(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} ate={visao === 'diaria' ? ate : dateStr(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))} />
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function GerarModal({ open, onClose, unidadeId, de, ate }: { open: boolean; onClose: () => void; unidadeId?: string; de: string; ate: string }) {
  const l = useLookups();
  const toast = useToast();
  const [g, setG] = useState({ de, ate, agrupamento: 'equipamento' as Agrupamento, todas: false, responsavelId: '', tecnicosIds: [] as string[], setor: '', data: '' });
  const [preview, setPreview] = useState<{ n: number; rotinas: number; ja: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    setG((x) => ({ ...x, de, ate }));
    setPreview(null);
  }, [open, de, ate]);

  const unidadesAlvo = g.todas ? [...new Set(l.pmocs.filter((p) => p.status === 'vigente').map((p) => p.unidadeId))] : unidadeId ? [unidadeId] : [];
  const params = () => ({ unidadeIds: unidadesAlvo, de: g.de, ate: g.ate, agrupamento: g.agrupamento, responsavelId: g.responsavelId || undefined, tecnicosIds: g.tecnicosIds.length ? g.tecnicosIds : undefined, setor: g.setor || undefined, dataAgendada: g.data || undefined });
  const simular = async () => {
    const r = await gerarPreventivas({ ...params(), dryRun: true });
    setPreview({ n: r.criadas.length, rotinas: r.rotinas, ja: r.jaProgramadas });
  };
  const gerar = async () => {
    const r = await gerarPreventivas(params());
    toast(`${r.criadas.length} OS preventiva(s) gerada(s) com ${r.rotinas} rotina(s).${r.jaProgramadas ? ` ${r.jaProgramadas} já estavam programadas.` : ''}`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Gerar OS preventivas pelas rotinas dos equipamentos" size="md" footer={<><Button variant="outline" onClick={simular}>Simular</Button><Button onClick={gerar}>Gerar OS</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <p className="col-span-2 text-xs text-slate-500">Entram as rotinas com próxima execução até a data final (inclusive as vencidas). Rotinas que já estão em OS aberta não são duplicadas.</p>
        <Field label="De"><Input type="date" value={g.de} onChange={(e) => setG({ ...g, de: e.target.value })} /></Field>
        <Field label="Até"><Input type="date" value={g.ate} onChange={(e) => setG({ ...g, ate: e.target.value })} /></Field>
        <Field label="Agrupamento" className="col-span-2">
          <Select value={g.agrupamento} onChange={(e) => setG({ ...g, agrupamento: e.target.value as Agrupamento })}>
            <option value="equipamento">Uma OS por equipamento (recomendado)</option>
            <option value="ambiente">Uma OS por ambiente</option>
            <option value="unidade">Uma OS por unidade</option>
          </Select>
        </Field>
        <Field label="Data agendada" help="Vazio = data prevista de cada equipamento">
          <Input type="date" value={g.data} onChange={(e) => setG({ ...g, data: e.target.value })} />
        </Field>
        <Field label="Setor executante">
          <Select value={g.setor} onChange={(e) => setG({ ...g, setor: e.target.value })}>
            <option value="">Pelas rotinas</option>
            {SETORES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Responsável" className="col-span-2">
          <Select value={g.responsavelId} onChange={(e) => setG({ ...g, responsavelId: e.target.value, tecnicosIds: e.target.value ? [...new Set([...g.tecnicosIds, e.target.value])] : g.tecnicosIds })}>
            <option value="">— selecione —</option>
            {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={g.todas} onChange={(e) => setG({ ...g, todas: e.target.checked })} /> Todas as unidades com PMOC vigente (senão, apenas {l.unidadeMap.get(unidadeId || '')?.nome})
        </label>
        {preview && (
          <p className="col-span-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-200">
            Serão criadas <b>{preview.n}</b> OS com <b>{preview.rotinas}</b> rotina(s).{preview.ja > 0 && ` ${preview.ja} rotina(s) já estão em OS aberta.`}
          </p>
        )}
      </div>
    </Modal>
  );
}
