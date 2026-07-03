# Auditoria de Segurança — MedFlow Portal do Parceiro

> Auditoria ponta a ponta de todo o código-fonte (backend FastAPI, frontend Next.js,
> migrations Supabase, config/infra), realizada em **2026-07-02** pelo agente
> `security-vuln-reviewer`. Rastreou-se o caminho completo do dado
> (entrada → auth → escopo → query/sheet → resposta) em cada endpoint, com foco máximo
> no isolamento por `Contratante`/`Unidade` (Princípio VI da constituição).

## Veredito executivo

**Nenhuma vulnerabilidade de severidade Crítica, Alta ou Média atingiu o limiar de
confiança para reporte (>80% de exploração concreta).**

O escopo é um ponto único (`domain/scope.py`), aplicado **antes** dos filtros em **todos**
os serviços de dados, com falha-fechada consistente. O bug histórico de vazamento no
endpoint de detalhe está corrigido e foi reconfirmado. Abaixo estão: (1) os vetores de
maior risco investigados a fundo e por que foram descartados; (2) pontos fortes;
(3) áreas de menor risco a monitorar; (4) itens não verificáveis só por código.

---

## 1. Vetores de alto risco investigados e DESCARTADOS

Cada item abaixo é uma vulnerabilidade *potencial* que foi rastreada até o código e
provada **não explorável**. A "causa" descreve por que a defesa se sustenta.

| # | Vetor | Local | Causa (por que não é explorável) |
|---|-------|-------|----------------------------------|
| 1 | **Isolamento cross-Contratante via endpoint de detalhe** | `backend/app/services/solicitacoes.py:123-149` · `backend/app/routers/solicitacoes.py:56-62` | Busca do `codigo` ocorre **dentro** de `filtra_por_escopo(dataset.validas, user)`. Código de outro parceiro → `None` → 404, sem vazar existência. Resumo do médico roda sobre `do_contratante` já escopado. **Corrigido e reconfirmado.** |
| 2 | **IDOR no cancelamento de aviso** | `backend/app/services/pagamentos.py:261-268` | `cancelar` compara `aviso["contratante"]` com a identidade **do token** (não do corpo) → "não encontrado" se divergir. Só cancela se `pendente`, com guarda atômica `esperado=AVISO_PENDENTE` no UPDATE. |
| 3 | **Manipulação de valor/rebate no aviso** | `backend/app/routers/pagamentos.py:58-92` · `backend/app/services/pagamentos.py:63-66` | Corpo só informa `unidade` + `data_vencimento`. `valor`/`rebate`/`codigos` são recomputados no servidor via `snapshot_lote` sobre dados **já escopados**; `valor_esperado` é só um eco que **bloqueia** se divergir. `rebate > valor` bloqueia. `contratante` sempre de `user.contratante`. |
| 4 | **Escalonamento via `app_metadata` do cliente** | `backend/app/auth/supabase.py:70-101` | `role`/`contratante`/`unidades`/`rebate_ativo` lidos do usuário validado server-side pelo Supabase, nunca do corpo. `role` vive em `app_metadata` (não editável pelo usuário). `criar_login`/`editar_config` fixam `role: "parceiro"` hardcoded — nenhum endpoint promove a gestor. |
| 5 | **Bypass de escopo via filtros dinâmicos (002)** | `backend/app/domain/filtros/engine.py` · `registry.py:105-109` · `services/opcoes.py:19-21` | Engine é puro e roda **depois** de `filtra_por_escopo`. Filtro `contratante` é `papeis={gestor}`; mesmo se forçado, opera sobre lista já escopada. Opções de filtro também escopadas. |
| 6 | **JWT / validação de token** | `backend/app/auth/supabase.py:51-62` · `auth/deps.py:17-34` | `resolve_user` valida via `auth.get_user(token)` (Supabase valida assinatura/expiração/audience server-side); falha → 401. Resolução a cada request, sem cache de identidade. |

---

## 2. Pontos fortes de segurança observados

1. **Ponto único de isolamento com falha-fechada** (`domain/scope.py:24-46`): parceiro sem
   `contratante` → nenhuma linha; allowlist `[]` → nenhuma linha; allowlist **nunca** fura
   Contratante. Documentado e aplicado uniformemente.
2. **Strip de campos gestor-only no backend** (`services/serialize.py:47-54`):
   `lucro_operacional`, `agio_base`, `contratante`, `cor_parceiro` só entram com
   `incluir_gestor=True` — o payload não vaza na rede, não basta esconder no front.
3. **Snapshot financeiro derivado do servidor** e congelado; corpo do request nunca dita valor.
4. **RLS deny-all** na única tabela Postgres, service role só no backend
   (`supabase/migrations/20260629_pagamentos_avisos.sql:45-47`).
5. **Segredos exclusivamente em env**, `.gitignore` robusto (inclui padrões de Service
   Account JSON), sem vazamento no bundle (nenhum segredo com prefixo `NEXT_PUBLIC_`).
6. **Erros normalizados sem stack/PII** (`main.py:59-86`); 404 não revela existência de
   recurso de outro parceiro.
7. **Validação/quarentena** que protege o vínculo médico→parceiro contra divergência de
   digitação (`domain/validation.py:49-56`, motivo "Contratante divergente do cadastro").
8. **Query-builder parametrizado** em 100% dos acessos ao Postgres (`.eq`/`.insert`/`.update`,
   zero SQL cru/f-string/`rpc`); leitura do Sheets com escopo `spreadsheets.readonly`.

---

## 3. Áreas OK, mas a MONITORAR (baixo risco, não exploráveis ativamente)

| # | Ponto | Local | Causa / risco latente | Recomendação |
|---|-------|-------|-----------------------|--------------|
| 1 | **Join de PII do médico por nome global** *(maior atenção)* | `backend/app/services/dataset.py:37-42` (`medico_de`) · `backend/app/sheets/parser.py:221-257` (`parse_base`) | PII (CPF/telefone/e-mail/PIX) resolvida por `normalize_nome(cliente)` sobre a base **global**, sem recorte por Contratante; em colisão de nome normalizado, o último registro vence a dedup. Se duas Contratantes tiverem clientes com nome normalizado idêntico, o detalhe poderia exibir PII do homônimo de outra Contratante. **Não é finding reportável:** não é controlável/injetável pelo atacante (depende de coincidência de nomes reais) e o vínculo por nome é decisão de data-model. | Chavear o join por identidade forte (ex.: CPF) **ou** restringir a busca de PII ao conjunto já escopado do usuário. |
| 2 | **CORS `allow_methods=["*"]` / `allow_headers=["*"]` + `allow_credentials=True`** | `backend/app/main.py:50-56` | Mitigado: auth é por header `Authorization` (Bearer de `localStorage`, não cookie) e `allow_origins` vem de env (não wildcard). Sem exploração real. | Manter `CORS_ORIGINS` restrito ao domínio de produção; nunca usar `*`. |
| 3 | **Token em `localStorage`** | `frontend/src/lib/supabase.ts:14-19` (`persistSession`) | Padrão do Supabase para SPA; só roubável via XSS, que não existe hoje. | Vigiar qualquer `dangerouslySetInnerHTML` novo. |
| 4 | **OpenAPI/docs habilitados por padrão** | FastAPI `/docs`, `/openapi.json` | Expõem o contrato da API (não dados — tudo exige auth). | Considerar desabilitar em produção (redução de superfície). |
| 5 | **`unidades is None` = sem restrição de unidade** (back-compat) | `backend/app/domain/scope.py:43-44` | Correto por design (filtro de Contratante ainda se aplica), mas depende do back-compat. | Garantir que todo login novo receba allowlist explícita. |

---

## 4. Itens NÃO verificáveis só por código (requerem ambiente/deploy)

1. **Config de runtime em produção:** valor real de `CORS_ORIGINS`; se a planilha está
   compartilhada como **Leitor** (não pública); se a RLS está de fato ativa no projeto
   Supabase live. Tudo definido no deploy (VPS/EasyPanel + Vercel + Supabase).
2. **Políticas do projeto Supabase:** expiração/rotação de JWT, política de senha,
   confirmação de e-mail, provisionamento seguro das contas `gestor` (criadas manualmente
   fora do portal). Configuração de servidor.
3. **CVEs de dependências:** fora do escopo por instrução. Versões aparentam recentes
   (Next 14.2.18, `@supabase/supabase-js` 2.46.2, FastAPI/google-api-python-client), mas
   não se rodou scanner de terceiros.
4. **Comportamento concreto do `auth.get_user`** contra o GoTrue em produção
   (assinatura/audience) — validado por leitura do fluxo, não por execução em runtime.

---

## Superfície de ataque coberta (checklist)

**Backend — routers e gate de auth de cada um:**
`auth.py` (`/api/me` → `CurrentUser`) · `vencimentos.py` (`CurrentUser` + escopo) ·
`solicitacoes.py` (`CurrentUser` + `is_gestor` na lista) · `overview.py` (`CurrentUser`) ·
`filtros.py` (`CurrentUser`) · `pagamentos.py` (gate parceiro/gestor por rota) ·
`partners.py` (`GestorUser` em todas) · `pendencias.py` (`GestorUser`).

**Isolamento:** `filtra_por_escopo` aplicado antes de serializar/agir em `overview`,
`vencimentos_parceiro`, `listar_solicitacoes`, `detalhe_solicitacao`, `opcoes_de_filtro`,
`criar_aviso`, `meus_avisos`. Gestor ignora o filtro **por papel** (autorizado).

**Injeção:** 100% query-builder parametrizado; ranges do Sheets vêm de env
(`sheets/client.py:60-77`); sem `eval`/`pickle`/`yaml.load`/template dinâmico.

**Frontend:** único `dangerouslySetInnerHTML` é o shadcn `chart.tsx` com config estática
(não explorável); sem route handlers/server actions/middleware que contornem o backend.

**Migrations:** `pagamentos_avisos` com RLS deny-all; índice único parcial → 1 aviso ativo
por `(contratante, unidade, data_vencimento)`.
