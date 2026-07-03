# Rebate (cashback) no aviso de pagamento

**Status:** accepted (2026-07-02) — feature 005. Estende o aviso de pagamento (ADR 0003) com
o abatimento de rebate para as Contratantes que têm o serviço. Formaliza regras que o código
já assumia e que foram decididas na revisão profunda de 2026-07-02.

## Contexto

Algumas Contratantes têm um serviço em que pagam a **Originação menos o rebate** (= Σ `cashback`
do lote), não a Originação cheia. O `cashback` já existe como coluna do sheet. Faltava: (a) um
gate por Contratante ligável pelo gestor; (b) congelar o rebate junto do snapshot do aviso; (c)
regras de borda (rebate > valor, arredondamento, toggle com aviso ativo, retrocompatibilidade)
que o código teve que assumir sem registro — origem de bugs na revisão.

## Decisão

**Rebate é config por Contratante, congelado no snapshot, abatido só na superfície de pagamento.**

1. **Gate por Contratante (não por login):** flag `rebate_ativo` no `app_metadata`, com **fan-out**
   para todos os logins da Contratante (`partners.editar_config`). O backend relê o
   `app_metadata` a cada request (`auth.get_user`) — JWT velho não afeta o cálculo do snapshot.
   - **Desligar DEVE persistir:** o GoTrue faz **merge raso** de `app_metadata`; a chave
     `rebate_ativo` é sempre **gravada** (inclusive como `false`), nunca omitida — omitir deixava
     o `true` antigo sobreviver e o parceiro seguia pagando com desconto indevido.

2. **Valor a Pagar = Originação − Rebate**, com `Rebate = Σ cashback` das solicitações
   **pendentes** do lote (mesma definição de pendente do snapshot; pagas não entram). Contratante
   sem o serviço → `rebate = 0` (paga a Originação cheia).

3. **Abatimento só na superfície de pagamento:** o modal de pagamento (parceiro) e o card de
   verificação (gestor) mostram `valor_a_pagar`. **Dashboard e Vencimentos seguem em Originação
   cheia** — o rebate não muda as métricas de originação.

4. **Congelado no snapshot:** o `rebate` é gravado na tabela `pagamentos_avisos` (coluna `rebate`,
   migration `20260701_pagamentos_avisos_rebate.sql`) junto de `valor`/códigos, no envio. Linhas
   legadas (pré-migration) assumem `rebate = 0` pelo default — retrocompatível.

## Regras de borda (decididas em 2026-07-02)

- **Rebate > Originação (Valor a Pagar negativo):** é erro de dado (cashback digitado errado). O
  backend **bloqueia** o aviso com mensagem clara — **não** congela valor negativo.
  (`snapshot_lote`.)
- **Arredondamento:** somas em `Decimal` (nunca float); a serialização quantiza a centavos
  (`money_str`). Uma única função calcula os totais do lote, usada tanto pelo snapshot do aviso
  quanto pela linha de Vencimentos — não podem divergir.
- **Divergência exibido × congelado:** o `POST /avisos` aceita um **eco** `valor_esperado` (o
  valor que o parceiro viu). Se o snapshot recomputado no servidor divergir (dado mudou no sheet
  **ou** filtro de UI ativo reduzindo a linha), o envio é barrado com "recarregue" — em vez de
  congelar em silêncio um valor diferente do confirmado.
- **Toggle com aviso ativo:** desligar/ligar `rebate_ativo` **não** altera avisos já criados (o
  `rebate` está congelado no snapshot). Só vale para avisos futuros.

## Consequences

- O `rebate_ativo` é lido do `app_metadata` (fonte única, fan-out); o fan-out atualiza os logins
  um a um sem transação — uma falha no meio pode deixar logins com config divergente (mitigado
  por `_rebate_ativo_canonica` = `any(...)`; melhoria futura: tornar o fan-out atômico).
- A tabela `pagamentos_avisos` ganhou a coluna `rebate numeric(14,2) not null default 0`.
- Regras de borda antes implícitas agora têm teste: `snapshot_lote` bloqueia rebate > valor;
  desligar rebate persiste (teste de merge raso do GoTrue). Ver `backend/tests/test_pagamentos.py`
  e `test_partners.py`.
