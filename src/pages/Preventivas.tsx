import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck2, CalendarClock, CheckCheck, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, FileText, HardHat, Play, Printer, ShieldCheck, Wand2 } from 'lucide-react';
import { db } from '../db/db';
import type { OS, Rotina } from '../db/types';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, cx, useConfirm, useToast } from '../components/ui';
import { ProgramarPreventivaModal, prazoRotina } from '../components/ProgramarPreventiva';
import { useLookups } from '../lib/lookups';
import { assinaturaUsuario, useSessao } from '../lib/sessao';
import { OS_FINALIZADAS, statusOs } from '../lib/catalogs';
import { addDays, fmtDate, fmtDateTime, fmtHoras, todayStr } from '../lib/format';
import { contagemTarefas, isAtrasada, liberarOS, reprogramarOS, tempoPrevisto } from '../lib/osHelpers';
import { gerarPreventivas, programarRotinas } from '../lib/preventivas';
import { MARCAS } from '../lib/marcas';

type Etapa = 'programar' | 'programadas' | 'execucao' | 'liberacao' | 'liberadas';
const EM_EXECUCAO = ['em_execucao', 'pausada', 'aguardando_peca'];
const ehPreventiva = (o: OS) => o.origem === 'preventiva' || o.tipo === 'Preventiva';
const GUIA_KEY = 'pmoc-guia-preventivas';

interface Pendente {
  eqId: string;
  rotinas: Rotina[];
  proxima: string;
  tempo: number;
}

export default function Preventivas() {
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { usuario, pode } = useSessao();
  const [params, setParams] = useSearchParams();
  const hoje = todayStr();
  const etapa = (params.get('etapa') as Etapa) || 'programar';
  const setEtapa = (e: Etapa) => setParams((p) => { p.set('etapa', e); return p; }, { replace: true });
  const [unidadeId, setUnidadeId] = useState('');
  const [horizonte, setHorizonte] = useState(15);
  const [tecnico, setTecnico] = useState(usuario.perfil === 'tecnico' ? usuario.profissionalId || '' : '');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modalEq, setModalEq] = useState<string>();
  const [lote, setLote] = useState(false);
  const [guia, setGuia] = useState(() => {
    try {
      return localStorage.getItem(GUIA_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const alternarGuia = () => {
    setGuia((g) => {
      try {
        localStorage.setItem(GUIA_KEY, g ? '0' : '1');
      } catch {
        /* armazenamento indisponível */
      }
      return !g;
    });
  };

  const rotinas = useLiveQuery(() => db.rotinas.filter((r) => r.ativa).toArray(), []) || [];
  const osList = useLiveQuery(() => db.os.filter(ehPreventiva).toArray(), []) || [];
  const limite = addDays(hoje, horizonte);

  const eqOk = useMemo(() => new Set(l.equipamentos.filter((e) => e.status !== 'desativado' && (!unidadeId || e.unidadeId === unidadeId)).map((e) => e.id)), [l.equipamentos, unidadeId]);
  const programadasIds = useMemo(() => {
    const s = new Set<string>();
    for (const o of osList) if (!OS_FINALIZADAS.includes(o.status)) for (const it of o.equipamentos) for (const c of it.checklist) if (c.rotinaId) s.add(c.rotinaId);
    return s;
  }, [osList]);

  const pendentes = useMemo<Pendente[]>(() => {
    const m = new Map<string, Pendente>();
    for (const r of rotinas) {
      if (!eqOk.has(r.equipamentoId) || programadasIds.has(r.id) || r.proximaExecucao > limite) continue;
      const p = m.get(r.equipamentoId) || { eqId: r.equipamentoId, rotinas: [], proxima: r.proximaExecucao, tempo: 0 };
      p.rotinas.push(r);
      p.tempo += r.tempoMin || 0;
      if (r.proximaExecucao < p.proxima) p.proxima = r.proximaExecucao;
      m.set(r.equipamentoId, p);
    }
    return [...m.values()].sort((a, b) => a.proxima.localeCompare(b.proxima));
  }, [rotinas, eqOk, programadasIds, limite]);

  const doTecnico = (o: OS) => !tecnico || o.responsavelId === tecnico || o.tecnicosIds.includes(tecnico);
  const daUnidade = (o: OS) => !unidadeId || o.unidadeId === unidadeId;
  const filtradas = osList.filter((o) => daUnidade(o) && doTecnico(o));
  const programadas = filtradas.filter((o) => ['aberta', 'agendada'].includes(o.status)).sort((a, b) => (a.dataAgendada || '').localeCompare(b.dataAgendada || ''));
  const emExecucao = filtradas.filter((o) => EM_EXECUCAO.includes(o.status));
  const aguardando = filtradas.filter((o) => o.status === 'concluida').sort((a, b) => (a.fim || '').localeCompare(b.fim || ''));
  const liberadas = filtradas.filter((o) => o.status === 'validada' && (o.liberacao || o.fim || '').slice(0, 10) >= addDays(hoje, -30)).sort((a, b) => (b.liberacao || '').localeCompare(a.liberacao || ''));
  const vencidas = pendentes.filter((p) => p.proxima < hoje).length;

  const ETAPAS: { key: Etapa; n: number; titulo: string; desc: string; icon: ReactNode; tone: string }[] = [
    { key: 'programar', n: pendentes.length, titulo: 'A programar', desc: `Equipamentos com rotinas vencidas ou que vencem em ${horizonte} dias, sem OS`, icon: <CalendarClock size={18} />, tone: vencidas ? 'text-red-600' : 'text-slate-700 dark:text-slate-200' },
    { key: 'programadas', n: programadas.length, titulo: 'Programadas', desc: 'OS geradas, aguardando o técnico', icon: <ClipboardList size={18} />, tone: 'text-blue-600' },
    { key: 'execucao', n: emExecucao.length, titulo: 'Em execução', desc: 'Técnico lançando E / P / N', icon: <HardHat size={18} />, tone: 'text-amber-600' },
    { key: 'liberacao', n: aguardando.length, titulo: 'Aguardando liberação', desc: 'Supervisor confere e libera', icon: <ClipboardCheck size={18} />, tone: 'text-violet-600' },
    { key: 'liberadas', n: liberadas.length, titulo: 'Liberadas (30 dias)', desc: 'Próxima data recalculada', icon: <ShieldCheck size={18} />, tone: 'text-green-600' },
  ];

  const executarAgora = async (p: Pendente) => {
    const os = await programarRotinas({ equipamentoId: p.eqId, rotinaIds: p.rotinas.map((r) => r.id), data: hoje, responsavelId: usuario.profissionalId || tecnico || undefined, usuario: assinaturaUsuario(usuario) });
    if (os) navigate(`/campo/os/${os.id}`);
  };
  const liberar = async (o: OS) => {
    const c = contagemTarefas(o);
    if (c.N && !(await confirm({ title: 'Liberar OS', message: `A OS ${o.numero} tem ${c.N} tarefa(s) não executada(s). Essas rotinas continuam vencidas e voltam para "A programar". Liberar mesmo assim?`, confirmText: 'Liberar' }))) return;
    await liberarOS(o, usuario.profissionalId, assinaturaUsuario(usuario));
    toast(`OS ${o.numero} liberada.`);
  };
  const liberarTodas = async () => {
    if (!(await confirm({ title: 'Liberar OS', message: `Liberar as ${aguardando.length} OS preventivas aguardando liberação?`, confirmText: 'Liberar todas' }))) return;
    for (const o of aguardando) await liberarOS(o, usuario.profissionalId, assinaturaUsuario(usuario));
    toast(`${aguardando.length} OS liberada(s).`);
  };
  const atribuir = async (o: OS, id: string) => {
    await db.os.update(o.id, { responsavelId: id || undefined, tecnicosIds: id ? [...new Set([id, ...o.tecnicosIds.filter((t) => t !== o.responsavelId)])] : o.tecnicosIds.filter((t) => t !== o.responsavelId), updatedAt: new Date().toISOString() });
  };

  return (
    <div>
      <PageHeader
        title="Preventivas"
        subtitle="Programe, execute e libere as manutenções preventivas de cada equipamento, em um só lugar"
        icon={<CalendarCheck2 size={20} />}
        actions={
          <>
            <Link to="/cronograma"><Button variant="outline" icon={<FileText size={16} />}>Cronograma</Button></Link>
            <Button variant="ghost" onClick={alternarGuia}>{guia ? 'Ocultar guia' : 'Como funciona?'}</Button>
          </>
        }
      />

      {guia && (
        <Card className="mb-4" bodyClass="p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Como funciona a preventiva (por equipamento)</p>
          <ol className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4 dark:text-slate-300">
            <li><b className="text-slate-900 dark:text-white">1. Rotinas automáticas.</b> Cada equipamento recebe as rotinas do seu plano (ex.: limpar filtros a cada 30 dias). O sistema calcula a próxima data de cada rotina.</li>
            <li><b className="text-slate-900 dark:text-white">2. Programar.</b> Em <i>A programar</i> aparecem os equipamentos com rotinas vencidas ou a vencer. Clique em <i>Programar</i> (gera a OS com data e técnico) ou em <i>Executar agora</i>.</li>
            <li><b className="text-slate-900 dark:text-white">3. Executar.</b> O técnico abre a OS no celular, faz o check-in e marca cada rotina como <b>E</b> executada, <b>P</b> pendente ou <b>N</b> não executada (com motivo) e finaliza.</li>
            <li><b className="text-slate-900 dark:text-white">4. Liberar.</b> O supervisor confere e libera. A rotina executada ganha nova data (última execução + intervalo); a não executada volta para <i>A programar</i>.</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            No cronograma e no documento PMOC:
            {(['P', 'R', 'E', 'N'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={cx('inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold', MARCAS[k].cls)}>{k}</span>{MARCAS[k].label}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {ETAPAS.map((e, i) => (
          <button
            key={e.key}
            type="button"
            onClick={() => setEtapa(e.key)}
            className={cx(
              'relative rounded-xl border bg-white p-3 text-left shadow-sm transition dark:bg-slate-900',
              etapa === e.key ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700',
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] dark:bg-slate-800">{i + 1}</span>
              {e.titulo}
            </span>
            <span className={cx('mt-1 flex items-center gap-2 text-2xl font-bold', e.tone)}>{e.icon}{e.n}</span>
            <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">{e.desc}</span>
            {e.key === 'programar' && vencidas > 0 && <Badge className="absolute right-2 top-2 bg-red-600 text-white">{vencidas} vencido(s)</Badge>}
          </button>
        ))}
      </div>

      <Card className="mb-4" bodyClass="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Unidade" className="min-w-[200px] flex-1">
            <Select value={unidadeId} onChange={(e) => { setUnidadeId(e.target.value); setSel(new Set()); }}>
              <option value="">Todas</option>
              {l.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>
          {etapa === 'programar' ? (
            <Field label="Mostrar o que vence em até">
              <Select value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}>
                {[0, 7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{d === 0 ? 'Só vencidas e hoje' : `${d} dias`}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Técnico">
              <Select value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
                <option value="">Todos</option>
                {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
          )}
          {etapa === 'programar' && pode('gerir_os') && (
            <Button icon={<Wand2 size={16} />} disabled={!sel.size} onClick={() => setLote(true)}>Programar selecionados ({sel.size})</Button>
          )}
          {etapa === 'liberacao' && pode('liberar') && aguardando.length > 1 && (
            <Button variant="success" icon={<CheckCheck size={16} />} onClick={liberarTodas}>Liberar todas ({aguardando.length})</Button>
          )}
        </div>
      </Card>

      {etapa === 'programar' && (
        <ListaProgramar
          pendentes={pendentes}
          hoje={hoje}
          sel={sel}
          setSel={setSel}
          podeProgramar={pode('gerir_os')}
          onAbrir={setModalEq}
          onExecutar={executarAgora}
        />
      )}
      {etapa === 'programadas' && (
        <ListaOS
          lista={programadas}
          vazio="Nenhuma OS preventiva programada. Programe em “A programar”."
          coluna={(o) => <DataProgramada os={o} hoje={hoje} podeReprogramar={pode('gerir_os')} />}
          acoes={(o) => (
            <>
              {pode('gerir_os') ? (
                <Select className="w-40 py-1 text-xs" value={o.responsavelId || ''} onChange={(e) => atribuir(o, e.target.value)} aria-label="Técnico responsável">
                  <option value="">Sem técnico</option>
                  {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Select>
              ) : (
                <span className="text-xs text-slate-500">{l.profissionalMap.get(o.responsavelId || '')?.nome || 'Sem técnico'}</span>
              )}
              <Link to={`/os/${o.id}/imprimir?branco=1`}><Button size="sm" variant="outline" icon={<Printer size={14} />}>Formulário</Button></Link>
              <Link to={`/campo/os/${o.id}`}><Button size="sm" variant="success" icon={<Play size={14} />}>Executar</Button></Link>
            </>
          )}
        />
      )}
      {etapa === 'execucao' && (
        <ListaOS
          lista={emExecucao}
          vazio="Nenhuma preventiva em execução."
          coluna={(o) => <Progresso os={o} />}
          acoes={(o) => (
            <>
              <span className="text-xs text-slate-500">{l.profissionalMap.get(o.responsavelId || '')?.nome}</span>
              <Link to={`/campo/os/${o.id}`}><Button size="sm" icon={<HardHat size={14} />}>Continuar lançamento</Button></Link>
            </>
          )}
        />
      )}
      {etapa === 'liberacao' && (
        <ListaOS
          lista={aguardando}
          vazio="Nenhuma OS aguardando liberação."
          coluna={(o) => <Progresso os={o} />}
          acoes={(o) => (
            <>
              <span className="text-xs text-slate-500">Concluída {fmtDateTime(o.fim)}</span>
              <Link to={`/os/${o.id}`}><Button size="sm" variant="outline">Conferir</Button></Link>
              {pode('liberar') && <Button size="sm" variant="success" icon={<CheckCheck size={14} />} onClick={() => liberar(o)}>Liberar</Button>}
            </>
          )}
        />
      )}
      {etapa === 'liberadas' && (
        <ListaOS
          lista={liberadas}
          vazio="Nenhuma OS liberada nos últimos 30 dias."
          coluna={(o) => <Progresso os={o} />}
          acoes={(o) => (
            <>
              <span className="text-xs text-slate-500">Liberada {fmtDateTime(o.liberacao)}</span>
              <Link to={`/os/${o.id}/imprimir`}><Button size="sm" variant="outline" icon={<Printer size={14} />}>Imprimir</Button></Link>
            </>
          )}
        />
      )}

      <ProgramarPreventivaModal equipamentoId={modalEq} onClose={() => setModalEq(undefined)} horizonte={Math.max(horizonte, 15)} />
      <ProgramarLoteModal open={lote} onClose={() => setLote(false)} pendentes={pendentes.filter((p) => sel.has(p.eqId))} onFeito={() => { setSel(new Set()); setEtapa('programadas'); }} />
    </div>
  );
}

function ListaProgramar({ pendentes, hoje, sel, setSel, podeProgramar, onAbrir, onExecutar }: { pendentes: Pendente[]; hoje: string; sel: Set<string>; setSel: (s: Set<string>) => void; podeProgramar: boolean; onAbrir: (id: string) => void; onExecutar: (p: Pendente) => void }) {
  const l = useLookups();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [qtd, setQtd] = useState(50);
  if (!pendentes.length)
    return <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Tudo em dia: nenhuma rotina vencida ou a vencer no período escolhido sem OS.</p>;
  const todos = pendentes.every((p) => sel.has(p.eqId));
  return (
    <Card bodyClass="p-0">
      {podeProgramar && (
        <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
          <input type="checkbox" checked={todos} onChange={(e) => setSel(new Set(e.target.checked ? pendentes.map((p) => p.eqId) : []))} /> Selecionar todos ({pendentes.length})
        </label>
      )}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {pendentes.slice(0, qtd).map((p) => {
          const eq = l.equipamentoMap.get(p.eqId);
          const pz = prazoRotina(p.proxima, hoje);
          const aberto = abertos.has(p.eqId);
          return (
            <li key={p.eqId} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {podeProgramar && <input type="checkbox" aria-label={`Selecionar ${eq?.tag}`} checked={sel.has(p.eqId)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(p.eqId); else n.delete(p.eqId); setSel(n); }} />}
                <button type="button" className="flex min-w-0 flex-1 items-start gap-1.5 text-left" onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(p.eqId)) n.delete(p.eqId); else n.add(p.eqId); return n; })}>
                  {aberto ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-white">{eq?.tag}</span> <span className="text-slate-600 dark:text-slate-300">{eq?.tipo}</span>
                    <span className="block truncate text-xs text-slate-500">{l.unidadeMap.get(eq?.unidadeId || '')?.nome} · {l.ambienteMap.get(eq?.ambienteId || '')?.nome}</span>
                  </span>
                </button>
                <Badge className={pz.cls}>{pz.texto}</Badge>
                <span className="text-xs text-slate-500">{p.rotinas.length} rotina(s) · {fmtHoras(p.tempo / 60)}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" icon={<CalendarClock size={14} />} onClick={() => onAbrir(p.eqId)}>{podeProgramar ? 'Programar' : 'Detalhar'}</Button>
                  <Button size="sm" variant="success" icon={<Play size={14} />} onClick={() => onExecutar(p)}>Executar agora</Button>
                </div>
              </div>
              {aberto && (
                <ul className="ml-7 mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {p.rotinas.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-2">
                      <span className={cx('tabular-nums', r.proximaExecucao < hoje && 'font-semibold text-red-600')}>{fmtDate(r.proximaExecucao)}</span>
                      {r.reprogramada && <Badge className={MARCAS.R.cls}>Reprogramada</Badge>}
                      <span>{r.descricao}</span>
                      <span className="text-slate-400">· a cada {r.intervaloDias} dias</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {pendentes.length > qtd && (
        <div className="border-t border-slate-100 p-2 text-center dark:border-slate-800">
          <Button size="sm" variant="ghost" onClick={() => setQtd((q) => q + 50)}>Mostrar mais ({pendentes.length - qtd})</Button>
        </div>
      )}
    </Card>
  );
}

function ListaOS({ lista, vazio, coluna, acoes }: { lista: OS[]; vazio: string; coluna: (o: OS) => ReactNode; acoes: (o: OS) => ReactNode }) {
  const l = useLookups();
  const [qtd, setQtd] = useState(50);
  if (!lista.length) return <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{vazio}</p>;
  return (
    <Card bodyClass="p-0">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {lista.slice(0, qtd).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <Link to={`/os/${o.id}`} className="min-w-0 flex-1">
              <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{o.numero}</span>{' '}
              <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge>
              <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{o.titulo}</span>
              <span className="block truncate text-xs text-slate-500">{l.unidadeMap.get(o.unidadeId || '')?.nome} · {contagemTarefas(o).total} rotina(s) · prev. {fmtHoras(tempoPrevisto(o) / 60)}</span>
            </Link>
            {coluna(o)}
            <div className="flex flex-wrap items-center gap-1.5">{acoes(o)}</div>
          </li>
        ))}
      </ul>
      {lista.length > qtd && (
        <div className="border-t border-slate-100 p-2 text-center dark:border-slate-800">
          <Button size="sm" variant="ghost" onClick={() => setQtd((q) => q + 50)}>Mostrar mais ({lista.length - qtd})</Button>
        </div>
      )}
    </Card>
  );
}

function DataProgramada({ os, hoje, podeReprogramar }: { os: OS; hoje: string; podeReprogramar: boolean }) {
  const toast = useToast();
  const { usuario } = useSessao();
  const reprog = !!os.dataOriginal && os.dataOriginal !== os.dataAgendada;
  const atrasada = isAtrasada(os, hoje);
  const marca = atrasada ? MARCAS.N : reprog ? MARCAS.R : MARCAS.P;
  return (
    <div className="flex items-center gap-1.5">
      <Badge className={marca.cls}>{marca.label}{atrasada ? ' (atrasada)' : ''}</Badge>
      {podeReprogramar ? (
        <Input
          type="date"
          className="w-36 py-1 text-xs"
          aria-label="Reprogramar data"
          title="Alterar a data reprograma a OS (amarelo no cronograma)"
          value={os.dataAgendada || ''}
          onChange={async (e) => {
            if (!e.target.value) return;
            await reprogramarOS(os.id, e.target.value, assinaturaUsuario(usuario));
            toast(`OS ${os.numero} reprogramada para ${fmtDate(e.target.value)}.`);
          }}
        />
      ) : (
        <span className="text-xs tabular-nums">{fmtDate(os.dataAgendada)}</span>
      )}
    </div>
  );
}

function Progresso({ os }: { os: OS }) {
  const c = contagemTarefas(os);
  const pct = (n: number) => (c.total ? (n / c.total) * 100 : 0);
  return (
    <div className="w-44">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <span className="bg-green-600" style={{ width: `${pct(c.E)}%` }} />
        <span className="bg-amber-400" style={{ width: `${pct(c.P)}%` }} />
        <span className="bg-red-600" style={{ width: `${pct(c.N)}%` }} />
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">
        <b className="text-green-700 dark:text-green-400">{c.E} E</b> · <b className="text-amber-600">{c.P} P</b> · <b className="text-red-600">{c.N} N</b> · {c.vazias} sem lançamento
      </p>
    </div>
  );
}

function ProgramarLoteModal({ open, onClose, pendentes, onFeito }: { open: boolean; onClose: () => void; pendentes: Pendente[]; onFeito: () => void }) {
  const l = useLookups();
  const toast = useToast();
  const hoje = todayStr();
  const [modo, setModo] = useState<'prevista' | 'fixa'>('prevista');
  const [data, setData] = useState(hoje);
  const [resp, setResp] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const gerar = async () => {
    setOcupado(true);
    try {
      const porUnidade = new Map<string, string[]>();
      for (const p of pendentes) {
        const u = l.equipamentoMap.get(p.eqId)?.unidadeId;
        if (u) porUnidade.set(u, [...(porUnidade.get(u) || []), p.eqId]);
      }
      let criadas = 0;
      for (const [u, eqs] of porUnidade) {
        const r = await gerarPreventivas({
          unidadeIds: [u],
          equipamentoIds: eqs,
          rotinaIds: pendentes.filter((p) => eqs.includes(p.eqId)).flatMap((p) => p.rotinas.map((x) => x.id)),
          de: hoje,
          ate: hoje,
          agrupamento: 'equipamento',
          dataAgendada: modo === 'fixa' ? data : undefined,
          responsavelId: resp || undefined,
        });
        criadas += r.criadas.length;
      }
      toast(`${criadas} OS preventiva(s) programada(s).`);
      onClose();
      onFeito();
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="md" title={`Programar ${pendentes.length} equipamento(s)`} footer={<Button icon={<Wand2 size={16} />} disabled={!pendentes.length || ocupado} onClick={gerar}>Gerar OS</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">Será gerada uma OS por equipamento, com {pendentes.reduce((a, p) => a + p.rotinas.length, 0)} rotina(s) no total.</p>
        <Field label="Data das OS">
          <Select value={modo} onChange={(e) => setModo(e.target.value as 'prevista' | 'fixa')}>
            <option value="prevista">Data prevista de cada equipamento (vencidas = hoje)</option>
            <option value="fixa">Mesma data para todas</option>
          </Select>
        </Field>
        {modo === 'fixa' && (
          <Field label="Data">
            <Input type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
          </Field>
        )}
        <Field label="Técnico responsável">
          <Select value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">— definir depois —</option>
            {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
