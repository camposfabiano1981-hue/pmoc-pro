import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Copy, Pause, Play, Printer, Square, Star, Trash2, Wind, XCircle,
} from 'lucide-react';
import { db, nowIso, uid } from '../db/db';
import type { ItemChecklist, ItemOsEquip, OS, ResultadoItem, StatusOS } from '../db/types';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Select, Tabs, Textarea, cx, useConfirm, useToast } from '../components/ui';
import { PecasEditor, PhotoGallery, ServicosEditor, SignaturePad, totais } from '../components/widgets';
import { useLookups, equipLabel } from '../lib/lookups';
import { FLUIDOS, OS_FINALIZADAS, PRIORIDADES, STATUS_EQUIPAMENTO, STATUS_OS, TIPOS_OS, periodicidadeSigla, statusOs } from '../lib/catalogs';
import { fmtDateTime, fmtHoras, localDateTimeStr, money, n2, todayStr } from '../lib/format';
import { baixarPecas, criarOS, horasTrabalhadas, isAtrasada, MEDICOES_CAMPOS, novaOS, prazoSla } from '../lib/osHelpers';
import { checklistDe, foraDaFaixa } from '../lib/schedule';
import { diagnosticar } from '../lib/hvac';

type Tab = 'geral' | 'equip' | 'itens' | 'exec' | 'fotos' | 'encerrar' | 'hist';

const RESULTADOS: { v: ResultadoItem; label: string; cls: string }[] = [
  { v: 'ok', label: 'OK', cls: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'corrigido', label: 'Corrigido', cls: 'bg-sky-600 text-white border-sky-600' },
  { v: 'nok', label: 'NOK', cls: 'bg-rose-600 text-white border-rose-600' },
  { v: 'na', label: 'N/A', cls: 'bg-slate-500 text-white border-slate-500' },
];

function ChecklistItemRow({ c, onChange, editable, onRemove }: { c: ItemChecklist; onChange: (p: Partial<ItemChecklist>) => void; editable?: boolean; onRemove?: () => void }) {
  const fora = c.tipo === 'medicao' && foraDaFaixa(c.valor, c.min, c.max);
  return (
    <div className={cx('rounded-lg border p-2.5', c.resultado === 'nok' ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-700')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800 dark:text-slate-100">
            {c.periodicidade && <span className="mr-1.5 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{periodicidadeSigla(c.periodicidade)}</span>}
            {!editable && c.descricao}
          </p>
          {editable && (
            <div className="flex items-center gap-1">
              <Input className="py-1" value={c.descricao} placeholder="Descreva a atividade" onChange={(e) => onChange({ descricao: e.target.value })} />
              <Select className="w-28 py-1" value={c.tipo} onChange={(e) => onChange({ tipo: e.target.value as ItemChecklist['tipo'] })}>
                <option value="check">Verificação</option>
                <option value="medicao">Medição</option>
              </Select>
              {c.tipo === 'medicao' && <Input className="w-20 py-1" placeholder="Unid." value={c.unidade || ''} onChange={(e) => onChange({ unidade: e.target.value })} />}
              {onRemove && <IconButton title="Remover item" onClick={onRemove}><Trash2 size={14} /></IconButton>}
            </div>
          )}
          {c.grupo && <p className="text-[11px] text-slate-500">{c.grupo}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {RESULTADOS.map((r) => (
            <button
              key={r.v}
              type="button"
              onClick={() => onChange({ resultado: c.resultado === r.v ? '' : r.v })}
              className={cx('rounded-md border px-2 py-1 text-xs font-semibold', c.resultado === r.v ? r.cls : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {c.tipo === 'medicao' && (
          <div className="flex items-center gap-1">
            <Input className={cx('w-28 py-1', fora && 'border-amber-500 ring-2 ring-amber-300')} inputMode="decimal" placeholder="Valor" value={c.valor || ''} onChange={(e) => onChange({ valor: e.target.value })} />
            <span className="text-xs text-slate-500">
              {c.unidade}
              {(c.min !== undefined || c.max !== undefined) && ` (ref. ${c.min ?? '…'}–${c.max ?? '…'})`}
            </span>
            {fora && <AlertTriangle size={14} className="text-amber-500" />}
          </div>
        )}
        <Input className="min-w-[160px] flex-1 py-1" placeholder="Observação" value={c.obs || ''} onChange={(e) => onChange({ obs: e.target.value })} />
      </div>
    </div>
  );
}

function EquipCard({ item, onChange, onRemove, osId, readOnly }: { item: ItemOsEquip; onChange: (p: Partial<ItemOsEquip>) => void; onRemove: () => void; osId: string; readOnly: boolean }) {
  const l = useLookups();
  const toast = useToast();
  const eq = l.equipamentoMap.get(item.equipamentoId);
  const plano = eq?.planoId ? l.planoMap.get(eq.planoId) : undefined;
  const [open, setOpen] = useState(true);
  const [fl, setFl] = useState({ operacao: 'carga', kg: '' });
  const diag = useMemo(() => diagnosticar(item.medicoes, eq?.fluido, eq?.correnteNominal, eq?.tensao), [item.medicoes, eq]);
  const respondidos = item.checklist.filter((c) => c.resultado).length;
  const nok = item.checklist.filter((c) => c.resultado === 'nok').length;
  const updItem = (i: number, p: Partial<ItemChecklist>) => onChange({ checklist: item.checklist.map((c, k) => (k === i ? { ...c, ...p } : c)) });

  const registrarFluido = async () => {
    const kg = Number(fl.kg.replace(',', '.'));
    if (!eq || !(kg >= 0)) return;
    const ts = nowIso();
    await db.fluidos.add({ id: uid(), createdAt: ts, updatedAt: ts, equipamentoId: eq.id, data: todayStr(), operacao: fl.operacao as never, fluido: eq.fluido || 'R-410A', quantidadeKg: kg, osId });
    setFl({ ...fl, kg: '' });
    toast('Registro de fluido salvo.');
  };

  return (
    <Card
      className={cx(item.concluido && 'ring-1 ring-emerald-300 dark:ring-emerald-800')}
      title={
        <button className="flex items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>{equipLabel(eq, l)}</span>
          {item.concluido && <CheckCircle2 size={16} className="text-emerald-600" />}
        </button>
      }
      actions={
        <>
          <Badge>{respondidos}/{item.checklist.length} itens</Badge>
          {nok > 0 && <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">{nok} NOK</Badge>}
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Plano: {plano?.nome || 'sem plano'}</span>
            <span>· Fluido: {eq?.fluido || '—'}</span>
            <span>· Corrente nominal: {eq?.correnteNominal ? `${eq.correnteNominal} A` : '—'}</span>
            <span>· Tensão: {eq?.tensao || '—'}</span>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<CheckCheck size={14} />} onClick={() => onChange({ checklist: item.checklist.map((c) => (c.resultado ? c : { ...c, resultado: 'ok' })) })}>
                Marcar pendentes como OK
              </Button>
              {plano && (
                <Button size="sm" variant="outline" icon={<ClipboardList size={14} />} onClick={() => onChange({ checklist: checklistDe(plano.atividades.filter((a) => a.periodicidade !== 'na')) })}>
                  Carregar checklist completo do plano
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onChange({ checklist: [...item.checklist, { descricao: '', tipo: 'check', resultado: '' }] })}>
                + Item
              </Button>
              <Button size="sm" variant={item.concluido ? 'success' : 'secondary'} icon={<CheckCircle2 size={14} />} onClick={() => onChange({ concluido: !item.concluido })}>
                {item.concluido ? 'Equipamento concluído' : 'Marcar equipamento concluído'}
              </Button>
            </div>
          )}
          {item.checklist.length > 0 && (
            <div className="space-y-2">
              {item.checklist.map((c, i) => (
                <ChecklistItemRow key={i} c={c} editable={!readOnly && !c.atividadeId} onChange={(p) => updItem(i, p)} onRemove={() => onChange({ checklist: item.checklist.filter((_, k) => k !== i) })} />
              ))}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">Medições de campo e diagnóstico</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {MEDICOES_CAMPOS.map((m) => (
                <Field key={m.key} label={`${m.label} (${m.unidade})`}>
                  <Input inputMode="decimal" value={item.medicoes[m.key] || ''} onChange={(e) => onChange({ medicoes: { ...item.medicoes, [m.key]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">ΔT (retorno − insuflamento)</p><p className="font-semibold">{diag.deltaT !== undefined ? `${n2(diag.deltaT)} K` : '—'}</p></div>
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Superaquecimento</p><p className="font-semibold">{diag.superaquecimento !== undefined ? `${n2(diag.superaquecimento)} K` : '—'}{diag.tSatSuccao !== undefined && <span className="text-xs font-normal text-slate-500"> (Tsat {n2(diag.tSatSuccao)} °C)</span>}</p></div>
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Sub-resfriamento</p><p className="font-semibold">{diag.subresfriamento !== undefined ? `${n2(diag.subresfriamento)} K` : '—'}{diag.tSatDescarga !== undefined && <span className="text-xs font-normal text-slate-500"> (Tsat {n2(diag.tSatDescarga)} °C)</span>}</p></div>
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800"><p className="text-[11px] text-slate-500">Carga elétrica</p><p className="font-semibold">{diag.cargaPct !== undefined ? `${diag.cargaPct}% da nominal` : '—'}</p></div>
            </div>
            {diag.alertas.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                {diag.alertas.map((a) => (
                  <li key={a} className="flex gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{a}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Observações do equipamento" className="md:col-span-2">
              <Textarea rows={2} value={item.obs || ''} onChange={(e) => onChange({ obs: e.target.value })} />
            </Field>
            {eq && (
              <Field label="Situação do equipamento" help="Atualiza o cadastro imediatamente">
                <Select value={eq.status} onChange={async (e) => { await db.equipamentos.update(eq.id, { status: e.target.value as never, updatedAt: nowIso() }); toast('Situação do equipamento atualizada.'); }}>
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
        const o = novaOS({ tipo, unidadeId: eq?.unidadeId, clienteId: unidade?.clienteId, ambienteId: eq?.ambienteId, titulo: eq ? `${tipo} — ${eq.tag} ${eq.tipo}` : '' });
        if (eq) o.equipamentos = [{ equipamentoId: eq.id, checklist: [], medicoes: {} }];
        o.prazo = prazoSla(o.prioridade);
        setOs(o);
      } else {
        const o = await db.os.get(id!);
        setOs(o || null);
      }
      setTimeout(() => (loaded.current = true), 0);
    })();
  }, [id, isNew, params]);

  // salvamento automático (OS existentes)
  useEffect(() => {
    if (!os || isNew || !loaded.current) return;
    setSaved(false);
    const t = setTimeout(async () => {
      await db.os.put({ ...os, updatedAt: nowIso() });
      setSaved(true);
    }, 700);
    return () => clearTimeout(t);
  }, [os, isNew]);

  const upd = (patch: Partial<OS>) => setOs((o) => (o ? { ...o, ...patch } : o));
  const log = (o: OS, texto: string): OS => ({ ...o, historico: [...o.historico, { data: nowIso(), texto }] });

  if (os === null && !isNew) return <p className="text-sm text-slate-500">OS não encontrada.</p>;
  if (!os) return <p className="text-sm text-slate-500">Carregando…</p>;

  const readOnly = os.status === 'validada' || os.status === 'cancelada';
  const unidade = l.unidadeMap.get(os.unidadeId || '');
  const contrato = l.contratoMap.get(os.contratoId || '');
  const equipsDaUnidade = l.equipamentos.filter((e) => e.unidadeId === os.unidadeId && !os.equipamentos.some((x) => x.equipamentoId === e.id));
  const t = totais(os.pecas, os.servicos, os.deslocamento, os.desconto);
  const horas = horasTrabalhadas(os);
  const custoMO = os.apontamentos.reduce((acc, a) => {
    const p = l.profissionalMap.get(a.profissionalId);
    const h = Math.max(0, (new Date(a.fim || localDateTimeStr()).getTime() - new Date(a.inicio).getTime()) / 3600_000);
    return acc + h * (p?.valorHora || 0);
  }, 0);
  const st = statusOs(os.status);
  const pendentesChecklist = os.equipamentos.reduce((a, e) => a + e.checklist.filter((c) => !c.resultado).length, 0);

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
    let o = { ...os, status: s };
    const agora = localDateTimeStr();
    if (s === 'em_execucao') {
      if (!o.inicio) o.inicio = agora;
      const resp = o.responsavelId || o.tecnicosIds[0];
      if (resp && !o.apontamentos.some((a) => !a.fim)) o.apontamentos = [...o.apontamentos, { profissionalId: resp, inicio: agora }];
    }
    if (s === 'pausada' || s === 'aguardando_peca' || s === 'concluida') o.apontamentos = o.apontamentos.map((a) => (a.fim ? a : { ...a, fim: agora }));
    if (s === 'concluida') {
      if (pendentesChecklist > 0 && !(await confirm({ title: 'Checklist incompleto', message: `Há ${pendentesChecklist} item(ns) de checklist sem resposta. Concluir mesmo assim?`, confirmText: 'Concluir' }))) return;
      o.fim = o.fim || agora;
      if (o.pecas.some((p) => p.pecaId && !p.baixado) && (await confirm({ title: 'Baixa de estoque', message: 'Dar baixa no estoque das peças utilizadas nesta OS?', confirmText: 'Dar baixa' }))) {
        o = await baixarPecas(o);
        toast('Baixa de estoque realizada.');
      }
      o.equipamentos = o.equipamentos.map((e) => ({ ...e, concluido: true }));
      if (o.ocorrenciaId) await db.ocorrencias.update(o.ocorrenciaId, { status: 'encerrada', updatedAt: nowIso() });
    }
    if (s === 'cancelada' && !(await confirm({ title: 'Cancelar OS', message: 'Deseja cancelar esta OS?', danger: true, confirmText: 'Cancelar OS' }))) return;
    o = log(o, `Status alterado para "${statusOs(s).label}"`);
    setOs(o);
    toast(`OS ${statusOs(s).label.toLowerCase()}.`);
  };

  const excluir = async () => {
    if (!(await confirm({ title: 'Excluir OS', message: 'Excluir definitivamente esta OS? Movimentos de estoque já realizados não serão revertidos.', danger: true, confirmText: 'Excluir' }))) return;
    await db.os.delete(os.id);
    toast('OS excluída.');
    navigate('/os');
  };

  const duplicar = async () => {
    const copia = novaOS({ ...structuredClone(os), id: uid(), numero: '', status: 'aberta', inicio: undefined, fim: undefined, apontamentos: [], fotos: [], assinaturaCliente: undefined, assinaturaTecnico: undefined, preventivaRef: undefined, pecas: os.pecas.map((p) => ({ ...p, baixado: false })), historico: [{ data: nowIso(), texto: `Duplicada de ${os.numero}` }] });
    copia.equipamentos = copia.equipamentos.map((e) => ({ ...e, concluido: false, checklist: e.checklist.map((c) => ({ ...c, resultado: '', valor: '', obs: '' })), medicoes: {} }));
    const rec = await criarOS(copia);
    toast(`OS ${rec.numero} criada.`);
    navigate(`/os/${rec.id}`);
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: 'geral', label: 'Dados gerais' },
    { value: 'equip', label: `Equipamentos e checklist (${os.equipamentos.length})` },
    { value: 'itens', label: `Peças e serviços (${os.pecas.length + os.servicos.length})` },
    { value: 'exec', label: 'Execução e laudo' },
    { value: 'fotos', label: `Fotos (${os.fotos.length})` },
    { value: 'encerrar', label: 'Assinaturas' },
    { value: 'hist', label: 'Histórico' },
  ];

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
              {!OS_FINALIZADAS.includes(os.status) && <Button icon={<CheckCircle2 size={16} />} onClick={() => setStatus('concluida')}>Concluir</Button>}
              {os.status === 'concluida' && <Button variant="success" icon={<CheckCheck size={16} />} onClick={() => setStatus('validada')}>Validar</Button>}
              <Link to={`/os/${os.id}/imprimir`}><Button variant="outline" icon={<Printer size={16} />}>Imprimir</Button></Link>
              <IconButton title="Duplicar OS" onClick={duplicar}><Copy size={16} /></IconButton>
              {!OS_FINALIZADAS.includes(os.status) && <IconButton title="Cancelar OS" onClick={() => setStatus('cancelada')}><XCircle size={16} /></IconButton>}
              <IconButton title="Excluir OS" onClick={excluir}><Trash2 size={16} /></IconButton>
            </>
          )
        }
      />

      <Tabs tabs={isNew ? tabs.slice(0, 2) : tabs} value={tab} onChange={setTab} />

      {tab === 'geral' && (
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Título / resumo" required className="md:col-span-4">
              <Input value={os.titulo} onChange={(e) => upd({ titulo: e.target.value })} placeholder="Ex.: Equipamento não gela — Sala RH" disabled={readOnly} />
            </Field>
            <Field label="Tipo">
              <Select value={os.tipo} onChange={(e) => upd({ tipo: e.target.value })} disabled={readOnly}>
                {TIPOS_OS.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={os.prioridade} onChange={(e) => { const p = e.target.value as OS['prioridade']; upd({ prioridade: p, prazo: prazoSla(p, contrato, new Date(os.dataAbertura)) }); }} disabled={readOnly}>
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={os.status} onChange={(e) => upd({ status: e.target.value as StatusOS })}>
                {STATUS_OS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Solicitante">
              <Input value={os.solicitante || ''} onChange={(e) => upd({ solicitante: e.target.value })} disabled={readOnly} />
            </Field>
            <Field label="Cliente">
              <Select value={os.clienteId || ''} onChange={(e) => upd({ clienteId: e.target.value || undefined, unidadeId: undefined, ambienteId: undefined })} disabled={readOnly}>
                <option value="">— selecione —</option>
                {l.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Unidade">
              <Select value={os.unidadeId || ''} onChange={(e) => { const u = l.unidadeMap.get(e.target.value); upd({ unidadeId: e.target.value || undefined, clienteId: u?.clienteId || os.clienteId, ambienteId: undefined }); }} disabled={readOnly}>
                <option value="">— selecione —</option>
                {l.unidades.filter((u) => !os.clienteId || u.clienteId === os.clienteId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
            <Field label="Ambiente">
              <Select value={os.ambienteId || ''} onChange={(e) => upd({ ambienteId: e.target.value || undefined })} disabled={readOnly}>
                <option value="">— selecione —</option>
                {l.ambientes.filter((a) => a.unidadeId === os.unidadeId).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Field>
            <Field label="Contrato">
              <Select value={os.contratoId || ''} onChange={(e) => upd({ contratoId: e.target.value || undefined })} disabled={readOnly}>
                <option value="">— sem contrato —</option>
                {l.contratos.filter((c) => !os.clienteId || c.clienteId === os.clienteId).map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}
              </Select>
            </Field>
            <Field label="Data agendada">
              <Input type="date" value={os.dataAgendada || ''} onChange={(e) => upd({ dataAgendada: e.target.value })} disabled={readOnly} />
            </Field>
            <Field label="Prazo (SLA)" help={contrato ? `SLA do contrato ${contrato.numero}` : 'Prazo padrão pela prioridade'}>
              <Input type="date" value={os.prazo || ''} onChange={(e) => upd({ prazo: e.target.value })} disabled={readOnly} />
            </Field>
            <Field label="Responsável">
              <Select value={os.responsavelId || ''} onChange={(e) => upd({ responsavelId: e.target.value || undefined })} disabled={readOnly}>
                <option value="">— selecione —</option>
                {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
            <Field label="Abertura">
              <Input value={fmtDateTime(os.dataAbertura)} disabled />
            </Field>
            <Field label="Equipe técnica" className="md:col-span-4">
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
            <Field label="Descrição da solicitação / problema" className="md:col-span-4">
              <Textarea value={os.descricao || ''} onChange={(e) => upd({ descricao: e.target.value })} disabled={readOnly} />
            </Field>
          </div>
          {unidade && <p className="mt-3 text-xs text-slate-500">Endereço: {[unidade.endereco, unidade.numero, unidade.bairro, unidade.cidade, unidade.uf].filter(Boolean).join(', ')} {unidade.responsavelLocal && `· Responsável local: ${unidade.responsavelLocal}`}</p>}
        </Card>
      )}

      {tab === 'equip' && (
        <div className="space-y-4">
          {!readOnly && (
            <Card>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={os.unidadeId ? 'Adicionar equipamento da unidade' : 'Selecione a unidade em Dados gerais'} className="min-w-[240px] flex-1">
                  <Select value={addEq} onChange={(e) => setAddEq(e.target.value)} disabled={!os.unidadeId}>
                    <option value="">— selecione —</option>
                    {equipsDaUnidade.map((e) => <option key={e.id} value={e.id}>{equipLabel(e, l)}</option>)}
                  </Select>
                </Field>
                <Button
                  disabled={!addEq}
                  onClick={() => {
                    const eq = l.equipamentoMap.get(addEq);
                    const plano = eq?.planoId ? l.planoMap.get(eq.planoId) : undefined;
                    const checklist = os.tipo === 'Preventiva' && plano ? checklistDe(plano.atividades.filter((a) => a.periodicidade !== 'na')) : [];
                    upd({ equipamentos: [...os.equipamentos, { equipamentoId: addEq, checklist, medicoes: {} }] });
                    setAddEq('');
                  }}
                >
                  Adicionar
                </Button>
                <Button
                  variant="outline"
                  disabled={!equipsDaUnidade.length}
                  onClick={() => upd({ equipamentos: [...os.equipamentos, ...equipsDaUnidade.filter((e) => !os.ambienteId || e.ambienteId === os.ambienteId).map((e) => ({ equipamentoId: e.id, checklist: [], medicoes: {} }))] })}
                >
                  Adicionar todos {os.ambienteId ? 'do ambiente' : 'da unidade'}
                </Button>
              </div>
            </Card>
          )}
          {os.equipamentos.length === 0 && <p className="text-sm text-slate-500">Nenhum equipamento vinculado.</p>}
          {os.equipamentos.map((item, i) => (
            <EquipCard
              key={item.equipamentoId}
              item={item}
              osId={os.id}
              readOnly={readOnly}
              onChange={(p) => upd({ equipamentos: os.equipamentos.map((x, k) => (k === i ? { ...x, ...p } : x)) })}
              onRemove={() => upd({ equipamentos: os.equipamentos.filter((_, k) => k !== i) })}
            />
          ))}
        </div>
      )}

      {tab === 'itens' && (
        <div className="space-y-4">
          <Card
            title="Peças e materiais"
            actions={
              os.pecas.some((p) => p.pecaId && !p.baixado) && !readOnly ? (
                <Button size="sm" variant="outline" onClick={async () => { const o = await baixarPecas(os); setOs(log(o, 'Baixa de peças no estoque')); toast('Baixa de estoque realizada.'); }}>
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
          <Card title="Resumo financeiro">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Deslocamento (R$)"><Input type="number" step="0.01" value={os.deslocamento ?? ''} onChange={(e) => upd({ deslocamento: Number(e.target.value) || 0 })} disabled={readOnly} /></Field>
              <Field label="Desconto (R$)"><Input type="number" step="0.01" value={os.desconto ?? ''} onChange={(e) => upd({ desconto: Number(e.target.value) || 0 })} disabled={readOnly} /></Field>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Peças / Serviços</p><p className="font-semibold">{money(t.pecas)} / {money(t.servicos)}</p></div>
              <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-950"><p className="text-xs text-brand-700 dark:text-brand-300">Total da OS</p><p className="text-xl font-bold text-brand-900 dark:text-white">{money(t.total)}</p></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Custo interno estimado: peças {money(t.custoPecas)} + mão de obra {money(custoMO)} ({fmtHoras(horas)}) = <b>{money(t.custoPecas + custoMO)}</b> · margem {money(t.total - t.custoPecas - custoMO)}</p>
          </Card>
        </div>
      )}

      {tab === 'exec' && (
        <div className="space-y-4">
          <Card title={`Apontamento de horas — total ${fmtHoras(horas)}`}>
            <div className="space-y-2">
              {os.apontamentos.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <Select className="col-span-12 sm:col-span-4" value={a.profissionalId} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, profissionalId: e.target.value } : x)) })} disabled={readOnly}>
                    {l.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </Select>
                  <Input className="col-span-5 sm:col-span-3" type="datetime-local" value={a.inicio} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, inicio: e.target.value } : x)) })} disabled={readOnly} />
                  <Input className="col-span-5 sm:col-span-3" type="datetime-local" value={a.fim || ''} onChange={(e) => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, fim: e.target.value } : x)) })} disabled={readOnly} />
                  <div className="col-span-2 flex justify-end gap-1">
                    {!a.fim && !readOnly && <Button size="sm" variant="outline" onClick={() => upd({ apontamentos: os.apontamentos.map((x, k) => (k === i ? { ...x, fim: localDateTimeStr() } : x)) })}>Parar</Button>}
                    {!readOnly && <IconButton title="Remover" onClick={() => upd({ apontamentos: os.apontamentos.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton>}
                  </div>
                </div>
              ))}
              {!readOnly && (
                <Button size="sm" variant="outline" icon={<Play size={14} />} onClick={() => upd({ apontamentos: [...os.apontamentos, { profissionalId: os.responsavelId || os.tecnicosIds[0] || l.profissionais[0]?.id || '', inicio: localDateTimeStr() }] })}>
                  Iniciar apontamento agora
                </Button>
              )}
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

      {tab === 'encerrar' && (
        <Card title="Assinaturas e avaliação">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <SignaturePad label={`Técnico responsável${os.responsavelId ? ' — ' + l.profissionalMap.get(os.responsavelId)?.nome : ''}`} value={os.assinaturaTecnico} onChange={(v) => upd({ assinaturaTecnico: v })} />
            </div>
            <div className="space-y-2">
              <SignaturePad label="Cliente / responsável local" value={os.assinaturaCliente} onChange={(v) => upd({ assinaturaCliente: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome de quem assina" value={os.nomeAssinante || ''} onChange={(e) => upd({ nomeAssinante: e.target.value })} />
                <Input placeholder="Documento / matrícula" value={os.docAssinante || ''} onChange={(e) => upd({ docAssinante: e.target.value })} />
              </div>
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
                <p className="text-xs text-slate-500">{fmtDateTime(h.data)}</p>
              </li>
            ))}
          </ol>
          {os.origem === 'preventiva' && <p className="mt-4 text-xs text-slate-500">Gerada pelo cronograma do PMOC {l.pmocMap.get(os.pmocId || '')?.codigo}.</p>}
          {os.ocorrenciaId && <p className="mt-1 text-xs text-slate-500">Origem: ocorrência vinculada.</p>}
        </Card>
      )}

      {isNew && (
        <div className="mt-4 flex justify-end">
          <Button onClick={criar} icon={<Wind size={16} />}>Criar OS</Button>
        </div>
      )}
    </div>
  );
}
