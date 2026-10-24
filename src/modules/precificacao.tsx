import { Link } from 'react-router-dom';
import { UsersRound, Wand2 } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, Button, Select, cx, useToast } from '../components/ui';
import { num, pct } from '../components/precoUi';
import type { CargoPreco } from '../db/types';
import { money } from '../lib/format';
import { REGIMES, VINCULOS, custoCargo, encargosGrupoA, horasMes, modoInsumos, vinculoDe } from '../lib/precificacao';
import { criarCargosSugeridos, useParametrosPreco } from '../lib/precificacaoDb';

const ehClt = (form: Record<string, unknown>) => !form.vinculo || form.vinculo === 'clt';

/** Select sem a opção vazia, com o valor efetivo (registros antigos não têm o campo). */
const selectFixo = (opcoes: { value: string; label: string }[], efetivo: (form: Record<string, unknown>) => string) =>
  function SelectFixo({ form, onChange }: { form: Record<string, unknown>; onChange: (v: unknown) => void }) {
    return (
      <Select value={efetivo(form)} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    );
  };
const OPCOES_INSUMOS = [
  { value: 'composicao', label: 'Pela composição de custos (tabelas por item)' },
  { value: 'manual', label: 'Valores mensais informados aqui' },
];

/** Demonstrativo do custo de quem executa (módulos da planilha da IN 5/2017 para CLT) e custo-hora. */
export function DemonstrativoCargo({ cargo, compacto }: { cargo: Partial<CargoPreco>; compacto?: boolean }) {
  const p = useParametrosPreco();
  if (!p) return null;
  const c = custoCargo(cargo, p);
  const l = (rotulo: string, valor: number, extra?: string, forte?: boolean) => (
    <div className={cx('flex justify-between gap-3 border-b border-slate-100 py-1 dark:border-slate-800', forte && 'font-semibold')}>
      <span>{rotulo}{extra && <span className="text-xs text-slate-500"> {extra}</span>}</span>
      <span className="tabular-nums">{money(valor)}</span>
    </div>
  );
  const d = c.insumosDetalhe;
  const insumosExtra = c.insumosModo === 'composicao' && d ? `(composição: uniformes ${money(d.uniforme)} · EPI ${money(d.epi)} · exames ${money(d.exame)} · treinamentos ${money(d.treinamento)})` : '(valores manuais)';
  return (
    <div className={cx('rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700', compacto && 'text-xs')}>
      {c.vinculo === 'clt' ? (
        <>
          {l('Módulo 1 — Remuneração', c.remuneracao, c.periculosidade || c.insalubridade ? `(periculosidade ${money(c.periculosidade)} · insalubridade ${money(c.insalubridade)})` : undefined)}
          {l('2.1 — 13º, férias e 1/3', c.modulo21, `(${pct(p.decimoTerceiro + p.feriasTerco)})`)}
          {l('2.2 — Encargos (Grupo A)', c.modulo22, `(${pct(c.grupoA)} sobre 1 + 2.1)`)}
          {l('2.3 — Benefícios', c.modulo23, `(VT líquido ${money(c.vt)} · alimentação ${money(c.va)})`)}
          {l('Módulo 3 — Provisão para rescisão', c.modulo3)}
        </>
      ) : (
        <>
          {l(c.vinculo === 'socio' ? 'Pró-labore (retirada mensal)' : 'Valor mensal pago ao autônomo (RPA)', c.remuneracao)}
          {l(c.encargoNome, c.modulo22, `(${pct(c.grupoA)})`)}
          {l('Benefícios', c.modulo23, c.vinculo === 'autonomo' ? `(transporte ${money(c.vt)} · alimentação ${money(c.va)})` : undefined)}
          <p className="py-1 text-xs text-slate-500">Sem 13º, férias e rescisão: não há vínculo de emprego.</p>
        </>
      )}
      {l('Insumos de pessoal', c.insumos, insumosExtra)}
      {l('Custo mensal', c.total, undefined, true)}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 p-2 dark:bg-brand-950/50">
        <span className="text-xs text-slate-600 dark:text-slate-300">÷ {num(c.horasProdutivas, 1)} horas produtivas/mês</span>
        <span className="text-lg font-bold text-brand-800 dark:text-brand-200">{money(c.custoHora)}/h</span>
      </div>
    </div>
  );
}

function CustoCelula({ cargo, campo }: { cargo: CargoPreco; campo: 'total' | 'custoHora' }) {
  const p = useParametrosPreco();
  if (!p) return null;
  const c = custoCargo(cargo, p);
  return <span className={cx('tabular-nums', campo === 'custoHora' && 'font-semibold')}>{money(c[campo])}</span>;
}

function ResumoParametros({ vazio }: { vazio: boolean }) {
  const p = useParametrosPreco();
  const toast = useToast();
  if (!p) return null;
  const regime = REGIMES.find((r) => r.value === p.regime)?.label.split(' — ')[0] || p.regime;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span><b>Regime:</b> {regime}</span>
        <span><b>Encargos (Grupo A):</b> {pct(encargosGrupoA(p).total)}</span>
        <span><b>Horas produtivas:</b> {num(horasMes(p).produtivas, 1)} h/mês</span>
        <Link to="/precificacao/tributos" className="text-brand-700 hover:underline dark:text-brand-300">alterar parâmetros</Link>
        <Link to="/precificacao/custos" className="text-brand-700 hover:underline dark:text-brand-300">EPI, uniformes e exames</Link>
      </div>
      {p.regime === 'mei' && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          MEI: cadastre o titular como <b>sócio ou titular (pró-labore)</b> — o INSS dele já está no DAS — e, se houver, o único empregado como CLT (3% de INSS patronal + 8% de FGTS).
        </p>
      )}
      {vazio && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <span>Cadastre os cargos da equipe com os valores da sua convenção coletiva (CCT). Comece pelos cargos sugeridos e informe os salários.</span>
          <Button icon={<Wand2 size={16} />} onClick={async () => { await criarCargosSugeridos(); toast('Cargos criados — informe os salários da CCT.'); }}>Criar cargos sugeridos</Button>
        </div>
      )}
    </div>
  );
}

export const cargosCfg: EntityConfig = {
  table: 'cargosPreco',
  title: 'Equipe e custo-hora',
  singular: 'Cargo',
  icon: <UsersRound size={20} />,
  subtitle: 'Remuneração, benefícios, encargos e insumos de cada cargo → custo mensal e custo da hora produtiva',
  sort: { key: 'nome', dir: 'asc' },
  formSize: 'xl',
  fields: [
    { name: 'nome', label: 'Cargo / função', type: 'text', required: true, span: 2, section: 'Vínculo e remuneração' },
    {
      name: 'vinculo',
      label: 'Vínculo',
      type: 'custom',
      span: 2,
      section: 'Vínculo e remuneração',
      render: selectFixo(VINCULOS.map((v) => ({ value: v.value, label: v.label })), (f) => (f.vinculo as string) || 'clt'),
      onChangeEffect: (v) => (v && v !== 'clt' ? { periculosidade: false, insalubridade: '0' } : undefined),
      help: (form) =>
        form.vinculo === 'socio'
          ? 'Sócio ou titular do MEI que executa os serviços. Sem 13º, férias e rescisão; INSS patronal conforme o regime.'
          : form.vinculo === 'autonomo'
            ? 'Prestador pago por RPA (diarista). Sem vínculo de emprego: cuidado com habitualidade e subordinação.'
            : 'Empregado com carteira assinada: planilha completa da IN 5/2017.',
    },
    { name: 'cct', label: 'Convenção coletiva / vigência', type: 'text', span: 2, section: 'Vínculo e remuneração', placeholder: 'Sindicato, nº de registro no MTE, data-base', hidden: (f) => !ehClt(f) },
    {
      name: 'salarioBase',
      label: 'Salário-base (piso)',
      labelDe: (f) => (f.vinculo === 'socio' ? 'Pró-labore (retirada mensal)' : f.vinculo === 'autonomo' ? 'Valor mensal pago (RPA)' : 'Salário-base (piso)'),
      type: 'money',
      required: true,
      span: 1,
      section: 'Vínculo e remuneração',
    },
    { name: 'periculosidade', label: 'Periculosidade', type: 'checkbox', span: 1, section: 'Vínculo e remuneração', placeholder: '30% sobre o salário (NR-16)', hidden: (f) => !ehClt(f) },
    { name: 'insalubridade', label: 'Insalubridade', type: 'select', span: 1, section: 'Vínculo e remuneração', hidden: (f) => !ehClt(f), options: [{ value: '0', label: 'Não' }, { value: '10', label: 'Grau mínimo (10%)' }, { value: '20', label: 'Grau médio (20%)' }, { value: '40', label: 'Grau máximo (40%)' }] },
    { name: 'outrosAdicionais', label: 'Outros adicionais (R$/mês)', type: 'money', span: 1, section: 'Vínculo e remuneração' },
    { name: 'valeTransporteDia', label: 'Vale-transporte (R$/dia)', type: 'money', span: 1, section: 'Benefícios', hidden: (f) => f.vinculo === 'socio' },
    { name: 'valeAlimentacaoDia', label: 'Vale-alimentação (R$/dia)', type: 'money', span: 1, section: 'Benefícios', hidden: (f) => f.vinculo === 'socio' },
    { name: 'diasMes', label: 'Dias de trabalho no mês', type: 'number', span: 1, section: 'Benefícios', hidden: (f) => f.vinculo === 'socio' },
    { name: 'planoSaude', label: 'Plano de saúde (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'seguroVida', label: 'Seguro de vida (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'outrosBeneficios', label: 'Outros benefícios (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    {
      name: 'insumosModo',
      label: 'Uniformes, EPI, exames e treinamentos',
      type: 'custom',
      span: 2,
      section: 'Insumos de pessoal',
      render: selectFixo(OPCOES_INSUMOS, (f) => modoInsumos(f as Partial<CargoPreco>)),
      help: (f) => (modoInsumos(f as Partial<CargoPreco>) === 'manual' ? 'Prefira a composição: ela detalha cada item na planilha de preços.' : 'Edite os itens em Precificação › Composição de custos.'),
    },
    { name: 'uniformeEpiMes', label: 'Uniformes e EPI (R$/mês)', type: 'money', span: 1, section: 'Insumos de pessoal', hidden: (f) => modoInsumos(f as Partial<CargoPreco>) !== 'manual' },
    { name: 'examesTreinamentoMes', label: 'Exames (ASO) e treinamentos NR (R$/mês)', type: 'money', span: 1, section: 'Insumos de pessoal', hidden: (f) => modoInsumos(f as Partial<CargoPreco>) !== 'manual' },
    { name: 'ativo', label: 'Situação', type: 'checkbox', span: 1, section: 'Insumos de pessoal', placeholder: 'Ativo' },
    {
      name: 'demonstrativo',
      label: 'Demonstrativo do custo (atualiza enquanto você digita)',
      type: 'custom',
      span: 4,
      section: 'Custo calculado',
      render: ({ form }) => <DemonstrativoCargo cargo={{ ...form, insalubridade: Number(form.insalubridade || 0) } as Partial<CargoPreco>} />,
    },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Custo calculado' },
  ],
  columns: [
    { key: 'nome', label: 'Cargo', render: (r) => <span className="font-medium">{r.nome}{!r.ativo && <Badge className="ml-2">inativo</Badge>}</span> },
    { key: 'vinculo', label: 'Vínculo', value: (r) => vinculoDe(r.vinculo).curto },
    { key: 'salarioBase', label: 'Remuneração', value: (r) => r.salarioBase || 0, render: (r) => (r.salarioBase ? money(r.salarioBase) : <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">informe o valor</Badge>) },
    { key: 'adicionais', label: 'Adicionais', value: (r) => [r.periculosidade && 'Periculosidade', Number(r.insalubridade) > 0 && `Insalubridade ${r.insalubridade}%`].filter(Boolean).join(', ') },
    { key: 'custoMensal', label: 'Custo mensal', noExport: true, render: (r) => <CustoCelula cargo={{ ...r, insalubridade: Number(r.insalubridade || 0) } as CargoPreco} campo="total" /> },
    { key: 'custoHora', label: 'Custo-hora', noExport: true, render: (r) => <CustoCelula cargo={{ ...r, insalubridade: Number(r.insalubridade || 0) } as CargoPreco} campo="custoHora" /> },
    { key: 'cct', label: 'CCT', className: 'hidden 2xl:table-cell' },
  ],
  searchText: (r) => [r.nome, r.cct].join(' '),
  defaults: () => ({ ativo: true, vinculo: 'clt', diasMes: 22, periculosidade: true, insalubridade: '0', insumosModo: 'composicao' }),
  beforeSave: (form) => ({
    ...form,
    insalubridade: ehClt(form) ? Number(form.insalubridade || 0) : 0,
    periculosidade: ehClt(form) ? !!form.periculosidade : false,
  }),
  topContent: (rows) => <ResumoParametros vazio={rows.length === 0} />,
};
