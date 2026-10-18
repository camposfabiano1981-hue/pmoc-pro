import { Link } from 'react-router-dom';
import {
  Building2, Boxes, Factory, FileSignature, HardHat, MapPin, Package, QrCode, Snowflake, Truck, Users, Wind, Wrench,
} from 'lucide-react';
import type { EntityConfig, FieldDef } from '../components/crud';
import { Badge, Button, IconButton, Input } from '../components/ui';
import { db } from '../db/db';
import { planoSugerido } from '../db/planosPadrao';
import { aplicarPlano } from '../lib/rotinas';
import type { Certificacao } from '../db/types';
import {
  CATEGORIAS_PECA, CATEGORIAS_SERVICO, CERTIFICACOES, CRITICIDADES, FLUIDOS, FUNCOES, MARCAS, PERFIS, RE09, SETORES, STATUS_EQUIPAMENTO, TIPOS_ATIVIDADE_AMBIENTE,
  TIPOS_EDIFICACAO, TIPOS_EQUIPAMENTO, UFS, UNIDADES_MEDIDA, gwpDe,
} from '../lib/catalogs';
import { diffDays, fmtBtu, fmtDate, fmtTr, money, n2, todayStr } from '../lib/format';
import { equipLabel, type Lookups } from '../lib/lookups';

const endereco = (section = 'Endereço'): FieldDef[] => [
  { name: 'cep', label: 'CEP', type: 'text', span: 1, section },
  { name: 'endereco', label: 'Logradouro', type: 'text', span: 2, section },
  { name: 'numero', label: 'Nº', type: 'text', span: 1, section },
  { name: 'complemento', label: 'Complemento', type: 'text', span: 1, section },
  { name: 'bairro', label: 'Bairro', type: 'text', span: 1, section },
  { name: 'cidade', label: 'Cidade', type: 'text', span: 1, section },
  { name: 'uf', label: 'UF', type: 'select', options: UFS, span: 1, section },
];

const unidadeRef = (required = true): FieldDef => ({
  name: 'unidadeId',
  label: 'Unidade / edificação',
  type: 'ref',
  required,
  ref: { list: (l) => l.unidades, label: (r, l) => `${r.nome} — ${l.clienteMap.get(r.clienteId)?.nome || ''}` },
});

const unidadeFilter = {
  key: 'unidadeId',
  label: 'Unidade',
  options: (l: Lookups) => l.unidades.map((u) => ({ value: u.id, label: u.nome })),
  test: (r: { unidadeId?: string }, v: string) => r.unidadeId === v,
};

export const vencBadge = (data?: string) => {
  if (!data) return <span className="text-slate-400">—</span>;
  const d = diffDays(data, todayStr()) ?? 0;
  const cls = d < 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : d <= 30 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';
  return <Badge className={cls}>{fmtDate(data)}{d < 0 ? ' · vencido' : d <= 30 ? ` · ${d}d` : ''}</Badge>;
};

/* ---------------- Clientes ---------------- */
export const clientesCfg: EntityConfig = {
  table: 'clientes',
  title: 'Clientes / Proprietários',
  singular: 'Cliente',
  icon: <Users size={20} />,
  fields: [
    { name: 'nome', label: 'Nome / Razão social', type: 'text', required: true, span: 3, section: 'Identificação' },
    { name: 'tipoPessoa', label: 'Tipo', type: 'select', options: [{ value: 'PJ', label: 'Pessoa jurídica' }, { value: 'PF', label: 'Pessoa física' }], span: 1, section: 'Identificação' },
    { name: 'fantasia', label: 'Nome fantasia', type: 'text', span: 2, section: 'Identificação' },
    { name: 'cpfCnpj', label: 'CPF / CNPJ', type: 'doc', span: 1, section: 'Identificação' },
    { name: 'ie', label: 'Inscrição estadual', type: 'text', span: 1, section: 'Identificação' },
    { name: 'contato', label: 'Pessoa de contato', type: 'text', span: 2, section: 'Contato' },
    { name: 'telefone', label: 'Telefone', type: 'tel', span: 1, section: 'Contato' },
    { name: 'email', label: 'E-mail', type: 'email', span: 1, section: 'Contato' },
    ...endereco(),
    { name: 'ativo', label: 'Ativo', type: 'checkbox', span: 1, section: 'Outros' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'nome', label: 'Cliente', render: (r) => <div><p className="font-medium">{r.nome}</p><p className="text-xs text-slate-500">{r.fantasia}</p></div> },
    { key: 'cpfCnpj', label: 'CPF/CNPJ' },
    { key: 'contato', label: 'Contato' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'cidade', label: 'Cidade', value: (r) => [r.cidade, r.uf].filter(Boolean).join('/') },
    { key: 'unidades', label: 'Unidades', value: (r, l) => l.unidades.filter((u) => u.clienteId === r.id).length },
  ],
  searchText: (r) => [r.nome, r.fantasia, r.cpfCnpj, r.contato, r.cidade, r.email].join(' '),
  defaults: () => ({ tipoPessoa: 'PJ', ativo: true }),
  beforeDelete: async (r) => ((await db.unidades.where('clienteId').equals(r.id).count()) ? 'Cliente possui unidades vinculadas. Exclua ou transfira as unidades primeiro.' : null),
  rowActions: (r) => (
    <Link to={`/unidades?clienteId=${r.id}`} title="Ver unidades">
      <IconButton title="Unidades"><Building2 size={15} /></IconButton>
    </Link>
  ),
};

/* ---------------- Unidades ---------------- */
export const unidadesCfg: EntityConfig = {
  table: 'unidades',
  title: 'Unidades / Edificações',
  singular: 'Unidade',
  icon: <Building2 size={20} />,
  subtitle: 'Unidades de manutenção atendidas pelo PMOC (edifícios, plantas, filiais)',
  fields: [
    { name: 'clienteId', label: 'Cliente / proprietário', type: 'ref', required: true, span: 2, section: 'Identificação', ref: { list: (l) => l.clientes } },
    { name: 'nome', label: 'Nome da unidade', type: 'text', required: true, span: 2, section: 'Identificação' },
    { name: 'tipoEdificacao', label: 'Tipo de edificação', type: 'select', options: TIPOS_EDIFICACAO, span: 2, section: 'Identificação' },
    { name: 'areaConstruida', label: 'Área construída (m²)', type: 'number', span: 1, section: 'Identificação' },
    { name: 'ativo', label: 'Ativa', type: 'checkbox', span: 1, section: 'Identificação' },
    { name: 'responsavelLocal', label: 'Responsável local', type: 'text', span: 2, section: 'Contato' },
    { name: 'telefone', label: 'Telefone', type: 'tel', span: 1, section: 'Contato' },
    { name: 'email', label: 'E-mail', type: 'email', span: 1, section: 'Contato' },
    ...endereco(),
    { name: 'latitude', label: 'Latitude', type: 'text', span: 1, section: 'Endereço' },
    { name: 'longitude', label: 'Longitude', type: 'text', span: 1, section: 'Endereço' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'nome', label: 'Unidade', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'clienteId', label: 'Cliente', value: (r, l) => l.clienteMap.get(r.clienteId)?.nome },
    { key: 'tipoEdificacao', label: 'Tipo' },
    { key: 'cidade', label: 'Cidade', value: (r) => [r.cidade, r.uf].filter(Boolean).join('/') },
    { key: 'amb', label: 'Ambientes', value: (r, l) => l.ambientes.filter((a) => a.unidadeId === r.id).length },
    { key: 'eq', label: 'Equip.', value: (r, l) => l.equipamentos.filter((a) => a.unidadeId === r.id).length },
    {
      key: 'carga',
      label: 'Capacidade instalada',
      value: (r, l) => l.equipamentos.filter((e) => e.unidadeId === r.id && e.status !== 'desativado').reduce((a, e) => a + (e.capacidadeBtu || 0), 0),
      render: (r, l) => {
        const btu = l.equipamentos.filter((e) => e.unidadeId === r.id && e.status !== 'desativado').reduce((a, e) => a + (e.capacidadeBtu || 0), 0);
        return <span className="whitespace-nowrap">{fmtTr(btu)} <span className="text-xs text-slate-500">({n2(btu)} BTU/h)</span></span>;
      },
    },
  ],
  filters: [{ key: 'clienteId', label: 'Cliente', options: (l) => l.clientes.map((c) => ({ value: c.id, label: c.nome })), test: (r, v) => r.clienteId === v }],
  searchText: (r, l) => [r.nome, r.cidade, r.tipoEdificacao, l.clienteMap.get(r.clienteId)?.nome].join(' '),
  defaults: (l) => ({ ativo: true, clienteId: l.clientes[0]?.id }),
  beforeDelete: async (r) => ((await db.equipamentos.where('unidadeId').equals(r.id).count()) ? 'Unidade possui equipamentos vinculados.' : null),
  rowActions: (r) => (
    <>
      <Link to={`/ambientes?unidadeId=${r.id}`}><IconButton title="Ambientes"><MapPin size={15} /></IconButton></Link>
      <Link to={`/equipamentos?unidadeId=${r.id}`}><IconButton title="Equipamentos"><Wind size={15} /></IconButton></Link>
    </>
  ),
};

/* ---------------- Ambientes ---------------- */
export const ambientesCfg: EntityConfig = {
  table: 'ambientes',
  title: 'Ambientes climatizados',
  singular: 'Ambiente',
  icon: <MapPin size={20} />,
  subtitle: 'Relação de ambientes do PMOC: ocupação, área e carga térmica instalada',
  fields: [
    { ...unidadeRef(), span: 2, section: 'Identificação' },
    { name: 'grupo', label: 'Grupo de áreas / setor', type: 'text', span: 2, section: 'Identificação', suggestions: (l) => [...new Set(l.ambientes.map((a) => a.grupo).filter(Boolean) as string[])] },
    { name: 'nome', label: 'Identificação do ambiente', type: 'text', required: true, span: 2, section: 'Identificação' },
    { name: 'localizacao', label: 'Localização', type: 'text', span: 1, section: 'Identificação' },
    { name: 'pavimento', label: 'Pavimento', type: 'text', span: 1, section: 'Identificação' },
    { name: 'tipoAtividade', label: 'Tipo de atividade', type: 'text', span: 2, section: 'Ocupação', suggestions: TIPOS_ATIVIDADE_AMBIENTE },
    { name: 'ocupantesFixos', label: 'Ocupantes fixos', type: 'number', span: 1, section: 'Ocupação' },
    { name: 'ocupantesFlutuantes', label: 'Ocupantes flutuantes', type: 'number', span: 1, section: 'Ocupação' },
    { name: 'areaM2', label: 'Área climatizada (m²)', type: 'number', span: 1, section: 'Ocupação' },
    { name: 'peDireito', label: 'Pé-direito (m)', type: 'number', span: 1, section: 'Ocupação' },
    { name: 'centroCusto', label: 'Centro de custo', type: 'text', span: 2, section: 'Ocupação' },
    {
      name: 'renov',
      label: 'Renovação de ar mínima (RE 09/2003)',
      type: 'custom',
      span: 4,
      section: 'Ocupação',
      render: ({ form }) => {
        const pessoas = (Number(form.ocupantesFixos) || 0) + (Number(form.ocupantesFlutuantes) || 0);
        return (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-950 dark:text-brand-200">
            {pessoas} pessoa(s) × {RE09.renovacaoMin} m³/h = <b>{n2(pessoas * RE09.renovacaoMin)} m³/h</b> de ar exterior
          </p>
        );
      },
    },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'nome', label: 'Ambiente', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'unidadeId', label: 'Unidade', value: (r, l) => l.unidadeMap.get(r.unidadeId)?.nome },
    { key: 'grupo', label: 'Grupo' },
    { key: 'tipoAtividade', label: 'Atividade' },
    { key: 'ocup', label: 'Ocup. F/Fl', value: (r) => `${r.ocupantesFixos ?? 0} / ${r.ocupantesFlutuantes ?? 0}` },
    { key: 'areaM2', label: 'Área m²', value: (r) => r.areaM2 ?? '' },
    { key: 'carga', label: 'Carga instalada', value: (r, l) => l.equipamentos.filter((e) => e.ambienteId === r.id).reduce((a, e) => a + (e.capacidadeBtu || 0), 0), render: (r, l) => fmtBtu(l.equipamentos.filter((e) => e.ambienteId === r.id).reduce((a, e) => a + (e.capacidadeBtu || 0), 0)) },
    { key: 'nEq', label: 'Equip.', value: (r, l) => l.equipamentos.filter((e) => e.ambienteId === r.id).length },
  ],
  filters: [unidadeFilter, { key: 'grupo', label: 'Grupo', options: (_l, rows) => [...new Set(rows.map((r) => r.grupo).filter(Boolean))].sort().map((g) => ({ value: g, label: g })), test: (r, v) => r.grupo === v }],
  searchText: (r, l) => [r.nome, r.grupo, r.localizacao, r.tipoAtividade, l.unidadeMap.get(r.unidadeId)?.nome].join(' '),
  defaults: (l) => ({ unidadeId: l.unidades[0]?.id, tipoAtividade: 'Administrativo' }),
  beforeDelete: async (r) => ((await db.equipamentos.where('ambienteId').equals(r.id).count()) ? 'Ambiente possui equipamentos vinculados.' : null),
};

/* ---------------- Equipamentos ---------------- */
export const equipamentosCfg: EntityConfig = {
  table: 'equipamentos',
  title: 'Equipamentos',
  singular: 'Equipamento',
  icon: <Wind size={20} />,
  formSize: 'xl',
  fields: [
    { name: 'tag', label: 'TAG / Código', type: 'text', span: 1, section: 'Identificação', placeholder: 'Automático', help: 'Deixe vazio para gerar' },
    {
      name: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_EQUIPAMENTO, required: true, span: 1, section: 'Identificação',
      onChangeEffect: (v, form, l) => (form.planoId ? undefined : { planoId: planoSugerido(v, l.planos)?.id }),
    },
    { name: 'marca', label: 'Marca', type: 'text', span: 1, section: 'Identificação', suggestions: MARCAS },
    { name: 'modelo', label: 'Modelo (evaporadora)', type: 'text', span: 1, section: 'Identificação' },
    { name: 'numeroSerie', label: 'Nº de série', type: 'text', span: 1, section: 'Identificação' },
    { name: 'patrimonio', label: 'Patrimônio', type: 'text', span: 1, section: 'Identificação' },
    { name: 'criticidade', label: 'Criticidade', type: 'select', options: CRITICIDADES, span: 1, section: 'Identificação' },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_EQUIPAMENTO.map((s) => ({ value: s.value, label: s.label })), span: 1, section: 'Identificação' },
    {
      ...unidadeRef(), span: 2, section: 'Localização',
      onChangeEffect: () => ({ ambienteId: undefined }),
    },
    { name: 'ambienteId', label: 'Ambiente', type: 'ref', span: 2, section: 'Localização', ref: { list: (l) => l.ambientes, filter: (r, f) => r.unidadeId === f.unidadeId, label: (r) => `${r.nome}${r.grupo ? ' (' + r.grupo + ')' : ''}` } },
    { name: 'localCondensadora', label: 'Local da condensadora', type: 'text', span: 2, section: 'Localização' },
    { name: 'centroCusto', label: 'Centro de custo', type: 'text', span: 2, section: 'Localização' },
    { name: 'capacidadeBtu', label: 'Capacidade (BTU/h)', type: 'number', span: 1, section: 'Dados técnicos', help: (f) => (f.capacidadeBtu ? fmtTr(f.capacidadeBtu) : 'Ex.: 12000') },
    { name: 'tecnologia', label: 'Tecnologia', type: 'select', options: ['Inverter', 'Convencional (on/off)', 'Velocidade variável', 'Água gelada'], span: 1, section: 'Dados técnicos' },
    { name: 'fluido', label: 'Fluido refrigerante', type: 'select', options: FLUIDOS.map((f) => ({ value: f.nome, label: `${f.nome} (GWP ${f.gwp})` })), span: 1, section: 'Dados técnicos' },
    { name: 'cargaFluidoKg', label: 'Carga de fluido (kg)', type: 'number', span: 1, section: 'Dados técnicos', help: (f) => (f.cargaFluidoKg && f.fluido ? `${n2((f.cargaFluidoKg * gwpDe(f.fluido)) / 1000)} tCO₂e` : undefined) },
    { name: 'tensao', label: 'Tensão', type: 'select', options: ['127 V', '220 V', '380 V', '440 V'], span: 1, section: 'Dados técnicos' },
    { name: 'fases', label: 'Fases', type: 'select', options: ['Monofásico', 'Bifásico', 'Trifásico'], span: 1, section: 'Dados técnicos' },
    { name: 'correnteNominal', label: 'Corrente nominal (A)', type: 'number', span: 1, section: 'Dados técnicos' },
    { name: 'potenciaW', label: 'Potência elétrica (W)', type: 'number', span: 1, section: 'Dados técnicos' },
    { name: 'modeloCondensadora', label: 'Modelo condensadora', type: 'text', span: 2, section: 'Dados técnicos' },
    { name: 'serieCondensadora', label: 'Série condensadora', type: 'text', span: 2, section: 'Dados técnicos' },
    { name: 'dataFabricacao', label: 'Fabricação', type: 'date', span: 1, section: 'Datas e plano' },
    { name: 'dataInstalacao', label: 'Instalação', type: 'date', span: 1, section: 'Datas e plano' },
    { name: 'garantiaAte', label: 'Garantia até', type: 'date', span: 1, section: 'Datas e plano' },
    { name: 'planoId', label: 'Plano modelo de manutenção', type: 'ref', span: 2, section: 'Datas e plano', ref: { list: (l) => l.planos }, help: 'As rotinas do equipamento são criadas a partir deste plano e podem ser ajustadas na ficha' },
    { name: 'inicioPlano', label: '1ª execução das rotinas', type: 'date', span: 1, section: 'Datas e plano', help: 'Data base da periodicidade' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Datas e plano' },
  ],
  columns: [
    { key: 'tag', label: 'TAG', render: (r) => <span className="whitespace-nowrap font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">{r.tag}</span> },
    { key: 'tipo', label: 'Equipamento', render: (r) => <div><p className="font-medium">{r.tipo}</p><p className="text-xs text-slate-500">{[r.marca, r.modelo].filter(Boolean).join(' · ')}</p></div>, value: (r) => `${r.tipo} ${r.marca || ''}` },
    { key: 'capacidadeBtu', label: 'Capacidade', value: (r) => r.capacidadeBtu || 0, render: (r) => <span className="whitespace-nowrap">{fmtBtu(r.capacidadeBtu)}</span> },
    { key: 'unidadeId', label: 'Unidade', value: (r, l) => l.unidadeMap.get(r.unidadeId)?.nome },
    { key: 'ambienteId', label: 'Ambiente', value: (r, l) => l.ambienteMap.get(r.ambienteId)?.nome },
    { key: 'patrimonio', label: 'Patrim.' },
    { key: 'fluido', label: 'Fluido', className: 'whitespace-nowrap' },
    { key: 'criticidade', label: 'Crit.', render: (r) => <Badge className={r.criticidade === 'A' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : r.criticidade === 'B' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : undefined}>{r.criticidade}</Badge> },
    { key: 'status', label: 'Situação', value: (r) => STATUS_EQUIPAMENTO.find((s) => s.value === r.status)?.label, render: (r) => { const s = STATUS_EQUIPAMENTO.find((x) => x.value === r.status); return <Badge className={s?.cor}>{s?.label}</Badge>; } },
    {
      key: 'proxima', label: 'Próx. manutenção', className: 'whitespace-nowrap',
      value: (r, l) => l.rotinaResumo.get(r.id)?.proxima || '9999',
      render: (r, l) => {
        const x = l.rotinaResumo.get(r.id);
        if (!x) return <span className="text-xs text-slate-400">sem rotinas</span>;
        return (
          <span className="flex flex-col gap-0.5">
            {vencBadge(x.proxima)}
            {x.vencidas > 0 && <span className="text-[11px] font-medium text-rose-600">{x.vencidas} rotina(s) vencida(s)</span>}
          </span>
        );
      },
    },
  ],
  filters: [
    unidadeFilter,
    { key: 'tipo', label: 'Tipo', options: (_l, rows) => [...new Set(rows.map((r) => r.tipo))].sort().map((t) => ({ value: t, label: t })), test: (r, v) => r.tipo === v },
    { key: 'status', label: 'Situação', options: () => STATUS_EQUIPAMENTO.map((s) => ({ value: s.value, label: s.label })), test: (r, v) => r.status === v },
    { key: 'criticidade', label: 'Criticidade', options: () => CRITICIDADES.map((s) => ({ value: s.value, label: s.value })), test: (r, v) => r.criticidade === v },
  ],
  searchText: (r, l) => [r.tag, r.tipo, r.marca, r.modelo, r.numeroSerie, r.patrimonio, l.ambienteMap.get(r.ambienteId)?.nome, l.unidadeMap.get(r.unidadeId)?.nome].join(' '),
  defaults: (l) => ({ unidadeId: l.unidades[0]?.id, criticidade: 'B', status: 'operando', tipo: 'Split Hi-Wall', fluido: 'R-410A', tensao: '220 V', fases: 'Monofásico', planoId: planoSugerido('Split Hi-Wall', l.planos)?.id }),
  numbering: { field: 'tag', kind: 'eq' },
  somenteLeituraPara: ['tecnico'],
  afterSave: async (rec, anterior) => {
    const temRotinas = await db.rotinas.where('equipamentoId').equals(rec.id).count();
    if (!anterior || anterior.planoId !== rec.planoId || !temRotinas) {
      const r = await aplicarPlano(rec.id, rec.inicioPlano || todayStr());
      if (r.criadas) return `${r.criadas} rotina(s) de manutenção criadas para o equipamento.`;
    }
  },
  detailPath: (r) => `/equipamentos/${r.id}`,
  rowActions: (r) => (
    <Link to={`/equipamentos/${r.id}`}><IconButton title="Ficha / QR Code"><QrCode size={15} /></IconButton></Link>
  ),
  headerActions: (
    <Link to="/etiquetas"><Button variant="outline" icon={<QrCode size={16} />}>Etiquetas QR</Button></Link>
  ),
};

/* ---------------- Profissionais ---------------- */
function CertificacoesEditor({ value, onChange }: { value?: Certificacao[]; onChange: (v: Certificacao[]) => void }) {
  const list = value || [];
  const upd = (i: number, patch: Partial<Certificacao>) => onChange(list.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {list.map((c, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <Input className="col-span-12 sm:col-span-5" list="dl-cert" value={c.nome} placeholder="Certificação / treinamento" onChange={(e) => upd(i, { nome: e.target.value })} />
          <Input className="col-span-4 sm:col-span-2" value={c.numero || ''} placeholder="Nº" onChange={(e) => upd(i, { numero: e.target.value })} />
          <Input className="col-span-4 sm:col-span-2" type="date" value={c.emissao || ''} title="Emissão" onChange={(e) => upd(i, { emissao: e.target.value })} />
          <Input className="col-span-3 sm:col-span-2" type="date" value={c.validade || ''} title="Validade" onChange={(e) => upd(i, { validade: e.target.value })} />
          <Button variant="ghost" className="col-span-1" onClick={() => onChange(list.filter((_, k) => k !== i))}>✕</Button>
        </div>
      ))}
      <datalist id="dl-cert">{CERTIFICACOES.map((c) => <option key={c} value={c} />)}</datalist>
      <Button size="sm" variant="outline" onClick={() => onChange([...list, { nome: '' }])}>+ Adicionar certificação</Button>
    </div>
  );
}

const proxVenc = (r: { asoValidade?: string; certificacoes?: Certificacao[] }) => {
  const datas = [r.asoValidade, ...(r.certificacoes || []).map((c) => c.validade)].filter(Boolean) as string[];
  return datas.sort()[0];
};

export const profissionaisCfg: EntityConfig = {
  table: 'profissionais',
  title: 'Profissionais / Equipe técnica',
  singular: 'Profissional',
  icon: <HardHat size={20} />,
  formSize: 'xl',
  fields: [
    { name: 'nome', label: 'Nome completo', type: 'text', required: true, span: 2, section: 'Identificação' },
    { name: 'cpf', label: 'CPF', type: 'doc', span: 1, section: 'Identificação' },
    { name: 'ativo', label: 'Ativo', type: 'checkbox', span: 1, section: 'Identificação' },
    { name: 'funcao', label: 'Função', type: 'text', required: true, span: 2, section: 'Identificação', suggestions: FUNCOES },
    { name: 'conselho', label: 'Conselho', type: 'select', options: ['CREA', 'CFT', 'CRT', 'CAU', 'Nenhum'], span: 1, section: 'Identificação', help: 'Técnicos industriais: CFT/CRT (TRT)' },
    { name: 'registro', label: 'Nº de registro', type: 'text', span: 1, section: 'Identificação' },
    { name: 'especialidades', label: 'Especialidades', type: 'text', span: 4, section: 'Identificação', placeholder: 'Split, VRF, chiller, câmara fria, elétrica…' },
    { name: 'perfil', label: 'Perfil de acesso', type: 'select', options: PERFIS, span: 2, section: 'Acesso à plataforma', help: 'Técnico lança as execuções; supervisor libera as OS' },
    { name: 'pin', label: 'PIN de acesso (opcional)', type: 'text', span: 1, section: 'Acesso à plataforma', placeholder: '4 a 6 dígitos' },
    { name: 'setor', label: 'Setor / equipe', type: 'text', span: 1, section: 'Acesso à plataforma', suggestions: SETORES },
    { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel', span: 1, section: 'Contato e custos' },
    { name: 'email', label: 'E-mail', type: 'email', span: 1, section: 'Contato e custos' },
    { name: 'valorHora', label: 'Custo hora (R$)', type: 'money', span: 1, section: 'Contato e custos' },
    { name: 'cor', label: 'Cor na agenda', type: 'color', span: 1, section: 'Contato e custos' },
    { name: 'admissao', label: 'Admissão', type: 'date', span: 1, section: 'Saúde e segurança' },
    { name: 'asoValidade', label: 'Validade do ASO', type: 'date', span: 1, section: 'Saúde e segurança' },
    { name: 'cnhValidade', label: 'Validade da CNH', type: 'date', span: 1, section: 'Saúde e segurança' },
    { name: 'certificacoes', label: 'Certificações / NRs', type: 'custom', span: 4, section: 'Saúde e segurança', render: ({ value, onChange }) => <CertificacoesEditor value={value} onChange={onChange} /> },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'nome', label: 'Nome', render: (r) => <div className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.cor || '#94a3b8' }} /><div><p className="font-medium">{r.nome}</p><p className="text-xs text-slate-500">{r.especialidades}</p></div></div> },
    { key: 'funcao', label: 'Função' },
    { key: 'perfil', label: 'Perfil', value: (r) => PERFIS.find((p) => p.value === (r.perfil || 'tecnico'))?.label.split(' ')[0] },
    { key: 'registro', label: 'Registro', value: (r) => [r.conselho !== 'Nenhum' ? r.conselho : '', r.registro].filter(Boolean).join(' ') },
    { key: 'telefone', label: 'Telefone' },
    { key: 'valorHora', label: 'Custo/h', value: (r) => r.valorHora || 0, render: (r) => money(r.valorHora) },
    { key: 'aso', label: 'ASO', value: (r) => r.asoValidade, render: (r) => vencBadge(r.asoValidade) },
    { key: 'venc', label: 'Próx. vencimento', value: (r) => proxVenc(r), render: (r) => vencBadge(proxVenc(r)) },
    { key: 'ativo', label: 'Situação', value: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
  ],
  searchText: (r) => [r.nome, r.funcao, r.registro, r.especialidades, r.telefone].join(' '),
  defaults: () => ({ ativo: true, certificacoes: [], cor: '#0e7490', funcao: 'Técnico em Refrigeração', perfil: 'tecnico', setor: 'Manutenção' }),
};

/* ---------------- Peças ---------------- */
export const pecasCfg: EntityConfig = {
  table: 'pecas',
  title: 'Peças e materiais',
  singular: 'Peça',
  icon: <Package size={20} />,
  numbering: { field: 'codigo', kind: 'peca' },
  fields: [
    { name: 'codigo', label: 'Código', type: 'text', span: 1, section: 'Identificação', placeholder: 'Automático' },
    { name: 'descricao', label: 'Descrição', type: 'text', required: true, span: 3, section: 'Identificação' },
    { name: 'categoria', label: 'Categoria', type: 'text', span: 2, section: 'Identificação', suggestions: CATEGORIAS_PECA },
    { name: 'unidade', label: 'Unidade', type: 'select', options: UNIDADES_MEDIDA, span: 1, section: 'Identificação' },
    { name: 'ativo', label: 'Ativo', type: 'checkbox', span: 1, section: 'Identificação' },
    { name: 'marca', label: 'Marca / fabricante', type: 'text', span: 1, section: 'Identificação' },
    { name: 'referencia', label: 'Part number / ref.', type: 'text', span: 1, section: 'Identificação' },
    { name: 'ncm', label: 'NCM', type: 'text', span: 1, section: 'Identificação' },
    { name: 'fornecedorId', label: 'Fornecedor preferencial', type: 'ref', span: 1, section: 'Identificação', ref: { list: (l) => l.fornecedores } },
    { name: 'custo', label: 'Custo unitário (R$)', type: 'money', span: 1, section: 'Preço e estoque' },
    { name: 'precoVenda', label: 'Preço de venda (R$)', type: 'money', span: 1, section: 'Preço e estoque', help: (f) => (f.custo && f.precoVenda ? `Markup ${n2(((f.precoVenda - f.custo) / f.custo) * 100)}%` : undefined) },
    { name: 'estoque', label: 'Estoque atual', type: 'number', span: 1, section: 'Preço e estoque', help: 'Use Movimentações para entradas/saídas' },
    { name: 'estoqueMinimo', label: 'Estoque mínimo', type: 'number', span: 1, section: 'Preço e estoque' },
    { name: 'localizacao', label: 'Localização no almoxarifado', type: 'text', span: 2, section: 'Preço e estoque' },
    { name: 'observacoes', label: 'Observações / compatibilidade', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'codigo', label: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
    { key: 'descricao', label: 'Descrição', render: (r) => <div><p className="font-medium">{r.descricao}</p><p className="text-xs text-slate-500">{r.categoria}</p></div>, value: (r) => r.descricao },
    { key: 'unidade', label: 'Un.' },
    { key: 'custo', label: 'Custo', value: (r) => r.custo || 0, render: (r) => money(r.custo) },
    { key: 'precoVenda', label: 'Venda', value: (r) => r.precoVenda || 0, render: (r) => money(r.precoVenda) },
    {
      key: 'estoque', label: 'Estoque', value: (r) => r.estoque || 0,
      render: (r) => <Badge className={(r.estoque || 0) <= (r.estoqueMinimo || 0) ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'}>{n2(r.estoque)} {r.unidade}</Badge>,
    },
    { key: 'estoqueMinimo', label: 'Mín.', value: (r) => r.estoqueMinimo || 0 },
    { key: 'valorEstoque', label: 'Valor em estoque', value: (r) => (r.estoque || 0) * (r.custo || 0), render: (r) => money((r.estoque || 0) * (r.custo || 0)) },
  ],
  filters: [
    { key: 'categoria', label: 'Categoria', options: (_l, rows) => [...new Set(rows.map((r) => r.categoria).filter(Boolean))].sort().map((t) => ({ value: t, label: t })), test: (r, v) => r.categoria === v },
    { key: 'situacao', label: 'Estoque', options: () => [{ value: 'baixo', label: 'Abaixo do mínimo' }, { value: 'ok', label: 'Normal' }], test: (r, v) => (v === 'baixo' ? (r.estoque || 0) <= (r.estoqueMinimo || 0) : (r.estoque || 0) > (r.estoqueMinimo || 0)) },
  ],
  searchText: (r) => [r.codigo, r.descricao, r.categoria, r.marca, r.referencia].join(' '),
  defaults: () => ({ unidade: 'un', custo: 0, precoVenda: 0, estoque: 0, estoqueMinimo: 0, ativo: true }),
  headerActions: <Link to="/estoque"><Button variant="outline" icon={<Boxes size={16} />}>Movimentações</Button></Link>,
};

/* ---------------- Serviços ---------------- */
export const servicosCfg: EntityConfig = {
  table: 'servicos',
  title: 'Catálogo de serviços',
  singular: 'Serviço',
  icon: <Wrench size={20} />,
  numbering: { field: 'codigo', kind: 'serv' },
  fields: [
    { name: 'codigo', label: 'Código', type: 'text', span: 1, placeholder: 'Automático' },
    { name: 'descricao', label: 'Descrição', type: 'text', required: true, span: 3 },
    { name: 'categoria', label: 'Categoria', type: 'text', span: 2, suggestions: CATEGORIAS_SERVICO },
    { name: 'unidade', label: 'Unidade', type: 'select', options: ['serviço', 'h', 'ponto', 'm', 'm²', 'equipamento', 'mês'], span: 1 },
    { name: 'ativo', label: 'Ativo', type: 'checkbox', span: 1 },
    { name: 'tempoPadraoMin', label: 'Tempo padrão (min)', type: 'number', span: 1 },
    { name: 'preco', label: 'Preço (R$)', type: 'money', span: 1 },
    { name: 'detalhes', label: 'Escopo / descrição técnica', type: 'textarea', span: 4 },
  ],
  columns: [
    { key: 'codigo', label: 'Código', render: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
    { key: 'descricao', label: 'Descrição', render: (r) => <span className="font-medium">{r.descricao}</span> },
    { key: 'categoria', label: 'Categoria' },
    { key: 'unidade', label: 'Un.' },
    { key: 'tempoPadraoMin', label: 'Tempo', value: (r) => r.tempoPadraoMin || 0, render: (r) => (r.tempoPadraoMin ? `${r.tempoPadraoMin} min` : '—') },
    { key: 'preco', label: 'Preço', value: (r) => r.preco || 0, render: (r) => money(r.preco) },
  ],
  filters: [{ key: 'categoria', label: 'Categoria', options: (_l, rows) => [...new Set(rows.map((r) => r.categoria).filter(Boolean))].sort().map((t) => ({ value: t, label: t })), test: (r, v) => r.categoria === v }],
  searchText: (r) => [r.codigo, r.descricao, r.categoria].join(' '),
  defaults: () => ({ unidade: 'serviço', preco: 0, ativo: true }),
};

/* ---------------- Fornecedores ---------------- */
export const fornecedoresCfg: EntityConfig = {
  table: 'fornecedores',
  title: 'Fornecedores',
  singular: 'Fornecedor',
  icon: <Truck size={20} />,
  fields: [
    { name: 'nome', label: 'Razão social / nome', type: 'text', required: true, span: 3 },
    { name: 'cnpj', label: 'CNPJ / CPF', type: 'doc', span: 1 },
    { name: 'categoria', label: 'Categoria', type: 'text', span: 2, suggestions: ['Peças e fluidos', 'Materiais elétricos', 'Equipamentos', 'Análise da qualidade do ar', 'Locação', 'Serviços terceirizados'] },
    { name: 'contato', label: 'Contato', type: 'text', span: 2 },
    { name: 'telefone', label: 'Telefone', type: 'tel', span: 1 },
    { name: 'email', label: 'E-mail', type: 'email', span: 1 },
    { name: 'cidade', label: 'Cidade', type: 'text', span: 1 },
    { name: 'uf', label: 'UF', type: 'select', options: UFS, span: 1 },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4 },
  ],
  columns: [
    { key: 'nome', label: 'Fornecedor', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'categoria', label: 'Categoria' },
    { key: 'contato', label: 'Contato' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'E-mail' },
    { key: 'cidade', label: 'Cidade', value: (r) => [r.cidade, r.uf].filter(Boolean).join('/') },
  ],
  searchText: (r) => [r.nome, r.categoria, r.contato, r.cnpj, r.cidade].join(' '),
  defaults: () => ({}),
};

/* ---------------- Contratos ---------------- */
export const contratosCfg: EntityConfig = {
  table: 'contratos',
  title: 'Contratos',
  singular: 'Contrato',
  icon: <FileSignature size={20} />,
  numbering: { field: 'numero', kind: 'ct' },
  fields: [
    { name: 'numero', label: 'Número', type: 'text', span: 1, placeholder: 'Automático' },
    { name: 'clienteId', label: 'Cliente', type: 'ref', required: true, span: 2, ref: { list: (l) => l.clientes } },
    { name: 'status', label: 'Situação', type: 'select', options: [{ value: 'ativo', label: 'Ativo' }, { value: 'suspenso', label: 'Suspenso' }, { value: 'encerrado', label: 'Encerrado' }], span: 1 },
    { name: 'objeto', label: 'Objeto', type: 'textarea', required: true, span: 4 },
    { name: 'inicio', label: 'Início', type: 'date', required: true, span: 1 },
    { name: 'fim', label: 'Término', type: 'date', required: true, span: 1 },
    { name: 'valorMensal', label: 'Valor mensal (R$)', type: 'money', span: 1 },
    { name: 'diaVencimento', label: 'Dia de vencimento', type: 'number', span: 1 },
    { name: 'slaUrgenteH', label: 'SLA urgente (h)', type: 'number', span: 1, section: 'SLA — prazo de atendimento' },
    { name: 'slaAltaH', label: 'SLA alta (h)', type: 'number', span: 1, section: 'SLA — prazo de atendimento' },
    { name: 'slaMediaH', label: 'SLA média (h)', type: 'number', span: 1, section: 'SLA — prazo de atendimento' },
    { name: 'slaBaixaH', label: 'SLA baixa (h)', type: 'number', span: 1, section: 'SLA — prazo de atendimento' },
    { name: 'observacoes', label: 'Observações / cláusulas', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'numero', label: 'Nº', render: (r) => <span className="font-mono text-xs">{r.numero}</span> },
    { key: 'clienteId', label: 'Cliente', value: (r, l) => l.clienteMap.get(r.clienteId)?.nome },
    { key: 'inicio', label: 'Início', value: (r) => r.inicio, render: (r) => fmtDate(r.inicio) },
    { key: 'fim', label: 'Término', value: (r) => r.fim, render: (r) => vencBadge(r.fim) },
    { key: 'valorMensal', label: 'Mensal', value: (r) => r.valorMensal || 0, render: (r) => money(r.valorMensal) },
    { key: 'status', label: 'Situação', render: (r) => <Badge className={r.status === 'ativo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : undefined}>{r.status}</Badge> },
  ],
  searchText: (r, l) => [r.numero, r.objeto, l.clienteMap.get(r.clienteId)?.nome].join(' '),
  defaults: (l) => ({ status: 'ativo', clienteId: l.clientes[0]?.id, slaUrgenteH: 4, slaAltaH: 24, slaMediaH: 48, slaBaixaH: 120 }),
};

/* ---------------- Qualidade do ar ---------------- */
export function avaliarAnalise(r: { co2?: number; co2Ext?: number; fungos?: number; fungosExt?: number; aerodispersoides?: number; temperatura?: number; umidade?: number; velocidade?: number; renovacao?: number; estacao?: string }) {
  const nc: string[] = [];
  const faixa = r.estacao === 'inverno' ? RE09.inverno : RE09.verao;
  if (r.fungos !== undefined && r.fungos > RE09.fungosMax) nc.push(`Fungos ${r.fungos} > ${RE09.fungosMax} UFC/m³`);
  if (r.fungos !== undefined && r.fungosExt) {
    const ie = r.fungos / r.fungosExt;
    if (ie > RE09.relacaoIEMax) nc.push(`Relação I/E ${n2(ie)} > ${RE09.relacaoIEMax}`);
  }
  if (r.co2 !== undefined && r.co2 > RE09.co2Max) nc.push(`CO₂ ${r.co2} > ${RE09.co2Max} ppm`);
  if (r.aerodispersoides !== undefined && r.aerodispersoides > RE09.aerodispersoidesMax) nc.push(`Aerodispersóides ${r.aerodispersoides} > ${RE09.aerodispersoidesMax} µg/m³`);
  if (r.temperatura !== undefined && (r.temperatura < faixa.tMin || r.temperatura > faixa.tMax)) nc.push(`Temperatura ${r.temperatura} °C fora de ${faixa.tMin}–${faixa.tMax} °C`);
  if (r.umidade !== undefined && (r.umidade < faixa.urMin || r.umidade > faixa.urMax)) nc.push(`Umidade ${r.umidade}% fora de ${faixa.urMin}–${faixa.urMax}%`);
  if (r.velocidade !== undefined && r.velocidade > RE09.velocidadeMax) nc.push(`Velocidade do ar ${r.velocidade} > ${RE09.velocidadeMax} m/s`);
  if (r.renovacao !== undefined && r.renovacao < RE09.renovacaoMin) nc.push(`Renovação ${r.renovacao} < ${RE09.renovacaoMin} m³/h/pessoa`);
  return nc;
}

const re = (label: string, name: string, help: string): FieldDef => ({ name, label, type: 'number', span: 1, section: 'Parâmetros (RE ANVISA 09/2003)', help });

export const qualidadeArCfg: EntityConfig = {
  table: 'analisesAr',
  title: 'Qualidade do ar interior',
  singular: 'Análise',
  icon: <Snowflake size={20} />,
  subtitle: 'Análises laboratoriais conforme RE ANVISA nº 09/2003 — recomendação: semestral',
  sort: { key: 'data', dir: 'desc' },
  fields: [
    { ...unidadeRef(), span: 2, section: 'Coleta', onChangeEffect: () => ({ ambienteId: undefined }) },
    { name: 'ambienteId', label: 'Ambiente (ponto de coleta)', type: 'ref', span: 2, section: 'Coleta', ref: { list: (l) => l.ambientes, filter: (r, f) => r.unidadeId === f.unidadeId } },
    { name: 'data', label: 'Data da coleta', type: 'date', required: true, span: 1, section: 'Coleta' },
    { name: 'estacao', label: 'Estação', type: 'select', options: [{ value: 'verao', label: 'Verão' }, { value: 'inverno', label: 'Inverno' }], span: 1, section: 'Coleta' },
    { name: 'laboratorio', label: 'Laboratório', type: 'text', span: 1, section: 'Coleta', suggestions: (l) => l.fornecedores.map((f) => f.nome) },
    { name: 'laudo', label: 'Nº do laudo', type: 'text', span: 1, section: 'Coleta' },
    re('Fungos internos (UFC/m³)', 'fungos', `VMR ≤ ${RE09.fungosMax}`),
    re('Fungos externos (UFC/m³)', 'fungosExt', `Relação I/E ≤ ${RE09.relacaoIEMax}`),
    re('CO₂ interno (ppm)', 'co2', `≤ ${RE09.co2Max} ppm`),
    re('CO₂ externo (ppm)', 'co2Ext', 'Referência'),
    re('Aerodispersóides (µg/m³)', 'aerodispersoides', `≤ ${RE09.aerodispersoidesMax}`),
    re('Temperatura (°C)', 'temperatura', 'Verão 23–26 · Inverno 20–22'),
    re('Umidade relativa (%)', 'umidade', 'Verão 40–65 · Inverno 35–65'),
    re('Velocidade do ar (m/s)', 'velocidade', `≤ ${RE09.velocidadeMax} a 1,5 m`),
    re('Renovação (m³/h/pessoa)', 'renovacao', `≥ ${RE09.renovacaoMin}`),
    {
      name: 'avaliacao', label: 'Avaliação automática', type: 'custom', span: 4, section: 'Parâmetros (RE ANVISA 09/2003)',
      render: ({ form }) => {
        const nc = avaliarAnalise(form);
        return nc.length ? (
          <ul className="list-inside list-disc rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{nc.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Todos os parâmetros informados estão dentro dos padrões referenciais.</p>
        );
      },
    },
    { name: 'observacoes', label: 'Observações / recomendações', type: 'textarea', span: 4, section: 'Outros' },
  ],
  columns: [
    { key: 'data', label: 'Coleta', value: (r) => r.data, render: (r) => fmtDate(r.data) },
    { key: 'unidadeId', label: 'Unidade', value: (r, l) => l.unidadeMap.get(r.unidadeId)?.nome },
    { key: 'ambienteId', label: 'Ambiente', value: (r, l) => l.ambienteMap.get(r.ambienteId)?.nome },
    { key: 'laudo', label: 'Laudo' },
    { key: 'co2', label: 'CO₂', value: (r) => r.co2 ?? '' },
    { key: 'fungos', label: 'Fungos', value: (r) => r.fungos ?? '' },
    { key: 'ie', label: 'I/E', value: (r) => (r.fungos !== undefined && r.fungosExt ? n2(r.fungos / r.fungosExt) : '') },
    { key: 'temperatura', label: 'T °C', value: (r) => r.temperatura ?? '' },
    { key: 'umidade', label: 'UR %', value: (r) => r.umidade ?? '' },
    { key: 'res', label: 'Resultado', value: (r) => (avaliarAnalise(r).length ? 'Não conforme' : 'Conforme'), render: (r) => { const nc = avaliarAnalise(r); return nc.length ? <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200" >{nc.length} não conformidade(s)</Badge> : <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Conforme</Badge>; } },
    { key: 'prox', label: 'Próxima coleta', value: (r) => r.data, render: (r) => { const d = new Date(r.data + 'T00:00:00'); d.setMonth(d.getMonth() + 6); return vencBadge(d.toISOString().slice(0, 10)); } },
  ],
  filters: [unidadeFilter],
  searchText: (r, l) => [r.laudo, r.laboratorio, l.unidadeMap.get(r.unidadeId)?.nome, l.ambienteMap.get(r.ambienteId)?.nome].join(' '),
  defaults: (l) => ({ unidadeId: l.unidades[0]?.id, data: todayStr(), estacao: 'verao' }),
};

/* ---------------- Fluidos refrigerantes ---------------- */
export const fluidosCfg: EntityConfig = {
  table: 'fluidos',
  title: 'Controle de fluidos refrigerantes',
  singular: 'Registro',
  icon: <Factory size={20} />,
  subtitle: 'Cargas, recolhimentos e testes de estanqueidade por equipamento — com emissões em tCO₂e',
  sort: { key: 'data', dir: 'desc' },
  fields: [
    {
      name: 'equipamentoId', label: 'Equipamento', type: 'ref', required: true, span: 4,
      ref: { list: (l) => l.equipamentos, label: (r, l) => equipLabel(r as never, l) },
      onChangeEffect: (v, _f, l) => ({ fluido: l.equipamentoMap.get(v)?.fluido }),
    },
    { name: 'data', label: 'Data', type: 'date', required: true, span: 1 },
    {
      name: 'operacao', label: 'Operação', type: 'select', required: true, span: 1,
      options: [{ value: 'carga', label: 'Carga / complemento' }, { value: 'recolhimento', label: 'Recolhimento' }, { value: 'reciclagem', label: 'Reciclagem / reuso' }, { value: 'descarte', label: 'Envio p/ destinação' }, { value: 'vazamento', label: 'Vazamento identificado' }, { value: 'estanqueidade', label: 'Teste de estanqueidade' }],
    },
    { name: 'fluido', label: 'Fluido', type: 'select', options: FLUIDOS.map((f) => f.nome), span: 1 },
    { name: 'quantidadeKg', label: 'Quantidade (kg)', type: 'number', span: 1, help: (f) => (f.quantidadeKg && f.fluido ? `${n2((f.quantidadeKg * gwpDe(f.fluido)) / 1000)} tCO₂e` : undefined) },
    { name: 'cilindro', label: 'Cilindro / lote', type: 'text', span: 1 },
    { name: 'profissionalId', label: 'Técnico', type: 'ref', span: 2, ref: { list: (l) => l.profissionais } },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4 },
  ],
  columns: [
    { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => fmtDate(r.data) },
    { key: 'equipamentoId', label: 'Equipamento', value: (r, l) => equipLabel(l.equipamentoMap.get(r.equipamentoId), l) },
    { key: 'operacao', label: 'Operação' },
    { key: 'fluido', label: 'Fluido' },
    { key: 'quantidadeKg', label: 'kg', value: (r) => r.quantidadeKg || 0, render: (r) => n2(r.quantidadeKg) },
    { key: 'co2e', label: 'tCO₂e', value: (r) => ((r.quantidadeKg || 0) * gwpDe(r.fluido)) / 1000, render: (r) => n2(((r.quantidadeKg || 0) * gwpDe(r.fluido)) / 1000) },
    { key: 'profissionalId', label: 'Técnico', value: (r, l) => l.profissionalMap.get(r.profissionalId)?.nome },
  ],
  filters: [
    { key: 'operacao', label: 'Operação', options: () => ['carga', 'recolhimento', 'reciclagem', 'descarte', 'vazamento', 'estanqueidade'].map((x) => ({ value: x, label: x })), test: (r, v) => r.operacao === v },
    { key: 'fluido', label: 'Fluido', options: () => FLUIDOS.map((f) => ({ value: f.nome, label: f.nome })), test: (r, v) => r.fluido === v },
  ],
  topContent: (rows) => {
    const by: Record<string, { carga: number; rec: number }> = {};
    for (const r of rows) {
      const k = r.fluido || '—';
      by[k] ||= { carga: 0, rec: 0 };
      if (r.operacao === 'carga') by[k].carga += r.quantidadeKg || 0;
      if (r.operacao === 'recolhimento') by[k].rec += r.quantidadeKg || 0;
    }
    const total = rows.filter((r) => r.operacao === 'carga').reduce((a, r) => a + ((r.quantidadeKg || 0) * gwpDe(r.fluido)) / 1000, 0);
    return (
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Emissões potenciais (cargas)</p>
          <p className="text-xl font-bold">{n2(total)} tCO₂e</p>
        </div>
        {Object.entries(by).slice(0, 3).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-sm"><b>{n2(v.carga)} kg</b> carregados · <b>{n2(v.rec)} kg</b> recolhidos</p>
          </div>
        ))}
      </div>
    );
  },
  searchText: (r, l) => [r.fluido, r.operacao, r.cilindro, l.equipamentoMap.get(r.equipamentoId)?.tag].join(' '),
  defaults: () => ({ data: todayStr(), operacao: 'carga' }),
};

