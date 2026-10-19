import type { Cliente, Contrato, Empresa, Profissional } from '../db/types';
import { inteiroPorExtenso, valorPorExtenso } from './extenso';
import { addDays, diffDays, fmtDate, money } from './format';

/**
 * Modelo padrão de contrato de prestação de serviços de manutenção de sistemas de
 * climatização (PMOC), redigido a partir de contratos de mercado e de contratos
 * administrativos de manutenção de ar-condicionado. Revise com assessoria jurídica.
 */

export interface Paragrafo {
  t: string;
  alineas?: string[];
}

export interface Clausula {
  titulo: string;
  paragrafos: Paragrafo[];
}

export interface ContextoContrato {
  ct: Contrato;
  empresa: Empresa;
  cliente?: Cliente;
  rt?: Profissional;
}

export const CONTRATO_PADRAO: Partial<Contrato> = {
  modelo: 'privado',
  tipoServico: 'Manutenção preventiva e corretiva (PMOC)',
  periodicidadeVisitas: 'mensais',
  horarioAtendimento: 'de segunda a sexta-feira, das 8h às 18h',
  atendimento24h: false,
  pecasInclusas: 'nao',
  fluidoIncluso: false,
  analiseArInclusa: false,
  formaPagamento: 'boleto bancário ou PIX',
  reajusteIndice: 'IPCA/IBGE',
  renovacaoAutomatica: true,
  avisoPrevioDias: 30,
  multaAtrasoPct: 2,
  jurosMesPct: 1,
  multaRescisaoPct: 20,
  descontoSlaPct: 2,
  garantiaDias: 90,
  diaVencimento: 10,
};

export const TIPOS_SERVICO_CONTRATO = [
  'Manutenção preventiva e corretiva (PMOC)',
  'Manutenção preventiva (PMOC)',
  'Responsabilidade técnica e elaboração do PMOC',
  'Manutenção de refrigeração comercial e câmaras frias',
];

const ORDINAIS = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA'];
export function ordinal(i: number): string {
  if (i < 10) return ORDINAIS[i];
  if (i < 20) return `DÉCIMA ${ORDINAIS[i - 10]}`;
  return `VIGÉSIMA${i > 20 ? ' ' + ORDINAIS[i - 21] : ''}`;
}

export function mesesVigencia(inicio?: string, fim?: string): number {
  const d = diffDays(fim ? addDays(fim, 1) : undefined, inicio);
  return d ? Math.max(1, Math.round(d / 30.4375)) : 0;
}

const pct = (n?: number) => `${String(n ?? 0).replace('.', ',')}%`;
const reais = (n?: number) => `${money(n || 0)} (${valorPorExtenso(n || 0)})`;
const minusc = (s?: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');

export function enderecoCliente(c?: Cliente): string {
  if (!c) return '';
  return [c.endereco && `${c.endereco}${c.numero ? ', ' + c.numero : ''}`, c.complemento, c.bairro, c.cidade && `${c.cidade}/${c.uf || ''}`, c.cep && `CEP ${c.cep}`].filter(Boolean).join(', ');
}

export function preambulo({ ct, empresa, cliente }: ContextoContrato): string {
  const doc = cliente?.tipoPessoa === 'PF' ? `inscrito(a) no CPF sob o nº ${cliente?.cpfCnpj || '___________'}` : `inscrito(a) no CNPJ sob o nº ${cliente?.cpfCnpj || '___________'}`;
  const contratante = `${cliente?.nome || '____________________'}, ${doc}, com endereço em ${enderecoCliente(cliente) || '____________________'}${ct.representanteContratante ? `, neste ato representado(a) por ${ct.representanteContratante}` : ''}, doravante denominado(a) CONTRATANTE`;
  const contratada = `${empresa.razaoSocial}, inscrita no CNPJ sob o nº ${empresa.cnpj || '___________'}, com sede em ${[empresa.endereco, empresa.cidade && `${empresa.cidade}/${empresa.uf || ''}`, empresa.cep && `CEP ${empresa.cep}`].filter(Boolean).join(', ') || '____________________'}${ct.representanteContratada ? `, neste ato representada por ${ct.representanteContratada}` : ''}, doravante denominada CONTRATADA`;
  if (ct.modelo === 'publico')
    return `${contratante}, e ${contratada}, tendo em vista o que consta no Processo nº ${ct.processo || '_______'} e em observância às disposições da Lei nº 14.133, de 1º de abril de 2021, e demais legislação aplicável, resolvem celebrar o presente Termo de Contrato, decorrente do ${ct.licitacao || '__________ nº ___/____'}, mediante as cláusulas e condições a seguir enunciadas.`;
  return `Pelo presente instrumento particular, de um lado ${contratante}, e, de outro lado, ${contratada}, têm entre si justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições seguintes e, no que forem omissas, pelos arts. 593 a 609 do Código Civil.`;
}

export function clausulasContrato(x: ContextoContrato): Clausula[] {
  const ct = { ...CONTRATO_PADRAO, ...x.ct } as Contrato;
  const pub = ct.modelo === 'publico';
  const meses = mesesVigencia(ct.inicio, ct.fim);
  const total = (ct.valorMensal || 0) * meses;
  const rt = x.rt;
  const out: Clausula[] = [];

  out.push({
    titulo: 'DO OBJETO',
    paragrafos: [
      { t: `O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de ${minusc(ct.tipoServico)} dos sistemas de climatização e refrigeração dos imóveis do CONTRATANTE relacionados no Anexo I, compreendendo a execução do Plano de Manutenção, Operação e Controle – PMOC.` },
      ...(ct.objeto ? [{ t: `Escopo específico: ${ct.objeto.trim()}` }] : []),
      { t: 'Os serviços serão executados em conformidade com a Lei nº 13.589/2018, a Portaria GM/MS nº 3.523/1998, a Resolução ANVISA RE nº 09/2003, as normas ABNT NBR 13971, NBR 16401 e NBR 15848, as Normas Regulamentadoras aplicáveis e as recomendações dos fabricantes dos equipamentos.' },
      { t: `Integram este contrato, independentemente de transcrição: Anexo I – Relação de locais e equipamentos; Anexo II – Plano de manutenção preventiva; Anexo III – Níveis de serviço (SLA)${pub ? '; o Termo de Referência, o Edital e a Proposta da CONTRATADA' : '; e a proposta comercial da CONTRATADA'}.` },
    ],
  });

  out.push({
    titulo: 'DA EXECUÇÃO DOS SERVIÇOS',
    paragrafos: [
      { t: `Manutenção preventiva: executada conforme o plano de manutenção de cada equipamento (Anexo II), com periodicidade controlada individualmente por equipamento e visitas ${ct.periodicidadeVisitas || 'mensais'}, programadas com antecedência mínima de 48 (quarenta e oito) horas e registradas em ordem de serviço.` },
      { t: 'Manutenção corretiva: atendimento aos chamados abertos pelo CONTRATANTE por telefone, e-mail ou sistema, nos prazos do Anexo III, contados da abertura do chamado.' },
      { t: 'Cada atendimento será registrado em ordem de serviço com as atividades realizadas (executada, pendente ou não executada, com o motivo), medições, peças e materiais aplicados, horários e assinatura do responsável do CONTRATANTE, compondo o histórico de cada equipamento.' },
      { t: `Os serviços serão prestados ${ct.horarioAtendimento || 'em horário comercial'}. ${ct.atendimento24h ? 'Os atendimentos emergenciais fora desse horário, inclusive aos sábados, domingos e feriados, estão incluídos no preço mensal.' : 'Os atendimentos solicitados fora desse horário serão cobrados à parte, mediante aceite prévio do CONTRATANTE.'}` },
      { t: 'A limpeza e a higienização utilizarão produtos biodegradáveis registrados na ANVISA. Os resíduos e os fluidos refrigerantes recolhidos terão destinação ambientalmente adequada, sendo vedada a liberação de fluido refrigerante na atmosfera.' },
      { t: 'Mensalmente, a CONTRATADA entregará relatório dos serviços com o cumprimento do plano de manutenção por equipamento (programado, reprogramado, executado e não executado), as ocorrências atendidas e as recomendações técnicas.' },
    ],
  });

  out.push({
    titulo: 'DO PMOC E DA RESPONSABILIDADE TÉCNICA',
    paragrafos: [
      { t: `A CONTRATADA manterá responsável técnico legalmente habilitado${rt ? `, ${rt.nome}${rt.registro ? `, ${rt.conselho || 'registro'} nº ${rt.registro}` : ''}` : ''}, que responderá tecnicamente pelo PMOC, com a respectiva ART/TRT registrada no conselho profissional competente.` },
      { t: 'Compete à CONTRATADA elaborar, implantar e manter atualizado o PMOC, que ficará disponível no imóvel para consulta dos ocupantes e das autoridades sanitárias, juntamente com os registros de execução das manutenções.' },
      {
        t: ct.analiseArInclusa
          ? 'Estão incluídas no preço as análises semestrais da qualidade do ar interior, conforme a Resolução ANVISA RE nº 09/2003, realizadas por laboratório habilitado.'
          : 'As análises da qualidade do ar interior previstas na Resolução ANVISA RE nº 09/2003 não estão incluídas no preço e poderão ser contratadas à parte.',
      },
    ],
  });

  out.push({
    titulo: 'DAS OBRIGAÇÕES DA CONTRATADA',
    paragrafos: [
      {
        t: 'Constituem obrigações da CONTRATADA, além das previstas na legislação:',
        alineas: [
          'executar os serviços com pessoal qualificado, identificado e uniformizado, treinado nas NR-10 e NR-35 quando aplicável, e com os equipamentos de proteção individual exigidos pela NR-6;',
          'fornecer ferramentas, instrumentos de medição calibrados, equipamentos e os materiais de consumo necessários às rotinas preventivas;',
          'cumprir os prazos de atendimento e o cronograma de manutenção, comunicando previamente qualquer reprogramação;',
          'comunicar por escrito ao CONTRATANTE as anormalidades encontradas e as substituições de peças necessárias, com orçamento prévio;',
          'responder pelos danos causados ao CONTRATANTE ou a terceiros por culpa ou dolo de seus empregados ou prepostos na execução dos serviços;',
          'arcar com os encargos trabalhistas, previdenciários, fiscais e comerciais decorrentes da execução do contrato;',
          `manter, durante toda a vigência, as condições de habilitação e de regularidade fiscal e trabalhista${pub ? ' exigidas na licitação' : ''};`,
          'observar as normas internas de segurança, acesso e conduta do CONTRATANTE;',
          ...(pub ? ['manter preposto aceito pela Administração para representá-la na execução do contrato (art. 118 da Lei nº 14.133/2021);'] : []),
          'manter sigilo sobre as informações do CONTRATANTE a que tiver acesso.',
        ],
      },
    ],
  });

  out.push({
    titulo: 'DAS OBRIGAÇÕES DO CONTRATANTE',
    paragrafos: [
      {
        t: 'Constituem obrigações do CONTRATANTE:',
        alineas: [
          'permitir o acesso dos técnicos aos locais e equipamentos nas datas e horários programados;',
          'efetuar os pagamentos nas condições e prazos estabelecidos;',
          `designar ${pub ? 'gestor e fiscal' : 'representante'} para acompanhar os serviços, assinar as ordens de serviço e receber os relatórios;`,
          'comunicar prontamente à CONTRATADA as falhas e anormalidades nos equipamentos;',
          'não permitir que terceiros não autorizados intervenham nos equipamentos cobertos por este contrato, sob pena de exclusão da garantia dos serviços;',
          'analisar e responder aos orçamentos de peças e serviços extras no prazo de até 5 (cinco) dias úteis;',
          'observar as recomendações de uso e de emergência constantes do PMOC.',
        ],
      },
    ],
  });

  const pecas =
    ct.pecasInclusas === 'sim'
      ? 'Estão incluídos no preço mensal as peças e os componentes de reposição necessários ao funcionamento dos equipamentos, exceto compressores, placas eletrônicas, serpentinas e gabinetes, bem como os danos causados por mau uso, vandalismo, sinistros, descargas atmosféricas ou oscilações da rede elétrica, que serão orçados à parte.'
      : ct.pecasInclusas === 'limite'
        ? `Estão incluídos no preço mensal peças e componentes de reposição até o limite de ${reais(ct.limitePecasMensal)} por mês, não cumulativo; o que exceder será fornecido mediante orçamento prévio aprovado pelo CONTRATANTE.`
        : 'As peças, componentes e materiais de reposição não estão incluídos no preço mensal e serão fornecidos mediante orçamento prévio aprovado pelo CONTRATANTE.';
  out.push({
    titulo: 'DAS PEÇAS, COMPONENTES E MATERIAIS',
    paragrafos: [
      { t: pecas },
      {
        t: ct.fluidoIncluso
          ? 'Está incluída a complementação de carga de fluido refrigerante decorrente das rotinas preventivas; a recarga após vazamento ou substituição de componente será orçada à parte.'
          : 'O fluido refrigerante será cobrado por quilograma aplicado, mediante orçamento prévio.',
      },
      { t: 'Estão incluídos no preço os materiais de consumo das rotinas preventivas, tais como produtos de limpeza e higienização, bactericidas, lubrificantes, fitas e abraçadeiras.' },
      { t: 'As peças empregadas serão novas, originais ou de qualidade equivalente, e as peças substituídas ficarão à disposição do CONTRATANTE.' },
    ],
  });

  out.push({
    titulo: 'DO PREÇO E DO PAGAMENTO',
    paragrafos: [
      { t: `Pelos serviços, o CONTRATANTE pagará à CONTRATADA o valor mensal de ${reais(ct.valorMensal)}${meses ? `, perfazendo ${reais(total)} para os ${meses} (${inteiroPorExtenso(meses)}) meses de vigência` : ''}.` },
      pub
        ? { t: 'O pagamento será efetuado no prazo previsto no Termo de Referência, contado do atesto da nota fiscal pelo fiscal do contrato, observada a ordem cronológica de pagamentos de que trata o art. 141 da Lei nº 14.133/2021.' }
        : { t: `O pagamento será efetuado até o dia ${ct.diaVencimento || 10} do mês subsequente ao da prestação dos serviços, por ${ct.formaPagamento || 'boleto bancário ou PIX'}, contra apresentação da nota fiscal acompanhada do relatório mensal de serviços.` },
      pub
        ? { t: `Em caso de atraso imputável ao CONTRATANTE, o valor devido será atualizado monetariamente pelo ${ct.reajusteIndice || 'IPCA/IBGE'} desde o vencimento até o efetivo pagamento.` }
        : { t: `Em caso de atraso, incidirão multa de ${pct(ct.multaAtrasoPct)} sobre o valor em atraso, juros de mora de ${pct(ct.jurosMesPct)} ao mês pro rata die e atualização monetária pelo ${ct.reajusteIndice || 'IPCA/IBGE'}.` },
      { t: 'Os serviços extras, como peças não incluídas e atendimentos fora do escopo, serão faturados separadamente, após a aprovação do orçamento.' },
    ],
  });

  out.push({
    titulo: 'DO REAJUSTE',
    paragrafos: pub
      ? [
          { t: 'Os preços são fixos e irreajustáveis pelo prazo de um ano contado da data do orçamento estimado (data-base), nos termos do art. 92, § 3º, da Lei nº 14.133/2021.' },
          { t: `Após o interregno de um ano, os preços iniciais serão reajustados pela variação acumulada do ${ct.reajusteIndice || 'IPCA/IBGE'}, exclusivamente para as obrigações iniciadas e concluídas após a ocorrência da anualidade.` },
          { t: 'O reajuste será formalizado por simples apostila, nos termos do art. 136, inciso I, da Lei nº 14.133/2021.' },
        ]
      : [{ t: `O preço será reajustado a cada 12 (doze) meses, contados do início da vigência, pela variação acumulada do ${ct.reajusteIndice || 'IPCA/IBGE'} no período, ou por outro índice oficial que venha a substituí-lo.` }],
  });

  out.push({
    titulo: 'DA VIGÊNCIA',
    paragrafos: pub
      ? [
          { t: `O presente contrato vigorará de ${fmtDate(ct.inicio)} a ${fmtDate(ct.fim)}${meses ? `, pelo prazo de ${meses} meses` : ''}.` },
          { t: 'Por se tratar de serviço contínuo, a vigência poderá ser prorrogada sucessivamente, respeitada a vigência máxima decenal, desde que haja previsão em edital e que a autoridade competente ateste que as condições e os preços permanecem vantajosos para a Administração (arts. 106 e 107 da Lei nº 14.133/2021).' },
          { t: 'A eficácia deste contrato e de seus aditamentos fica condicionada à divulgação no Portal Nacional de Contratações Públicas – PNCP (art. 94 da Lei nº 14.133/2021).' },
        ]
      : [
          { t: `O presente contrato vigorará de ${fmtDate(ct.inicio)} a ${fmtDate(ct.fim)}${meses ? `, pelo prazo de ${meses} meses` : ''}.` },
          {
            t: ct.renovacaoAutomatica
              ? `Findo o prazo, o contrato será renovado automaticamente por iguais períodos, salvo manifestação em contrário de qualquer das partes, por escrito, com antecedência mínima de ${ct.avisoPrevioDias || 30} dias.`
              : 'A prorrogação dependerá de termo aditivo assinado pelas partes.',
          },
        ],
  });

  if (pub) {
    out.push({
      titulo: 'DA DOTAÇÃO ORÇAMENTÁRIA',
      paragrafos: [{ t: `As despesas decorrentes desta contratação correrão à conta da dotação orçamentária ${ct.dotacao || '____________'}, consignada no orçamento do exercício de ${ct.inicio?.slice(0, 4) || '____'}; nos exercícios seguintes, as despesas correrão à conta dos créditos próprios.` }],
    });
    out.push({
      titulo: 'DA GESTÃO E FISCALIZAÇÃO',
      paragrafos: [
        { t: `A execução do contrato será acompanhada e fiscalizada pelo gestor do contrato${ct.gestorContrato ? `, ${ct.gestorContrato}` : ''}, e pelo fiscal do contrato${ct.fiscalContrato ? `, ${ct.fiscalContrato}` : ''}, designados pela Administração, nos termos do art. 117 da Lei nº 14.133/2021.` },
        { t: 'O fiscal anotará em registro próprio todas as ocorrências relacionadas à execução do contrato, determinando o que for necessário para a regularização das faltas ou dos defeitos observados.' },
      ],
    });
    if (ct.garantiaContratualPct)
      out.push({
        titulo: 'DA GARANTIA DE EXECUÇÃO',
        paragrafos: [{ t: `A CONTRATADA prestará garantia de ${pct(ct.garantiaContratualPct)} do valor inicial do contrato, em uma das modalidades previstas no art. 96, § 1º, da Lei nº 14.133/2021, observado o art. 98.` }],
      });
  }

  out.push({
    titulo: 'DA GARANTIA DOS SERVIÇOS',
    paragrafos: [{ t: `Os serviços executados terão garantia de ${ct.garantiaDias || 90} dias contados da execução, e as peças fornecidas terão a garantia do fabricante. A garantia não cobre defeitos decorrentes de mau uso, intervenção de terceiros, sinistros, descargas atmosféricas ou oscilações da rede elétrica.` }],
  });

  const glosa = `O atendimento a chamado fora dos prazos do Anexo III, por causa imputável à CONTRATADA, implicará ${pub ? 'glosa' : 'desconto'} de ${pct(ct.descontoSlaPct)} do valor mensal por ocorrência, limitado a 10% (dez por cento) do valor mensal.`;
  if (pub) {
    out.push({
      titulo: 'DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS',
      paragrafos: [
        { t: 'Pelas infrações previstas no art. 155 da Lei nº 14.133/2021, a CONTRATADA ficará sujeita às sanções do art. 156: advertência, multa, impedimento de licitar e contratar e declaração de inidoneidade para licitar ou contratar, assegurados o contraditório e a ampla defesa.' },
        { t: `A multa compensatória será de ${pct(ct.multaRescisaoPct)} do valor do contrato, observados os limites do art. 156, § 3º; o atraso injustificado na execução sujeitará a CONTRATADA à multa de mora, na forma do art. 162.` },
        { t: glosa },
      ],
    });
    out.push({
      titulo: 'DAS ALTERAÇÕES E DA EXTINÇÃO',
      paragrafos: [
        { t: 'As alterações contratuais observarão os arts. 124 a 136 da Lei nº 14.133/2021, ficando a CONTRATADA obrigada a aceitar, nas mesmas condições contratuais, acréscimos ou supressões de até 25% (vinte e cinco por cento) do valor inicial atualizado do contrato (art. 125).' },
        { t: 'O contrato poderá ser extinto nas hipóteses do art. 137 da Lei nº 14.133/2021, na forma do art. 138, assegurados o contraditório e a ampla defesa, com as consequências previstas no art. 139.' },
      ],
    });
  } else {
    out.push({ titulo: 'DAS PENALIDADES', paragrafos: [{ t: glosa }] });
    out.push({
      titulo: 'DA RESCISÃO',
      paragrafos: [
        { t: `O contrato poderá ser rescindido por qualquer das partes, sem justa causa, mediante aviso prévio por escrito de ${ct.avisoPrevioDias || 30} dias.` },
        { t: `A rescisão sem a observância do aviso prévio sujeitará a parte que lhe der causa à multa de ${pct(ct.multaRescisaoPct)} sobre o valor das mensalidades restantes até o término da vigência.` },
        { t: 'O contrato será rescindido de pleno direito, independentemente de aviso, em caso de descumprimento de cláusula contratual não sanado em 10 (dez) dias da notificação, ou de falência, recuperação judicial ou dissolução de qualquer das partes.' },
        { t: 'A rescisão não exime o CONTRATANTE do pagamento dos serviços já executados.' },
      ],
    });
  }

  out.push({
    titulo: 'DA PROTEÇÃO DE DADOS E DA CONFIDENCIALIDADE',
    paragrafos: [{ t: 'As partes tratarão os dados pessoais a que tiverem acesso exclusivamente para a execução deste contrato, em conformidade com a Lei nº 13.709/2018 (LGPD), adotando medidas de segurança adequadas e mantendo sigilo sobre as informações recebidas, obrigação que subsiste após o término do contrato.' }],
  });

  out.push({
    titulo: 'DAS DISPOSIÇÕES GERAIS',
    paragrafos: [
      {
        t: 'As partes estabelecem que:',
        alineas: [
          'não se estabelece entre as partes, nem entre o CONTRATANTE e os empregados da CONTRATADA, qualquer vínculo empregatício;',
          'a tolerância quanto ao descumprimento de qualquer cláusula não implicará novação ou renúncia de direitos;',
          pub ? 'as alterações serão formalizadas por termo aditivo ou apostila, conforme o caso;' : 'qualquer alteração somente terá validade mediante termo aditivo assinado pelas partes;',
          'é vedada a cessão ou a transferência, total ou parcial, deste contrato sem anuência prévia e por escrito da outra parte;',
          'as comunicações entre as partes serão feitas por escrito, admitido o correio eletrônico;',
          'as partes declaram conhecer e observar a Lei nº 12.846/2013 (Lei Anticorrupção).',
        ],
      },
      ...(pub ? [{ t: 'Os casos omissos serão decididos pelo CONTRATANTE, segundo as disposições da Lei nº 14.133/2021 e demais normas aplicáveis e, subsidiariamente, segundo os princípios gerais dos contratos.' }] : []),
    ],
  });

  const adicionais = (ct.clausulasAdicionais || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (adicionais.length) out.push({ titulo: 'DAS CONDIÇÕES ESPECÍFICAS', paragrafos: adicionais.map((t) => ({ t })) });

  out.push({
    titulo: 'DO FORO',
    paragrafos: [
      pub
        ? { t: `Fica eleito o foro da sede da Administração${ct.foro ? `, ${ct.foro},` : ''} para dirimir as questões decorrentes deste contrato, nos termos do art. 92, § 1º, da Lei nº 14.133/2021.` }
        : { t: `Fica eleito o foro da comarca de ${ct.foro || x.empresa.cidade || '__________'} para dirimir as questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.` },
    ],
  });
  return out;
}

export function fechamento(ct: Contrato): string {
  return ct.modelo === 'publico'
    ? 'Para firmeza e validade do pactuado, o presente Termo de Contrato, depois de lido e achado em ordem, vai assinado pelos contraentes.'
    : 'E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.';
}

/** Exemplos de situações por prioridade (Anexo III — níveis de serviço). */
export const SITUACOES_SLA: Record<string, string> = {
  urgente: 'Parada de ambiente crítico (CPD, centro cirúrgico, câmara fria, laboratório), vazamento de água sobre pessoas ou equipamentos, risco à segurança.',
  alta: 'Parada de equipamento sem redundância; ambiente sem climatização.',
  media: 'Funcionamento deficiente, ruído ou vibração anormal, gotejamento, baixa eficiência.',
  baixa: 'Ajustes, orientações e serviços programáveis.',
};
