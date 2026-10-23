import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../db/db';
import { Button } from '../../components/ui';
import { PrintHeader, PrintPage, PrintToolbar } from '../../components/widgets';
import { num, pct } from '../../components/precoUi';
import { useLookups } from '../../lib/lookups';
import { fmtDate, money } from '../../lib/format';
import { valorPorExtenso } from '../../lib/extenso';
import { calcularEstudo, custoCargo, encargosGrupoA, horasMes } from '../../lib/precificacao';
import { useParametrosPreco } from '../../lib/precificacaoDb';

/** Composição de preços (memória de cálculo) para anexar à proposta ou à diligência de exequibilidade. */
export default function EstudoPrint() {
  const { id } = useParams();
  const l = useLookups();
  const params = useParametrosPreco();
  const e = useLiveQuery(() => db.estudos.get(id!), [id]);
  const cargos = useLiveQuery(() => db.cargosPreco.toArray(), []) || [];
  const op = useLiveQuery(() => (e?.oportunidadeId ? db.oportunidades.get(e.oportunidadeId) : undefined), [e?.oportunidadeId]);
  if (!e || !params) return <p className="text-sm text-slate-500">Carregando…</p>;
  const cargoMap = new Map(cargos.map((c) => [c.id, c]));
  const r = calcularEstudo(e, { params, cargos: cargoMap, planos: l.planoMap });
  const cliente = l.clienteMap.get(e.clienteId || '');
  const th = 'border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-left';
  const td = 'border border-slate-400 px-1.5 py-0.5';
  const tdr = td + ' text-right tabular-nums';
  const h = horasMes(params);
  const ga = encargosGrupoA(params);
  const regime = params.regime === 'simples' ? `Simples Nacional — Anexo III (${r.tributos.simples?.faixa}ª faixa, alíquota efetiva ${pct(r.tributos.simples?.efetiva)})` : params.regime === 'presumido' ? 'Lucro Presumido' : 'Lucro Real';

  return (
    <div>
      <PrintToolbar title={`Composição de preços — ${e.numero}`}>
        <Link to={`/precificacao/${e.id}`}><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar ao estudo</Button></Link>
      </PrintToolbar>
      <PrintPage landscape>
        <PrintHeader empresa={l.empresa} titulo="Composição de preços" subtitulo={<><b className="text-base text-slate-900">{e.numero}</b><br />{fmtDate(e.updatedAt)}</>} />
        <table className="mb-3 w-full border-collapse text-[11px]">
          <tbody>
            <tr><td className={th + ' w-48'}>Objeto</td><td className={td}>{e.titulo}</td></tr>
            <tr><td className={th}>Contratante</td><td className={td}>{cliente?.nome || e.orgao || '—'}</td></tr>
            {op && <tr><td className={th}>Licitação</td><td className={td}>{[op.modalidade, op.numeroEdital && `nº ${op.numeroEdital}`, op.processo && `processo ${op.processo}`, op.portal].filter(Boolean).join(' · ')}</td></tr>}
            <tr><td className={th}>Vigência</td><td className={td}>{e.vigenciaMeses} meses</td></tr>
            <tr><td className={th}>Regime tributário</td><td className={td}>{regime}</td></tr>
          </tbody>
        </table>

        <h3 className="mb-1 mt-3 text-[12px] font-bold uppercase">1. Equipe e custo da hora produtiva</h3>
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr><th className={th}>Cargo</th><th className={th}>Remuneração</th><th className={th}>13º/férias</th><th className={th}>Encargos ({pct(ga.total)})</th><th className={th}>Benefícios</th><th className={th}>Rescisão</th><th className={th}>Insumos</th><th className={th}>Custo mensal</th><th className={th}>Custo-hora</th><th className={th}>Qtd</th></tr>
          </thead>
          <tbody>
            {e.equipe.filter((m) => m.quantidade > 0).map((m, i) => {
              const c = cargoMap.get(m.cargoId);
              if (!c) return null;
              const k = custoCargo(c, params);
              return (
                <tr key={i}>
                  <td className={td}>{c.nome}</td><td className={tdr}>{money(k.remuneracao)}</td><td className={tdr}>{money(k.modulo21)}</td><td className={tdr}>{money(k.modulo22)}</td><td className={tdr}>{money(k.modulo23)}</td><td className={tdr}>{money(k.modulo3)}</td><td className={tdr}>{money(k.insumos)}</td><td className={tdr}>{money(k.total)}</td><td className={tdr + ' font-semibold'}>{money(k.custoHora)}</td><td className={tdr}>{m.quantidade}</td>
                </tr>
              );
            })}
            <tr className="font-bold"><td className={td} colSpan={8}>Custo-hora da equipe</td><td className={tdr}>{money(r.custoHoraEquipe)}</td><td className={td} /></tr>
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-slate-600">
          Horas produtivas: {h.diasAno} dias/ano × {num(params.jornadaSemanal / 5, 1)} h ÷ 12 = {num(h.disponiveis, 1)} h/mês × {params.produtividade}% = {num(h.produtivas, 1)} h/mês. Provisões: 13º {pct(params.decimoTerceiro)}, férias + 1/3 {pct(params.feriasTerco)}, rescisão {pct(params.avisoIndenizado + params.fgtsAvisoIndenizado + params.avisoTrabalhado + params.multaFgts)} (estrutura da IN SEGES 5/2017).
        </p>

        <h3 className="mb-1 mt-3 text-[12px] font-bold uppercase">2. Composição por equipamento (valores mensais)</h3>
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr><th className={th}>Item</th><th className={th}>Plano de manutenção</th><th className={th}>Horas/mês</th><th className={th}>Mão de obra</th><th className={th}>Materiais</th><th className={th}>Indiretos</th><th className={th}>Custo direto</th><th className={th}>BDI ({pct(r.bdi)})</th><th className={th}>Preço unitário</th><th className={th}>Qtd</th><th className={th}>Total mensal</th></tr>
          </thead>
          <tbody>
            {r.itens.map((i, k) => (
              <tr key={i.item.id}>
                <td className={td}>{k + 1}. {i.item.descricao}</td>
                <td className={td}>{l.planoMap.get(i.item.planoId || '')?.nome || 'horas informadas'}{i.item.fatorTempo !== 1 && ` × ${num(i.item.fatorTempo)}`}{i.item.corretivaPct ? ` + ${num(i.item.corretivaPct, 0)}% corretiva` : ''}</td>
                <td className={tdr}>{num(i.horasUnit)}</td><td className={tdr}>{money(i.custoMO)}</td><td className={tdr}>{money(i.materiais)}</td><td className={tdr}>{money(i.rateio)}</td><td className={tdr}>{money(i.custoDireto)}</td><td className={tdr}>{money(i.precoUnit - i.custoDireto)}</td><td className={tdr + ' font-semibold'}>{money(i.precoUnit)}</td><td className={tdr}>{i.item.quantidade}</td><td className={tdr + ' font-semibold'}>{money(i.totalMensal)}</td>
              </tr>
            ))}
            <tr className="font-bold"><td className={td} colSpan={9}>Preço mensal</td><td className={tdr}>{r.quantidade}</td><td className={tdr}>{money(r.precoMensal)}</td></tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-4 break-inside-avoid">
          <div>
            <h3 className="mb-1 text-[12px] font-bold uppercase">3. Custos indiretos rateados ({e.rateio === 'horas' ? 'pelas horas' : 'por equipamento'})</h3>
            <table className="w-full border-collapse text-[10.5px]">
              <tbody>
                <tr><td className={td}>Deslocamento: {num(e.deslocamento.visitasMes, 0)} visitas × {num(e.deslocamento.minutosVisita, 0)} min + {num(e.deslocamento.kmMes, 0)} km × {money(e.deslocamento.custoKm)}</td><td className={tdr}>{money(r.deslocamentoMensal)}</td></tr>
                {e.custosFixos.filter((c) => c.valorMensal).map((c) => <tr key={c.id}><td className={td}>{c.descricao}</td><td className={tdr}>{money(c.valorMensal)}</td></tr>)}
                <tr className="font-bold"><td className={td}>Total mensal</td><td className={tdr}>{money(r.deslocamentoMensal + r.custosFixosMensal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-1 text-[12px] font-bold uppercase">4. Demonstrativo do BDI</h3>
            <table className="w-full border-collapse text-[10.5px]">
              <tbody>
                <tr><td className={td}>Administração central (AC)</td><td className={tdr}>{pct(e.bdi.ac)}</td></tr>
                <tr><td className={td}>Seguros (S) + garantias (G)</td><td className={tdr}>{pct(e.bdi.s + e.bdi.g)}</td></tr>
                <tr><td className={td}>Riscos (R)</td><td className={tdr}>{pct(e.bdi.r)}</td></tr>
                <tr><td className={td}>Despesas financeiras (DF) — {e.bdi.prazoDias} dias a {pct(e.bdi.taxaMes)} a.m.</td><td className={tdr}>{pct(r.df, 3)}</td></tr>
                <tr><td className={td}>Lucro (L)</td><td className={tdr}>{pct(e.bdi.l)}</td></tr>
                {r.tributos.itens.filter((t) => !t.excluido).map((t) => <tr key={t.nome}><td className={td + ' pl-4'}>{t.nome}</td><td className={tdr}>{pct(t.aliquota, 3)}</td></tr>)}
                <tr><td className={td}>Tributos (I)</td><td className={tdr}>{pct(r.tributos.total, 3)}</td></tr>
                <tr className="font-bold"><td className={td}>BDI = [(1+AC+S+R+G)(1+DF)(1+L)/(1−I)] − 1</td><td className={tdr}>{pct(r.bdi)}</td></tr>
              </tbody>
            </table>
            <p className="mt-1 text-[9.5px] text-slate-600">Fórmula do Acórdão TCU 2622/2013. IRPJ e CSLL não compõem o BDI (Súmula TCU 254).</p>
          </div>
        </div>

        <div className="mt-3 break-inside-avoid rounded border border-slate-400 p-2 text-[11px]">
          <p><b>Preço mensal:</b> {money(r.precoMensal)} · <b>Anual:</b> {money(r.precoAnual)} · <b>Total da vigência ({e.vigenciaMeses} meses):</b> {money(r.precoVigencia)}</p>
          <p className="italic">({valorPorExtenso(r.precoVigencia)})</p>
          {r.tributos.porFora > 0 && <p>Valores sem os tributos calculados por fora ({pct(r.tributos.porFora)}); com eles, o preço mensal é {money(r.precoMensalComPorFora)}.</p>}
          {e.observacoes && <p className="mt-1 whitespace-pre-wrap"><b>Premissas:</b> {e.observacoes}</p>}
        </div>
        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-[11px]">
          <div className="border-t border-slate-500 pt-1">{l.empresa.razaoSocial}<br />Representante legal</div>
          <div className="border-t border-slate-500 pt-1">Responsável pela composição<br />Nome / registro profissional</div>
        </div>
      </PrintPage>
    </div>
  );
}
