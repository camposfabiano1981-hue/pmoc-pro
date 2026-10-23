import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Info, Plus, Printer, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { db, nowIso, uid } from '../../db/db';
import type { CargoPreco, EstudoPreco, ItemEstudo, ParametrosPreco } from '../../db/types';
import { Badge, Button, Card, Field, IconButton, Input, Modal, PageHeader, Select, Tabs, Textarea, cx, useToast } from '../../components/ui';
import { FarolBadge, Num, num, pct } from '../../components/precoUi';
import { useLookups, type Lookups } from '../../lib/lookups';
import { money, todayStr } from '../../lib/format';
import { valorPorExtenso } from '../../lib/extenso';
import { FAIXAS_BDI, calcularEstudo, custoCargo, faixaBtu, farol, fatorHistorico, horasPlanoMes, type ResultadoEstudo } from '../../lib/precificacao';
import { useParametrosPreco } from '../../lib/precificacaoDb';
import { planoSugerido } from '../../db/planosPadrao';
import { STATUS_ESTUDO, statusEstudo } from './Estudos';

type Aba = 'dados' | 'equipe' | 'itens' | 'indiretos' | 'bdi' | 'resultado';
type Upd = (patch: Partial<EstudoPreco>) => void;

export default function EstudoEditor() {
  const { id } = useParams();
  const l = useLookups();
  const params = useParametrosPreco();
  const cargos = useLiveQuery(() => db.cargosPreco.toArray(), []) || [];
  const [e, setE] = useState<EstudoPreco | null | undefined>(undefined);
  const [aba, setAba] = useState<Aba>('itens');
  const [dirty, setDirty] = useState(0);
  const [salvo, setSalvo] = useState(true);
  const rRef = useRef<ResultadoEstudo | null>(null);

  useEffect(() => {
    db.estudos.get(id!).then((x) => {
      setE(x || null);
      if (x && !x.itens.length) setAba('itens');
    });
  }, [id]);

  const ctx = useMemo(() => (params ? { params, cargos: new Map(cargos.map((c) => [c.id, c])), planos: l.planoMap } : null), [params, cargos, l.planoMap]);
  const r = useMemo(() => (e && ctx ? calcularEstudo(e, ctx) : null), [e, ctx]);
  rRef.current = r;

  useEffect(() => {
    if (!dirty || !e) return;
    setSalvo(false);
    const t = setTimeout(async () => {
      const res = rRef.current;
      const rec: EstudoPreco = {
        ...e,
        updatedAt: nowIso(),
        tributosBase: res ? { data: todayStr(), regime: res.tributos.regime, itens: res.tributos.itens.filter((i) => !i.excluido).map((i) => ({ nome: i.nome, aliquota: i.aliquota })), total: res.tributos.total, porFora: res.tributos.porFora } : e.tributosBase,
      };
      await db.estudos.put(rec);
      if (e.oportunidadeId && res) await db.oportunidades.update(e.oportunidadeId, { valorProposta: res.precoVigencia, vigenciaMeses: e.vigenciaMeses, updatedAt: nowIso() });
      setSalvo(true);
    }, 600);
    return () => clearTimeout(t);
  }, [dirty, e]);

  const upd: Upd = (patch) => {
    setE((x) => (x ? { ...x, ...patch } : x));
    setDirty((d) => d + 1);
  };

  if (e === undefined || !params || !r) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (e === null) return <p className="text-sm text-slate-500">Estudo não encontrado.</p>;
  const st = statusEstudo(e.status);

  return (
    <div>
      <PageHeader
        title={`${e.numero} — ${e.titulo}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge className={st.cor}>{st.label}</Badge>
            {l.clienteMap.get(e.clienteId || '')?.nome || e.orgao}
            <span className="text-xs text-slate-500">{salvo ? 'Salvo automaticamente' : 'Salvando…'}</span>
          </span>
        }
        icon={<Calculator size={20} />}
        actions={
          <>
            <Link to="/precificacao"><Button variant="outline" icon={<ArrowLeft size={16} />}>Estudos</Button></Link>
            <Link to={`/precificacao/${e.id}/imprimir`}><Button icon={<Printer size={16} />}>Composição de preços</Button></Link>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Tabs<Aba>
            value={aba}
            onChange={setAba}
            tabs={[
              { value: 'dados', label: '1. Dados' },
              { value: 'equipe', label: '2. Equipe' },
              { value: 'itens', label: `3. Equipamentos (${r.quantidade})` },
              { value: 'indiretos', label: '4. Custos indiretos' },
              { value: 'bdi', label: '5. BDI e tributos' },
              { value: 'resultado', label: '6. Resultado' },
            ]}
          />
          <div className="mt-4">
            {aba === 'dados' && <AbaDados e={e} upd={upd} l={l} />}
            {aba === 'equipe' && <AbaEquipe e={e} upd={upd} cargos={cargos} params={params} r={r} />}
            {aba === 'itens' && <AbaItens e={e} upd={upd} r={r} params={params} l={l} />}
            {aba === 'indiretos' && <AbaIndiretos e={e} upd={upd} r={r} params={params} />}
            {aba === 'bdi' && <AbaBdi e={e} upd={upd} r={r} params={params} />}
            {aba === 'resultado' && <AbaResultado e={e} upd={upd} r={r} />}
          </div>
        </div>
        <Resumo e={e} r={r} />
      </div>
    </div>
  );
}

/* ---------------- Resumo lateral ---------------- */
function Resumo({ e, r }: { e: EstudoPreco; r: ResultadoEstudo }) {
  const c = r.comparacao;
  const linha = (k: string, v: string, forte?: boolean) => (
    <div className={cx('flex justify-between gap-2 py-1', forte && 'font-semibold')}>
      <span className="text-slate-500">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
  return (
    <div className="xl:sticky xl:top-20 xl:self-start">
      <Card title="Resumo do preço" bodyClass="p-4 text-sm">
        {linha('Custo-hora da equipe', money(r.custoHoraEquipe))}
        {linha('Horas técnicas/mês', `${num(r.horasMes, 1)} h`)}
        {linha('Custo direto/mês', money(r.custoDiretoMensal))}
        {linha('BDI', pct(r.bdi))}
        <div className="my-2 rounded-lg bg-brand-50 p-3 dark:bg-brand-950/50">
          <p className="text-xs text-slate-500">Preço mensal</p>
          <p className="text-2xl font-bold text-brand-800 dark:text-brand-200">{money(r.precoMensal)}</p>
        </div>
        {linha('Anual (12 meses)', money(r.precoAnual))}
        {linha(`Vigência (${e.vigenciaMeses} meses)`, money(r.precoVigencia), true)}
        {linha('Lance mínimo (lucro zero)/mês', money(r.lanceMinimoMensal))}
        {r.tributos.porFora > 0 && linha(`Com tributos por fora (${pct(r.tributos.porFora)})`, money(r.precoMensalComPorFora))}
        {c && (
          <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            {linha('Valor estimado/mês', money(e.valorEstimadoMensal))}
            <p className={cx('mt-1 text-center text-lg font-bold', c.alertas.some((a) => a.nivel === 'critico') ? 'text-rose-600' : c.alertas.some((a) => a.nivel === 'atencao') ? 'text-amber-600' : 'text-emerald-600')}>
              {pct(c.pct, 1)} do estimado
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- 1. Dados ---------------- */
function AbaDados({ e, upd, l }: { e: EstudoPreco; upd: Upd; l: Lookups }) {
  const oportunidades = useLiveQuery(() => db.oportunidades.toArray(), []) || [];
  const vig = Math.max(1, e.vigenciaMeses || 12);
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Título do estudo" className="sm:col-span-3"><Input value={e.titulo} onChange={(x) => upd({ titulo: x.target.value })} /></Field>
        <Field label="Situação">
          <Select value={e.status} onChange={(x) => upd({ status: x.target.value as EstudoPreco['status'] })}>
            {STATUS_ESTUDO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Cliente" className="sm:col-span-2">
          <Select value={e.clienteId || ''} onChange={(x) => upd({ clienteId: x.target.value || undefined })}>
            <option value="">— órgão/empresa não cadastrado —</option>
            {l.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Órgão / empresa (texto)" className="sm:col-span-2"><Input value={e.orgao || ''} onChange={(x) => upd({ orgao: x.target.value })} /></Field>
        <Field label="Oportunidade / licitação vinculada" className="sm:col-span-2" help="O valor total da proposta é enviado para a oportunidade">
          <Select
            value={e.oportunidadeId || ''}
            onChange={async (x) => {
              const op = oportunidades.find((o) => o.id === x.target.value);
              upd({ oportunidadeId: op?.id });
              if (op) await db.oportunidades.update(op.id, { estudoId: e.id, updatedAt: nowIso() });
            }}
          >
            <option value="">— nenhuma —</option>
            {oportunidades.map((o) => <option key={o.id} value={o.id}>{o.numero} · {o.titulo}</option>)}
          </Select>
        </Field>
        <Field label="Natureza do serviço" className="sm:col-span-2" help="Define os limites de exequibilidade (75%/85% para engenharia; 50% para serviço comum)">
          <Select value={e.tipoServico} onChange={(x) => upd({ tipoServico: x.target.value as EstudoPreco['tipoServico'] })}>
            <option value="engenharia">Serviço comum de engenharia (Lei 14.133, art. 59, §§4º e 5º)</option>
            <option value="comum">Serviço comum (IN SEGES/ME 73/2022, art. 34)</option>
          </Select>
        </Field>
        <Num label="Vigência" suffix="meses" value={e.vigenciaMeses} onChange={(v) => upd({ vigenciaMeses: Math.max(1, Math.round(v || 12)) })} />
        <Num label="Valor estimado do órgão — mensal" prefix="R$" value={e.valorEstimadoMensal} onChange={(v) => upd({ valorEstimadoMensal: v })} />
        <Num label={`Valor estimado — total (${vig} meses)`} prefix="R$" value={e.valorEstimadoMensal ? Math.round(e.valorEstimadoMensal * vig * 100) / 100 : undefined} onChange={(v) => upd({ valorEstimadoMensal: v ? Math.round((v / vig) * 100) / 100 : undefined })} className="sm:col-span-2" help="Informe o total do edital e o mensal é calculado" />
        <Field label="Observações / premissas" className="sm:col-span-4"><Textarea rows={3} value={e.observacoes || ''} onChange={(x) => upd({ observacoes: x.target.value })} /></Field>
      </div>
    </Card>
  );
}

/* ---------------- 2. Equipe ---------------- */
function AbaEquipe({ e, upd, cargos, params, r }: { e: EstudoPreco; upd: Upd; cargos: CargoPreco[]; params: ParametrosPreco; r: ResultadoEstudo }) {
  const ativos = cargos.filter((c) => c.ativo);
  const set = (i: number, patch: Partial<EstudoPreco['equipe'][number]>) => upd({ equipe: e.equipe.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  return (
    <Card title="Equipe que executa as rotinas" actions={<Link to="/precificacao/equipe" className="text-xs text-brand-700 hover:underline dark:text-brand-300">cadastrar cargos e salários</Link>}>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Os tempos dos planos de manutenção são da equipe trabalhando junta (ex.: técnico + ajudante). O custo-hora da equipe é a soma dos custos-hora dos integrantes.</p>
      {!ativos.length && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Nenhum cargo cadastrado. Cadastre em <Link to="/precificacao/equipe" className="font-semibold underline">Equipe e custo-hora</Link>.</p>}
      <div className="space-y-2">
        {e.equipe.map((m, i) => {
          const c = cargos.find((x) => x.id === m.cargoId);
          const ch = c ? custoCargo(c, params).custoHora : 0;
          return (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <Field label="Cargo" className="min-w-[220px] flex-1">
                <Select value={m.cargoId} onChange={(x) => set(i, { cargoId: x.target.value })}>
                  <option value="">— selecione —</option>
                  {ativos.map((c2) => <option key={c2.id} value={c2.id}>{c2.nome}</option>)}
                </Select>
              </Field>
              <Num label="Quantidade" className="w-28" value={m.quantidade} onChange={(v) => set(i, { quantidade: v ?? 0 })} />
              <div className="w-32 pb-2 text-right text-sm">
                <span className="block text-xs text-slate-500">custo-hora</span>
                <b className="tabular-nums">{money(ch)}</b>
              </div>
              <div className="w-32 pb-2 text-right text-sm">
                <span className="block text-xs text-slate-500">subtotal/h</span>
                <b className="tabular-nums">{money(ch * (m.quantidade || 0))}</b>
              </div>
              <IconButton title="Remover" onClick={() => upd({ equipe: e.equipe.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton>
              {c && !c.salarioBase && <p className="w-full text-xs text-amber-700">Informe o salário-base deste cargo para calcular o custo.</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => upd({ equipe: [...e.equipe, { cargoId: ativos[0]?.id || '', quantidade: 1 }] })}>Adicionar integrante</Button>
        <span className="rounded-lg bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950/50">Custo-hora da equipe: <b className="text-lg">{money(r.custoHoraEquipe)}</b></span>
      </div>
    </Card>
  );
}

/* ---------------- 3. Equipamentos ---------------- */
function AbaItens({ e, upd, r, params, l }: { e: EstudoPreco; upd: Upd; r: ResultadoEstudo; params: ParametrosPreco; l: Lookups }) {
  const [gerar, setGerar] = useState(false);
  const tarefas = useLiveQuery(() => db.os.toArray().then((os) => os.flatMap((o) => o.equipamentos.flatMap((it) => it.checklist))), []) || [];
  const hist = fatorHistorico(tarefas);
  const set = (i: number, patch: Partial<ItemEstudo>) => upd({ itens: e.itens.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const novoItem = (): ItemEstudo => ({ id: uid(), descricao: '', planoId: l.planos[0]?.id, fatorTempo: 1, corretivaPct: 10, materiaisMes: params.materiaisPadraoMes, quantidade: 1 });
  return (
    <div className="space-y-3">
      <Card bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Wand2 size={16} />} onClick={() => setGerar(true)}>Gerar dos equipamentos cadastrados</Button>
          <Button variant="outline" icon={<Plus size={16} />} onClick={() => upd({ itens: [...e.itens, novoItem()] })}>Adicionar item</Button>
          <span className="flex-1" />
          {hist && (
            <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Info size={14} /> Nas OS lançadas, o tempo real foi <b>{pct(hist.fator * 100, 0)}</b> do previsto ({hist.n} tarefas).
              <Button size="sm" variant="ghost" onClick={() => upd({ itens: e.itens.map((it) => ({ ...it, fatorTempo: Math.round(it.fatorTempo * hist.fator * 100) / 100 })) })}>Aplicar aos fatores</Button>
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Horas/mês por equipamento = Σ (tempo da rotina × execuções no ano) ÷ 12, pelo plano do PMOC, × fator de porte/acesso + reserva de corretiva. Deixe “horas/mês” em branco para usar o plano ou informe um valor para substituir.
        </p>
      </Card>
      {e.itens.length === 0 ? (
        <Card><p className="text-sm text-slate-500">Nenhum equipamento no estudo. Gere a partir do cadastro do cliente ou adicione itens (ex.: “Split hi-wall até 12.000 BTU/h — 80 un.”).</p></Card>
      ) : (
        <Card bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-2 py-2">Item / descrição</th>
                  <th className="px-2 py-2">Plano de manutenção</th>
                  <th className="px-2 py-2 text-right">Horas/mês</th>
                  <th className="px-2 py-2 text-right">Fator</th>
                  <th className="px-2 py-2 text-right">Corretiva</th>
                  <th className="px-2 py-2 text-right">Materiais/mês</th>
                  <th className="px-2 py-2 text-right">Qtd</th>
                  <th className="px-2 py-2 text-right">Horas totais</th>
                  <th className="px-2 py-2 text-right">Preço unit./mês</th>
                  <th className="px-2 py-2 text-right">Total/mês</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {e.itens.map((it, i) => {
                  const res = r.itens[i];
                  const doPlano = horasPlanoMes(l.planoMap.get(it.planoId || ''));
                  return (
                    <tr key={it.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="px-2 py-1.5"><Input className="min-w-[220px]" value={it.descricao} placeholder="Ex.: Split hi-wall até 12.000 BTU/h" onChange={(x) => set(i, { descricao: x.target.value })} /></td>
                      <td className="px-2 py-1.5">
                        <Select className="min-w-[200px]" value={it.planoId || ''} onChange={(x) => set(i, { planoId: x.target.value || undefined })}>
                          <option value="">— sem plano (horas manuais) —</option>
                          {l.planos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({num(horasPlanoMes(p))} h/mês)</option>)}
                        </Select>
                      </td>
                      <td className="px-2 py-1.5"><Num className="w-24" value={it.horasManual} placeholder={num(doPlano)} onChange={(v) => set(i, { horasManual: v })} /></td>
                      <td className="px-2 py-1.5"><Num className="w-20" value={it.fatorTempo} onChange={(v) => set(i, { fatorTempo: v ?? 1 })} /></td>
                      <td className="px-2 py-1.5"><Num className="w-20" suffix="%" value={it.corretivaPct} onChange={(v) => set(i, { corretivaPct: v ?? 0 })} /></td>
                      <td className="px-2 py-1.5"><Num className="w-28" prefix="R$" value={it.materiaisMes} onChange={(v) => set(i, { materiaisMes: v ?? 0 })} /></td>
                      <td className="px-2 py-1.5"><Num className="w-20" value={it.quantidade} onChange={(v) => set(i, { quantidade: Math.max(0, Math.round(v ?? 0)) })} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{res ? num(res.horasUnit) : '—'}<span className="block text-[11px] text-slate-500">h/equip.</span></td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{res ? money(res.precoUnit) : '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{res ? money(res.totalMensal) : '—'}</td>
                      <td className="px-2 py-1.5"><IconButton title="Remover item" onClick={() => upd({ itens: e.itens.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold dark:border-slate-700">
                  <td className="px-2 py-2" colSpan={6}>Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.quantidade}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(r.horasMes, 1)} h</td>
                  <td />
                  <td className="px-2 py-2 text-right tabular-nums">{money(r.precoMensal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
      <GerarItensModal open={gerar} onClose={() => setGerar(false)} e={e} upd={upd} params={params} l={l} />
    </div>
  );
}

function GerarItensModal({ open, onClose, e, upd, params, l }: { open: boolean; onClose: () => void; e: EstudoPreco; upd: Upd; params: ParametrosPreco; l: Lookups }) {
  const toast = useToast();
  const [clienteId, setClienteId] = useState(e.clienteId || '');
  const [unidades, setUnidades] = useState<Set<string>>(new Set());
  const [substituir, setSubstituir] = useState(e.itens.length === 0);
  useEffect(() => {
    if (open) {
      setClienteId(e.clienteId || l.clientes[0]?.id || '');
      setUnidades(new Set());
      setSubstituir(e.itens.length === 0);
    }
  }, [open, e.clienteId, e.itens.length, l.clientes]);
  const unidadesCliente = l.unidades.filter((u) => u.clienteId === clienteId);
  const alvo = new Set(unidades.size ? [...unidades] : unidadesCliente.map((u) => u.id));
  const equips = l.equipamentos.filter((x) => alvo.has(x.unidadeId) && x.status !== 'desativado');
  const grupos = useMemo(() => {
    const m = new Map<string, { tipo: string; faixa?: ReturnType<typeof faixaBtu>; planos: string[]; qtd: number }>();
    for (const x of equips) {
      const f = faixaBtu(x.capacidadeBtu);
      const k = `${x.tipo}|${f?.id || '-'}`;
      const g = m.get(k) || { tipo: x.tipo, faixa: f, planos: [], qtd: 0 };
      g.qtd++;
      if (x.planoId) g.planos.push(x.planoId);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || (a.faixa?.max || 0) - (b.faixa?.max || 0));
  }, [equips]);
  const moda = (arr: string[]) => [...arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
  const adicionar = () => {
    const itens: ItemEstudo[] = grupos.map((g) => ({
      id: uid(),
      descricao: `${g.tipo}${g.faixa ? ` — ${g.faixa.label}` : ''}`,
      tipoEquip: g.tipo,
      faixa: g.faixa?.id,
      planoId: moda(g.planos) || planoSugerido(g.tipo, l.planos)?.id,
      fatorTempo: g.faixa?.fator ?? 1,
      corretivaPct: 10,
      materiaisMes: params.materiaisPadraoMes,
      quantidade: g.qtd,
    }));
    upd({ itens: substituir ? itens : [...e.itens, ...itens], clienteId: e.clienteId || clienteId || undefined });
    toast(`${itens.length} item(ns) com ${equips.length} equipamento(s) adicionados.`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Gerar itens a partir dos equipamentos cadastrados" footer={<Button icon={<Wand2 size={16} />} disabled={!grupos.length} onClick={adicionar}>Adicionar {grupos.length} item(ns)</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente">
          <Select value={clienteId} onChange={(x) => { setClienteId(x.target.value); setUnidades(new Set()); }}>
            {l.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Unidades (nenhuma marcada = todas)">
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
            {unidadesCliente.map((u) => (
              <label key={u.id} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={unidades.has(u.id)} onChange={(x) => setUnidades((s) => { const n = new Set(s); if (x.target.checked) n.add(u.id); else n.delete(u.id); return n; })} />
                {u.nome}
              </label>
            ))}
            {!unidadesCliente.length && <span className="text-slate-500">Cliente sem unidades.</span>}
          </div>
        </Field>
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Agrupados por tipo e faixa de capacidade ({equips.length} equipamentos). O fator de porte sugerido cresce com a capacidade e pode ser ajustado depois.</p>
      <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
            <tr><th className="px-2 py-1.5">Tipo</th><th className="px-2 py-1.5">Faixa</th><th className="px-2 py-1.5">Plano</th><th className="px-2 py-1.5 text-right">Fator</th><th className="px-2 py-1.5 text-right">Qtd</th></tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={`${g.tipo}${g.faixa?.id}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-1.5">{g.tipo}</td>
                <td className="px-2 py-1.5">{g.faixa?.label || '—'}</td>
                <td className="px-2 py-1.5 text-xs">{l.planoMap.get(moda(g.planos) || planoSugerido(g.tipo, l.planos)?.id || '')?.nome || '—'}</td>
                <td className="px-2 py-1.5 text-right">{num(g.faixa?.fator ?? 1)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{g.qtd}</td>
              </tr>
            ))}
            {!grupos.length && <tr><td colSpan={5} className="p-4 text-center text-slate-500">Nenhum equipamento nas unidades escolhidas.</td></tr>}
          </tbody>
        </table>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={substituir} onChange={(x) => setSubstituir(x.target.checked)} /> Substituir os itens atuais do estudo</label>
    </Modal>
  );
}

/* ---------------- 4. Custos indiretos ---------------- */
function AbaIndiretos({ e, upd, r, params }: { e: EstudoPreco; upd: Upd; r: ResultadoEstudo; params: ParametrosPreco }) {
  const d = e.deslocamento;
  const setD = (patch: Partial<EstudoPreco['deslocamento']>) => upd({ deslocamento: { ...d, ...patch } });
  const setC = (i: number, patch: Partial<EstudoPreco['custosFixos'][number]>) => upd({ custosFixos: e.custosFixos.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Deslocamento">
        <div className="grid grid-cols-2 gap-3">
          <Num label="Visitas por mês" value={d.visitasMes} onChange={(v) => setD({ visitasMes: v ?? 0 })} help="Idas da equipe às unidades" />
          <Num label="Tempo por visita (ida e volta)" suffix="min" value={d.minutosVisita} onChange={(v) => setD({ minutosVisita: v ?? 0 })} />
          <Num label="Km rodados por mês" suffix="km" value={d.kmMes} onChange={(v) => setD({ kmMes: v ?? 0 })} />
          <Num label="Custo por km" prefix="R$" value={d.custoKm} onChange={(v) => setD({ custoKm: v ?? 0 })} />
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-slate-800/60">
          {num(d.visitasMes, 0)} visitas × {num((d.minutosVisita || 0) / 60)} h × {money(r.custoHoraEquipe)}/h + {num(d.kmMes, 0)} km × {money(d.custoKm)} = <b>{money(r.deslocamentoMensal)}/mês</b>
        </p>
      </Card>
      <Card
        title="Custos fixos mensais do contrato"
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => upd({ custosFixos: [...e.custosFixos, ...params.custosPadrao.map((c) => ({ id: uid(), ...c }))] })}>Carregar padrão</Button>
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => upd({ custosFixos: [...e.custosFixos, { id: uid(), descricao: '', valorMensal: 0 }] })}>Adicionar</Button>
          </>
        }
      >
        <div className="space-y-2">
          {e.custosFixos.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <Input className="flex-1" value={c.descricao} placeholder="Descrição" onChange={(x) => setC(i, { descricao: x.target.value })} />
              <Num className="w-36" prefix="R$" value={c.valorMensal} onChange={(v) => setC(i, { valorMensal: v ?? 0 })} />
              <IconButton title="Remover" onClick={() => upd({ custosFixos: e.custosFixos.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton>
            </div>
          ))}
          {!e.custosFixos.length && <p className="text-sm text-slate-500">Nenhum custo fixo.</p>}
        </div>
        <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold dark:border-slate-800"><span>Total</span><span>{money(r.custosFixosMensal)}/mês</span></p>
      </Card>
      <Card title="Rateio dos custos indiretos" className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <Select className="w-auto" value={e.rateio} onChange={(x) => upd({ rateio: x.target.value as EstudoPreco['rateio'] })}>
            <option value="horas">Proporcional às horas de cada equipamento (recomendado)</option>
            <option value="equipamentos">Igual por equipamento</option>
          </Select>
          <span className="text-sm">Total a ratear: <b>{money(r.deslocamentoMensal + r.custosFixosMensal)}/mês</b></span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Pelas horas, equipamentos maiores ou com mais rotinas recebem uma parcela maior, o que mantém o preço por faixa coerente com o trabalho.</p>
      </Card>
    </div>
  );
}

/* ---------------- 5. BDI e tributos ---------------- */
function AbaBdi({ e, upd, r, params }: { e: EstudoPreco; upd: Upd; r: ResultadoEstudo; params: ParametrosPreco }) {
  const b = e.bdi;
  const setB = (patch: Partial<EstudoPreco['bdi']>) => upd({ bdi: { ...b, ...patch } });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Componentes do BDI" actions={<Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => upd({ bdi: { ...params.bdi } })}>BDI padrão</Button>}>
        <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-center font-mono text-xs dark:bg-slate-800/60">BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) ÷ (1 − I)] − 1</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Num label="AC — Administração central" suffix="%" value={b.ac} onChange={(v) => setB({ ac: v ?? 0 })} /><div className="mt-1"><FarolBadge f={farol(b.ac, FAIXAS_BDI.ac)} faixa={FAIXAS_BDI.ac} /></div></div>
          <div><Num label="L — Lucro" suffix="%" value={b.l} onChange={(v) => setB({ l: v ?? 0 })} /><div className="mt-1"><FarolBadge f={farol(b.l, FAIXAS_BDI.l)} faixa={FAIXAS_BDI.l} /></div></div>
          <Num label="S — Seguros" suffix="%" value={b.s} onChange={(v) => setB({ s: v ?? 0 })} />
          <div><Num label="G — Garantias" suffix="%" value={b.g} onChange={(v) => setB({ g: v ?? 0 })} /><div className="mt-1"><FarolBadge f={farol(b.s + b.g, FAIXAS_BDI.sg)} faixa={FAIXAS_BDI.sg} /></div></div>
          <div><Num label="R — Riscos" suffix="%" value={b.r} onChange={(v) => setB({ r: v ?? 0 })} /><div className="mt-1"><FarolBadge f={farol(b.r, FAIXAS_BDI.r)} faixa={FAIXAS_BDI.r} /></div></div>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Prazo receb." suffix="dias" value={b.prazoDias} onChange={(v) => setB({ prazoDias: v ?? 0 })} />
            <Num label="Taxa" suffix="% a.m." value={b.taxaMes} onChange={(v) => setB({ taxaMes: v ?? 0 })} />
            <p className="col-span-2 text-xs">DF = <b>{pct(r.df, 3)}</b> <FarolBadge f={farol(r.df, FAIXAS_BDI.df)} /></p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-brand-50 p-3 dark:bg-brand-950/50">
          <span className="text-sm">BDI do estudo</span>
          <span className="text-2xl font-bold text-brand-800 dark:text-brand-200">{pct(r.bdi)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Sem lucro (base do lance mínimo): {pct(r.bdiSemLucro)}. Faixas: 1º a 3º quartil do Acórdão TCU 2622/2013 (edificações) como referência para serviços de engenharia.</p>
      </Card>
      <Card title="Tributos sobre o faturamento (I)" actions={<Link to="/precificacao/tributos" className="text-xs text-brand-700 hover:underline dark:text-brand-300">regime e alíquotas</Link>}>
        {(params.regime !== 'simples' || r.tributos.simples?.faixa === 6) && (
          <Num label="ISS do município de execução (deste estudo)" suffix="%" value={e.issAliquota} placeholder={num(params.issAliquota)} onChange={(v) => upd({ issAliquota: v })} className="mb-3 max-w-xs" help="Em branco = alíquota dos parâmetros" />
        )}
        {r.tributos.itens.map((t) => (
          <div key={t.nome} className={cx('flex justify-between border-b border-slate-100 py-1 text-sm dark:border-slate-800', t.excluido && 'text-slate-400 line-through')}>
            <span>{t.nome}</span>
            <span className="tabular-nums">{pct(t.aliquota, 3)}</span>
          </div>
        ))}
        <div className="flex justify-between py-1 text-sm font-bold"><span>Total (I)</span><span className="tabular-nums">{pct(r.tributos.total, 3)}</span></div>
        {r.tributos.porFora > 0 && <p className="mt-1 text-xs text-slate-500">+ {pct(r.tributos.porFora)} por fora (cenário da reforma).</p>}
        <p className="mt-3 text-xs text-slate-500">A carga tributária desta proposta fica registrada no estudo como base para eventual reequilíbrio pela reforma tributária (LC 214/2025, arts. 373 a 377), que exige a comprovação da alteração da carga efetiva.</p>
      </Card>
    </div>
  );
}

/* ---------------- 6. Resultado ---------------- */
function AbaResultado({ e, upd, r }: { e: EstudoPreco; upd: Upd; r: ResultadoEstudo }) {
  const c = r.comparacao;
  const icone = (n: string) => (n === 'critico' ? <AlertTriangle size={16} className="shrink-0 text-rose-600" /> : n === 'atencao' ? <AlertTriangle size={16} className="shrink-0 text-amber-500" /> : <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />);
  return (
    <div className="space-y-4">
      <Card title="Composição do preço por item" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-right text-xs uppercase text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2">Horas</th>
                <th className="px-2 py-2">Mão de obra</th>
                <th className="px-2 py-2">Materiais</th>
                <th className="px-2 py-2">Indiretos</th>
                <th className="px-2 py-2">Custo direto</th>
                <th className="px-2 py-2">BDI</th>
                <th className="px-2 py-2">Preço unit.</th>
                <th className="px-2 py-2">Qtd</th>
                <th className="px-2 py-2">Total/mês</th>
              </tr>
            </thead>
            <tbody>
              {r.itens.map((i) => (
                <tr key={i.item.id} className="border-t border-slate-100 text-right tabular-nums dark:border-slate-800">
                  <td className="px-2 py-1.5 text-left">{i.item.descricao || '—'}</td>
                  <td className="px-2 py-1.5">{num(i.horasUnit)}</td>
                  <td className="px-2 py-1.5">{money(i.custoMO)}</td>
                  <td className="px-2 py-1.5">{money(i.materiais)}</td>
                  <td className="px-2 py-1.5">{money(i.rateio)}</td>
                  <td className="px-2 py-1.5">{money(i.custoDireto)}</td>
                  <td className="px-2 py-1.5">{money(i.precoUnit - i.custoDireto)}</td>
                  <td className="px-2 py-1.5 font-semibold">{money(i.precoUnit)}</td>
                  <td className="px-2 py-1.5">{i.item.quantidade}</td>
                  <td className="px-2 py-1.5 font-semibold">{money(i.totalMensal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 text-right font-bold dark:border-slate-700">
                <td className="px-2 py-2 text-left" colSpan={8}>Preço mensal</td>
                <td className="px-2 py-2">{r.quantidade}</td>
                <td className="px-2 py-2">{money(r.precoMensal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Valores da proposta">
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span>Mensal</span><b>{money(r.precoMensal)}</b></p>
            <p className="flex justify-between"><span>Anual (12 meses)</span><b>{money(r.precoAnual)}</b></p>
            <p className="flex justify-between text-base"><span>Total da vigência ({e.vigenciaMeses} meses)</span><b>{money(r.precoVigencia)}</b></p>
            <p className="text-xs italic text-slate-500">({valorPorExtenso(r.precoVigencia)})</p>
            <p className="flex justify-between border-t border-slate-100 pt-2 dark:border-slate-800"><span>Lance mínimo — lucro zero (mensal)</span><b>{money(r.lanceMinimoMensal)}</b></p>
            <p className="text-xs text-slate-500">Abaixo desse valor a proposta não cobre os custos e os tributos. Desconto máximo sobre o preço: {pct(r.precoMensal ? (1 - r.lanceMinimoMensal / r.precoMensal) * 100 : 0, 1)}.</p>
            {r.tributos.porFora > 0 && <p className="flex justify-between"><span>Com tributos por fora ({pct(r.tributos.porFora)})</span><b>{money(r.precoMensalComPorFora)}</b></p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/precificacao/${e.id}/imprimir`}><Button icon={<Printer size={16} />}>Imprimir composição</Button></Link>
            {e.status === 'elaboracao' && <Button variant="outline" onClick={() => upd({ status: 'enviado' })}>Marcar proposta como enviada</Button>}
          </div>
        </Card>
        <Card title="Exequibilidade em relação ao valor estimado">
          {!c ? (
            <p className="text-sm text-slate-500">Informe o valor estimado do órgão em “1. Dados” para comparar.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>Proposta = <b>{pct(c.pct, 1)}</b> do estimado ({money(e.valorEstimadoMensal)}/mês).</p>
              {c.alertas.map((a, k) => (
                <p key={k} className={cx('flex items-start gap-2 rounded-lg p-2', a.nivel === 'critico' ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200' : a.nivel === 'atencao' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200')}>
                  {icone(a.nivel)} {a.texto}
                </p>
              ))}
              {c.garantiaAdicional > 0 && <p>Garantia adicional estimada: <b>{money(c.garantiaAdicional)}</b> (diferença entre o orçado e a proposta na vigência).</p>}
              <p className="text-xs text-slate-500">Limites para {e.tipoServico === 'engenharia' ? 'serviço de engenharia: 75% (presunção relativa) e 85% (garantia adicional)' : 'serviço comum: 50% (indício, sujeito a diligência)'}.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
