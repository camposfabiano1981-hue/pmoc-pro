import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, Clock, Gauge, Info, LayoutDashboard, Timer, Wind } from 'lucide-react';
import { db } from '../db/db';
import { Badge, Card, PageHeader, Stat, cx } from '../components/ui';
import { BarChart, LineChart } from '../components/charts';
import { useLookups } from '../lib/lookups';
import { alertas, abertas, cumprimentoAcumulado, cumprimentoMensal, mttrHoras, seriesMensais, slaCumprido, ultimosMeses } from '../lib/metrics';
import { fmtDate, fmtTr, money, todayStr } from '../lib/format';
import { prioridade, statusOs } from '../lib/catalogs';
import { isAtrasada } from '../lib/osHelpers';

export default function Dashboard() {
  const l = useLookups();
  const osList = useLiveQuery(() => db.os.toArray(), []);
  const ocorrencias = useLiveQuery(() => db.ocorrencias.toArray(), []) || [];
  const analises = useLiveQuery(() => db.analisesAr.toArray(), []) || [];
  const rotinas = useLiveQuery(() => db.rotinas.toArray(), []) || [];
  const execucoes = useLiveQuery(() => db.execucoes.toArray(), []) || [];
  const meses = useMemo(() => ultimosMeses(12), []);

  const d = useMemo(() => {
    if (!osList) return null;
    const hoje = todayStr();
    const ab = abertas(osList);
    const s = seriesMensais(osList, meses);
    const cump = cumprimentoMensal(execucoes, rotinas, meses);
    return {
      abertas: ab,
      atrasadas: ab.filter((o) => isAtrasada(o, hoje)),
      hoje: ab.filter((o) => o.dataAgendada === hoje),
      emExec: ab.filter((o) => o.status === 'em_execucao'),
      series: s,
      cump,
      cumpAtual: cumprimentoAcumulado(execucoes, rotinas, meses),
      rotinasVencidas: rotinas.filter((r) => r.ativa && r.proximaExecucao < hoje).length,
      rotinasAtivas: rotinas.filter((r) => r.ativa).length,
      mttr: mttrHoras(osList),
      sla: slaCumprido(osList),
      alertas: alertas(l, osList, ocorrencias, analises, rotinas),
      proximas: ab.filter((o) => (o.dataAgendada || '') >= hoje).sort((a, b) => (a.dataAgendada || '').localeCompare(b.dataAgendada || '')).slice(0, 8),
    };
  }, [osList, ocorrencias, analises, rotinas, execucoes, l, meses]);

  if (!d) return <p className="text-sm text-slate-500">Carregando…</p>;
  const capTotal = l.equipamentos.filter((e) => e.status !== 'desativado').reduce((a, e) => a + (e.capacidadeBtu || 0), 0);
  const operando = l.equipamentos.filter((e) => e.status === 'operando').length;
  const disponibilidade = l.equipamentos.length ? Math.round((operando / l.equipamentos.filter((e) => e.status !== 'desativado').length) * 100) : 100;
  const icon = { critico: <AlertCircle size={16} className="text-rose-600" />, atencao: <AlertTriangle size={16} className="text-amber-500" />, info: <Info size={16} className="text-sky-500" /> };

  return (
    <div>
      <PageHeader title="Painel de controle" subtitle={`${l.empresa.fantasia || l.empresa.razaoSocial} · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`} icon={<LayoutDashboard size={20} />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Link to="/os"><Stat label="OS em aberto" value={d.abertas.length} hint={`${d.emExec.length} em execução · ${d.hoje.length} hoje`} icon={<ClipboardList size={18} />} /></Link>
        <Link to="/os?status=atrasadas"><Stat label="OS atrasadas" value={d.atrasadas.length} tone={d.atrasadas.length ? 'red' : 'green'} icon={<Clock size={18} />} hint="Prazo/SLA vencido" /></Link>
        <Link to="/cronograma"><Stat label="Cumprimento PMOC" value={d.cumpAtual !== null ? `${d.cumpAtual}%` : '—'} tone={d.cumpAtual === null || d.cumpAtual >= 90 ? 'green' : d.cumpAtual >= 70 ? 'amber' : 'red'} icon={<CheckCircle2 size={18} />} hint={`Meses encerrados · ${d.rotinasVencidas} de ${d.rotinasAtivas} rotinas vencidas`} /></Link>
        <Stat label="MTTR corretivas" value={d.mttr !== null ? `${Math.round(d.mttr)} h` : '—'} tone="violet" icon={<Timer size={18} />} hint={`SLA cumprido: ${d.sla !== null ? d.sla + '%' : '—'}`} />
        <Link to="/equipamentos"><Stat label="Equipamentos" value={l.equipamentos.length} hint={`${fmtTr(capTotal)} instalados`} icon={<Wind size={18} />} tone="brand" /></Link>
        <Stat label="Disponibilidade" value={`${disponibilidade}%`} hint={`${operando} operando`} icon={<Gauge size={18} />} tone={disponibilidade >= 95 ? 'green' : 'amber'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="OS por mês — preventivas concluídas × corretivas abertas" className="xl:col-span-2">
          <BarChart labels={meses.map((m) => m.label)} series={[{ label: 'Preventivas', data: d.series.preventivas }, { label: 'Corretivas', data: d.series.corretivas }]} />
        </Card>
        <Card title={`Alertas e pendências (${d.alertas.length})`} bodyClass="p-0">
          <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {d.alertas.map((a, i) => (
              <li key={i}>
                <Link to={a.link} className="flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className="mt-0.5 shrink-0">{icon[a.nivel]}</span>
                  <span className="text-slate-700 dark:text-slate-200">{a.texto}</span>
                </Link>
              </li>
            ))}
            {d.alertas.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Tudo em dia. Nenhum alerta.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cumprimento das rotinas por equipamento (%) — mês corrente parcial">
          <LineChart labels={meses.map((m) => m.label)} series={[{ label: 'Cumprimento', data: d.cump }]} yFmt={(v) => `${v}%`} yMax={100} />
        </Card>
        <Card title="Faturamento das OS concluídas">
          <BarChart labels={meses.map((m) => m.label)} series={[{ label: 'Faturamento', data: d.series.faturamento }]} yFmt={(v) => money(v).replace(',00', '')} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Próximas OS agendadas" bodyClass="p-0" actions={<Link to="/agenda" className="text-xs text-brand-700 hover:underline dark:text-brand-300">Ver agenda</Link>}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.proximas.map((o) => (
              <li key={o.id}>
                <Link to={`/os/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.numero} · {o.titulo}</p>
                    <p className="text-xs text-slate-500">{fmtDate(o.dataAgendada)} · {l.profissionalMap.get(o.responsavelId || '')?.nome || 'sem responsável'}</p>
                  </div>
                  <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge>
                </Link>
              </li>
            ))}
            {d.proximas.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma OS futura.</li>}
          </ul>
        </Card>
        <Card title="OS atrasadas" bodyClass="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.atrasadas.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link to={`/os/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.numero} · {o.titulo}</p>
                    <p className="text-xs text-rose-600">Prazo {fmtDate(o.prazo || o.dataAgendada)}</p>
                  </div>
                  <Badge className={cx(prioridade(o.prioridade).cor)}>{prioridade(o.prioridade).label}</Badge>
                </Link>
              </li>
            ))}
            {d.atrasadas.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma OS atrasada.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
