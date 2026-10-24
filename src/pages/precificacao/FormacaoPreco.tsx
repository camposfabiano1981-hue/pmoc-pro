import type { ReactNode } from 'react';
import { Landmark, Store } from 'lucide-react';
import type { BdiMateriais, BdiParams, MarkupParams, MetodoPreco, ParametrosPreco, ReferenciaTcu } from '../../db/types';
import { Button, Card, Field, Select, Toggle, cx } from '../../components/ui';
import { FarolBadge, LinhaResumo, Num, num, pct } from '../../components/precoUi';
import { money } from '../../lib/format';
import { REFERENCIAS_BDI, calcBdi, calcMarkup, componentesDoQuartil, despesasFixas, faixaQ, farol, round2, type Quartis, type ReferenciaBdi } from '../../lib/precificacao';

export interface ValoresFormacao {
  metodo: MetodoPreco;
  referenciaTcu: ReferenciaTcu;
  bdi: BdiParams;
  markup: MarkupParams;
  bdiMateriais: BdiMateriais;
}

const QUARTIS: { k: 0 | 1 | 2; label: string }[] = [
  { k: 0, label: '1º quartil' },
  { k: 1, label: 'Médio' },
  { k: 2, label: '3º quartil' },
];

/**
 * Formação do preço: BDI pela fórmula do TCU (licitações) ou markup divisor (mercado privado/MEI),
 * com BDI diferenciado para materiais. Usado nos parâmetros padrão e em cada estudo.
 */
export function FormacaoPrecoEditor({ v, onChange, params, tributos }: { v: ValoresFormacao; onChange: (patch: Partial<ValoresFormacao>) => void; params: ParametrosPreco; tributos: number }) {
  const ref = REFERENCIAS_BDI[v.referenciaTcu];
  const refMat = REFERENCIAS_BDI.materiais;
  const b = v.bdi;
  const setB = (patch: Partial<BdiParams>) => onChange({ bdi: { ...b, ...patch } });
  const m = v.markup;
  const setM = (patch: Partial<MarkupParams>) => onChange({ markup: { ...m, ...patch } });
  const bm = v.bdiMateriais;
  const setBm = (patch: Partial<BdiMateriais>) => onChange({ bdiMateriais: { ...bm, ...patch } });

  const tcu = calcBdi(b, tributos);
  const tcuSemLucro = calcBdi({ ...b, l: 0 }, tributos).bdi;
  const desp = despesasFixas(params);
  const dfMarkup = m.despesasFixasPct ?? desp.pct;
  const mk = calcMarkup(m, tributos, dfMarkup);
  const mk0 = calcMarkup(m, tributos, dfMarkup, 0);
  const bdiMatTcu = calcBdi({ ac: bm.ac, s: bm.s, r: bm.r, g: bm.g, l: bm.l, prazoDias: b.prazoDias, taxaMes: b.taxaMes }, tributos).bdi;
  const mkMat = calcMarkup(m, tributos, 0, bm.lucroMarkup);
  const acSugerida = round2(desp.pct * (1 + tcu.bdi / 100));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Metodo ativo={v.metodo === 'tcu'} onClick={() => onChange({ metodo: 'tcu' })} icone={<Landmark size={18} />} titulo="BDI — fórmula do TCU" texto="Licitações de obras e serviços de engenharia (Acórdão 2622/2013): taxas sobre o custo direto e tributos por dentro." />
        <Metodo ativo={v.metodo === 'markup'} onClick={() => onChange({ metodo: 'markup' })} icone={<Store size={18} />} titulo="Markup divisor — mercado privado" texto="Empresas, condomínios e clientes particulares; recomendado para o MEI. Despesas, tributos e lucro em % do preço de venda (método do Sebrae)." />
      </div>

      {v.metodo === 'tcu' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Componentes do BDI">
            <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-center font-mono text-xs dark:bg-slate-800/60">BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) ÷ (1 − I)] − 1</p>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <Field label="Referência do TCU" className="min-w-[240px] flex-1">
                <Select value={v.referenciaTcu} onChange={(e) => onChange({ referenciaTcu: e.target.value as ReferenciaTcu })}>
                  <option value="edificacoes">{REFERENCIAS_BDI.edificacoes.label}</option>
                  <option value="energia">{REFERENCIAS_BDI.energia.label}</option>
                </Select>
              </Field>
              {QUARTIS.map((q) => (
                <Button key={q.k} size="sm" variant="outline" onClick={() => setB(componentesDoQuartil(ref, q.k))} title={`Aplica AC, S + G, R e L do ${q.label.toLowerCase()}`}>
                  {q.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Componente label="AC — Administração central" valor={b.ac} onChange={(x) => setB({ ac: x })} q={ref.ac} />
              <Componente label="L — Lucro" valor={b.l} onChange={(x) => setB({ l: x })} q={ref.l} />
              <Num label="S — Seguros" suffix="%" value={b.s} onChange={(x) => setB({ s: x ?? 0 })} />
              <Componente label="G — Garantias" valor={b.g} onChange={(x) => setB({ g: x })} q={ref.sg} soma={b.s + b.g} rotuloFaixa="S + G" />
              <Componente label="R — Riscos" valor={b.r} onChange={(x) => setB({ r: x })} q={ref.r} />
              <div className="grid grid-cols-2 gap-2">
                <Num label="Prazo de recebimento" suffix="dias" value={b.prazoDias} onChange={(x) => setB({ prazoDias: x ?? 0 })} />
                <Num label="Taxa financeira" suffix="% a.m." value={b.taxaMes} onChange={(x) => setB({ taxaMes: x ?? 0 })} />
                <p className="col-span-2 text-xs">DF = (1 + taxa)^(prazo ÷ 30) − 1 = <b>{pct(tcu.df, 3)}</b> <FarolBadge f={farol(tcu.df, faixaQ(ref.df))} faixa={faixaQ(ref.df)} /></p>
              </div>
            </div>
            {desp.total > 0 && (
              <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                Pelas despesas administrativas da composição ({money(desp.total)}/mês = {pct(desp.pct, 1)} do faturamento), o AC equivalente sobre o custo direto é <b>{pct(acSugerida)}</b>.{' '}
                <button type="button" className="font-semibold text-brand-700 underline dark:text-brand-300" onClick={() => setB({ ac: acSugerida })}>Usar</button>
              </p>
            )}
          </Card>
          <Card title="Resultado e referências">
            <Resultado rotulo={`BDI com tributos (I) de ${pct(tributos)}`} valor={pct(tcu.bdi)} />
            <LinhaResumo rotulo="Multiplicador sobre o custo direto" valor={num(1 + tcu.bdi / 100, 4)} />
            <LinhaResumo rotulo="BDI sem lucro (base do lance mínimo)" valor={pct(tcuSemLucro)} />
            <LinhaResumo rotulo={<>Faixa do TCU — {ref.label.toLowerCase()}</>} valor={`${pct(ref.total[0])} a ${pct(ref.total[2])}`} dica={`médio ${pct(ref.total[1])}`} />
            <div className="mt-2"><FarolBadge f={farol(tcu.bdi, faixaQ(ref.total))} faixa={faixaQ(ref.total)} /></div>
            {tcu.bdi > ref.total[2] && tributos > 9 && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Os tributos (I = {pct(tributos)}) pesam mais que os considerados nas faixas do acórdão (ISS, PIS, Cofins e CPRB, em torno de 8% a 9%), o que eleva o BDI total mesmo com os componentes na faixa. Na diligência, demonstre a composição de cada parcela e a carga do regime.
              </p>
            )}
            <TabelaQuartis ref_={ref} />
            <p className="mt-2 text-xs text-slate-500">
              As faixas do Acórdão 2622/2013 são referência, não teto: um BDI fora delas precisa ser justificado com a composição analítica. IRPJ e CSLL não entram no BDI (Súmula TCU 254). As faixas foram levantadas para obras; para serviços de manutenção predial use edificações como parâmetro.
            </p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Percentuais sobre o preço de venda">
            <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-center font-mono text-xs dark:bg-slate-800/60">Preço = custo direto ÷ [1 − (I + DF + DV + L)]</p>
            <div className="grid grid-cols-2 gap-3">
              <Num
                label="DF — Despesas fixas"
                suffix="%"
                value={m.despesasFixasPct}
                placeholder={num(desp.pct)}
                onChange={(x) => setM({ despesasFixasPct: x })}
                className="col-span-2"
                help={
                  <>
                    {m.despesasFixasPct === undefined ? 'Calculado' : 'Informado'} — composição: {money(desp.total)}/mês ÷ faturamento de {money(params.faturamentoMensal)} = {pct(desp.pct)}.{' '}
                    {m.despesasFixasPct !== undefined && <button type="button" className="font-semibold text-brand-700 underline dark:text-brand-300" onClick={() => setM({ despesasFixasPct: undefined })}>usar o calculado</button>}
                  </>
                }
              />
              <Num label="Comissão de vendas" suffix="%" value={m.comissaoPct} onChange={(x) => setM({ comissaoPct: x ?? 0 })} />
              <Num label="Cartão, boleto e antecipação" suffix="%" value={m.cartaoPct} onChange={(x) => setM({ cartaoPct: x ?? 0 })} />
              <Num label="Inadimplência" suffix="%" value={m.inadimplenciaPct} onChange={(x) => setM({ inadimplenciaPct: x ?? 0 })} />
              <Num label="L — Lucro desejado" suffix="%" value={m.lucroPct} onChange={(x) => setM({ lucroPct: x ?? 0 })} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              O faturamento médio e as despesas fixas ficam em Composição de custos › Despesas administrativas{params.regime === 'mei' ? ' (o DAS-MEI já está somado)' : ''}. Os tributos (I) vêm do regime: {pct(tributos)}.
            </p>
          </Card>
          <Card title="Resultado">
            <Resultado rotulo="Markup multiplicador" valor={num(mk.multiplicador, 4)} />
            <LinhaResumo rotulo="Tributos (I)" valor={pct(mk.tributos)} />
            <LinhaResumo rotulo="Despesas fixas (DF)" valor={pct(mk.despesasFixas)} />
            <LinhaResumo rotulo="Despesas variáveis (DV)" valor={pct(mk.variaveis)} dica="comissão + cartão/boleto + inadimplência" />
            <LinhaResumo rotulo="Lucro (L)" valor={pct(mk.lucro)} />
            <LinhaResumo rotulo="Soma" valor={pct(mk.soma)} forte />
            <LinhaResumo rotulo="Divisor = 1 − soma" valor={num(mk.divisor, 4)} />
            <LinhaResumo rotulo="BDI equivalente sobre o custo" valor={pct(mk.bdi)} forte />
            <LinhaResumo rotulo="Sem lucro (preço mínimo)" valor={pct(mk0.bdi)} />
            {!mk.valido && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">A soma chegou a 95% do preço: reduza despesas ou lucro.</p>}
            <p className="mt-2 text-xs text-slate-500">
              Exemplo: custo direto de R$ 100,00 → preço de {money(100 * mk.multiplicador)}. Para comparar com licitações, o mesmo custo pelo BDI do TCU daria {money(100 * (1 + tcu.bdi / 100))} (BDI {pct(tcu.bdi)}).
            </p>
          </Card>
        </div>
      )}

      <Card title="BDI diferenciado para materiais e peças">
        <Toggle checked={bm.ativo} onChange={(x) => setBm({ ativo: x })} label="Aplicar taxa reduzida sobre os materiais de consumo dos itens" />
        <p className="mt-1 text-xs text-slate-500">
          {v.metodo === 'tcu'
            ? 'Súmula TCU 253: materiais e equipamentos com BDI reduzido em relação ao dos serviços. Componentes de referência do Acórdão 2622/2013 para fornecimento de materiais (BDI de 11,10% a 16,80%, médio 14,02%).'
            : 'Materiais com margem própria: tributos e despesas variáveis incidem, mas não o rateio das despesas fixas.'}
        </p>
        {bm.ativo &&
          (v.metodo === 'tcu' ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUARTIS.map((q) => (
                  <Button key={q.k} size="sm" variant="outline" onClick={() => setBm(componentesDoQuartil(refMat, q.k))}>{q.label}</Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Componente label="AC" valor={bm.ac} onChange={(x) => setBm({ ac: x })} q={refMat.ac} />
                <Num label="S" suffix="%" value={bm.s} onChange={(x) => setBm({ s: x ?? 0 })} />
                <Componente label="G" valor={bm.g} onChange={(x) => setBm({ g: x })} q={refMat.sg} soma={bm.s + bm.g} rotuloFaixa="S + G" />
                <Componente label="R" valor={bm.r} onChange={(x) => setBm({ r: x })} q={refMat.r} />
                <Componente label="L" valor={bm.l} onChange={(x) => setBm({ l: x })} q={refMat.l} />
              </div>
              <p className="text-sm">
                BDI dos materiais: <b>{pct(bdiMatTcu)}</b>{' '}
                <span className="text-xs text-slate-500">
                  (mesma despesa financeira e tributos dos serviços, I = {pct(tributos)}). A faixa do TCU de 11,10% a 16,80% foi calculada para fornecimento sem ISS; como os materiais de consumo integram o serviço, os tributos do serviço incidem sobre eles e o BDI fica maior.
                </span>
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Num label="Margem sobre materiais" suffix="%" value={bm.lucroMarkup} onChange={(x) => setBm({ lucroMarkup: x ?? 0 })} className="w-48" />
              <p className="pb-2 text-sm">Multiplicador dos materiais: <b>{num(mkMat.multiplicador, 4)}</b> (BDI equivalente {pct(mkMat.bdi)})</p>
            </div>
          ))}
      </Card>
    </div>
  );
}

function Metodo({ ativo, onClick, icone, titulo, texto }: { ativo: boolean; onClick: () => void; icone: ReactNode; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cx(
        'rounded-xl border p-3 text-left transition-colors',
        ativo ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-950/40' : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900',
      )}
    >
      <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">{icone}{titulo}</span>
      <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{texto}</span>
    </button>
  );
}

function Componente({ label, valor, onChange, q, soma, rotuloFaixa }: { label: string; valor: number; onChange: (v: number) => void; q: Quartis; soma?: number; rotuloFaixa?: string }) {
  const f = faixaQ(q);
  return (
    <div>
      <Num label={label} suffix="%" value={valor} onChange={(x) => onChange(x ?? 0)} />
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        {rotuloFaixa && <span>{rotuloFaixa} = {pct(soma)}</span>}
        <FarolBadge f={farol(soma ?? valor, f)} faixa={f} />
      </div>
    </div>
  );
}

function Resultado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-950/50">
      <span className="text-sm">{rotulo}</span>
      <span className="text-2xl font-bold text-brand-800 dark:text-brand-200">{valor}</span>
    </div>
  );
}

function TabelaQuartis({ ref_ }: { ref_: ReferenciaBdi }) {
  const linhas: [string, Quartis][] = [
    ['Administração central', ref_.ac],
    ['Seguro + garantia', ref_.sg],
    ['Risco', ref_.r],
    ['Despesa financeira', ref_.df],
    ['Lucro', ref_.l],
    ['BDI', ref_.total],
  ];
  return (
    <table className="mt-3 w-full text-xs">
      <thead className="text-right text-slate-500">
        <tr><th className="py-1 text-left font-medium">Acórdão 2622/2013</th><th className="font-medium">1º quartil</th><th className="font-medium">Médio</th><th className="font-medium">3º quartil</th></tr>
      </thead>
      <tbody>
        {linhas.map(([n, q]) => (
          <tr key={n} className={cx('border-t border-slate-100 text-right tabular-nums dark:border-slate-800', n === 'BDI' && 'font-semibold')}>
            <td className="py-1 text-left">{n}</td>
            <td>{pct(q[0])}</td>
            <td>{pct(q[1])}</td>
            <td>{pct(q[2])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
