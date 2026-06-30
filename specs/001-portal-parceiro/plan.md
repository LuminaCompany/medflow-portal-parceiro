# Plano de Implementação: Portal do Parceiro — MedFlow

**Feature**: `specs/001-portal-parceiro` | **Criado**: 2026-06-25
**Spec**: [spec.md](./spec.md) | **Pesquisa**: [research.md](./research.md) |
**Dados**: [data-model.md](./data-model.md) | **Contratos**: [contracts/](./contracts/) |
**Setup**: [quickstart.md](./quickstart.md)

> Plano cobre **COMO** construir. Princípio que atravessa tudo: **isolamento de dados**
> (R-001) garantido no backend. Meta de produto: suave, rápido, clean (DESIGN.md).

---

## Resumo

Portal web somente leitura. **Frontend Next.js** (App Router, Server Components) consome
uma **API Python (FastAPI)** que é o único gateway de dados. A API lê a **planilha Google
Sheets** (fonte financeira) via **Service Account**, normaliza, mantém em **cache com TTL**
e serve dados **escopados por parceiro** (coluna `Contratante`) e paginados. **Supabase**
cuida apenas de **autenticação e mapeamento usuário→parceiro/papel**. Nenhum dado
financeiro é persistido em banco — o portal espelha a planilha.

---

## Contexto Técnico

| Item | Decisão |
|---|---|
| **Linguagem backend** | Python 3.11+ |
| **Framework backend** | FastAPI + Uvicorn (ASGI). Pydantic v2 para validação/serialização |
| **Linguagem frontend** | TypeScript |
| **Framework frontend** | Next.js 14+ (App Router, Server Components por padrão) |
| **Fonte de dados financeiros** | Google Sheets (1 planilha, 3 abas) via Sheets API + Service Account. `Dados Tratados`=solicitações · `Cadastro de Clientes`=Cliente→Contratante · `base de dados`=detalhe/PII do médico |
| **Auth / usuários** | Supabase Auth (e tabela `app_users` p/ papel + `contratante`) |
| **Cache** | Cache em processo com TTL (ver research) — sem mirror em DB no MVP |
| **Gráficos** | Recharts (leve, declarativo) — linha/pizza/barra |
| **HTTP client (back→Sheets)** | `google-api-python-client` ou `gspread` |
| **Deploy** | **Frontend:** Vercel. **Backend:** VPS própria com EasyPanel (container Docker, uvicorn). Hosts separados |
| **Testes** | pytest (back) + Vitest/Playwright (front), foco em isolamento e parsing |
| **Estilo/Tokens** | DESIGN.md (OKLCH, Montserrat+Inter, tema claro/escuro) |
| **Performance** | Server-side pagination (20), cache TTL, RSC streaming, payload enxuto |

**Pendências resolvidas em research.md**: acesso seguro à planilha (Service Account),
estratégia de cache em serverless, normalização de moeda/datas mistas, regra de status,
visibilidade de colunas por papel.

---

## Verificação Constitucional (Gate)

Avaliado contra `.specify/memory/constitution.md` v1.0.0:

| Princípio | Conformidade |
|---|---|
| **I. Clean Code** | ✅ Camadas separadas (rotas/serviço/fonte); nomes de domínio em PT; lint Ruff+ESLint |
| **II. DRY** | ✅ Regra de status/parlikers e formatação têm fonte única. Backend calcula status e devolve rótulos prontos → frontend não reimplementa lógica financeira. Formatação de moeda/data: util único por lado, documentado |
| **III. KISS** | ✅ Cache em processo (não DB mirror); dataset pequeno; sem abstração especulativa |
| **IV. Stack** | ✅ FastAPI idiomático (type hints, Pydantic, camadas); Next RSC; segredos em env |
| **V. Doc Viva** | ✅ DOCUMENTATION.MD criado/atualizado; comentários no parsing e na regra de status |
| **VI. Isolamento (R-001)** | ✅ Backend resolve `contratante` do usuário autenticado e filtra **antes** de serializar; parceiro nunca recebe linha de outro `Contratante`. O gate é o **escopo por Contratante**; ortogonal a ele, a máscara por papel (research D5′) faz **strip das margens da MedFlow** (Lucro Operacional, ÁGIO) na serialização do parceiro — gestor mantém todas |

**Resultado**: PASS. Sem violações que exijam justificativa.

---

## Estrutura do Projeto

```
backend/                      # API Python (FastAPI) — container Docker na VPS (EasyPanel)
  app/
    main.py                   # cria app, monta routers, CORS
    config.py                 # settings via env (Pydantic Settings)
    auth/
      supabase.py             # verifica JWT Supabase, extrai user→papel/contratante
      deps.py                 # dependências FastAPI: get_current_user, require_gestor
    sheets/
      client.py               # autentica Service Account, lê a planilha
      parser.py               # normaliza moeda/datas, mapeia colunas → modelo
      cache.py                # cache TTL em processo
    domain/
      models.py               # Pydantic: Solicitacao, Pendencia, Metricas, Vencimentos...
      status.py               # regra Pago/A Pagar/Atrasado (fonte única)
      validation.py           # regras obrigatórias → particiona validas/pendencias
      scope.py                # filtro de isolamento por contratante + papel
    services/
      dataset.py              # carrega+normaliza+valida → (validas, pendencias) cacheado
      solicitacoes.py         # busca/filtra/pagina/agrupa (sobre validas)
      vencimentos.py          # cards + seções (atrasados/próximos/pagos)
      overview.py             # métricas + série mensal
      pendencias.py           # área "Pendências de Dados" (gestor)
      partners.py             # CRUD de logins (gestor) via Supabase Admin
    routers/
      solicitacoes.py vencimentos.py overview.py pendencias.py partners.py auth.py
  tests/                      # pytest: isolamento, parser, status
  requirements.txt
  Dockerfile                # imagem Docker p/ EasyPanel (uvicorn, porta 8000)

frontend/                     # Next.js — projeto Vercel
  src/
    app/
      (auth)/login/
      (portal)/
        dashboard/  solicitacoes/  vencimentos/
        parceiros/              # só gestor
        pendencias/             # só gestor — "Pendências de Dados"
        layout.tsx             # app-shell: sidebar + menu de conta
      layout.tsx               # ThemeProvider (claro/escuro)
    components/                # Tabela, Card, Badge, PainelLateral, GraficoMensal...
    lib/
      api.ts                   # client da API (fetch + auth header)
      format.ts                # moeda/data (display) — util único
      supabase.ts              # client Supabase (auth)
    styles/tokens.css          # tokens OKLCH do DESIGN.md
  package.json
```

**Documentação**: `DOCUMENTATION.MD` na raiz, mantido a cada mudança (Princípio V).

---

## Arquitetura & Fluxo de Dados

```
[Google Sheets] --(Sheets API, Service Account, leitura)--> [Backend FastAPI]
     fonte privada                                            |  parser+cache TTL
                                                              |  filtro por Contratante+papel
                                                              v
[Supabase Auth] --(JWT)--> [Backend valida + resolve user→contratante/papel]
                                                              |
                                                              v  JSON escopado+paginado
                                                       [Next.js RSC] --> UI clean
```

- **Parceiro** autentica (Supabase) → JWT → backend resolve `contratante` do usuário →
  toda resposta contém só as linhas daquele `Contratante`, sem colunas de margem.
- **Gestor** → papel `gestor` → vê todos os parceiros, consolidações e admin de logins.
- **Cache**: o backend lê a planilha 1× por janela de TTL e reusa; reduz latência e
  respeita quota da Sheets API. Invalidação por tempo (ver research).
- **Validação/Quarentena**: ao carregar, o dataset é particionado em `validas` e
  `pendencias` (regras obrigatórias). Todas as telas usam `validas`; as `pendencias` só
  aparecem na área gestor-only "Pendências de Dados" (RF-033/035, research D11). Sem estado
  persistido → corrigiu a fonte, a linha volta sozinha no próximo TTL (self-healing).

---

## Fases

### Fase 0 — Pesquisa (research.md) ✅
Resolve acesso seguro à planilha, cache em serverless, parsing de moeda/datas mistas,
regra de status, visibilidade por papel, escolha de gráficos.

### Fase 1 — Design & Contratos ✅
`data-model.md` (entidades + mapa de colunas + normalização + visibilidade por papel),
`contracts/` (endpoints da API), `quickstart.md` (setup back/front/Supabase/Service Account).

### Fase 2 — Tarefas (próximo: `/speckit-tasks`)
Quebra em tarefas ordenadas por dependência, agrupadas pelas histórias P1→P3 da spec.

---

## Riscos & Incoerências

1. **Planilha pública** (qualquer um com link lê tudo de todos os parceiros). Falha de
   privacidade. **Ação**: tornar privada + Service Account (quickstart §1, research D1).
   ⚠️ **Aberto.**
2. ✅ **Visibilidade de colunas** — RESOLVIDO: parceiro vê **tudo** (margens + PII do
   médico), decisão do usuário. Gate de segurança = só o escopo por Contratante. (D5)
3. ✅ **Parceiro = `Contratante` = Franquia** (não "Unidade Referência"). Unidade é
   sub-unidade. Confirmado.
4. ✅ **3 abas identificadas e atribuídas** (D10): `Dados Tratados` = solicitações;
   `Cadastro de Clientes` = mapa Cliente→Contratante; `base de dados` = detalhe/PII do
   médico. Usuários no Supabase.
5. ⚠️ **Prontidão de dados** — só **40 de 615** antecipações estão em `Dados Tratados`. O
   portal mostra o que está tratado; cobrir tudo é manutenção da planilha pela MedFlow
   (base bruta não tem status de pagamento). **Decidido**: fonte = Dados Tratados.
6. ⚠️ **Credencial enviada errada/exposta** — OAuth Client ID/Secret é tipo errado e o
   secret vazou em texto puro → **revogar e trocar**; usar Service Account. (research D1)
7. ✅ **`INDIVIDUAL` / médicos sem franquia** — RESOLVIDO: **não** viram login; suas
   solicitações vão para "Pendências de Dados" (motivo "Médico sem franquia (INDIVIDUAL)"),
   fora de toda visão de parceiro e agregação até o gestor tratar. (data-model §6, D11)
8. **Código da solicitação**: fonte usa número (`Solicitação`); UI pode prefixar, chave é
   o número.
