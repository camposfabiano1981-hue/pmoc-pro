import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Briefcase, CalendarClock, FileSignature, Receipt, Target, TrendingUp } from 'lucide-react';
import { db } from '../db/db';
import { Badge, Card, PageHeader, Stat } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { addDays, diffDays, fmtDate, money, todayStr } from '../lib/format';
import { STATUS_ORCAMENTO } from '../lib/catalogs';
import { totais } from '../components/widgets';
import { FunilOportunidades, SessaoBadge, etapaOportunidade } from '../modules/comercial';

/** Visão geral do comercial: funil, próximas sessões, carteira de contratos, renovações e orçamentos. */
export default function PainelComercial() {
  const l = useLookups();
  const ops = useLiveQuery(() => db.oportunidades.toArray(), []) || [];
  const orcamentos = useLiveQuery(() => db.orcamentos.toArray(), []) || [];
  const hoje = todayStr();
  const abertas = ops.filter((o) => etapaOportunidade(o.etapa).aberta);
  const proximas = abertas.filter((o) => o.dataSessao && o.dataSessao.slice(0, 10) >= hoje).sort((a, b) => (a.dataSessao || '').localeCompare(b.dataSessao || ''));
  const semana = proximas.filter((o) => (o.dataSessao || '').slice(0, 10) <= addDays(hoje, 7));
  const ativos = l.contratos.filter((c) => c.status === 'ativo');
  const mrr = ativos.reduce((a, c) => a + (c.valorMensal || 0), 0);
  const aVencer = ativos.filter((c) => c.fim && c.fim >= hoje && c.fim <= addDays(hoje, 90)).sort((a, b) => a.fim.localeCompare(b.fim));
  const reajustes = ativos
    .map((c) => {
      if (!c.inicio) return null;
      const [y, m, d] = c.inicio.split('-').map(Number);
      let ano = Number(hoje.slice(0, 4));
      let aniv = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (aniv < hoje) {
        ano++;
        aniv = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      return ano > y && aniv <= addDays(hoje, 60) ? { c, aniv } : null;
    })
    .filter((x): x is { c: (typeof ativos)[number]; aniv: string } => !!x)
    .sort((a, b) => a.aniv.localeCompare(b.aniv));
  const orcAbertos = orcamentos.filter((o) => o.status === 'enviado' || o.status === 'rascunho');
  const valorOrc = orcAbertos.reduce((a, o) => a + totais(o.pecas || [], o.servicos || [], o.deslocamento, o.desconto).total, 0);

  return (
    <div>
      <PageHeader title="Painel comercial" subtitle="Funil de licitações e propostas, carteira de contratos, renovações e orçamentos" icon={<Briefcase size={20} />} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/oportunidades"><Stat label="Oportunidades em andamento" value={abertas.length} hint={money(abertas.reduce((a, o) => a + (o.valorEstimado || 0), 0)) + ' estimados'} icon={<Target size={18} />} /></Link>
        <Stat label="Sessões em 7 dias" value={semana.length} tone={semana.length ? 'amber' : 'slate'} icon={<CalendarClock size={18} />} hint={proximas[0] ? `Próxima: ${fmtDate(proximas[0].dataSessao)}` : 'Nenhuma sessão agendada'} />
        <Link to="/contratos"><Stat label="Receita mensal contratada" value={money(mrr)} tone="green" icon={<TrendingUp size={18} />} hint={`${ativos.length} contrato(s) ativo(s) · ${money(mrr * 12)}/ano`} /></Link>
        <Link to="/orcamentos"><Stat label="Orçamentos em aberto" value={orcAbertos.length} tone="violet" icon={<Receipt size={18} />} hint={money(valorOrc)} /></Link>
      </div>

      <FunilOportunidades rows={ops} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Próximas sessões públicas" actions={<Link to="/oportunidades" className="text-xs text-brand-700 hover:underline dark:text-brand-300">ver todas</Link>}>
          {proximas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma sessão futura. Cadastre os editais em Oportunidades e licitações.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {proximas.slice(0, 8).map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{o.titulo}</span>
                    <span className="block text-xs text-slate-500">{[l.clienteMap.get(o.clienteId || '')?.nome || o.orgao, o.modalidade, o.numeroEdital && `nº ${o.numeroEdital}`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-xs"><SessaoBadge data={o.dataSessao} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Contratos a vencer (90 dias)" actions={<Link to="/contratos" className="text-xs text-brand-700 hover:underline dark:text-brand-300">contratos</Link>}>
          {aVencer.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum contrato vence nos próximos 90 dias.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {aVencer.map((c) => {
                const d = diffDays(c.fim, hoje) ?? 0;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs font-semibold">{c.numero}</span> {l.clienteMap.get(c.clienteId)?.nome}
                      <span className="block text-xs text-slate-500">{money(c.valorMensal)}/mês · término {fmtDate(c.fim)}</span>
                    </span>
                    <Badge className={d <= 30 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}>{d} dias</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">Prorrogação: contratos públicos de serviço contínuo podem ser prorrogados até 10 anos, se as condições continuarem vantajosas (Lei 14.133, art. 107).</p>
        </Card>
        <Card title="Aniversários para reajuste (60 dias)">
          {reajustes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum contrato completa ano nos próximos 60 dias.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {reajustes.map(({ c, aniv }) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono text-xs font-semibold">{c.numero}</span> {l.clienteMap.get(c.clienteId)?.nome}
                    <span className="block text-xs text-slate-500">Índice: {c.reajusteIndice || 'IPCA/IBGE'} · {money(c.valorMensal)}/mês</span>
                  </span>
                  <Badge>{fmtDate(aniv)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Orçamentos aguardando resposta" actions={<Link to="/orcamentos" className="text-xs text-brand-700 hover:underline dark:text-brand-300">orçamentos</Link>}>
          {orcAbertos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum orçamento em aberto.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {orcAbertos.slice(0, 8).map((o) => {
                const st = STATUS_ORCAMENTO.find((s) => s.value === o.status);
                return (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs font-semibold">{o.numero}</span> {o.titulo}
                      <span className="block text-xs text-slate-500">{l.clienteMap.get(o.clienteId || '')?.nome} · validade {fmtDate(o.validade)}</span>
                    </span>
                    <span className="text-right text-xs">
                      <b>{money(totais(o.pecas || [], o.servicos || [], o.deslocamento, o.desconto).total)}</b>
                      <Badge className={'ml-1 ' + (st?.cor || '')}>{st?.label}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><FileSignature size={12} /> Aprovou? Converta o orçamento em OS ou gere o contrato a partir da oportunidade ganha.</p>
        </Card>
      </div>
    </div>
  );
}
