import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCheck, ChevronDown, ChevronRight, ClipboardCheck, HardHat, MapPin, Pause, Play, Send, Wrench } from 'lucide-react';
import { db, nowIso } from '../db/db';
import type { OS } from '../db/types';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, cx, useConfirm, useToast } from '../components/ui';
import { PecasEditor, PhotoGallery, SignaturePad } from '../components/widgets';
import { MedicoesPanel, TaskRow, executarPendentes } from '../components/osParts';
import { useLookups, equipLabel } from '../lib/lookups';
import { useSessao, assinaturaUsuario } from '../lib/sessao';
import { OS_FINALIZADAS, prioridade, statusOs } from '../lib/catalogs';
import { addDays, fmtDate, fmtHoras, localDateTimeStr, todayStr } from '../lib/format';
import { comHistorico, concluirOS, contagemTarefas, horasTrabalhadas, isAtrasada, tempoPrevisto } from '../lib/osHelpers';
import { statusItem } from '../lib/rotinas';

/** Lista de OS do técnico logado (ou de um técnico escolhido pelo gestor). */
export function CampoHome() {
  const l = useLookups();
  const { usuario } = useSessao();
  const [tecnico, setTecnico] = useState(usuario.profissionalId || '');
  useEffect(() => setTecnico(usuario.profissionalId || ''), [usuario.profissionalId]);
  const osList = useLiveQuery(() => db.os.toArray(), []) || [];
  const hoje = todayStr();
  const minhas = osList.filter((o) => o.status !== 'cancelada' && (!tecnico || o.responsavelId === tecnico || o.tecnicosIds.includes(tecnico)));
  const grupos: { titulo: string; lista: OS[]; vazio: string }[] = [
    { titulo: 'Em execução', lista: minhas.filter((o) => o.status === 'em_execucao' || o.status === 'pausada' || o.status === 'aguardando_peca'), vazio: 'Nenhuma OS em andamento.' },
    { titulo: 'Atrasadas', lista: minhas.filter((o) => isAtrasada(o, hoje) && !['em_execucao', 'pausada', 'aguardando_peca'].includes(o.status)), vazio: 'Nenhuma OS atrasada.' },
    { titulo: 'Hoje', lista: minhas.filter((o) => ['aberta', 'agendada'].includes(o.status) && o.dataAgendada === hoje && !isAtrasada(o, hoje)), vazio: 'Nada agendado para hoje.' },
    { titulo: 'Próximos 7 dias', lista: minhas.filter((o) => ['aberta', 'agendada'].includes(o.status) && (o.dataAgendada || '') > hoje && (o.dataAgendada || '') <= addDays(hoje, 7)), vazio: 'Nada nos próximos dias.' },
    { titulo: 'Aguardando liberação', lista: minhas.filter((o) => o.status === 'concluida'), vazio: 'Nenhuma OS aguardando liberação.' },
  ];
  const nome = l.profissionalMap.get(tecnico)?.nome;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={nome ? `Olá, ${nome.split(' ')[0]}` : 'Área do técnico'}
        subtitle="Suas ordens de serviço. Lance cada tarefa como Executada, Pendente ou Não executada."
        icon={<HardHat size={20} />}
      />
      {!usuario.profissionalId && (
        <Card className="mb-4" bodyClass="p-3">
          <Field label="Você está como gestor. Ver as OS de qual técnico?">
            <Select value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
              <option value="">Todos os técnicos</option>
              {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <p className="mt-2 text-xs text-slate-500">Para lançar como técnico, troque o usuário no menu superior (ícone do usuário).</p>
        </Card>
      )}
      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.titulo}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.titulo} <Badge>{g.lista.length}</Badge>
            </h2>
            {g.lista.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 dark:border-slate-700">{g.vazio}</p>
            ) : (
              <div className="space-y-2">
                {g.lista.slice(0, 50).map((o) => {
                  const c = contagemTarefas(o);
                  return (
                    <Link key={o.id} to={`/campo/os/${o.id}`} className="block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{o.numero}</span>
                        <Badge className={prioridade(o.prioridade).cor}>{prioridade(o.prioridade).label}</Badge>
                      </div>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">{o.titulo}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {l.unidadeMap.get(o.unidadeId || '')?.nome} {l.ambienteMap.get(o.ambienteId || '')?.nome && `· ${l.ambienteMap.get(o.ambienteId || '')?.nome}`}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge>
                        <span className={cx(isAtrasada(o) ? 'font-semibold text-rose-600' : 'text-slate-500')}>Prazo {fmtDate(o.prazo || o.dataAgendada)}</span>
                        <span className="text-slate-500">· {c.total - c.vazias}/{c.total} tarefas lançadas · prev. {fmtHoras(tempoPrevisto(o) / 60)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Execução da OS no celular: check-in, tarefas E/P/N, medições, materiais, fotos e assinatura. */
export function CampoOS() {
  const { id } = useParams();
  const navigate = useNavigate();
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const { usuario } = useSessao();
  const quem = assinaturaUsuario(usuario);
  const [os, setOs] = useState<OS | null | undefined>(undefined);
  const [aberto, setAberto] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);
  const eu = usuario.profissionalId;

  useEffect(() => {
    loaded.current = false;
    db.os.get(id!).then((o) => {
      setOs(o || null);
      setAberto(o?.equipamentos[0]?.equipamentoId || null);
      setTimeout(() => (loaded.current = true), 0);
    });
  }, [id]);

  useEffect(() => {
    if (!os || !loaded.current) return;
    setSaved(false);
    const t = setTimeout(async () => {
      await db.os.put({ ...os, updatedAt: nowIso() });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [os]);

  const cont = useMemo(() => (os ? contagemTarefas(os) : null), [os]);
  if (os === undefined) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (os === null) return <p className="text-sm text-slate-500">OS não encontrada.</p>;

  const upd = (patch: Partial<OS>) => setOs((o) => (o ? { ...o, ...patch } : o));
  const readOnly = OS_FINALIZADAS.includes(os.status);
  const emExec = os.status === 'em_execucao';
  const unidade = l.unidadeMap.get(os.unidadeId || '');
  const executor = eu || os.responsavelId;

  const iniciar = () => {
    const agora = localDateTimeStr();
    const ap = executor && !os.apontamentos.some((a) => !a.fim && a.profissionalId === executor) ? [...os.apontamentos, { profissionalId: executor, inicio: agora }] : os.apontamentos;
    setOs(comHistorico({ ...os, status: 'em_execucao', inicio: os.inicio || agora, apontamentos: ap }, 'Check-in: execução iniciada em campo', quem));
  };
  const pausar = () => {
    const agora = localDateTimeStr();
    setOs(comHistorico({ ...os, status: 'pausada', apontamentos: os.apontamentos.map((a) => (a.fim ? a : { ...a, fim: agora })) }, 'Execução pausada', quem));
  };
  const finalizar = async () => {
    const todas = os.equipamentos.flatMap((e) => e.checklist);
    const semMotivo = todas.filter((c) => statusItem(c) === 'N' && !c.obs?.trim()).length;
    if (semMotivo) {
      toast(`Informe o motivo das ${semMotivo} tarefa(s) marcadas como N.`, 'warning');
      return;
    }
    if (cont!.vazias && !(await confirm({ title: 'Tarefas sem lançamento', message: `${cont!.vazias} tarefa(s) ainda não foram lançadas (E/P/N). Finalizar mesmo assim?`, confirmText: 'Finalizar' }))) return;
    if (!os.assinaturaCliente && !(await confirm({ title: 'Sem assinatura do cliente', message: 'A OS ainda não tem a assinatura do responsável local. Finalizar mesmo assim?', confirmText: 'Finalizar' }))) return;
    const o = await concluirOS(os, { baixarEstoque: true, usuario: quem });
    loaded.current = false;
    setOs(o);
    toast('OS finalizada e enviada para liberação do supervisor.');
    navigate('/campo');
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-4">
        <Link to="/campo" className="text-sm text-brand-700 hover:underline dark:text-brand-300">← Minhas OS</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-brand-700 dark:text-brand-300">{os.numero}</span>
          <Badge className={statusOs(os.status).cor}>{statusOs(os.status).label}</Badge>
          <Badge className={prioridade(os.prioridade).cor}>{prioridade(os.prioridade).label}</Badge>
          <span className="text-xs text-slate-500">{saved ? 'Salvo' : 'Salvando…'}</span>
        </div>
        <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{os.titulo}</h1>
        <p className="text-sm text-slate-500">{[unidade?.nome, unidade?.endereco, unidade?.numero, unidade?.cidade].filter(Boolean).join(', ')}</p>
        <p className="text-xs text-slate-500">Prazo {fmtDate(os.prazo || os.dataAgendada)} · previsto {fmtHoras(tempoPrevisto(os) / 60)} · trabalhado {fmtHoras(horasTrabalhadas(os))}</p>
        {os.descricao && <p className="mt-2 rounded-lg bg-slate-100 p-2.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{os.descricao}</p>}
        {!eu && !readOnly && <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Você está como gestor: os lançamentos serão atribuídos ao responsável da OS ({l.profissionalMap.get(os.responsavelId || '')?.nome || 'não definido'}). Para lançar em seu nome, entre como técnico.</p>}
      </div>

      {cont && (
        <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><b className="block text-lg">{cont.E}</b>Executadas</div>
          <div className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-200"><b className="block text-lg">{cont.P}</b>Pendentes</div>
          <div className="rounded-lg bg-rose-50 p-2 text-rose-800 dark:bg-rose-950 dark:text-rose-200"><b className="block text-lg">{cont.N}</b>Não exec.</div>
          <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><b className="block text-lg">{cont.vazias}</b>A lançar</div>
        </div>
      )}

      {!emExec && !readOnly && (
        <Button className="mb-4 w-full py-3 text-base" variant="success" icon={<Play size={18} />} onClick={iniciar}>
          Iniciar execução (check-in)
        </Button>
      )}

      <div className="space-y-3">
        {os.equipamentos.map((item, i) => {
          const eq = l.equipamentoMap.get(item.equipamentoId);
          const open = aberto === item.equipamentoId;
          const execs = item.checklist.map(statusItem);
          const setItem = (p: Partial<typeof item>) => upd({ equipamentos: os.equipamentos.map((x, k) => (k === i ? { ...x, ...p } : x)) });
          return (
            <section key={item.equipamentoId} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <button className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" onClick={() => setAberto(open ? null : item.equipamentoId)}>
                <span className="flex min-w-0 items-center gap-2">
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{equipLabel(eq, l)}</span>
                    <span className="text-xs text-slate-500">{execs.filter(Boolean).length}/{item.checklist.length} tarefas lançadas</span>
                  </span>
                </span>
                {execs.length > 0 && execs.every(Boolean) && <CheckCheck size={18} className="shrink-0 text-emerald-600" />}
              </button>
              {open && (
                <div className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
                  {!readOnly && item.checklist.length > 0 && (
                    <Button size="sm" variant="outline" icon={<CheckCheck size={14} />} onClick={() => setItem({ checklist: executarPendentes(item.checklist, executor) })}>
                      Lançar todas as pendentes como E
                    </Button>
                  )}
                  {item.checklist.map((c, k) => (
                    <TaskRow
                      key={k}
                      c={c}
                      grande
                      readOnly={readOnly || !emExec}
                      executorLogado={executor}
                      profissionais={l.profissionais}
                      onChange={(p) => setItem({ checklist: item.checklist.map((x, j) => (j === k ? { ...x, ...p } : x)) })}
                    />
                  ))}
                  {!emExec && !readOnly && item.checklist.length > 0 && <p className="text-xs text-slate-500">Faça o check-in para lançar as tarefas.</p>}
                  <details className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                    <summary className="cursor-pointer text-sm font-medium">Medições e diagnóstico</summary>
                    <div className="mt-3">
                      <MedicoesPanel medicoes={item.medicoes} eq={eq} readOnly={readOnly} onChange={(medicoes) => setItem({ medicoes })} />
                    </div>
                  </details>
                  <Field label="Observações do equipamento">
                    <Textarea rows={2} value={item.obs || ''} disabled={readOnly} onChange={(e) => setItem({ obs: e.target.value })} />
                  </Field>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Card title="Materiais utilizados" className="mt-4">
        <PecasEditor itens={os.pecas} onChange={(pecas) => upd({ pecas })} readOnly={readOnly} ocultarPrecos />
        <p className="mt-2 text-xs text-slate-500">A baixa no estoque é feita automaticamente ao finalizar.</p>
      </Card>

      <Card title="Fotos" className="mt-4">
        <PhotoGallery fotos={os.fotos} onChange={(fotos) => upd({ fotos })} readOnly={readOnly} />
      </Card>

      <Card title="Laudo" className="mt-4">
        <div className="space-y-3">
          <Field label="Diagnóstico"><Textarea rows={2} value={os.diagnostico || ''} disabled={readOnly} onChange={(e) => upd({ diagnostico: e.target.value })} /></Field>
          <Field label="Serviço executado"><Textarea rows={3} value={os.servicoExecutado || ''} disabled={readOnly} onChange={(e) => upd({ servicoExecutado: e.target.value })} /></Field>
          <Field label="Recomendações"><Textarea rows={2} value={os.recomendacoes || ''} disabled={readOnly} onChange={(e) => upd({ recomendacoes: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início da parada"><Input type="datetime-local" value={os.paradaInicio || ''} disabled={readOnly} onChange={(e) => upd({ paradaInicio: e.target.value })} /></Field>
            <Field label="Fim da parada"><Input type="datetime-local" value={os.paradaFim || ''} disabled={readOnly} onChange={(e) => upd({ paradaFim: e.target.value })} /></Field>
          </div>
        </div>
      </Card>

      <Card title="Assinaturas" className="mt-4">
        <div className="space-y-4">
          <SignaturePad label="Executante (você)" value={os.assinaturaTecnico} onChange={(v) => upd({ assinaturaTecnico: v })} />
          <SignaturePad label="Responsável local (cliente)" value={os.assinaturaCliente} onChange={(v) => upd({ assinaturaCliente: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nome de quem assina" value={os.nomeAssinante || ''} onChange={(e) => upd({ nomeAssinante: e.target.value })} />
            <Input placeholder="Documento / matrícula" value={os.docAssinante || ''} onChange={(e) => upd({ docAssinante: e.target.value })} />
          </div>
        </div>
      </Card>

      {readOnly ? (
        <EmptyState icon={<ClipboardCheck size={36} />} title={os.status === 'validada' ? 'OS liberada pelo supervisor' : 'Execução finalizada'}>
          {os.status === 'concluida' ? 'Aguardando liberação do supervisor.' : null}
        </EmptyState>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-950/95 lg:pl-64" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex max-w-3xl gap-2">
            {emExec ? (
              <>
                <Button variant="outline" className="flex-1 py-3" icon={<Pause size={18} />} onClick={pausar}>Pausar</Button>
                <Button className="flex-[2] py-3" icon={<Send size={18} />} onClick={finalizar}>Finalizar e enviar</Button>
              </>
            ) : (
              <Button variant="success" className="w-full py-3" icon={<Wrench size={18} />} onClick={iniciar}>Iniciar execução</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
