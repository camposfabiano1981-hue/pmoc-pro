import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { db } from '../../db/db';
import type { CargoPreco } from '../../db/types';
import { Button, cx } from '../../components/ui';
import { PrintToolbar } from '../../components/widgets';
import { num, pct } from '../../components/precoUi';
import { useLookups } from '../../lib/lookups';
import { fmtDate, money } from '../../lib/format';
import { valorPorExtenso } from '../../lib/extenso';
import {
  CATEGORIAS_PESSOAL,
  REFERENCIAS_BDI,
  REGIMES,
  calcularEstudo,
  custoCargo,
  custoFerramentas,
  custoPessoalCargo,
  custoVeiculo,
  custosHora,
  dasMei,
  despesasFixas,
  encargosGrupoA,
  faixaQ,
  farol,
  ferramentaMensal,
  horasMes,
  insumoMensal,
  insumosPorEquipamento,
  pessoalMensal,
  vinculoDe,
  type Farol,
  type Quartis,
} from '../../lib/precificacao';
import { useParametrosPreco } from '../../lib/precificacaoDb';
import { exportarPlanilhaEstudo } from './planilhaExcel';

const dec = (n: number, casas = 4) => (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataLonga = (d = new Date()) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Planilha de composição de preços (memória de cálculo) para a proposta, a diligência de exequibilidade ou o cliente. */
export default function EstudoPrint() {
  const { id } = useParams();
  const l = useLookups();
  const params = useParametrosPreco();
  const e = useLiveQuery(() => db.estudos.get(id!), [id]);
  const cargos = useLiveQuery(() => db.cargosPreco.toArray(), []) || [];
  const op = useLiveQuery(() => (e?.oportunidadeId ? db.oportunidades.get(e.oportunidadeId) : undefined), [e?.oportunidadeId]);
  const [interna, setInterna] = useState(false);
  const [anexos, setAnexos] = useState(true);
  if (!e || !params) return <p className="text-sm text-slate-500">Carregando…</p>;

  const p = params;
  const cargoMap = new Map(cargos.map((c) => [c.id, c]));
  const r = calcularEstudo(e, { params: p, cargos: cargoMap, planos: l.planoMap });
  const f = r.formacao;
  const emp = l.empresa;
  const cor = emp.corPrimaria || '#0e7490';
  const tinta = `${cor}14`;
  const cliente = l.clienteMap.get(e.clienteId || '');
  const resp = l.profissionalMap.get(e.responsavelId || '');
  const h = horasMes(p);
  const ga = encargosGrupoA(p);
  const ch = custosHora(p);
  const comp = p.composicao;
  const temEquip = r.equipamentosMensal > 0;
  const vig = Math.max(1, e.vigenciaMeses || 12);
  const regime = REGIMES.find((x) => x.value === p.regime)?.label || p.regime;
  const regimeDetalhe =
    p.regime === 'simples' && r.tributos.simples
      ? `${r.tributos.simples.faixa}ª faixa, alíquota efetiva ${pct(r.tributos.simples.efetiva)}`
      : p.regime === 'mei'
        ? `DAS fixo de ${money(dasMei(p))}/mês`
        : p.desonerada
          ? 'com desoneração da folha (CPRB)'
          : '';
  const metodo = f.metodo === 'markup' ? 'Markup divisor — preço sobre o custo direto (mercado privado)' : `BDI — Acórdão TCU 2622/2013 (referência: ${f.referencia.label.toLowerCase()})`;
  const licitacao = op
    ? op.tipo === 'licitacao'
      ? [op.modalidade, op.numeroEdital && `nº ${op.numeroEdital}`, op.processo && `processo ${op.processo}`, op.portal].filter(Boolean).join(' · ')
      : 'Proposta direta'
    : '';
  const local = [op?.cidade || cliente?.cidade, op?.uf || cliente?.uf].filter(Boolean).join('/');
  const ccts = [...new Set(e.equipe.map((m) => cargoMap.get(m.cargoId)?.cct).filter(Boolean))].join('; ');
  const rodape = `${e.numero} · Composição de preços · ${emp.razaoSocial || ''}`;
  const rateado = r.deslocamentoMensal + r.custosFixosMensal;

  return (
    <div>
      <PrintToolbar title={`Composição de preços — ${e.numero}`}>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={anexos} onChange={(x) => setAnexos(x.target.checked)} /> Anexos de insumos
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" title="Lance mínimo, exequibilidade, hora técnica e despesas administrativas — não envie ao cliente">
          <input type="checkbox" checked={interna} onChange={(x) => setInterna(x.target.checked)} /> Versão interna
        </label>
        <Button variant="outline" icon={<FileSpreadsheet size={16} />} onClick={() => exportarPlanilhaEstudo(e, r, p, cargoMap, l)}>Excel</Button>
        <Link to={`/precificacao/${e.id}`}><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar ao estudo</Button></Link>
      </PrintToolbar>

      <div className="print-page mx-auto max-w-[1120px] bg-white p-8 text-[10px] leading-snug text-slate-800 shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <style>{`@page { size: A4 landscape; margin: 11mm 10mm 13mm; @bottom-left { content: ${JSON.stringify(rodape)}; font: 7.5pt Inter, Arial, sans-serif; color: #64748b; } @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Inter, Arial, sans-serif; color: #64748b; } }
          .cp-tab tbody tr:nth-child(even) td { background: #f8fafc; }
          .cp-tab tr { break-inside: avoid; }`}</style>

        {/* Cabeçalho */}
        <div className="flex items-start gap-4 border-b-[3px] pb-3" style={{ borderColor: cor }}>
          {emp.logo && <img src={emp.logo} alt="" className="h-14 w-14 object-contain" />}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-slate-900">{emp.razaoSocial}</p>
            <p className="mt-0.5 text-[9px] leading-snug text-slate-600">
              {[emp.cnpj && `CNPJ ${emp.cnpj}`, emp.endereco, [emp.cidade, emp.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}
              <br />
              {[emp.telefone, emp.whatsapp, emp.email, emp.site].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8.5px] font-semibold uppercase tracking-[0.25em] text-slate-500">Planilha de</p>
            <p className="text-[18px] font-extrabold uppercase leading-none" style={{ color: cor }}>Composição de preços</p>
            <p className="mt-1.5 text-[10px] text-slate-600">
              <b className="text-slate-900">{e.numero}</b> · emitida em {fmtDate(new Date().toISOString())}
            </p>
          </div>
        </div>

        {/* Quadro-resumo */}
        <div className="mt-4 grid grid-cols-[1.45fr_1fr] gap-4">
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              {(
                [
                  ['Objeto', op?.objeto || e.titulo],
                  ['Contratante', cliente?.nome || e.orgao || op?.orgao || '—'],
                  ...(licitacao ? [['Licitação / processo', licitacao]] : []),
                  ...(local ? [['Local de execução', local]] : []),
                  ['Vigência · validade', `${vig} meses · proposta válida por ${e.validadeDias || 60} dias`],
                  ['Regime tributário', [regime, regimeDetalhe].filter(Boolean).join(' — ')],
                  ['Formação do preço', metodo],
                  ['Data-base dos custos', [fmtDate(e.updatedAt), ccts && `convenção coletiva: ${ccts}`].filter(Boolean).join(' · ')],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k}>
                  <td className="w-36 border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-700">{k}</td>
                  <td className="border border-slate-300 px-2 py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-2 self-start">
            <Kpi cor={cor} destaque rotulo="Preço mensal" valor={money(r.precoMensal)} />
            <Kpi cor={cor} destaque rotulo={`Total da vigência (${vig} meses)`} valor={money(r.precoVigencia)} />
            <Kpi cor={cor} rotulo="Equipamentos atendidos" valor={String(r.quantidade)} />
            <Kpi cor={cor} rotulo="Horas técnicas por mês" valor={`${num(r.horasMes, 1)} h`} />
            <Kpi cor={cor} rotulo="Custo-hora operacional" valor={money(r.custoHoraOperacional)} />
            <Kpi cor={cor} rotulo={f.metodo === 'markup' ? 'Markup (BDI equivalente)' : 'BDI'} valor={pct(r.bdi)} />
          </div>
        </div>

        {/* 1. Mão de obra */}
        <Secao n={1} titulo="Mão de obra e custo da hora produtiva" cor={cor}>
          <Tabela cor={cor} cab={['Cargo / função', 'Vínculo', 'Remuneração', '13º, férias e 1/3', 'Encargos', 'Benefícios', 'Rescisão', 'Insumos de pessoal', 'Custo mensal', 'Custo-hora', 'Qtd', 'Subtotal/h']} direita={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}>
            {e.equipe
              .filter((m) => m.quantidade > 0 && cargoMap.get(m.cargoId))
              .map((m, i) => {
                const c = cargoMap.get(m.cargoId) as CargoPreco;
                const k = custoCargo(c, p);
                return (
                  <tr key={i}>
                    <Td>{c.nome}</Td>
                    <Td>{vinculoDe(c.vinculo).curto}</Td>
                    <Td n>{money(k.remuneracao)}</Td>
                    <Td n>{k.vinculo === 'clt' ? money(k.modulo21) : '—'}</Td>
                    <Td n>{money(k.modulo22)}<Sub>{pct(k.grupoA)}</Sub></Td>
                    <Td n>{money(k.modulo23)}</Td>
                    <Td n>{k.vinculo === 'clt' ? money(k.modulo3) : '—'}</Td>
                    <Td n>{money(k.insumos)}</Td>
                    <Td n b>{money(k.total)}</Td>
                    <Td n b>{money(k.custoHora)}</Td>
                    <Td n>{m.quantidade}</Td>
                    <Td n b>{money(k.custoHora * m.quantidade)}</Td>
                  </tr>
                );
              })}
            <Total tinta={tinta} colSpan={11} rotulo="Custo-hora da equipe (mão de obra)" valor={money(r.custoHoraEquipe)} />
            {temEquip && (
              <>
                <tr>
                  <Td colSpan={11}>Ferramentas e instrumentos — {num(e.kits || 0, 0)} kit × {money(ch.ferramentas)}/h (Anexo I)</Td>
                  <Td n>{money(r.ferramentasHora)}</Td>
                </tr>
                <tr>
                  <Td colSpan={11}>Veículo de atendimento, custo fixo — {num(e.veiculos || 0, 0)} × {money(ch.veiculo)}/h (Anexo IV)</Td>
                  <Td n>{money(r.veiculoHora)}</Td>
                </tr>
                <Total tinta={tinta} colSpan={11} rotulo="Custo-hora operacional da equipe" valor={money(r.custoHoraOperacional)} />
              </>
            )}
          </Tabela>
          <Nota>
            Horas produtivas: {h.diasAno} dias/ano × {num(p.jornadaSemanal / 5, 1)} h ÷ 12 = {num(h.disponiveis, 1)} h/mês × {num(p.produtividade, 0)}% = <b>{num(h.produtivas, 1)} h/mês</b>. Empregados CLT na estrutura da IN SEGES 5/2017: 13º {pct(p.decimoTerceiro)}, férias + 1/3 {pct(p.feriasTerco)}, encargos do Grupo A {pct(ga.total)} e rescisão {pct(p.avisoIndenizado + p.fgtsAvisoIndenizado + p.avisoTrabalhado + p.multaFgts)}. Pró-labore e autônomos sem provisões trabalhistas.
          </Nota>
        </Secao>

        {/* 2. Composição por equipamento */}
        <Secao n={2} titulo="Composição de custos unitários por equipamento (valores mensais)" cor={cor}>
          <Tabela
            cor={cor}
            cab={['Item', 'Plano de manutenção e premissas', 'Qtd', 'Horas/mês', 'Mão de obra', ...(temEquip ? ['Ferram. e veículo'] : []), 'Materiais', 'Indiretos', 'Custo direto', f.metodo === 'markup' ? 'Markup' : `BDI ${pct(r.bdi)}`, 'Preço unitário', 'Total mensal']}
            direita={temEquip ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [2, 3, 4, 5, 6, 7, 8, 9, 10]}
          >
            {r.itens.map((i, k) => (
              <tr key={i.item.id}>
                <Td><b>{k + 1}.</b> {i.item.descricao}</Td>
                <Td>
                  {l.planoMap.get(i.item.planoId || '')?.nome || 'horas informadas'}
                  <Sub>
                    {[i.item.fatorTempo !== 1 && `fator de porte ${num(i.item.fatorTempo)}`, i.item.corretivaPct ? `corretiva ${num(i.item.corretivaPct, 0)}%` : '', `${num(i.horasPreventivas)} h prev. + ${num(i.horasCorretivas)} h corr.`].filter(Boolean).join(' · ')}
                  </Sub>
                </Td>
                <Td n>{i.item.quantidade}</Td>
                <Td n>{num(i.horasUnit)}</Td>
                <Td n>{money(i.custoMO)}</Td>
                {temEquip && <Td n>{money(i.custoEquip)}</Td>}
                <Td n>{money(i.materiais)}</Td>
                <Td n>{money(i.rateio)}</Td>
                <Td n>{money(i.custoDireto)}</Td>
                <Td n>{money(i.precoUnit - i.custoDireto)}</Td>
                <Td n b>{money(i.precoUnit)}</Td>
                <Td n b>{money(i.totalMensal)}</Td>
              </tr>
            ))}
            <tr className="font-bold" style={{ background: tinta }}>
              <Td colSpan={2} b>Total mensal do contrato</Td>
              <Td n b>{r.quantidade}</Td>
              <Td n b>{num(r.horasMes, 1)}</Td>
              <Td n b>{money(r.maoDeObraMensal)}</Td>
              {temEquip && <Td n b>{money(r.equipamentosMensal)}</Td>}
              <Td n b>{money(r.materiaisMensal)}</Td>
              <Td n b>{money(rateado)}</Td>
              <Td n b>{money(r.custoDiretoMensal)}</Td>
              <Td n b>{money(r.precoMensal - r.custoDiretoMensal)}</Td>
              <Td n b>—</Td>
              <Td n b>{money(r.precoMensal)}</Td>
            </tr>
          </Tabela>
          <Nota>
            Horas por equipamento = Σ (tempo da rotina × execuções no ano) ÷ 12, pelo plano de manutenção do PMOC, × fator de porte + reserva de corretiva. Mão de obra = horas × custo-hora da equipe{temEquip ? '; ferramentas e veículo = horas × custo por hora' : ''}. Indiretos rateados {e.rateio === 'horas' ? 'proporcionalmente às horas de cada equipamento' : 'igualmente por equipamento'}.{f.materiais.ativo ? ` Materiais com ${f.metodo === 'markup' ? 'margem' : 'BDI'} diferenciado de ${pct(f.materiais.bdi)}.` : ''}
          </Nota>
        </Secao>

        {/* 3 e 4. Indiretos e ferramentas/veículo */}
        <div className="grid grid-cols-2 gap-5">
          <Secao n={3} titulo="Custos indiretos do contrato (mensais)" cor={cor} evitarQuebra>
            <Tabela cor={cor} cab={['Descrição', 'Valor mensal']} direita={[1]}>
              <tr>
                <Td>Deslocamento — tempo da equipe: {num(e.deslocamento.visitasMes, 0)} visitas × {num((e.deslocamento.minutosVisita || 0) / 60)} h × {money(r.custoHoraEquipe)}/h</Td>
                <Td n>{money((e.deslocamento.visitasMes || 0) * ((e.deslocamento.minutosVisita || 0) / 60) * r.custoHoraEquipe)}</Td>
              </tr>
              <tr>
                <Td>Deslocamento — veículo: {num(e.deslocamento.kmMes, 0)} km × {money(e.deslocamento.custoKm)}/km</Td>
                <Td n>{money((e.deslocamento.kmMes || 0) * (e.deslocamento.custoKm || 0))}</Td>
              </tr>
              {e.custosFixos.filter((c) => c.valorMensal).map((c) => (
                <tr key={c.id}>
                  <Td>{c.descricao}</Td>
                  <Td n>{money(c.valorMensal)}</Td>
                </tr>
              ))}
              <Total tinta={tinta} colSpan={1} rotulo="Total rateado entre os equipamentos" valor={money(rateado)} />
            </Tabela>
          </Secao>
          <Secao n={4} titulo="Ferramentas e veículo (custo por hora de serviço)" cor={cor} evitarQuebra>
            <Tabela cor={cor} cab={['Recurso', 'Custo mensal', 'Por hora', 'No contrato']} direita={[1, 2, 3]}>
              <tr>
                <Td>Kit de ferramentas e instrumentos × {num(e.kits || 0, 0)}</Td>
                <Td n>{money(custoFerramentas(comp).mensal)}</Td>
                <Td n>{money(ch.ferramentas)}</Td>
                <Td n>{money(r.horasMes * r.ferramentasHora)}</Td>
              </tr>
              <tr>
                <Td>Veículo de atendimento (custo fixo) × {num(e.veiculos || 0, 0)}</Td>
                <Td n>{money(custoVeiculo(comp.veiculo).fixoMensal)}</Td>
                <Td n>{money(ch.veiculo)}</Td>
                <Td n>{money(r.horasMes * r.veiculoHora)}</Td>
              </tr>
              <Total tinta={tinta} colSpan={3} rotulo={`Total pelas ${num(r.horasMes, 1)} h de serviço do mês`} valor={money(r.equipamentosMensal)} />
            </Tabela>
            <Nota>Custo por hora = custo mensal ÷ {num(h.produtivas, 1)} h produtivas. O custo variável do veículo ({money(custoVeiculo(comp.veiculo).variavelKm)}/km) entra no deslocamento.</Nota>
          </Secao>
        </div>

        {/* 5 e 6. Formação do preço e tributos */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-5">
          <Secao n={5} titulo={f.metodo === 'markup' ? 'Formação do preço — markup divisor' : 'Demonstrativo do BDI'} cor={cor} evitarQuebra>
            {f.metodo === 'tcu' ? (
              <>
                <Tabela cor={cor} cab={['Componente', 'Adotado', '1º quartil', 'Médio', '3º quartil', ...(interna ? ['Situação'] : [])]} direita={[1, 2, 3, 4]}>
                  <LinhaBdi interna={interna} nome="Administração central (AC)" valor={e.bdi.ac} q={f.referencia.ac} />
                  <LinhaBdi interna={interna} nome="Seguros (S) + garantias (G)" valor={e.bdi.s + e.bdi.g} q={f.referencia.sg} />
                  <LinhaBdi interna={interna} nome="Riscos (R)" valor={e.bdi.r} q={f.referencia.r} />
                  <LinhaBdi interna={interna} nome={`Despesas financeiras (DF) — ${e.bdi.prazoDias} dias a ${pct(e.bdi.taxaMes)} a.m.`} valor={f.df} q={f.referencia.df} />
                  <LinhaBdi interna={interna} nome="Lucro (L)" valor={e.bdi.l} q={f.referencia.l} />
                  <tr>
                    <Td>Tributos sobre o faturamento (I) — quadro 6</Td>
                    <Td n>{pct(r.tributos.total)}</Td>
                    <Td colSpan={interna ? 4 : 3} />
                  </tr>
                  <LinhaBdi interna={interna} nome="BDI" valor={f.bdi} q={f.referencia.total} total tinta={tinta} />
                </Tabela>
                <div className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[9px] leading-relaxed">
                  BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) ÷ (1 − I)] − 1
                  <br />
                  BDI = [(1 + {dec(e.bdi.ac)} + {dec(e.bdi.s)} + {dec(e.bdi.r)} + {dec(e.bdi.g)}) × (1 + {dec(f.df)}) × (1 + {dec(e.bdi.l)}) ÷ (1 − {dec(r.tributos.total)})] − 1 = <b>{pct(f.bdi)}</b>
                </div>
                {f.materiais.ativo && e.bdiMateriais && (
                  <p className="mt-2">
                    <b>BDI diferenciado dos materiais (Súmula TCU 253):</b> AC {pct(e.bdiMateriais.ac)}, S + G {pct(e.bdiMateriais.s + e.bdiMateriais.g)}, R {pct(e.bdiMateriais.r)}, L {pct(e.bdiMateriais.l)}, mesmos DF e I → <b>{pct(f.materiais.bdi)}</b>. Componentes na faixa do acórdão para fornecimento de materiais ({pct(REFERENCIAS_BDI.materiais.total[0])} a {pct(REFERENCIAS_BDI.materiais.total[2])} sem ISS); aqui incidem os tributos do serviço.
                  </p>
                )}
                <Nota>Referência: Acórdão TCU 2622/2013-Plenário, {f.referencia.label.toLowerCase()} (1º quartil, médio e 3º quartil). IRPJ e CSLL não compõem o BDI (Súmula TCU 254).</Nota>
              </>
            ) : (
              f.markup && (
                <>
                  <Tabela cor={cor} cab={['Componente', '% do preço de venda']} direita={[1]}>
                    <tr><Td>Tributos sobre o faturamento (I) — quadro 6</Td><Td n>{pct(f.markup.tributos)}</Td></tr>
                    <tr><Td>Despesas fixas da empresa (DF){f.despesasFixasCalculadas ? ' — despesas administrativas ÷ faturamento médio' : ''}</Td><Td n>{pct(f.markup.despesasFixas)}</Td></tr>
                    <tr><Td>Despesas variáveis (DV): comissão, cartão/boleto e inadimplência</Td><Td n>{pct(f.markup.variaveis)}</Td></tr>
                    <tr><Td>Lucro (L)</Td><Td n>{pct(f.markup.lucro)}</Td></tr>
                    <Total tinta={tinta} colSpan={1} rotulo="Soma" valor={pct(f.markup.soma)} />
                    <tr><Td>Divisor = 1 − soma</Td><Td n>{num(f.markup.divisor, 4)}</Td></tr>
                    <tr><Td>Multiplicador = 1 ÷ divisor</Td><Td n b>{num(f.markup.multiplicador, 4)}</Td></tr>
                    <Total tinta={tinta} colSpan={1} rotulo="BDI equivalente sobre o custo direto" valor={pct(f.bdi)} />
                  </Tabela>
                  <div className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-[9px] leading-relaxed">
                    Preço = custo direto ÷ [1 − (I + DF + DV + L)]
                    <br />
                    Preço = custo direto ÷ [1 − ({dec(f.markup.tributos)} + {dec(f.markup.despesasFixas)} + {dec(f.markup.variaveis)} + {dec(f.markup.lucro)})] = custo direto × <b>{num(f.markup.multiplicador, 4)}</b>
                  </div>
                  {f.materiais.ativo && f.materiais.markup && (
                    <p className="mt-2"><b>Materiais com margem própria:</b> lucro de {pct(f.materiais.markup.lucro)}, sem rateio das despesas fixas → multiplicador {num(f.materiais.markup.multiplicador, 4)} ({pct(f.materiais.bdi)}).</p>
                  )}
                </>
              )
            )}
          </Secao>
          <Secao n={6} titulo="Tributos sobre o faturamento" cor={cor} evitarQuebra>
            <Tabela cor={cor} cab={['Tributo', 'Alíquota']} direita={[1]}>
              {r.tributos.itens.filter((t) => !t.excluido).map((t) => (
                <tr key={t.nome}>
                  <Td>{t.nome}{t.obs && <Sub>{t.obs}</Sub>}</Td>
                  <Td n>{pct(t.aliquota, 3)}</Td>
                </tr>
              ))}
              <Total tinta={tinta} colSpan={1} rotulo="Total (I)" valor={pct(r.tributos.total, 3)} />
            </Tabela>
            <Nota>
              {p.regime === 'mei'
                ? 'MEI (SIMEI): sem tributo proporcional ao faturamento; o DAS fixo integra as despesas fixas.'
                : p.regime === 'simples'
                  ? 'Simples Nacional, Anexo III: alíquota efetiva pela receita bruta dos últimos 12 meses (LC 123/2006, art. 18, §1º-A).'
                  : 'Tributos calculados por dentro do preço.'}{' '}
              Carga tributária registrada para eventual reequilíbrio (LC 214/2025, arts. 373 a 377).
              {r.tributos.porFora > 0 && ` Acrescentar ${pct(r.tributos.porFora)} de tributos calculados por fora: ${money(r.precoMensalComPorFora)}/mês.`}
            </Nota>
          </Secao>
        </div>

        {/* 7. Resumo */}
        <Secao n={7} titulo="Resumo do preço" cor={cor} evitarQuebra>
          <div className="grid grid-cols-[1fr_1fr_1.3fr] overflow-hidden rounded border border-slate-300">
            <Bloco rotulo="Preço mensal" valor={money(r.precoMensal)} />
            <Bloco rotulo="Preço anual (12 meses)" valor={money(r.precoAnual)} />
            <Bloco rotulo={`Total da vigência (${vig} meses)`} valor={money(r.precoVigencia)} destaque cor={cor} />
          </div>
          <p className="mt-1.5 text-[10px] italic text-slate-700">Valor total: {valorPorExtenso(r.precoVigencia)}.</p>
          {e.observacoes && <p className="mt-1.5 whitespace-pre-wrap"><b>Premissas e condições:</b> {e.observacoes}</p>}
        </Secao>

        {interna && (
          <div className="mt-5 break-inside-avoid rounded border-2 border-dashed border-rose-300 p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-rose-700">Uso interno — não enviar ao cliente</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p><b>Lance mínimo (lucro zero):</b> {money(r.lanceMinimoMensal)}/mês</p>
                <p>Desconto máximo sobre o preço: {pct(r.precoMensal ? (1 - r.lanceMinimoMensal / r.precoMensal) * 100 : 0, 1)}</p>
                <p><b>Preço da hora técnica:</b> {money(r.precoHoraTecnica)} (serviços eventuais)</p>
              </div>
              <div>
                {r.comparacao ? (
                  <>
                    <p><b>Proposta = {pct(r.comparacao.pct, 1)} do estimado</b> ({money(e.valorEstimadoMensal)}/mês)</p>
                    {r.comparacao.alertas.map((a, k) => <p key={k}>• {a.texto}</p>)}
                  </>
                ) : (
                  <p>Sem valor estimado informado.</p>
                )}
                {r.alertasRegime.map((a, k) => <p key={k}>• {a.texto}</p>)}
              </div>
              <div>
                <p className="font-bold">Despesas administrativas (Anexo V)</p>
                <p>{money(despesasFixas(p).total)}/mês = {pct(despesasFixas(p).pct)} do faturamento médio de {money(p.faturamentoMensal)}.</p>
              </div>
            </div>
          </div>
        )}

        <Assinaturas cidade={[emp.cidade, emp.uf].filter(Boolean).join('/')} empresa={emp.razaoSocial} resp={resp ? { nome: resp.nome, funcao: resp.funcao, registro: resp.registro ? `${resp.conselho || 'Registro'} ${resp.registro}` : '' } : undefined} />

        {anexos && (
          <div className="break-before-page pt-2 print:pt-0">
            <p className="mb-1 mt-6 text-[13px] font-extrabold uppercase print:mt-0" style={{ color: cor }}>Anexos — composição dos insumos</p>
            <p className="mb-2 text-slate-600">Valores unitários e quantidades que formam os custos do quadro 1 (insumos de pessoal), do quadro 2 (materiais) e do quadro 4 (ferramentas e veículo).</p>

            <Secao n="I" titulo={`Kit de ferramentas e instrumentos de uma equipe — ${money(custoFerramentas(comp).mensal)}/mês`} cor={cor}>
              <Tabela cor={cor} cab={['Ferramenta / instrumento', 'Qtd', 'Valor unitário', 'Vida útil', 'Residual', 'Manutenção/ano', 'Custo mensal']} direita={[1, 2, 3, 4, 5, 6]}>
                {comp.ferramentas.filter((x) => x.valorUnit || x.manutencaoAnual).map((x) => (
                  <tr key={x.id}>
                    <Td>{x.descricao}</Td>
                    <Td n>{num(x.quantidade, 0)}</Td>
                    <Td n>{money(x.valorUnit)}</Td>
                    <Td n>{num(x.vidaUtilMeses, 0)} meses</Td>
                    <Td n>{pct(x.residualPct || 0, 0)}</Td>
                    <Td n>{money(x.manutencaoAnual)}</Td>
                    <Td n b>{money(ferramentaMensal(x))}</Td>
                  </tr>
                ))}
                <Total tinta={tinta} colSpan={6} rotulo={`Total mensal do kit (investimento de ${money(custoFerramentas(comp).investimento)})`} valor={money(custoFerramentas(comp).mensal)} />
              </Tabela>
            </Secao>

            <Secao n="II" titulo="Uniformes, EPI, exames e treinamentos por empregado" cor={cor}>
              <Tabela cor={cor} cab={['Categoria', 'Item', 'CA / NR', 'Qtd/ano', 'Valor unitário', 'Custo mensal', 'Aplica-se a']} direita={[3, 4, 5]}>
                {comp.pessoal.filter((x) => x.valorUnit).map((x) => (
                  <tr key={x.id}>
                    <Td>{CATEGORIAS_PESSOAL.find((c) => c.value === x.categoria)?.label}</Td>
                    <Td>{x.descricao}</Td>
                    <Td>{x.ref || '—'}</Td>
                    <Td n>{num(x.qtdAno, x.qtdAno % 1 ? 1 : 0)}</Td>
                    <Td n>{money(x.valorUnit)}</Td>
                    <Td n b>{money(pessoalMensal(x))}</Td>
                    <Td>{x.cargos?.length ? x.cargos.map((id) => cargoMap.get(id)?.nome || '—').join(', ') : 'Todos'}</Td>
                  </tr>
                ))}
              </Tabela>
              <p className="mt-1 text-slate-600">
                Por cargo:{' '}
                {e.equipe
                  .map((m) => cargoMap.get(m.cargoId))
                  .filter((c): c is CargoPreco => !!c)
                  .map((c) => `${c.nome} ${money(custoPessoalCargo(c.id, comp).total)}/mês`)
                  .join(' · ')}
              </p>
            </Secao>

            <div className="grid grid-cols-2 gap-5">
              <Secao n="III" titulo={`Materiais de consumo — ${money(insumosPorEquipamento(comp))} por equipamento/mês`} cor={cor} evitarQuebra>
                <Tabela cor={cor} cab={['Material', 'Unid.', 'Consumo/mês', 'Valor unitário', 'Custo/mês']} direita={[2, 3, 4]}>
                  {comp.insumos.filter((x) => x.valorUnit).map((x) => (
                    <tr key={x.id}>
                      <Td>{x.descricao}</Td>
                      <Td>{x.unidade}</Td>
                      <Td n>{num(x.consumoMes, 3)}</Td>
                      <Td n>{money(x.valorUnit)}</Td>
                      <Td n b>{money(insumoMensal(x))}</Td>
                    </tr>
                  ))}
                  <Total tinta={tinta} colSpan={4} rotulo="Por equipamento/mês (× fator de porte de cada item)" valor={money(insumosPorEquipamento(comp))} />
                </Tabela>
              </Secao>
              <Secao n="IV" titulo={`Veículo de atendimento — ${comp.veiculo.descricao}`} cor={cor} evitarQuebra>
                <VeiculoAnexo cor={cor} tinta={tinta} />
              </Secao>
            </div>

            {interna && (
              <Secao n="V" titulo="Despesas administrativas (uso interno)" cor={cor} evitarQuebra>
                <Tabela cor={cor} cab={['Despesa', 'Valor mensal']} direita={[1]}>
                  {despesasFixas(p).itens.map((x) => (
                    <tr key={x.id || x.descricao}><Td>{x.descricao}</Td><Td n>{money(x.valorMensal)}</Td></tr>
                  ))}
                  <Total tinta={tinta} colSpan={1} rotulo={`Total (${pct(despesasFixas(p).pct)} do faturamento médio)`} valor={money(despesasFixas(p).total)} />
                </Tabela>
              </Secao>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function VeiculoAnexo({ cor: c, tinta: t }: { cor: string; tinta: string }) {
    const v = comp.veiculo;
    const cv = custoVeiculo(v);
    return (
      <Tabela cor={c} cab={['Item', 'Base', 'Valor']} direita={[2]}>
        <tr><Td>Depreciação</Td><Td>{money(v.valorAquisicao)}, {num(v.vidaUtilAnos, 0)} anos, residual {pct(v.residualPct, 0)}</Td><Td n>{money(cv.depreciacao)}</Td></tr>
        {cv.capital > 0 && <tr><Td>Remuneração do capital</Td><Td>{pct(v.capitalPctAno)} a.a. sobre o capital médio</Td><Td n>{money(cv.capital)}</Td></tr>}
        <tr><Td>IPVA, licenciamento e seguro</Td><Td>{money(v.ipvaAnual + v.seguroAnual)}/ano</Td><Td n>{money(cv.impostosSeguro)}</Td></tr>
        {cv.outros > 0 && <tr><Td>Rastreador, estacionamento e outros</Td><Td>mensal</Td><Td n>{money(cv.outros)}</Td></tr>}
        <Total tinta={t} colSpan={2} rotulo="Custo fixo mensal" valor={money(cv.fixoMensal)} />
        <tr><Td>Combustível</Td><Td>{money(v.precoCombustivel)}/L ÷ {num(v.consumoKmL, 1)} km/L</Td><Td n>{money(cv.combustivelKm)}/km</Td></tr>
        <tr><Td>Manutenção, óleo, lavagem e pneus</Td><Td>por km</Td><Td n>{money((v.manutencaoKm || 0) + (v.pneusKm || 0))}/km</Td></tr>
        <Total tinta={t} colSpan={2} rotulo="Custo variável" valor={`${money(cv.variavelKm)}/km`} />
      </Tabela>
    );
  }
}

/* ---------------- Peças do relatório ---------------- */
function Secao({ n, titulo, cor, children, evitarQuebra }: { n: number | string; titulo: string; cor: string; children: ReactNode; evitarQuebra?: boolean }) {
  return (
    <section className={cx('mt-5', evitarQuebra && 'break-inside-avoid')}>
      <h2 className="mb-1.5 flex items-center gap-2 border-b pb-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ borderColor: cor, color: cor }}>
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-[9.5px] text-white" style={{ background: cor }}>{n}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Tabela({ cab, direita = [], cor, children }: { cab: string[]; direita?: number[]; cor: string; children: ReactNode }) {
  return (
    <table className="cp-tab w-full border-collapse text-[9.5px] leading-tight">
      <thead>
        <tr>
          {cab.map((c, i) => (
            <th key={c + i} className={cx('border px-1.5 py-1 font-semibold text-white', direita.includes(i) ? 'text-right' : 'text-left')} style={{ background: cor, borderColor: cor }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, n, b, colSpan, style }: { children?: ReactNode; n?: boolean; b?: boolean; colSpan?: number; style?: CSSProperties }) {
  return (
    <td colSpan={colSpan} style={style} className={cx('border border-slate-300 px-1.5 py-[3px] align-top', n && 'whitespace-nowrap text-right tabular-nums', b && 'font-semibold text-slate-900')}>
      {children}
    </td>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[8.5px] leading-snug text-slate-500">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="block text-[8.5px] font-normal text-slate-500">{children}</span>;
}

function Total({ rotulo, valor, colSpan, tinta }: { rotulo: string; valor: string; colSpan: number; tinta: string }) {
  return (
    <tr className="font-bold" style={{ background: tinta }}>
      <Td colSpan={colSpan} b>{rotulo}</Td>
      <Td n b>{valor}</Td>
    </tr>
  );
}

const FAROL_TXT: Record<Farol, { t: string; c: string }> = {
  dentro: { t: 'na faixa', c: 'text-emerald-700' },
  abaixo: { t: 'abaixo do 1º quartil', c: 'text-amber-700' },
  acima: { t: 'acima do 3º quartil', c: 'text-rose-700' },
};

function LinhaBdi({ nome, valor, q, total, tinta, interna }: { nome: string; valor: number; q: Quartis; total?: boolean; tinta?: string; interna: boolean }) {
  const fx = FAROL_TXT[farol(valor, faixaQ(q))];
  return (
    <tr className={cx(total && 'font-bold')} style={total ? { background: tinta } : undefined}>
      <Td b={total}>{nome}</Td>
      <Td n b>{pct(valor)}</Td>
      <Td n>{pct(q[0])}</Td>
      <Td n>{pct(q[1])}</Td>
      <Td n>{pct(q[2])}</Td>
      {interna && <Td><span className={fx.c}>{fx.t}</span></Td>}
    </tr>
  );
}

function Kpi({ rotulo, valor, destaque, cor }: { rotulo: string; valor: string; destaque?: boolean; cor: string }) {
  return (
    <div className="rounded border px-2.5 py-1.5" style={destaque ? { background: cor, borderColor: cor, color: '#fff' } : { borderColor: '#cbd5e1' }}>
      <p className={cx('text-[8px] font-semibold uppercase tracking-wide', destaque ? 'text-white/80' : 'text-slate-500')}>{rotulo}</p>
      <p className={cx('text-[13px] font-extrabold tabular-nums leading-tight', !destaque && 'text-slate-900')}>{valor}</p>
    </div>
  );
}

function Bloco({ rotulo, valor, destaque, cor }: { rotulo: string; valor: string; destaque?: boolean; cor?: string }) {
  return (
    <div className="border-r border-slate-300 px-3 py-2 last:border-r-0" style={destaque ? { background: cor, color: '#fff' } : undefined}>
      <p className={cx('text-[8.5px] font-semibold uppercase tracking-wide', destaque ? 'text-white/80' : 'text-slate-500')}>{rotulo}</p>
      <p className="text-[15px] font-extrabold tabular-nums">{valor}</p>
    </div>
  );
}

function Assinaturas({ cidade, empresa, resp }: { cidade: string; empresa: string; resp?: { nome: string; funcao?: string; registro: string } }) {
  return (
    <div className="mt-10 break-inside-avoid">
      <p className="mb-10 text-center text-[10px]">{cidade ? `${cidade}, ` : ''}{dataLonga()}.</p>
      <div className="grid grid-cols-2 gap-16 text-center text-[9.5px]">
        <div className="border-t border-slate-500 pt-1">
          <b>{resp?.nome || 'Responsável técnico pela composição'}</b>
          <br />
          {resp ? [resp.funcao, resp.registro].filter(Boolean).join(' · ') : 'Nome, função e registro profissional'}
        </div>
        <div className="border-t border-slate-500 pt-1">
          <b>{empresa}</b>
          <br />
          Representante legal
        </div>
      </div>
    </div>
  );
}
