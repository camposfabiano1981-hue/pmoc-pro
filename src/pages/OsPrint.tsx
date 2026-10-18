import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../db/db';
import { Button } from '../components/ui';
import { PrintHeader, PrintPage, PrintToolbar, appUrl, totais } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { prioridade, statusOs } from '../lib/catalogs';
import { fmtBtu, fmtDate, fmtDateTime, fmtHoras, money, n2 } from '../lib/format';
import { horasTrabalhadas } from '../lib/osHelpers';
import { diagnosticar } from '../lib/hvac';

const RES: Record<string, string> = { ok: 'OK', nok: 'NÃO CONFORME', corrigido: 'CORRIGIDO', na: 'N/A', '': '—' };

export default function OsPrint() {
  const { id } = useParams();
  const l = useLookups();
  const os = useLiveQuery(() => db.os.get(id!), [id]);
  if (!os) return <p className="text-sm text-slate-500">Carregando…</p>;
  const e = l.empresa;
  const cliente = l.clienteMap.get(os.clienteId || '');
  const unidade = l.unidadeMap.get(os.unidadeId || '');
  const t = totais(os.pecas, os.servicos, os.deslocamento, os.desconto);
  const resp = l.profissionalMap.get(os.responsavelId || '');
  const row = (k: string, v?: string | number | null) => (
    <div className="flex gap-1 border-b border-slate-200 py-0.5">
      <span className="w-28 shrink-0 font-semibold text-slate-600">{k}</span>
      <span>{v || '—'}</span>
    </div>
  );

  return (
    <div>
      <PrintToolbar title={`Impressão — ${os.numero}`}>
        <Link to={`/os/${os.id}`}><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar à OS</Button></Link>
      </PrintToolbar>
      <PrintPage>
        <PrintHeader empresa={e} titulo="Ordem de Serviço" subtitulo={<><b className="text-base text-slate-900">{os.numero}</b><br />{os.tipo} · {statusOs(os.status).label}</>} qr={appUrl(`/os/${os.id}`)} />

        <div className="grid grid-cols-2 gap-x-6">
          <div>
            {row('Cliente', cliente?.nome)}
            {row('CNPJ/CPF', cliente?.cpfCnpj)}
            {row('Unidade', unidade?.nome)}
            {row('Endereço', [unidade?.endereco, unidade?.numero, unidade?.bairro, unidade?.cidade && `${unidade.cidade}/${unidade.uf || ''}`].filter(Boolean).join(', '))}
            {row('Ambiente', l.ambienteMap.get(os.ambienteId || '')?.nome)}
            {row('Solicitante', os.solicitante)}
          </div>
          <div>
            {row('Abertura', fmtDateTime(os.dataAbertura))}
            {row('Agendada', fmtDate(os.dataAgendada))}
            {row('Prazo', fmtDate(os.prazo))}
            {row('Início / Fim', `${fmtDateTime(os.inicio)} → ${fmtDateTime(os.fim)}`)}
            {row('Prioridade', prioridade(os.prioridade).label)}
            {row('Equipe', [resp?.nome, ...os.tecnicosIds.filter((x) => x !== os.responsavelId).map((x) => l.profissionalMap.get(x)?.nome)].filter(Boolean).join(', '))}
          </div>
        </div>

        <h3 className="mt-4 bg-slate-100 px-2 py-1 text-xs font-bold uppercase">{os.titulo}</h3>
        {os.descricao && <p className="mt-1 whitespace-pre-wrap">{os.descricao}</p>}

        {os.equipamentos.map((it) => {
          const eq = l.equipamentoMap.get(it.equipamentoId);
          const d = diagnosticar(it.medicoes, eq?.fluido, eq?.correnteNominal, eq?.tensao);
          const meds = Object.entries(it.medicoes).filter(([, v]) => v);
          return (
            <div key={it.equipamentoId} className="mt-4 break-inside-avoid">
              <h3 className="bg-brand-700 px-2 py-1 text-xs font-bold uppercase text-white">
                {eq?.tag} — {eq?.tipo} {eq?.marca} {eq?.modelo} · {fmtBtu(eq?.capacidadeBtu)} · {eq?.fluido} · Pat. {eq?.patrimonio || '—'} · {l.ambienteMap.get(eq?.ambienteId || '')?.nome}
              </h3>
              {it.checklist.length > 0 && (
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border border-slate-300 px-1.5 py-0.5">Atividade</th>
                      <th className="w-20 border border-slate-300 px-1.5 py-0.5">Valor</th>
                      <th className="w-24 border border-slate-300 px-1.5 py-0.5">Resultado</th>
                      <th className="w-40 border border-slate-300 px-1.5 py-0.5">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {it.checklist.map((c, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-1.5 py-0.5">{c.descricao}</td>
                        <td className="border border-slate-300 px-1.5 py-0.5">{c.valor ? `${c.valor} ${c.unidade || ''}` : ''}</td>
                        <td className={`border border-slate-300 px-1.5 py-0.5 font-semibold ${c.resultado === 'nok' ? 'text-rose-700' : ''}`}>{RES[c.resultado]}</td>
                        <td className="border border-slate-300 px-1.5 py-0.5">{c.obs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(meds.length > 0 || d.deltaT !== undefined) && (
                <p className="mt-1 text-[11px]">
                  <b>Medições:</b> {meds.map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  {d.deltaT !== undefined && ` · ΔT: ${n2(d.deltaT)} K`}
                  {d.superaquecimento !== undefined && ` · SH: ${n2(d.superaquecimento)} K`}
                  {d.subresfriamento !== undefined && ` · SC: ${n2(d.subresfriamento)} K`}
                </p>
              )}
              {it.obs && <p className="text-[11px]"><b>Obs.:</b> {it.obs}</p>}
            </div>
          );
        })}

        {(os.diagnostico || os.servicoExecutado || os.recomendacoes) && (
          <div className="mt-4 break-inside-avoid space-y-1">
            <h3 className="bg-slate-100 px-2 py-1 text-xs font-bold uppercase">Laudo técnico</h3>
            {os.diagnostico && <p className="whitespace-pre-wrap"><b>Diagnóstico:</b> {os.diagnostico}</p>}
            {os.servicoExecutado && <p className="whitespace-pre-wrap"><b>Serviço executado:</b> {os.servicoExecutado}</p>}
            {os.recomendacoes && <p className="whitespace-pre-wrap"><b>Recomendações:</b> {os.recomendacoes}</p>}
          </div>
        )}

        {(os.pecas.length > 0 || os.servicos.length > 0) && (
          <div className="mt-4 break-inside-avoid">
            <h3 className="bg-slate-100 px-2 py-1 text-xs font-bold uppercase">Peças e serviços</h3>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border border-slate-300 px-1.5 py-0.5">Descrição</th>
                  <th className="w-16 border border-slate-300 px-1.5 py-0.5 text-right">Qtd</th>
                  <th className="w-24 border border-slate-300 px-1.5 py-0.5 text-right">Unitário</th>
                  <th className="w-24 border border-slate-300 px-1.5 py-0.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {os.pecas.map((p, i) => (
                  <tr key={'p' + i}><td className="border border-slate-300 px-1.5 py-0.5">{p.descricao}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{n2(p.quantidade)} {p.unidade}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(p.precoUnit)}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(p.quantidade * p.precoUnit)}</td></tr>
                ))}
                {os.servicos.map((s, i) => (
                  <tr key={'s' + i}><td className="border border-slate-300 px-1.5 py-0.5">{s.descricao}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{n2(s.quantidade)}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(s.precoUnit)}</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(s.quantidade * s.precoUnit)}</td></tr>
                ))}
                {!!os.deslocamento && <tr><td colSpan={3} className="border border-slate-300 px-1.5 py-0.5 text-right">Deslocamento</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(os.deslocamento)}</td></tr>}
                {!!os.desconto && <tr><td colSpan={3} className="border border-slate-300 px-1.5 py-0.5 text-right">Desconto</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">− {money(os.desconto)}</td></tr>}
                <tr className="font-bold"><td colSpan={3} className="border border-slate-300 px-1.5 py-0.5 text-right">TOTAL</td><td className="border border-slate-300 px-1.5 py-0.5 text-right">{money(t.total)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-600">Horas trabalhadas (homem-hora): {fmtHoras(horasTrabalhadas(os))}</p>

        {os.fotos.length > 0 && (
          <div className="mt-4">
            <h3 className="bg-slate-100 px-2 py-1 text-xs font-bold uppercase">Registro fotográfico</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {os.fotos.map((f) => (
                <figure key={f.id} className="break-inside-avoid">
                  <img src={f.dataUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                  <figcaption className="text-[10px] text-slate-600">{f.momento.toUpperCase()} {f.legenda && `— ${f.legenda}`}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid break-inside-avoid grid-cols-2 gap-10 text-center text-[11px]">
          <div>
            {os.assinaturaTecnico ? <img src={os.assinaturaTecnico} alt="" className="mx-auto h-16 object-contain" /> : <div className="h-16" />}
            <div className="border-t border-slate-500 pt-1">
              {resp?.nome || 'Técnico responsável'}
              <br />
              {resp?.registro && `${resp.conselho || ''} ${resp.registro}`}
            </div>
          </div>
          <div>
            {os.assinaturaCliente ? <img src={os.assinaturaCliente} alt="" className="mx-auto h-16 object-contain" /> : <div className="h-16" />}
            <div className="border-t border-slate-500 pt-1">
              {os.nomeAssinante || 'Cliente / responsável'}
              <br />
              {os.docAssinante}
            </div>
          </div>
        </div>
        <p className="mt-6 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">{e.rodape} · Impresso em {new Date().toLocaleString('pt-BR')}</p>
      </PrintPage>
    </div>
  );
}
