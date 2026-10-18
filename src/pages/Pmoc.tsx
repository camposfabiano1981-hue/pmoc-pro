import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarRange, FileText, Printer, Wand2 } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, Button, Card, Field, IconButton, Input, Modal, PageHeader, Select, cx, useToast } from '../components/ui';
import { PrintPage, PrintToolbar, QRImage, appUrl } from '../components/widgets';
import { db } from '../db/db';
import type { Pmoc } from '../db/types';
import { NORMAS, RECOMENDACOES_PADRAO, RE09, TERMO_RT, periodicidadeLabel, statusOs } from '../lib/catalogs';
import { MESES, MESES_CURTOS, btuToTr, fmtBtu, fmtDate, n2, todayStr } from '../lib/format';
import { useLookups } from '../lib/lookups';
import { gerarPreventivas, type Agrupamento } from '../lib/preventivas';
import { isDue, monthIndex, monthIndexFromStr, situacaoMes, type SituacaoMes } from '../lib/schedule';
import { avaliarAnalise, vencBadge } from '../modules/entities';

const STATUS_PMOC = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

export const pmocsCfg: EntityConfig = {
  table: 'pmocs',
  title: 'Documentos PMOC',
  singular: 'PMOC',
  icon: <FileText size={20} />,
  subtitle: 'Plano de Manutenção, Operação e Controle por unidade — Lei 13.589/2018 e Portaria GM/MS 3.523/98',
  numbering: { field: 'codigo', kind: 'pmoc' },
  formSize: 'xl',
  fields: [
    { name: 'codigo', label: 'Código', type: 'text', span: 1, placeholder: 'Automático', section: 'Identificação' },
    { name: 'revisao', label: 'Revisão', type: 'number', span: 1, section: 'Identificação' },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_PMOC, span: 1, section: 'Identificação' },
    { name: 'sistemas', label: 'Sistemas abrangidos', type: 'text', span: 1, section: 'Identificação', placeholder: 'Ar-condicionado, ventilação…' },
    { name: 'unidadeId', label: 'Unidade / edificação', type: 'ref', required: true, span: 2, section: 'Identificação', ref: { list: (l) => l.unidades, label: (r, l) => `${r.nome} — ${l.clienteMap.get(r.clienteId)?.nome || ''}` } },
    { name: 'contratoId', label: 'Contrato', type: 'ref', span: 2, section: 'Identificação', ref: { list: (l) => l.contratos, label: (r, l) => `${r.numero} — ${l.clienteMap.get(r.clienteId)?.nome || ''}` } },
    { name: 'vigenciaInicio', label: 'Início da vigência', type: 'date', required: true, span: 1, section: 'Vigência', help: 'Mês da 1ª execução das atividades' },
    { name: 'vigenciaFim', label: 'Fim da vigência', type: 'date', required: true, span: 1, section: 'Vigência' },
    { name: 'rtId', label: 'Responsável técnico', type: 'ref', span: 2, section: 'Responsabilidade técnica', ref: { list: (l) => l.profissionais, label: (r) => `${r.nome}${r.registro ? ' — ' + (r.conselho || '') + ' ' + r.registro : ''}` } },
    { name: 'artTipo', label: 'Documento', type: 'select', options: ['ART', 'TRT', 'RRT'], span: 1, section: 'Responsabilidade técnica', help: 'ART (CREA) · TRT (CFT) · RRT (CAU)' },
    { name: 'artNumero', label: 'Número', type: 'text', span: 1, section: 'Responsabilidade técnica' },
    { name: 'artInicio', label: 'Válida de', type: 'date', span: 1, section: 'Responsabilidade técnica' },
    { name: 'artFim', label: 'Válida até', type: 'date', span: 1, section: 'Responsabilidade técnica' },
    { name: 'recomendacoes', label: 'Recomendações aos usuários (falhas e emergências)', type: 'textarea', span: 4, section: 'Conteúdo do documento' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Conteúdo do documento' },
  ],
  columns: [
    { key: 'codigo', label: 'Código', render: (r) => <span className="font-mono text-xs font-semibold">{r.codigo}</span> },
    { key: 'unidadeId', label: 'Unidade', value: (r, l) => l.unidadeMap.get(r.unidadeId)?.nome },
    { key: 'cliente', label: 'Proprietário', value: (r, l) => l.clienteMap.get(l.unidadeMap.get(r.unidadeId)?.clienteId || '')?.nome },
    { key: 'rtId', label: 'RT', value: (r, l) => l.profissionalMap.get(r.rtId)?.nome },
    { key: 'art', label: 'ART/TRT', value: (r) => [r.artTipo, r.artNumero].filter(Boolean).join(' ') },
    { key: 'artFim', label: 'Validade ART', value: (r) => r.artFim, render: (r) => vencBadge(r.artFim) },
    { key: 'vigencia', label: 'Vigência', value: (r) => r.vigenciaInicio, render: (r) => `${fmtDate(r.vigenciaInicio)} a ${fmtDate(r.vigenciaFim)}` },
    { key: 'status', label: 'Situação', render: (r) => <Badge className={r.status === 'vigente' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : undefined}>{STATUS_PMOC.find((s) => s.value === r.status)?.label}</Badge> },
  ],
  searchText: (r, l) => [r.codigo, r.artNumero, l.unidadeMap.get(r.unidadeId)?.nome].join(' '),
  defaults: (l) => {
    const d = new Date();
    return {
      unidadeId: l.unidades[0]?.id,
      revisao: 0,
      status: 'vigente',
      artTipo: 'ART',
      vigenciaInicio: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      vigenciaFim: new Date(d.getFullYear() + 1, d.getMonth(), 0).toISOString().slice(0, 10),
      sistemas: 'Ar-condicionado',
      recomendacoes: RECOMENDACOES_PADRAO,
      rtId: l.profissionais.find((p) => p.conselho && p.conselho !== 'Nenhum')?.id,
    };
  },
  rowActions: (r) => (
    <>
      <Link to={`/pmoc/${r.id}/documento`}><IconButton title="Documento PMOC (imprimir)"><Printer size={15} /></IconButton></Link>
      <Link to={`/cronograma?pmoc=${r.id}`}><IconButton title="Cronograma"><CalendarRange size={15} /></IconButton></Link>
    </>
  ),
};

/* ===================== Cronograma ===================== */
const SIT: Record<SituacaoMes, { cls: string; label: string; sym: string }> = {
  nao_programado: { cls: '', label: 'Sem atividade', sym: '' },
  programado: { cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', label: 'Programado', sym: 'P' },
  em_andamento: { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', label: 'Em execução', sym: 'E' },
  executado: { cls: 'bg-emerald-500 text-white', label: 'Executado', sym: '✓' },
  atrasado: { cls: 'bg-rose-500 text-white', label: 'Atrasado / não executado', sym: '!' },
};

export function Cronograma() {
  const l = useLookups();
  const toast = useToast();
  const [params] = useSearchParams();
  const [pmocId, setPmocId] = useState(params.get('pmoc') || '');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [gen, setGen] = useState(false);
  const hoje = new Date();
  const [g, setG] = useState({ mes0: hoje.getMonth(), ano: hoje.getFullYear(), agrupamento: 'unidade' as Agrupamento, dia: 10, responsavelId: '', tecnicosIds: [] as string[], todos: false });
  const [preview, setPreview] = useState<{ n: number; equip: number; ign: number } | null>(null);
  const osList = useLiveQuery(() => db.os.where('tipo').equals('Preventiva').toArray(), []) || [];

  const pmocsVig = l.pmocs.filter((p) => p.status !== 'cancelado');
  const pmoc = l.pmocMap.get(pmocId) || pmocsVig[0];
  const startIdx = monthIndexFromStr(pmoc?.vigenciaInicio) ?? monthIndex(ano, 0);
  const equips = useMemo(() => (pmoc ? l.equipamentos.filter((e) => e.unidadeId === pmoc.unidadeId && e.status !== 'desativado') : []), [pmoc, l.equipamentos]);

  const matriz = useMemo(
    () => equips.map((e) => ({ e, meses: Array.from({ length: 12 }, (_, m) => situacaoMes(e.id, l.planoMap.get(e.planoId || ''), ano, m, startIdx, osList)) })),
    [equips, ano, startIdx, osList, l.planoMap],
  );
  const programados = matriz.reduce((a, r) => a + r.meses.filter((s) => s !== 'nao_programado' && s !== 'programado').length, 0);
  const executados = matriz.reduce((a, r) => a + r.meses.filter((s) => s === 'executado').length, 0);
  const atrasados = matriz.reduce((a, r) => a + r.meses.filter((s) => s === 'atrasado').length, 0);
  const cumprimento = programados ? Math.round((executados / programados) * 100) : 100;

  const params2 = () => ({ pmocIds: g.todos ? pmocsVig.filter((p) => p.status === 'vigente').map((p) => p.id) : pmoc ? [pmoc.id] : [], ano: g.ano, mes0: g.mes0, agrupamento: g.agrupamento, dia: g.dia, responsavelId: g.responsavelId || undefined, tecnicosIds: g.tecnicosIds });
  const simular = async () => {
    const r = await gerarPreventivas({ ...params2(), dryRun: true });
    setPreview({ n: r.criadas.length, equip: r.criadas.reduce((a, o) => a + o.equipamentos.length, 0), ign: r.ignoradas });
  };
  const gerar = async () => {
    const r = await gerarPreventivas(params2());
    toast(`${r.criadas.length} OS preventiva(s) gerada(s)${r.ignoradas ? ` · ${r.ignoradas} já existiam` : ''}.`);
    setGen(false);
    setPreview(null);
  };

  return (
    <div>
      <PageHeader
        title="Cronograma anual do PMOC"
        subtitle="Programado × executado por equipamento e mês — base para a comprovação do PMOC"
        icon={<CalendarRange size={20} />}
        actions={
          <>
            {pmoc && <Link to={`/pmoc/${pmoc.id}/documento`}><Button variant="outline" icon={<Printer size={16} />}>Documento PMOC</Button></Link>}
            <Button icon={<Wand2 size={16} />} onClick={() => { setGen(true); setPreview(null); }} disabled={!pmocsVig.length}>Gerar OS preventivas</Button>
          </>
        }
      />
      <Card className="mb-4" bodyClass="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="PMOC / unidade" className="min-w-[260px] flex-1">
            <Select value={pmoc?.id || ''} onChange={(e) => setPmocId(e.target.value)}>
              {pmocsVig.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {l.unidadeMap.get(p.unidadeId)?.nome}</option>)}
            </Select>
          </Field>
          <Field label="Ano">
            <Select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {[ano - 2, ano - 1, ano, ano + 1, ano + 2].map((a) => <option key={a}>{a}</option>)}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(SIT).filter(([k]) => k !== 'nao_programado').map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={cx('inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', v.cls)}>{v.sym}</span>{v.label}</span>
            ))}
          </div>
        </div>
      </Card>
      {!pmoc ? (
        <Card><p className="text-sm text-slate-500">Cadastre um PMOC em <Link className="text-brand-700 underline" to="/pmoc">Documentos PMOC</Link> para visualizar o cronograma.</p></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs text-slate-500">Cumprimento (meses vencidos)</p><p className={cx('text-2xl font-bold', cumprimento >= 90 ? 'text-emerald-600' : cumprimento >= 70 ? 'text-amber-600' : 'text-rose-600')}>{cumprimento}%</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs text-slate-500">Execuções realizadas</p><p className="text-2xl font-bold">{executados}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs text-slate-500">Atrasadas</p><p className="text-2xl font-bold text-rose-600">{atrasados}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs text-slate-500">Vigência</p><p className="text-sm font-semibold">{fmtDate(pmoc.vigenciaInicio)} a {fmtDate(pmoc.vigenciaFim)}</p></div>
          </div>
          <Card bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">Equipamento</th>
                    <th className="px-2 py-2 text-left">Ambiente</th>
                    {MESES_CURTOS.map((m) => <th key={m} className="w-10 px-1 py-2">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matriz.map(({ e, meses }) => (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 dark:bg-slate-900">
                        <Link to={`/equipamentos/${e.id}`} className="font-mono font-semibold text-brand-700 hover:underline dark:text-brand-300">{e.tag}</Link>
                        <span className="ml-1 text-slate-500">{e.tipo} {e.capacidadeBtu ? `${e.capacidadeBtu / 1000}k` : ''}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-600 dark:text-slate-300">{l.ambienteMap.get(e.ambienteId || '')?.nome}</td>
                      {meses.map((s, m) => (
                        <td key={m} className="px-0.5 py-0.5 text-center">
                          <span title={`${MESES[m]}: ${SIT[s].label}`} className={cx('inline-flex h-6 w-8 items-center justify-center rounded text-[11px] font-bold', SIT[s].cls)}>{SIT[s].sym}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {matriz.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-slate-500">Nenhum equipamento ativo nesta unidade.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={gen}
        onClose={() => setGen(false)}
        title="Gerar OS preventivas do mês"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={simular}>Simular</Button>
            <Button onClick={gerar}>Gerar OS</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês"><Select value={g.mes0} onChange={(e) => setG({ ...g, mes0: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</Select></Field>
          <Field label="Ano"><Input type="number" value={g.ano} onChange={(e) => setG({ ...g, ano: Number(e.target.value) })} /></Field>
          <Field label="Agrupamento" className="col-span-2" help="Uma OS por unidade (com todos os equipamentos), por ambiente ou por equipamento">
            <Select value={g.agrupamento} onChange={(e) => setG({ ...g, agrupamento: e.target.value as Agrupamento })}>
              <option value="unidade">Uma OS por unidade</option>
              <option value="ambiente">Uma OS por ambiente</option>
              <option value="equipamento">Uma OS por equipamento</option>
            </Select>
          </Field>
          <Field label="Dia agendado"><Input type="number" min={1} max={28} value={g.dia} onChange={(e) => setG({ ...g, dia: Number(e.target.value) })} /></Field>
          <Field label="Responsável">
            <Select value={g.responsavelId} onChange={(e) => setG({ ...g, responsavelId: e.target.value, tecnicosIds: e.target.value ? [...new Set([...g.tecnicosIds, e.target.value])] : g.tecnicosIds })}>
              <option value="">— selecione —</option>
              {l.profissionais.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={g.todos} onChange={(e) => setG({ ...g, todos: e.target.checked })} /> Gerar para todos os PMOCs vigentes (senão apenas {pmoc?.codigo})</label>
          {preview && (
            <p className="col-span-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-200">
              Serão criadas <b>{preview.n}</b> OS cobrindo <b>{preview.equip}</b> equipamento(s). {preview.ign > 0 && `${preview.ign} OS já existentes serão ignoradas.`}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ===================== Documento PMOC (impressão) ===================== */
function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 border-b-2 border-brand-700 pb-0.5 text-sm font-bold uppercase text-brand-800">{n}. {title}</h2>
      {children}
    </section>
  );
}

export function PmocDocumento() {
  const { id } = useParams();
  const l = useLookups();
  const pmoc = useLiveQuery(() => db.pmocs.get(id!), [id]) as Pmoc | undefined;
  const osList = useLiveQuery(() => db.os.toArray(), []) || [];
  const analises = useLiveQuery(() => db.analisesAr.toArray(), []) || [];
  const [ano, setAno] = useState<number | null>(null);
  if (!pmoc) return <p className="text-sm text-slate-500">Carregando…</p>;

  const e = l.empresa;
  const u = l.unidadeMap.get(pmoc.unidadeId);
  const c = l.clienteMap.get(u?.clienteId || '');
  const rt = l.profissionalMap.get(pmoc.rtId || '');
  const ambs = l.ambientes.filter((a) => a.unidadeId === pmoc.unidadeId);
  const eqs = l.equipamentos.filter((x) => x.unidadeId === pmoc.unidadeId && x.status !== 'desativado');
  const capTotal = eqs.reduce((a, x) => a + (x.capacidadeBtu || 0), 0);
  const startIdx = monthIndexFromStr(pmoc.vigenciaInicio) ?? 0;
  const anoDoc = ano ?? Number(pmoc.vigenciaInicio.slice(0, 4));
  const mesIni = Number(pmoc.vigenciaInicio.slice(5, 7)) - 1;
  const meses12 = Array.from({ length: 12 }, (_, k) => {
    const idx = monthIndex(anoDoc, mesIni) + k;
    return { idx, ano: Math.floor(idx / 12), m: idx % 12 };
  });
  const planosUsados = [...new Set(eqs.map((x) => x.planoId).filter(Boolean))].map((pid) => l.planoMap.get(pid!)).filter(Boolean);
  const anUnidade = analises.filter((a) => a.unidadeId === pmoc.unidadeId).sort((a, b) => b.data.localeCompare(a.data));
  const prevs = osList.filter((o) => o.pmocId === pmoc.id && o.tipo === 'Preventiva').sort((a, b) => (a.dataAgendada || '').localeCompare(b.dataAgendada || ''));
  const td = 'border border-slate-300 px-1.5 py-0.5';
  const kv = (k: string, v?: string | number | null) => (
    <tr><td className={cx(td, 'w-48 bg-slate-50 font-semibold')}>{k}</td><td className={td}>{v || '—'}</td></tr>
  );

  return (
    <div>
      <PrintToolbar title={`Documento ${pmoc.codigo}`}>
        <Select className="w-auto" value={anoDoc} onChange={(ev) => setAno(Number(ev.target.value))}>
          {[anoDoc - 1, anoDoc, anoDoc + 1].map((a) => <option key={a} value={a}>Ciclo iniciando em {MESES_CURTOS[mesIni]}/{a}</option>)}
        </Select>
        <Link to="/pmoc"><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar</Button></Link>
      </PrintToolbar>
      <PrintPage>
        {/* Capa */}
        <div className="flex min-h-[900px] flex-col items-center justify-between border-4 border-double border-brand-700 p-10 text-center print:min-h-[260mm]">
          <div>
            {e.logo && <img src={e.logo} alt="" className="mx-auto mb-4 h-24 object-contain" />}
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-600">{e.razaoSocial}</p>
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase leading-tight text-brand-800">Plano de Manutenção,<br />Operação e Controle</h1>
            <p className="mt-2 text-4xl font-black text-slate-800">PMOC</p>
            <p className="mt-6 text-lg font-semibold">{u?.nome}</p>
            <p className="text-sm text-slate-600">{c?.nome}</p>
            <p className="mt-4 text-sm">Código {pmoc.codigo} · Revisão {String(pmoc.revisao || 0).padStart(2, '0')}</p>
            <p className="text-sm">Vigência: {fmtDate(pmoc.vigenciaInicio)} a {fmtDate(pmoc.vigenciaFim)}</p>
          </div>
          <div className="space-y-2">
            <QRImage text={appUrl(`/pmoc/${pmoc.id}/documento`)} size={96} className="mx-auto" />
            <p className="text-[11px] text-slate-500">Lei Federal nº 13.589/2018 · Portaria GM/MS nº 3.523/1998 · Resolução ANVISA RE nº 09/2003 · ABNT NBR 13971</p>
          </div>
        </div>

        <div className="print:break-before-page" />
        <Sec n="1" title="Identificação do ambiente ou conjunto de ambientes">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome (edifício/entidade)', u?.nome)}
              {kv('Tipo de edificação', u?.tipoEdificacao)}
              {kv('Endereço', [u?.endereco, u?.numero, u?.complemento].filter(Boolean).join(', '))}
              {kv('Bairro / Cidade / UF', [u?.bairro, u?.cidade, u?.uf].filter(Boolean).join(' / '))}
              {kv('CEP / Telefone', [u?.cep, u?.telefone].filter(Boolean).join(' · '))}
              {kv('Responsável local', u?.responsavelLocal)}
              {kv('Sistemas', pmoc.sistemas)}
            </tbody>
          </table>
        </Sec>
        <Sec n="2" title="Identificação do proprietário, locatário ou preposto">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome / Razão social', c?.nome)}
              {kv('CPF / CNPJ', c?.cpfCnpj)}
              {kv('Endereço', [c?.endereco, c?.numero, c?.bairro, c?.cidade, c?.uf].filter(Boolean).join(', '))}
              {kv('Telefone / E-mail', [c?.telefone, c?.email].filter(Boolean).join(' · '))}
              {kv('Contato', c?.contato)}
            </tbody>
          </table>
        </Sec>
        <Sec n="3" title="Identificação do responsável técnico">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome', rt?.nome)}
              {kv('CPF', rt?.cpf)}
              {kv('Registro no conselho de classe', [rt?.conselho, rt?.registro].filter(Boolean).join(' '))}
              {kv(`${pmoc.artTipo || 'ART'} nº`, pmoc.artNumero ? `${pmoc.artNumero} — válida de ${fmtDate(pmoc.artInicio)} a ${fmtDate(pmoc.artFim)}` : undefined)}
              {kv('Telefone / E-mail', [rt?.telefone, rt?.email].filter(Boolean).join(' · '))}
              {kv('Empresa executora', [e.razaoSocial, e.cnpj && `CNPJ ${e.cnpj}`].filter(Boolean).join(' — '))}
            </tbody>
          </table>
        </Sec>

        <Sec n="4" title="Relação dos ambientes climatizados">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>Grupo</th><th className={td}>Ambiente</th><th className={td}>Tipo de atividade</th>
                <th className={td}>Ocup. fixos</th><th className={td}>Ocup. flut.</th><th className={td}>Área (m²)</th><th className={td}>Carga térmica (BTU/h)</th><th className={td}>Renovação mín. (m³/h)</th>
              </tr>
            </thead>
            <tbody>
              {ambs.map((a) => {
                const carga = eqs.filter((x) => x.ambienteId === a.id).reduce((s, x) => s + (x.capacidadeBtu || 0), 0);
                const pess = (a.ocupantesFixos || 0) + (a.ocupantesFlutuantes || 0);
                return (
                  <tr key={a.id}>
                    <td className={td}>{a.grupo}</td><td className={td}>{a.nome}</td><td className={td}>{a.tipoAtividade}</td>
                    <td className={td}>{a.ocupantesFixos ?? ''}</td><td className={td}>{a.ocupantesFlutuantes ?? ''}</td><td className={td}>{a.areaM2 ? n2(a.areaM2) : ''}</td>
                    <td className={td}>{carga ? n2(carga) : ''}</td><td className={td}>{pess ? n2(pess * RE09.renovacaoMin) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={td} colSpan={5}>Total: {ambs.length} ambiente(s)</td>
                <td className={td}>{n2(ambs.reduce((s, a) => s + (a.areaM2 || 0), 0))}</td>
                <td className={td} colSpan={2}>{n2(capTotal)} BTU/h ({n2(btuToTr(capTotal))} TR)</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-[11px] text-slate-600">
            Capacidade instalada total: {fmtBtu(capTotal)} = {n2(btuToTr(capTotal))} TR.{' '}
            {capTotal > 60000 ? 'Sistema acima de 5 TR (60.000 BTU/h): exige responsável técnico habilitado (Portaria 3.523/98, art. 6º).' : 'Capacidade até 5 TR.'}
          </p>
        </Sec>

        <Sec n="5" title="Relação dos equipamentos">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>TAG</th><th className={td}>Tipo</th><th className={td}>Marca / modelo</th><th className={td}>Nº série</th><th className={td}>Patr.</th><th className={td}>BTU/h</th><th className={td}>Fluido</th><th className={td}>Ambiente</th><th className={td}>Plano</th>
              </tr>
            </thead>
            <tbody>
              {eqs.map((x) => (
                <tr key={x.id}>
                  <td className={td}>{x.tag}</td><td className={td}>{x.tipo}</td><td className={td}>{[x.marca, x.modelo].filter(Boolean).join(' ')}</td><td className={td}>{x.numeroSerie}</td><td className={td}>{x.patrimonio}</td>
                  <td className={td}>{x.capacidadeBtu ? n2(x.capacidadeBtu) : ''}</td><td className={td}>{x.fluido}</td><td className={td}>{l.ambienteMap.get(x.ambienteId || '')?.nome}</td><td className={td}>{l.planoMap.get(x.planoId || '')?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <Sec n="6" title="Plano de manutenção e controle — atividades e periodicidade">
          {planosUsados.map((p) => (
            <div key={p!.id} className="mb-4 break-inside-avoid">
              <p className="mb-1 font-semibold">{p!.nome} <span className="font-normal text-slate-600">— aplicado a {eqs.filter((x) => x.planoId === p!.id).map((x) => x.tag).join(', ')}</span></p>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className={cx(td, 'text-left')}>Descrição da atividade</th>
                    <th className={td}>Periodicidade</th>
                    {meses12.map((mm) => <th key={mm.idx} className={cx(td, 'w-7')}>{MESES_CURTOS[mm.m]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {p!.atividades.filter((a) => a.periodicidade !== 'na').map((a) => (
                    <tr key={a.id}>
                      <td className={td}>{a.descricao}</td>
                      <td className={cx(td, 'whitespace-nowrap text-center')}>{periodicidadeLabel(a.periodicidade)}</td>
                      {meses12.map((mm) => <td key={mm.idx} className={cx(td, 'text-center font-bold')}>{isDue(a.periodicidade, mm.idx, startIdx) ? 'X' : ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Sec>

        <Sec n="7" title="Registro de execução das manutenções programadas">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>OS</th><th className={td}>Programada</th><th className={td}>Executada em</th><th className={td}>Equip.</th><th className={td}>Executado por</th><th className={td}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {prevs.map((o) => (
                <tr key={o.id}>
                  <td className={td}>{o.numero}</td><td className={td}>{fmtDate(o.dataAgendada)}</td><td className={td}>{fmtDate(o.fim)}</td><td className={td}>{o.equipamentos.length}</td>
                  <td className={td}>{l.profissionalMap.get(o.responsavelId || '')?.nome}</td><td className={td}>{statusOs(o.status).label}</td>
                </tr>
              ))}
              {prevs.length === 0 && <tr><td className={td} colSpan={6}>Nenhuma OS preventiva registrada.</td></tr>}
            </tbody>
          </table>
        </Sec>

        <Sec n="8" title="Qualidade do ar interior (RE ANVISA nº 09/2003)">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>Data</th><th className={td}>Ambiente</th><th className={td}>Laudo</th><th className={td}>CO₂ (ppm)</th><th className={td}>Fungos (UFC/m³)</th><th className={td}>I/E</th><th className={td}>Aerodisp. (µg/m³)</th><th className={td}>T (°C)</th><th className={td}>UR (%)</th><th className={td}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {anUnidade.map((a) => {
                const nc = avaliarAnalise(a);
                return (
                  <tr key={a.id}>
                    <td className={td}>{fmtDate(a.data)}</td><td className={td}>{l.ambienteMap.get(a.ambienteId || '')?.nome}</td><td className={td}>{a.laudo}</td><td className={td}>{a.co2 ?? ''}</td><td className={td}>{a.fungos ?? ''}</td>
                    <td className={td}>{a.fungos !== undefined && a.fungosExt ? n2(a.fungos / a.fungosExt) : ''}</td><td className={td}>{a.aerodispersoides ?? ''}</td><td className={td}>{a.temperatura ?? ''}</td><td className={td}>{a.umidade ?? ''}</td>
                    <td className={cx(td, nc.length ? 'font-semibold text-rose-700' : 'text-emerald-700')}>{nc.length ? nc.join('; ') : 'Conforme'}</td>
                  </tr>
                );
              })}
              {anUnidade.length === 0 && <tr><td className={td} colSpan={10}>Nenhuma análise registrada. Recomenda-se análise semestral.</td></tr>}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-slate-600">Padrões referenciais: fungos ≤ {RE09.fungosMax} UFC/m³ e I/E ≤ {RE09.relacaoIEMax}; CO₂ ≤ {RE09.co2Max} ppm; aerodispersóides ≤ {RE09.aerodispersoidesMax} µg/m³; T 23–26 °C (verão) / 20–22 °C (inverno); UR 40–65% (verão) / 35–65% (inverno); velocidade ≤ {RE09.velocidadeMax} m/s; renovação ≥ {RE09.renovacaoMin} m³/h/pessoa.</p>
        </Sec>

        <Sec n="9" title="Recomendações aos usuários em situações de falha e emergência">
          <p className="whitespace-pre-wrap text-[11px]">{pmoc.recomendacoes || RECOMENDACOES_PADRAO}</p>
        </Sec>
        <Sec n="10" title="Normas e referências">
          <ul className="list-inside list-disc text-[11px]">{NORMAS.map((nr) => <li key={nr.ref}><b>{nr.ref}</b> — {nr.desc}</li>)}</ul>
        </Sec>
        {pmoc.observacoes && <Sec n="11" title="Observações"><p className="whitespace-pre-wrap text-[11px]">{pmoc.observacoes}</p></Sec>}
        <Sec n={pmoc.observacoes ? '12' : '11'} title="Termo de responsabilidade técnica">
          <p className="text-[11px]">{TERMO_RT}</p>
          <p className="mt-4 text-[11px]">{u?.cidade || e.cidade}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
          <div className="mt-14 grid grid-cols-2 gap-10 text-center text-[11px]">
            <div className="border-t border-slate-500 pt-1">{rt?.nome || 'Responsável técnico'}<br />{[rt?.conselho, rt?.registro].filter(Boolean).join(' ')} · {pmoc.artTipo} {pmoc.artNumero}</div>
            <div className="border-t border-slate-500 pt-1">{c?.nome || 'Proprietário / preposto'}<br />Ciente do PMOC</div>
          </div>
        </Sec>
        <p className="mt-8 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">{e.rodape} · {pmoc.codigo} rev. {pmoc.revisao || 0} · Emitido em {todayStr().split('-').reverse().join('/')}</p>
      </PrintPage>
    </div>
  );
}
