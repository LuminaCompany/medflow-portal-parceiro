# DOCUMENTATION — Portal do Parceiro MedFlow

Documento vivo do projeto (Princípio V da constituição). Atualizar a cada decisão
arquitetural ou mudança de setup.

## O que é

Portal web de **visualização** que dá a cada parceiro (franquia) transparência sobre o que
deve à MedFlow (valor antecipado aos seus médicos), com dashboard, solicitações e
vencimentos; e dá ao gestor MedFlow a visão consolidada + administração de logins.

> **Exceção de escrita governada (features 004/005):** os dados financeiros seguem **somente
> leitura** (fonte = planilha). A ÚNICA escrita iniciada pelo parceiro é o **aviso de pagamento**
> (o parceiro sinaliza "paguei este lote"; o gestor verifica/rejeita), persistido em Postgres
> (Supabase). Não altera a planilha nem o CRM. Ver ADR `docs/adr/0003` e `0004` (rebate), e a
> emenda 1.2.0 da constituição.

- Especificação completa: `specs/001-portal-parceiro/spec.md`
- Plano técnico: `specs/001-portal-parceiro/plan.md`
- Features posteriores: `002-filtros-dinamicos/spec.md`; features 003/004/005 documentadas em
  `CLAUDE.md` + ADRs `docs/adr/0002..0004`.

## Arquitetura (decisão atual)

```
Google Sheets (fonte financeira, privada via Service Account)
      │  leitura + normalização + cache TTL
      ▼
Backend Python / FastAPI  ──(isolamento por Contratante + papel)──▶  JSON escopado
      ▲
Supabase Auth (JWT)  →  resolve usuário → papel (parceiro|gestor) + contratante
      │
      ▼
Frontend Next.js (App Router, Server Components) → UI clean (DESIGN.md), tema claro/escuro
```

**Princípios da arquitetura**:
- **Isolamento (R-001)**: o backend filtra por `Contratante` do usuário autenticado
  **antes** de serializar. Frontend nunca lê a planilha direto. Parceiro não vê dados nem
  colunas de margem de outros/da MedFlow.
- **Rápido/clean**: dados servidos de cache normalizado; paginação no servidor (20/pág);
  Server Components; payload enxuto.
- **Supabase para auth/usuários + avisos de pagamento**: dados financeiros ficam na planilha
  (sem mirror em banco). A ÚNICA tabela Postgres é `pagamentos_avisos` (feature 004/005, RLS
  deny-all, acesso só pelo backend via service role) — o quadro de avisos de pagamento.
- **Fuso de negócio**: o "hoje" financeiro (status pago/a_vencer/vencido e "dias" dos lotes) é
  calculado em **America/Sao_Paulo** (`domain/datas.py`), independente do fuso do servidor (UTC
  no VPS) — senão o status virava um dia cedo entre ~21h e 00h BRT.

## Fonte de dados (1 planilha, 3 abas)

`SHEET_ID` (valor real só no `.env`, nunca versionado):
- **Dados Tratados** (`gid=278430548`) — fonte das **solicitações** (única com `QUITADO`,
  `Cashback`, `Unidade`, `Contratante`). Parceiro = **`Contratante`**. Status = `QUITADO` +
  `Data de Quitação`. Hoje **40 linhas**.

> **Terminologia de UI** (glossário em `CONTEXT.md`): o campo `valor` é exibido como
> **Originação**, e `cashback` como **Rebate** — os identificadores de código e a planilha
> mantêm `valor`/`cashback`. O `codigo` é exibido como `AAA-N` (sigla da contratante + nº).
- **Cadastro de Clientes** — mapa **Cliente→Contratante** (137 médicos, 7 parceiros).
- **base de dados** — bruta (615), com **PII** do médico; enriquece o painel de detalhes.
  `funding_name`=MEDFLOW (não é parceiro); status só `ISSUED` (sem pagamento).

Mapa de colunas, normalização (moeda US `R$ 1,300.00`, datas mistas ISO/BR), regra de
status e join: ver `specs/001-portal-parceiro/data-model.md` e `research.md`.

## Como rodar / variáveis de ambiente

Ver `specs/001-portal-parceiro/quickstart.md` (passo a passo do **Service Account** para
tornar a planilha privada e acessível ao backend).

Rápido:
- **Backend**: `cd backend` · `uv venv --python 3.12 .venv` · `uv pip install -r requirements.txt`
  · copiar `.env.example`→`.env` (preencher) · `.venv\Scripts\uvicorn app.main:app --reload`.
  Testes: `.venv\Scripts\python -m pytest` · Lint: `.venv\Scripts\python -m ruff check .`
- **Frontend**: `cd frontend` · `pnpm install` · copiar `.env.local.example`→`.env.local`
  · `pnpm dev`. Build: `pnpm build`. Service Account deste projeto:
  `portal-medflow-backend@automacao-medflow-lumina.iam.gserviceaccount.com` (compartilhar a
  planilha como Leitor com esse e-mail).
- **Supabase**: aplicar as migrations de `supabase/migrations/` (pela ordem do nome):
  `20260629_pagamentos_avisos.sql`, `20260630_pagamentos_avisos_data_vencimento.sql`,
  `20260701_pagamentos_avisos_rebate.sql`. (Papéis/contratante vivem no `app_metadata` do
  Auth — **não** há tabela `app_users`.)

## Estado da implementação (2026-07-02)

Stack construída e testada localmente (**114 testes de backend verdes**; ruff limpo; frontend
typecheck OK). Features entregues: 001 (portal base), 002 (filtros dinâmicos), 003 (vínculo
Contratante/Unidade por config), 004 (avisos de pagamento por lote), 005 (rebate no pagamento).

**Backend (FastAPI) — camadas (Princípio VII)**: `routers/` → `services/` → `domain/` →
integrações (`sheets/`, `auth/`). Isolamento (R-001) concentrado em `domain/scope.py` e
aplicado nos serviços **antes** de serializar.

| Endpoint | Papel | Função |
|---|---|---|
| `GET /api/me` | ambos | usuário atual (papel + contratante) |
| `GET /api/vencimentos?proximos=` | parceiro/gestor | cards + atrasados/próximos/pagos · gestor: consolidado ranqueado |
| `GET /api/solicitacoes` | parceiro/gestor | lista paginada/filtrável (busca, status, `parceiros` gestor); grupo de médico nunca cortado (RF-009) |
| `GET /api/solicitacoes/{codigo}` | parceiro/gestor | detalhe + PII do médico, **escopado** (404 se de outro parceiro); `{codigo}` no formato exibido `AAA-N` (ex.: `BES-1102`) |
| `GET /api/parceiros/lista` | gestor | contratantes + cor determinística + total |
| `GET /api/overview?ano=&meses=` | parceiro/gestor | métricas (incl. Ticket Médio) + série mensal (`aaaa-mm`), recortadas pelo toggle ano/mês |
| `GET/POST/PUT/DELETE /api/admin/parceiros` | gestor | CRUD de logins (Supabase Admin) |
| `GET /api/admin/pendencias` | gestor | "Pendências de Dados" (motivos + linha de origem) |
| `GET /api/filtros/opcoes` | parceiro/gestor | opções escopadas dos filtros dinâmicos (feature 002) |
| `GET/PUT /api/admin/{partners,parceiros,contratantes,unidades}` | gestor | config do Parceiro=Contratante: cor + allowlist de Unidades + rebate (features 003/005) |
| `POST/DELETE /api/pagamentos/avisos` · `GET /api/pagamentos/meus` | parceiro | envia/cancela aviso de pagamento por lote; estado dos avisos (feature 004) |
| `GET /api/pagamentos` · `POST /api/pagamentos/avisos/{id}/{verificar,rejeitar,reabrir}` | gestor | quadro de avisos + verificar/rejeitar/reabrir |

Erros: formato único `{ "error": { "code", "message" } }` (pt-BR). Dinheiro trafega como
string decimal **quantizada a centavos** (`money_str`, evita ruído de float do Sheets).
Cache TTL em processo (`SHEET_CACHE_TTL`, default 180s).

**Autenticação & papéis** (sem tabela): logins vivem **só** no Supabase **Auth**
(`auth.users`). `role` (`gestor`|`parceiro`) e `contratante` ficam no **`app_metadata`** do
usuário — editável apenas por service role/admin, nunca pelo próprio usuário (ao contrário
de `user_metadata`); é o que garante o isolamento (R-001), pois um parceiro não consegue se
promover. `nome_exibicao` vem do `user_metadata` (display name). O backend valida o token
chamando o Supabase (`auth.get_user`, `GET /auth/v1/user`) — dispensa o segredo de
assinatura e funciona com HS256 ou JWKS — e lê papel/contratante do `app_metadata`.

Gerência de logins em **dois lugares equivalentes** (mesma fonte `auth.users`): o dashboard
do Supabase (Authentication) **ou** a aba **Parceiros** do portal (gestor). Para setar o
papel manualmente no dashboard, ajuste o `app_metadata` (ex.: SQL no SQL Editor):
`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"gestor","contratante":null}' where email='...';`
(parceiro: `{"role":"parceiro","contratante":"BESA Medical Group"}`). A tabela `app_users`
foi **removida**.

**Configuração**: um único `.env` na **raiz** do repositório (gitignored) é a fonte de todas
as variáveis (backend + `NEXT_PUBLIC_*`). O backend lê `../.env`; o `frontend/next.config.mjs`
injeta as `NEXT_PUBLIC_*` desse mesmo arquivo no build/dev.

**Frontend (Next.js App Router)** — telas: `login`, `dashboard` (Visão Geral + gráfico
Recharts), `solicitacoes` (busca/filtros/"Ver mais"/painel de detalhe; barra multi-parceiro
no gestor), `vencimentos` (cards + seções; consolidado no gestor), `parceiros` (gestor, CRUD
+ confirmação), `pendencias` (gestor). App-shell com sidebar por papel, tema claro/escuro
(`next-themes`), menu de conta. Tokens OKLCH de `DESIGN.md`; util único de formatação
(`lib/format.ts`); todo dado vem da API (nunca lê a planilha direto).

**Testes de backend** (pytest): parser, status, validação/partição, escopo (R-001),
vencimentos, solicitações (busca/paginação/agrupamento + não-vazamento de detalhe),
overview, guarda de admin (403), exclusão de pendências + self-healing, E2E de isolamento.

## Decisões registradas (2026-06-25)

- Arquitetura: FastAPI + Next.js + Supabase (auth) + Sheets via Service Account + cache TTL.
- Parceiro = `Contratante` = Franquia (agregada; `Unidade Referência` é sub-unidade).
- Fonte das solicitações = aba **Dados Tratados** (mostra o que está tratado; ~40/615 hoje).
- **Visibilidade por papel (D5′)**: o parceiro vê a **lista-modelo** de colunas + **toda a
  PII** do seu médico (CPF/PIX/etc.), mas **NÃO** as margens da MedFlow (Lucro Operacional,
  ÁGIO) — strip no backend. Gestor vê tudo. Isolamento entre parceiros mantido por
  `Contratante` (gate ortogonal à máscara de margens).
- **"Pendências de Dados"** (área só do gestor): solicitações com dado faltando/inválido
  (ex.: sem Contratante) são desviadas para cá com o motivo, e somem de todas as outras
  telas e agregações. Sem estado persistido — corrigida a planilha, voltam sozinhas no
  próximo refresh. Regras: ver `data-model.md §6`.
- **Fonte = só as linhas tratadas** (modelo): o portal usa apenas o que está em
  `Dados Tratados` (~40 hoje); cobrir o resto é manutenção da planilha pela MedFlow.
- **`INDIVIDUAL` / médico sem franquia**: **não** vira login; cai em "Pendências de Dados"
  (motivo "Médico sem franquia (INDIVIDUAL)") até o gestor tratar na fonte.

## Pendências em aberto

1. **Segurança (resolvido em 2026-07-02)**: a planilha foi **restringida** (não é mais
   pública); acesso só pela Service Account (Leitor). O `SHEET_ID` real foi removido do
   `.env.example` e da doc — vive só no ambiente. (Confirmar que o OAuth secret exposto foi
   revogado, se ainda pendente.)
2. **Dependência Next.js**: fixada em `14.2.18` (atende "Next 14+" do plano). O pnpm sinaliza
   um aviso de segurança nessa versão → atualizar para o último patch da linha 14.2.x antes
   do deploy em produção.
3. **Decisão de arquitetura (perf/RSC)**: as telas de dados são Client Components porque o
   JWT do Supabase vive no browser (sessão do usuário) e dá o escopo (R-001) na chamada à
   API. Por isso não usamos data-fetching em RSC para essas páginas; a performance vem de
   paginação no servidor + cache TTL + payload enxuto. Migrar para RSC exigiria repassar o
   token ao servidor Next (cookies) — caminho de evolução, não no MVP.
