import type { CargoPreco, EstudoPreco, ParametrosPreco } from '../../db/types';
import { exportXlsx, type Cell } from '../../lib/excel';
import type { Lookups } from '../../lib/lookups';
import { valorPorExtenso } from '../../lib/extenso';
import {
  CATEGORIAS_PESSOAL,
  REGIMES,
  custoCargo,
  custoFerramentas,
  custoVeiculo,
  custosHora,
  ferramentaMensal,
  insumoMensal,
  pessoalMensal,
  round2,
  vinculoDe,
  type ResultadoEstudo,
} from '../../lib/precificacao';

const r2 = (n: number | undefined) => round2(n || 0);
const r4 = (n: number | undefined) => Math.round((n || 0) * 10000) / 10000;

/** Planilha de composição de preços em Excel (uma aba por quadro), para anexar à proposta ou ajustar ao modelo do edital. */
export async function exportarPlanilhaEstudo(e: EstudoPreco, r: ResultadoEstudo, p: ParametrosPreco, cargos: Map<string, CargoPreco>, l: Lookups): Promise<void> {
  const comp = p.composicao;
  const cliente = l.clienteMap.get(e.clienteId || '')?.nome || e.orgao || '';
  const metodo = r.formacao.metodo === 'markup' ? 'Markup divisor (mercado privado)' : `BDI — Acórdão TCU 2622/2013 (${r.formacao.referencia.label})`;
  const regime = REGIMES.find((x) => x.value === p.regime)?.label || p.regime;
  const ch = custosHora(p);

  const resumo: Cell[][] = [
    ['Estudo', e.numero],
    ['Objeto', e.titulo],
    ['Contratante', cliente],
    ['Vigência (meses)', e.vigenciaMeses],
    ['Validade da proposta (dias)', e.validadeDias || 60],
    ['Regime tributário', regime],
    ['Formação do preço', metodo],
    ['Custo-hora da equipe (R$)', r2(r.custoHoraEquipe)],
    ['Custo-hora operacional (R$)', r2(r.custoHoraOperacional)],
    ['Horas técnicas por mês', r2(r.horasMes)],
    ['Equipamentos', r.quantidade],
    ['Custo direto mensal (R$)', r2(r.custoDiretoMensal)],
    [r.formacao.metodo === 'markup' ? 'BDI equivalente do markup (%)' : 'BDI (%)', r4(r.bdi)],
    ['Preço mensal (R$)', r2(r.precoMensal)],
    ['Preço anual (R$)', r2(r.precoAnual)],
    [`Total da vigência — ${e.vigenciaMeses} meses (R$)`, r2(r.precoVigencia)],
    ['Por extenso', valorPorExtenso(r.precoVigencia)],
  ];

  const maoDeObra: Cell[][] = e.equipe
    .filter((m) => m.quantidade > 0 && cargos.get(m.cargoId))
    .map((m) => {
      const c = cargos.get(m.cargoId)!;
      const k = custoCargo(c, p);
      return [c.nome, vinculoDe(c.vinculo).label, r2(k.remuneracao), r2(k.modulo21), r2(k.modulo22), r2(k.modulo23), r2(k.modulo3), r2(k.insumos), r2(k.total), r2(k.horasProdutivas), r2(k.custoHora), m.quantidade, r2(k.custoHora * m.quantidade)];
    });

  const itens: Cell[][] = r.itens.map((i, k) => [
    k + 1,
    i.item.descricao,
    l.planoMap.get(i.item.planoId || '')?.nome || 'horas informadas',
    r4(i.item.fatorTempo),
    r2(i.item.corretivaPct),
    i.item.quantidade,
    r2(i.horasUnit),
    r2(i.custoMO),
    r2(i.custoEquip),
    r2(i.materiais),
    r2(i.rateio),
    r2(i.custoDireto),
    r2(i.precoUnit - i.custoDireto),
    r2(i.precoUnit),
    r2(i.totalMensal),
  ]);
  itens.push(['', 'Total mensal', '', '', '', r.quantidade, r2(r.horasMes), r2(r.maoDeObraMensal), r2(r.equipamentosMensal), r2(r.materiaisMensal), r2(r.deslocamentoMensal + r.custosFixosMensal), r2(r.custoDiretoMensal), r2(r.precoMensal - r.custoDiretoMensal), '', r2(r.precoMensal)]);

  const d = e.deslocamento;
  const indiretos: Cell[][] = [
    [`Deslocamento — tempo (${d.visitasMes} visitas × ${d.minutosVisita} min)`, r2((d.visitasMes || 0) * ((d.minutosVisita || 0) / 60) * r.custoHoraEquipe)],
    [`Deslocamento — ${d.kmMes} km × R$ ${d.custoKm}`, r2((d.kmMes || 0) * (d.custoKm || 0))],
    ...e.custosFixos.filter((c) => c.valorMensal).map((c) => [c.descricao, r2(c.valorMensal)] as Cell[]),
    ['Total a ratear', r2(r.deslocamentoMensal + r.custosFixosMensal)],
    [`Ferramentas (${e.kits || 0} kit × R$ ${r2(ch.ferramentas)}/h) + veículo (${e.veiculos || 0} × R$ ${r2(ch.veiculo)}/h) pelas horas`, r2(r.equipamentosMensal)],
  ];

  const f = r.formacao;
  const formacao: Cell[][] =
    f.metodo === 'markup' && f.markup
      ? [
          ['Tributos (I)', r4(f.markup.tributos)],
          ['Despesas fixas (DF)', r4(f.markup.despesasFixas)],
          ['Despesas variáveis (comissão, cartão, inadimplência)', r4(f.markup.variaveis)],
          ['Lucro (L)', r4(f.markup.lucro)],
          ['Soma', r4(f.markup.soma)],
          ['Divisor', r4(f.markup.divisor)],
          ['Multiplicador', r4(f.markup.multiplicador)],
          ['BDI equivalente', r4(f.bdi)],
          ...(f.materiais.ativo ? [['BDI equivalente dos materiais', r4(f.materiais.bdi)] as Cell[]] : []),
        ]
      : [
          ['Administração central (AC)', r4(e.bdi.ac), f.referencia.ac[0], f.referencia.ac[1], f.referencia.ac[2]],
          ['Seguros + garantias (S + G)', r4(e.bdi.s + e.bdi.g), f.referencia.sg[0], f.referencia.sg[1], f.referencia.sg[2]],
          ['Riscos (R)', r4(e.bdi.r), f.referencia.r[0], f.referencia.r[1], f.referencia.r[2]],
          ['Despesas financeiras (DF)', r4(f.df), f.referencia.df[0], f.referencia.df[1], f.referencia.df[2]],
          ['Lucro (L)', r4(e.bdi.l), f.referencia.l[0], f.referencia.l[1], f.referencia.l[2]],
          ['Tributos (I)', r4(r.tributos.total)],
          ['BDI', r4(f.bdi), f.referencia.total[0], f.referencia.total[1], f.referencia.total[2]],
          ...(f.materiais.ativo ? [['BDI diferenciado dos materiais', r4(f.materiais.bdi), 11.1, 14.02, 16.8] as Cell[]] : []),
        ];

  const tributos: Cell[][] = [...r.tributos.itens.filter((t) => !t.excluido).map((t) => [t.nome, r4(t.aliquota)] as Cell[]), ['Total (I)', r4(r.tributos.total)]];

  const fer = custoFerramentas(comp);
  const ferramentas: Cell[][] = [
    ...comp.ferramentas.map((x) => [x.descricao, x.quantidade, r2(x.valorUnit), x.vidaUtilMeses, x.residualPct || 0, r2(x.manutencaoAnual), r2(ferramentaMensal(x))] as Cell[]),
    ['Total mensal do kit', '', r2(fer.investimento), '', '', '', r2(fer.mensal)],
  ];
  const nomes = new Map([...cargos.values()].map((c) => [c.id, c.nome]));
  const pessoal: Cell[][] = comp.pessoal.map((x) => [
    CATEGORIAS_PESSOAL.find((c) => c.value === x.categoria)?.label || x.categoria,
    x.descricao,
    x.ref || '',
    x.qtdAno,
    r2(x.valorUnit),
    r2(pessoalMensal(x)),
    x.cargos?.length ? x.cargos.map((id) => nomes.get(id) || '').join(', ') : 'Todos',
  ]);
  const insumos: Cell[][] = comp.insumos.map((x) => [x.descricao, x.unidade, x.consumoMes, r2(x.valorUnit), r2(insumoMensal(x))]);
  const v = comp.veiculo;
  const cv = custoVeiculo(v);
  const veiculo: Cell[][] = [
    ['Veículo', v.descricao],
    ['Valor de aquisição (R$)', r2(v.valorAquisicao)],
    ['Vida útil (anos)', v.vidaUtilAnos],
    ['Residual (%)', v.residualPct],
    ['Depreciação mensal (R$)', r2(cv.depreciacao)],
    ['Remuneração do capital (R$/mês)', r2(cv.capital)],
    ['IPVA, licenciamento e seguro (R$/mês)', r2(cv.impostosSeguro)],
    ['Outros fixos (R$/mês)', r2(cv.outros)],
    ['Custo fixo mensal (R$)', r2(cv.fixoMensal)],
    ['Combustível (R$/km)', r2(cv.combustivelKm)],
    ['Custo variável (R$/km)', r2(cv.variavelKm)],
  ];

  await exportXlsx(
    [
      { name: 'Resumo', headers: ['Item', 'Valor'], rows: resumo },
      { name: 'Mão de obra', headers: ['Cargo', 'Vínculo', 'Remuneração', '13º, férias e 1/3', 'Encargos', 'Benefícios', 'Rescisão', 'Insumos de pessoal', 'Custo mensal', 'Horas produtivas', 'Custo-hora', 'Qtd', 'Subtotal por hora'], rows: maoDeObra },
      { name: 'Composição por item', headers: ['Nº', 'Item', 'Plano de manutenção', 'Fator', 'Corretiva (%)', 'Qtd', 'Horas/mês por equip.', 'Mão de obra', 'Ferramentas e veículo', 'Materiais', 'Indiretos', 'Custo direto', f.metodo === 'markup' ? 'Markup' : 'BDI', 'Preço unitário/mês', 'Total mensal'], rows: itens },
      { name: 'Indiretos', headers: ['Descrição', 'Valor mensal (R$)'], rows: indiretos },
      { name: 'Formação do preço', headers: f.metodo === 'markup' ? ['Componente', '% do preço'] : ['Componente', 'Adotado (%)', '1º quartil', 'Médio', '3º quartil'], rows: formacao },
      { name: 'Tributos', headers: ['Tributo', 'Alíquota (%)'], rows: tributos },
      { name: 'Ferramentas', headers: ['Ferramenta / instrumento', 'Qtd', 'Valor unitário', 'Vida útil (meses)', 'Residual (%)', 'Manutenção/ano', 'Custo mensal'], rows: ferramentas },
      { name: 'EPI, uniformes e exames', headers: ['Categoria', 'Item', 'CA / NR', 'Qtd por ano', 'Valor unitário', 'Custo mensal', 'Aplica-se a'], rows: pessoal },
      { name: 'Insumos', headers: ['Material', 'Unidade', 'Consumo por equip./mês', 'Valor unitário', 'Custo mensal'], rows: insumos },
      { name: 'Veículo', headers: ['Item', 'Valor'], rows: veiculo },
    ],
    `composicao-${e.numero}.xlsx`,
  );
}
