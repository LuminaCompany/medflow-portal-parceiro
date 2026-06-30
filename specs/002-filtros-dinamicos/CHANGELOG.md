# Changelog — Sistema de Filtros Dinâmicos (002)

Data: 2026-06-25 · Base: feature 001-portal-parceiro.

## Adicionados

**Backend**
- `app/domain/filtros/__init__.py` — pacote.
- `app/domain/filtros/registry.py` — `CampoFiltro` + `REGISTRY` (12 campos) + `campos_da_aba`.
- `app/domain/filtros/engine.py` — `parse(params, aba, papel)` + `aplica(itens, filtros)`.
- `app/services/opcoes.py` — `opcoes_de_filtro(validas, user, aba)` (opções escopadas).
- `app/routers/filtros.py` — `GET /api/filtros/opcoes?aba=`.
- `tests/test_filtros.py` — engine (multi/range/date, bordas, AND), opções escopadas, segurança.

**Frontend**
- `lib/filtros/registry.ts` — espelho do registry (metadados estáticos + labels/formatos).
- `lib/filtros/serialize.ts` — parse/serialize multi e faixa, resumo do chip, rótulos.
- `lib/filtros/useFiltros.ts` — estado dos filtros na query string (por aba).
- `lib/filtros/useOpcoesFiltro.ts` — fetch `/api/filtros/opcoes`.
- `components/filtros/BarraFiltros.tsx` — orquestra chips + adicionar + limpar.
- `components/filtros/ChipFiltro.tsx` — chip de filtro ativo (editar/remover).
- `components/filtros/AdicionarFiltro.tsx` — popover escolher campo → editar valor.
- `components/filtros/EditorValor.tsx` — editores por tipo (checklist / faixa / datas).

**Specs**
- `specs/002-filtros-dinamicos/spec.md` — especificação.
- `specs/002-filtros-dinamicos/CHANGELOG.md` — este arquivo.

## Modificados

**Backend**
- `app/main.py` — registra `filtros.router`.
- `app/services/solicitacoes.py` — escopo R-001 primeiro + `aplica` filtros; remove params
  `status`/`parceiros` (agora via engine); `q` continua separado.
- `app/routers/solicitacoes.py` — parseia filtros da query (`parse_filtros`, aba `solicitacoes`).
- `app/services/overview.py` — aceita/aplica filtros; cards e série respeitam o filtro.
- `app/routers/overview.py` — parseia filtros (aba `overview`); `mes` só p/ comparativo.
- `app/services/vencimentos.py` — `vencimentos_parceiro`/`vencimentos_gestor` aplicam filtros.
- `app/routers/vencimentos.py` — parseia filtros (aba `vencimentos`).
- `tests/test_solicitacoes.py` — testes de filtro migrados p/ `parse_filtros`; +teste R-F06.

**Frontend**
- `app/(portal)/solicitacoes/page.tsx` — `BarraFiltros` + busca; remove select de status e
  barra de botões de parceiro; `Suspense`.
- `app/(portal)/vencimentos/page.tsx` — `BarraFiltros`; anexa filtros à API; `Suspense`.
- `app/(portal)/dashboard/page.tsx` — `BarraFiltros`; "Mês de referência" → "Mês do
  comparativo"; anexa filtros; `Suspense`.
- `components/ui/button.tsx` — convertido para `forwardRef` (correção: `asChild`/Radix Slot
  em React 18; também elimina warning de ref no app todo).

**Specs (001)**
- `specs/001-portal-parceiro/contracts/api.md` — params de filtro em
  `/api/solicitacoes`, `/api/overview`, `/api/vencimentos`; nova seção "Filtros dinâmicos"
  + endpoint `/api/filtros/opcoes`; `/api/parceiros/lista` agora só p/ cor de linha.

## Atualização posterior (Visão Geral — toggle ano/mês)

Supersede os itens de Visão Geral acima (`overview.py` `mes`/comparativo; dashboard
"Mês do comparativo"; chips `periodo`/`mes_originacao`):

- `overview.py`/`routers/overview.py` — `mes`/`comparacao` removidos; recorte por
  `?ano`/`?meses` (toggle); novo card **Ticket Médio**; resposta ganha `ano`/`anos_disponiveis`.
- `domain/filtros/registry.py` (front + back) — `periodo` removido; `mes_originacao` só na
  aba `solicitacoes`; rótulos de filtro `valor`→**Originação**, `cashback`→**Rebate**.
- `dashboard/page.tsx` — Comparativo e input de mês removidos; `SeletorTempoOverview`
  (toggle ano/mês) + card Ticket Médio.

## Notas

- Isolamento R-001 inalterado: escopo aplicado **antes** dos filtros; parceiro nunca
  amplia escopo (campo `contratante` é só-gestor; `/opcoes` devolve só o escopo do user).
- Validado E2E: `/api/filtros/opcoes` → `200` com opções nas 3 abas (JWT real de gestor).
  66 testes backend verdes; `tsc` e ESLint limpos.
- Pré-existente não tocado: `app/services/partners.py:126` E501 (lint), alheio a esta feature.
