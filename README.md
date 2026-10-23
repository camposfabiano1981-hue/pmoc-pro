# PMOC Pro — Plano de Manutenção, Operação e Controle

Plataforma web para gestão de **PMOC** e manutenção de **climatização e refrigeração (HVAC-R)**:
ordens de serviço, cronograma anual, equipamentos com QR Code, estoque de peças, catálogo de serviços,
equipe técnica, qualidade do ar, fluidos refrigerantes, contratos e o documento PMOC pronto para impressão —
além dos módulos **Comercial** (funil de licitações e propostas) e **Precificação** (custo-hora, BDI pelo TCU e composição de preços).

Atende à **Lei Federal nº 13.589/2018**, à **Portaria GM/MS nº 3.523/1998 (Anexo I)**, à **Resolução ANVISA RE nº 09/2003**
e à **ABNT NBR 13971**. Funciona 100% no navegador (inclusive offline, no celular do técnico) e é publicada
gratuitamente pelo **GitHub Pages**, sem servidor nem banco de dados para contratar.

---

## O que a plataforma faz

| Módulo | Recursos |
|---|---|
| **Preventivas (central)** | O processo da preventiva em 5 etapas visíveis: **A programar** (equipamentos com rotinas vencidas ou a vencer, sem OS) → **Programadas** → **Em execução** → **Aguardando liberação** → **Liberadas**. Botões **Programar** (escolhe as rotinas, data e técnico), **Executar agora** (cria a OS e abre o lançamento no celular), programação em lote, reprogramação de data, atribuição de técnico e liberação em um clique |
| **Painel** | OS em aberto/atrasadas, cumprimento do PMOC, MTTR, SLA, disponibilidade, capacidade instalada (TR), gráficos mensais e central de alertas |
| **Periodicidade por equipamento** | Cada equipamento tem suas **rotinas** (atividade × periodicidade em dias) com **última execução** e **próxima execução**: a próxima é recalculada a partir da última execução lançada pela equipe técnica. Ajuste fino por equipamento (intervalo, tempo, setor, responsável, reprogramação de data), histórico de execuções e status (em dia / a vencer / vencida) |
| **Área do técnico** | Tela para celular: OS do técnico (em execução, atrasadas, hoje, próximos dias), check-in, lançamento de cada tarefa como **E** (executado), **P** (pendente) ou **N** (não executado, com motivo), tempo real, material, medições, fotos, materiais do estoque e assinaturas. Cada lançamento fica registrado com o executante e a data/hora |
| **Perfis de acesso** | Técnico (lança execuções), Supervisor (libera as OS) e Gestor (acesso total), com PIN opcional e troca rápida de usuário |
| **Ordens de serviço** | Formulário completo (informações gerais, padrões de execução, identificação do ambiente, proprietário e responsável técnico, tarefas E/P/N com tempo previsto × real e material, equipamento inserido com tarefas em branco (a OS pode ser corretiva, instalação, visita etc.), botões **Incluir rotinas do equipamento** (todas) e **Incluir rotinas (individual)** com a situação de cada uma — rotinas programadas em outra OS ainda sem lançamento podem ser **transferidas** para a OS atual, sem duplicar — e **exclusão de rotina** da OS — só desta OS ou também desativando no equipamento, com registro no histórico, executantes, parada e interferência, alteração de localização, assinaturas do executante, responsável e supervisor, data/hora de liberação). Impressão preenchida ou **formulário em branco** para campo. Lista e quadro Kanban (arrastar e soltar), filtros, tipos (preventiva, corretiva, emergencial, higienização, instalação…), prioridade com **SLA do contrato**, equipe, checklist por equipamento (OK / Corrigido / NOK / N/A), **medições de campo com diagnóstico automático** (ΔT, superaquecimento e sub-resfriamento por tabela P×T de 10 fluidos), peças com **baixa automática no estoque**, serviços, apontamento de horas, laudo, fotos (câmera do celular), **assinatura digital** do técnico e do cliente, avaliação, histórico, salvamento automático e impressão/PDF com QR Code |
| **Ocorrências / chamados** | Quebra, processo, anomalia simples/crítica, chamado, vazamento — conversão em OS com um clique. **Impressão** do registro (identificação, local e equipamento, descrição, análise, atendimento com tempos e SLA, assinaturas) e **formulário em branco** para abertura em campo |
| **Orçamentos** | Itens de serviços e peças, desconto, deslocamento, validade, impressão e conversão em OS |
| **Documento PMOC** | Capa, identificação da edificação, proprietário e responsável técnico (ART/TRT/RRT), relação de ambientes com renovação de ar mínima, relação de equipamentos, **plano de manutenção por equipamento** (periodicidade, última e próxima execução e meses previstos/executados), registro de execução por equipamento, qualidade do ar, recomendações de emergência, normas e termo de responsabilidade |
| **Cronograma por equipamento** | **Previsão diária** (dias 1–31, como o cronograma de manutenção periódica) e **visão anual**, rotina a rotina, na legenda de cores do PMOC; clique em um dia para reprogramar (a rotina ou a OS já gerada). **Geração automática das OS preventivas** (uma por equipamento, por ambiente ou por unidade), sem duplicar rotinas já programadas |
| **Contratos** | **Contrato padrão de prestação de serviços** de manutenção de climatização (PMOC), montado com os dados do cadastro: quadro-resumo, objeto, execução, PMOC e responsabilidade técnica, obrigações das partes, peças e fluido, preço com **valor por extenso**, reajuste, vigência, garantia, penalidades por SLA, rescisão, LGPD, foro e assinaturas com testemunhas, além dos **Anexos I** (locais e equipamentos), **II** (plano de manutenção) e **III** (níveis de serviço). Dois modelos: **particular** (Código Civil) e **Administração Pública** (Lei 14.133/2021: dotação, gestor e fiscal, garantia contratual, sanções, apostilamento do reajuste, PNCP). Impressão/PDF e download em **Word (.doc)** para ajustes de redação |
| **Comercial** | **Painel comercial** (sessões dos próximos dias, receita mensal contratada, contratos a vencer em 90 dias, aniversários para reajuste, orçamentos aguardando) e **funil de oportunidades e licitações**: edital, modalidade, critério de julgamento, portal, data da sessão, valor estimado × proposta, resultado e motivo. Da oportunidade saem o **estudo de preço** e, quando ganha, o **contrato** já preenchido |
| **Precificação** | **Tributos, encargos e BDI** (Simples Nacional Anexo III com alíquota efetiva e repartição dos tributos, Lucro Presumido ou Real, desoneração da folha na transição da Lei 14.973/2024), **custo-hora por cargo** na estrutura de módulos da IN SEGES 5/2017, custos operacionais, **estudo de preço por equipamento** a partir das horas do plano PMOC, **BDI pela fórmula do Acórdão TCU 2622/2013** com as faixas de referência, lance mínimo, alerta de exequibilidade (Lei 14.133/2021, art. 59) e **composição de preços** impressa |
| **Planos de manutenção** | 8 planos prontos e editáveis: Portaria 3.523 (Anexo I completo), Split/Janela, VRF/VRV, Chiller, Fan Coil/Self/AHU, Torre de resfriamento, Câmara fria/refrigeração comercial, Exaustão. Periodicidades diária a anual, tempo padrão e faixas de medição |
| **Qualidade do ar** | Laudos da RE 09/2003 (fungos, relação I/E, CO₂, aerodispersóides, temperatura, umidade, velocidade, renovação) com avaliação automática e alerta de vencimento semestral |
| **Fluidos refrigerantes** | Cargas, recolhimentos, vazamentos e testes de estanqueidade por equipamento, com **tCO₂e** (GWP) |
| **Cadastros** | Clientes, unidades, ambientes (ocupação, área, carga térmica), equipamentos (ficha técnica, criticidade, garantia, QR Code, histórico, MTBF, custo), profissionais (CREA/CFT, NRs, ASO com vencimento), serviços, peças, fornecedores, contratos |
| **Estoque** | Entradas, saídas e ajustes com custo médio ponderado, alerta de mínimo e **sugestão de compra** em Excel |
| **Relatórios** | Produtividade da equipe, confiabilidade por equipamento (corretivas, MTBF, itens NOK, custo), custos por unidade, peças consumidas, fluidos — exportação Excel e impressão |
| **Importação** | Lê planilhas PMOC existentes (abas `Eq_*` e `Rel_areas`, ou o modelo fornecido) e cria unidades, ambientes e equipamentos automaticamente |
| **Backup** | Exporta/restaura tudo em JSON; opção de **mesclar** backups enviados por vários técnicos |

Também: menu por módulos (Operação, PMOC, Comercial, Precificação, Cadastros, Estoque, Gestão) com contadores de pendências, busca global, tema claro/escuro, layout para celular, etiquetas QR em lote para impressão em papel adesivo e exportação CSV/Excel de todas as listas.

---

## Publicar no GitHub Pages (passo a passo)

1. Crie um repositório no GitHub (ex.: `pmoc-pro`) e envie esta pasta:
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/pmoc-pro.git
   git push -u origin main
   ```
2. No repositório, abra **Settings → Pages** e em **Build and deployment → Source** escolha **GitHub Actions**.
3. O workflow `.github/workflows/deploy.yml` roda os testes, gera o build e publica. Em ~2 minutos o sistema estará em
   `https://SEU-USUARIO.github.io/pmoc-pro/`.

A cada `git push` na branch `main` o site é atualizado automaticamente (acompanhe em **Actions**; a publicação leva de 1 a 3 minutos depois que o job começa).

A versão publicada aparece no rodapé do menu lateral (ex.: *Versão 862464e*). Quem estiver com o sistema aberto recebe o aviso **"Há uma nova versão — Atualizar agora"** assim que uma publicação nova entra no ar; se preferir, recarregue com **Ctrl+F5** (no celular, feche e abra o app).

## Rodar no computador

Requer Node.js 20+.

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm test           # testes unitários (cronograma, termodinâmica, validações)
npm run build      # gera a pasta dist/ para publicação
```

---

## Como lançar as preventivas (passo a passo)

A preventiva é sempre registrada em uma OS, mas o processo fica todo na tela **Preventivas** (menu Operação):

1. **Rotinas automáticas** — ao cadastrar o equipamento e escolher o plano (ex.: Split/Janela), o sistema cria as rotinas dele (ex.: limpar filtros a cada mês, higienizar a cada trimestre) e calcula a próxima data de cada uma. Ajustes finos ficam na ficha do equipamento.
2. **Programar** — a etapa *A programar* lista os equipamentos com rotinas vencidas ou que vencem no período escolhido (7, 15, 30… dias) e que ainda não estão em OS.
   - **Programar**: abre a lista de rotinas do equipamento (as vencidas e a vencer já vêm marcadas), escolha data e técnico → a OS é gerada.
   - **Programar selecionados**: marca vários equipamentos e gera uma OS para cada um, de uma vez.
   - **Executar agora**: cria a OS para hoje e abre direto a tela de lançamento — ideal para o técnico que já está no local (também disponível no botão **Preventiva** da ficha do equipamento, acessada pelo QR Code).
3. **Executar** — o técnico abre a OS na **Área do técnico**, faz o check-in e marca cada rotina como **E** (executada), **P** (pendente) ou **N** (não executada, com motivo); registra medições, fotos e materiais, colhe a assinatura e finaliza.
4. **Liberar** — o supervisor confere em *Aguardando liberação* e libera (individualmente ou todas). A última execução de cada rotina é atualizada e a próxima data é recalculada pela periodicidade daquele equipamento; rotinas lançadas como N continuam vencidas e voltam para *A programar*.

Para mudar a data de uma OS programada, altere a data na etapa *Programadas* (ou clique no dia desejado no cronograma): ela passa a contar como **reprogramada**.

### Legenda do cronograma e do documento PMOC

| Cor | Situação |
|---|---|
| 🟦 **Azul — Programado** | Data prevista pela periodicidade do equipamento ou OS gerada |
| 🟨 **Amarelo — Reprogramado** | Data alterada em relação à programação original |
| 🟩 **Verde — Executado** | Rotina lançada como E pela equipe técnica |
| 🟥 **Vermelho — Não executado** | Rotina lançada como N/pendente, ou data vencida sem execução |

Periodicidades em meses (mensal, bimestral, trimestral, quadrimestral, semestral e anual) avançam por mês de calendário, de modo que uma rotina mensal aparece em todos os meses do plano.

> Perfis e PIN são um controle de acesso local do navegador (cada aparelho), adequado para organizar quem lança o quê; não substituem autenticação em servidor.

## Precificação para licitações e contratos (passo a passo)

1. **Tributos, encargos e BDI.** Informe o regime: Simples Nacional (Anexo III) com a receita bruta dos últimos 12 meses — a alíquota efetiva e a repartição saem da LC 123/2006 —, ou Lucro Presumido/Real com o ISS do município e, se for o caso, a desoneração da folha (CPRB) na transição da Lei 14.973/2024. Ajuste os percentuais do BDI (administração central, seguros, riscos, garantias, lucro e prazo de recebimento) e as provisões trabalhistas. O BDI é recalculado na hora e cada componente mostra um farol em relação às faixas de referência do TCU.
2. **Equipe e custo-hora.** Cadastre cada cargo com os valores da sua convenção coletiva: salário-base, periculosidade (30%, NR-16) ou insalubridade (sobre o salário mínimo), vale-transporte (com o desconto de 6% do salário), alimentação, plano de saúde, seguro, uniformes/EPI e exames/treinamentos. O demonstrativo segue os módulos da planilha da IN SEGES 5/2017 (remuneração; 13º, férias e 1/3; encargos do Grupo A; benefícios; rescisão; insumos) e divide o custo mensal pelas horas produtivas.
3. **Custos operacionais.** Veículo, ferramentas, responsável técnico/ART e outros custos mensais, materiais de consumo por equipamento e custo por km. Entram como padrão em todo estudo novo.
4. **Estudo de preço.** Crie pelo menu ou pela oportunidade (botão da calculadora). Em *Equipamentos*, **Gerar dos equipamentos cadastrados** agrupa os aparelhos do cliente por tipo e faixa de capacidade, com o plano de manutenção de cada grupo. As horas por mês saem das periodicidades e dos tempos do plano PMOC, multiplicadas pelo fator da faixa de BTU, mais a reserva para corretivas. Preço unitário = (mão de obra + materiais + indiretos rateados) × (1 + BDI). O resumo mostra o preço mensal, anual e da vigência, a comparação com o valor estimado do edital e o **lance mínimo** (preço sem o lucro).
5. **Exequibilidade.** Em serviços de engenharia, o estudo alerta proposta abaixo de 75% do valor orçado pela Administração (Lei 14.133/2021, art. 59, §4º — presunção relativa: a empresa pode demonstrar que o preço é exequível) e calcula a garantia adicional abaixo de 85% (art. 59, §5º). Em serviços comuns, usa a referência de 50% da IN SEGES 73/2022.
6. **Composição impressa.** *Imprimir composição* gera a memória de cálculo (equipe e custo-hora, composição por equipamento, indiretos, demonstrativo do BDI com a fórmula e valor por extenso) para anexar à proposta ou responder a uma diligência.

**Fórmula do BDI (Acórdão TCU 2622/2013):** `BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)] − 1`, em que *I* reúne os tributos sobre o faturamento (ISS, PIS, Cofins, CPRB ou, no Simples, a parcela do DAS sem IRPJ e CSLL — Súmula TCU 254).

**Comercial.** O funil acompanha cada licitação ou proposta privada (prospecção → análise do edital → proposta → disputa → habilitação → ganha/perdida). O estudo de preço atualiza o valor da proposta na oportunidade; quando ela é ganha, **Gerar contrato** cria o contrato (modelo da Administração Pública para licitações) com valor mensal e vigência.

> Os parâmetros tributários e trabalhistas são pontos de partida: confira-os com o contador da empresa e com a convenção coletiva vigente. Contratos com dedicação exclusiva de mão de obra (posto residente) podem caracterizar cessão de mão de obra, vedada no Simples Nacional (LC 123/2006, art. 17, XII). Os valores da demonstração são fictícios.

## Onde ficam os dados

Os dados são gravados **no navegador de cada usuário** (IndexedDB), por isso o sistema funciona sem internet e não tem custo de servidor.

- Use **Configurações → Backup e dados → Baixar backup** com frequência e guarde o arquivo em nuvem.
- Para uma equipe com vários aparelhos, cada técnico envia o backup e o gestor usa **Mesclar backup**.
- Ao abrir pela primeira vez é possível carregar **dados de demonstração** (fictícios) ou começar do zero. Para limpar a demonstração: Configurações → Apagar todos os dados.

> Os dados de um navegador não aparecem em outro. Se precisar de acesso simultâneo multiusuário em tempo real, o próximo passo natural é conectar um backend (ex.: Supabase/Firebase) à camada `src/db/db.ts`.

## Importar a planilha PMOC existente

**Configurações → Importar planilha** → selecione o `.xlsx`. As abas de equipamentos (colunas Código, Equip, Potência, Marca, Pat, Área, Local, Sublocal, C. Custo, Observação) são reconhecidas automaticamente;
cada valor da coluna *Área* vira uma unidade e cada Local/Sublocal vira um ambiente. O plano de manutenção é sugerido pelo tipo do equipamento e o código original fica registrado nas observações.

---

## Tecnologia

React 18 · TypeScript · Vite · Tailwind CSS · Dexie (IndexedDB) · Chart.js · ExcelJS · QRCode · PWA (service worker) · Vitest.

```
src/
  db/          tipos, banco local, planos padrão, dados de demonstração
  lib/         cronograma, gerador de preventivas, diagnóstico HVAC (tabelas P×T), métricas, importador, Excel
  components/  UI, CRUD genérico orientado a esquema, gráficos, assinatura, fotos, QR Code
  modules/     configuração dos cadastros (campos, colunas, filtros)
  pages/       OS, PMOC, cronograma, agenda, estoque, relatórios, configurações…
```

Para acrescentar um campo a qualquer cadastro, edite a lista `fields` correspondente em `src/modules/entities.tsx` — formulário, tabela e exportação se ajustam sozinhos.

## Aviso técnico

As periodicidades dos planos padrão são **sugestões** e devem ser validadas pelo responsável técnico conforme a ABNT NBR 13971, o projeto e o manual do fabricante. As tabelas pressão × temperatura foram geradas com CoolProp e servem para diagnóstico de campo.
