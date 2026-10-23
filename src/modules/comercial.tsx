import { useNavigate } from 'react-router-dom';
import { Calculator, ExternalLink, FileSignature, Target } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, IconButton, cx, useToast } from '../components/ui';
import type { EtapaOportunidade, Oportunidade } from '../db/types';
import { diffDays, fmtDateTime, money, todayStr } from '../lib/format';
import { contratoDaOportunidade, estudoDaOportunidade } from '../lib/precificacaoDb';

export const ETAPAS_OPORTUNIDADE: { value: EtapaOportunidade; label: string; cor: string; aberta: boolean }[] = [
  { value: 'prospeccao', label: 'Prospecção', cor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', aberta: true },
  { value: 'analise', label: 'Análise do edital', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', aberta: true },
  { value: 'proposta', label: 'Proposta em elaboração', cor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200', aberta: true },
  { value: 'disputa', label: 'Em disputa (sessão)', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', aberta: true },
  { value: 'habilitacao', label: 'Habilitação / recurso', cor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200', aberta: true },
  { value: 'ganha', label: 'Ganha', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', aberta: false },
  { value: 'perdida', label: 'Perdida', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200', aberta: false },
  { value: 'desistencia', label: 'Desistência / cancelada', cor: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', aberta: false },
];
export const etapaOportunidade = (v?: string) => ETAPAS_OPORTUNIDADE.find((e) => e.value === v) || ETAPAS_OPORTUNIDADE[0];

export const MODALIDADES = ['Pregão eletrônico', 'Concorrência', 'Dispensa eletrônica', 'Inexigibilidade', 'Credenciamento', 'Ata de registro de preços (adesão)', 'Cotação privada', 'Proposta direta'];
export const CRITERIOS = ['Menor preço global', 'Menor preço por lote', 'Menor preço por item', 'Maior desconto', 'Técnica e preço'];
export const PORTAIS = ['Compras.gov.br', 'Portal de Compras Públicas', 'BLL Compras', 'Licitanet', 'BNC', 'Licitações-e (Banco do Brasil)', 'PNCP', 'Portal próprio do órgão', 'Presencial / e-mail'];

/** Badge com a contagem regressiva até a sessão pública. */
export function SessaoBadge({ data, empilhado }: { data?: string; empilhado?: boolean }) {
  if (!data) return <span className="text-slate-400">—</span>;
  const dias = diffDays(data.slice(0, 10), todayStr()) ?? 0;
  const txt = dias < 0 ? 'realizada' : dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
  const cls = dias < 0 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : dias <= 3 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : dias <= 7 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200';
  return (
    <span className="whitespace-nowrap">
      {fmtDateTime(data)} {empilhado && <br />}<Badge className={cls}>{txt}</Badge>
    </span>
  );
}

function AcoesOportunidade({ op }: { op: Oportunidade }) {
  const navigate = useNavigate();
  const toast = useToast();
  const abrirEstudo = async () => {
    const e = await estudoDaOportunidade(op);
    navigate(`/precificacao/${e.id}`);
  };
  const gerarContrato = async () => {
    try {
      const c = await contratoDaOportunidade(op);
      toast(`Contrato ${c.numero} gerado — revise as cláusulas e imprima.`);
      navigate(`/contratos/${c.id}/imprimir`);
    } catch (e) {
      toast((e as Error).message, 'warning');
    }
  };
  return (
    <>
      {op.linkEdital && (
        <a href={op.linkEdital} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <IconButton title="Abrir edital"><ExternalLink size={15} /></IconButton>
        </a>
      )}
      <IconButton title={op.estudoId ? 'Abrir estudo de preço' : 'Criar estudo de preço'} onClick={abrirEstudo}>
        <Calculator size={15} className={op.estudoId ? 'text-brand-600' : undefined} />
      </IconButton>
      {op.etapa === 'ganha' &&
        (op.contratoId ? (
          <IconButton title="Abrir contrato" onClick={() => navigate(`/contratos/${op.contratoId}/imprimir`)}><FileSignature size={15} className="text-emerald-600" /></IconButton>
        ) : (
          <IconButton title="Gerar contrato" onClick={gerarContrato}><FileSignature size={15} /></IconButton>
        ))}
    </>
  );
}

/** Resumo do funil por etapa, taxa de sucesso e valores. */
export function FunilOportunidades({ rows }: { rows: Oportunidade[] }) {
  const abertas = rows.filter((r) => etapaOportunidade(r.etapa).aberta);
  const ganhas = rows.filter((r) => r.etapa === 'ganha');
  const perdidas = rows.filter((r) => r.etapa === 'perdida');
  const taxa = ganhas.length + perdidas.length ? Math.round((ganhas.length / (ganhas.length + perdidas.length)) * 100) : null;
  const maxValor = Math.max(1, ...ETAPAS_OPORTUNIDADE.map((e) => rows.filter((r) => r.etapa === e.value).reduce((a, r) => a + (r.valorEstimado || 0), 0)));
  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Funil de oportunidades (valor estimado)</p>
        <div className="space-y-1.5">
          {ETAPAS_OPORTUNIDADE.map((e) => {
            const lista = rows.filter((r) => r.etapa === e.value);
            const valor = lista.reduce((a, r) => a + (r.valorEstimado || 0), 0);
            return (
              <div key={e.value} className="flex items-center gap-2 text-xs">
                <span className="w-44 shrink-0 truncate text-slate-600 dark:text-slate-300">{e.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div className={cx('h-full rounded', e.value === 'ganha' ? 'bg-emerald-500' : e.value === 'perdida' ? 'bg-rose-400' : e.aberta ? 'bg-brand-500' : 'bg-slate-400')} style={{ width: `${(valor / maxValor) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-500">{lista.length}</span>
                <span className="w-28 text-right tabular-nums font-medium">{money(valor)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Em andamento</p>
          <p className="text-2xl font-bold">{abertas.length}</p>
          <p className="text-xs text-slate-500">{money(abertas.reduce((a, r) => a + (r.valorEstimado || 0), 0))}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Taxa de sucesso</p>
          <p className="text-2xl font-bold">{taxa === null ? '—' : `${taxa}%`}</p>
          <p className="text-xs text-slate-500">{ganhas.length} ganha(s) · {perdidas.length} perdida(s)</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase text-slate-500">Valor ganho (propostas vencedoras)</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{money(ganhas.reduce((a, r) => a + (r.valorProposta || 0), 0))}</p>
        </div>
      </div>
    </div>
  );
}

export const oportunidadesCfg: EntityConfig = {
  table: 'oportunidades',
  title: 'Oportunidades e licitações',
  singular: 'Oportunidade',
  icon: <Target size={20} />,
  subtitle: 'Funil comercial: licitações públicas e propostas privadas, do edital ao contrato',
  numbering: { field: 'numero', kind: 'op' },
  sort: { key: 'dataSessao', dir: 'asc' },
  formSize: 'xl',
  fields: [
    { name: 'numero', label: 'Número', type: 'text', span: 1, placeholder: 'Automático', section: 'Identificação' },
    { name: 'tipo', label: 'Tipo', type: 'select', span: 1, section: 'Identificação', options: [{ value: 'licitacao', label: 'Licitação pública' }, { value: 'privado', label: 'Proposta privada' }] },
    { name: 'etapa', label: 'Etapa', type: 'select', span: 2, section: 'Identificação', options: ETAPAS_OPORTUNIDADE.map((e) => ({ value: e.value, label: e.label })) },
    { name: 'titulo', label: 'Título', type: 'text', required: true, span: 4, section: 'Identificação', placeholder: 'Ex.: Manutenção preventiva e corretiva de 120 splits — Prefeitura de ...' },
    { name: 'clienteId', label: 'Cliente cadastrado', type: 'ref', span: 2, section: 'Identificação', ref: { list: (l) => l.clientes }, help: 'Necessário para gerar o contrato' },
    { name: 'orgao', label: 'Órgão / empresa (se ainda não for cliente)', type: 'text', span: 2, section: 'Identificação' },
    { name: 'responsavelId', label: 'Responsável', type: 'ref', span: 2, section: 'Identificação', ref: { list: (l) => l.profissionais } },
    { name: 'vigenciaMeses', label: 'Vigência (meses)', type: 'number', span: 1, section: 'Identificação' },
    { name: 'objeto', label: 'Objeto', type: 'textarea', span: 4, section: 'Identificação' },
    { name: 'modalidade', label: 'Modalidade', type: 'select', span: 2, section: 'Edital e disputa', options: MODALIDADES },
    { name: 'criterio', label: 'Critério de julgamento', type: 'select', span: 2, section: 'Edital e disputa', options: CRITERIOS },
    { name: 'numeroEdital', label: 'Nº do edital', type: 'text', span: 1, section: 'Edital e disputa' },
    { name: 'processo', label: 'Processo', type: 'text', span: 1, section: 'Edital e disputa' },
    { name: 'portal', label: 'Portal', type: 'select', span: 2, section: 'Edital e disputa', options: PORTAIS },
    { name: 'linkEdital', label: 'Link do edital / PNCP', type: 'text', span: 4, section: 'Edital e disputa', placeholder: 'https://pncp.gov.br/...' },
    { name: 'cidade', label: 'Cidade', type: 'text', span: 2, section: 'Edital e disputa' },
    { name: 'uf', label: 'UF', type: 'text', span: 1, section: 'Edital e disputa' },
    { name: 'prazoPropostas', label: 'Prazo para propostas', type: 'datetime', span: 2, section: 'Edital e disputa' },
    { name: 'dataSessao', label: 'Sessão pública / abertura', type: 'datetime', span: 2, section: 'Edital e disputa' },
    { name: 'valorEstimado', label: 'Valor estimado do órgão (total)', type: 'money', span: 2, section: 'Valores' },
    { name: 'valorProposta', label: 'Nossa proposta (total)', type: 'money', span: 2, section: 'Valores', help: 'Atualizado automaticamente pelo estudo de preço vinculado' },
    { name: 'vencedor', label: 'Vencedor', type: 'text', span: 2, section: 'Resultado' },
    { name: 'valorVencedor', label: 'Valor vencedor (total)', type: 'money', span: 2, section: 'Resultado' },
    { name: 'motivoResultado', label: 'Motivo / lições aprendidas', type: 'textarea', span: 4, section: 'Resultado' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Resultado' },
  ],
  columns: [
    {
      key: 'numero',
      label: 'Nº / etapa',
      value: (r) => r.numero,
      render: (r) => (
        <span className="block whitespace-nowrap">
          <span className="font-mono text-xs font-semibold">{r.numero}</span>
          <span className="mt-1 block"><Badge className={etapaOportunidade(r.etapa).cor}>{etapaOportunidade(r.etapa).label}</Badge></span>
        </span>
      ),
    },
    { key: 'etapa', label: 'Etapa', exportOnly: true, value: (r) => etapaOportunidade(r.etapa).label },
    {
      key: 'titulo',
      label: 'Oportunidade',
      value: (r) => r.titulo,
      render: (r, l) => (
        <span className="block min-w-[16rem] max-w-xl">
          <span className="font-medium">{r.titulo}</span>
          <span className="block text-xs text-slate-500">{[l.clienteMap.get(r.clienteId)?.nome || r.orgao, [r.cidade, r.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</span>
          {(r.modalidade || r.numeroEdital) && <span className="block text-xs text-slate-500">{[r.modalidade, r.numeroEdital && `nº ${r.numeroEdital}`, r.portal].filter(Boolean).join(' · ')}</span>}
        </span>
      ),
    },
    { key: 'modalidade', label: 'Modalidade / edital', exportOnly: true, value: (r) => [r.modalidade, r.numeroEdital].filter(Boolean).join(' ') },
    { key: 'dataSessao', label: 'Sessão', value: (r) => r.dataSessao || '', render: (r) => <SessaoBadge data={r.dataSessao} empilhado /> },
    { key: 'valorEstimado', label: 'Estimado', className: 'whitespace-nowrap text-right', value: (r) => r.valorEstimado || 0, render: (r) => money(r.valorEstimado) },
    {
      key: 'valorProposta',
      label: 'Proposta',
      className: 'whitespace-nowrap text-right',
      value: (r) => r.valorProposta || 0,
      render: (r) => (
        <span>
          {money(r.valorProposta)}
          {r.valorProposta && r.valorEstimado ? <span className="block text-[11px] text-slate-500">{Math.round((r.valorProposta / r.valorEstimado) * 100)}% do estimado</span> : null}
        </span>
      ),
    },
    { key: 'responsavelId', label: 'Responsável', className: 'hidden 2xl:table-cell', value: (r, l) => l.profissionalMap.get(r.responsavelId)?.nome },
  ],
  filters: [
    { key: 'etapa', label: 'Etapa', options: () => ETAPAS_OPORTUNIDADE.map((e) => ({ value: e.value, label: e.label })), test: (r, v) => r.etapa === v },
    { key: 'tipo', label: 'Tipo', options: () => [{ value: 'licitacao', label: 'Licitação pública' }, { value: 'privado', label: 'Proposta privada' }], test: (r, v) => r.tipo === v },
    { key: 'abertas', label: 'Situação', options: () => [{ value: 'abertas', label: 'Em andamento' }, { value: 'encerradas', label: 'Encerradas' }], test: (r, v) => (v === 'abertas') === etapaOportunidade(r.etapa).aberta },
  ],
  searchText: (r, l) => [r.numero, r.titulo, r.orgao, l.clienteMap.get(r.clienteId)?.nome, r.numeroEdital, r.processo, r.cidade].join(' '),
  defaults: () => ({ tipo: 'licitacao', etapa: 'prospeccao', vigenciaMeses: 12, modalidade: 'Pregão eletrônico', criterio: 'Menor preço global', portal: 'Compras.gov.br' }),
  topContent: (rows) => <FunilOportunidades rows={rows as Oportunidade[]} />,
  rowActions: (r) => <AcoesOportunidade op={r as Oportunidade} />,
};
