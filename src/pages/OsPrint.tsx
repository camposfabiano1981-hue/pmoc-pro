import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { db } from '../db/db';
import { Button } from '../components/ui';
import { PrintHeader, PrintPage, PrintToolbar, appUrl, totais } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { periodicidadeSigla, prioridade, statusOs } from '../lib/catalogs';
import { diffHours, fmtBtu, fmtDate, fmtDateTime, fmtHoras, money, n2 } from '../lib/format';
import { tempoPrevisto } from '../lib/osHelpers';
import { diagnosticar } from '../lib/hvac';
import { statusItem } from '../lib/rotinas';

const COND: Record<string, string> = { ok: 'Conforme', nok: 'Não conforme', corrigido: 'Corrigido', na: 'N/A', '': '' };

export default function OsPrint() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const branco = params.get('branco') === '1';
  const l = useLookups();
  const os = useLiveQuery(() => db.os.get(id!), [id]);
  if (!os) return <p className="text-sm text-slate-500">Carregando…</p>;
  const e = l.empresa;
  const cliente = l.clienteMap.get(os.clienteId || '');
  const unidade = l.unidadeMap.get(os.unidadeId || '');
  const ambiente = l.ambienteMap.get(os.ambienteId || '');
  const pmoc = l.pmocMap.get(os.pmocId || '') || l.pmocs.find((p) => p.unidadeId === os.unidadeId && p.status === 'vigente');
  const rt = l.profissionalMap.get(pmoc?.rtId || '');
  const resp = l.profissionalMap.get(os.responsavelId || '');
  const sup = l.profissionalMap.get(os.supervisorId || '');
  const t = totais(os.pecas, os.servicos, os.deslocamento, os.desconto);
  const v = (x?: string | number | null) => (branco && x === undefined ? '' : x ?? '');
  const planosObs = [...new Set(os.equipamentos.map((i) => l.planoMap.get(l.equipamentoMap.get(i.equipamentoId)?.planoId || '')?.nome).filter(Boolean))].join('; ');
  const parada = diffHours(os.paradaFim, os.paradaInicio);
  const realocacoes = os.equipamentos.filter((i) => i.novoAmbienteId);

  const box = 'border border-slate-400';
  const th = 'border border-slate-400 bg-orange-100 px-1 py-0.5 text-center font-bold';
  const td = 'border border-slate-400 px-1 py-0.5 align-top';
  const Titulo = ({ children }: { children: ReactNode }) => <div className="border border-slate-400 bg-orange-200/80 px-2 py-0.5 text-center text-[11px] font-bold">{children}</div>;
  const KV = ({ k, val, className }: { k: string; val?: ReactNode; className?: string }) => (
    <p className={className}>
      <b>{k}:</b> {val || (branco ? '' : '—')}
    </p>
  );
  const linhasBranco = (n: number, cols: number) =>
    Array.from({ length: n }, (_, i) => (
      <tr key={'b' + i}>
        {Array.from({ length: cols }, (_, j) => (
          <td key={j} className={td + ' h-6'} />
        ))}
      </tr>
    ));

  return (
    <div>
      <PrintToolbar title={`${branco ? 'Formulário em branco' : 'Impressão'} — ${os.numero}`}>
        <Button variant="outline" onClick={() => setParams(branco ? {} : { branco: '1' })}>{branco ? 'Ver OS preenchida' : 'Formulário em branco'}</Button>
        <Link to={`/os/${os.id}`}><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar à OS</Button></Link>
      </PrintToolbar>
      <PrintPage>
        <PrintHeader empresa={e} titulo="Ordem de Serviço" subtitulo={<><b className="text-base text-slate-900">{os.numero}</b><br />{os.tipo}{!branco && ` · ${statusOs(os.status).label}`}</>} qr={appUrl(`/os/${os.id}`)} />

        <div className="grid grid-cols-[3fr_2fr] text-[11px]">
          <div className={box}>
            <Titulo>Informações gerais</Titulo>
            <div className="space-y-0.5 p-1.5">
              <KV k="Filial" val={unidade?.nome} />
              <KV k="Solicitante" val={os.solicitante} />
              <KV k="Responsável" val={resp?.nome} />
              <KV k="Setor executante" val={os.setorExecutante} />
              <KV k="Tipo de manutenção" val={os.tipo} />
              <KV k="Centro de custo" val={os.centroCusto} />
              <KV k="Localização" val={ambiente?.nome} />
              <KV k="Fornecedor" val={l.fornecedorMap.get(os.fornecedorId || '')?.nome || 'Equipe própria'} />
              <KV k="Cliente" val={cliente?.nome} />
            </div>
          </div>
          <div className={box + ' border-l-0'}>
            <Titulo>Padrões de execução</Titulo>
            <div className="space-y-0.5 p-1.5">
              <KV k="Data agendada" val={fmtDate(os.dataAgendada)} />
              <KV k="Prazo de entrega" val={fmtDate(os.prazo)} />
              <KV k="Tempo de execução" val={`${fmtHoras(tempoPrevisto(os) / 60)} previsto`} />
              <KV k="Tempo de interferência" val={`${fmtHoras((os.interferenciaPrevistaMin || 0) / 60)} previsto`} />
              <KV k="Prioridade" val={prioridade(os.prioridade).label} />
              <KV k="Garantia da aplicação" val={os.garantia} />
              <KV k="Abertura" val={fmtDateTime(os.dataAbertura)} />
            </div>
          </div>
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Identificação do ambiente</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 p-1.5">
            <KV className="col-span-3" k="Nome (edifício/entidade)" val={unidade?.nome} />
            <KV className="col-span-2" k="Endereço" val={[unidade?.endereco, unidade?.numero, unidade?.complemento].filter(Boolean).join(', ')} />
            <KV k="Bairro" val={unidade?.bairro} />
            <KV k="Cidade" val={unidade?.cidade} />
            <KV k="UF" val={unidade?.uf} />
            <KV k="CEP" val={unidade?.cep} />
            <KV k="Telefone" val={unidade?.telefone} />
            <KV className="col-span-2" k="Tipo de atividade" val={ambiente?.tipoAtividade || unidade?.tipoEdificacao} />
            <KV k="Área climatizada total (m²)" val={ambiente?.areaM2 ? n2(ambiente.areaM2) : unidade?.areaConstruida ? n2(unidade.areaConstruida) : undefined} />
            <KV k="Nº ocupantes fixos" val={ambiente?.ocupantesFixos} />
            <KV k="Nº ocupantes flutuantes" val={ambiente?.ocupantesFlutuantes} />
          </div>
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Proprietário, locatário ou preposto</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 p-1.5">
            <KV className="col-span-2" k="Nome / razão social" val={cliente?.nome} />
            <KV k="CPF/CNPJ" val={cliente?.cpfCnpj} />
            <KV className="col-span-2" k="Endereço" val={[cliente?.endereco, cliente?.numero, cliente?.bairro].filter(Boolean).join(', ')} />
            <KV k="Cidade" val={[cliente?.cidade, cliente?.uf].filter(Boolean).join('/')} />
            <KV k="CEP" val={cliente?.cep} />
            <KV k="Telefone" val={cliente?.telefone} />
          </div>
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Responsável técnico</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 p-1.5">
            <KV className="col-span-2" k="Nome" val={rt?.nome} />
            <KV k="CPF" val={rt?.cpf} />
            <KV className="col-span-2" k="Registro no conselho de classe" val={[rt?.conselho, rt?.registro].filter(Boolean).join(' ')} />
            <KV k={pmoc?.artTipo || 'ART'} val={pmoc?.artNumero} />
          </div>
        </div>

        <div className={box + ' mt-1 space-y-0.5 p-1.5 text-[11px]'}>
          <KV k="Serviço solicitado" val={os.titulo + (os.descricao ? ' — ' + os.descricao : '')} />
          <KV k="Observações" val={os.observacoes} />
          <KV k="Observações do plano" val={[planosObs, pmoc?.observacoes].filter(Boolean).join(' · ')} />
        </div>

        <div className="mt-1 border border-slate-400 bg-orange-200/80 py-0.5 text-center text-[11px] font-bold">E = EXECUTADO / P = PENDENTE / N = NÃO EXECUTADO</div>
        {os.equipamentos.map((it) => {
          const eq = l.equipamentoMap.get(it.equipamentoId);
          const d = diagnosticar(it.medicoes, eq?.fluido, eq?.correnteNominal, eq?.tensao);
          const meds = Object.entries(it.medicoes).filter(([, x]) => x);
          return (
            <div key={it.equipamentoId} className="break-inside-avoid">
              <div className="border border-t-0 border-slate-400 bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold">
                {eq?.tag} — {eq?.tipo} {eq?.marca} {eq?.modelo} · {fmtBtu(eq?.capacidadeBtu)} · {eq?.fluido} · Pat. {eq?.patrimonio || '—'} · Série {eq?.numeroSerie || '—'} · {l.ambienteMap.get(eq?.ambienteId || '')?.nome}
              </div>
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr>
                    <th className={th + ' w-5'}>E</th>
                    <th className={th + ' w-5'}>P</th>
                    <th className={th + ' w-5'}>N</th>
                    <th className={th + ' text-left'}>Descrição</th>
                    <th className={th + ' w-20'}>Serviço</th>
                    <th className={th + ' w-20'}>Material</th>
                    <th className={th + ' w-11'}>Prev.</th>
                    <th className={th + ' w-11'}>Real</th>
                    <th className={th + ' w-28'}>{branco ? 'Valor / obs.' : 'Resultado / executante'}</th>
                  </tr>
                </thead>
                <tbody>
                  {it.checklist.map((c, i) => {
                    const s = branco ? '' : statusItem(c);
                    const ex = l.profissionalMap.get(c.executorId || '');
                    return (
                      <tr key={i}>
                        {(['E', 'P', 'N'] as const).map((k) => (
                          <td key={k} className={td + ' text-center font-bold'}>{s === k ? 'X' : ''}</td>
                        ))}
                        <td className={td}>
                          {c.periodicidade && <span className="mr-1 text-[9px] font-bold text-slate-500">[{periodicidadeSigla(c.periodicidade)}]</span>}
                          {c.descricao}
                          {c.tipo === 'medicao' && branco && <span className="text-slate-500"> ({c.unidade}: ______)</span>}
                        </td>
                        <td className={td}>{c.servico}</td>
                        <td className={td}>{v(c.material)}</td>
                        <td className={td + ' text-center'}>{c.tempoPrevistoMin ? `${c.tempoPrevistoMin}′` : ''}</td>
                        <td className={td + ' text-center'}>{!branco && c.tempoRealMin ? `${c.tempoRealMin}′` : ''}</td>
                        <td className={td}>
                          {!branco && (
                            <>
                              {c.valor && <b>{c.valor} {c.unidade} </b>}
                              {COND[c.resultado]}
                              {c.obs && <span className="block italic">{c.obs}</span>}
                              {ex && <span className="block text-[9px] text-slate-600">{ex.nome.split(' ')[0]} {c.dataExecucao ? fmtDateTime(c.dataExecucao) : ''}</span>}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {branco && linhasBranco(2, 9)}
                </tbody>
              </table>
              {!branco && (meds.length > 0 || d.deltaT !== undefined) && (
                <p className="border border-t-0 border-slate-400 px-1.5 py-0.5 text-[10.5px]">
                  <b>Medições:</b> {meds.map(([k, x]) => `${k}: ${x}`).join(' · ')}
                  {d.deltaT !== undefined && ` · ΔT ${n2(d.deltaT)} K`}
                  {d.superaquecimento !== undefined && ` · SH ${n2(d.superaquecimento)} K`}
                  {d.subresfriamento !== undefined && ` · SC ${n2(d.subresfriamento)} K`}
                </p>
              )}
              {branco && <p className="border border-t-0 border-slate-400 px-1.5 py-1 text-[10.5px]"><b>Medições:</b> Tensão ____ V · Corrente ____ A · T. retorno ____ °C · T. insuflamento ____ °C · P. sucção ____ psig · T. linha sucção ____ °C</p>}
              {!branco && it.obs && <p className="border border-t-0 border-slate-400 px-1.5 py-0.5 text-[10.5px]"><b>Obs.:</b> {it.obs}</p>}
            </div>
          );
        })}

        <table className="mt-1 w-full border-collapse text-[10.5px]">
          <thead>
            <tr>
              <th className={th + ' text-left'}>Executante</th>
              <th className={th}>Início do serviço</th>
              <th className={th}>Fim do serviço</th>
              <th className={th + ' w-16'}>Tempo</th>
            </tr>
          </thead>
          <tbody>
            {!branco &&
              os.apontamentos.map((a, i) => (
                <tr key={i}>
                  <td className={td}>{l.profissionalMap.get(a.profissionalId)?.nome}</td>
                  <td className={td + ' text-center'}>{fmtDateTime(a.inicio)}</td>
                  <td className={td + ' text-center'}>{fmtDateTime(a.fim)}</td>
                  <td className={td + ' text-center'}>{a.fim ? fmtHoras(Math.max(0, diffHours(a.fim, a.inicio) || 0)) : ''}</td>
                </tr>
              ))}
            {branco &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td className={td + ' h-6'} />
                  <td className={td + ' text-center text-slate-400'}>____/____/______ ____:____</td>
                  <td className={td + ' text-center text-slate-400'}>____/____/______ ____:____</td>
                  <td className={td + ' text-center text-slate-400'}>:</td>
                </tr>
              ))}
          </tbody>
        </table>

        <table className="mt-1 w-full border-collapse text-[10.5px]">
          <thead>
            <tr>
              <th className={th}>Início da parada</th>
              <th className={th}>Fim da parada</th>
              <th className={th}>Interferência</th>
              <th className={th}>Tempo parado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td + ' h-6 text-center'}>{branco ? <span className="text-slate-400">____/____/______ ____:____</span> : fmtDateTime(os.paradaInicio)}</td>
              <td className={td + ' text-center'}>{branco ? <span className="text-slate-400">____/____/______ ____:____</span> : fmtDateTime(os.paradaFim)}</td>
              <td className={td}>{v(os.interferencia)}</td>
              <td className={td + ' text-center'}>{!branco && parada !== null && parada >= 0 ? fmtHoras(parada) : ''}</td>
            </tr>
          </tbody>
        </table>

        <table className="mt-1 w-full border-collapse text-[10.5px]">
          <tbody>
            {(branco || realocacoes.length === 0 ? [null] : realocacoes).map((it, i) => {
              const eq = it ? l.equipamentoMap.get(it.equipamentoId) : undefined;
              return (
                <tr key={i}>
                  <td className={td + ' w-1/2'}><b>Alteração da localização — origem:</b> {it ? `${eq?.tag} · ${l.ambienteMap.get(eq?.ambienteId || '')?.nome || ''}` : ''}</td>
                  <td className={td}><b>Destino:</b> {it ? l.ambienteMap.get(it.novoAmbienteId || '')?.nome : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!branco && (os.diagnostico || os.servicoExecutado || os.recomendacoes) && (
          <div className={box + ' mt-1 break-inside-avoid space-y-0.5 p-1.5 text-[11px]'}>
            {os.diagnostico && <p className="whitespace-pre-wrap"><b>Diagnóstico:</b> {os.diagnostico}</p>}
            {os.servicoExecutado && <p className="whitespace-pre-wrap"><b>Serviço executado:</b> {os.servicoExecutado}</p>}
            {os.recomendacoes && <p className="whitespace-pre-wrap"><b>Recomendações:</b> {os.recomendacoes}</p>}
          </div>
        )}

        {!branco && (os.pecas.length > 0 || os.servicos.length > 0) && (
          <table className="mt-1 w-full break-inside-avoid border-collapse text-[10.5px]">
            <thead>
              <tr>
                <th className={th + ' text-left'}>Peças, materiais e serviços</th>
                <th className={th + ' w-16'}>Qtd</th>
                <th className={th + ' w-24'}>Unitário</th>
                <th className={th + ' w-24'}>Total</th>
              </tr>
            </thead>
            <tbody>
              {os.pecas.map((p, i) => (
                <tr key={'p' + i}><td className={td}>{p.descricao}</td><td className={td + ' text-right'}>{n2(p.quantidade)} {p.unidade}</td><td className={td + ' text-right'}>{money(p.precoUnit)}</td><td className={td + ' text-right'}>{money(p.quantidade * p.precoUnit)}</td></tr>
              ))}
              {os.servicos.map((s, i) => (
                <tr key={'s' + i}><td className={td}>{s.descricao}</td><td className={td + ' text-right'}>{n2(s.quantidade)}</td><td className={td + ' text-right'}>{money(s.precoUnit)}</td><td className={td + ' text-right'}>{money(s.quantidade * s.precoUnit)}</td></tr>
              ))}
              <tr className="font-bold"><td colSpan={3} className={td + ' text-right'}>TOTAL (com deslocamento e desconto)</td><td className={td + ' text-right'}>{money(t.total)}</td></tr>
            </tbody>
          </table>
        )}

        <div className={box + ' mt-1 p-1.5 text-[11px]'}>
          <b>Observações:</b>
          {branco ? Array.from({ length: 4 }, (_, i) => <div key={i} className="h-5 border-b border-slate-300" />) : <span> {os.observacoes || ''}</span>}
        </div>

        {!branco && os.fotos.length > 0 && (
          <div className="mt-2">
            <Titulo>Registro fotográfico</Titulo>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {os.fotos.map((f) => (
                <figure key={f.id} className="break-inside-avoid">
                  <img src={f.dataUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                  <figcaption className="text-[10px] text-slate-600">{f.momento.toUpperCase()} {f.legenda && `— ${f.legenda}`}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        <table className="mt-2 w-full break-inside-avoid border-collapse text-center text-[10.5px]">
          <thead>
            <tr>
              <th className={th}>Executante</th>
              <th className={th}>Responsável</th>
              <th className={th}>Supervisor manutenção</th>
              <th className={th}>Data / hora liberação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td + ' h-20 align-bottom'}>
                {!branco && os.assinaturaTecnico && <img src={os.assinaturaTecnico} alt="" className="mx-auto h-12 object-contain" />}
                <span className="block border-t border-slate-400 pt-0.5">{!branco && resp?.nome}</span>
              </td>
              <td className={td + ' align-bottom'}>
                {!branco && os.assinaturaCliente && <img src={os.assinaturaCliente} alt="" className="mx-auto h-12 object-contain" />}
                <span className="block border-t border-slate-400 pt-0.5">{!branco && [os.nomeAssinante, os.docAssinante].filter(Boolean).join(' · ')}</span>
              </td>
              <td className={td + ' align-bottom'}>
                {!branco && os.assinaturaSupervisor && <img src={os.assinaturaSupervisor} alt="" className="mx-auto h-12 object-contain" />}
                <span className="block border-t border-slate-400 pt-0.5">{!branco && sup?.nome}</span>
              </td>
              <td className={td + ' align-bottom'}>{branco || !os.liberacao ? <span className="text-slate-400">____/____/______ ____:____</span> : fmtDateTime(os.liberacao)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">{e.rodape} · Impresso em {new Date().toLocaleString('pt-BR')}</p>
      </PrintPage>
    </div>
  );
}
