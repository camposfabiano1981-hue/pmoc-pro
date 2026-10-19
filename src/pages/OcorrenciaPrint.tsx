import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { db } from '../db/db';
import type { Ocorrencia } from '../db/types';
import { Button } from '../components/ui';
import { PrintHeader, PrintPage, PrintToolbar, appUrl } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { PRIORIDADES, STATUS_OCORRENCIA, TIPOS_OCORRENCIA, prioridade, statusOs } from '../lib/catalogs';
import { diffHours, fmtBtu, fmtDate, fmtDateTime, fmtHoras } from '../lib/format';

const VAZIA: Ocorrencia = { id: 'branco', createdAt: '', updatedAt: '', numero: '', tipo: '', status: 'nao_analisada', prioridade: 'media', dataHora: '', descricao: '' };

/** Registro de ocorrência / chamado para impressão (preenchido ou em branco para abertura em campo). */
export default function OcorrenciaPrint() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const vazio = id === 'branco';
  const branco = vazio || params.get('branco') === '1';
  const l = useLookups();
  const oc = useLiveQuery(() => (vazio ? VAZIA : db.ocorrencias.get(id!)), [id]);
  const os = useLiveQuery(() => (oc?.osId ? db.os.get(oc.osId) : undefined), [oc?.osId]);
  const contrato = useLiveQuery(async () => {
    const u = oc?.unidadeId ? await db.unidades.get(oc.unidadeId) : undefined;
    return u ? (await db.contratos.where('clienteId').equals(u.clienteId).toArray()).find((c) => c.status === 'ativo') : undefined;
  }, [oc?.unidadeId]);
  if (!oc) return <p className="text-sm text-slate-500">Carregando…</p>;

  const e = l.empresa;
  const unidade = l.unidadeMap.get(oc.unidadeId || '');
  const cliente = l.clienteMap.get(unidade?.clienteId || '');
  const ambiente = l.ambienteMap.get(oc.ambienteId || '');
  const eq = l.equipamentoMap.get(oc.equipamentoId || '');
  const executor = l.profissionalMap.get(oc.executorId || '');
  const status = STATUS_OCORRENCIA.find((s) => s.value === oc.status);
  const slaH = contrato && { urgente: contrato.slaUrgenteH, alta: contrato.slaAltaH, media: contrato.slaMediaH, baixa: contrato.slaBaixaH }[oc.prioridade];
  const atendimento = (os?.inicio && diffHours(os.inicio, oc.dataHora)) ?? undefined;
  const solucao = (os?.fim && diffHours(os.fim, oc.dataHora)) ?? undefined;
  const laudo = [os?.diagnostico && `Diagnóstico: ${os.diagnostico}`, os?.servicoExecutado && `Serviço executado: ${os.servicoExecutado}`].filter(Boolean).join('\n');
  const dentroSla = slaH && typeof atendimento === 'number' ? atendimento <= slaH : undefined;

  const box = 'border border-slate-400';
  const Titulo = ({ children }: { children: ReactNode }) => <div className="border-b border-slate-400 bg-orange-200/80 px-2 py-0.5 text-center text-[11px] font-bold">{children}</div>;
  const KV = ({ k, val, className }: { k: string; val?: ReactNode; className?: string }) => (
    <p className={className}>
      <b>{k}:</b> {branco ? '' : val || '—'}
    </p>
  );
  const Marcar = ({ opcoes, valor }: { opcoes: string[]; valor?: string }) => (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {opcoes.map((o) => (
        <span key={o} className="inline-flex items-center gap-1">
          <span className="inline-flex h-3 w-3 items-center justify-center border border-slate-500 text-[9px] leading-none">{!branco && valor === o ? 'X' : ''}</span>
          {o}
        </span>
      ))}
    </div>
  );
  const Linhas = ({ n, texto }: { n: number; texto?: string }) =>
    !branco && texto ? (
      <p className="min-h-[3rem] whitespace-pre-wrap p-1.5">{texto}</p>
    ) : (
      <div className="px-1.5 pb-1">{Array.from({ length: n }, (_, i) => <div key={i} className="h-6 border-b border-dotted border-slate-400" />)}</div>
    );

  return (
    <div>
      <PrintToolbar title={vazio ? 'Formulário de ocorrência / chamado em branco' : `${branco ? 'Formulário em branco' : 'Impressão'} — Ocorrência ${oc.numero}`}>
        {!vazio && <Button variant="outline" onClick={() => setParams(branco ? {} : { branco: '1' })}>{branco ? 'Ver ocorrência preenchida' : 'Formulário em branco'}</Button>}
        <Link to="/ocorrencias"><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar</Button></Link>
      </PrintToolbar>
      <PrintPage>
        <PrintHeader
          empresa={e}
          titulo="Registro de ocorrência / chamado"
          subtitulo={<><b className="text-base text-slate-900">{branco ? 'Nº ________' : oc.numero}</b>{!branco && <><br />{status?.label}</>}</>}
          qr={branco ? undefined : appUrl(`/ocorrencias/${oc.id}/imprimir`)}
        />

        <div className={box + ' text-[11px]'}>
          <Titulo>Identificação da ocorrência</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 p-1.5">
            <div className="col-span-3"><b>Tipo:</b> <Marcar opcoes={TIPOS_OCORRENCIA} valor={oc.tipo} /></div>
            <div className="col-span-2"><b>Prioridade:</b> <Marcar opcoes={PRIORIDADES.map((p) => p.label)} valor={prioridade(oc.prioridade).label} /></div>
            <KV k="Status" val={status?.label} />
            <KV k="Data/hora de emissão" val={fmtDateTime(oc.dataHora)} />
            <KV k="Limite para execução" val={fmtDateTime(oc.limiteExecucao)} />
            <KV k="SLA do contrato" val={slaH ? `${slaH} h${contrato ? ` (contrato ${contrato.numero})` : ''}` : undefined} />
            <KV className="col-span-2" k="Emitente / solicitante" val={oc.emitente} />
            <KV k="Executor designado" val={executor?.nome} />
          </div>
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Local e equipamento</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 p-1.5">
            <KV className="col-span-2" k="Cliente" val={cliente?.nome} />
            <KV k="Telefone" val={unidade?.telefone || cliente?.telefone} />
            <KV className="col-span-2" k="Unidade / edificação" val={unidade?.nome} />
            <KV k="Área / ambiente" val={ambiente?.nome} />
            <KV className="col-span-3" k="Endereço" val={[unidade?.endereco, unidade?.numero, unidade?.bairro, unidade?.cidade && `${unidade.cidade}/${unidade.uf || ''}`].filter(Boolean).join(', ')} />
            <KV k="TAG" val={eq?.tag} />
            <KV k="Equipamento" val={eq?.tipo} />
            <KV k="Marca / modelo" val={[eq?.marca, eq?.modelo].filter(Boolean).join(' ')} />
            <KV k="Nº de série" val={eq?.numeroSerie} />
            <KV k="Patrimônio" val={eq?.patrimonio} />
            <KV k="Capacidade / fluido" val={eq ? [eq.capacidadeBtu ? fmtBtu(eq.capacidadeBtu) : '', eq.fluido].filter(Boolean).join(' · ') : undefined} />
          </div>
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Descrição da ocorrência (o que foi observado)</Titulo>
          <Linhas n={5} texto={oc.descricao} />
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Análise / tratativa (causa provável e providência)</Titulo>
          <Linhas n={5} texto={oc.analise} />
        </div>

        <div className={box + ' mt-1 text-[11px]'}>
          <Titulo>Atendimento</Titulo>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 p-1.5">
            <KV k="OS gerada" val={os?.numero} />
            <KV k="Situação da OS" val={os ? statusOs(os.status).label : undefined} />
            <KV k="Responsável" val={l.profissionalMap.get(os?.responsavelId || '')?.nome} />
            <KV k="Início do atendimento" val={fmtDateTime(os?.inicio)} />
            <KV k="Término" val={fmtDateTime(os?.fim)} />
            <KV k="Liberação" val={fmtDateTime(os?.liberacao)} />
            <KV k="Tempo até o atendimento" val={typeof atendimento === 'number' ? fmtHoras(atendimento) : undefined} />
            <KV k="Tempo até a solução" val={typeof solucao === 'number' ? fmtHoras(solucao) : undefined} />
            <KV k="Dentro do SLA" val={dentroSla === undefined ? undefined : dentroSla ? 'Sim' : 'Não'} />
          </div>
          {(branco || laudo) && (
            <div className="border-t border-slate-300">
              <p className="px-1.5 pt-1 font-bold">Serviço executado / laudo:</p>
              <Linhas n={4} texto={laudo} />
            </div>
          )}
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-[11px]">
          <div className="border-t border-slate-500 pt-1">Emitente / solicitante<br />{!branco && oc.emitente}</div>
          <div className="border-t border-slate-500 pt-1">Executor<br />{!branco && (l.profissionalMap.get(os?.responsavelId || '')?.nome || executor?.nome)}</div>
          <div className="border-t border-slate-500 pt-1">Supervisor / recebido por<br />Data: ___/___/______ ___:___</div>
        </div>
        <p className="mt-6 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">
          {e.rodape} · Registro conforme PMOC (Lei 13.589/2018) — ocorrências e chamados devem ser mantidos no histórico do equipamento. {!branco && `Emitido em ${fmtDate(new Date().toISOString())}`}
        </p>
      </PrintPage>
    </div>
  );
}
