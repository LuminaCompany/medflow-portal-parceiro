# Especificação de Funcionalidade: Portal do Parceiro — MedFlow

**Diretório da feature**: `specs/001-portal-parceiro`
**Criado em**: 2026-06-25
**Status**: Planejado / em implementação (clarificações resolvidas)
**Entrada**: Descrição do portal do parceiro fornecida via `/speckit-specify`
**Referências visuais**: `Inspirações/` — mockups das abas (Visão Geral, Solicitações,
Vencimentos) e `Lista de Informações modelo que devem estar na tabela de
solicitações.png` (colunas-fonte da tabela de Solicitações).

> Esta especificação descreve **o quê** e **por quê**. Decisões de stack/arquitetura
> ficam para `/speckit-plan`. Princípio inegociável que atravessa todo o documento:
> **isolamento de dados do parceiro** (ver Restrição R-001).

---

## Visão Geral

Portal web de **visualização** (somente leitura sobre os dados operacionais) que dá
a cada **parceiro** (franquia de hospitais cliente da MedFlow) transparência total
sobre o que tem a pagar à MedFlow — o valor antecipado aos seus médicos — com
dashboard, solicitações, vencimentos e busca; e dá aos **gestores** da MedFlow uma
visão consolidada de todos os parceiros mais a administração dos acessos.

O sucesso central: o parceiro entende **em segundos** quanto deve, para quando e de
quais médicos; o gestor enxerga o todo e controla acessos sem fricção; e **nenhum
parceiro jamais vê dado de outro parceiro**.

---

## Cenários de Usuário & Testes

### História de Usuário 1 — Parceiro vê quanto deve e para quando (Prioridade: P1)

O parceiro acessa o portal para responder, sem ambiguidade: "quanto devo à MedFlow,
para quando e de quais médicos". É o motivo nº1 de existência do portal.

**Por que esta prioridade**: é o valor financeiro central e o que justifica o
produto. Entregue sozinha, já dá ao parceiro a informação mais importante.

**Teste independente**: autenticar como parceiro e abrir a aba Vencimentos —
deve ver Total Pendente, valor Em Atraso, contagens e as listas de atrasados,
próximos vencimentos e pagos, **só do próprio parceiro**.

**Cenários de Aceitação**:

1. **Dado** um parceiro autenticado com solicitações em aberto, **Quando** abre
   a aba Vencimentos, **Então** vê 4 cards: Total Pendente, Em Atraso (valor),
   Nº de solicitações atrasadas e Nº de solicitações a pagar.
2. **Dado** que existem solicitações que ultrapassaram o prazo de quitação,
   **Quando** vê a seção "Atrasados", **Então** vê todas elas na tabela com as
   mesmas colunas da aba Solicitações.
3. **Dado** o filtro de período em "Próximos vencimentos" com padrão "1 semana",
   **Quando** troca para "2 dias" ou "2 semanas", **Então** a lista passa a exibir
   apenas contratos que vencem até a data correspondente.
4. **Dado** contratos que venceram mas já foram quitados, **Quando** vê a seção
   "Vencimentos Pagos", **Então** vê todos eles com o mesmo layout.
5. **Dado** qualquer tela do parceiro, **Quando** consulta os números, **Então**
   todos refletem **exclusivamente** dados do próprio parceiro (R-001).

---

### História de Usuário 2 — Parceiro consulta e investiga solicitações (Prioridade: P1)

O parceiro examina a lista de solicitações de antecipação dos seus médicos, busca,
filtra, agrupa por médico e abre o detalhe de uma solicitação.

**Por que esta prioridade**: é a base de dados que alimenta tudo; sem ela o
dashboard e os vencimentos não têm conteúdo verificável pelo parceiro.

**Teste independente**: como parceiro, abrir Solicitações, buscar por um código,
filtrar por status, clicar numa linha e ver o painel lateral de detalhe.

**Cenários de Aceitação**:

1. **Dado** o parceiro na aba Solicitações, **Quando** a aba carrega, **Então** vê
   uma tabela com colunas Código, Cliente, Pedido, Valor, Quitação e Status de
   pagamento (Pago / A Pagar / Atrasado), exibindo as **20** primeiras solicitações.
2. **Dado** mais de 20 solicitações, **Quando** clica em "Ver mais", **Então**
   carrega mais 20, e assim sucessivamente.
3. **Dado** o campo de busca, **Quando** digita um código, nome de cliente ou
   status, **Então** a lista é filtrada por esse termo.
4. **Dado** um médico com mais de uma solicitação, **Quando** vê a tabela,
   **Então** as solicitações daquele médico aparecem **agrupadas** (próximas,
   cada uma na sua própria linha — nunca somadas numa linha só).
5. **Dado** uma solicitação na tabela, **Quando** clica nela, **Então** abre um
   painel lateral com mais informações da solicitação e do médico que a fez.
6. **Dado** filtros disponíveis, **Quando** aplica um filtro, **Então** a tabela
   reflete apenas os itens correspondentes (sem recarregar a página inteira).

---

### História de Usuário 3 — Gestor administra acessos dos parceiros (Prioridade: P1)

O gestor da MedFlow cria, lista e remove os logins dos parceiros. É a **única**
ação de escrita do portal.

**Por que esta prioridade**: sem login criado pelo gestor, nenhum parceiro entra;
é pré-requisito operacional para todas as histórias do parceiro.

**Teste independente**: como gestor, abrir a aba Parceiros, criar um login, vê-lo
na lista e removê-lo com confirmação.

**Cenários de Aceitação**:

1. **Dado** o gestor na aba Parceiros, **Quando** a aba carrega, **Então** vê a
   lista de todos os logins de parceiros existentes.
2. **Dado** a ação "Adicionar", **Quando** o gestor cria um novo login de parceiro,
   **Então** o login passa a constar na lista e o parceiro consegue autenticar.
3. **Dado** um login existente, **Quando** o gestor edita o `Contratante` vinculado
   ou redefine a senha inicial, **Então** a alteração passa a valer no próximo login
   do parceiro.
4. **Dado** um login existente, **Quando** o gestor escolhe "Remover", **Então**
   o portal exige confirmação numa tela/modal antes de efetivar.
5. **Dado** a confirmação de remoção, **Quando** confirmada, **Então** o login é
   removido e o parceiro correspondente perde o acesso.
6. **Dado** o perfil parceiro, **Quando** tenta acessar a administração de
   parceiros, **Então** o acesso é negado (apenas gestor administra).

---

### História de Usuário 4 — Parceiro acompanha sua operação no dashboard (Prioridade: P2)

O parceiro abre a Visão Geral e enxerga métricas-chave e gráficos com comparação
temporal (mês atual vs. meses anteriores).

**Por que esta prioridade**: agrega valor de leitura e contexto, mas depende dos
dados de Solicitações (US2); é importante, não bloqueante para o valor central.

**Teste independente**: como parceiro, abrir Visão Geral e conferir os cards de
métrica e ao menos um gráfico mensal, todos restritos ao próprio parceiro.

**Cenários de Aceitação**:

1. **Dado** o parceiro autenticado, **Quando** abre a Visão Geral, **Então** vê um
   conjunto de cards de métrica (ex.: valor total antecipado, total de
   solicitações, solicitações em aberto/pagas, médicos impactados, antecipações no
   ano) calculados só com seus dados.
2. **Dado** os cards que suportam comparação temporal, **Quando** os visualiza,
   **Então** vê o valor do mês atual comparado a meses anteriores.
3. **Dado** o gráfico de solicitações mensais, **Quando** o visualiza, **Então**
   vê um ponto por mês ao longo do período.

---

### História de Usuário 5 — Gestor enxerga o consolidado de todos os parceiros (Prioridade: P2)

O gestor vê dashboard, solicitações e vencimentos de **todos** os parceiros, podendo
combinar e comparar.

**Por que esta prioridade**: alto valor para a operação interna; depende da mesma
base de dados das histórias do parceiro, com camada de consolidação por cima.

**Teste independente**: como gestor, abrir cada aba e confirmar que vê dados
somados/consolidados e consegue filtrar por parceiro.

**Cenários de Aceitação**:

1. **Dado** o gestor na Visão Geral, **Quando** a abre, **Então** vê as mesmas
   métricas do parceiro, porém **somadas/consolidadas** entre todos os parceiros.
2. **Dado** o gestor na aba Solicitações, **Quando** a abre, **Então** vê uma barra
   de botões acima da tabela — um por parceiro, mais "Todos os parceiros".
3. **Dado** os botões de parceiro, **Quando** seleciona um ou vários, **Então** a
   tabela exibe as solicitações apenas dos parceiros selecionados.
4. **Dado** múltiplos parceiros exibidos ao mesmo tempo, **Quando** vê a tabela,
   **Então** as solicitações de cada parceiro ficam **agrupadas** e recebem uma
   **cor de fundo própria** (não branca, igual para todas as linhas daquele
   parceiro) que as distingue visualmente das dos demais.
5. **Dado** o gestor na aba Vencimentos, **Quando** a abre, **Então** vê
   "Solicitações a pagar" e "Valor total a receber", uma lista de parceiros com
   valores **já vencidos** ordenada do que deve mais para o que deve menos, e
   abaixo uma lista de valores **a vencer** com a mesma ordenação.

---

### História de Usuário 6 — Sessão, conta e preferências (Prioridade: P3)

Qualquer usuário autentica, alterna tema claro/escuro e sai da conta.

**Por que esta prioridade**: melhora a experiência e a usabilidade; não bloqueia o
valor central, mas é esperado num portal profissional.

**Teste independente**: fazer login, alternar o tema, abrir o menu de conta no
canto inferior esquerdo e deslogar.

**Cenários de Aceitação**:

1. **Dado** um usuário com login válido, **Quando** autentica, **Então** entra no
   portal no perfil correto (parceiro ou gestor) com as abas correspondentes.
2. **Dado** credenciais inválidas, **Quando** tenta autenticar, **Então** vê uma
   mensagem de erro clara e não entra.
3. **Dado** o portal aberto, **Quando** alterna entre tema claro e escuro,
   **Então** a interface inteira respeita a escolha.
4. **Dado** o campo com o nome do login no canto inferior esquerdo, **Quando**
   clica nele, **Então** surge a opção de sair/deslogar; ao confirmar, a sessão é
   encerrada.

---

### História de Usuário 7 — Gestor sanea pendências de dados (Prioridade: P1)

Solicitações com dados faltando/inconsistentes não podem poluir as telas nem os números.
São desviadas para uma área **"Pendências de Dados"** (somente gestor), com o motivo, para
o gestor corrigir na fonte rapidamente.

**Por que esta prioridade**: é a guarda de integridade. Sem ela, uma linha sem
`Contratante` apareceria no parceiro errado e os totais ficariam falsos — fere R-001 e a
confiança nos números. P1 por proteger isolamento e corretude.

**Teste independente**: inserir na planilha uma solicitação sem `Contratante` (ou sem data
de quitação) e confirmar que ela some de todas as telas normais e aparece **só** em
Pendências de Dados, com o motivo correto.

**Cenários de Aceitação**:

1. **Dado** uma solicitação com campo obrigatório ausente/inválido, **Quando** os dados
   carregam, **Então** ela vai para "Pendências de Dados" e é **removida de todas as outras
   visões** (parceiro e gestor) e de toda métrica/agregação.
2. **Dado** o gestor na área de Pendências de Dados, **Quando** a abre, **Então** vê uma
   tabela das solicitações com problema e, para cada uma, o **motivo** (ex.: "Contratante
   faltando", "Data de Quitação ausente", "Cliente sem cadastro").
3. **Dado** uma solicitação com mais de um problema, **Quando** o gestor a vê, **Então** vê
   todos os motivos aplicáveis.
4. **Dado** o perfil parceiro, **Quando** usa o portal, **Então** nunca vê esta área nem
   percebe que solicitações foram desviadas.
5. **Dado** que o gestor corrige o dado na planilha, **Quando** os dados recarregam,
   **Então** a solicitação sai de Pendências e volta às telas normais.

---

### Casos de Borda

- Parceiro **sem** solicitações/vencimentos: cada aba exibe um estado vazio
  explicativo e calmo, nunca uma tela em branco.
- Solicitação com data de quitação exatamente hoje: regra de status precisa definir
  se conta como "A Pagar" ou "Atrasado" (ver Pressupostos).
- Busca/filtro sem resultados: estado vazio específico ("nenhum resultado").
- Gestor remove o login de um parceiro com sessão ativa: a sessão deve ser
  invalidada (parceiro perde acesso).
- Gestor seleciona "Todos os parceiros" com muitos parceiros: as cores de fundo por
  parceiro precisam permanecer distinguíveis e acessíveis.
- Valores monetários grandes: formatação consistente (separadores, moeda) e colunas
  alinhadas.
- Tentativa de acesso direto a dado de outro parceiro (URL/ID manipulado): negado
  pelo backend (R-001), não apenas escondido na interface.

---

## Requisitos

### Requisitos Funcionais

**Autenticação & Perfis**

- **RF-001**: O sistema MUST autenticar usuários e distinguir dois perfis: Gestor
  (MedFlow) e Parceiro.
- **RF-002**: O sistema MUST direcionar cada usuário, após login, à experiência do
  seu perfil (abas e dados correspondentes).
- **RF-003**: O sistema MUST permitir logout a partir do menu de conta no canto
  inferior esquerdo, que exibe o nome do login.
- **RF-004**: O sistema MUST exibir mensagem de erro clara em tentativa de login
  inválida, sem revelar qual campo falhou.

**Isolamento de dados (parceiro)**

- **RF-005**: Para o perfil Parceiro, toda informação exibida (solicitações,
  métricas, vencimentos, detalhes) MUST conter exclusivamente dados do próprio
  parceiro; ver R-001.
- **RF-006**: O parceiro MUST NOT ter qualquer pista da existência de outros
  parceiros (nem nomes, nem agregados, nem contagens globais).

**Parceiro — Solicitações**

- **RF-007**: A tabela de Solicitações do parceiro MUST expor **exatamente** o conjunto de
  campos da **lista-modelo de referência** (`Inspirações/Lista de Informações modelo...png`):
  **Código**, **Cliente**, **Originação** (valor total da antecipação), **Recebido Cliente**,
  **IOF**, **Taxa ao Mês** (Taxa de Juros mensal), **Desconto (-IOF)** (= `juros_descontos`),
  **Data Pedido**, **Prazo**, **Vencimento** (prazo de quitação à MedFlow), **Unidade
  Referência** e **Cashback** — acrescido do **Status de pagamento** (derivado). As **margens
  da MedFlow** (**Lucro Operacional** e **ÁGIO BASE**) **MUST NOT** ser exibidas nem
  trafegadas ao parceiro — o backend faz **strip** desses campos na serialização do parceiro
  (research **D5′**); só o **gestor** as recebe. O conjunto canônico está em `data-model.md §1`;
  o isolamento por Contratante (R-001) é gate ortogonal a esta máscara.
- **RF-007a**: As colunas **principais** visíveis na tabela seguem o mockup
  (`Inspirações/Aba Solicitações.jpeg`): Código, Cliente, Pedido (= Data Pedido),
  **Originação** (= campo `valor`), Quitação (= Vencimento) e Status. Os demais campos da
  lista-modelo (Recebido Cliente, IOF, Taxa ao Mês, Desconto (-IOF), Prazo, Unidade
  Referência, **Rebate** = campo `cashback`) MUST estar disponíveis (colunas opcionais e/ou
  painel lateral de detalhes, RF-013).
- **RF-007b**: A coluna **Código** MUST ser exibida no formato `AAA-N` em **todos** os
  layouts de solicitação (lista, detalhe, vencimentos, pendências): as 3 primeiras letras
  da **Contratante** (sem acento, maiúsculas) + `-` + o número da solicitação — ex.: `BES-1102`.
  Sem contratante resolvida (quarentena), o prefixo é `???`.
  **Lucro Operacional** e **ÁGIO BASE** aparecem **apenas para o gestor**. A composição final
  de colunas visíveis × detalhe é refinada no design, mantendo baixa densidade
  (DESIGN.md), sem perder nenhum campo da lista-modelo do parceiro.
- **RF-008**: O Status de pagamento MUST assumir um de três valores: Pago, A Pagar
  ou Atrasado, com rótulo textual e indicação visual (não depender só de cor). O
  estado **pago/não-pago** é **lido da fonte** (coluna `QUITADO`); o estado
  **Atrasado** é **derivado** no backend (data de quitação vencida e não pago). O
  portal nunca **edita** status — ver Pressupostos e research D4.
- **RF-009**: A aba Solicitações MUST carregar 20 itens por vez e oferecer botão
  "Ver mais" que carrega mais 20 incrementalmente. Quando o limite (item nº 20)
  cair no meio de um grupo de solicitações do mesmo médico, a página MUST
  estender-se até **fechar o grupo** — nunca cortar solicitações adjacentes de um
  mesmo médico entre páginas (ver RF-012).
- **RF-010**: O sistema MUST oferecer um campo de busca por Código, Cliente ou
  Status nas abas do parceiro.
- **RF-011**: O sistema MUST oferecer filtros nas três abas do parceiro:
  **Visão Geral** — filtro por período (mês de referência); **Solicitações** —
  filtro por Status (Pago / A Pagar / Atrasado) somado à busca (RF-010);
  **Vencimentos** — filtro de período em "Próximos vencimentos" (2 dias / 1 semana /
  2 semanas, RF-016).
- **RF-012**: Quando um médico tiver mais de uma solicitação, o sistema MUST
  agrupar visualmente essas solicitações (linhas adjacentes), mantendo cada
  solicitação em sua própria linha (sem somar numa linha única).
- **RF-013**: Ao clicar numa solicitação, o sistema MUST abrir um painel lateral
  com detalhes da solicitação e do médico que a originou.

**Parceiro — Vencimentos**

- **RF-014**: A aba Vencimentos MUST exibir 4 cards: Total Pendente (tudo que o
  parceiro deve à MedFlow no momento), Em Atraso (valor total atrasado), Nº de
  solicitações atrasadas e Nº de solicitações a pagar.
- **RF-015**: A seção "Atrasados" MUST listar todas as solicitações atrasadas,
  reutilizando o layout/colunas da aba Solicitações.
- **RF-016**: A seção "Próximos vencimentos" MUST oferecer filtro de período com as
  opções "2 dias", "1 semana" (padrão) e "2 semanas", exibindo os contratos que
  vencem até a data escolhida.
- **RF-017**: A seção "Vencimentos Pagos" MUST listar as solicitações já quitadas
  (status **Pago**), com o mesmo layout. Uma solicitação que venceu e depois foi paga
  segue a **mesma** regra de status das demais — apenas passa a constar nesta seção.

**Parceiro — Visão Geral**

- **RF-018**: A Visão Geral MUST apresentar cards de métrica derivados dos dados do
  parceiro. Conjunto base: Total de Solicitações, **Originação Total** (antecipado),
  **Total de Rebate** (R$), Em Aberto / Pagas e Médicos Impactados — organizados por
  hierarquia de importância. (Rótulos de produto: **Originação** = campo `valor`;
  **Rebate** = campo `cashback` — ver Terminologia.)
- **RF-019**: A Visão Geral MUST oferecer um **recorte temporal por toggle**: padrão
  **"ano inteiro"** (de um ano selecionável) e opção **"por mês"**, onde o usuário
  seleciona todos ou apenas alguns meses do ano para contabilizar nos cards e no gráfico.
  MUST exibir o card **Ticket Médio** = Originação Total ÷ médicos distintos (média dos
  totais por médico) no recorte. O antigo card "Comparativo" (mês atual vs. anterior) foi
  **removido**.
- **RF-020**: A Visão Geral MUST incluir ao menos um gráfico de solicitações
  mensais (um ponto por mês) cobrindo os meses do **recorte temporal** selecionado.

**Gestor — Consolidado**

- **RF-021**: A Visão Geral do gestor MUST apresentar as mesmas métricas do
  parceiro, porém somadas/consolidadas entre todos os parceiros.
- **RF-022**: A aba Solicitações do gestor MUST exibir, acima da tabela, uma barra
  de botões — um por parceiro mais "Todos os parceiros" — permitindo seleção de um
  ou vários parceiros simultaneamente.
- **RF-023**: Ao exibir múltiplos parceiros, o sistema MUST agrupar as solicitações
  por parceiro e atribuir a cada parceiro uma cor de fundo própria (não branca,
  consistente para todas as linhas daquele parceiro) que o distinga dos demais.
- **RF-024**: A aba Vencimentos do gestor MUST exibir "Solicitações a pagar" e
  "Valor total a receber" (ambos somando **todo o pendente: a pagar + atrasado**) e
  uma **lista de todas as contratantes** (não só as com pendência), uma por linha,
  ordenada decrescentemente pelo **total pendente** (vencido + a vencer). Cada linha MUST
  mostrar uma **barra segmentada** (parte vencida + parte a vencer). Contratantes sem
  pendência (total pendente = 0) MUST aparecer ao final da lista com o rótulo **"Tudo pago"**.
- **RF-024a**: Cada contratante MUST abrir (dropdown) em suas **Unidades**, e cada Unidade
  MUST abrir em suas **solicitações** (todos os status). Cada Unidade MUST exibir seu
  **valor total** (Σ Originação de todas as solicitações, incl. pagas) e um **status agregado**
  (rollup worst-first): **Atrasado** se houver qualquer atrasada; senão **A Pagar** se houver
  qualquer pendente; senão **Pago** (somente quando todas quitadas).
- **RF-024b** (FUTURO, fora do escopo desta entrega): status **"Em Análise"** por Unidade e
  botão verde **"Verificar Pagamento"** (Em Análise → Pago para todas as solicitações da
  Unidade). Depende de um **gatilho ainda inexistente** (nada na planilha produz "Em Análise")
  e de definir a **persistência** da baixa — o status é derivado de `QUITADO` e o portal é
  read-only (constituição); marcar pago precisa sobreviver ao reload do cache. Será destravado
  em tarefa própria, com ADR para a mudança de read-only → escrita.

**Gestor — Administração de Parceiros**

- **RF-025**: A aba Parceiros (apenas gestor) MUST listar todos os logins de
  parceiros.
- **RF-026**: O gestor MUST poder adicionar um novo login de parceiro.
- **RF-027**: O gestor MUST poder remover um login de parceiro, exigindo
  confirmação explícita antes de efetivar.
- **RF-027a**: O gestor MUST poder **editar** um login de parceiro — alterar o
  `Contratante` vinculado e/ou redefinir a senha inicial.
- **RF-028**: O sistema MUST impedir que o perfil parceiro acesse a administração
  de parceiros.

**Transversais**

- **RF-029**: O sistema MUST oferecer alternância entre tema claro e escuro.
- **RF-030**: Valores monetários e datas MUST ser formatados de forma consistente e
  legível (alinhamento e separadores adequados a dados financeiros).
- **RF-031**: Cada aba MUST exibir um estado vazio explicativo quando não houver
  dados (sem tela em branco).
- **RF-032**: A interface do parceiro MUST refletir um portal somente leitura — sem
  affordances de ação que sugiram gestão de médicos/contratos.

**Gestor — Qualidade de Dados (Pendências de Dados)**

- **RF-033**: O sistema MUST validar cada solicitação da fonte contra um conjunto de regras
  obrigatórias; as que falharem MUST ser desviadas para a área **"Pendências de Dados"**.
- **RF-034**: A área "Pendências de Dados" MUST ser **exclusiva do gestor**; o parceiro
  nunca a acessa nem percebe que solicitações foram desviadas.
- **RF-035**: Uma solicitação em "Pendências de Dados" MUST NOT aparecer em nenhuma outra
  visão (parceiro ou gestor) nem em qualquer métrica/agregação — existe **só** nessa área.
- **RF-036**: A área MUST listar as solicitações com problema em tabela, exibindo, para
  cada uma, **o(s) motivo(s)** específico(s) do desvio (ex.: "Contratante faltando",
  "Data de Quitação ausente", "Cliente sem cadastro", "Valor inválido", "Médico sem
  franquia (INDIVIDUAL)").
- **RF-037**: Corrigida a fonte, a solicitação MUST sair de "Pendências de Dados" e voltar
  às telas normais no recarregamento dos dados (sem intervenção no portal).

### Restrições

- **R-001 (CRÍTICA — isolamento de dados)**: Nenhum parceiro pode acessar,
  visualizar ou inferir dados de outro parceiro. A autorização MUST ser garantida
  no backend (escopada pela identidade autenticada), não apenas ocultada na
  interface. Consolidação entre parceiros existe **apenas** no perfil gestor.

### Entidades-Chave

- **Usuário/Login**: identidade que autentica; possui perfil (Gestor ou Parceiro);
  se Parceiro, vincula-se a exatamente um parceiro/franquia.
- **Parceiro (Franquia)**: cliente da MedFlow; agrupa médicos e suas solicitações;
  é a fronteira de isolamento de dados.
- **Médico (Cliente)**: pessoa que solicitou a antecipação; vinculado a um parceiro;
  pode ter várias solicitações.
- **Solicitação / Antecipação (Contrato)**: unidade central de dado, originada das
  planilhas-fonte. Atributos (modelo de referência): Código, Cliente (Médico),
  Originação (valor), Recebido Cliente, IOF, Taxa ao Mês, Desconto (-IOF), Data
  Pedido, Prazo, Vencimento (quitação), Unidade Referência, Cashback (R$) e Status de
  pagamento (Pago / A Pagar / Atrasado).
- **Fonte de dados (planilha)**: 1 planilha Google Sheets com 3 abas (solicitações,
  cadastro de clientes, base bruta) que alimentam o portal em modo leitura;
  estrutura/mapeamento detalhados no plano.
- **Métrica/Agregado**: valores derivados das solicitações **válidas** (totais, contagens,
  séries mensais), calculados por parceiro (perfil parceiro) ou somados (perfil gestor).
  Solicitações em "Pendências de Dados" são excluídas de toda agregação.
- **Pendência de Dados**: solicitação reprovada na validação, com 1+ motivos de erro;
  visível só ao gestor e ausente de qualquer outra visão/agregação.

---

## Critérios de Sucesso

### Resultados Mensuráveis

- **CS-001**: A partir do login, um parceiro localiza "quanto deve e para quando"
  em até **15 segundos** (abrir Vencimentos e ler Total Pendente/Em Atraso).
- **CS-002**: **100%** das telas do perfil parceiro exibem somente dados do próprio
  parceiro — zero vazamentos em teste de isolamento (incluindo acesso direto por
  ID/URL manipulado).
- **CS-003**: O gestor cria um novo login de parceiro em até **1 minuto** e o
  remove (com confirmação) em até **30 segundos**.
- **CS-004**: A aba Solicitações exibe as 20 primeiras linhas e responde ao "Ver
  mais"/busca/filtro de forma perceptivelmente imediata (resultado visível em até
  **2 segundos** em volume típico).
- **CS-005**: Status de pagamento é compreensível sem depender de cor — **100%**
  dos status acompanham rótulo textual e/ou ícone (acessível a daltônicos).
- **CS-006**: No consolidado do gestor com múltiplos parceiros selecionados, cada
  parceiro é distinguível por cor de fundo própria, com contraste suficiente para
  leitura (WCAG AA).
- **CS-007**: A interface atende WCAG AA (contraste de corpo ≥ 4.5:1, navegação por
  teclado, foco visível, alternativa a `prefers-reduced-motion`).

---

## Pressupostos

- **Fonte de dados**: todas as informações (incluindo o estado pago/não-pago) vêm de
  **uma planilha Google Sheets com 3 abas** (`Dados Tratados`, `Cadastro de Clientes`,
  `base de dados`). O portal apenas **lê** esses dados — não origina antecipações nem
  gerencia médicos/contratos. Estrutura/colunas/mapeamento detalhados em
  `data-model.md`. (Confirmado pelo usuário.)
- **Cashback / Rebate**: é um **campo monetário (R$) por solicitação** presente na
  planilha-fonte (coluna `Cashback`) e um card na Visão Geral; o portal apenas o exibe,
  sem regra de cálculo própria. **Na UI o rótulo é "Rebate"**; "Cashback" permanece só na
  planilha e nos identificadores de código (campo `cashback`). (Confirmado pelo usuário.)
- **Valor / Originação**: o montante antecipado de cada solicitação (campo `valor`). **Na
  UI o rótulo é "Originação"**; "Valor" como rótulo é evitado. Não confundir com montantes
  de pagamento pendente ("Total Pendente", "A Receber", "Vencido"), que mantêm seus nomes.
- **Ticket Médio**: Originação Total ÷ médicos distintos no recorte (= média dos totais
  por médico). Card da Visão Geral (RF-019).
- **Login × unidades**: um login de parceiro corresponde à **franquia inteira**,
  enxergando todas as unidades contratadas de forma **agregada**. Não há separação por
  unidade; "Unidade Referência" é apenas um campo da solicitação. (Confirmado pelo
  usuário.)
- Os logins de **gestor** são provisionados internamente pela MedFlow (fora do fluxo
  de administração de parceiros do próprio portal). A aba Parceiros administra
  **apenas** logins de parceiros.
- **Senha do parceiro**: definida pelo gestor ao criar o login e **entregue
  manualmente** ao parceiro (sem e-mail automático de convite/recuperação no MVP).
  (Confirmado pelo usuário.)
- Regra de status (default, ajustável): "Atrasado" = data de quitação **anterior** a
  hoje e não pago; "A Pagar" = não pago e ainda dentro do prazo (quitação ≥ hoje);
  "Pago" = quitado. Vencimento exatamente hoje conta como "A Pagar".
- "Total Pendente" = soma de tudo não pago (A Pagar + Atrasado). "Em Atraso" = soma
  apenas dos Atrasados.
- O parceiro tem acesso **somente leitura** aos dados financeiros; a única ação de
  escrita do portal é a administração de logins de parceiros pelo gestor.
- O design visual e os tokens seguem DESIGN.md; o produto e os perfis seguem
  PRODUCT.md. Comunicação e documentação em PT-BR (constituição do projeto).
- "Pequenas features" adicionadas para boa UX (estados vazios, busca, acessibilidade)
  são permitidas com embasamento profissional (item 8 da entrada).

---

## Clarificações Resolvidas

1. **Cashback** — campo monetário (R$) por solicitação vindo da planilha-fonte;
   exibido como card na Visão Geral e disponível no detalhe. Sem regra de cálculo no
   portal. (Ver Pressupostos e RF-018.)
2. **Origem do status de pagamento** — estado pago/não-pago lido da planilha
   (`QUITADO`); "Atrasado" derivado no backend a partir da data de quitação. Portal
   100% somente leitura, sem ação de escrita financeira. (Ver RF-008 e research D4.)
3. **Login × unidades** — franquia agregada: um login vê todas as unidades
   contratadas somadas; sem separação por unidade. (Ver Pressupostos e RF-005.)

---

## Fora de Escopo

- Originação de antecipações, gestão de médicos, contratos ou funil de prospecção
  (isso é a operação da MedFlow, não o portal).
- Processamento/registro de pagamentos financeiros reais (liquidação) — o portal
  exibe status, não movimenta dinheiro.
- Autoatendimento de cadastro de parceiro (logins são criados pelo gestor).
