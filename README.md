# PMOC Pro — Plano de Manutenção, Operação e Controle

Plataforma web para gestão de **PMOC** e manutenção de **climatização e refrigeração (HVAC-R)**:
ordens de serviço, cronograma anual, equipamentos com QR Code, estoque de peças, catálogo de serviços,
equipe técnica, qualidade do ar, fluidos refrigerantes e o documento PMOC pronto para impressão.

Atende à **Lei Federal nº 13.589/2018**, à **Portaria GM/MS nº 3.523/1998 (Anexo I)**, à **Resolução ANVISA RE nº 09/2003**
e à **ABNT NBR 13971**. Funciona 100% no navegador (inclusive offline, no celular do técnico) e é publicada
gratuitamente pelo **GitHub Pages**, sem servidor nem banco de dados para contratar.

---

## O que a plataforma faz

| Módulo | Recursos |
|---|---|
| **Painel** | OS em aberto/atrasadas, cumprimento do PMOC, MTTR, SLA, disponibilidade, capacidade instalada (TR), gráficos mensais e central de alertas |
| **Periodicidade por equipamento** | Cada equipamento tem suas **rotinas** (atividade × periodicidade em dias) com **última execução** e **próxima execução**: a próxima é recalculada a partir da última execução lançada pela equipe técnica. Ajuste fino por equipamento (intervalo, tempo, setor, responsável, reprogramação de data), histórico de execuções e status (em dia / a vencer / vencida) |
| **Área do técnico** | Tela para celular: OS do técnico (em execução, atrasadas, hoje, próximos dias), check-in, lançamento de cada tarefa como **E** (executado), **P** (pendente) ou **N** (não executado, com motivo), tempo real, material, medições, fotos, materiais do estoque e assinaturas. Cada lançamento fica registrado com o executante e a data/hora |
| **Perfis de acesso** | Técnico (lança execuções), Supervisor (libera as OS) e Gestor (acesso total), com PIN opcional e troca rápida de usuário |
| **Ordens de serviço** | Formulário completo (informações gerais, padrões de execução, identificação do ambiente, proprietário e responsável técnico, tarefas E/P/N com tempo previsto × real e material, executantes, parada e interferência, alteração de localização, assinaturas do executante, responsável e supervisor, data/hora de liberação). Impressão preenchida ou **formulário em branco** para campo. Lista e quadro Kanban (arrastar e soltar), filtros, tipos (preventiva, corretiva, emergencial, higienização, instalação…), prioridade com **SLA do contrato**, equipe, checklist por equipamento (OK / Corrigido / NOK / N/A), **medições de campo com diagnóstico automático** (ΔT, superaquecimento e sub-resfriamento por tabela P×T de 10 fluidos), peças com **baixa automática no estoque**, serviços, apontamento de horas, laudo, fotos (câmera do celular), **assinatura digital** do técnico e do cliente, avaliação, histórico, salvamento automático e impressão/PDF com QR Code |
| **Ocorrências / chamados** | Quebra, processo, anomalia simples/crítica, chamado, vazamento — conversão em OS com um clique |
| **Orçamentos** | Itens de serviços e peças, desconto, deslocamento, validade, impressão e conversão em OS |
| **Documento PMOC** | Capa, identificação da edificação, proprietário e responsável técnico (ART/TRT/RRT), relação de ambientes com renovação de ar mínima, relação de equipamentos, **plano de manutenção por equipamento** (periodicidade, última e próxima execução e meses previstos/executados), registro de execução por equipamento, qualidade do ar, recomendações de emergência, normas e termo de responsabilidade |
| **Cronograma por equipamento** | **Previsão diária** (dias 1–31, como o cronograma de manutenção periódica) e **visão anual**, rotina a rotina, com previsto, programado (OS gerada), reprogramado, executado, não executado e vencido; clique em um dia para reprogramar. **Geração automática das OS preventivas** (uma por equipamento, por ambiente ou por unidade), sem duplicar rotinas já programadas |
| **Planos de manutenção** | 8 planos prontos e editáveis: Portaria 3.523 (Anexo I completo), Split/Janela, VRF/VRV, Chiller, Fan Coil/Self/AHU, Torre de resfriamento, Câmara fria/refrigeração comercial, Exaustão. Periodicidades diária a anual, tempo padrão e faixas de medição |
| **Qualidade do ar** | Laudos da RE 09/2003 (fungos, relação I/E, CO₂, aerodispersóides, temperatura, umidade, velocidade, renovação) com avaliação automática e alerta de vencimento semestral |
| **Fluidos refrigerantes** | Cargas, recolhimentos, vazamentos e testes de estanqueidade por equipamento, com **tCO₂e** (GWP) |
| **Cadastros** | Clientes, unidades, ambientes (ocupação, área, carga térmica), equipamentos (ficha técnica, criticidade, garantia, QR Code, histórico, MTBF, custo), profissionais (CREA/CFT, NRs, ASO com vencimento), serviços, peças, fornecedores, contratos |
| **Estoque** | Entradas, saídas e ajustes com custo médio ponderado, alerta de mínimo e **sugestão de compra** em Excel |
| **Relatórios** | Produtividade da equipe, confiabilidade por equipamento (corretivas, MTBF, itens NOK, custo), custos por unidade, peças consumidas, fluidos — exportação Excel e impressão |
| **Importação** | Lê planilhas PMOC existentes (abas `Eq_*` e `Rel_areas`, ou o modelo fornecido) e cria unidades, ambientes e equipamentos automaticamente |
| **Backup** | Exporta/restaura tudo em JSON; opção de **mesclar** backups enviados por vários técnicos |

Também: busca global, tema claro/escuro, layout para celular, etiquetas QR em lote para impressão em papel adesivo e exportação CSV/Excel de todas as listas.

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

A cada `git push` na branch `main` o site é atualizado automaticamente.

## Rodar no computador

Requer Node.js 20+.

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm test           # testes unitários (cronograma, termodinâmica, validações)
npm run build      # gera a pasta dist/ para publicação
```

---

## Fluxo de trabalho recomendado

1. **Gestor** cadastra unidades, ambientes e equipamentos (ou importa a planilha) e escolhe o plano modelo de cada equipamento — as rotinas são criadas automaticamente e podem ser ajustadas na ficha do equipamento.
2. No **Cronograma por equipamento**, o gestor gera as OS preventivas do período (uma por equipamento).
3. O **técnico** entra com seu usuário, abre a **Área do técnico** no celular, faz o check-in e lança cada tarefa (E/P/N), medições, fotos e materiais; colhe a assinatura do cliente e finaliza.
4. O **supervisor** confere e **libera** a OS. A última execução de cada rotina é atualizada e a próxima data é recalculada pela periodicidade daquele equipamento.

> Perfis e PIN são um controle de acesso local do navegador (cada aparelho), adequado para organizar quem lança o quê; não substituem autenticação em servidor.

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
