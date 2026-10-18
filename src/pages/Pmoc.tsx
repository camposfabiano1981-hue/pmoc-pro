import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarRange, FileText, Printer } from 'lucide-react';
import type { EntityConfig } from '../components/crud';
import { Badge, Button, IconButton, Select, cx } from '../components/ui';
import { PrintPage, PrintToolbar, QRImage, appUrl } from '../components/widgets';
import { db } from '../db/db';
import type { Pmoc, Rotina } from '../db/types';
import { NORMAS, RECOMENDACOES_PADRAO, RE09, TERMO_RT, periodicidadeLabel, statusOs } from '../lib/catalogs';
import { MESES_CURTOS, btuToTr, dateStr, fmtBtu, fmtDate, n2, todayStr } from '../lib/format';
import { useLookups } from '../lib/lookups';
import { projetar } from '../lib/rotinas';
import { avaliarAnalise, vencBadge } from '../modules/entities';

const STATUS_PMOC = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'vigente', label: 'Vigente' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

export const pmocsCfg: EntityConfig = {
  table: 'pmocs',
  title: 'Documentos PMOC',
  singular: 'PMOC',
  icon: <FileText size={20} />,
  subtitle: 'Plano de Manutenção, Operação e Controle por unidade — Lei 13.589/2018 e Portaria GM/MS 3.523/98',
  numbering: { field: 'codigo', kind: 'pmoc' },
  formSize: 'xl',
  fields: [
    { name: 'codigo', label: 'Código', type: 'text', span: 1, placeholder: 'Automático', section: 'Identificação' },
    { name: 'revisao', label: 'Revisão', type: 'number', span: 1, section: 'Identificação' },
    { name: 'status', label: 'Situação', type: 'select', options: STATUS_PMOC, span: 1, section: 'Identificação' },
    { name: 'sistemas', label: 'Sistemas abrangidos', type: 'text', span: 1, section: 'Identificação', placeholder: 'Ar-condicionado, ventilação…' },
    { name: 'unidadeId', label: 'Unidade / edificação', type: 'ref', required: true, span: 2, section: 'Identificação', ref: { list: (l) => l.unidades, label: (r, l) => `${r.nome} — ${l.clienteMap.get(r.clienteId)?.nome || ''}` } },
    { name: 'contratoId', label: 'Contrato', type: 'ref', span: 2, section: 'Identificação', ref: { list: (l) => l.contratos, label: (r, l) => `${r.numero} — ${l.clienteMap.get(r.clienteId)?.nome || ''}` } },
    { name: 'vigenciaInicio', label: 'Início da vigência', type: 'date', required: true, span: 1, section: 'Vigência', help: 'Mês da 1ª execução das atividades' },
    { name: 'vigenciaFim', label: 'Fim da vigência', type: 'date', required: true, span: 1, section: 'Vigência' },
    { name: 'rtId', label: 'Responsável técnico', type: 'ref', span: 2, section: 'Responsabilidade técnica', ref: { list: (l) => l.profissionais, label: (r) => `${r.nome}${r.registro ? ' — ' + (r.conselho || '') + ' ' + r.registro : ''}` } },
    { name: 'artTipo', label: 'Documento', type: 'select', options: ['ART', 'TRT', 'RRT'], span: 1, section: 'Responsabilidade técnica', help: 'ART (CREA) · TRT (CFT) · RRT (CAU)' },
    { name: 'artNumero', label: 'Número', type: 'text', span: 1, section: 'Responsabilidade técnica' },
    { name: 'artInicio', label: 'Válida de', type: 'date', span: 1, section: 'Responsabilidade técnica' },
    { name: 'artFim', label: 'Válida até', type: 'date', span: 1, section: 'Responsabilidade técnica' },
    { name: 'recomendacoes', label: 'Recomendações aos usuários (falhas e emergências)', type: 'textarea', span: 4, section: 'Conteúdo do documento' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', span: 4, section: 'Conteúdo do documento' },
  ],
  columns: [
    { key: 'codigo', label: 'Código', render: (r) => <span className="font-mono text-xs font-semibold">{r.codigo}</span> },
    { key: 'unidadeId', label: 'Unidade', value: (r, l) => l.unidadeMap.get(r.unidadeId)?.nome },
    { key: 'cliente', label: 'Proprietário', value: (r, l) => l.clienteMap.get(l.unidadeMap.get(r.unidadeId)?.clienteId || '')?.nome },
    { key: 'rtId', label: 'RT', value: (r, l) => l.profissionalMap.get(r.rtId)?.nome },
    { key: 'art', label: 'ART/TRT', value: (r) => [r.artTipo, r.artNumero].filter(Boolean).join(' ') },
    { key: 'artFim', label: 'Validade ART', value: (r) => r.artFim, render: (r) => vencBadge(r.artFim) },
    { key: 'vigencia', label: 'Vigência', value: (r) => r.vigenciaInicio, render: (r) => `${fmtDate(r.vigenciaInicio)} a ${fmtDate(r.vigenciaFim)}` },
    { key: 'status', label: 'Situação', render: (r) => <Badge className={r.status === 'vigente' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : undefined}>{STATUS_PMOC.find((s) => s.value === r.status)?.label}</Badge> },
  ],
  searchText: (r, l) => [r.codigo, r.artNumero, l.unidadeMap.get(r.unidadeId)?.nome].join(' '),
  defaults: (l) => {
    const d = new Date();
    return {
      unidadeId: l.unidades[0]?.id,
      revisao: 0,
      status: 'vigente',
      artTipo: 'ART',
      vigenciaInicio: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      vigenciaFim: new Date(d.getFullYear() + 1, d.getMonth(), 0).toISOString().slice(0, 10),
      sistemas: 'Ar-condicionado',
      recomendacoes: RECOMENDACOES_PADRAO,
      rtId: l.profissionais.find((p) => p.conselho && p.conselho !== 'Nenhum')?.id,
    };
  },
  rowActions: (r) => (
    <>
      <Link to={`/pmoc/${r.id}/documento`}><IconButton title="Documento PMOC (imprimir)"><Printer size={15} /></IconButton></Link>
      <Link to={`/cronograma?pmoc=${r.id}`}><IconButton title="Cronograma"><CalendarRange size={15} /></IconButton></Link>
    </>
  ),
};

/* ===================== Documento PMOC (impressão) ===================== */
function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 border-b-2 border-brand-700 pb-0.5 text-sm font-bold uppercase text-brand-800">{n}. {title}</h2>
      {children}
    </section>
  );
}

export function PmocDocumento() {
  const { id } = useParams();
  const l = useLookups();
  const pmoc = useLiveQuery(() => db.pmocs.get(id!), [id]) as Pmoc | undefined;
  const osList = useLiveQuery(() => db.os.toArray(), []) || [];
  const analises = useLiveQuery(() => db.analisesAr.toArray(), []) || [];
  const rotinas = useLiveQuery(() => db.rotinas.toArray(), []) || [];
  const execucoes = useLiveQuery(() => db.execucoes.toArray(), []) || [];
  const [ano, setAno] = useState<number | null>(null);
  if (!pmoc) return <p className="text-sm text-slate-500">Carregando…</p>;

  const e = l.empresa;
  const u = l.unidadeMap.get(pmoc.unidadeId);
  const c = l.clienteMap.get(u?.clienteId || '');
  const rt = l.profissionalMap.get(pmoc.rtId || '');
  const ambs = l.ambientes.filter((a) => a.unidadeId === pmoc.unidadeId);
  const eqs = l.equipamentos.filter((x) => x.unidadeId === pmoc.unidadeId && x.status !== 'desativado');
  const capTotal = eqs.reduce((a, x) => a + (x.capacidadeBtu || 0), 0);
  const anoDoc = ano ?? Number(pmoc.vigenciaInicio.slice(0, 4));
  const mesIni = Number(pmoc.vigenciaInicio.slice(5, 7)) - 1;
  const meses12 = Array.from({ length: 12 }, (_, k) => {
    const idx = anoDoc * 12 + mesIni + k;
    const ano = Math.floor(idx / 12);
    const m = idx % 12;
    return { idx, ano, m, key: `${ano}-${String(m + 1).padStart(2, '0')}` };
  });
  const cicloDe = dateStr(new Date(meses12[0].ano, meses12[0].m, 1));
  const cicloAte = dateStr(new Date(meses12[11].ano, meses12[11].m + 1, 0));
  const hoje = todayStr();
  const execCiclo = execucoes.filter((e) => e.data >= cicloDe && e.data <= cicloAte);
  const marcasCiclo = (r: Rotina): Record<string, string> => {
    const m: Record<string, string> = {};
    for (const d of projetar(r, cicloDe, cicloAte)) m[d.slice(0, 7)] = d === r.proximaExecucao && d < hoje ? '!' : 'X';
    for (const e of execCiclo) if (e.rotinaId === r.id) m[e.data.slice(0, 7)] = e.status === 'E' ? 'E' : m[e.data.slice(0, 7)] === 'E' ? 'E' : e.status;
    return m;
  };
  const anUnidade = analises.filter((a) => a.unidadeId === pmoc.unidadeId).sort((a, b) => b.data.localeCompare(a.data));
  const prevs = osList.filter((o) => o.pmocId === pmoc.id && o.tipo === 'Preventiva').sort((a, b) => (a.dataAgendada || '').localeCompare(b.dataAgendada || ''));
  const td = 'border border-slate-300 px-1.5 py-0.5';
  const kv = (k: string, v?: string | number | null) => (
    <tr><td className={cx(td, 'w-48 bg-slate-50 font-semibold')}>{k}</td><td className={td}>{v || '—'}</td></tr>
  );

  return (
    <div>
      <PrintToolbar title={`Documento ${pmoc.codigo}`}>
        <Select className="w-auto" value={anoDoc} onChange={(ev) => setAno(Number(ev.target.value))}>
          {[anoDoc - 1, anoDoc, anoDoc + 1].map((a) => <option key={a} value={a}>Ciclo iniciando em {MESES_CURTOS[mesIni]}/{a}</option>)}
        </Select>
        <Link to="/pmoc"><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar</Button></Link>
      </PrintToolbar>
      <PrintPage>
        {/* Capa */}
        <div className="flex min-h-[900px] flex-col items-center justify-between border-4 border-double border-brand-700 p-10 text-center print:min-h-[260mm]">
          <div>
            {e.logo && <img src={e.logo} alt="" className="mx-auto mb-4 h-24 object-contain" />}
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-600">{e.razaoSocial}</p>
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase leading-tight text-brand-800">Plano de Manutenção,<br />Operação e Controle</h1>
            <p className="mt-2 text-4xl font-black text-slate-800">PMOC</p>
            <p className="mt-6 text-lg font-semibold">{u?.nome}</p>
            <p className="text-sm text-slate-600">{c?.nome}</p>
            <p className="mt-4 text-sm">Código {pmoc.codigo} · Revisão {String(pmoc.revisao || 0).padStart(2, '0')}</p>
            <p className="text-sm">Vigência: {fmtDate(pmoc.vigenciaInicio)} a {fmtDate(pmoc.vigenciaFim)}</p>
          </div>
          <div className="space-y-2">
            <QRImage text={appUrl(`/pmoc/${pmoc.id}/documento`)} size={96} className="mx-auto" />
            <p className="text-[11px] text-slate-500">Lei Federal nº 13.589/2018 · Portaria GM/MS nº 3.523/1998 · Resolução ANVISA RE nº 09/2003 · ABNT NBR 13971</p>
          </div>
        </div>

        <div className="print:break-before-page" />
        <Sec n="1" title="Identificação do ambiente ou conjunto de ambientes">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome (edifício/entidade)', u?.nome)}
              {kv('Tipo de edificação', u?.tipoEdificacao)}
              {kv('Endereço', [u?.endereco, u?.numero, u?.complemento].filter(Boolean).join(', '))}
              {kv('Bairro / Cidade / UF', [u?.bairro, u?.cidade, u?.uf].filter(Boolean).join(' / '))}
              {kv('CEP / Telefone', [u?.cep, u?.telefone].filter(Boolean).join(' · '))}
              {kv('Responsável local', u?.responsavelLocal)}
              {kv('Sistemas', pmoc.sistemas)}
            </tbody>
          </table>
        </Sec>
        <Sec n="2" title="Identificação do proprietário, locatário ou preposto">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome / Razão social', c?.nome)}
              {kv('CPF / CNPJ', c?.cpfCnpj)}
              {kv('Endereço', [c?.endereco, c?.numero, c?.bairro, c?.cidade, c?.uf].filter(Boolean).join(', '))}
              {kv('Telefone / E-mail', [c?.telefone, c?.email].filter(Boolean).join(' · '))}
              {kv('Contato', c?.contato)}
            </tbody>
          </table>
        </Sec>
        <Sec n="3" title="Identificação do responsável técnico">
          <table className="w-full border-collapse">
            <tbody>
              {kv('Nome', rt?.nome)}
              {kv('CPF', rt?.cpf)}
              {kv('Registro no conselho de classe', [rt?.conselho, rt?.registro].filter(Boolean).join(' '))}
              {kv(`${pmoc.artTipo || 'ART'} nº`, pmoc.artNumero ? `${pmoc.artNumero} — válida de ${fmtDate(pmoc.artInicio)} a ${fmtDate(pmoc.artFim)}` : undefined)}
              {kv('Telefone / E-mail', [rt?.telefone, rt?.email].filter(Boolean).join(' · '))}
              {kv('Empresa executora', [e.razaoSocial, e.cnpj && `CNPJ ${e.cnpj}`].filter(Boolean).join(' — '))}
            </tbody>
          </table>
        </Sec>

        <Sec n="4" title="Relação dos ambientes climatizados">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>Grupo</th><th className={td}>Ambiente</th><th className={td}>Tipo de atividade</th>
                <th className={td}>Ocup. fixos</th><th className={td}>Ocup. flut.</th><th className={td}>Área (m²)</th><th className={td}>Carga térmica (BTU/h)</th><th className={td}>Renovação mín. (m³/h)</th>
              </tr>
            </thead>
            <tbody>
              {ambs.map((a) => {
                const carga = eqs.filter((x) => x.ambienteId === a.id).reduce((s, x) => s + (x.capacidadeBtu || 0), 0);
                const pess = (a.ocupantesFixos || 0) + (a.ocupantesFlutuantes || 0);
                return (
                  <tr key={a.id}>
                    <td className={td}>{a.grupo}</td><td className={td}>{a.nome}</td><td className={td}>{a.tipoAtividade}</td>
                    <td className={td}>{a.ocupantesFixos ?? ''}</td><td className={td}>{a.ocupantesFlutuantes ?? ''}</td><td className={td}>{a.areaM2 ? n2(a.areaM2) : ''}</td>
                    <td className={td}>{carga ? n2(carga) : ''}</td><td className={td}>{pess ? n2(pess * RE09.renovacaoMin) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={td} colSpan={5}>Total: {ambs.length} ambiente(s)</td>
                <td className={td}>{n2(ambs.reduce((s, a) => s + (a.areaM2 || 0), 0))}</td>
                <td className={td} colSpan={2}>{n2(capTotal)} BTU/h ({n2(btuToTr(capTotal))} TR)</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-[11px] text-slate-600">
            Capacidade instalada total: {fmtBtu(capTotal)} = {n2(btuToTr(capTotal))} TR.{' '}
            {capTotal > 60000 ? 'Sistema acima de 5 TR (60.000 BTU/h): exige responsável técnico habilitado (Portaria 3.523/98, art. 6º).' : 'Capacidade até 5 TR.'}
          </p>
        </Sec>

        <Sec n="5" title="Relação dos equipamentos">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>TAG</th><th className={td}>Tipo</th><th className={td}>Marca / modelo</th><th className={td}>Nº série</th><th className={td}>Patr.</th><th className={td}>BTU/h</th><th className={td}>Fluido</th><th className={td}>Ambiente</th><th className={td}>Plano</th>
              </tr>
            </thead>
            <tbody>
              {eqs.map((x) => (
                <tr key={x.id}>
                  <td className={td}>{x.tag}</td><td className={td}>{x.tipo}</td><td className={td}>{[x.marca, x.modelo].filter(Boolean).join(' ')}</td><td className={td}>{x.numeroSerie}</td><td className={td}>{x.patrimonio}</td>
                  <td className={td}>{x.capacidadeBtu ? n2(x.capacidadeBtu) : ''}</td><td className={td}>{x.fluido}</td><td className={td}>{l.ambienteMap.get(x.ambienteId || '')?.nome}</td><td className={td}>{l.planoMap.get(x.planoId || '')?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <Sec n="6" title="Plano de manutenção e controle — por equipamento">
          <p className="mb-2 text-[10px] text-slate-600">
            Periodicidade controlada individualmente por equipamento: a próxima execução de cada rotina é calculada a partir da última execução registrada pela equipe técnica.
            Legenda: <b>X</b> previsto · <b>E</b> executado · <b>N</b> não executado · <b>!</b> vencido.
          </p>
          {eqs.map((x) => {
            const rots = rotinas.filter((r) => r.equipamentoId === x.id && r.ativa).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
            if (!rots.length) return null;
            return (
              <div key={x.id} className="mb-4 break-inside-avoid">
                <p className="mb-0.5 bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold">
                  {x.tag} — {x.tipo} · {[x.marca, x.modelo].filter(Boolean).join(' ')} · {fmtBtu(x.capacidadeBtu)} · {x.fluido} · {l.ambienteMap.get(x.ambienteId || '')?.nome}
                  <span className="font-normal text-slate-600"> — plano: {l.planoMap.get(x.planoId || '')?.nome || 'personalizado'}</span>
                </p>
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className={cx(td, 'text-left')}>Atividade</th>
                      <th className={td}>Periodicidade</th>
                      <th className={td}>Últ. exec.</th>
                      <th className={td}>Próxima</th>
                      {meses12.map((mm) => <th key={mm.idx} className={cx(td, 'w-6')}>{MESES_CURTOS[mm.m]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rots.map((r) => {
                      const marcas = marcasCiclo(r);
                      return (
                        <tr key={r.id}>
                          <td className={td}>{r.descricao}</td>
                          <td className={cx(td, 'whitespace-nowrap text-center')}>{periodicidadeLabel(r.periodicidade)} ({r.intervaloDias} d)</td>
                          <td className={cx(td, 'whitespace-nowrap text-center')}>{r.ultimaExecucao ? fmtDate(r.ultimaExecucao) : '—'}</td>
                          <td className={cx(td, 'whitespace-nowrap text-center', r.proximaExecucao < hoje && 'font-bold text-rose-700')}>{fmtDate(r.proximaExecucao)}</td>
                          {meses12.map((mm) => <td key={mm.idx} className={cx(td, 'text-center font-bold', marcas[mm.key] === '!' && 'text-rose-700', marcas[mm.key] === 'E' && 'text-emerald-700')}>{marcas[mm.key] || ''}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </Sec>

        <Sec n="7" title="Registro de execução das manutenções programadas">
          <table className="mb-3 w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>Equipamento</th><th className={td}>Rotinas</th><th className={td}>Executadas (E)</th><th className={td}>Não executadas (N)</th><th className={td}>Vencidas hoje</th><th className={td}>Última execução</th>
              </tr>
            </thead>
            <tbody>
              {eqs.map((x) => {
                const rots = rotinas.filter((r) => r.equipamentoId === x.id && r.ativa);
                const ex = execCiclo.filter((e) => e.equipamentoId === x.id);
                const ult = rots.map((r) => r.ultimaExecucao).filter(Boolean).sort().pop();
                return (
                  <tr key={x.id}>
                    <td className={td}>{x.tag} · {l.ambienteMap.get(x.ambienteId || '')?.nome}</td>
                    <td className={td}>{rots.length}</td>
                    <td className={td}>{ex.filter((e) => e.status === 'E').length}</td>
                    <td className={td}>{ex.filter((e) => e.status === 'N').length}</td>
                    <td className={cx(td, rots.some((r) => r.proximaExecucao < hoje) && 'font-semibold text-rose-700')}>{rots.filter((r) => r.proximaExecucao < hoje).length}</td>
                    <td className={td}>{fmtDate(ult)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>OS</th><th className={td}>Programada</th><th className={td}>Executada em</th><th className={td}>Equip.</th><th className={td}>Executado por</th><th className={td}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {prevs.map((o) => (
                <tr key={o.id}>
                  <td className={td}>{o.numero}</td><td className={td}>{fmtDate(o.dataAgendada)}</td><td className={td}>{fmtDate(o.fim)}</td><td className={td}>{o.equipamentos.length}</td>
                  <td className={td}>{l.profissionalMap.get(o.responsavelId || '')?.nome}</td><td className={td}>{statusOs(o.status).label}</td>
                </tr>
              ))}
              {prevs.length === 0 && <tr><td className={td} colSpan={6}>Nenhuma OS preventiva registrada.</td></tr>}
            </tbody>
          </table>
        </Sec>

        <Sec n="8" title="Qualidade do ar interior (RE ANVISA nº 09/2003)">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className={td}>Data</th><th className={td}>Ambiente</th><th className={td}>Laudo</th><th className={td}>CO₂ (ppm)</th><th className={td}>Fungos (UFC/m³)</th><th className={td}>I/E</th><th className={td}>Aerodisp. (µg/m³)</th><th className={td}>T (°C)</th><th className={td}>UR (%)</th><th className={td}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {anUnidade.map((a) => {
                const nc = avaliarAnalise(a);
                return (
                  <tr key={a.id}>
                    <td className={td}>{fmtDate(a.data)}</td><td className={td}>{l.ambienteMap.get(a.ambienteId || '')?.nome}</td><td className={td}>{a.laudo}</td><td className={td}>{a.co2 ?? ''}</td><td className={td}>{a.fungos ?? ''}</td>
                    <td className={td}>{a.fungos !== undefined && a.fungosExt ? n2(a.fungos / a.fungosExt) : ''}</td><td className={td}>{a.aerodispersoides ?? ''}</td><td className={td}>{a.temperatura ?? ''}</td><td className={td}>{a.umidade ?? ''}</td>
                    <td className={cx(td, nc.length ? 'font-semibold text-rose-700' : 'text-emerald-700')}>{nc.length ? nc.join('; ') : 'Conforme'}</td>
                  </tr>
                );
              })}
              {anUnidade.length === 0 && <tr><td className={td} colSpan={10}>Nenhuma análise registrada. Recomenda-se análise semestral.</td></tr>}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-slate-600">Padrões referenciais: fungos ≤ {RE09.fungosMax} UFC/m³ e I/E ≤ {RE09.relacaoIEMax}; CO₂ ≤ {RE09.co2Max} ppm; aerodispersóides ≤ {RE09.aerodispersoidesMax} µg/m³; T 23–26 °C (verão) / 20–22 °C (inverno); UR 40–65% (verão) / 35–65% (inverno); velocidade ≤ {RE09.velocidadeMax} m/s; renovação ≥ {RE09.renovacaoMin} m³/h/pessoa.</p>
        </Sec>

        <Sec n="9" title="Recomendações aos usuários em situações de falha e emergência">
          <p className="whitespace-pre-wrap text-[11px]">{pmoc.recomendacoes || RECOMENDACOES_PADRAO}</p>
        </Sec>
        <Sec n="10" title="Normas e referências">
          <ul className="list-inside list-disc text-[11px]">{NORMAS.map((nr) => <li key={nr.ref}><b>{nr.ref}</b> — {nr.desc}</li>)}</ul>
        </Sec>
        {pmoc.observacoes && <Sec n="11" title="Observações"><p className="whitespace-pre-wrap text-[11px]">{pmoc.observacoes}</p></Sec>}
        <Sec n={pmoc.observacoes ? '12' : '11'} title="Termo de responsabilidade técnica">
          <p className="text-[11px]">{TERMO_RT}</p>
          <p className="mt-4 text-[11px]">{u?.cidade || e.cidade}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
          <div className="mt-14 grid grid-cols-2 gap-10 text-center text-[11px]">
            <div className="border-t border-slate-500 pt-1">{rt?.nome || 'Responsável técnico'}<br />{[rt?.conselho, rt?.registro].filter(Boolean).join(' ')} · {pmoc.artTipo} {pmoc.artNumero}</div>
            <div className="border-t border-slate-500 pt-1">{c?.nome || 'Proprietário / preposto'}<br />Ciente do PMOC</div>
          </div>
        </Sec>
        <p className="mt-8 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">{e.rodape} · {pmoc.codigo} rev. {pmoc.revisao || 0} · Emitido em {todayStr().split('-').reverse().join('/')}</p>
      </PrintPage>
    </div>
  );
}
