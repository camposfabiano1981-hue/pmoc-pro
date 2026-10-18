import type { AnaliseAr, Execucao, Ocorrencia, OS, Rotina } from '../db/types';
import type { Lookups } from './lookups';
import { MESES_CURTOS, diffDays, diffHours, todayStr } from './format';
import { isAtrasada } from './osHelpers';
import { totais } from '../components/widgets';
import { OS_FINALIZADAS } from './catalogs';

export interface Mes {
  ano: number;
  m: number;
  key: string;
  label: string;
}

export function ultimosMeses(n = 12, ref = new Date()): Mes[] {
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() - (n - 1 - k), 1);
    return { ano: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
  });
}

const dataRef = (o: OS) => (o.fim || o.dataAgendada || o.dataAbertura).slice(0, 7);

export function seriesMensais(osList: OS[], meses: Mes[]) {
  const ativos = osList.filter((o) => o.status !== 'cancelada');
  const concl = ativos.filter((o) => o.status === 'concluida' || o.status === 'validada');
  return {
    preventivas: meses.map((mm) => concl.filter((o) => o.tipo === 'Preventiva' && dataRef(o) === mm.key).length),
    corretivas: meses.map((mm) => ativos.filter((o) => ['Corretiva', 'Emergencial'].includes(o.tipo) && o.dataAbertura.slice(0, 7) === mm.key).length),
    outras: meses.map((mm) => concl.filter((o) => !['Preventiva', 'Corretiva', 'Emergencial'].includes(o.tipo) && dataRef(o) === mm.key).length),
    faturamento: meses.map((mm) => concl.filter((o) => dataRef(o) === mm.key).reduce((a, o) => a + totais(o.pecas, o.servicos, o.deslocamento, o.desconto).total, 0)),
  };
}

/** % de cumprimento das rotinas por mês: executadas ÷ (executadas + não executadas + vencidas no mês). */
export function cumprimentoMensal(execs: Execucao[], rotinas: Rotina[], meses: Mes[]): (number | null)[] {
  return cumprimentoDetalhado(execs, rotinas, meses).map((x) => (x.devidos ? Math.round((x.feitos / x.devidos) * 100) : null));
}

/** Cumprimento acumulado dos meses já encerrados (exclui o mês corrente, ainda em andamento). */
export function cumprimentoAcumulado(execs: Execucao[], rotinas: Rotina[], meses: Mes[], ref = new Date()): number | null {
  const atual = ref.getFullYear() * 12 + ref.getMonth();
  const det = cumprimentoDetalhado(execs, rotinas, meses).filter((_, i) => meses[i].ano * 12 + meses[i].m < atual);
  const devidos = det.reduce((a, x) => a + x.devidos, 0);
  return devidos ? Math.round((det.reduce((a, x) => a + x.feitos, 0) / devidos) * 100) : null;
}

export function cumprimentoDetalhado(execs: Execucao[], rotinas: Rotina[], meses: Mes[]): { devidos: number; feitos: number }[] {
  const hoje = todayStr();
  return meses.map((mm) => {
    const ex = execs.filter((e) => e.data.slice(0, 7) === mm.key);
    const feitos = ex.filter((e) => e.status === 'E').length;
    const nao = ex.filter((e) => e.status === 'N').length;
    const vencidas = rotinas.filter((r) => r.ativa && r.proximaExecucao < hoje && r.proximaExecucao.slice(0, 7) === mm.key).length;
    return { devidos: feitos + nao + vencidas, feitos };
  });
}

export function mttrHoras(osList: OS[]): number | null {
  const c = osList.filter((o) => ['Corretiva', 'Emergencial'].includes(o.tipo) && (o.status === 'concluida' || o.status === 'validada') && o.fim);
  if (!c.length) return null;
  return c.reduce((a, o) => a + Math.max(0, diffHours(o.fim, o.dataAbertura) || 0), 0) / c.length;
}

export function slaCumprido(osList: OS[]): number | null {
  const c = osList.filter((o) => (o.status === 'concluida' || o.status === 'validada') && o.prazo && o.fim);
  if (!c.length) return null;
  return Math.round((c.filter((o) => o.fim!.slice(0, 10) <= o.prazo!).length / c.length) * 100);
}

export interface Alerta {
  nivel: 'critico' | 'atencao' | 'info';
  texto: string;
  link: string;
}

export function alertas(l: Lookups, osList: OS[], ocorrencias: Ocorrencia[], analises: AnaliseAr[], rotinas: Rotina[] = []): Alerta[] {
  const out: Alerta[] = [];
  const hoje = todayStr();
  const venc = rotinas.filter((r) => r.ativa && r.proximaExecucao < hoje);
  if (venc.length) out.push({ nivel: 'critico', texto: `${venc.length} rotina(s) de manutenção vencida(s) em ${new Set(venc.map((r) => r.equipamentoId)).size} equipamento(s)`, link: '/cronograma' });
  const atrasadas = osList.filter((o) => isAtrasada(o, hoje));
  if (atrasadas.length) out.push({ nivel: 'critico', texto: `${atrasadas.length} OS atrasada(s) em relação ao prazo/SLA`, link: '/os?status=atrasadas' });
  const naoAn = ocorrencias.filter((o) => o.status === 'nao_analisada');
  if (naoAn.length) out.push({ nivel: 'atencao', texto: `${naoAn.length} ocorrência(s) não analisada(s)`, link: '/ocorrencias?status=nao_analisada' });
  const parados = l.equipamentos.filter((e) => e.status === 'parado');
  if (parados.length) out.push({ nivel: 'critico', texto: `${parados.length} equipamento(s) parado(s): ${parados.slice(0, 3).map((e) => e.tag).join(', ')}`, link: '/equipamentos?status=parado' });
  const baixo = l.pecas.filter((p) => p.ativo !== false && (p.estoque || 0) <= (p.estoqueMinimo || 0));
  if (baixo.length) out.push({ nivel: 'atencao', texto: `${baixo.length} peça(s) abaixo do estoque mínimo`, link: '/pecas?situacao=baixo' });
  for (const p of l.pmocs.filter((x) => x.status === 'vigente')) {
    const u = l.unidadeMap.get(p.unidadeId)?.nome;
    const dArt = diffDays(p.artFim, hoje);
    if (dArt !== null && dArt <= 30) out.push({ nivel: dArt < 0 ? 'critico' : 'atencao', texto: `${p.artTipo || 'ART'} do ${p.codigo} (${u}) ${dArt < 0 ? 'vencida' : `vence em ${dArt} dia(s)`}`, link: '/pmoc' });
    const dVig = diffDays(p.vigenciaFim, hoje);
    if (dVig !== null && dVig <= 45) out.push({ nivel: dVig < 0 ? 'critico' : 'atencao', texto: `Vigência do ${p.codigo} (${u}) ${dVig < 0 ? 'encerrada' : `termina em ${dVig} dia(s)`} — revisar o plano`, link: '/pmoc' });
    const ult = analises.filter((a) => a.unidadeId === p.unidadeId).sort((a, b) => b.data.localeCompare(a.data))[0];
    const dAn = ult ? diffDays(hoje, ult.data) : null;
    if (!ult || (dAn !== null && dAn > 180)) out.push({ nivel: 'atencao', texto: `Análise da qualidade do ar de ${u} ${ult ? `vencida (última há ${dAn} dias)` : 'não registrada'} — RE 09/2003`, link: '/qualidade-ar' });
  }
  for (const pr of l.profissionais.filter((x) => x.ativo)) {
    const itens = [{ nome: 'ASO', validade: pr.asoValidade }, ...pr.certificacoes];
    for (const c of itens) {
      const d = diffDays(c.validade, hoje);
      if (d !== null && d <= 30) out.push({ nivel: d < 0 ? 'critico' : 'atencao', texto: `${c.nome} de ${pr.nome} ${d < 0 ? 'vencido(a)' : `vence em ${d} dia(s)`}`, link: '/profissionais' });
    }
  }
  for (const c of l.contratos.filter((x) => x.status === 'ativo')) {
    const d = diffDays(c.fim, hoje);
    if (d !== null && d <= 45) out.push({ nivel: d < 0 ? 'critico' : 'atencao', texto: `Contrato ${c.numero} ${d < 0 ? 'vencido' : `vence em ${d} dia(s)`}`, link: '/contratos' });
  }
  const garantias = l.equipamentos.filter((e) => {
    const d = diffDays(e.garantiaAte, hoje);
    return d !== null && d >= 0 && d <= 30;
  });
  if (garantias.length) out.push({ nivel: 'info', texto: `${garantias.length} equipamento(s) com garantia expirando em 30 dias`, link: '/equipamentos' });
  const ordem = { critico: 0, atencao: 1, info: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

export function abertas(osList: OS[]) {
  return osList.filter((o) => !OS_FINALIZADAS.includes(o.status));
}
