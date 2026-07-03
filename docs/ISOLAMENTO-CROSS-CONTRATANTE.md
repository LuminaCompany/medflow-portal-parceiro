# Regra suprema — Isolamento cross-Contratante

> **A regra de negócio mais importante do portal. Acima de qualquer feature, prazo ou
> conveniência.** Deriva do Princípio VI da constituição (`.specify/memory/constitution.md`)
> e é requisito regulatório (fintech Bacen). Vazamento aqui é falha CRÍTICA, não bug menor.

## A regra

**Um login de uma Contratante NUNCA — em hipótese alguma — pode acessar, ver, contar ou
inferir qualquer dado de outra Contratante.** Nem uma linha, nem um valor agregado, nem um
nome, nem a existência de um recurso, nem uma opção de filtro.

- O parceiro só enxerga o **próprio** `Contratante` **E** as Unidades da sua allowlist (003).
- A visão consolidada (todas as Contratantes) é **exclusiva do gestor** e autorizada por papel.
- Na dúvida, **falha fechada**: sem escopo resolvido → nenhuma linha (nunca "mostra tudo").

## Como a regra é garantida (arquitetura)

Existe **um único ponto** de isolamento: `filtra_por_escopo` em
[`backend/app/domain/scope.py`](../backend/app/domain/scope.py). Toda resposta de dados de
parceiro passa por ele **antes** de qualquer filtro/serialização.

Garantia estrutural: **escopo SEMPRE antes do filtro.** Os filtros dinâmicos (feature 002)
são funções puras que rodam **depois** do escopo sobre a lista já reduzida — só conseguem
**estreitar**, nunca ampliar. Logo, nem um filtro injetado (`?parceiros=`, `?unidade=`, …)
fura o isolamento.

Pontos de apoio:

- **Autz por papel:** endpoints do gestor exigem `GestorUser` (403 ao parceiro) — ver
  [`backend/app/auth/deps.py`](../backend/app/auth/deps.py). `role`/`contratante` vêm do
  `app_metadata` validado server-side pelo Supabase (não editável pelo usuário, não vem do corpo).
- **Strip de campos gestor-only** na serialização (`services/serialize.py`) — o payload na
  rede não carrega `contratante`/`lucro`/`cor` para o parceiro.
- **Tabelas Postgres** (`pagamentos_avisos`, `feedbacks`): RLS deny-all, service role só no
  backend, e as leituras do parceiro filtram por `contratante` (`.eq`).
- **PII do médico:** join por nome com colisão detectada — nome repetido entre Contratantes
  → PII omitida (mostra "Nomes iguais na planilha"), nunca a PII do homônimo (ver `parse_base`).

## Contrato para QUALQUER endpoint novo de dados

Antes de considerar pronto um endpoint que retorne dado de parceiro:

1. Chamar `filtra_por_escopo(itens, user)` **como primeiro passo**, antes de filtro/busca/paginação.
2. Se for gestor-only, gatear com `GestorUser` (ou `is_gestor(user)` → 403).
3. Nunca derivar `contratante`/`role`/`unidades` do corpo do request — só do token (`user`).
4. **Adicionar o endpoint ao teste de varredura** (abaixo). Um endpoint de dados fora do teste
   é um endpoint não-provado.

## Proteção contra regressão (testes)

- [`backend/tests/test_scope.py`](../backend/tests/test_scope.py) — o choke point em isolamento:
  parceiro só vê o próprio; sem contratante → nada; allowlist de outra Contratante nunca concede.
- [`backend/tests/test_e2e_isolamento.py`](../backend/tests/test_e2e_isolamento.py) — **varredura
  ponta a ponta**:
  - `ENDPOINTS_DO_PARCEIRO`: cada endpoint que o parceiro alcança é exercido com um dataset que
    contém uma **segunda** Contratante; nenhuma marca dela pode aparecer no corpo bruto da resposta.
  - `ENDPOINTS_GESTOR_ONLY`: cada endpoint consolidado **deve** responder 403 ao parceiro.

**Ao criar um endpoint de dados, inclua-o na lista correspondente.** Se o novo endpoint
esquecer o escopo, o teste de varredura quebra — essa é a proteção durável contra o pior erro
possível do portal.
