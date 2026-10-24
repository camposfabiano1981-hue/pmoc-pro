import { Percent, RotateCcw } from 'lucide-react';
import { Button, Card, PageHeader, Select, Toggle, cx, useConfirm } from '../../components/ui';
import { Num, num, pct, useParametrosEditaveis } from '../../components/precoUi';
import { money } from '../../lib/format';
import { MEI_LIMITE, REGIMES, dasMei, encargoVinculo, encargosGrupoA, fatorReoneracao, horasMes, inssAutonomoPadrao, tributosFaturamento } from '../../lib/precificacao';
import type { RegimeTributario } from '../../db/types';
import { FormacaoPrecoEditor } from './FormacaoPreco';

/** Parâmetros de precificação: regime tributário, encargos, provisões, horas produtivas e formação do preço padrão. */
export default function TributosPage() {
  const [p, upd, restaurar, salvo] = useParametrosEditaveis();
  const confirm = useConfirm();
  if (!p) return <p className="text-sm text-slate-500">Carregando…</p>;
  const trib = tributosFaturamento(p);
  const ga = encargosGrupoA(p);
  const h = horasMes(p);
  const reon = fatorReoneracao(p.anoBase);
  const s = trib.simples;
  const socio = encargoVinculo('socio', p);
  const linha = 'flex items-center justify-between gap-3 border-b border-slate-100 py-1 text-sm last:border-0 dark:border-slate-800';

  return (
    <div>
      <PageHeader
        title="Tributos, encargos e formação do preço"
        subtitle="Regime tributário, encargos, provisões, horas produtivas e o BDI/markup padrão dos novos estudos"
        icon={<Percent size={20} />}
        actions={
          <>
            <span className="text-xs text-slate-500">{salvo ? 'Salvo' : 'Salvando…'}</span>
            <Button
              variant="outline"
              icon={<RotateCcw size={16} />}
              onClick={async () => {
                if (await confirm({ title: 'Restaurar padrões', message: 'Voltar regime, encargos, provisões, horas e formação do preço aos valores iniciais? As tabelas da composição de custos e o faturamento médio são mantidos.', confirmText: 'Restaurar' })) restaurar();
              }}
            >
              Restaurar padrões
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Regime tributário da empresa">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Regime</span>
              <Select value={p.regime} onChange={(e) => upd({ regime: e.target.value as RegimeTributario })}>
                {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </label>
            {p.regime === 'mei' && (
              <>
                <Num label="DAS mensal" prefix="R$" value={p.meiDas} placeholder={num(dasMei({ ...p, meiDas: undefined }))} onChange={(v) => upd({ meiDas: v })} help={`5% do salário mínimo (${money(p.salarioMinimo * 0.05)}) + R$ 5,00 de ISS. Vazio = calculado.`} />
                <Num label="Limite anual de faturamento" prefix="R$" value={p.meiLimite} onChange={(v) => upd({ meiLimite: v ?? MEI_LIMITE })} help="R$ 81.000,00 (LC 123, art. 18-A, §1º)" />
                <Num label="Faturamento mensal médio" prefix="R$" value={p.faturamentoMensal} onChange={(v) => upd({ faturamentoMensal: v ?? 0 })} className="sm:col-span-2" />
                <BarraLimite anual={p.faturamentoMensal * 12} limite={p.meiLimite || MEI_LIMITE} />
                <ul className="list-disc space-y-1 rounded-lg bg-sky-50 py-2.5 pl-7 pr-3 text-xs text-sky-950 sm:col-span-2 dark:bg-sky-950/40 dark:text-sky-100">
                  <li>Ocupação permitida: instalador(a) e reparador(a) de sistemas centrais de ar condicionado, ventilação e refrigeração (CNAE 4322-3/02).</li>
                  <li>Não há tributo proporcional ao preço: o DAS é fixo e entra nas despesas fixas. Por isso o <b>markup</b> é o método indicado.</li>
                  <li>Cadastre o titular como “sócio ou titular (pró-labore)”: o INSS dele já está no DAS.</li>
                  <li>Um único empregado (salário mínimo ou piso da categoria): 3% de INSS patronal + 8% de FGTS (LC 123, art. 18-C).</li>
                  <li>Faturou acima do limite: até 20% a mais, recolhe sobre o excesso e deixa o MEI no ano seguinte; acima de 20%, o desenquadramento retroage a janeiro.</li>
                  <li>O MEI não pode ceder mão de obra (posto residente). Em licitações, tem os benefícios de ME/EPP da LC 123 (arts. 42 a 49).</li>
                </ul>
              </>
            )}
            {p.regime === 'simples' && (
              <>
                <Num label="Receita bruta dos últimos 12 meses (RBT12)" prefix="R$" value={p.rbt12} onChange={(v) => upd({ rbt12: v ?? 0 })} className="sm:col-span-2" />
                {s && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2 dark:bg-slate-800/60">
                    <p>
                      <b>{s.faixa}ª faixa</b> · alíquota nominal {pct(s.nominal)} · parcela a deduzir {money(s.deducao)} → <b>alíquota efetiva {pct(s.efetiva)}</b>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">(RBT12 × alíquota − parcela a deduzir) ÷ RBT12 — LC 123/2006, art. 18, §1º-A. Repartição do DAS:</p>
                    <div className="mt-1 grid grid-cols-3 gap-x-3 text-xs sm:grid-cols-6">
                      {(['irpj', 'csll', 'cofins', 'pis', 'cpp', 'iss'] as const).map((k) => (
                        <span key={k}><b className="uppercase">{k}</b> {pct(s.tributos[k], 3)}</span>
                      ))}
                    </div>
                    {s.acimaDoLimite && <p className="mt-2 text-xs font-semibold text-rose-700">Receita acima de R$ 4,8 milhões: a empresa é excluída do Simples Nacional.</p>}
                  </div>
                )}
                {s?.faixa === 6 && <Num label="ISS do município (fora do DAS na 6ª faixa)" suffix="%" value={p.issAliquota} onChange={(v) => upd({ issAliquota: v ?? 0 })} />}
                <div className="sm:col-span-2">
                  <Toggle checked={p.simplesExcluirIrpjCsll} onChange={(v) => upd({ simplesExcluirIrpjCsll: v })} label="Excluir as parcelas de IRPJ e CSLL da taxa de tributos do BDI" />
                  <p className="mt-1 text-xs text-slate-500">Alguns órgãos aplicam ao Simples a lógica da Súmula TCU 254 (IRPJ/CSLL fora do BDI). Siga o que o edital pedir.</p>
                </div>
                <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 sm:col-span-2 dark:bg-amber-950/40 dark:text-amber-200">
                  Manutenção é tributada no Anexo III (LC 123, art. 18, §5º-B, IX), com a previdência patronal (CPP) dentro do DAS. <b>Cessão de mão de obra (técnico residente/posto) é vedada ao Simples</b> (art. 17, XII).
                </p>
              </>
            )}
            {(p.regime === 'presumido' || p.regime === 'real') && (
              <>
                {p.regime === 'presumido' ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2 dark:bg-slate-800/60">PIS 0,65% + Cofins 3,00% (regime cumulativo).</div>
                ) : (
                  <Num label="PIS + Cofins efetivos (após créditos)" suffix="%" value={p.pisCofinsReal} onChange={(v) => upd({ pisCofinsReal: v ?? 0 })} help="Nominal 9,25%; informe a alíquota efetiva da empresa" />
                )}
                <Num label="ISS do município de execução" suffix="%" value={p.issAliquota} onChange={(v) => upd({ issAliquota: v ?? 0 })} help="2% a 5%, conforme o município" />
                <div className="sm:col-span-2">
                  <Toggle checked={p.desonerada} onChange={(v) => upd({ desonerada: v })} label="Empresa na desoneração da folha (CPRB)" />
                </div>
                {p.desonerada && (
                  <>
                    <Num label="Alíquota da CPRB" suffix="%" value={p.cprbAliquota} onChange={(v) => upd({ cprbAliquota: v ?? 0 })} help="Ex.: 4,5% (construção civil)" />
                    <Num label="Ano de referência" value={p.anoBase} onChange={(v) => upd({ anoBase: v ?? new Date().getFullYear() })} />
                    <p className="text-xs text-slate-500 sm:col-span-2">
                      Reoneração gradual (Lei 14.973/2024): em {p.anoBase}, {Math.round(reon.receita * 100)}% da CPRB sobre a receita e {num(20 * reon.folha, 0)}% de INSS sobre a folha. Em 2028 volta a contribuição integral de 20% sobre a folha.
                    </p>
                  </>
                )}
              </>
            )}
            {p.regime !== 'mei' && (
              <Num label="Tributos “por fora” do preço (cenário da reforma)" suffix="%" value={p.tributosPorFora} onChange={(v) => upd({ tributosPorFora: v ?? 0 })} className="sm:col-span-2" help="Em 2026 a CBS (0,9%) e o IBS (0,1%) estão em teste e são compensáveis com PIS/Cofins, sem alterar o preço. Use para simular 2027 em diante." />
            )}
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Taxa de tributos sobre o faturamento (I)</p>
            {trib.itens.map((t) => (
              <div key={t.nome} className={cx(linha, t.excluido && 'text-slate-400 line-through')}>
                <span>{t.nome}{t.obs && <span className="block text-xs text-slate-500">{t.obs}</span>}</span>
                <span className="tabular-nums">{pct(t.aliquota, 3)}</span>
              </div>
            ))}
            <div className={cx(linha, 'font-bold')}>
              <span>Total (I)</span>
              <span className="tabular-nums">{pct(trib.total, 3)}</span>
            </div>
            {trib.porFora > 0 && <p className="mt-1 text-xs text-slate-500">+ {pct(trib.porFora)} calculados por fora do preço.</p>}
          </div>
        </Card>

        <Card title="Encargos sobre a remuneração">
          {p.regime === 'mei' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="FGTS do empregado" suffix="%" value={p.fgts} onChange={(v) => upd({ fgts: v ?? 0 })} />
              <p className="text-xs text-slate-500 sm:pt-6">MEI com empregado: 3% de INSS patronal (CPP), sem RAT e sem terceiros.</p>
            </div>
          ) : p.regime === 'simples' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="FGTS" suffix="%" value={p.fgts} onChange={(v) => upd({ fgts: v ?? 0 })} />
              <p className="text-xs text-slate-500 sm:pt-6">INSS patronal, RAT e terceiros estão dentro do DAS no Anexo III.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <Num label="RAT/SAT" suffix="%" value={p.rat} onChange={(v) => upd({ rat: v ?? 0 })} help="1%, 2% ou 3% pelo CNAE" />
              <Num label="FAP" value={p.fap} onChange={(v) => upd({ fap: v ?? 1 })} help="0,5 a 2,0" />
              <Num label="Terceiros" suffix="%" value={p.terceiros} onChange={(v) => upd({ terceiros: v ?? 0 })} help="Sal.-educação, Sistema S, Sebrae, Incra" />
              <Num label="FGTS" suffix="%" value={p.fgts} onChange={(v) => upd({ fgts: v ?? 0 })} />
            </div>
          )}
          <p className="mb-1 mt-3 text-xs font-semibold uppercase text-slate-500">Empregados CLT — Grupo A</p>
          {ga.itens.map((t) => (
            <div key={t.nome} className={linha}>
              <span>{t.nome}{t.obs && <span className="text-xs text-slate-500"> — {t.obs}</span>}</span>
              <span className="tabular-nums">{pct(t.aliquota)}</span>
            </div>
          ))}
          <div className={cx(linha, 'font-bold')}>
            <span>Total do Grupo A</span>
            <span className="tabular-nums">{pct(ga.total)}</span>
          </div>
          <p className="mb-1 mt-4 text-xs font-semibold uppercase text-slate-500">Sócios e autônomos</p>
          <div className={linha}>
            <span>Pró-labore<span className="block text-xs text-slate-500">{socio.nome}</span></span>
            <span className="tabular-nums">{pct(socio.aliquota)}</span>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Num label="INSS patronal sobre autônomos (RPA)" suffix="%" value={p.inssAutonomo} placeholder={num(inssAutonomoPadrao(p))} onChange={(v) => upd({ inssAutonomo: v })} help={`Vazio = padrão do regime (${pct(inssAutonomoPadrao(p))}). No Simples e no MEI a contribuição patronal já está no DAS; confirme com o contador.`} />
          </div>
        </Card>
      </div>

      <h2 className="mb-1 mt-8 text-base font-semibold text-slate-900 dark:text-white">Formação do preço — padrão dos novos estudos</h2>
      <p className="mb-3 text-sm text-slate-500">Cada estudo copia estes valores e pode mudar o método ou os percentuais na aba “5. BDI e tributos”.</p>
      <FormacaoPrecoEditor v={{ metodo: p.metodo, referenciaTcu: p.referenciaTcu, bdi: p.bdi, markup: p.markup, bdiMateriais: p.bdiMateriais }} onChange={(patch) => upd(patch)} params={p} tributos={trib.total} />

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <Card title="Provisões trabalhistas (% sobre a remuneração)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Num label="13º salário" suffix="%" value={p.decimoTerceiro} onChange={(v) => upd({ decimoTerceiro: v ?? 0 })} />
            <Num label="Férias + 1/3" suffix="%" value={p.feriasTerco} onChange={(v) => upd({ feriasTerco: v ?? 0 })} help="Usual: 9,075% + 3,025%" />
            <Num label="Aviso prévio indenizado" suffix="%" value={p.avisoIndenizado} onChange={(v) => upd({ avisoIndenizado: v ?? 0 })} help="≈ 5% de dispensas × 1/12" />
            <Num label="FGTS s/ aviso indenizado" suffix="%" value={p.fgtsAvisoIndenizado} onChange={(v) => upd({ fgtsAvisoIndenizado: v ?? 0 })} />
            <Num label="Aviso prévio trabalhado" suffix="%" value={p.avisoTrabalhado} onChange={(v) => upd({ avisoTrabalhado: v ?? 0 })} help="7/30 × 1/12 (+ Grupo A)" />
            <Num label="Multa do FGTS (40%)" suffix="%" value={p.multaFgts} onChange={(v) => upd({ multaFgts: v ?? 0 })} help="40% × 8%; reduza se a equipe é estável" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Estrutura da planilha da IN SEGES 5/2017 (submódulo 2.1 e módulo 3), aplicável à Lei 14.133 pela IN SEGES/ME 98/2022. Ajuste conforme o edital.</p>
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Num label="Salário mínimo (base da insalubridade e do DAS-MEI)" prefix="R$" value={p.salarioMinimo} onChange={(v) => upd({ salarioMinimo: v ?? 0 })} help="R$ 1.621,00 em 2026 (Decreto 12.797/2025)" className="max-w-sm" />
          </div>
        </Card>

        <Card title="Horas produtivas da equipe">
          <div className="grid gap-3 sm:grid-cols-3">
            <Num label="Jornada semanal" suffix="h" value={p.jornadaSemanal} onChange={(v) => upd({ jornadaSemanal: v ?? 44 })} />
            <Num label="Feriados por ano" suffix="dias" value={p.feriadosAno} onChange={(v) => upd({ feriadosAno: v ?? 0 })} />
            <Num label="Férias (dias úteis)" suffix="dias" value={p.feriasDiasUteis} onChange={(v) => upd({ feriasDiasUteis: v ?? 0 })} />
            <Num label="Ausências legais/atestados" suffix="dias" value={p.ausenciasDias} onChange={(v) => upd({ ausenciasDias: v ?? 0 })} />
            <Num label="Produtividade" suffix="%" value={p.produtividade} onChange={(v) => upd({ produtividade: v ?? 100 })} help="Tempo útil na execução" />
            <div className="rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-950/50">
              <p className="text-xs text-slate-500">Horas produtivas/mês</p>
              <p className="text-xl font-bold">{num(h.produtivas, 1)} h</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {h.diasAno} dias trabalhados por ano × {num(p.jornadaSemanal / 5, 1)} h ÷ 12 = {num(h.disponiveis, 1)} h disponíveis/mês × {p.produtividade}% de produtividade. As férias e ausências já são pagas pelas provisões; por isso saem das horas e o custo-hora fica correto. O deslocamento entre clientes é custeado à parte no estudo.
          </p>
        </Card>
      </div>
    </div>
  );
}

function BarraLimite({ anual, limite }: { anual: number; limite: number }) {
  const uso = limite > 0 ? (anual / limite) * 100 : 0;
  const cor = uso > 100 ? 'bg-rose-500' : uso > 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="sm:col-span-2">
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
        <span>Faturamento anual previsto: <b>{money(anual)}</b></span>
        <span>{pct(uso, 0)} do limite</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={cx('h-full rounded-full', cor)} style={{ width: `${Math.min(100, uso)}%` }} />
      </div>
    </div>
  );
}
