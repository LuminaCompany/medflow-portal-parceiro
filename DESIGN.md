# Design — Portal do Parceiro MedFlow

Sistema visual do portal. Identidade da fintech (**roxo `#53479B`**, hue ~292) com a
contenção e o respiro de um produto moderno tipo Vercel/Linear, agora **mais vivo**:
sidebar escura, acentos roxos com brilho contido, cards e gráficos interativos, tudo
suavemente animado. Portal de **leitura** de dados financeiros — clareza dos números acima
de tudo, mas com personalidade.

> Direção: **refinado + vivo**. Não é maximalista; é a contenção da marca com energia
> controlada — glow sutil, gradientes pontuais, micro-animações intencionais.

## Stack visual

- **Tailwind CSS v4** + **shadcn/ui** (base `radix`, preset `nova`) — componentes como código
  em `src/components/ui/`. Compor com shadcn antes de criar markup do zero.
- **lucide-react** — ícones (linha fina). **Proibido emoji como ícone.**
- **Motion** (`motion/react`) — animações React. **Recharts** (via shadcn `chart`) — gráficos.
- **react-colorful** — roda RGB da cor do parceiro.
- Tipografia via `next/font`: **Montserrat** (display/marca) + **Geist** (corpo) + **Geist Mono** (código).
- Tokens em **OKLCH**, em `src/styles/globals.css` (`@theme inline` + `:root`/`.dark`).

## Tema

- **Conteúdo**: claro (canônico) com **toggle claro/escuro** (next-themes, classe `.dark`).
  Ambos os temas são polidos.
- **Sidebar**: **sempre escura** (roxo-navy profundo), independente do tema do conteúdo —
  âncora de marca e contraste.
- **Densidade**: baixa-média. Respiro generoso; densidade só sob demanda (seletor de colunas).

## Cores (tokens semânticos shadcn → marca MedFlow)

Neutros levemente tintados na direção do roxo (~292) — coesão sem “colorido”.

### Marca

| Token | OKLCH (claro) | Uso |
|---|---|---|
| `--primary` / `--brand` | `oklch(0.43 0.12 292)` `#53479B` | Botões, links, nav ativo, foco |
| `--brand-bright` | `oklch(0.62 0.19 292)` | **Acento vivo**: glow, charts, gradientes, hover |
| `--accent` / `--brand-subtle` | `oklch(0.96 0.02 292)` | Hover de linha, chip de marca, fundo tintado |

### Superfícies & texto

`--background` quase-branco frio-roxo · `--card` branco · `--foreground` `oklch(0.24 0.02 292)` ·
`--muted-foreground` `oklch(0.55 0.015 292)` (piso AA, não baixar) · `--border` 1px sutil.

### Sidebar (sempre escura)

`--sidebar oklch(0.205 0.038 292)` · `--sidebar-foreground` claro · `--sidebar-primary`
roxo brilhante (item ativo, indicador lateral) · `--sidebar-accent` fundo do item ativo.

### Status de pagamento (só comunica estado, nunca decora)

| Token | Significado |
|---|---|
| `--success` (verde) | Pago / em dia |
| `--warning` (âmbar) | A pagar / vence em breve |
| `--destructive`/`--danger` (vermelho `#DF3131`) | Atrasado / vencido |

> Status nunca depende **só** de cor: sempre pílula com **ponto + rótulo** (a11y/daltônicos).

### Charts

`--chart-1..5`: espectro ancorado no roxo, vivo mas legível. Barras com gradiente
(`--chart-1` 100%→50%), barra ativa em destaque, tooltip interativo formatado em BRL.

### Cor do parceiro (gestor)

Definida pelo gestor numa **roda RGB** (aba Parceiros, hex `#rrggbb`, clara/escura/vibrante/fosca).
Persistida em `app_metadata.cor`; fallback determinístico (`cores.py`) quando ausente.
Aplicada como **acento vivo**, nunca como fundo de linha inteira: dot colorido, **barra
à esquerda da linha** (tabela), chip vibrante. Mantém o fundo neutro → números legíveis.

## Tipografia

- `--font-display` **Montserrat** (600–800): h1–h3, valores-herói, marca. `letter-spacing -0.02em`.
- `--font-sans` **Geist**: corpo, tabelas, formulários (ótimo para dados).
- `--font-mono` **Geist Mono**: códigos de solicitação (BES-/PNS-), hashes.
- **Números**: `font-variant-numeric: tabular-nums` **sempre** (`.tabular`); valores à direita
  em tabelas financeiras; valor protagonista em display, peso 700.

## Espaçamento & layout

- Base 4px (4/8/12/16/24/32/48/64). Raio: `--radius` 12px (cards/inputs), pílula só em chips/badges.
- **App-shell**: sidebar (esquerda, escura, colapsável) + topbar (toggle + breadcrumb + badge gestor)
  + conteúdo central (máx ~1240px). KPIs em grid responsivo (2 → 4/5 colunas).
- **Sombras**: contidas; cards usam `ring-1` (não parear borda 1px + sombra larga). Glow só como
  brilho ambiente sutil (sidebar, hover de card), nunca sombra pesada decorativa.

## Componentes

- **Sidebar** (custom, escura): marca medflow + eyebrow, nav com ícone lucide, **indicador ativo
  que desliza** (`motion` layoutId) + glow ambiente, colapso animado, rodapé com tema + conta.
- **StatCard**: rótulo + **chip-ícone** colorido + valor grande tabular + dica/tendência.
  Entrada em stagger, hover com leve elevação e brilho.
- **DataTable** (genérica, shadcn Table): header estilo planilha, hover, linhas clicáveis,
  **acento de parceiro** à esquerda, scroll horizontal automático (muitas colunas).
- **Solicitações — tabela híbrida**: colunas-chave por padrão + **seletor “Colunas”** (dropdown)
  para ligar extras do modelo (Recebido, IOF, Taxa/mês, Juros, Prazo, Unidade, Rebate).
  Detalhe em **Sheet** lateral.
- **Vencimentos**: KPIs + **accordion agrupado por data** com badge “Xd atrás”, seção de
  alerta vermelha para atrasos, sub-tabela ao expandir.
- **Detalhe (Sheet)**, **Dialogs** (criar/editar/remover parceiro), **toasts** (sonner),
  **estados vazios** (`Empty`) e **skeletons** no carregamento.
- **Diferença Parceiro × Gestor**: gestor traz badge “Visão do gestor · todos os parceiros” +
  chips/acentos por parceiro. Parceiro nunca vê pistas de outros parceiros.

## Motion

Intencional e discreto — coerente com a marca.

- Transições 150–220ms, `ease-out` (cubic-bezier `0.22, 1, 0.36, 1`). Sem bounce/elastic.
- **Troca de aba**: `PageTransition` remonta por rota → fade + leve subida.
- Stagger sutil em listas/KPIs; indicador de nav desliza; hover de card eleva/brilha.
- Conteúdo visível por padrão; nunca esconder dados atrás de animação.
- `@media (prefers-reduced-motion: reduce)`: neutraliza (crossfade/instantâneo). **Obrigatório.**

## Guardrails (manter o gosto)

- Roxo é a marca: usar `--primary` sólido + `--brand-bright` para vida. Gradientes roxos são
  **permitidos** com critério (heros, barras, brilho ambiente) — sem virar “arco-íris”.
- Sem glassmorphism pesado; sem sombra larga decorativa (>8px) como enfeite; raio de card ≤ 12px.
- Status colorido só para status. Cor de parceiro como **acento**, nunca prejudicando a leitura.
- Texto de corpo na ponta `--foreground`/`--muted-foreground` (≥ AA). Sem cinza-claro ilegível.
- **Nada de emoji como ícone** — sempre lucide.
