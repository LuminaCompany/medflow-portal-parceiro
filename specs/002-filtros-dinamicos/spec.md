# Especificação — Sistema de Filtros Dinâmicos

**Diretório**: `specs/002-filtros-dinamicos`
**Criado em**: 2026-06-25
**Status**: Em implementação
**Depende de**: `001-portal-parceiro` (dataset, escopo R-001, contratos)

> Filtros dinâmicos, componíveis, em todas as abas. O usuário cria/adiciona/remove
> quantos filtros quiser; eles impactam **a aba aberta no momento**. As opções
> disponíveis mudam conforme a aba **e** o papel (parceiro/gestor). Isolamento R-001
> continua inegociável: o filtro de UI **nunca** amplia escopo.

---

## 1. Objetivo

Substituir os filtros fixos hard-coded (Status select, barra de parceiros, mês único,
período de próximos) por um **sistema declarativo único**, modular e fácil de manter —
será muito usado e recebe manutenção contínua. Adicionar um filtro novo deve custar
**uma entrada no registry frontend + (se campo novo) um getter no registry backend**,
sem tocar nas páginas.

## 2. Catálogo de filtros (confirmado)

Entram os de **alto valor (⭐)** e **úteis (➕)**; os de nicho ficam fora desta fase.

| Campo | Tipo | Solicitações | Vencimentos | Visão Geral | Papel |
|---|---|:--:|:--:|:--:|---|
| Status | multi | ✓ | ✓ | ✓ | ambos |
| Unidade | multi | ✓ | ✓ | ✓ | ambos (parceiro: só as suas) |
| Médico (Cliente) | multi | ✓ | ✓ | — | ambos |
| Originação (Valor) | range R$ | ✓ | ✓ | — | ambos |
| Data do Pedido | date-range | ✓ | — | — | ambos |
| Data de Vencimento | date-range | ✓ | ✓ | — | ambos |
| Mês de Originação | multi | ✓ | — | — | ambos |
| Mês de Vencimento | multi | ✓ | — | — | ambos |
| Rebate (Cashback) | range R$ | ✓ | — | — | ambos |
| Prazo (dias) | range | ✓ | — | — | ambos |
| Contratante | multi | ✓ | ✓ | ✓ | **só gestor** |

A busca livre (`q`) por código/cliente/status **continua separada** dos chips.

> **Visão Geral**: o recorte temporal **não** é mais um chip (`Período`/`Mês de Originação`
> saíram da aba `overview`) — virou um **toggle ano/mês** dedicado (`?ano`/`?meses`, spec
> 001 RF-019). Os chips que restam na Visão Geral são os não-temporais (Status, Unidade,
> Contratante). Rótulos `valor`→**Originação**, `cashback`→**Rebate** (campos inalterados).

## 3. Arquitetura

Filtro roda **no backend** (a Visão Geral e Vencimentos agregam no servidor; o escopo
R-001 e a paginação com agrupamento por médico já são server-side). Filtrar no cliente
vazaria/quebraria isso.

### 3.1 Fonte da verdade dividida
- **Metadados estáticos** (label, tipo, abas, papéis, formato de exibição) → registry
  **frontend** (`lib/filtros/registry.ts`).
- **Valores dinâmicos** (opções de unidade/médico/mês/contratante; min/max de
  valor/data) → endpoint **backend escopado** (`GET /api/filtros/opcoes`). Garante R-001:
  o parceiro só recebe as opções do próprio contratante.

### 3.2 Backend
```
domain/filtros/registry.py   # CampoFiltro(id, tipo, get, abas, papeis) + REGISTRY
domain/filtros/engine.py     # parse(params, aba, user) + aplica(itens, filtros)
services/opcoes.py           # opções escopadas por aba/user
routers/filtros.py           # GET /api/filtros/opcoes?aba=
```
Tipos de filtro: `multi` (∈ conjunto), `range` (min..max numérico), `date` (ini..fim).
Bordas abertas permitidas. Vários filtros = AND.

Integração (escopo **sempre primeiro e separado** — segurança nunca depende de filtro):
```
escopadas = filtra_por_escopo(validas, user)            # inalterado
filtros   = engine.parse(query_params, aba, user)
filtradas = engine.aplica(escopadas, filtros)
# solicitações: pagina/agrupa depois; overview/vencimentos: agrega depois
```

### 3.3 Frontend
```
lib/filtros/registry.ts        # CampoDef[] — único array de metadados
lib/filtros/serialize.ts       # URL <-> params (mesma convenção da API)
lib/filtros/useFiltros.ts      # estado dos chips na query string da rota (por aba)
lib/filtros/useOpcoesFiltro.ts # fetch /api/filtros/opcoes
components/filtros/BarraFiltros.tsx  # + ChipFiltro, AdicionarFiltro, EditorValor
```
Estado dos filtros vive na **URL** (cada aba já é rota própria) → compartilhável,
voltar/avançar, sobrevive a refresh. Serialização: `range`=`min..max`, `multi`=csv,
`date`=`ini..fim`.

Convenção de serialização compartilhada com a API:
```
GET /api/solicitacoes?status=atrasado&valor=1000..5000&unidade=Lorena,Aparecida
                      &data_pedido=2025-11-01..2026-03-31
```

### 3.4 Layout (topo de toda aba)
- Linha superior: busca (onde houver) + chips de filtros ativos + botão "Adicionar
  filtro" + "Limpar tudo" (só quando há filtro).
- Chip: `Campo: resumo` — clique abre popover de edição; `×` remove.
- "Adicionar filtro": popover lista os campos ainda não usados (do registry, filtrados
  por aba+papel) → escolhe campo → `EditorValor` por tipo (checklist com busca / 2
  inputs de range / range de datas).
- A barra de botões de parceiro do gestor é **absorvida** no chip `Contratante` (multi).

## 4. Requisitos

- **RF-F01**: Cada aba MUST exibir, no topo, uma barra de filtros com chips ativos e
  ação de adicionar/remover filtros.
- **RF-F02**: As opções de filtro disponíveis MUST variar conforme a aba aberta e o
  papel do usuário.
- **RF-F03**: O usuário MUST poder adicionar quantos filtros quiser (campos distintos),
  editar e remover individualmente, e limpar todos de uma vez.
- **RF-F04**: Os filtros MUST impactar apenas a aba aberta (estado por rota).
- **RF-F05**: Para o parceiro, as opções (ex.: unidades, médicos) MUST conter somente
  dados do próprio contratante (R-001).
- **RF-F06**: O filtro de UI MUST NOT ampliar o escopo; o isolamento é aplicado no
  backend antes dos filtros. Parceiro que tente filtrar por `contratante` é ignorado.
- **RF-F07**: Múltiplos filtros MUST combinar por AND.
- **RF-F08**: A Visão Geral MUST aceitar **intervalo de período** (substitui o mês
  único); métricas e série recalculam dentro do intervalo.
- **RF-F09**: Adicionar um campo de filtro novo MUST custar uma entrada no registry
  frontend + (se necessário) um getter no registry backend, sem alterar páginas.

## 5. Testes

- Engine: um teste por operador (`multi`/`range`/`date`), bordas abertas, AND de vários.
- Segurança: escopo R-001 intacto com filtros presentes; parceiro filtrando
  `contratante` não amplia escopo; `/opcoes` do parceiro só traz suas unidades/médicos.
- Paridade: todo campo do registry frontend tem correspondente no backend.

## 6. Fora de escopo (desta fase)

- Filtros de nicho (margens: Lucro Operacional/IOF/Juros/ÁGIO; Taxa de Juros; dias de
  atraso; tem OBS).
- Salvar conjuntos de filtros nomeados / presets persistidos.
- Filtros na aba Pendências (gestor).

## 7. Decisões de implementação (registradas pós-build)

- **`status` e `parceiros` absorvidos**: o endpoint `/api/solicitacoes` deixou de ter
  params `status`/`parceiros` dedicados. `status` virou campo do registry; `parceiros`
  virou o chip `contratante` (multi, só-gestor). A barra de botões de parceiro do gestor
  saiu; `GET /api/parceiros/lista` permanece **apenas** para o acento de cor por linha
  (RF-023).
- **Visão Geral — toggle ano/mês** (spec 001 RF-019, atualização posterior): o input
  "Mês do comparativo" e os chips `periodo`/`mes_originacao` foram **removidos** da Visão
  Geral; o recorte temporal virou um **toggle ano/mês** (`?ano`/`?meses`). O card
  "Comparativo" deu lugar ao card **Ticket Médio**. Os chips restantes (Status, Unidade,
  Contratante) e a série passam a refletir o recorte do toggle.
- **Estado na URL + Suspense**: os filtros vivem na query string (`useFiltros`). Como
  `useSearchParams` exige fronteira de Suspense no App Router (Next 14), cada página de aba
  foi envolvida em `<Suspense>`.
- **Busca `q` separada**: continua fora dos chips, como campo de texto livre na barra.
- **Fix `Button` → `forwardRef`** (`components/ui/button.tsx`): o `PopoverTrigger asChild`
  (Radix Slot) precisa anexar um ref ao filho; em React 18 um componente-função sem
  `forwardRef` não recebe ref, o popover "Adicionar filtro" não abria e havia o warning
  *"Function components cannot be given refs"* (afetava o app inteiro). Corrigido.
- **Validação E2E**: `/api/filtros/opcoes` testado via HTTP com JWT real de gestor nas 3
  abas → `200` com opções escopadas. 66 testes backend verdes; `tsc` e ESLint limpos.

## 8. Arquivos (mapa de manutenção)

**Backend**
- `app/domain/filtros/registry.py` — `CampoFiltro` + `REGISTRY` (fonte única).
- `app/domain/filtros/engine.py` — `parse` (query→filtros) + `aplica` (predicados, AND).
- `app/services/opcoes.py` — opções escopadas por aba/usuário.
- `app/routers/filtros.py` — `GET /api/filtros/opcoes`.
- Integração: `services/solicitacoes.py`, `services/overview.py`, `services/vencimentos.py`
  e seus routers passaram a parsear/aplicar filtros (escopo sempre 1º).
- Testes: `tests/test_filtros.py` (engine/opções/segurança) + ajustes em
  `tests/test_solicitacoes.py`.

**Frontend**
- `lib/filtros/registry.ts` — espelho do registry (metadados estáticos).
- `lib/filtros/serialize.ts` — URL↔valor + resumo do chip + rótulos.
- `lib/filtros/useFiltros.ts` — estado na query string (por aba).
- `lib/filtros/useOpcoesFiltro.ts` — fetch das opções escopadas.
- `components/filtros/BarraFiltros.tsx` (+ `ChipFiltro`, `AdicionarFiltro`, `EditorValor`).
- Páginas integradas: `app/(portal)/{solicitacoes,vencimentos,dashboard}/page.tsx`.
- `components/ui/button.tsx` — convertido para `forwardRef`.
