import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building2, FlaskConical, HardHat, Layers, Truck, Wrench } from 'lucide-react';
import { db, uid } from '../../db/db';
import type { ComposicaoCustos, ItemFerramenta, ItemInsumo, ItemPessoal, LinhaCusto, ParametrosPreco, VeiculoComposicao } from '../../db/types';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Tabs, cx } from '../../components/ui';
import { LinhaResumo, Num, TabelaEditavel, num, pct, useParametrosEditaveis } from '../../components/precoUi';
import { money } from '../../lib/format';
import {
  ADMINISTRATIVAS_SUGERIDAS,
  CATEGORIAS_PESSOAL,
  CUSTOS_CONTRATO_PADRAO,
  FAIXAS_BTU,
  FERRAMENTAS_SUGERIDAS,
  INSUMOS_SUGERIDOS,
  PESSOAL_SUGERIDO,
  calcBdi,
  custoFerramentas,
  custoPessoalCargo,
  custoVeiculo,
  despesasFixas,
  ferramentaMensal,
  horasMes,
  insumoMensal,
  insumosPorEquipamento,
  modoInsumos,
  pessoalMensal,
  round2,
  tributosFaturamento,
} from '../../lib/precificacao';

type Aba = 'ferramentas' | 'pessoal' | 'insumos' | 'veiculo' | 'administrativas' | 'contrato';

/** Composição dos custos: ferramentas, EPI/uniformes/exames/treinamentos, insumos, veículo e despesas administrativas. */
export default function ComposicaoCustosPage() {
  const [p, upd, , salvo] = useParametrosEditaveis();
  const [aba, setAba] = useState<Aba>('ferramentas');
  if (!p) return <p className="text-sm text-slate-500">Carregando…</p>;
  const comp = p.composicao;
  const setComp = (patch: Partial<ComposicaoCustos>) => upd({ composicao: { ...comp, ...patch } });
  const horas = horasMes(p).produtivas;
  const fer = custoFerramentas(comp);
  const vei = custoVeiculo(comp.veiculo);
  const insEq = insumosPorEquipamento(comp);
  const desp = despesasFixas(p);
  const comuns = custoPessoalCargo(undefined, comp).total;
  const porHora = (v: number) => (horas > 0 ? v / horas : 0);

  const tiles: { aba: Aba; icone: ReactNode; titulo: string; valor: string; detalhe: string }[] = [
    { aba: 'ferramentas', icone: <Wrench size={16} />, titulo: 'Ferramentas (kit)', valor: `${money(fer.mensal)}/mês`, detalhe: `${money(porHora(fer.mensal))} por hora` },
    { aba: 'pessoal', icone: <HardHat size={16} />, titulo: 'EPI, uniformes e exames', valor: `${money(comuns)}/mês`, detalhe: 'por empregado (itens comuns)' },
    { aba: 'insumos', icone: <FlaskConical size={16} />, titulo: 'Insumos', valor: `${money(insEq)}/mês`, detalhe: 'por equipamento atendido' },
    { aba: 'veiculo', icone: <Truck size={16} />, titulo: 'Veículo', valor: `${money(vei.fixoMensal)}/mês`, detalhe: `+ ${money(vei.variavelKm)} por km` },
    { aba: 'administrativas', icone: <Building2 size={16} />, titulo: 'Despesas fixas', valor: `${money(desp.total)}/mês`, detalhe: `${pct(desp.pct, 1)} do faturamento` },
  ];

  return (
    <div>
      <PageHeader
        title="Composição de custos"
        subtitle="Tabelas de ferramentas, EPI, uniformes, exames, treinamentos, insumos, veículo e despesas administrativas — base do custo-hora, dos materiais e do BDI"
        icon={<Layers size={20} />}
        actions={<span className="text-xs text-slate-500">{salvo ? 'Salvo' : 'Salvando…'}</span>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <button
            key={t.aba}
            type="button"
            onClick={() => setAba(t.aba)}
            className={cx(
              'rounded-xl border bg-white p-3 text-left shadow-sm transition-colors dark:bg-slate-900',
              aba === t.aba ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700',
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">{t.icone}{t.titulo}</span>
            <span className="mt-1 block text-lg font-bold tabular-nums text-slate-900 dark:text-white">{t.valor}</span>
            <span className="block text-xs text-slate-500">{t.detalhe}</span>
          </button>
        ))}
      </div>
      <Tabs<Aba>
        value={aba}
        onChange={setAba}
        tabs={[
          { value: 'ferramentas', label: 'Ferramentas e instrumentos' },
          { value: 'pessoal', label: 'EPI, uniformes, exames e treinamentos' },
          { value: 'insumos', label: 'Insumos por equipamento' },
          { value: 'veiculo', label: 'Veículo' },
          { value: 'administrativas', label: 'Despesas administrativas' },
          { value: 'contrato', label: 'Custos do contrato' },
        ]}
      />
      {aba === 'ferramentas' && (
        <Card title="Kit de ferramentas e instrumentos de uma equipe" actions={<span className="text-xs text-slate-500">depreciação linear + manutenção e calibração</span>}>
          <TabelaEditavel<ItemFerramenta>
            linhas={comp.ferramentas}
            onChange={(ferramentas) => setComp({ ferramentas })}
            novaLinha={() => ({ id: uid(), descricao: '', quantidade: 1, valorUnit: 0, vidaUtilMeses: 36, residualPct: 0, manutencaoAnual: 0 })}
            sugeridos={FERRAMENTAS_SUGERIDAS}
            chave={(l) => l.id}
            minWidth="min-w-[980px]"
            colunas={[
              { key: 'descricao', label: 'Ferramenta / instrumento', campo: 'descricao' },
              { key: 'quantidade', label: 'Qtd', campo: 'quantidade', tipo: 'numero', className: 'w-20' },
              { key: 'valor', label: 'Valor unitário', campo: 'valorUnit', tipo: 'moeda', className: 'w-36' },
              { key: 'vida', label: 'Vida útil', campo: 'vidaUtilMeses', tipo: 'numero', sufixo: 'meses', className: 'w-32' },
              { key: 'residual', label: 'Residual', campo: 'residualPct', tipo: 'numero', sufixo: '%', className: 'w-24' },
              { key: 'manut', label: 'Manutenção / calibração', campo: 'manutencaoAnual', tipo: 'moeda', sufixo: '/ano', className: 'w-40' },
              { key: 'mensal', label: 'Custo mensal', direita: true, className: 'w-28', calc: (l) => money(ferramentaMensal(l)) },
            ]}
            resumo={
              <div className="min-w-[300px]">
                <LinhaResumo rotulo="Investimento no kit" valor={money(fer.investimento)} />
                <LinhaResumo rotulo="Custo mensal do kit" valor={money(fer.mensal)} forte />
                <LinhaResumo rotulo={`Por hora produtiva (÷ ${num(horas, 1)} h)`} valor={`${money(porHora(fer.mensal))}/h`} forte />
              </div>
            }
          />
          <Nota>
            Custo mensal = quantidade × valor × (1 − residual) ÷ vida útil + manutenção ÷ 12. No estudo de preço, cada kit é alocado pelas horas de serviço do contrato (custo por hora × horas), como o custo horário de equipamentos das composições do SINAPI.
          </Nota>
        </Card>
      )}
      {aba === 'pessoal' && <AbaPessoal comp={comp} setComp={setComp} />}
      {aba === 'insumos' && (
        <Card title="Materiais de consumo por equipamento atendido (média mensal)">
          <TabelaEditavel<ItemInsumo>
            linhas={comp.insumos}
            onChange={(insumos) => setComp({ insumos })}
            novaLinha={() => ({ id: uid(), descricao: '', unidade: 'un', consumoMes: 0, valorUnit: 0 })}
            sugeridos={INSUMOS_SUGERIDOS}
            chave={(l) => l.id}
            minWidth="min-w-[820px]"
            colunas={[
              { key: 'descricao', label: 'Material', campo: 'descricao' },
              { key: 'unidade', label: 'Unid.', campo: 'unidade', className: 'w-24' },
              { key: 'consumo', label: 'Consumo por equip./mês', campo: 'consumoMes', tipo: 'numero', className: 'w-44' },
              { key: 'valor', label: 'Valor unitário', campo: 'valorUnit', tipo: 'moeda', className: 'w-36' },
              { key: 'mensal', label: 'Custo/mês', direita: true, className: 'w-28', calc: (l) => money(insumoMensal(l)) },
            ]}
            resumo={
              <div className="min-w-[320px]">
                <LinhaResumo rotulo="Por equipamento/mês (fator 1,0)" valor={money(insEq)} forte />
                {FAIXAS_BTU.filter((x) => x.fator !== 1).map((x) => (
                  <LinhaResumo key={x.id} rotulo={<span className="text-xs text-slate-500">{x.label} (× {num(x.fator)})</span>} valor={<span className="text-xs">{money(insEq * x.fator)}</span>} />
                ))}
              </div>
            }
          />
          <Nota>
            Consumo médio de um equipamento por mês, já considerando a periodicidade das limpezas (ex.: 0,08 L de limpador por mês ≈ 0,24 L a cada limpeza trimestral). Ao gerar os itens do estudo, cada faixa recebe este valor × o fator de porte; filtros e peças de reposição entram por orçamento ou em item próprio.
          </Nota>
        </Card>
      )}
      {aba === 'veiculo' && <AbaVeiculo v={comp.veiculo} onChange={(veiculo) => setComp({ veiculo })} horas={horas} />}
      {aba === 'administrativas' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card title="Despesas fixas mensais da empresa (administração central)">
            <TabelaEditavel<LinhaCusto>
              linhas={comp.administrativas}
              onChange={(administrativas) => setComp({ administrativas })}
              novaLinha={() => ({ id: uid(), descricao: '', valorMensal: 0 })}
              sugeridos={ADMINISTRATIVAS_SUGERIDAS}
              chave={(l) => l.id || l.descricao}
              minWidth="min-w-[520px]"
              colunas={[
                { key: 'descricao', label: 'Despesa', campo: 'descricao' },
                { key: 'valor', label: 'Valor mensal', campo: 'valorMensal', tipo: 'moeda', className: 'w-44' },
              ]}
            />
            {p.regime === 'mei' && (
              <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-slate-800/60">
                + DAS-MEI (INSS do titular + ISS), calculado em Tributos: <b>{money(desp.itens.find((x) => x.id === 'das-mei')?.valorMensal)}/mês</b>
              </p>
            )}
            <Nota>Não inclua aqui o que já está no custo da equipe (salários dos técnicos), nas ferramentas ou no veículo. Esses valores formam a administração central (AC) do BDI ou as despesas fixas do markup.</Nota>
          </Card>
          <Card title="Peso no preço">
            <Num label="Faturamento mensal médio da empresa" prefix="R$" value={p.faturamentoMensal} onChange={(v) => upd({ faturamentoMensal: v ?? 0 })} help={p.regime === 'simples' ? `RBT12 ÷ 12 = ${money(p.rbt12 / 12)}` : 'Média dos últimos meses ou a meta do ano'} />
            <div className="mt-3">
              <LinhaResumo rotulo="Despesas fixas" valor={`${money(desp.total)}/mês`} forte />
              <LinhaResumo rotulo="Sobre o faturamento" valor={pct(desp.pct)} dica="usadas nas despesas fixas do markup" forte />
              <AcEquivalente p={p} upd={upd} pctFaturamento={desp.pct} />
            </div>
          </Card>
        </div>
      )}
      {aba === 'contrato' && (
        <Card title="Outros custos mensais de cada contrato">
          <TabelaEditavel<LinhaCusto>
            linhas={p.custosPadrao}
            onChange={(custosPadrao) => upd({ custosPadrao: custosPadrao.map((c) => ({ descricao: c.descricao, valorMensal: c.valorMensal })) })}
            novaLinha={() => ({ descricao: '', valorMensal: 0 })}
            sugeridos={CUSTOS_CONTRATO_PADRAO}
            chave={(l) => l.descricao}
            minWidth="min-w-[520px]"
            colunas={[
              { key: 'descricao', label: 'Custo', campo: 'descricao' },
              { key: 'valor', label: 'Valor mensal', campo: 'valorMensal', tipo: 'moeda', className: 'w-44' },
            ]}
            resumo={<LinhaResumo rotulo="Total" valor={`${money(p.custosPadrao.reduce((a, c) => a + (c.valorMensal || 0), 0))}/mês`} forte />}
          />
          {p.custosPadrao.some((c) => /^(Veículo|Ferramentas)/i.test(c.descricao) && c.valorMensal > 0) && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Veículo e ferramentas agora são calculados nas abas próprias e entram no estudo pelas horas. Remova essas linhas daqui para não contar duas vezes.
            </p>
          )}
          <Nota>Entram em cada novo estudo como custos indiretos do contrato e são rateados entre os equipamentos. Ex.: horas do engenheiro responsável e ART/TRT, supervisão do contrato, seguro-garantia.</Nota>
        </Card>
      )}
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-slate-500">{children}</p>;
}

/** AC do BDI equivalente às despesas fixas: % do faturamento × (1 + BDI), já que o AC incide sobre o custo direto. */
function AcEquivalente({ p, upd, pctFaturamento }: { p: ParametrosPreco; upd: (patch: Partial<ParametrosPreco>) => void; pctFaturamento: number }) {
  const bdi = calcBdi(p.bdi, tributosFaturamento(p).total).bdi;
  const ac = round2(pctFaturamento * (1 + bdi / 100));
  return (
    <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-950/50">
      <p>
        No BDI do TCU, o AC incide sobre o custo direto: <b>≈ {pct(ac)}</b>
        <span className="block text-xs text-slate-500">{pct(pctFaturamento)} × (1 + BDI de {pct(bdi)}). AC atual: {pct(p.bdi.ac)}.</span>
      </p>
      <Button size="sm" variant="outline" className="mt-2" disabled={!ac} onClick={() => upd({ bdi: { ...p.bdi, ac } })}>Usar {pct(ac)} no BDI padrão</Button>
    </div>
  );
}

function AbaPessoal({ comp, setComp }: { comp: ComposicaoCustos; setComp: (patch: Partial<ComposicaoCustos>) => void }) {
  const cargos = useLiveQuery(() => db.cargosPreco.toArray(), []) || [];
  const [editando, setEditando] = useState<number | null>(null);
  const nomes = new Map(cargos.map((c) => [c.id, c.nome]));
  const item = editando !== null ? comp.pessoal[editando] : undefined;
  const setItem = (patch: Partial<ItemPessoal>) => editando !== null && setComp({ pessoal: comp.pessoal.map((x, k) => (k === editando ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-4">
      <Card title="Itens por empregado (quantidade por ano)">
        <TabelaEditavel<ItemPessoal>
          linhas={comp.pessoal}
          onChange={(pessoal) => setComp({ pessoal })}
          novaLinha={() => ({ id: uid(), categoria: 'epi', descricao: '', qtdAno: 1, valorUnit: 0 })}
          sugeridos={PESSOAL_SUGERIDO}
          chave={(l) => l.id}
          minWidth="min-w-[1120px]"
          colunas={[
            { key: 'categoria', label: 'Categoria', campo: 'categoria', tipo: 'select', opcoes: CATEGORIAS_PESSOAL, className: 'w-40' },
            { key: 'descricao', label: 'Item', campo: 'descricao' },
            { key: 'qtd', label: 'Qtd por ano', campo: 'qtdAno', tipo: 'numero', className: 'w-28' },
            { key: 'valor', label: 'Valor unitário', campo: 'valorUnit', tipo: 'moeda', className: 'w-36' },
            { key: 'ref', label: 'CA / NR', campo: 'ref', className: 'w-32', placeholder: 'CA ou NR' },
            {
              key: 'cargos',
              label: 'Aplica-se a',
              className: 'w-44',
              render: (l, _set, i) => (
                <button type="button" onClick={() => setEditando(i)} className="w-full truncate rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-left text-xs text-slate-600 hover:border-brand-400 dark:border-slate-600 dark:text-slate-300">
                  {l.cargos?.length ? l.cargos.map((id) => nomes.get(id) || '—').join(', ') : 'Todos os cargos'}
                </button>
              ),
            },
            { key: 'mensal', label: 'Custo/mês', direita: true, className: 'w-28', calc: (l) => money(pessoalMensal(l)) },
          ]}
        />
        <Nota>Uniformes e EPI (NR-6), exames do PCMSO (NR-7) e treinamentos obrigatórios (NR-10, NR-35). Quantidade por empregado por ano: 0,5 = a cada dois anos (ex.: reciclagem de NR-10 e NR-35); 0,3 = rotatividade de 30% para ASO admissional e demissional. Custo mensal = quantidade × valor ÷ 12.</Nota>
      </Card>
      <Card title="Custo mensal por cargo" actions={<Link to="/precificacao/equipe" className="text-xs text-brand-700 hover:underline dark:text-brand-300">equipe e custo-hora</Link>}>
        {!cargos.length ? (
          <p className="text-sm text-slate-500">Nenhum cargo cadastrado. Os itens marcados para “todos os cargos” valem para qualquer cargo novo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-right text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-2 py-2 text-left">Cargo</th>
                  {CATEGORIAS_PESSOAL.map((c) => <th key={c.value} className="px-2 py-2">{c.label}</th>)}
                  <th className="px-2 py-2">Total/mês</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => {
                  const k = custoPessoalCargo(c.id, comp);
                  const manual = modoInsumos(c) === 'manual';
                  return (
                    <tr key={c.id} className="border-t border-slate-100 text-right tabular-nums dark:border-slate-800">
                      <td className="px-2 py-1.5 text-left">
                        {c.nome}
                        {manual && <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">usa valores manuais</Badge>}
                      </td>
                      {CATEGORIAS_PESSOAL.map((x) => <td key={x.value} className="px-2 py-1.5">{money(k.porCategoria[x.value])}</td>)}
                      <td className="px-2 py-1.5 font-semibold">{money(k.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={!!item} onClose={() => setEditando(null)} size="sm" title="Cargos que recebem este item" footer={<Button onClick={() => setEditando(null)}>Concluir</Button>}>
        {item && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{item.descricao || 'Item sem descrição'}</p>
            <p className="text-xs text-slate-500">Nenhum marcado = todos os cargos.</p>
            {cargos.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!item.cargos?.includes(c.id)}
                  onChange={(e) => setItem({ cargos: e.target.checked ? [...(item.cargos || []), c.id] : (item.cargos || []).filter((x) => x !== c.id) })}
                />
                {c.nome}
              </label>
            ))}
            {!cargos.length && <p className="text-slate-500">Cadastre os cargos em Equipe e custo-hora.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function AbaVeiculo({ v, onChange, horas }: { v: VeiculoComposicao; onChange: (v: VeiculoComposicao) => void; horas: number }) {
  const set = (patch: Partial<VeiculoComposicao>) => onChange({ ...v, ...patch });
  const c = custoVeiculo(v);
  const n = (k: keyof VeiculoComposicao, label: string, extra: { prefix?: string; suffix?: string; help?: string } = {}) => (
    <Num label={label} value={v[k] as number} onChange={(x) => set({ [k]: x ?? 0 } as Partial<VeiculoComposicao>)} prefix={extra.prefix} suffix={extra.suffix} help={extra.help} />
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Dados do veículo de atendimento">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Veículo" className="sm:col-span-2 lg:col-span-3">
            <Input value={v.descricao} onChange={(e) => set({ descricao: e.target.value })} />
          </Field>
          {n('valorAquisicao', 'Valor de aquisição', { prefix: 'R$' })}
          {n('vidaUtilAnos', 'Vida útil', { suffix: 'anos' })}
          {n('residualPct', 'Valor residual', { suffix: '%', help: 'Revenda ao fim da vida útil' })}
          {n('ipvaAnual', 'IPVA, licenciamento e taxas', { prefix: 'R$', suffix: '/ano' })}
          {n('seguroAnual', 'Seguro', { prefix: 'R$', suffix: '/ano' })}
          {n('outrosMensal', 'Rastreador, estacionamento e outros', { prefix: 'R$', suffix: '/mês' })}
          {n('capitalPctAno', 'Remuneração do capital', { suffix: '% a.a.', help: 'Opcional: custo de oportunidade do dinheiro investido' })}
          {n('precoCombustivel', 'Preço do combustível', { prefix: 'R$', suffix: '/L' })}
          {n('consumoKmL', 'Consumo médio', { suffix: 'km/L' })}
          {n('manutencaoKm', 'Manutenção, óleo e lavagem', { prefix: 'R$', suffix: '/km' })}
          {n('pneusKm', 'Pneus', { prefix: 'R$', suffix: '/km', help: 'Jogo de pneus ÷ km de vida útil' })}
        </div>
      </Card>
      <Card title="Custo do veículo">
        <LinhaResumo rotulo="Depreciação" valor={money(c.depreciacao)} dica="(valor − residual) ÷ meses de vida útil" />
        <LinhaResumo rotulo="Remuneração do capital" valor={money(c.capital)} dica="capital médio × taxa ÷ 12" />
        <LinhaResumo rotulo="IPVA, licenciamento e seguro" valor={money(c.impostosSeguro)} />
        <LinhaResumo rotulo="Outros custos fixos" valor={money(c.outros)} />
        <LinhaResumo rotulo="Custo fixo mensal" valor={money(c.fixoMensal)} forte />
        <LinhaResumo rotulo={`Por hora produtiva (÷ ${num(horas, 1)} h)`} valor={`${money(horas > 0 ? c.fixoMensal / horas : 0)}/h`} forte />
        <div className="mt-3" />
        <LinhaResumo rotulo="Combustível" valor={`${money(c.combustivelKm)}/km`} dica="preço ÷ consumo" />
        <LinhaResumo rotulo="Manutenção e pneus" valor={`${money((v.manutencaoKm || 0) + (v.pneusKm || 0))}/km`} />
        <LinhaResumo rotulo="Custo variável" valor={`${money(c.variavelKm)}/km`} forte />
        <Nota>O custo fixo é alocado pelas horas de serviço de cada contrato; o variável entra no deslocamento (km rodados). Novos estudos já usam este custo por km.</Nota>
      </Card>
    </div>
  );
}

