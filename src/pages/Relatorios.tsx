import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react';
import { db } from '../db/db';
import { Button, Card, Field, Input, PageHeader, Select, Stat } from '../components/ui';
import { BarChart } from '../components/charts';
import { totais } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { addDays, diffDays, diffHours, fmtHoras, money, n2, todayStr } from '../lib/format';
import { gwpDe } from '../lib/catalogs';
import { exportXlsx } from '../lib/excel';
import { horasTrabalhadas } from '../lib/osHelpers';
import { imprimir } from '../lib/env';

export default function Relatorios() {
  const l = useLookups();
  const osAll = useLiveQuery(() => db.os.toArray(), []) || [];
  const fluidos = useLiveQuery(() => db.fluidos.toArray(), []) || [];
  const execucoes = useLiveQuery(() => db.execucoes.toArray(), []) || [];
  const [de, setDe] = useState(addDays(todayStr(), -365));
  const [ate, setAte] = useState(todayStr());
  const [unidade, setUnidade] = useState('');

  const r = useMemo(() => {
    const os = osAll.filter((o) => {
      const d = (o.fim || o.dataAgendada || o.dataAbertura).slice(0, 10);
      return o.status !== 'cancelada' && d >= de && d <= ate && (!unidade || o.unidadeId === unidade);
    });
    const concl = os.filter((o) => o.status === 'concluida' || o.status === 'validada');
    const prev = concl.filter((o) => o.tipo === 'Preventiva');
    const corr = os.filter((o) => ['Corretiva', 'Emergencial'].includes(o.tipo));
    const fat = concl.reduce((a, o) => a + totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total, 0);
    const custoPecas = concl.reduce((a, o) => a + totais(o.pecas, o.servicos).custoPecas, 0);
    const horas = os.reduce((a, o) => a + horasTrabalhadas(o), 0);

    // por técnico
    const tec = l.profissionais.map((p) => {
      const minhas = os.filter((o) => o.responsavelId === p.id || o.tecnicosIds.includes(p.id));
      const h = minhas.reduce((a, o) => a + o.apontamentos.filter((x) => x.profissionalId === p.id).reduce((s, x) => s + Math.max(0, diffHours(x.fim || x.inicio, x.inicio) || 0), 0), 0);
      const aval = minhas.filter((o) => o.avaliacao);
      const ex = execucoes.filter((e) => e.executorId === p.id && e.data >= de && e.data <= ate);
      return { p, os: minhas.length, concl: minhas.filter((o) => o.status === 'concluida' || o.status === 'validada').length, horas: h, custo: h * (p.valorHora || 0), aval: aval.length ? aval.reduce((a, o) => a + (o.avaliacao || 0), 0) / aval.length : null, tarefasE: ex.filter((e) => e.status === 'E').length, tarefasN: ex.filter((e) => e.status === 'N').length };
    }).filter((x) => x.os > 0 || x.tarefasE > 0);

    // por equipamento
    const eqStats = l.equipamentos
      .filter((e) => !unidade || e.unidadeId === unidade)
      .map((e) => {
        const minhas = os.filter((o) => o.equipamentos.some((x) => x.equipamentoId === e.id));
        const corrE = minhas.filter((o) => ['Corretiva', 'Emergencial'].includes(o.tipo));
        const datas = corrE.map((o) => o.dataAbertura.slice(0, 10)).sort();
        const mtbf = datas.length > 1 ? datas.slice(1).reduce((a, d, i) => a + (diffDays(d, datas[i]) || 0), 0) / (datas.length - 1) : null;
        const custo = minhas.reduce((a, o) => a + totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total / Math.max(1, o.equipamentos.length), 0);
        const nok = minhas.reduce((a, o) => a + (o.equipamentos.find((x) => x.equipamentoId === e.id)?.checklist.filter((c) => c.resultado === 'nok').length || 0), 0);
        return { e, total: minhas.length, corretivas: corrE.length, mtbf, custo, nok };
      })
      .sort((a, b) => b.corretivas - a.corretivas || b.custo - a.custo);

    // por unidade
    const uni = l.unidades
      .filter((u) => !unidade || u.id === unidade)
      .map((u) => {
        const minhas = concl.filter((o) => o.unidadeId === u.id);
        return { u, os: minhas.length, prev: minhas.filter((o) => o.tipo === 'Preventiva').length, total: minhas.reduce((a, o) => a + totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total, 0), equip: l.equipamentos.filter((e) => e.unidadeId === u.id).length };
      });

    // peças consumidas
    const pecas: Record<string, { desc: string; qtd: number; un?: string; valor: number }> = {};
    for (const o of concl)
      for (const p of o.pecas) {
        const k = p.pecaId || p.descricao;
        pecas[k] ||= { desc: p.descricao, qtd: 0, un: p.unidade, valor: 0 };
        pecas[k].qtd += p.quantidade;
        pecas[k].valor += p.quantidade * p.custoUnit;
      }
    const fl = fluidos.filter((f) => f.data >= de && f.data <= ate && (!unidade || l.equipamentoMap.get(f.equipamentoId)?.unidadeId === unidade));
    const porFluido: Record<string, { carga: number; rec: number; co2: number }> = {};
    for (const f of fl) {
      porFluido[f.fluido] ||= { carga: 0, rec: 0, co2: 0 };
      if (f.operacao === 'carga') {
        porFluido[f.fluido].carga += f.quantidadeKg;
        porFluido[f.fluido].co2 += (f.quantidadeKg * gwpDe(f.fluido)) / 1000;
      }
      if (f.operacao === 'recolhimento') porFluido[f.fluido].rec += f.quantidadeKg;
    }
    return { os, concl, prev, corr, fat, custoPecas, horas, tec, eqStats, uni, pecas: Object.values(pecas).sort((a, b) => b.valor - a.valor), porFluido };
  }, [osAll, fluidos, execucoes, de, ate, unidade, l]);

  const exportar = () =>
    exportXlsx(
      [
        { name: 'Resumo', headers: ['Indicador', 'Valor'], rows: [['Período', `${de} a ${ate}`], ['OS no período', r.os.length], ['OS concluídas', r.concl.length], ['Preventivas concluídas', r.prev.length], ['Corretivas', r.corr.length], ['Horas trabalhadas', Math.round(r.horas * 10) / 10], ['Faturamento (R$)', r.fat], ['Custo de peças (R$)', r.custoPecas]] },
        { name: 'Técnicos', headers: ['Técnico', 'OS', 'Concluídas', 'Tarefas executadas (E)', 'Não executadas (N)', 'Horas', 'Custo MO (R$)', 'Avaliação média'], rows: r.tec.map((t) => [t.p.nome, t.os, t.concl, t.tarefasE, t.tarefasN, Math.round(t.horas * 10) / 10, t.custo, t.aval ? Math.round(t.aval * 10) / 10 : null]) },
        { name: 'Equipamentos', headers: ['TAG', 'Tipo', 'Unidade', 'Ambiente', 'OS', 'Corretivas', 'MTBF (dias)', 'Itens NOK', 'Custo (R$)'], rows: r.eqStats.map((x) => [x.e.tag, x.e.tipo, l.unidadeMap.get(x.e.unidadeId)?.nome, l.ambienteMap.get(x.e.ambienteId || '')?.nome, x.total, x.corretivas, x.mtbf !== null ? Math.round(x.mtbf) : null, x.nok, Math.round(x.custo * 100) / 100]) },
        { name: 'Unidades', headers: ['Unidade', 'Equipamentos', 'OS concluídas', 'Preventivas', 'Faturamento (R$)'], rows: r.uni.map((x) => [x.u.nome, x.equip, x.os, x.prev, x.total]) },
        { name: 'Peças consumidas', headers: ['Peça', 'Quantidade', 'Unidade', 'Custo (R$)'], rows: r.pecas.map((p) => [p.desc, p.qtd, p.un, p.valor]) },
        { name: 'Fluidos', headers: ['Fluido', 'Carga (kg)', 'Recolhido (kg)', 'tCO2e (cargas)'], rows: Object.entries(r.porFluido).map(([k, v]) => [k, v.carga, v.rec, Math.round(v.co2 * 1000) / 1000]) },
      ],
      `relatorio-gerencial-${de}-a-${ate}.xlsx`,
    );

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500';
  const td = 'px-3 py-2';

  return (
    <div>
      <PageHeader
        title="Relatórios e indicadores"
        subtitle="Indicadores de manutenção (MTBF, MTTR, cumprimento), produtividade, custos e fluidos"
        icon={<BarChart3 size={20} />}
        actions={
          <>
            <Button variant="outline" icon={<Printer size={16} />} onClick={imprimir}>Imprimir</Button>
            <Button icon={<FileSpreadsheet size={16} />} onClick={exportar}>Exportar Excel</Button>
          </>
        }
      />
      <Card className="mb-4 print:hidden" bodyClass="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="De"><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
          <Field label="Até"><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
          <Field label="Unidade" className="min-w-[220px]">
            <Select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas</option>
              {l.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="OS concluídas" value={r.concl.length} hint={`${r.os.length} no período`} />
        <Stat label="Preventivas × corretivas" value={`${r.prev.length} × ${r.corr.length}`} hint={r.prev.length + r.corr.length ? `${Math.round((r.prev.length / (r.prev.length + r.corr.length)) * 100)}% preventivas` : undefined} tone="green" />
        <Stat label="Horas trabalhadas" value={fmtHoras(r.horas)} tone="violet" />
        <Stat label="Faturamento" value={money(r.fat)} hint={`Custo de peças ${money(r.custoPecas)}`} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Horas apontadas por técnico">
          {r.tec.length ? <BarChart horizontal height={Math.max(160, r.tec.length * 44)} labels={r.tec.map((t) => t.p.nome)} series={[{ label: 'Horas', data: r.tec.map((t) => Math.round(t.horas * 10) / 10) }]} yFmt={(v) => `${v} h`} /> : <p className="text-sm text-slate-500">Sem apontamentos no período.</p>}
        </Card>
        <Card title="Produtividade da equipe" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className={th}>Técnico</th><th className={th}>OS</th><th className={th}>Concluídas</th><th className={th}>Tarefas E / N</th><th className={th}>Horas</th><th className={th}>Custo MO</th><th className={th}>Avaliação</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.tec.map((t) => (
                  <tr key={t.p.id}><td className={td}>{t.p.nome}</td><td className={td}>{t.os}</td><td className={td}>{t.concl}</td><td className={td}>{t.tarefasE} / {t.tarefasN}</td><td className={td}>{fmtHoras(t.horas)}</td><td className={td}>{money(t.custo)}</td><td className={td}>{t.aval ? `${n2(t.aval)} ★` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Equipamentos — confiabilidade e custo (ordenado por corretivas)" className="mt-4" bodyClass="p-0">
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr><th className={th}>TAG</th><th className={th}>Equipamento</th><th className={th}>Ambiente</th><th className={th}>OS</th><th className={th}>Corretivas</th><th className={th}>MTBF</th><th className={th}>Itens NOK</th><th className={th}>Custo</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {r.eqStats.map((x) => (
                <tr key={x.e.id}>
                  <td className={td}><Link to={`/equipamentos/${x.e.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">{x.e.tag}</Link></td>
                  <td className={td}>{x.e.tipo} {x.e.marca}</td>
                  <td className={td}>{l.ambienteMap.get(x.e.ambienteId || '')?.nome}</td>
                  <td className={td}>{x.total}</td>
                  <td className={td + (x.corretivas > 1 ? ' font-semibold text-rose-600' : '')}>{x.corretivas}</td>
                  <td className={td}>{x.mtbf !== null ? `${Math.round(x.mtbf)} d` : '—'}</td>
                  <td className={td}>{x.nok}</td>
                  <td className={td}>{money(x.custo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Por unidade" bodyClass="p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className={th}>Unidade</th><th className={th}>Equip.</th><th className={th}>OS</th><th className={th}>Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {r.uni.map((x) => <tr key={x.u.id}><td className={td}>{x.u.nome}</td><td className={td}>{x.equip}</td><td className={td}>{x.os}</td><td className={td}>{money(x.total)}</td></tr>)}
            </tbody>
          </table>
        </Card>
        <Card title="Peças mais consumidas" bodyClass="p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className={th}>Peça</th><th className={th}>Qtd</th><th className={th}>Custo</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {r.pecas.slice(0, 10).map((p) => <tr key={p.desc}><td className={td}>{p.desc}</td><td className={td}>{n2(p.qtd)} {p.un}</td><td className={td}>{money(p.valor)}</td></tr>)}
              {r.pecas.length === 0 && <tr><td className={td} colSpan={3}>Sem consumo no período.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Fluidos refrigerantes" bodyClass="p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className={th}>Fluido</th><th className={th}>Carga</th><th className={th}>Recolhido</th><th className={th}>tCO₂e</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.entries(r.porFluido).map(([k, v]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{n2(v.carga)} kg</td><td className={td}>{n2(v.rec)} kg</td><td className={td}>{n2(v.co2)}</td></tr>)}
              {Object.keys(r.porFluido).length === 0 && <tr><td className={td} colSpan={4}>Sem registros no período.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
