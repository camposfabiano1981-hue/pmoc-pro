import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCheck, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Copy, FileText, Pause, Play, Plus, Printer, RotateCcw, ShieldCheck, Square, Star, Trash2, XCircle,
} from 'lucide-react';
import { db, nowIso, uid } from '../db/db';
import type { ItemOsEquip, OS, Rotina, StatusOS } from '../db/types';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Select, Tabs, Textarea, cx, useConfirm, useToast } from '../components/ui';
import { PecasEditor, PhotoGallery, ServicosEditor, SignaturePad, totais } from '../components/widgets';
import { MedicoesPanel, TaskRow, executarPendentes } from '../components/osParts';
import { IncluirRotinasModal, RemoverTarefaModal } from '../components/RotinasOs';
import { useLookups, equipLabel } from '../lib/lookups';
import { useSessao, assinaturaUsuario } from '../lib/sessao';
import { FLUIDOS, OS_FINALIZADAS, PRIORIDADES, SETORES, STATUS_EQUIPAMENTO, STATUS_OS, TIPOS_OS, statusOs } from '../lib/catalogs';
import { diffHours, fmtDateTime, fmtHoras, localDateTimeStr, money, n2, todayStr } from '../lib/format';
import {
  comHistorico, concluirOS, contagemTarefas, criarOS, excluirOS, horasTrabalhadas, isAtrasada, liberarOS, novaOS, prazoSla, reabrirOS, tempoPrevisto, baixarPecas,
} from '../lib/osHelpers';
import { estornarExecucoesDaOS, itemDeRotina, registrarExecucoesDaOS, statusItem } from '../lib/rotinas';

type Tab = 'geral' | 'tarefas' | 'itens' | 'exec' | 'fotos' | 'assin' | 'hist';

function EquipCard({ item, os, onChange, onRemove, onHistorico, readOnly }: { item: ItemOsEquip; os: OS; onChange: (p: Partial<ItemOsEquip>) => void; onRemove: () => void; onHistorico: (texto: string) => void; readOnly: boolean }) {
  const l = useLookups();
  const toast = useToast();
  const { usuario, pode } = useSessao();
  const [incluir, setIncluir] = useState(false);
  const [remover, setRemover] = useState<number | null>(null);
  const eq = l.equipamentoMap.get(item.equipamentoId);
  const [open, setOpen] = useState(true);
  const [fl, setFl] = useState({ operacao: 'carga', kg: '' });
  const execs = item.checklist.map(statusItem);
  const feitos = execs.filter(Boolean).length;
  const updItem = (i: number, p: Partial<ItemOsEquip['checklist'][number]>) => onChange({ checklist: item.checklist.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  const executorLogado = usuario.profissionalId;

  const incluirRotinas = (rots: Rotina[]) => {
    onChange({ checklist: [...item.checklist, ...rots.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(itemDeRotina)] });
    onHistorico(`${rots.length} rotina(s) incluída(s) em ${eq?.tag || 'equipamento'}: ${rots.map((r) => r.descricao).join('; ')}`);
    toast(`${rots.length} rotina(s) incluída(s).`);
  };
  const excluirTarefa = async (desativar: boolean) => {
    if (remover === null) return;
    const c = item.checklist[remover];
    onChange({ checklist: item.checklist.filter((_, k) => k !== remover) });
    if (desativar && c.rotinaId) await db.rotinas.update(c.rotinaId, { ativa: false, updatedAt: nowIso() });
    onHistorico(`${c.rotinaId ? 'Rotina' : 'Tarefa'} excluída de ${eq?.tag || 'equipamento'}: ${c.descricao}${desativar ? ' (desativada no equipamento)' : ''}`);
    toast(desativar ? 'Rotina excluída da OS e desativada no equipamento.' : 'Excluída desta OS.');
    setRemover(null);
  };

  const registrarFluido = async () => {
    const kg = Number(fl.kg.replace(',', '.'));
    if (!eq || !(kg >= 0)) return;
    const ts = nowIso();
    await db.fluidos.add({ id: uid(), createdAt: ts, updatedAt: ts, equipamentoId: eq.id, data: todayStr(), operacao: fl.operacao as never, fluido: eq.fluido || 'R-410A', quantidadeKg: kg, osId: os.id, profissionalId: usuario.profissionalId || os.responsavelId });
    setFl({ ...fl, kg: '' });
    toast('Registro de fluido salvo.');
  };

  return (
    <Card
      title={
        <button className="flex items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{equipLabel(eq, l)}</span>
          {item.concluido && <CheckCircle2 size={16} className="text-emerald-600" />}
        </button>
      }
      actions={
        <>
          <Badge>{feitos}/{item.checklist.length} lançadas</Badge>
          {execs.includes('N') && <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">{execs.filter((x) => x === 'N').length} N</Badge>}
          {execs.includes('P') && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">{execs.filter((x) => x === 'P').length} P</Badge>}
          {eq && <Link to={`/equipamentos/${eq.id}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">Ficha</Link>}
          {!readOnly && (
            <IconButton title="Remover equipamento da OS" onClick={onRemove}>
              <Trash2 size={15} />
            </IconButton>
          )}
        </>
      }
    >
      {open && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Plano: {l.planoMap.get(eq?.planoId || '')?.nome || 'sem plano'}</span>
            <span>Fluido: {eq?.fluido || '—'}</span>
            <span>Corrente nominal: {eq?.correnteNominal ? `${eq.correnteNominal} A` : '—'}</span>
            <span>Patrimônio: {eq?.patrimonio || '—'}</span>
            <span>C. custo: {eq?.centroCusto || '—'}</span>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<CheckCheck size={14} />} onClick={() => onChange({ checklist: executarPendentes(item.checklist, executorLogado || os.responsavelId) })}>
                Lançar pendentes como executadas (E)
              </Button>
              <Button size="sm" variant="outline" icon={<ClipboardList size={14} />} onClick={() => setIncluir(true)}>
                Incluir rotinas (individual)
              </Button>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => onChange({ checklist: [...item.checklist, { descricao: '', tipo: 'check', resultado: '', execucao: '' }] })}>
                Tarefa avulsa
              </Button>
            </div>
          )}
          {item.checklist.length === 0 && <p className="text-sm text-slate-500">Nenhuma tarefa. Use “Incluir rotinas (individual)” para escolher as rotinas do equipamento ou crie uma tarefa avulsa.</p>}
          <div className="space-y-2">
            {item.checklist.map((c, i) => (
              <TaskRow
                key={i}
                c={c}
                readOnly={readOnly}
                executorLogado={executorLogado}
                executorPadrao={os.responsavelId}
                profissionais={l.profissionais}
                onChange={(p) => updItem(i, p)}
                onRemove={() => (c.rotinaId || c.descricao ? setRemover(i) : onChange({ checklist: item.checklist.filter((_, k) => k !== i) }))}
              />
            ))}
          </div>
          <IncluirRotinasModal open={incluir} equipamentoId={item.equipamentoId} osId={os.id} checklist={item.checklist} onClose={() => setIncluir(false)} onIncluir={incluirRotinas} />
          <RemoverTarefaModal tarefa={remover === null ? undefined : item.checklist[remover]} podeDesativar={pode('cadastrar')} onClose={() => setRemover(null)} onConfirmar={excluirTarefa} />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">Medições de campo e diagnóstico</h4>
            <MedicoesPanel medicoes={item.medicoes} eq={eq} readOnly={readOnly} onChange={(medicoes) => onChange({ medicoes })} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Observações do equipamento">
              <Textarea rows={2} value={item.obs || ''} disabled={readOnly} onChange={(e) => onChange({ obs: e.target.value })} />
            </Field>
            {eq && (
              <Field label="Alteração da localização — destino" help={`Origem: ${l.ambienteMap.get(eq.ambienteId || '')?.nome || '—'} · aplicada ao concluir`}>
                <Select value={item.novoAmbienteId || ''} disabled={readOnly} onChange={(e) => onChange({ novoAmbienteId: e.target.value || undefined })}>
                  <option value="">Sem alteração</option>
                  {l.ambientes.filter((a) => a.unidadeId === eq.unidadeId && a.id !== eq.ambienteId).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </Select>
              </Field>
            )}
            {eq && (
              <Field label="Situação do equipamento" help="Atualiza o cadastro imediatamente">
                <Select value={eq.status} disabled={readOnly} onChange={async (e) => { await db.equipamentos.update(eq.id, { status: e.target.value as never, updatedAt: nowIso() }); toast('Situação do equipamento atualizada.'); }}>
                  {STATUS_EQUIPAMENTO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            )}
          </div>
          {eq && !readOnly && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-2.5 dark:border-slate-700">
              <span className="w-full text-xs font-medium text-slate-600 dark:text-slate-300">Registrar fluido refrigerante ({eq.fluido || '—'})</span>
              <Select className="w-auto" value={fl.operacao} onChange={(e) => setFl({ ...fl, operacao: e.target.value })}>
                <option value="carga">Carga / complemento</option>
                <option value="recolhimento">Recolhimento</option>
                <option value="vazamento">Vazamento identificado</option>
                <option value="estanqueidade">Teste de estanqueidade</option>
              </Select>
              <Input className="w-28" placeholder="kg" inputMode="decimal" value={fl.kg} onChange={(e) => setFl({ ...fl, kg: e.target.value })} />
              <Button size="sm" variant="outline" onClick={registrarFluido}>Registrar</Button>
              <span className="text-[11px] text-slate-500">{FLUIDOS.find((f) => f.nome === eq.fluido)?.obs}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function OsEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const { usuario, pode } = useSessao();
  const quem = assinaturaUsuario(usuario);
  const [os, setOs] = useState<OS | null>(null);
  const [tab, setTab] = useState<Tab>('geral');
  const [saved, setSaved] = useState(true);
  const isNew = id === undefined;
  const loaded = useRef(false);
  const [addEq, setAddEq] = useState('');

  useEffect(() => {
    loaded.current = false;
    (async () => {
      if (isNew) {
        const eqId = params.get('equipamentoId') || undefined;
        const eq = eqId ? await db.equipamentos.get(eqId) : undefined;
        const unidade = eq ? await db.unidades.get(eq.unidadeId) : undefined;
        const tipo = params.get('tipo') || 'Corretiva';
        const o = novaOS({ tipo, unidadeId: eq?.unidadeId, clienteId: unidade?.clienteId, ambienteId: eq?.ambienteId, centroCusto: eq?.centroCusto, titulo: eq ? `${tipo} — ${eq.tag} ${eq.tipo}` : '', criadoPor: quem, setorExecutante: 'Manutenção', garantia: '90 dias' });
        if (eq) o.equipamentos = [{ equipamentoId: eq.id, checklist: [], medicoes: {} }];
        o.prazo = prazoSla(o.prioridade);
        o.historico = [{ data: nowIso(), texto: 'OS criada', usuario: quem }];
        setOs(o);
      } else {
        const o = await db.os.get(id!);
        setOs(o || null);
      }
      setTimeout(() => (loaded.current = true), 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, params]);

  // salvamento automático (OS existentes)
  useEffect(() => {
    if (!os || isNew || !loaded.current) return;
    setSaved(false);
    const t = setTimeout(async () => {
      await db.os.put({ ...os, updatedAt: nowIso() });
      // OS concluída editada na conferência: mantém o histórico de execuções dos equipamentos em dia
      if (os.status === 'concluida') await registrarExecucoesDaOS(os);
      setSaved(true);
    }, 700);
    return () => clearTimeout(t);
  }, [os, isNew]);

  const upd = (patch: Partial<OS>) => setOs((o) => (o ? { ...o, ...patch } : o));

  if (os === null && !isNew) return <p className="text-sm text-slate-500">OS não encontrada.</p>;
  if (!os) return <p className="text-sm text-slate-500">Carregando…</p>;

  const readOnly = os.status === 'validada' || os.status === 'cancelada';
  const unidade = l.unidadeMap.get(os.unidadeId || '');
  const ambiente = l.ambienteMap.get(os.ambienteId || '');
  const contrato = l.contratoMap.get(os.contratoId || '');
  const pmoc = l.pmocs.find((p) => p.unidadeId === os.unidadeId && p.status === 'vigente');
  const rt = l.profissionalMap.get(pmoc?.rtId || '');
  const equipsDaUnidade = l.equipamentos.filter((e) => e.unidadeId === os.unidadeId && !os.equipamentos.some((x) => x.equipamentoId === e.id));
  const t = totais(os.pecas, os.servicos, os.deslocamento, os.desconto);
  const horas = horasTrabalhadas(os);
  const custoMO = os.apontamentos.reduce((acc, a) => acc + Math.max(0, diffHours(a.fim || localDateTimeStr(), a.inicio) || 0) * (l.profissionalMap.get(a.profissionalId)?.valorHora || 0), 0);
  const st = statusOs(os.status);
  const cont = contagemTarefas(os);
  const prev = tempoPrevisto(os);
  const parada = diffHours(os.paradaFim, os.paradaInicio);

  const criar = async () => {
    if (!os.titulo.trim()) {
      toast('Informe o título da OS.', 'warning');
      return;
    }
    const rec = await criarOS(os);
    if (rec.ocorrenciaId) await db.ocorrencias.update(rec.ocorrenciaId, { status: 'convertida', osId: rec.id, updatedAt: nowIso() });
    toast(`OS ${rec.numero} criada.`);
    navigate(`/os/${rec.id}`, { replace: true });
  };

  const setStatus = async (s: StatusOS) => {
    let o: OS = { ...os, status: s };
    const agora = localDateTimeStr();
    if (s === 'em_execucao') {
      if (!o.inicio) o.inicio = agora;
      const resp = usuario.profissionalId || o.responsavelId || o.tecnicosIds[0];
      if (resp && !o.apontamentos.some((a) => !a.fim && a.profissionalId === resp)) o.apontamentos = [...o.apontamentos, { profissionalId: resp, inicio: agora }];
    }
    if (s === 'pausada' || s === 'aguardando_peca') o.apontamentos = o.apontamentos.map((a) => (a.fim ? a : { ...a, fim: agora }));
    if (s === 'cancelada') {
      if (!(await confirm({ title: 'Cancelar OS', message: 'Deseja cancelar esta OS? As execuções lançadas sairão do histórico dos equipamentos.', danger: true, confirmText: 'Cancelar OS' }))) return;
      await estornarExecucoesDaOS(o.id);
    }
    setOs(comHistorico(o, `Status alterado para "${statusOs(s).label}"`, quem));
    toast(`Status: ${statusOs(s).label}.`);
  };

  const concluir = async () => {
    const todas = os.equipamentos.flatMap((e) => e.checklist);
    const semMotivo = todas.filter((c) => statusItem(c) === 'N' && !c.obs?.trim()).length;
    if (semMotivo) {
      toast(`Informe o motivo das ${semMotivo} tarefa(s) não executada(s) (N).`, 'warning');
      setTab('tarefas');
      return;
    }
    const semExecutor = todas.filter((c) => statusItem(c) && !c.executorId).length;
    if (semExecutor) {
      toast(`Informe quem executou ${semExecutor} tarefa(s) — os registros devem ser atribuídos à equipe técnica.`, 'warning');
      setTab('tarefas');
      return;
    }
    if (cont.vazias && !(await confirm({ title: 'Tarefas sem lançamento', message: `${cont.vazias} tarefa(s) não foram lançadas (E/P/N). Elas continuarão vencidas no plano do equipamento. Concluir mesmo assim?`, confirmText: 'Concluir' }))) return;
    const baixar = os.pecas.some((p) => p.pecaId && !p.baixado) && (await confirm({ title: 'Baixa de estoque', message: 'Dar baixa no estoque das peças utilizadas nesta OS?', confirmText: 'Dar baixa' }));
    const o = await concluirOS(os, { baixarEstoque: baixar, usuario: quem });
    loaded.current = false;
    setOs(o);
    setTimeout(() => (loaded.current = true), 0);
    toast('Execução concluída. Rotinas dos equipamentos atualizadas; aguardando liberação.');
  };

  const liberar = async () => {
    const sup = os.supervisorId || (usuario.perfil !== 'tecnico' ? usuario.profissionalId : undefined);
    if (!sup && !(await confirm({ title: 'Liberar OS', message: 'Nenhum supervisor selecionado na aba Assinaturas. Liberar mesmo assim?', confirmText: 'Liberar' }))) return;
    const o = await liberarOS(os, sup, quem);
    loaded.current = false;
    setOs(o);
    setTimeout(() => (loaded.current = true), 0);
    toast('OS liberada.');
  };

  const reabrir = async () => {
    if (!(await confirm({ title: 'Reabrir OS', message: 'Reabrir a OS para correção? As execuções lançadas serão retiradas do histórico até a nova conclusão.', confirmText: 'Reabrir' }))) return;
    const o = await reabrirOS(os, quem);
    loaded.current = false;
    setOs(o);
    setTimeout(() => (loaded.current = true), 0);
  };

  const excluir = async () => {
    if (!(await confirm({ title: 'Excluir OS', message: 'Excluir definitivamente esta OS? Movimentos de estoque já realizados não serão revertidos.', danger: true, confirmText: 'Excluir' }))) return;
    await excluirOS(os.id);
    toast('OS excluída.');
    navigate('/os');
  };

  const duplicar = async () => {
    const copia = novaOS({
      ...structuredClone(os), id: uid(), numero: '', status: 'aberta', inicio: undefined, fim: undefined, liberacao: undefined, apontamentos: [], fotos: [],
      assinaturaCliente: undefined, assinaturaTecnico: undefined, assinaturaSupervisor: undefined, preventivaRef: undefined, paradaInicio: undefined, paradaFim: undefined,
      pecas: os.pecas.map((p) => ({ ...p, baixado: false })), historico: [{ data: nowIso(), texto: `Duplicada de ${os.numero}`, usuario: quem }],
    });
    copia.equipamentos = copia.equipamentos.map((e) => ({ ...e, concluido: false, novoAmbienteId: undefined, checklist: e.checklist.map((c) => ({ ...c, resultado: '', execucao: '', executorId: undefined, dataExecucao: undefined, valor: '', obs: '', tempoRealMin: undefined })), medicoes: {} }));
    const rec = await criarOS(copia);
    toast(`OS ${rec.numero} criada.`);
    navigate(`/os/${rec.id}`);
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: 'geral', label: 'Informações gerais' },
    { value: 'tarefas', label: `Tarefas E/P/N (${cont.total - cont.vazias}/${cont.total})` },
    { value: 'itens', label: `Materiais e serviços (${os.pecas.length + os.servicos.length})` },
    { value: 'exec', label: 'Executantes e parada' },
    { value: 'fotos', label: `Fotos (${os.fotos.length})` },
    { value: 'assin', label: 'Assinaturas e liberação' },
    { value: 'hist', label: 'Histórico' },
  ];

  const sec = 'mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300';

  return (
    <div>
      <PageHeader
        title={isNew ? 'Nova ordem de serviço' : `${os.numero} — ${os.titulo || 'OS'}`}
        icon={<ClipboardList size={20} />}
        subtitle={
          !isNew && (
            <span className="flex flex-wrap items-center gap-2">
              <Badge className={st.cor}>{st.label}</Badge>
              <Badge className={PRIORIDADES.find((p) => p.value === os.prioridade)?.cor}>Prioridade {PRIORIDADES.find((p) => p.value === os.prioridade)?.label}</Badge>
              {isAtrasada(os) && <Badge className="bg-rose-600 text-white">Atrasada</Badge>}
              <span className="text-xs">E {cont.E} · P {cont.P} · N {cont.N} · sem lançamento {cont.vazias}</span>
              <span className="text-xs">{saved ? 'Salvo automaticamente' : 'Salvando…'}</span>
            </span>
          )
        }
        actions={
          isNew ? (
            <Button onClick={criar}>Criar OS</Button>
          ) : (
            <>
              {['aberta', 'agendada', 'pausada', 'aguardando_peca'].includes(os.status) && <Button variant="success" icon={<Play size={16} />} onClick={() => setStatus('em_execucao')}>Iniciar</Button>}
              {os.status === 'em_execucao' && <Button variant="outline" icon={<Pause size={16} />} onClick={() => setStatus('pausada')}>Pausar</Button>}
              {os.status === 'em_execucao' && <Button variant="outline" icon={<Square size={16} />} onClick={() => setStatus('aguardando_peca')}>Aguard. peça</Button>}
              {!OS_FINALIZADAS.includes(os.status) && <Button icon={<CheckCircle2 size={16} />} onClick={concluir}>Concluir execução</Button>}
              {os.status === 'concluida' && pode('liberar') && <Button variant="success" icon={<ShieldCheck size={16} />} onClick={liberar}>Liberar</Button>}
              {OS_FINALIZADAS.includes(os.status) && pode('liberar') && <Button variant="outline" icon={<RotateCcw size={16} />} onClick={reabrir}>Reabrir</Button>}
              <Link to={`/os/${os.id}/imprimir`}><Button variant="outline" icon={<Printer size={16} />}>Imprimir</Button></Link>
              <Link to={`/os/${os.id}/imprimir?branco=1`}><IconButton title="Formulário em branco para preenchimento manual"><FileText size={16} /></IconButton></Link>
              <IconButton title="Duplicar OS" onClick={duplicar}><Copy size={16} /></IconButton>
              {!OS_FINALIZADAS.includes(os.status) && <IconButton title="Cancelar OS" onClick={() => setStatus('cancelada')}><XCircle size={16} /></IconButton>}
              {pode('excluir') && <IconButton title="Excluir OS" onClick={excluir}><Trash2 size={16} /></IconButton>}
            </>
          )
        }
      />

      <Tabs tabs={isNew ? tabs.slice(0, 2) : tabs} value={tab} onChange={setTab} />

      {tab === 'geral' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Informações gerais" className="xl:col-span-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label="Título / serviço" required className="md:col-span-4">
                <Input value={os.titulo} onChange={(e) => upd({ titulo: e.target.value })} placeholder="Ex.: Equipamento não gela — Sala RH" disabled={readOnly} />
              </Field>
              <Field label="Tipo de manutenção">
                <Select value={os.tipo} onChange={(e) => upd({ tipo: e.target.value })} disabled={readOnly}>
                  {TIPOS_OS.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={os.status} onChange={(e) => upd({ status: e.target.value as StatusOS })} disabled={readOnly || !pode('gerir_os')}>
                  {STATUS_OS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Solicitante">
                <Input value={os.solicitante || ''} onChange={(e) => upd({ solicitante: e.target.value })} disabled={readOnly} />
              </Field>
              <Field label="Setor executante">
                <Input list="dl-setores" value={os.setorExecutante || ''} onChange={(e) => upd({ setorExecutante: e.target.value })} disabled={readOnly} />
                <datalist id="dl-setores">{SETORES.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Cliente">
                <Select value={os.clienteId || ''} onChange={(e) => upd({ clienteId: e.target.value || undefined, unidadeId: undefined, ambienteId: undefined })} disabled={readOnly}>
                  <option value="">— selecione —</option>
                  {l.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </Field>
              <Field label="Filial / unidade">
                <Select value={os.unidadeId || ''} onChange={(e) => { const u = l.unidadeMap.get(e.target.value); upd({ unidadeId: e.target.value || undefined, clienteId: u?.clienteId || os.clienteId, ambienteId: undefined }); }} disabled={readOnly}>
                  <option value="">— selecione —</option>
                  {l.unidades.filter((u) => !os.clienteId || u.clienteId === os.clienteId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </Select>
              </Field>
              <Field label="Localização (ambiente)">
                <Select value={os.ambienteId || ''} onChange={(e) => upd({ ambienteId: e.target.value || undefined, centroCusto: os.centroCusto || l.ambienteMap.get(e.target.value)?.centroCusto })} disabled={readOnly}>
                  <option value="">— selecione —</option>
                  {l.ambientes.filter((a) => a.unidadeId === os.unidadeId).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </Select>
              </Field>
              <Field label="Centro de custo">
                <Input value={os.centroCusto || ''} onChange={(e) => upd({ centroCusto: e.target.value })} disabled={readOnly} />
              </Field>
              <Field label="Contrato">
                <Select value={os.contratoId || ''} onChange={(e) => upd({ contratoId: e.target.value || undefined })} disabled={readOnly}>
                  <option value="">— sem contrato —</option>
                  {l.contratos.filter((c) => !os.clienteId || c.clienteId === os.clienteId).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}
                </Select>
              </Field>
              <Field label="Fornecedor (terceiro)">
                <Select value={os.fornecedorId || ''} onChange={(e) => upd({ fornecedorId: e.target.value || undefined })} disabled={readOnly}>
                  <option value="">— equipe própria —</option>
                  {l.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </Field>
              <Field label="Responsável">
                <Select value={os.responsavelId || ''} onChange={(e) => upd({ responsavelId: e.target.value || undefined, tecnicosIds: e.target.value && !os.tecnicosIds.includes(e.target.value) ? [...os.tecnicosIds, e.target.value] : os.tecnicosIds })} disabled={readOnly}>
                  <option value="">— selecione —</option>
                  {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Select>
              </Field>
              <Field label="Equipe técnica (executantes)" className="md:col-span-4">
                <div className="flex flex-wrap gap-2">
                  {l.profissionais.filter((p) => p.ativo).map((p) => {
                    const on = os.tecnicosIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => upd({ tecnicosIds: on ? os.tecnicosIds.filter((x) => x !== p.id) : [...os.tecnicosIds, p.id] })}
                        className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', on ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300')}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor || '#94a3b8' }} />
                        {p.nome}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Serviço solicitado / descrição" className="md:col-span-4">
                <Textarea value={os.descricao || ''} onChange={(e) => upd({ descricao: e.target.value })} disabled={readOnly} />
              </Field>
              <Field label="Observações" className="md:col-span-4">
                <Textarea rows={2} value={os.observacoes || ''} onChange={(e) => upd({ observacoes: e.target.value })} disabled={readOnly} />
              </Field>
            </div>
          </Card>
          <div className="space-y-4">
            <Card title="Padrões de execução">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prioridade">
                  <Select value={os.prioridade} onChange={(e) => { const p = e.target.value as OS['prioridade']; upd({ prioridade: p, prazo: prazoSla(p, contrato, new Date(os.dataAbertura)) }); }} disabled={readOnly}>
                    {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </Field>
                <Field label="Data agendada">
                  <Input type="date" value={os.dataAgendada || ''} onChange={(e) => upd({ dataAgendada: e.target.value, dataOriginal: os.dataOriginal || (os.origem === 'preventiva' ? os.dataAgendada : undefined) })} disabled={readOnly} />
                </Field>
                <Field label="Prazo de entrega" help={contrato ? `SLA do contrato ${contrato.numero}` : 'Pela prioridade'}>
                  <Input type="date" value={os.prazo || ''} onChange={(e) => upd({ prazo: e.target.value })} disabled={readOnly} />
                </Field>
                <Field label="Tempo de execução previsto (min)" help={`Soma das tarefas: ${fmtHoras(prev / 60)}`}>
                  <Input type="number" min={0} value={os.tempoPrevistoMin ?? ''} placeholder={String(prev)} onChange={(e) => upd({ tempoPrevistoMin: e.target.value === '' ? undefined : Number(e.target.value) })} disabled={readOnly} />
                </Field>
                <Field label="Tempo de interferência previsto (min)" help="Parada prevista do equipamento/ambiente">
                  <Input type="number" min={0} value={os.interferenciaPrevistaMin ?? ''} onChange={(e) => upd({ interferenciaPrevistaMin: e.target.value === '' ? undefined : Number(e.target.value) })} disabled={readOnly} />
                </Field>
                <Field label="Garantia da aplicação">
                  <Input value={os.garantia || ''} onChange={(e) => upd({ garantia: e.target.value })} disabled={readOnly} placeholder="Ex.: 90 dias" />
                </Field>
                <Field label="Abertura" className="col-span-2">
                  <Input value={`${fmtDateTime(os.dataAbertura)}${os.criadoPor ? ' por ' + os.criadoPor : ''}`} disabled />
                </Field>
              </div>
            </Card>
            <Card title="Identificação do ambiente">
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Edifício</dt><dd>{unidade?.nome || '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Endereço</dt><dd>{[unidade?.endereco, unidade?.numero, unidade?.bairro, unidade?.cidade, unidade?.uf].filter(Boolean).join(', ') || '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Tipo de atividade</dt><dd>{ambiente?.tipoAtividade || unidade?.tipoEdificacao || '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Área climatizada</dt><dd>{ambiente?.areaM2 ? `${n2(ambiente.areaM2)} m²` : '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Ocupantes</dt><dd>{ambiente ? `${ambiente.ocupantesFixos ?? 0} fixos · ${ambiente.ocupantesFlutuantes ?? 0} flutuantes` : '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-slate-500">Responsável técnico</dt><dd>{rt ? `${rt.nome} · ${rt.conselho || ''} ${rt.registro || ''} · ${pmoc?.artTipo || 'ART'} ${pmoc?.artNumero || ''}` : '—'}</dd></div>
              </dl>
            </Card>
          </div>
        </div>
      )}

      {tab === 'tarefas' && (
        <div className="space-y-4">
          <Card bodyClass="p-3">
            <p className="mb-2 text-xs text-slate-500">
              <b>E</b> = executado · <b>P</b> = pendente · <b>N</b> = não executado (exige motivo). Cada lançamento registra o executante e a data/hora; ao concluir a OS, a última execução e a próxima data de cada rotina do equipamento são atualizadas.
            </p>
            {!readOnly && (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={os.unidadeId ? 'Adicionar equipamento da unidade' : 'Selecione a unidade em Informações gerais'} className="min-w-[240px] flex-1">
                  <Select value={addEq} onChange={(e) => setAddEq(e.target.value)} disabled={!os.unidadeId}>
                    <option value="">— selecione —</option>
                    {equipsDaUnidade.map((e) => <option key={e.id} value={e.id}>{equipLabel(e, l)}</option>)}
                  </Select>
                </Field>
                <Button
                  disabled={!addEq}
                  onClick={async () => {
                    const rots = os.tipo === 'Preventiva' ? (await db.rotinas.where('equipamentoId').equals(addEq).toArray()).filter((r) => r.ativa && r.proximaExecucao <= (os.prazo || todayStr())) : [];
                    upd({ equipamentos: [...os.equipamentos, { equipamentoId: addEq, checklist: rots.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(itemDeRotina), medicoes: {} }] });
                    setAddEq('');
                  }}
                >
                  Adicionar
                </Button>
              </div>
            )}
          </Card>
          {os.equipamentos.length === 0 && <p className="text-sm text-slate-500">Nenhum equipamento vinculado.</p>}
          {os.equipamentos.map((item, i) => (
            <EquipCard
              key={item.equipamentoId}
              item={item}
              os={os}
              readOnly={readOnly}
              onChange={(p) => upd({ equipamentos: os.equipamentos.map((x, k) => (k === i ? { ...x, ...p } : x)) })}
              onRemove={() => upd({ equipamentos: os.equipamentos.filter((_, k) => k !== i) })}
              onHistorico={(texto) => setOs((o) => (o ? comHistorico(o, texto, quem) : o))}
            />
          ))}
        </div>
      )}

      {tab === 'itens' && (
        <div className="space-y-4">
          <Card
            title="Materiais e peças"
            actions={
              os.pecas.some((p) => p.pecaId && !p.baixado) && !readOnly ? (
                <Button size="sm" variant="outline" onClick={async () => { const o = await baixarPecas(os); setOs(comHistorico(o, 'Baixa de peças no estoque', quem)); toast('Baixa de estoque realizada.'); }}>
                  Dar baixa no estoque
                </Button>
              ) : undefined
            }
          >
            <PecasEditor itens={os.pecas} onChange={(pecas) => upd({ pecas })} readOnly={readOnly} />
          </Card>
          <Card title="Serviços">
            <ServicosEditor itens={os.servicos} onChange={(servicos) => upd({ servicos })} readOnly={readOnly} />
          </Card>
          {pode('precos') && (
            <Card title="Resumo financeiro">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Deslocamento (R$)"><Input type="number" step="0.01" value={os.deslocamento ?? ''} onChange={(e) => upd({ deslocamento: Number(e.target.value) || 0 })} disabled={readOnly} /></Field>
                <Field label="Desconto (R$)"><Input type="number" step="0.01" value={os.desconto ?? ''} onChange={(e) => upd({ desconto: Number(e.target.value) || 0 })} disabled={readOnly} /></Field>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Peças / Serviços</p><p className="font-semibold">{money(t.pecas)} / {money(t.servicos)}</p></div>
                <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-950"><p className="text-xs text-brand-700 dark:text-brand-300">Total da OS</p><p className="text-xl font-bold text-brand-900 dark:text-white">{money(t.total)}</p></div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Custo interno estimado: peças {money(t.custoPecas)} + mão de obra {money(custoMO)} ({fmtHoras(horas)}) = <b>{money(t.custoPecas + custoMO)}</b> · margem {money(t.total - t.custoPecas - custoMO)}</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'exec' && (
        <div className="space-y-4">
          <Card title={`Executantes — ${fmtHoras(horas)} trabalhadas · previsto ${fmtHoras(prev / 60)}`}>
            <div className="space-y-2">
              <div className="hidden grid-cols-12 gap-2 text-xs font-medium text-slate-500 sm:grid">
                <span className="col-span-4">Executante</span><span className="col-span-3">Início do serviço</span><span className="col-span-3">Fim do serviço</span><span className="col-span-2 text-right">Tempo</span>
              </div>
              {os.apontamentos.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <Select className="col-span-12 sm:col-span-4" value={a.profissionalId} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, profissionalId: e.target.value } : x)) })} disabled={readOnly}>
                    {l.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </Select>
                  <Input className="col-span-5 sm:col-span-3" type="datetime-local" value={a.inicio} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, inicio: e.target.value } : x)) })} disabled={readOnly} />
                  <Input className="col-span-5 sm:col-span-3" type="datetime-local" value={a.fim || ''} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, fim: e.target.value } : x)) })} disabled={readOnly} />
                  <div className="col-span-2 flex items-center justify-end gap-1 text-sm tabular-nums">
                    {a.fim ? fmtHoras(Math.max(0, diffHours(a.fim, a.inicio) || 0)) : !readOnly && <Button size="sm" variant="outline" onClick={() => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, fim: localDateTimeStr() } : x)) })}>Parar</Button>}
                    {!readOnly && <IconButton title="Remover" onClick={() => upd({ apontamentos: os.apontamentos.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton>}
                  </div>
                </div>
              ))}
              {!readOnly && (
                <Button size="sm" variant="outline" icon={<Play size={14} />} onClick={() => upd({ apontamentos: [...os.apontamentos, { profissionalId: usuario.profissionalId || os.responsavelId || os.tecnicosIds[0] || l.profissionais[0]?.id || '', inicio: localDateTimeStr() }] })}>
                  Iniciar apontamento agora
                </Button>
              )}
            </div>
          </Card>
          <Card title="Parada e interferência">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Início da parada"><Input type="datetime-local" value={os.paradaInicio || ''} onChange={(e) => upd({ paradaInicio: e.target.value })} disabled={readOnly} /></Field>
              <Field label="Fim da parada"><Input type="datetime-local" value={os.paradaFim || ''} onChange={(e) => upd({ paradaFim: e.target.value })} disabled={readOnly} /></Field>
              <Field label="Tempo parado"><Input value={parada !== null && parada >= 0 ? fmtHoras(parada) : '—'} disabled /></Field>
              <Field label="Interferência (área/processo afetado)"><Input value={os.interferencia || ''} onChange={(e) => upd({ interferencia: e.target.value })} disabled={readOnly} /></Field>
            </div>
          </Card>
          <Card title="Laudo técnico">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Início do atendimento"><Input type="datetime-local" value={os.inicio || ''} onChange={(e) => upd({ inicio: e.target.value })} disabled={readOnly} /></Field>
                <Field label="Término do atendimento"><Input type="datetime-local" value={os.fim || ''} onChange={(e) => upd({ fim: e.target.value })} disabled={readOnly} /></Field>
              </div>
              <Field label="Diagnóstico / causa raiz"><Textarea value={os.diagnostico || ''} onChange={(e) => upd({ diagnostico: e.target.value })} disabled={readOnly} /></Field>
              <Field label="Serviço executado"><Textarea value={os.servicoExecutado || ''} onChange={(e) => upd({ servicoExecutado: e.target.value })} disabled={readOnly} /></Field>
              <Field label="Recomendações ao cliente"><Textarea value={os.recomendacoes || ''} onChange={(e) => upd({ recomendacoes: e.target.value })} disabled={readOnly} /></Field>
            </div>
          </Card>
        </div>
      )}

      {tab === 'fotos' && (
        <Card title="Registro fotográfico">
          <PhotoGallery fotos={os.fotos} onChange={(fotos) => upd({ fotos })} readOnly={readOnly} />
        </Card>
      )}

      {tab === 'assin' && (
        <Card title="Assinaturas e liberação">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className={sec}>Executante</p>
              <SignaturePad label={l.profissionalMap.get(os.responsavelId || '')?.nome || 'Técnico executante'} value={os.assinaturaTecnico} onChange={(v) => upd({ assinaturaTecnico: v })} />
            </div>
            <div className="space-y-2">
              <p className={sec}>Responsável (cliente)</p>
              <SignaturePad label="Responsável local" value={os.assinaturaCliente} onChange={(v) => upd({ assinaturaCliente: v })} />
              <Input placeholder="Nome de quem assina" value={os.nomeAssinante || ''} onChange={(e) => upd({ nomeAssinante: e.target.value })} />
              <Input placeholder="Documento / matrícula" value={os.docAssinante || ''} onChange={(e) => upd({ docAssinante: e.target.value })} />
            </div>
            <div className="space-y-2">
              <p className={sec}>Supervisor de manutenção</p>
              <Select value={os.supervisorId || ''} onChange={(e) => upd({ supervisorId: e.target.value || undefined })} disabled={!pode('liberar')}>
                <option value="">— selecione —</option>
                {l.profissionais.filter((p) => p.ativo && p.perfil !== 'tecnico').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              {pode('liberar') ? (
                <SignaturePad label="Assinatura do supervisor" value={os.assinaturaSupervisor} onChange={(v) => upd({ assinaturaSupervisor: v })} />
              ) : (
                <p className="text-xs text-slate-500">A liberação é feita pelo supervisor ou gestor.</p>
              )}
              <Field label="Data / hora de liberação"><Input value={os.liberacao ? fmtDateTime(os.liberacao) : 'Não liberada'} disabled /></Field>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Avaliação do atendimento</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => upd({ avaliacao: n })} aria-label={`${n} estrelas`}>
                  <Star size={26} className={n <= (os.avaliacao || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === 'hist' && (
        <Card title="Histórico">
          <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
            {[...os.historico].reverse().map((h, i) => (
              <li key={i}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600 dark:border-slate-900" />
                <p className="text-sm text-slate-800 dark:text-slate-100">{h.texto}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(h.data)}{h.usuario && ` · ${h.usuario}`}</p>
              </li>
            ))}
          </ol>
          {os.origem === 'preventiva' && <p className="mt-4 text-xs text-slate-500">Gerada pelas rotinas de manutenção dos equipamentos {l.pmocMap.get(os.pmocId || '')?.codigo && `(${l.pmocMap.get(os.pmocId || '')?.codigo})`}.</p>}
        </Card>
      )}

      {isNew && (
        <div className="mt-4 flex justify-end">
          <Button onClick={criar}>Criar OS</Button>
        </div>
      )}
    </div>
  );
}
