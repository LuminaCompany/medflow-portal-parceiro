# MedFlow — Portal do Parceiro

Portal web somente leitura de antecipação de recebíveis médicos. Backend **Python/FastAPI**,
frontend **Next.js**, auth **Supabase**, dados financeiros em **Google Sheets** (lidos via
Service Account, em cache). Isolamento de dados por parceiro (`Contratante`) é inegociável.

- Constituição: `.specify/memory/constitution.md` (PT-BR, Clean Code/DRY/KISS, isolamento)
- Produto: `PRODUCT.md` · Design/tokens: `DESIGN.md` · Visão geral: `DOCUMENTATION.MD`

<!-- SPECKIT START -->
## Feature ativa: Portal do Parceiro
- Plano: `specs/001-portal-parceiro/plan.md`
- Spec: `specs/001-portal-parceiro/spec.md`
- Pesquisa: `specs/001-portal-parceiro/research.md`
- Modelo de dados: `specs/001-portal-parceiro/data-model.md`
- Contratos da API: `specs/001-portal-parceiro/contracts/api.md`
- Setup: `specs/001-portal-parceiro/quickstart.md`
<!-- SPECKIT END -->

## Feature: Filtros dinâmicos (002)
Filtros componíveis (chips) em todas as abas; registry único (back+front), engine aplica
após o escopo R-001. Opções escopadas via `GET /api/filtros/opcoes`.
- Spec: `specs/002-filtros-dinamicos/spec.md` · Changelog: `specs/002-filtros-dinamicos/CHANGELOG.md`
- Backend: `app/domain/filtros/{registry,engine}.py`, `app/services/opcoes.py`, `app/routers/filtros.py`
- Frontend: `lib/filtros/*`, `components/filtros/*`

## Feature: Vínculo Contratante/Unidade por config (003)
Parceiro = Contratante (cor + allowlist de Unidades + 1..N logins; config sincronizada no
`app_metadata`). login→Contratante via dropdown do sheet; Unidade→parceiro via allowlist do
gestor. Escopo do parceiro = Contratante **E** Unidade∈allowlist (`domain/scope.py`, ponto
único); allowlist nunca fura isolamento cross-Contratante (Princípio VI).
- ADR: `docs/adr/0002-vinculo-contratante-unidade-por-config.md`
- Backend: `app/services/partners.py`, `app/routers/partners.py`
  (`/api/admin/{partners,parceiros,contratantes,unidades}` + `PUT /partners` config)
- Frontend: `app/(portal)/parceiros/page.tsx`, `components/portal/EditorUnidades.tsx`

## Feature: Avisos de Pagamento por Unidade (004)
Parceiro avisa pagamento por **lote = (Unidade + data de vencimento)** (botão "Pagar" na aba
Vencimentos — mesma unidade pode ter vários vencimentos, pagos em separado); gestor verifica/
rejeita na aba "Pagamentos". NÃO toca sheet/CRM — status financeiro segue manual na planilha.
Snapshot congela valor+códigos no envio. 1ª tabela Postgres do portal (`pagamentos_avisos`,
service role, RLS deny-all; aviso ativo único por `(contratante,unidade,data_vencimento)`).
Estados: pendente→(cancelado|verificado|rejeitado); verificado→pendente.
- ADR: `docs/adr/0003-avisos-pagamento.md` · Migrations: `supabase/migrations/20260629_pagamentos_avisos.sql` + `20260630_pagamentos_avisos_data_vencimento.sql`
- Backend: `app/services/pagamentos.py`, `app/routers/pagamentos.py` (`/api/pagamentos/*`)
- Frontend: `app/(portal)/pagamentos/page.tsx`, `components/portal/ConfirmarPagamento.tsx`

## Feature: Rebate/cashback no pagamento (005)
Config por **Contratante** (não por login): toggle `rebate_ativo` no `app_metadata` (fan-out via
`editar_config`, editado no dialog "Editar parceiro"). Só p/ Contratantes com o serviço, o
pagamento vira **Valor a Pagar = Originação − Rebate**, onde Rebate = Σ `cashback` (coluna do
sheet, já existente) das solicitações pendentes do lote. Abate **só** no modal de pagamento
(parceiro) e no card de verificação (gestor) — Dashboard/Vencimentos seguem em Originação cheia.
O `rebate` é congelado no snapshot do aviso (0 p/ quem não tem o serviço; retrocompatível).
- ADR: `docs/adr/0004-rebate-no-pagamento.md` (bordas: rebate>valor bloqueia; eco de valor no
  envio; desligar persiste apesar do merge raso do GoTrue; toggle não altera aviso congelado)
- Migration: `supabase/migrations/20260701_pagamentos_avisos_rebate.sql` (coluna `rebate`)
- Backend: `rebate_ativo` em `AppUser`/`auth/supabase.py` + `partners.py`; `snapshot_lote`/`_serializa`
  em `pagamentos.py`; `rebate`/`valor_a_pagar` por lote em `vencimentos.py`
- Frontend: `Me.rebate_ativo` gate; `ConfirmarPagamento.tsx`, `pagamentos/page.tsx`, `parceiros/page.tsx` (Switch)
