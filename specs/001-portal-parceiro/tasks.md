# Tarefas: Portal do Parceiro — MedFlow

**Feature**: `specs/001-portal-parceiro` | **Gerado**: 2026-06-25
**Plano**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) |
**Dados**: [data-model.md](./data-model.md) | **Contratos**: [contracts/api.md](./contracts/api.md)

> Tarefas organizadas **por história de usuário** (P1→P3) para entrega incremental e teste
> independente. Princípio inegociável em toda tarefa de dados: **isolamento por
> `Contratante`** (R-001) garantido no **backend**.

**Convenções do checklist**: `- [ ] [ID] [P?] [Story?] descrição com caminho de arquivo`.
`[P]` = paralelizável (arquivo distinto, sem dependência pendente). `[USx]` = história.
Caminhos seguem a estrutura de `plan.md` (`backend/app/...`, `frontend/src/...`).

**Testes**: incluídos apenas onde `plan.md` os prioriza explicitamente — **isolamento
(R-001)**, **parsing**, **status** e **validação/quarentena**. Não é TDD completo.

---

## Fase 1 — Setup (inicialização do projeto)

- [X] T001 Criar estrutura do backend (`backend/app/{auth,sheets,domain,services,routers}`, `backend/tests/`) e `backend/requirements.txt` (fastapi, uvicorn, pydantic, pydantic-settings, google-api-python-client, google-auth, supabase, python-dateutil)
- [X] T002 [P] Criar `backend/app/config.py` (Pydantic Settings) + `backend/.env.example` com `SHEET_ID`, `SHEET_TAB_SOLICITACOES`, `SHEET_TAB_CADASTRO`, `SHEET_TAB_BASE`, `SHEET_CACHE_TTL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `GOOGLE_SERVICE_ACCOUNT_JSON`
- [X] T003 [P] Inicializar projeto Next.js em `frontend/` + `frontend/package.json` (next 14+, react, typescript, next-themes, recharts, @supabase/supabase-js) e `frontend/.env.local.example`
- [X] T004 [P] Criar `frontend/src/styles/tokens.css` com tokens OKLCH (claro/escuro) de `DESIGN.md`
- [X] T005 [P] Provisionar Supabase: tabela `app_users` (`id`, `email`, `role`, `contratante`, `nome_exibicao`, `created_at`) + RLS (usuário lê só a própria linha) conforme `data-model.md §2`
- [X] T006 [P] Configurar lint/format (Ruff em `backend/`, ESLint+Prettier em `frontend/`) e deploy: `backend/Dockerfile` (uvicorn, porta 8000, p/ EasyPanel na VPS) + projeto Vercel do `frontend/`

---

## Fase 2 — Fundação (pré-requisitos bloqueantes de TODAS as histórias)

> ⚠️ Nada das histórias começa antes desta fase. Aqui entram a leitura/normalização da
> planilha, a partição `validas`/`pendencias` (todas as telas leem `validas`), o
> isolamento por `Contratante`, a autenticação e o esqueleto de app/login do frontend.

**Pipeline de dados (backend)**

- [X] T007 Implementar `backend/app/sheets/client.py` — autentica Service Account e lê as 3 abas (`Dados Tratados`, `Cadastro de Clientes`, `base de dados`)
- [X] T008 [P] Implementar `backend/app/sheets/parser.py` — normaliza moeda `"R$ 1,300.00"`→`Decimal`, datas mistas ISO/BR→`date`, bool `QUITADO`, descarta linha de resumo, `trim` em `contratante`/`unidade` (`data-model.md §5`)
- [X] T009 [P] Implementar `backend/app/sheets/cache.py` — cache em processo com TTL (`research.md D2`)
- [X] T010 [P] Implementar `backend/app/domain/models.py` — Pydantic `Solicitacao`, `Pendencia`, `MetricasOverview`, `Vencimentos`, `Parceiro`, `AppUser`
- [X] T011 [P] Implementar `backend/app/domain/status.py` — `status(quitado, data_vencimento, hoje)` (fonte única) + rótulos (`data-model.md §4`)
- [X] T012 Implementar `backend/app/domain/validation.py` — regras obrigatórias (`data-model.md §6`) gerando motivos legíveis e `particiona() → (validas, pendencias)`
- [X] T013 Implementar `backend/app/domain/scope.py` — filtro de isolamento por `contratante` + papel (gestor ignora filtro) (R-001)
- [X] T014 Implementar `backend/app/services/dataset.py` — orquestra `client→parser→validation.particiona`, faz join com `Cadastro de Clientes` (resolver/validar `Contratante`) e prepara enriquecimento via `base de dados`; resultado `(validas, pendencias)` em cache TTL
- [X] T015 Implementar `backend/app/auth/supabase.py` — valida JWT Supabase e resolve usuário→`role`/`contratante` (`app_users`)
- [X] T016 Implementar `backend/app/auth/deps.py` — dependências `get_current_user` e `require_gestor`
- [X] T017 Implementar `backend/app/main.py` — cria app FastAPI, CORS, monta routers, formato único de erro (`contracts/api.md`)
- [X] T018 Implementar `backend/app/routers/auth.py` — `GET /api/me` (id, nome_exibicao, role, contratante)

**Testes de fundação (críticos — foco de `plan.md`)**

- [X] T019 [P] `backend/tests/test_parser.py` — moeda US, datas ISO+BR, descarte de resumo
- [X] T020 [P] `backend/tests/test_status.py` — pago/atrasado/a_pagar, vencimento hoje = a_pagar
- [X] T021 [P] `backend/tests/test_validation.py` — cada regra gera o motivo certo; múltiplos motivos; partição correta
- [X] T022 [P] `backend/tests/test_scope.py` — parceiro nunca recebe linha de outro `Contratante` (R-001)

**Esqueleto do frontend**

- [X] T023 [P] Implementar `frontend/src/lib/supabase.ts` — client Supabase (auth, anon key)
- [X] T024 [P] Implementar `frontend/src/lib/api.ts` — wrapper `fetch` com header `Authorization: Bearer`
- [X] T025 [P] Implementar `frontend/src/lib/format.ts` — formatação de moeda/data pt-BR (util único de exibição)
- [X] T026 Implementar `frontend/src/app/layout.tsx` — `ThemeProvider` (next-themes) + tokens
- [X] T027 Implementar `frontend/src/app/(auth)/login/page.tsx` — formulário de login (Supabase), roteamento por papel, erro de credencial inválida (RF-002/RF-004)
- [X] T028 Implementar `frontend/src/app/(portal)/layout.tsx` — app-shell (sidebar com abas por papel, slot de conta) + guarda de rota por papel
- [X] T029 [P] Implementar componentes compartilhados em `frontend/src/components/` — `Tabela`, `Card`, `BadgeStatus`, `PainelLateral`, `EstadoVazio`

**Checkpoint**: fundação pronta → cada história P1 abaixo é implementável e testável de forma independente.

---

## Fase 3 — História 1 (P1): Parceiro vê quanto deve e para quando

**Objetivo**: na aba Vencimentos o parceiro vê Total Pendente, Em Atraso, contagens e as
listas de atrasados/próximos/pagos — só do próprio parceiro.

**Teste independente**: autenticar como parceiro, abrir Vencimentos, conferir 4 cards + 3 seções, todos escopados (R-001).

- [X] T030 [US1] Implementar `backend/app/services/vencimentos.py` — cards (`total_pendente`, `em_atraso`, `n_atrasadas`, `n_a_pagar`) + listas `atrasados`/`proximos`(filtro `2d|1sem|2sem`)/`pagos` sobre `validas`, escopado (`data-model.md §3`, `contracts/api.md`)
- [X] T031 [US1] Implementar `backend/app/routers/vencimentos.py` — `GET /api/vencimentos?proximos=` (shape do parceiro)
- [X] T032 [US1] Implementar `frontend/src/app/(portal)/vencimentos/page.tsx` — 4 cards + seções Atrasados/Próximos(filtro período)/Pagos reusando `Tabela` (RF-014..017)
- [X] T033 [P] [US1] `backend/tests/test_vencimentos.py` — agregação correta + escopo por `Contratante`

**Checkpoint**: US1 entregue — valor financeiro central já visível ao parceiro. **MVP mínimo.**

---

## Fase 4 — História 2 (P1): Parceiro consulta e investiga solicitações

**Objetivo**: tabela de Solicitações com busca, filtros, agrupamento por médico, paginação 20 + "Ver mais" e painel lateral de detalhe.

**Teste independente**: abrir Solicitações, buscar por código, filtrar por status, clicar numa linha e ver o painel lateral.

- [X] T034 [US2] Implementar `backend/app/services/solicitacoes.py` — filtro/busca (`q` por código/cliente/status), paginação (20/offset; grupo de médico nunca cortado — estende até fechar, RF-009), agrupamento por médico (metadado `medico_grupo_id`) sobre `validas`, escopado
- [X] T035 [US2] Implementar `backend/app/routers/solicitacoes.py` — `GET /api/solicitacoes` (lista paginada/filtrável) e `GET /api/solicitacoes/{codigo}` (detalhe + médico enriquecido com PII de `base de dados`, escopado)
- [X] T036 [US2] Implementar `frontend/src/app/(portal)/solicitacoes/page.tsx` — tabela 20 + "Ver mais" + busca + filtros + agrupamento por médico (RF-007a/009/010/011/012)
- [X] T037 [US2] Ligar `PainelLateral` ao detalhe (`GET /api/solicitacoes/{codigo}`) com dados da solicitação + médico (RF-013)
- [X] T038 [P] [US2] `backend/tests/test_solicitacoes.py` — busca/paginação/agrupamento + detalhe **não** vaza médico de outro parceiro

**Checkpoint**: US2 entregue — base verificável das solicitações disponível ao parceiro.

---

## Fase 5 — História 3 (P1): Gestor administra acessos dos parceiros

**Objetivo**: gestor lista, cria e remove (com confirmação) logins de parceiros — única ação de escrita.

**Teste independente**: como gestor, abrir Parceiros, criar login, vê-lo na lista, removê-lo com confirmação.

- [X] T039 [US3] Implementar `backend/app/services/partners.py` — listar/criar/editar/remover logins via Supabase Admin (service role, só no backend)
- [X] T040 [US3] Implementar `backend/app/routers/partners.py` — `GET/POST/PUT/DELETE /api/admin/parceiros`, protegido por `require_gestor` (403 ao parceiro, RF-028; editar = RF-027a)
- [X] T041 [US3] Implementar `frontend/src/app/(portal)/parceiros/page.tsx` — lista + form "Adicionar" + "Editar" (contratante/senha) + "Remover" com modal de confirmação (RF-025..027a)
- [X] T042 [P] [US3] `backend/tests/test_admin_guard.py` — parceiro recebe `403` em `/api/admin/*`

**Checkpoint**: US3 entregue — gestor já provisiona acessos; pré-requisito operacional satisfeito.

---

## Fase 6 — História 7 (P1): Gestor sanea pendências de dados

**Objetivo**: solicitações reprovadas na validação aparecem **só** em "Pendências de Dados",
com motivo(s) e linha de origem; somem de todas as outras telas/agregações; voltam sozinhas
quando a fonte é corrigida. (Partição já feita em T012/T014 — aqui é a exposição gestor-only.)

**Teste independente**: inserir na planilha solicitação sem `Contratante`; confirmar que some das telas normais e aparece em Pendências com o motivo correto; corrigir e ver reentrada.

- [X] T043 [US7] Implementar `backend/app/services/pendencias.py` — expõe `pendencias` (já particionadas) com `q` + paginação, montando `motivos[]` + `linha_origem`
- [X] T044 [US7] Implementar `backend/app/routers/pendencias.py` — `GET /api/admin/pendencias`, protegido por `require_gestor` (RF-034)
- [X] T045 [US7] Implementar `frontend/src/app/(portal)/pendencias/page.tsx` — tabela com motivo(s) + `linha_origem`, entrada de navegação só para gestor (RF-036)
- [X] T046 [P] [US7] `backend/tests/test_pendencias_exclusao.py` — pendência **ausente** de `/solicitacoes`, `/vencimentos`, `/overview` e de toda métrica (RF-035) + reentrada self-healing (RF-037)

**Checkpoint**: todas as histórias **P1** entregues → portal entrega o valor central com integridade garantida.

---

## Fase 7 — História 4 (P2): Parceiro acompanha sua operação no dashboard

**Objetivo**: Visão Geral com cards de métrica, comparação temporal e gráfico mensal — escopado.

**Teste independente**: como parceiro, abrir Visão Geral e conferir cards + gráfico mensal, só com seus dados.

- [X] T047 [US4] Implementar `backend/app/services/overview.py` — métricas (`total_solicitacoes`, `valor_total`, `total_cashback`, `em_aberto`, `pagas`, `medicos_impactados`), `serie_mensal[]` (histórico, `aaaa-mm`) e `comparacao` (mês atual vs. anterior, `?mes=`) sobre `validas`, escopado
- [X] T048 [US4] Implementar `backend/app/routers/overview.py` — `GET /api/overview`
- [X] T049 [US4] Implementar `frontend/src/app/(portal)/dashboard/page.tsx` — cards + gráfico mensal (Recharts) + comparação mês atual vs. anterior + filtro por período/mês (RF-018..020, RF-011)
- [X] T050 [P] [US4] `backend/tests/test_overview.py` — métricas/série corretas + escopo

**Checkpoint**: US4 entregue — leitura/contexto para o parceiro.

---

## Fase 8 — História 5 (P2): Gestor enxerga o consolidado de todos os parceiros

**Objetivo**: dashboard, solicitações e vencimentos consolidados; botões multi-parceiro com cor de fundo; ranking de devedores.

**Teste independente**: como gestor, abrir cada aba, ver consolidado e filtrar por parceiro(s).

- [X] T051 [US5] Estender `overview.py`/`vencimentos.py`/`solicitacoes.py` para o papel gestor — sem filtro de `contratante`, somatórios globais, ranking de devedores (vencidos/a vencer desc) (RF-021/024)
- [X] T052 [US5] Implementar `GET /api/parceiros/lista` (em `routers/solicitacoes.py` ou router próprio) — `contratante` + `cor` + `total` para a barra de botões; atribuição de cor determinística por parceiro (RF-022/023)
- [X] T053 [US5] Implementar variantes gestor no frontend — `solicitacoes`: barra de botões multi-parceiro + cor de fundo por parceiro; `vencimentos`: 2 cards + 2 listas ranqueadas; `dashboard`: consolidado
- [X] T054 [P] [US5] `backend/tests/test_gestor_consolidado.py` — somatório global correto + cor estável por parceiro

**Checkpoint**: US5 entregue — operação interna da MedFlow com visão total.

---

## Fase 9 — História 6 (P3): Sessão, conta e preferências

> Login/roteamento/guarda já estão na fundação (T026–T028). Aqui ficam tema, menu de conta e refinos de UX.

**Objetivo**: alternar tema claro/escuro, menu de conta no canto inferior esquerdo com logout.

**Teste independente**: logar, alternar tema, abrir menu de conta e deslogar.

- [X] T055 [US6] Implementar componente de alternância de tema (claro/escuro) respeitando `prefers-reduced-motion` (RF-029)
- [X] T056 [US6] Implementar menu de conta no canto inferior esquerdo (nome do login + opção sair/deslogar) (RF-003)
- [X] T057 [US6] Refinar UX de login: mensagens de erro claras e roteamento por papel (RF-002/004)

**Checkpoint**: US6 entregue — experiência de portal profissional completa.

---

## Fase 10 — Polimento & Transversais

- [X] T058 [P] Garantir `EstadoVazio` explicativo em todas as abas (sem tela em branco) (RF-031)
- [X] T059 [P] Acessibilidade WCAG AA — contraste ≥ 4.5:1, foco visível, navegação por teclado, status não dependente só de cor (CS-005/006/007)
- [X] T060 [P] Atualizar `DOCUMENTATION.MD` com endpoints/telas implementados e decisões finais (Princípio V)
- [x] T061 [P] Corrigir inconsistência em `specs/001-portal-parceiro/quickstart.md §5.3` (parceiro **vê** margens — decisão D5; passo corrigido). Também alinhado o Gate VI em `plan.md`. ✅ Resolvido nesta revisão de specs.
- [X] T062 [P] Passe de performance — paginação no servidor, cache TTL afinado, payload enxuto, streaming RSC (meta "suave/rápido")
- [X] T063 Teste E2E de isolamento (R-001/CS-002) — manipular `parceiros`/ID por parceiro deve resultar em `403`/dado vazio, nunca vazamento

---

## Dependências entre Histórias

```
Setup (Fase 1)
   └─► Fundação (Fase 2)  ◄── bloqueia tudo
          ├─► US1 Vencimentos parceiro (P1)   ─┐
          ├─► US2 Solicitações parceiro (P1)   │ independentes entre si
          ├─► US3 Parceiros admin (P1)         │ (após fundação)
          ├─► US7 Pendências de Dados (P1)    ─┘
          ├─► US4 Dashboard parceiro (P2)      (usa overview; independente de US1/2/3/7)
          ├─► US5 Consolidado gestor (P2)      (estende serviços de US1/2/4)
          └─► US6 Sessão/tema/conta (P3)
   └─► Polimento (Fase 10)  ◄── após histórias relevantes
```

- **US5 depende** dos serviços de US1/US2/US4 (estende-os para o papel gestor).
- Demais P1 (US1/US2/US3/US7) são **mutuamente independentes** após a fundação.
- A partição `validas`/`pendencias` (T012/T014) é pré-requisito de **todas** as telas.

---

## Exemplos de Execução Paralela

**Fundação (após T001–T007)** — arquivos distintos, sem dependência mútua:
```
T008 parser.py · T009 cache.py · T010 models.py · T011 status.py   (paralelo)
T019 test_parser · T020 test_status · T021 test_validation · T022 test_scope (paralelo)
T023 supabase.ts · T024 api.ts · T025 format.ts · T029 componentes  (paralelo)
```

**Entre histórias P1 (com equipe)** — backend de cada história em paralelo:
```
Dev A: T030–T033 (US1)   Dev B: T034–T038 (US2)
Dev C: T039–T042 (US3)   Dev D: T043–T046 (US7)
```

**Testes marcados [P]** rodam em paralelo aos demais de sua fase: T033, T038, T042, T046, T050, T054.

---

## Estratégia de Implementação (MVP primeiro)

1. **MVP**: Fase 1 + Fase 2 + **US1** (T001–T033). Entrega o valor nº1 — o parceiro vê
   quanto deve e para quando, isolado e correto.
2. **Incremento P1**: somar US2, US3 e US7 (em qualquer ordem após a fundação) → portal P1
   completo, com integridade de dados garantida.
3. **Incremento P2**: US4 (dashboard parceiro) → US5 (consolidado gestor).
4. **Incremento P3**: US6 (tema/conta) + Fase 10 (polimento/acessibilidade/performance).

> Cada checkpoint de história é um ponto de parada testável e potencialmente entregável.

---

## Resumo

- **Total de tarefas**: 63 (T001–T063).
- **Por fase**: Setup 6 · Fundação 23 · US1 4 · US2 5 · US3 4 · US7 4 · US4 4 · US5 4 · US6 3 · Polimento 6.
- **Por história**: US1=4, US2=5, US3=4, US7=4, US4=4, US5=4, US6=3.
- **Paralelizáveis [P]**: ~28 tarefas.
- **MVP sugerido**: Fases 1–2 + US1 (T001–T033).
- **Pré-requisito crítico**: partição `validas`/`pendencias` (T012/T014) + isolamento (T013) antes de qualquer tela.
