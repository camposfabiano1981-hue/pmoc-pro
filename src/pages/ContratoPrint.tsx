import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, FileDown, Info } from 'lucide-react';
import { db } from '../db/db';
import type { Contrato } from '../db/types';
import { Badge, Button } from '../components/ui';
import { PrintPage, PrintToolbar } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { PRIORIDADES, periodicidadeLabel } from '../lib/catalogs';
import { CONTRATO_PADRAO, SITUACOES_SLA, clausulasContrato, enderecoCliente, fechamento, mesesVigencia, ordinal, preambulo } from '../lib/contrato';
import { valorPorExtenso } from '../lib/extenso';
import { btuToTr, downloadText, fmtBtu, fmtDate, money, n2 } from '../lib/format';

const LIMITE_LISTA = 300;

export default function ContratoPrint() {
  const { id } = useParams();
  const l = useLookups();
  const doc = useRef<HTMLDivElement>(null);
  const salvo = useLiveQuery(() => db.contratos.get(id!), [id]);
  if (!salvo) return <p className="text-sm text-slate-500">Carregando…</p>;

  const ct = { ...CONTRATO_PADRAO, ...salvo } as Contrato;
  const pub = ct.modelo === 'publico';
  const e = l.empresa;
  const cliente = l.clienteMap.get(ct.clienteId);
  const rt = l.profissionalMap.get(ct.rtId || '') || l.profissionais.find((p) => p.ativo && p.conselho && p.conselho !== 'Nenhum' && p.registro);
  const unidades = ct.unidadesIds?.length ? ct.unidadesIds.map((u) => l.unidadeMap.get(u)).filter((u): u is NonNullable<typeof u> => !!u) : l.unidades.filter((u) => u.clienteId === ct.clienteId);
  const uIds = new Set(unidades.map((u) => u.id));
  const eqs = l.equipamentos.filter((x) => uIds.has(x.unidadeId) && x.status !== 'desativado');
  const capTotal = eqs.reduce((a, x) => a + (x.capacidadeBtu || 0), 0);
  const planos = [...new Set(eqs.map((x) => x.planoId).filter(Boolean))].map((p) => l.planoMap.get(p!)).filter((p): p is NonNullable<typeof p> => !!p);
  const meses = mesesVigencia(ct.inicio, ct.fim);
  const clausulas = clausulasContrato({ ct, empresa: e, cliente, rt });
  const titulo = pub ? `Termo de Contrato nº ${ct.numero}` : `Contrato de Prestação de Serviços nº ${ct.numero}`;
  const sla: Record<string, number | undefined> = { urgente: ct.slaUrgenteH, alta: ct.slaAltaH, media: ct.slaMediaH, baixa: ct.slaBaixaH };
  const local = ct.localAssinatura || e.cidade || cliente?.cidade || '__________';
  const dataAss = ct.dataAssinatura || ct.inicio;

  const td = 'border border-slate-400 px-1.5 py-0.5 align-top';
  const th = 'border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-left';
  const Resumo = ({ k, v }: { k: string; v?: React.ReactNode }) => (
    <tr><td className={th + ' w-44 font-semibold'}>{k}</td><td className={td}>{v || '—'}</td></tr>
  );
  const Assinatura = ({ nome, sub }: { nome: string; sub?: string }) => (
    <div className="pt-10 text-center text-[11px]">
      <p>______________________________________</p>
      <p className="font-semibold">{nome}</p>
      {sub && <p className="text-slate-600">{sub}</p>}
    </div>
  );

  const baixarWord = () => {
    if (!doc.current) return;
    const css = `body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:14pt;text-align:center;text-transform:uppercase}h2{font-size:11pt;text-transform:uppercase;margin:14pt 0 4pt}h3{font-size:11pt;text-align:center;text-transform:uppercase}p{text-align:justify;margin:0 0 6pt}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{border:1px solid #888;padding:2pt 4pt;vertical-align:top;text-align:left}.quebra{page-break-before:always}.centro{text-align:center}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${titulo}</title><style>${css}</style></head><body>${doc.current.innerHTML}</body></html>`;
    downloadText('﻿' + html, `${titulo.replace(/[^\w\d-]+/g, '-')}.doc`, 'application/msword;charset=utf-8');
  };

  return (
    <div>
      <PrintToolbar title={titulo}>
        <Badge className={pub ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200'}>{pub ? 'Modelo: Administração Pública (Lei 14.133/2021)' : 'Modelo: contrato particular (Código Civil)'}</Badge>
        <Button variant="outline" icon={<FileDown size={16} />} onClick={baixarWord}>Baixar Word (.doc)</Button>
        <Link to="/contratos"><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar</Button></Link>
      </PrintToolbar>
      <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 print:hidden dark:bg-amber-950/40 dark:text-amber-200">
        <Info size={16} className="mt-0.5 shrink-0" />
        Modelo de referência elaborado a partir de contratos de mercado de manutenção de climatização e de contratos administrativos. As cláusulas são montadas com os dados do cadastro do contrato (valores, SLA, peças, reajuste, multas, foro). Revise com sua assessoria jurídica antes de assinar; para ajustes de redação, baixe em Word.
      </p>
      <PrintPage>
        <div ref={doc} className="text-[11.5px] leading-relaxed">
          <div className="mb-3 flex items-center gap-3 border-b-2 border-brand-700 pb-2">
            {e.logo && <img src={e.logo} alt="" className="h-12 w-12 object-contain" />}
            <div className="text-[11px] text-slate-600">
              <b className="text-slate-900">{e.razaoSocial}</b>
              {e.cnpj && ` · CNPJ ${e.cnpj}`}
              <br />
              {[e.endereco, [e.cidade, e.uf].filter(Boolean).join('/'), e.telefone, e.email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <h1 className="text-center text-sm font-black uppercase">
            {pub ? 'Termo de Contrato' : 'Contrato de Prestação de Serviços'} de {ct.tipoServico || 'manutenção'} de sistemas de climatização
          </h1>
          <p className="centro mb-3 text-center font-semibold">Contrato nº {ct.numero}{pub && ct.processo ? ` · Processo nº ${ct.processo}` : ''}</p>

          <h2 className="mb-1 mt-3 text-[11.5px] font-bold uppercase">Quadro-resumo</h2>
          <table className="mb-3 w-full border-collapse text-[10.5px]">
            <tbody>
              <Resumo k="Contratante" v={[cliente?.nome, cliente?.cpfCnpj && `${cliente.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} ${cliente.cpfCnpj}`].filter(Boolean).join(' · ')} />
              <Resumo k="Contratada" v={[e.razaoSocial, e.cnpj && `CNPJ ${e.cnpj}`].filter(Boolean).join(' · ')} />
              <Resumo k="Objeto" v={ct.tipoServico} />
              <Resumo k="Locais atendidos" v={`${unidades.length} unidade(s): ${unidades.map((u) => u.nome).join('; ')}`} />
              <Resumo k="Equipamentos" v={`${eqs.length} equipamento(s) · ${fmtBtu(capTotal)} (${n2(btuToTr(capTotal))} TR)`} />
              <Resumo k="Vigência" v={`${fmtDate(ct.inicio)} a ${fmtDate(ct.fim)}${meses ? ` (${meses} meses)` : ''}`} />
              <Resumo k="Valor mensal" v={`${money(ct.valorMensal)} (${valorPorExtenso(ct.valorMensal || 0)})`} />
              <Resumo k="Valor total estimado" v={meses ? `${money((ct.valorMensal || 0) * meses)}` : undefined} />
              <Resumo k="Pagamento" v={pub ? 'Conforme Termo de Referência, após atesto da nota fiscal' : `Dia ${ct.diaVencimento || 10} do mês subsequente · ${ct.formaPagamento}`} />
              <Resumo k="Reajuste" v={`Anual · ${ct.reajusteIndice}`} />
              <Resumo k="Responsável técnico" v={rt ? `${rt.nome}${rt.registro ? ` · ${rt.conselho || ''} ${rt.registro}` : ''}` : undefined} />
              {pub && <Resumo k="Dotação orçamentária" v={ct.dotacao} />}
              {pub && <Resumo k="Gestor / fiscal" v={[ct.gestorContrato, ct.fiscalContrato].filter(Boolean).join(' / ')} />}
            </tbody>
          </table>

          <p className="mb-2 text-justify">{preambulo({ ct, empresa: e, cliente, rt })}</p>

          {clausulas.map((c, i) => (
            <section key={c.titulo} className="break-inside-avoid-page">
              <h2 className="mb-1 mt-3 text-[11.5px] font-bold uppercase">Cláusula {ordinal(i)} – {c.titulo}</h2>
              {c.paragrafos.map((p, j) => (
                <div key={j} className="mb-1">
                  <p className="text-justify"><b>{i + 1}.{j + 1}.</b> {p.t}</p>
                  {p.alineas && (
                    <div className="ml-5">
                      {p.alineas.map((a, k) => <p key={k} className="text-justify">{String.fromCharCode(97 + k)}) {a}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}

          <p className="mt-4 text-justify">{fechamento(ct)}</p>
          <p className="centro mt-4 text-center">{local}, {dataAss ? new Date(dataAss + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '____ de ______________ de ______'}.</p>

          <div className="grid grid-cols-2 gap-6">
            <Assinatura nome={cliente?.nome || 'CONTRATANTE'} sub={`CONTRATANTE${ct.representanteContratante ? ' — ' + ct.representanteContratante : ''}`} />
            <Assinatura nome={e.razaoSocial} sub={`CONTRATADA${ct.representanteContratada ? ' — ' + ct.representanteContratada : ''}`} />
            <Assinatura nome={ct.testemunha1 || 'Testemunha 1'} sub="Nome / CPF" />
            <Assinatura nome={ct.testemunha2 || 'Testemunha 2'} sub="Nome / CPF" />
          </div>

          {/* Anexo I */}
          <div className="quebra print:break-before-page" />
          <h3 className="mt-8 text-center text-[12px] font-bold uppercase">Anexo I — Relação de locais e equipamentos</h3>
          {unidades.map((u) => {
            const lista = eqs.filter((x) => x.unidadeId === u.id);
            const resumo = [...lista.reduce((m, x) => m.set(x.tipo, { q: (m.get(x.tipo)?.q || 0) + 1, btu: (m.get(x.tipo)?.btu || 0) + (x.capacidadeBtu || 0) }), new Map<string, { q: number; btu: number }>())];
            return (
              <div key={u.id} className="mt-3">
                <p className="font-semibold">{u.nome}</p>
                <p className="text-[10.5px] text-slate-600">{[u.endereco, u.numero, u.bairro, u.cidade && `${u.cidade}/${u.uf || ''}`].filter(Boolean).join(', ') || enderecoCliente(cliente)}</p>
                {eqs.length > LIMITE_LISTA ? (
                  <table className="mt-1 w-full border-collapse text-[10px]">
                    <thead><tr><th className={th}>Tipo de equipamento</th><th className={th}>Quantidade</th><th className={th}>Capacidade total</th></tr></thead>
                    <tbody>{resumo.map(([t, v]) => <tr key={t}><td className={td}>{t}</td><td className={td}>{v.q}</td><td className={td}>{fmtBtu(v.btu)}</td></tr>)}</tbody>
                  </table>
                ) : (
                  <table className="mt-1 w-full border-collapse text-[10px]">
                    <thead><tr><th className={th}>TAG</th><th className={th}>Tipo</th><th className={th}>Marca / modelo</th><th className={th}>Capacidade</th><th className={th}>Fluido</th><th className={th}>Ambiente</th><th className={th}>Patrimônio</th></tr></thead>
                    <tbody>
                      {lista.map((x) => (
                        <tr key={x.id}><td className={td}>{x.tag}</td><td className={td}>{x.tipo}</td><td className={td}>{[x.marca, x.modelo].filter(Boolean).join(' ')}</td><td className={td}>{x.capacidadeBtu ? fmtBtu(x.capacidadeBtu) : ''}</td><td className={td}>{x.fluido}</td><td className={td}>{l.ambienteMap.get(x.ambienteId || '')?.nome}</td><td className={td}>{x.patrimonio}</td></tr>
                      ))}
                      {!lista.length && <tr><td className={td} colSpan={7}>Equipamentos a cadastrar no levantamento inicial.</td></tr>}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          {eqs.length > LIMITE_LISTA && <p className="mt-1 text-[10px] text-slate-600">Relação resumida por tipo ({eqs.length} equipamentos). A relação individual, com TAG e localização, consta do Documento PMOC de cada unidade.</p>}

          {/* Anexo II */}
          <div className="quebra print:break-before-page" />
          <h3 className="mt-8 text-center text-[12px] font-bold uppercase">Anexo II — Plano de manutenção preventiva</h3>
          <p className="mt-1 text-justify text-[10.5px]">As atividades abaixo compõem os planos aplicados aos equipamentos. A periodicidade é controlada individualmente por equipamento: a próxima execução de cada rotina é calculada a partir da última execução registrada, podendo ser ajustada pelo responsável técnico conforme a NBR 13971 e o manual do fabricante.</p>
          {planos.map((p) => (
            <div key={p.id} className="mt-3 break-inside-avoid">
              <p className="font-semibold">{p.nome} <span className="font-normal text-slate-600">— {eqs.filter((x) => x.planoId === p.id).length} equipamento(s)</span></p>
              <table className="mt-1 w-full border-collapse text-[10px]">
                <thead><tr><th className={th}>Grupo</th><th className={th}>Atividade</th><th className={th}>Periodicidade</th></tr></thead>
                <tbody>
                  {p.atividades.filter((a) => a.periodicidade !== 'na').map((a) => (
                    <tr key={a.id}><td className={td}>{a.grupo}</td><td className={td}>{a.descricao}</td><td className={td + ' whitespace-nowrap'}>{periodicidadeLabel(a.periodicidade)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {!planos.length && <p className="mt-2 text-[10.5px]">Plano a ser definido no PMOC após o levantamento dos equipamentos.</p>}

          {/* Anexo III */}
          <div className="quebra print:break-before-page" />
          <h3 className="mt-8 text-center text-[12px] font-bold uppercase">Anexo III — Níveis de serviço (SLA)</h3>
          <table className="mt-2 w-full border-collapse text-[10.5px]">
            <thead><tr><th className={th}>Prioridade</th><th className={th}>Situações típicas</th><th className={th}>Prazo máximo para atendimento</th></tr></thead>
            <tbody>
              {[...PRIORIDADES].reverse().map((p) => (
                <tr key={p.value}><td className={td + ' font-semibold'}>{p.label}</td><td className={td}>{SITUACOES_SLA[p.value]}</td><td className={td}>{sla[p.value] ?? p.horasPadrao} horas</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-justify text-[10.5px]">Os prazos contam da abertura do chamado (data e hora registradas na ocorrência). O atendimento fora do prazo por causa imputável à CONTRATADA sujeita-se ao {pub ? 'redutor' : 'desconto'} de {String(ct.descontoSlaPct ?? 0).replace('.', ',')}% do valor mensal por ocorrência, limitado a 10%. A manutenção preventiva segue o cronograma do PMOC; a reprogramação deve ser comunicada ao CONTRATANTE com antecedência.</p>
        </div>
      </PrintPage>
    </div>
  );
}
