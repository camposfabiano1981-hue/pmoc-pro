import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ClipboardPlus, Printer, Receipt } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, Button, IconButton, useToast } from '../components/ui';
import { PecasEditor, ServicosEditor, totais } from '../components/widgets';
import { db, nowIso } from '../db/db';
import type { Ocorrencia, Orcamento } from '../db/types';
import { PRIORIDADES, STATUS_OCORRENCIA, STATUS_ORCAMENTO, TIPOS_OCORRENCIA, prioridade } from '../lib/catalogs';
import { addDays, fmtDate, fmtDateTime, localDateTimeStr, money, todayStr } from '../lib/format';
import { equipLabel } from '../lib/lookups';
import { criarOS, novaOS, prazoSla } from '../lib/osHelpers';

function GerarOsDeOcorrencia({ oc }: { oc: Ocorrencia }) {
  const navigate = useNavigate();
  const toast = useToast();
  if (oc.osId)
    return (
      <Link to={`/os/${oc.osId}`}>
        <IconButton title="Abrir OS vinculada"><ClipboardPlus size={15} className="text-brand-600" /></IconButton>
      </Link>
    );
  const gerar = async () => {
    const eq = oc.equipamentoId ? await db.equipamentos.get(oc.equipamentoId) : undefined;
    const unidade = oc.unidadeId ? await db.unidades.get(oc.unidadeId) : undefined;
    const contrato = unidade ? (await db.contratos.where('clienteId').equals(unidade.clienteId).toArray()).find((c) => c.status === 'ativo') : undefined;
    const os = await criarOS(
      novaOS({
        tipo: oc.tipo === 'Anomalia crítica' ? 'Emergencial' : 'Corretiva',
        prioridade: oc.prioridade,
        origem: 'ocorrencia',
        ocorrenciaId: oc.id,
        clienteId: unidade?.clienteId,
        unidadeId: oc.unidadeId,
        ambienteId: oc.ambienteId,
        contratoId: contrato?.id,
        titulo: `${oc.tipo}${eq ? ' — ' + eq.tag : ''}: ${oc.descricao.slice(0, 60)}`,
        solicitante: oc.emitente,
        descricao: oc.descricao,
        responsavelId: oc.executorId,
        tecnicosIds: oc.executorId ? [oc.executorId] : [],
        prazo: oc.limiteExecucao?.slice(0, 10) || prazoSla(oc.prioridade, contrato),
        equipamentos: eq ? [{ equipamentoId: eq.id, checklist: [], medicoes: {} }] : [],
        historico: [{ data: nowIso(), texto: `OS criada a partir da ocorrência ${oc.numero}` }],
      }),
    );
    await db.ocorrencias.update(oc.id, { status: 'convertida', osId: os.id, updatedAt: nowIso() });
    toast(`OS ${os.numero} gerada.`);
    navigate(`/os/${os.id}`);
  };
  return (
    <IconButton title="Gerar OS" onClick={gerar}>
      <ClipboardPlus size={15} />
    </IconButton>
  );
}

export const ocorrenciasCfg: EntityConfig = {
  table: 'ocorrencias',
  title: 'Ocorrências e chamados',
  singular: 'Ocorrência',
  icon: <AlertOctagon size={20} />,
  subtitle: 'Registro de quebras, anomalias e chamados — converta em OS com um clique',
  headerActions: (
    <Link to="/ocorrencias/branco/imprimir">
      <Button variant="outline" icon={<Printer size={16} />}>Formulário em branco</Button>
    </Link>
  ),
  numbering: { field: 'numero', kind: 'oc' },
  sort: { key: 'dataHora', dir: 'desc' },
  fields: [
    { name: 'numero', label: 'Número', type: 'text', span: 1, placeholder: 'Automático' },
    { name: 'tipo', label: 'Tipo de ocorrência', type: 'select', options: TIPOS_OCORRENCIA, required: true, span: 1 },
    { name: 'prioridade', label: 'Prioridade', type: 'select', options: PRIORIDADES.map((p) => ({ value: p.value, label: p.label })), span: 1 },
    { name: 'status', label: 'Status', type: 'select', options: STATUS_OCORRENCIA.map((s) => ({ value: s.value, label: s.label })), span: 1 },
    { name: 'dataHora', label: 'Emissão', type: 'datetime', required: true, span: 1 },
    { name: 'limiteExecucao', label: 'Limite p/ execução', type: 'datetime', span: 1 },
    { name: 'emitente', label: 'Emitente', type: 'text', span: 2 },
    {
      name: 'unidadeId', label: 'Unidade', type: 'ref', span: 2, ref: { list: (l) => l.unidades },
      onChangeEffect: () => ({ ambienteId: undefined, equipamentoId: undefined }),
    },
    { name: 'ambienteId', label: 'Área / ambiente', type: 'ref', span: 2, ref: { list: (l) => l.ambientes, filter: (r, f) => r.unidadeId === f.unidadeId } },
    {
      name: 'equipamentoId', label: 'Equipamento', type: 'ref', span: 2,
      ref: { list: (l) => l.equipamentos, filter: (r, f) => r.unidadeId === f.unidadeId && (!f.ambienteId || r.ambienteId === f.ambienteId), label: (r, l) => equipLabel(r as never, l) },
    },
    { name: 'executorId', label: 'Executor designado', type: 'ref', span: 2, ref: { list: (l) => l.profissionais } },
    { name: 'descricao', label: 'Descrição da ocorrência', type: 'textarea', required: true, span: 4 },
    { name: 'analise', label: 'Análise / tratativa', type: 'textarea', span: 4 },
  ],
  columns: [
    { key: 'numero', label: 'Nº', render: (r) => <span className="font-mono text-xs font-semibold">{r.numero}</span> },
    { key: 'status', label: 'Status', value: (r) => STATUS_OCORRENCIA.find((s) => s.value === r.status)?.label, render: (r) => { const s = STATUS_OCORRENCIA.find((x) => x.value === r.status); return <Badge className={s?.cor}>{s?.label}</Badge>; } },
    { key: 'tipo', label: 'Tipo' },
    { key: 'dataHora', label: 'Emissão', value: (r) => r.dataHora, render: (r) => fmtDateTime(r.dataHora) },
    { key: 'descricao', label: 'Descrição', render: (r) => <span className="line-clamp-2 max-w-md">{r.descricao}</span> },
    { key: 'unidadeId', label: 'Unidade / área', value: (r, l) => [l.unidadeMap.get(r.unidadeId)?.nome, l.ambienteMap.get(r.ambienteId)?.nome].filter(Boolean).join(' / ') },
    { key: 'equipamentoId', label: 'Equip.', value: (r, l) => l.equipamentoMap.get(r.equipamentoId)?.tag },
    { key: 'prioridade', label: 'Prioridade', value: (r) => prioridade(r.prioridade).label, render: (r) => <Badge className={prioridade(r.prioridade).cor}>{prioridade(r.prioridade).label}</Badge> },
    { key: 'emitente', label: 'Emitente' },
  ],
  filters: [
    { key: 'status', label: 'Status', options: () => STATUS_OCORRENCIA.map((s) => ({ value: s.value, label: s.label })), test: (r, v) => r.status === v },
    { key: 'tipo', label: 'Tipo', options: () => TIPOS_OCORRENCIA.map((t) => ({ value: t, label: t })), test: (r, v) => r.tipo === v },
    { key: 'unidadeId', label: 'Unidade', options: (l) => l.unidades.map((u) => ({ value: u.id, label: u.nome })), test: (r, v) => r.unidadeId === v },
  ],
  searchText: (r, l) => [r.numero, r.tipo, r.descricao, r.emitente, l.equipamentoMap.get(r.equipamentoId)?.tag].join(' '),
  defaults: (l) => ({ tipo: 'Chamado', prioridade: 'media', status: 'nao_analisada', dataHora: localDateTimeStr(), unidadeId: l.unidades[0]?.id }),
  rowActions: (r) => (
    <>
      <Link to={`/ocorrencias/${r.id}/imprimir`}><IconButton title="Imprimir ocorrência"><Printer size={15} /></IconButton></Link>
      <GerarOsDeOcorrencia oc={r as Ocorrencia} />
    </>
  ),
};

/* ---------------- Orçamentos ---------------- */
function ConverterOrcamento({ orc }: { orc: Orcamento }) {
  const navigate = useNavigate();
  const toast = useToast();
  if (orc.osId)
    return (
      <Link to={`/os/${orc.osId}`}>
        <IconButton title="Abrir OS gerada"><ClipboardPlus size={15} className="text-brand-600" /></IconButton>
      </Link>
    );
  const gerar = async () => {
    const os = await criarOS(
      novaOS({
        tipo: 'Corretiva',
        origem: 'orcamento',
        orcamentoId: orc.id,
        clienteId: orc.clienteId,
        unidadeId: orc.unidadeId,
        titulo: orc.titulo,
        descricao: orc.descricao,
        pecas: orc.pecas.map((p) => ({ ...p, baixado: false })),
        servicos: orc.servicos,
        desconto: orc.desconto,
        deslocamento: orc.deslocamento,
        historico: [{ data: nowIso(), texto: `OS criada a partir do orçamento ${orc.numero}` }],
      }),
    );
    await db.orcamentos.update(orc.id, { status: 'convertido', osId: os.id, updatedAt: nowIso() });
    toast(`OS ${os.numero} gerada a partir do orçamento.`);
    navigate(`/os/${os.id}`);
  };
  return (
    <IconButton title="Aprovar e gerar OS" onClick={gerar}>
      <ClipboardPlus size={15} />
    </IconButton>
  );
}

export const orcamentosCfg: EntityConfig = {
  table: 'orcamentos',
  title: 'Orçamentos',
  singular: 'Orçamento',
  icon: <Receipt size={20} />,
  numbering: { field: 'numero', kind: 'orc' },
  sort: { key: 'data', dir: 'desc' },
  formSize: 'xl',
  fields: [
    { name: 'numero', label: 'Número', type: 'text', span: 1, placeholder: 'Automático', section: 'Dados' },
    { name: 'status', label: 'Status', type: 'select', options: STATUS_ORCAMENTO.map((s) => ({ value: s.value, label: s.label })), span: 1, section: 'Dados' },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 1, section: 'Dados' },
    { name: 'validade', label: 'Validade', type: 'date', span: 1, section: 'Dados' },
    { name: 'clienteId', label: 'Cliente', type: 'ref', required: true, span: 2, section: 'Dados', ref: { list: (l) => l.clientes }, onChangeEffect: () => ({ unidadeId: undefined }) },
    { name: 'unidadeId', label: 'Unidade', type: 'ref', span: 2, section: 'Dados', ref: { list: (l) => l.unidades, filter: (r, f) => r.clienteId === f.clienteId } },
    { name: 'titulo', label: 'Título', type: 'text', required: true, span: 4, section: 'Dados' },
    { name: 'descricao', label: 'Descrição técnica / escopo', type: 'textarea', span: 4, section: 'Dados' },
    { name: 'servicos', label: 'Serviços', type: 'custom', span: 4, section: 'Itens', render: ({ value, onChange }) => <ServicosEditor itens={value || []} onChange={onChange} /> },
    { name: 'pecas', label: 'Peças e materiais', type: 'custom', span: 4, section: 'Itens', render: ({ value, onChange }) => <PecasEditor itens={value || []} onChange={onChange} /> },
    { name: 'deslocamento', label: 'Deslocamento (R$)', type: 'money', span: 1, section: 'Condições' },
    { name: 'desconto', label: 'Desconto (R$)', type: 'money', span: 1, section: 'Condições' },
    {
      name: 'total', label: 'Total', type: 'custom', span: 2, section: 'Condições',
      render: ({ form }) => <p className="rounded-lg bg-brand-50 px-3 py-2 text-lg font-bold text-brand-900 dark:bg-brand-950 dark:text-white">{money(totais(form.pecas || [], form.servicos || [], form.deslocamento, form.desconto).total)}</p>,
    },
    { name: 'prazoExecucao', label: 'Prazo de execução', type: 'text', span: 2, section: 'Condições' },
    { name: 'garantia', label: 'Garantia', type: 'text', span: 2, section: 'Condições' },
    { name: 'condicoes', label: 'Condições de pagamento', type: 'textarea', span: 4, section: 'Condições' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Condições' },
  ],
  columns: [
    { key: 'numero', label: 'Nº', render: (r) => <span className="font-mono text-xs font-semibold">{r.numero}</span> },
    { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => fmtDate(r.data) },
    { key: 'titulo', label: 'Título', render: (r) => <span className="font-medium">{r.titulo}</span> },
    { key: 'clienteId', label: 'Cliente', value: (r, l) => l.clienteMap.get(r.clienteId)?.nome },
    { key: 'total', label: 'Total', value: (r) => totais(r.pecas || [], r.servicos || [], r.deslocamento, r.desconto).total, render: (r) => money(totais(r.pecas || [], r.servicos || [], r.deslocamento, r.desconto).total) },
    { key: 'validade', label: 'Validade', value: (r) => r.validade, render: (r) => fmtDate(r.validade) },
    { key: 'status', label: 'Status', value: (r) => STATUS_ORCAMENTO.find((s) => s.value === r.status)?.label, render: (r) => { const s = STATUS_ORCAMENTO.find((x) => x.value === r.status); return <Badge className={s?.cor}>{s?.label}</Badge>; } },
  ],
  filters: [{ key: 'status', label: 'Status', options: () => STATUS_ORCAMENTO.map((s) => ({ value: s.value, label: s.label })), test: (r, v) => r.status === v }],
  searchText: (r, l) => [r.numero, r.titulo, r.descricao, l.clienteMap.get(r.clienteId)?.nome].join(' '),
  defaults: (l) => ({ status: 'rascunho', data: todayStr(), validade: addDays(todayStr(), 15), clienteId: l.clientes[0]?.id, pecas: [], servicos: [], desconto: 0, deslocamento: 0, garantia: '90 dias', condicoes: 'Pagamento à vista ou conforme contrato.' }),
  rowActions: (r) => (
    <>
      <Link to={`/orcamentos/${r.id}/imprimir`}><IconButton title="Imprimir"><Printer size={15} /></IconButton></Link>
      <ConverterOrcamento orc={r as Orcamento} />
    </>
  ),
};

