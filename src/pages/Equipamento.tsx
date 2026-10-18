import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertOctagon, ClipboardPlus, Pencil, Printer, QrCode, Wind } from 'lucide-react';
import { db } from '../db/db';
import { EntityFormModal } from '../components/crud';
import { Badge, Button, Card, PageHeader, Select, Stat } from '../components/ui';
import { PrintToolbar, QRImage, appUrl } from '../components/widgets';
import { equipamentosCfg } from '../modules/entities';
import { useLookups } from '../lib/lookups';
import { CRITICIDADES, STATUS_EQUIPAMENTO, gwpDe, statusOs } from '../lib/catalogs';
import { diffDays, fmtBtu, fmtDate, fmtTr, money, n2, todayStr } from '../lib/format';
import RotinasEquipamento from '../components/RotinasEquipamento';
import { useSessao } from '../lib/sessao';
import { totais } from '../components/widgets';

export function EquipamentoDetalhe() {
  const { id } = useParams();
  const l = useLookups();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const { pode } = useSessao();
  const eq = l.equipamentoMap.get(id || '');
  const osList = useLiveQuery(() => db.os.toArray(), []) || [];
  const fluidos = useLiveQuery(() => db.fluidos.where('equipamentoId').equals(id || '').toArray(), [id]) || [];
  const ocorrencias = useLiveQuery(() => db.ocorrencias.toArray(), []) || [];
  const historico = useMemo(() => osList.filter((o) => o.equipamentos.some((e) => e.equipamentoId === id)).sort((a, b) => (b.dataAgendada || b.dataAbertura).localeCompare(a.dataAgendada || a.dataAbertura)), [osList, id]);

  if (!l.ready) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (!eq) return <p className="text-sm text-slate-500">Equipamento não encontrado.</p>;

  const plano = l.planoMap.get(eq.planoId || '');
  const amb = l.ambienteMap.get(eq.ambienteId || '');
  const uni = l.unidadeMap.get(eq.unidadeId);
  const corretivas = historico.filter((o) => ['Corretiva', 'Emergencial'].includes(o.tipo) && o.status !== 'cancelada');
  const custo = historico.reduce((a, o) => a + totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total / Math.max(1, o.equipamentos.length), 0);
  // MTBF simples: intervalo médio entre corretivas (dias)
  const datasCorr = corretivas.map((o) => o.dataAbertura.slice(0, 10)).sort();
  const mtbf = datasCorr.length > 1 ? Math.round(datasCorr.slice(1).reduce((a, d, i) => a + (diffDays(d, datasCorr[i]) || 0), 0) / (datasCorr.length - 1)) : null;
  const idade = eq.dataInstalacao ? Math.floor((diffDays(todayStr(), eq.dataInstalacao) || 0) / 365) : null;
  const st = STATUS_EQUIPAMENTO.find((s) => s.value === eq.status);
  const garantiaDias = eq.garantiaAte ? diffDays(eq.garantiaAte, todayStr()) : null;
  const ultimaMed = historico.flatMap((o) => o.equipamentos.filter((e) => e.equipamentoId === eq.id && Object.values(e.medicoes).some(Boolean)).map((e) => ({ o, m: e.medicoes })))[0];

  const info: [string, React.ReactNode][] = [
    ['Unidade', uni?.nome],
    ['Ambiente', amb ? `${amb.nome}${amb.grupo ? ' (' + amb.grupo + ')' : ''}` : '—'],
    ['Marca / modelo', [eq.marca, eq.modelo].filter(Boolean).join(' ') || '—'],
    ['Nº de série', eq.numeroSerie || '—'],
    ['Patrimônio', eq.patrimonio || '—'],
    ['Capacidade', `${fmtBtu(eq.capacidadeBtu)} · ${fmtTr(eq.capacidadeBtu)}`],
    ['Tecnologia', eq.tecnologia || '—'],
    ['Alimentação', [eq.tensao, eq.fases].filter(Boolean).join(' · ') || '—'],
    ['Corrente nominal', eq.correnteNominal ? `${eq.correnteNominal} A` : '—'],
    ['Fluido / carga', eq.fluido ? `${eq.fluido} · ${n2(eq.cargaFluidoKg)} kg (${n2(((eq.cargaFluidoKg || 0) * gwpDe(eq.fluido)) / 1000)} tCO₂e)` : '—'],
    ['Condensadora', [eq.modeloCondensadora, eq.serieCondensadora, eq.localCondensadora].filter(Boolean).join(' · ') || '—'],
    ['Instalação', `${fmtDate(eq.dataInstalacao)}${idade !== null ? ` (${idade} ano(s))` : ''}`],
    ['Garantia', eq.garantiaAte ? `${fmtDate(eq.garantiaAte)}${garantiaDias !== null && garantiaDias < 0 ? ' (expirada)' : ''}` : '—'],
    ['Criticidade', CRITICIDADES.find((c) => c.value === eq.criticidade)?.label],
    ['Centro de custo', eq.centroCusto || '—'],
    ['Plano', plano ? <Link className="text-brand-700 hover:underline dark:text-brand-300" to={`/planos/${plano.id}`}>{plano.nome}</Link> : 'Sem plano'],
  ];

  return (
    <div>
      <PageHeader
        title={`${eq.tag} — ${eq.tipo}`}
        subtitle={<span className="flex items-center gap-2"><Badge className={st?.cor}>{st?.label}</Badge>{uni?.nome} · {amb?.nome}</span>}
        icon={<Wind size={20} />}
        actions={
          <>
            {pode('cadastrar') && <Button variant="outline" icon={<Pencil size={16} />} onClick={() => setEdit(true)}>Editar</Button>}
            <Link to={`/ocorrencias?novo=1`}><Button variant="outline" icon={<AlertOctagon size={16} />}>Ocorrência</Button></Link>
            {pode('gerir_os') && <Button icon={<ClipboardPlus size={16} />} onClick={() => navigate(`/os/nova?equipamentoId=${eq.id}&tipo=Corretiva`)}>Abrir OS</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="OS no histórico" value={historico.length} />
        <Stat label="Corretivas" value={corretivas.length} tone={corretivas.length > 2 ? 'red' : 'slate'} />
        <Stat label="MTBF (corretivas)" value={mtbf !== null ? `${mtbf} dias` : '—'} tone="violet" />
        <Stat label="Custo acumulado" value={money(custo)} tone="green" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ficha técnica" className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="flex gap-2 border-b border-slate-100 pb-1 dark:border-slate-800">
                <dt className="w-36 shrink-0 text-slate-500">{k}</dt>
                <dd className="text-slate-800 dark:text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>
          {eq.observacoes && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{eq.observacoes}</p>}
        </Card>
        <Card title="QR Code do equipamento" actions={<Link to={`/etiquetas?ids=${eq.id}`}><Button size="sm" variant="outline" icon={<Printer size={14} />}>Etiqueta</Button></Link>}>
          <div className="flex flex-col items-center gap-2 text-center">
            <QRImage text={appUrl(`/equipamentos/${eq.id}`)} size={180} />
            <p className="font-mono text-sm font-bold">{eq.tag}</p>
            <p className="text-xs text-slate-500">Cole a etiqueta no equipamento: ao escanear, o técnico abre esta ficha, o histórico e pode abrir uma OS.</p>
          </div>
        </Card>
      </div>

      <RotinasEquipamento eq={eq} />

      {ultimaMed && (
        <Card title={`Últimas medições (${ultimaMed.o.numero} · ${fmtDate(ultimaMed.o.dataAgendada)})`} className="mt-4">
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(ultimaMed.m).filter(([, v]) => v).map(([k, v]) => <Badge key={k}>{k}: {v}</Badge>)}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Histórico de manutenção" bodyClass="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {historico.map((o) => {
              const item = o.equipamentos.find((e) => e.equipamentoId === eq.id)!;
              const nok = item.checklist.filter((c) => c.resultado === 'nok').length;
              return (
                <li key={o.id}>
                  <Link to={`/os/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.numero} · {o.tipo}</p>
                      <p className="truncate text-xs text-slate-500">{fmtDate(o.dataAgendada)} · {o.titulo}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {nok > 0 && <Badge className="bg-rose-100 text-rose-800">{nok} NOK</Badge>}
                      <Badge className={statusOs(o.status).cor}>{statusOs(o.status).label}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
            {historico.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Sem OS registradas.</li>}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Fluido refrigerante" bodyClass="p-0">
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {fluidos.sort((a, b) => b.data.localeCompare(a.data)).map((f) => (
                <li key={f.id} className="flex justify-between px-4 py-2"><span>{fmtDate(f.data)} · {f.operacao}</span><span>{n2(f.quantidadeKg)} kg {f.fluido}</span></li>
              ))}
              {fluidos.length === 0 && <li className="px-4 py-4 text-center text-slate-500">Sem registros.</li>}
            </ul>
          </Card>
          <Card title="Ocorrências" bodyClass="p-0">
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {ocorrencias.filter((o) => o.equipamentoId === eq.id).map((o) => (
                <li key={o.id} className="px-4 py-2"><b>{o.numero}</b> · {o.tipo} · {fmtDate(o.dataHora)}<p className="text-xs text-slate-500">{o.descricao}</p></li>
              ))}
              {!ocorrencias.some((o) => o.equipamentoId === eq.id) && <li className="px-4 py-4 text-center text-slate-500">Sem ocorrências.</li>}
            </ul>
          </Card>
        </div>
      </div>
      <EntityFormModal cfg={equipamentosCfg} initial={eq} open={edit} onClose={() => setEdit(false)} />
    </div>
  );
}

export function Etiquetas() {
  const l = useLookups();
  const [params] = useSearchParams();
  const ids = params.get('ids')?.split(',');
  const [unidade, setUnidade] = useState('');
  const lista = l.equipamentos.filter((e) => (ids ? ids.includes(e.id) : !unidade || e.unidadeId === unidade));
  return (
    <div>
      <PrintToolbar title="Etiquetas QR Code dos equipamentos">
        {!ids && (
          <Select className="w-auto" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Todas as unidades</option>
            {l.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        )}
      </PrintToolbar>
      <p className="mb-3 text-sm text-slate-500 print:hidden"><QrCode size={14} className="inline" /> {lista.length} etiqueta(s). Imprima em papel adesivo (A4); cada etiqueta mede ~6,3 × 3,8 cm.</p>
      <div className="mx-auto grid max-w-[820px] grid-cols-2 gap-2 bg-white p-2 sm:grid-cols-3 print:max-w-none print:grid-cols-3 print:p-0">
        {lista.map((e) => (
          <div key={e.id} className="flex break-inside-avoid items-center gap-2 rounded border border-slate-300 p-2 text-slate-900">
            <QRImage text={appUrl(`/equipamentos/${e.id}`)} size={84} />
            <div className="min-w-0 text-[10px] leading-tight">
              <p className="font-mono text-sm font-black">{e.tag}</p>
              <p className="font-semibold">{e.tipo}</p>
              <p>{[e.marca, e.capacidadeBtu ? `${e.capacidadeBtu / 1000}k BTU` : ''].filter(Boolean).join(' · ')}</p>
              <p className="truncate">{l.ambienteMap.get(e.ambienteId || '')?.nome}</p>
              <p className="truncate text-slate-600">{l.empresa.fantasia || l.empresa.razaoSocial} · {l.empresa.telefone}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
