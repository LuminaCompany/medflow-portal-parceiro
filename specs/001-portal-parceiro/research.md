# Pesquisa — Portal do Parceiro MedFlow (Fase 0)

Decisões técnicas com justificativa. Cada item: **Decisão / Justificativa / Alternativas**.

---

## D1 — Acesso seguro à planilha Google Sheets

**Decisão**: Backend lê via **Google Sheets API** autenticado por **Service Account**
(conta de serviço). A planilha é compartilhada como **Leitor** com o e-mail da conta de
serviço e deixa de ser pública.

**Justificativa**:
- A planilha hoje está **pública** (export CSV retorna tudo de todos os parceiros sem
  auth). Isso viola a privacidade financeira e o R-001 na origem.
- Service Account dá leitura server-side sem expor a planilha, sem login interativo, e
  funciona bem em serverless (credencial via env, sem OAuth de usuário).
- A chave JSON fica em variável de ambiente no backend (VPS/EasyPanel), nunca no frontend.

**Nota sobre as credenciais enviadas (2026-06-25)**: o usuário enviou um **OAuth Client ID
+ Secret** (`GOCSPX-...`). Esse é o **tipo errado** para este caso (OAuth de usuário,
3-legged, exige consentimento no navegador). Para leitura headless de planilha privada o
correto é **Service Account** (chave JSON). Além disso, o secret foi exposto em texto puro
→ **deve ser revogado e rotacionado**. Não é necessário e-mail/senha de conta Google.

**Alternativas**:
- *CSV público* (`/export?format=csv`): simples, mas vaza todos os dados a qualquer um —
  rejeitado para dado financeiro.
- *OAuth Client ID/Secret (usuário)*: fluxo interativo desnecessário e inadequado para
  backend headless — rejeitado (complexidade, KISS, exige tela de consentimento).
- *Mirror em Postgres (Supabase)*: mais rápido e consultável, mas adiciona infra de
  sync e contradiz "não usar Supabase para dados". Mantido como **otimização futura**
  se o volume crescer muito (ver D2).

**Como habilitar (instrução ao usuário)** — detalhado no quickstart:
1. Google Cloud Console → criar/usar projeto → **ativar Google Sheets API**.
2. Criar **Service Account** → gerar chave **JSON**.
3. Copiar o e-mail da conta (`...@...iam.gserviceaccount.com`).
4. Na planilha → Compartilhar → adicionar esse e-mail como **Leitor**.
5. **Remover** o acesso "qualquer pessoa com o link".
6. Backend recebe a chave via env (`GOOGLE_SERVICE_ACCOUNT_JSON`) e o ID/GID da planilha.

---

## D2 — Estratégia de cache (rápido + serverless)

**Decisão**: Cache **em processo com TTL** (ex.: 120–300s) no backend, com leitura única
da planilha por janela. Dataset atual é pequeno (~dezenas de linhas), então uma leitura é
barata; o cache absorve picos e protege a quota da Sheets API.

**Justificativa**:
- "Extremamente rápido": servir de memória normalizada >> reparsear/rebaixar a cada
  request. Pagina e filtra sobre a estrutura já normalizada.
- KISS: sem Redis/KV/DB no MVP. O backend roda como **container persistente**
  (VPS/EasyPanel), então o cache em processo **sobrevive entre requisições** por toda a
  vida do container — sem cold start de serverless. TTL evita reparse e protege a quota.

**Alternativas / evolução**:
- *Redis/KV* ou *Supabase table mirror* com sync agendado: adotar **se** o volume crescer
  a milhares de linhas ou várias réplicas do container precisarem compartilhar o cache.
  Documentado como caminho de escala, não no MVP.
- *Cache do Next.js (`revalidate`)*: aplicado **na borda do frontend** para respostas já
  escopadas (por usuário), reforçando velocidade sem furar isolamento.

---

## D3 — Normalização de moeda e datas (dados sujos)

**Decisão**: Camada `sheets/parser.py` converte os valores crus em tipos fortes
(`Decimal` para dinheiro, `date` para datas) **na entrada**, antes de qualquer cálculo.

**Justificativa** (observado na planilha real):
- Moeda em formato US: `"R$ 1,300.00"` (vírgula=milhar, ponto=decimal). Parser remove
  `R$`, separadores de milhar e converte para `Decimal`.
- **Datas mistas**: `Data do Pedido`/`Data de Quitação` em ISO (`2025-12-30`); `Data
  Quitação Real` em BR (`14/01/2026`). Parser tenta ISO e depois `dd/mm/yyyy`.
- Linha de **resumo/total** sem `Cliente` deve ser descartada.
- Percentuais (`6.00%`) só exibidos (não usados em cálculo do portal).
- `Decimal` evita erro de ponto flutuante em valores financeiros (Clean Code/contábil).

**Alternativas**: `float` — rejeitado (imprecisão monetária). Parse single-format —
rejeitado (datas mistas quebrariam).

---

## D4 — Regra de Status de pagamento

**Decisão**: Fonte única em `domain/status.py`:
- `QUITADO == TRUE` → **Pago**.
- `QUITADO != TRUE` e `Data de Quitação < hoje` → **Atrasado**.
- `QUITADO != TRUE` e `Data de Quitação >= hoje` → **A Pagar** (vencimento hoje conta como
  A Pagar).

**Justificativa**: a planilha entrega o pago/não-pago em `QUITADO`; atraso é derivado da
`Data de Quitação` vs. data atual. Centralizar evita divergência entre abas/endpoints
(DRY). Backend devolve o status já calculado + rótulo → frontend não recalcula.

**Alternativas**: usar `Dias de Diferença (atraso)` — é sobre quitação **real** (pós-fato),
não serve para itens ainda em aberto; rejeitado como fonte de status corrente.

---

## D5 — Visibilidade de colunas por papel (DECIDIDO; revisado 2026-06-25)

> **D5′ (revisão 2026-06-25, vigente)** — **supera a decisão original abaixo.** O dono do
> produto definiu uma **lista-modelo** de colunas da tabela de solicitações que o parceiro
> pode ver. O parceiro **NÃO** vê mais as **margens da MedFlow** (`Lucro Operacional` e
> `ÁGIO BASE`). Continua vendo: `codigo`, `cliente`, `Originação` (`valor`),
> `Recebido Cliente`, `IOF`, `Taxa ao Mês` (`taxa_juros_mes`), `Desconto (-IOF)`
> (`juros_descontos`), `Data Pedido`, `Prazo`, `Vencimento`, `Unidade Referência` e
> `Cashback` — além do `status` derivado e da **PII do médico** (mantida: CPF, telefone,
> e-mail, PIX, nascimento). O **gestor** mantém **todas** as colunas, sem mudança.
>
> **Implicação**: a máscara por papel **passa a existir** e é feita no **backend**
> (`serializa_solicitacao(..., incluir_gestor)` só inclui `lucro_operacional`/`agio_base`
> quando gestor). Esconder no front não basta — o payload vazaria na rede. O escopo por
> Contratante (D6/R-001) continua sendo o outro gate, ortogonal a este.

**Decisão original (usuário, 2026-06-25 — SUPERADA por D5′)**: o parceiro veria **todas as
colunas**, incluindo as margens da MedFlow (`Lucro Operacional`, `Juros e Descontos`,
`ÁGIO BASE`, `Taxa de Juros`) e toda a PII do médico. Não havia filtro de colunas por papel.

---

## D6 — Mapeamento parceiro e isolamento (R-001)

**Decisão**: `Contratante` (col. da planilha) é a **chave de parceiro**. No Supabase,
`app_users` guarda `contratante` (string que casa exatamente com a planilha) e `role`
(`parceiro`|`gestor`). O backend filtra as linhas por esse `contratante` **antes** de
serializar; gestor ignora o filtro.

**Justificativa**: isolamento garantido no servidor (não na UI), atendendo R-001/CS-002.
Casamento por string exige normalização consistente (trim) e um cadastro correto.

**Alternativas**: filtrar por `Unidade Referência` — errado (é sub-unidade); franquia é
agregada por `Contratante`. Filtrar no frontend — proibido por R-001.

**Atenção**: há **7 contratantes** no `Cadastro de Clientes` (`BESA Medical Group`,
`A.H. GESTÃO MÉDICA`, `MMR Serviços Médicos`, `AZEVEDO MAIA SERVIÇOS MÉDICOS`,
`INDIVIDUAL`, `DBKZ`, `Parnassemed Gestão de Saúde`), mas só 4 aparecem hoje em
`Dados Tratados`. Os nomes precisam casar **exatamente** (trim) com o cadastro Supabase;
recomendado mapear por identificador estável. `INDIVIDUAL` = médicos sem franquia:
**decidido (2026-06-25)** — **não** vira login de parceiro; suas solicitações vão para
"Pendências de Dados" (motivo "Médico sem franquia (INDIVIDUAL)"), fora de toda visão de
parceiro e de qualquer agregação, até o gestor tratar na fonte (regra em data-model §6).

---

## D10 — Papéis das 3 abas e estratégia de join (DECIDIDO)

**Decisão**:
- **Dados Tratados** = fonte primária das solicitações (única com status/cashback/
  contratante). O portal exibe o que estiver tratado.
- **Cadastro de Clientes** = referência `Cliente→Contratante`; resolve/valida o parceiro
  e lista parceiros.
- **base de dados** = enriquecimento do **painel de detalhes do médico** (PII + financeiro
  bruto), join por nome (`Cliente` ↔ `borrower_full_name`).

**Justificativa / achados**:
- `base de dados.funding_name` é sempre `MEDFLOW...` (o financiador) — **não** serve como
  parceiro; o parceiro vem de `Contratante` (Dados Tratados) / `Cadastro`.
- `base de dados.status` é só `ISSUED` — **não tem info de pagamento**; logo status/
  cashback/atraso só podem vir de `Dados Tratados`.
- Todos os médicos com solicitação tratada constam no `Cadastro de Clientes`
  (137 registros) → join confiável por nome.

**Risco de prontidão de dados**: hoje só **40 de 615** antecipações estão "tratadas". O
portal mostra apenas as tratadas; cobrir tudo é trabalho de **manutenção da planilha** pela
equipe MedFlow (a base bruta não tem pagamento para derivar). Sinalizado no plano.

**Risco de join por nome**: nomes de médico podem ter grafias divergentes entre abas;
normalizar (trim/caixa) e tratar não-casados com fallback seguro.

---

## D7 — Gráficos

**Decisão**: **Recharts** para a série mensal (barras/linha) e pizza.

**Justificativa**: declarativo, leve, integra com RSC/Client Components, suficiente para o
volume; respeita "clean" sem trazer engine pesada.

**Alternativas**: visx (mais low-level, mais trabalho), Chart.js (imperativo) — sem ganho
para este escopo.

---

## D8 — Tema claro/escuro

**Decisão**: tokens OKLCH do DESIGN.md em CSS variables + `next-themes` para alternância,
respeitando `prefers-reduced-motion`.

**Justificativa**: DESIGN.md já define os dois temas via mesmas variáveis; `next-themes`
resolve persistência/SSR sem flash. Clean e padrão de mercado.

---

## D9 — Agrupamento por médico / por parceiro

**Decisão**: agrupamento é **apresentacional**, computado no backend como metadado
(`grupo`/`cor` por parceiro no gestor; ordenação por médico no parceiro), mantendo cada
solicitação como uma linha (RF-012/RF-023).

**Paginação × grupo (RF-009)**: a lista do parceiro é ordenada por médico **antes** de
paginar; se o limite de 20 cair no meio de um grupo, a página **estende-se** até fechar
o grupo (o backend devolve até a última linha daquele médico). Assim nenhum grupo é
cortado entre páginas — a página efetiva pode trazer >20 itens.

**Justificativa**: mantém a lógica fora do componente de UI (DRY/Clean), facilita testar.

---

## D11 — Validação & Quarentena ("Pendências de Dados") (DECIDIDO)

**Decisão**: após normalizar, o serviço **particiona** as solicitações em `validas` e
`pendencias` via `domain/validation.py`. **Todas** as features (parceiro e gestor) operam
sobre `validas`; um endpoint gestor-only (`/api/admin/pendencias`) expõe `pendencias` com
o(s) motivo(s). Quarentena é **derivada em memória** a cada carga — sem estado persistido.

**Justificativa**:
- Protege R-001 e a corretude dos números: uma linha sem `Contratante` (ou com contratante
  divergente do `Cadastro`) nunca cai no parceiro errado nem infla totais.
- Sem persistência → "self-healing": corrigiu a planilha, no próximo TTL a linha volta às
  telas normais (RF-037). KISS, sem migração/estado.
- Motivo legível e nº da linha de origem aceleram a correção pelo gestor.

**Regras**: ver data-model §6 (cliente/contratante/valor/datas/cadastro). Uma solicitação
pode acumular vários motivos.

**Nome da área**: adotado **"Pendências de Dados"** (mais acionável que "Erros de Dados").
Chave interna `pendencias`/`data_issues`.

**Alternativas**: marcar a linha como erro mas ainda exibi-la — rejeitado (viola RF-035 e
poluiria números); persistir quarentena em banco — rejeitado (estado desnecessário, fere
o self-healing e o KISS).
