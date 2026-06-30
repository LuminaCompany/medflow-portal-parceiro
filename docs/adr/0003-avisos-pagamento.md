# Avisos de Pagamento por Unidade (parceiro avisa, gestor verifica)

**Status:** accepted (2026-06-29) — feature 004. Complementa Vencimentos (US1/RF-024) sem
alterar a fonte financeira: status continua vindo do sheet, mudado à mão pelo gestor.

## Contexto

Contratantes pagam **por Unidade** (não o valor cheio de uma vez). Faltava um canal para o
parceiro avisar "paguei a unidade X" e para o gestor conferir antes de marcar como pago. O
portal era 100% leitura sobre o sheet; a única escrita existente era config de parceiro no
Supabase Auth `app_metadata` — inadequada para um quadro de avisos consultável e mutável.

## Decisão

**Quadro de avisos persistido em Postgres (Supabase), desacoplado do status financeiro.**

1. **Primeira tabela de aplicação:** `public.pagamentos_avisos`. Acesso **só** pelo backend
   (service role; bypass de RLS). RLS habilitada **deny-all** — o frontend nunca fala com o
   Postgres direto (mantém o isolamento R-001 na borda da API). Migration em
   `supabase/migrations/20260629_pagamentos_avisos.sql`.

2. **Snapshot no envio:** ao confirmar, o backend congela `valor` (= total pendente da unidade)
   e `solicitacao_codigos` (códigos das solicitações pendentes cobertas). Mudanças posteriores
   no sheet **não** alteram o aviso — o gestor vê exatamente o que o parceiro afirmou pagar.

3. **Isolamento na criação:** o corpo do request só informa a **unidade**. `contratante`, valor
   e códigos são derivados do dataset **já escopado** do parceiro (`scope.filtra_por_escopo`),
   nunca do cliente. Unidade fora do escopo → 404.

4. **Máquina de estados** (`status`):
   - `pendente` → criado pelo parceiro.
   - `pendente → cancelado` → parceiro cancela o próprio aviso (só enquanto não verificado).
   - `pendente → verificado` → gestor confirma (registra `verificado_at`).
   - `pendente → rejeitado` → gestor rejeita com `motivo_rejeicao`.
   - `verificado → pendente` → gestor **desfaz** a verificação (corrige clique errado).
   - **Verificar/rejeitar não tocam o sheet nem o CRM** — só este quadro. O gestor atualiza o
     status financeiro manualmente na planilha depois.

5. **1 aviso ativo por unidade:** índice único parcial sobre `(contratante, unidade)` onde
   `status in ('pendente','verificado')`. Trava reenvio; `cancelado`/`rejeitado` são terminais e
   liberam um novo aviso da mesma unidade.

6. **Visão do gestor** (`GET /api/pagamentos`): seções grandes por contratante, com 3 blocos —
   **Aguardando verificação** (pendentes), **Verificadas** e **Falta aviso** (unidades com
   pendência no sheet e sem aviso ativo; anota o motivo do último aviso rejeitado, se houver).

7. **Visão do parceiro** (`GET /api/pagamentos/meus`): mapa `unidade → aviso vigente` que define
   o controle de cada linha na aba Vencimentos (Pagar · Aviso enviado · Pagamento verificado ·
   Rejeitado+motivo).

## Consequences

- Introduz dependência de Postgres no backend (antes só Auth Admin API). A migration precisa ser
  aplicada uma vez (SQL Editor do Supabase ou `supabase db push`).
- O quadro é **fonte de verdade só dos avisos**, não do status financeiro — sem risco de
  divergir do sheet por engano automático; a verificação é deliberada e reversível.
- `valor` divergente: como o snapshot congela no envio, um aviso pode ficar diferente da
  pendência atual da unidade (ex.: nova solicitação entrou depois). É intencional; o gestor pode
  rejeitar e pedir novo aviso.
- Endpoints novos sob `/api/pagamentos/*` seguem o mesmo formato de erro e auth (CurrentUser /
  GestorUser) do resto da API.
