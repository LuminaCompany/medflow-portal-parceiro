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
Parceiro avisa pagamento por **Unidade** (botão "Pagar" na aba Vencimentos); gestor verifica/
rejeita na aba "Pagamentos". NÃO toca sheet/CRM — status financeiro segue manual na planilha.
Snapshot congela valor+códigos no envio. 1ª tabela Postgres do portal (`pagamentos_avisos`,
service role, RLS deny-all). Estados: pendente→(cancelado|verificado|rejeitado); verificado→pendente.
- ADR: `docs/adr/0003-avisos-pagamento.md` · Migration: `supabase/migrations/20260629_pagamentos_avisos.sql`
- Backend: `app/services/pagamentos.py`, `app/routers/pagamentos.py` (`/api/pagamentos/*`)
- Frontend: `app/(portal)/pagamentos/page.tsx`, `components/portal/ConfirmarPagamento.tsx`
