import { Link } from 'react-router-dom';
import { UsersRound, Wand2 } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, Button, cx, useToast } from '../components/ui';
import { num, pct } from '../components/precoUi';
import type { CargoPreco } from '../db/types';
import { money } from '../lib/format';
import { custoCargo, encargosGrupoA, horasMes } from '../lib/precificacao';
import { criarCargosSugeridos, useParametrosPreco } from '../lib/precificacaoDb';

/** Demonstrativo do custo do empregado (módulos da planilha da IN 5/2017) e custo-hora. */
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
  return (
    <div className={cx('rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700', compacto && 'text-xs')}>
      {l('Módulo 1 — Remuneração', c.remuneracao, c.periculosidade || c.insalubridade ? `(periculosidade ${money(c.periculosidade)} · insalubridade ${money(c.insalubridade)})` : undefined)}
      {l('2.1 — 13º, férias e 1/3', c.modulo21, `(${pct(p.decimoTerceiro + p.feriasTerco)})`)}
      {l('2.2 — Encargos (Grupo A)', c.modulo22, `(${pct(c.grupoA)} sobre 1 + 2.1)`)}
      {l('2.3 — Benefícios', c.modulo23, `(VT líquido ${money(c.vt)} · alimentação ${money(c.va)})`)}
      {l('Módulo 3 — Provisão para rescisão', c.modulo3)}
      {l('Insumos de pessoal (uniforme, EPI, exames, treinamento)', c.insumos)}
      {l('Custo mensal do empregado', c.total, undefined, true)}
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
  const regime = p.regime === 'simples' ? 'Simples Nacional (Anexo III)' : p.regime === 'presumido' ? 'Lucro Presumido' : 'Lucro Real';
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span><b>Regime:</b> {regime}</span>
        <span><b>Encargos (Grupo A):</b> {pct(encargosGrupoA(p).total)}</span>
        <span><b>Horas produtivas:</b> {num(horasMes(p).produtivas, 1)} h/mês</span>
        <Link to="/precificacao/tributos" className="text-brand-700 hover:underline dark:text-brand-300">alterar parâmetros</Link>
      </div>
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
  subtitle: 'Remuneração, benefícios e encargos de cada cargo → custo mensal e custo da hora produtiva',
  sort: { key: 'nome', dir: 'asc' },
  formSize: 'xl',
  fields: [
    { name: 'nome', label: 'Cargo', type: 'text', required: true, span: 2, section: 'Remuneração (CCT)' },
    { name: 'cct', label: 'Convenção coletiva / vigência', type: 'text', span: 2, section: 'Remuneração (CCT)', placeholder: 'Sindicato, nº de registro no MTE, data-base' },
    { name: 'salarioBase', label: 'Salário-base (piso)', type: 'money', required: true, span: 1, section: 'Remuneração (CCT)' },
    { name: 'periculosidade', label: 'Periculosidade', type: 'checkbox', span: 1, section: 'Remuneração (CCT)', placeholder: '30% sobre o salário (NR-16)' },
    { name: 'insalubridade', label: 'Insalubridade', type: 'select', span: 1, section: 'Remuneração (CCT)', options: [{ value: '0', label: 'Não' }, { value: '10', label: 'Grau mínimo (10%)' }, { value: '20', label: 'Grau médio (20%)' }, { value: '40', label: 'Grau máximo (40%)' }] },
    { name: 'outrosAdicionais', label: 'Outros adicionais (R$/mês)', type: 'money', span: 1, section: 'Remuneração (CCT)' },
    { name: 'valeTransporteDia', label: 'Vale-transporte (R$/dia)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'valeAlimentacaoDia', label: 'Vale-alimentação (R$/dia)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'diasMes', label: 'Dias de trabalho no mês', type: 'number', span: 1, section: 'Benefícios' },
    { name: 'planoSaude', label: 'Plano de saúde (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'seguroVida', label: 'Seguro de vida (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'outrosBeneficios', label: 'Outros benefícios (R$/mês)', type: 'money', span: 1, section: 'Benefícios' },
    { name: 'uniformeEpiMes', label: 'Uniformes e EPI (R$/mês)', type: 'money', span: 1, section: 'Insumos de pessoal' },
    { name: 'examesTreinamentoMes', label: 'Exames (ASO) e treinamentos NR (R$/mês)', type: 'money', span: 1, section: 'Insumos de pessoal' },
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
    { key: 'salarioBase', label: 'Salário-base', value: (r) => r.salarioBase || 0, render: (r) => (r.salarioBase ? money(r.salarioBase) : <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">informe o salário</Badge>) },
    { key: 'adicionais', label: 'Adicionais', value: (r) => [r.periculosidade && 'Periculosidade', Number(r.insalubridade) > 0 && `Insalubridade ${r.insalubridade}%`].filter(Boolean).join(', ') },
    { key: 'custoMensal', label: 'Custo mensal', noExport: true, render: (r) => <CustoCelula cargo={{ ...r, insalubridade: Number(r.insalubridade || 0) } as CargoPreco} campo="total" /> },
    { key: 'custoHora', label: 'Custo-hora', noExport: true, render: (r) => <CustoCelula cargo={{ ...r, insalubridade: Number(r.insalubridade || 0) } as CargoPreco} campo="custoHora" /> },
    { key: 'cct', label: 'CCT' },
  ],
  searchText: (r) => [r.nome, r.cct].join(' '),
  defaults: () => ({ ativo: true, diasMes: 22, periculosidade: true, insalubridade: '0' }),
  beforeSave: (form) => ({ ...form, insalubridade: Number(form.insalubridade || 0) }),
  topContent: (rows) => <ResumoParametros vazio={rows.length === 0} />,
};
