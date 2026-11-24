# Design System — Site institucional Medflow (medflowfin.com)

> Documentação **descritiva** do design do site público da Medflow, extraída do código-fonte
> em produção (`/assets/styles.css?v=20261106e`, `index.html`, `blog.html`, `post.html`,
> `main.js`) e das imagens de marca, em **24/11/2026**. Todos os valores abaixo são os
> literais do CSS — nada foi arredondado ou inventado. Onde há interpretação (ex.: "papel" de
> uma cor), está marcado como _observação_.
>
> - Stack do site: HTML + CSS puro escrito à mão (sem framework CSS), JS vanilla mínimo,
>   conteúdo do blog via **Wix Headless**. Imagens servidas por `static.wixstatic.com`.
> - Idioma `pt-BR`. `theme-color` = `#7137D6`. Só tema claro (não há dark mode).
> - Nomes de tokens são os do próprio site, em português (`--roxo`, `--tinta`, `--lavanda`...).

---

## Sumário

1. [Princípios visuais](#1-princípios-visuais)
2. [Marca e logotipo](#2-marca-e-logotipo)
3. [Cores](#3-cores)
4. [Tipografia](#4-tipografia)
5. [Espaçamento e layout](#5-espaçamento-e-layout)
6. [Raios (curvas)](#6-raios-curvas)
7. [Bordas e divisores](#7-bordas-e-divisores)
8. [Sombras e elevação](#8-sombras-e-elevação)
9. [Gradientes](#9-gradientes)
10. [Iconografia](#10-iconografia)
11. [Imagens e mídia](#11-imagens-e-mídia)
12. [Movimento e interação](#12-movimento-e-interação)
13. [Breakpoints e responsividade](#13-breakpoints-e-responsividade)
14. [Componentes](#14-componentes)
15. [Padrões de seção (anatomia da página)](#15-padrões-de-seção-anatomia-da-página)
16. [Páginas do blog](#16-páginas-do-blog)
17. [Acessibilidade](#17-acessibilidade)
18. [Voz e microcopy](#18-voz-e-microcopy)
19. [Tokens prontos (CSS)](#19-tokens-prontos-css)
20. [Checklist "parece Medflow?"](#20-checklist-parece-medflow)

---

## 1. Princípios visuais

_Observação (síntese do que o CSS expressa):_

| Princípio | Como aparece |
|---|---|
| **Monocromático roxo** | Uma única cor de marca (`#7137D6`) faz tudo: header, footer, seção de destaque, títulos, links, ícones, botões. Variações são tints (lavandas) e um shade (`#5325A5`). Não existe cor secundária concorrente. |
| **Títulos gigantes, apertados** | H2 de seção vai até **84px** com `letter-spacing: -0.045em` e `line-height: 1.02`. Hero até **100px**. Contraste de escala forte contra corpo de 15–21px. |
| **Superfícies claras e planas** | Fundo lavanda quase branco (`#F8F7FC`) alternando com branco puro. Cards brancos com **borda 1px** em vez de sombra. Sombra só em hover e em elementos flutuantes. |
| **Cantos generosos** | Cards 24px, fotos 28px, celular 54px, pílulas 999px. Elementos pequenos (botões, ícones) 10px. |
| **Ícones de linha** | Traço 1.6px, pontas arredondadas, dentro de "tiles" lavanda 40×40. |
| **Eyebrow + título** | Toda seção abre com rótulo em CAPS espaçadas precedido de um traço de 32×3px, e logo abaixo o título enorme. |
| **Fluidez** | Tamanhos e espaçamentos-chave usam `clamp()` atrelado à largura da viewport. |

---

## 2. Marca e logotipo

### 2.1 Arquivos

| Uso | Arquivo (wixstatic) | Dimensão | Cores medidas |
|---|---|---|---|
| Logo horizontal (header) | `29b7f8_57cd77f8aad047d3860f536b851f166d~mv2.png` | 458×96 (renderizado 229×48) | Símbolo `#7137D6` sobre branco · wordmark `#F6DCFF` |
| Marca d'água do rodapé (símbolo "W") | `29b7f8_7187b930753647d7a6ed040b05eecd81~mv2.png` | 452×261 (renderizado 226×131) | `#EDEDED` (cinza-claro chapado) |
| Ícone do app | `29b7f8_1e94353e2b404ee0bee424555aa3ff32~mv2.png` | 126×126 | Fundo `#7137D6`, "W" `#FFFFFF`, cantos arredondados (squircle) |
| Favicon 32 | `29b7f8_0cf5c538b656446187d14e2521514773~mv2.png` | 32×32 | `#7137D6` + branco |
| Favicon 192 | `29b7f8_1874b416b758470d932832b976920d4a~mv2.png` | 192×192 | — |
| Apple touch icon | `29b7f8_4c900f877e7f4749a3f2f4b57565511f~mv2.png` | 180×180 | — |

### 2.2 Anatomia

- **Símbolo**: um "W" estilizado, traço único contínuo, com a perna esquerda longa e
  inclinada e as terminações cortadas na diagonal — lembra um fluxo/onda (o "flow").
- **Wordmark**: `medflow` em caixa baixa, geométrico e levemente inclinado; **"med" em peso
  fino** e **"flow" em peso bold** (contraste de peso dentro da palavra). Cor `#F6DCFF`
  (lavanda-rosado) para aplicação sobre o roxo.
- No texto corrido a marca é escrita **"Medflow"** (M maiúsculo, resto minúsculo). No card do
  app aparece "MedFlow" (camel) — inconsistência do próprio site; padrão de texto = "Medflow".

### 2.3 Truque de recorte no header

O PNG do logo contém símbolo + wordmark, mas o símbolo (roxo) sumiria sobre o header roxo.
O site **recorta o símbolo** com overflow e margem negativa, exibindo só o wordmark:

```css
.brand     { --wm: 169px; display: block; width: var(--wm); overflow: hidden; }
.brand img { width: calc(var(--wm) * 1.355); max-width: none; margin-left: calc(var(--wm) * -0.355); }
```

Largura visível do wordmark (`--wm`) por contexto:

| Contexto | `--wm` |
|---|---|
| Desktop (>1280px) | 169px |
| ≤1280px | 140px |
| ≤1080px (mobile) | 120px |
| Header compacto (scroll) desktop | 127px |
| Header compacto (scroll) mobile | 97px |

### 2.4 Uso do símbolo como grafismo

No rodapé, o "W" aparece grande (226px desktop / 160px mobile) em `#EDEDED` sobre o roxo,
como marca d'água/elemento gráfico ao lado das informações.

---

## 3. Cores

### 3.1 Paleta completa (tokens do site)

| Token | Hex | Papel |
|---|---|---|
| `--roxo` | `#7137D6` | **Cor de marca.** Header, footer, seção "Como funciona", títulos de seção, eyebrow, label, links, ícones, botão primário, pílula preenchida. |
| `--roxo-claro` | `#8B4DFF` | Só no **fim do gradiente do hero** (direita). |
| `--roxo-escuro` | `#5325A5` | Hover do botão primário; texto de pílulas/tags; pergunta aberta do FAQ. |
| `--lavanda` | `#F0E9FD` | Fundo de icon-tile, tag, arrow-btn, item de FAQ aberto, hover do botão secundário. |
| `--lavanda-2` | `#E9E0F7` | Placeholder de mídia (banner de card, capa de imprensa) enquanto a imagem carrega. |
| `--fundo` | `#F8F7FC` | Fundo do `body` e das seções "soft"; texto dos links do nav (sobre roxo); fundo do "+" do FAQ fechado. |
| `--branco` | `#FFFFFF` | Cards, seções "white", texto sobre roxo. |
| `--tinta` | `#211B2E` | Texto forte (títulos de card, strong, perguntas do FAQ); fundo dos botões de loja. |
| `--cinza` | `#716A7D` | Texto de apoio/corpo secundário (parágrafos, descrições, metadados). |
| `--cinza-2` | `#80758F` | Leads/subtítulos grandes (≥22px) — um cinza mais claro e lilás. |
| `--borda` | `#DED9E6` | Toda borda/divisor de 1px em superfícies claras. |
| `--texto-claro` | `rgba(255,255,255,0.9)` | Texto secundário no rodapé (sobre roxo). |
| `--verde-wa` | `#25D366` | Exclusivo do botão flutuante do WhatsApp. |

### 3.2 Cores literais (fora de tokens)

| Hex / valor | Onde |
|---|---|
| `#1D1730` | `color` padrão do `body` (quase igual a `--tinta`). |
| `#3A3346` | Texto do conteúdo de post do blog (`.post-content`). |
| `#000000` | Hover do botão de loja. |
| `#1D1A24` | Corpo do mockup de celular (`.phone-frame`). |
| `#3A3545` | Contorno interno (inset) do mockup de celular. |
| `#F6DCFF` | Wordmark do logo (dentro do PNG). |
| `#EDEDED` | Símbolo "W" do rodapé (dentro do PNG). |

### 3.3 Brancos com transparência (sobre roxo)

| Valor | Uso |
|---|---|
| `rgba(255,255,255,.14)` | Borda inferior do header; borda superior do menu mobile. |
| `rgba(255,255,255,.16)` | Divisor entre itens do menu mobile. |
| `rgba(255,255,255,.28)` | Borda do botão hambúrguer. |
| `rgba(255,255,255,.38)` | Borda dos cards de passo ("Como funciona"). |
| `rgba(255,255,255,.8)` | Borda do ícone dos passos. |
| `rgba(255,255,255,.88)` | Texto de apoio sobre roxo (lead e parágrafos dos passos). |
| `rgba(255,255,255,.9)` | `--texto-claro` (rodapé). |

### 3.4 Cores de sombra

Sombras usam a **tinta** (`#211B2E` = `rgb(33,27,46)`) com alpha, nunca preto puro — exceto o
FAB do WhatsApp (`rgb(20,20,40)`). Ver §8.

### 3.5 Escala roxa derivada (resumo)

```
#5325A5  roxo-escuro   ← hover / texto em pílula
#7137D6  roxo          ← marca
#8B4DFF  roxo-claro    ← fim do gradiente do hero
#E9E0F7  lavanda-2     ← placeholder de mídia
#F0E9FD  lavanda       ← tiles, tags, FAQ aberto
#F6DCFF  wordmark      ← só no logo
#F8F7FC  fundo         ← página
```

### 3.6 Ritmo de fundos (alternância de seções na home)

| # | Seção | Fundo |
|---|---|---|
| — | Header | `--roxo` |
| 1 | Hero | gradiente roxo → roxo-claro |
| 2 | Sobre | `--fundo` (soft) |
| 3 | Como funciona | `--roxo` (purple) |
| 4 | Aplicativo | `--fundo` (soft) |
| 5 | Contabilidade | `--branco` (white) |
| 6 | Dúvidas | `--branco` (white) — colada na anterior (`padding-top: 0`) |
| 7 | Imprensa | `--fundo` (soft) |
| 8 | Blog | `--fundo` (soft) |
| — | Footer | `--roxo` |

Regra: `.section--white + .section--white { padding-top: 0; }` — duas seções brancas
seguidas fundem-se visualmente.

---

## 4. Tipografia

### 4.1 Família

- **Inter** (Google Fonts), pesos carregados: **400, 500, 600, 700**, `display=swap`.
- Stack: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- `-webkit-font-smoothing: antialiased` no body.
- Uma única família para tudo (títulos, corpo, botões). Sem serifa, sem mono.

### 4.2 Pesos e seus papéis

| Peso | Uso |
|---|---|
| 400 | Hero (parte normal), corpo, menu mobile, símbolo "+" do FAQ. |
| 500 | Links do nav, perguntas do FAQ fechadas, subtítulo de Contabilidade, `small` dos botões de loja. |
| 600 | **Peso padrão de títulos**: section-title, h3 de cards, strong de benefícios, eyebrow, label, tags, botões, pergunta aberta do FAQ. |
| 700 | Palavra de ênfase do hero (`<strong>Agora!</strong>`), nome do veículo na capa de imprensa, títulos do rodapé. |

### 4.3 Escala tipográfica (desktop → mobile ≤1080px)

| Estilo | Tamanho | Peso | Line-height | Letter-spacing | Cor | Mobile |
|---|---|---|---|---|---|---|
| **Hero** | `clamp(56px, 5.2vw, 100px)` | 400 (+700 ênfase) | 1.05 | -0.02em | branco | `clamp(44px, 14vw, 72px)`, lh 1.1 |
| **Section title (H2)** | `clamp(44px, 4.4vw, 84px)` | 600 | 1.02 | **-0.045em** | roxo (ou branco) | `clamp(40px, 11vw, 64px)` |
| Post title | `clamp(32px, 3.4vw, 52px)` | 600 | 1.12 | -0.03em | tinta | idem |
| Subtítulo do app | `clamp(30px, 2.3vw, 44px)` | 400 | 1.2 | -0.02em | cinza-2 | 28px |
| Subtítulo contabilidade | `clamp(28px, 2.1vw, 40px)` | 500 | — | -0.02em | tinta | 26px |
| H3 card "Para médicos" | 34px | 600 | — | -0.02em | tinta | 28px |
| Nome do veículo (imprensa) | 34px (Veja: 64px, +0.02em) | 700 | 1.1 | -0.03em | roxo | Veja 52px |
| Post (h2 interno) / relacionados | 28px | 600 | 1.25 | -0.01 / -0.02em | tinta | — |
| H3 passo | 27px | 600 | 1.25 | -0.02em | branco | 23px |
| H3 card de imprensa | 26px | 600 | 1.3 | -0.02em | tinta | 22px |
| Lead "Como funciona" | 25px | 400 | 1.55 | — | branco .88 | 18px |
| Marca no card do app | 25px | 600 | — | — | tinta | 21px |
| Lead grande (split/qs) | 24px | 400 | 1.5 / 1.45 | -0.01em (qs) | cinza-2 / tinta | 18px / 20px |
| H3 card de blog | 24px | 600 | 1.25 | -0.01em | tinta | 21px |
| Menu mobile | 24px | 400 | — | — | branco | — |
| Lead do FAQ | 22px | 400 | 1.6 | — | cinza-2 | 18px |
| Lead dos cards "Quem somos" | 21px | 400 | 1.5 | -0.01em | tinta | 18px |
| Texto contabilidade | 21px | 400 | 1.6 | — | cinza | 17px |
| Pergunta FAQ | 20px | 500 (aberta 600) | — | — | tinta (aberta roxo-escuro) | 17px |
| Texto do app | 20px | 400 | 1.6 | — | cinza | 17px |
| Strong de benefício | 19px (plus: 21px) | 600 | 1.3 | — | tinta | 17px (plus: 18px) |
| Corpo de post | 18px | 400 | **1.75** | — | `#3A3346` | 17px |
| Parágrafo de passo / resposta FAQ | 18px | 400 | 1.6 | — | branco .88 / cinza | 16px |
| Número do passo | 18px | 400 | — | 0.12em | branco | 15px |
| Botão de loja / link "Ler matéria" | 18px | 600 | 1.1 | — | branco / roxo | — |
| Texto de card (qs) | 17px | 400 | 1.6 | — | cinza | 16px |
| Nav | 17px (≤1280: 15px) | 500 | — | — | `--fundo` | (oculto) |
| Botão primário | 17px | 600 | — | — | branco | — |
| Botão secundário | 16px | 600 | — | — | roxo | — |
| Corpo base | 15–16px | 400 | 1.5–1.6 | — | cinza | — |
| Eyebrow | **13px** | 600 | — | **0.16em, UPPERCASE** | roxo | 12px |
| Meta / contagem / pílula | 13px | 400–600 | — | — | cinza / roxo | — |
| Label | 12px | 600 | 1.4 | 0.1em, UPPERCASE | roxo | — |
| Tag | 11px | 600 | — | 0.06em, UPPERCASE | roxo-escuro | — |
| Rodapé: título / texto / empresa | 15 / 13 / 11px | 700 / 400 / 400–600 | — / 23px / 18px | — | branco / branco .9 | 16 / 15 / 13px |

### 4.4 Regras tipográficas

- **Tracking negativo cresce com o tamanho**: ~-0.01em (≤24px) → -0.02em (26–44px) →
  -0.03em (52px) → **-0.045em** (84px). Caixa-alta sempre com tracking **positivo**
  (0.06–0.16em).
- **Line-height cai com o tamanho**: 1.75 (corpo de leitura) → 1.6 (corpo) → 1.25–1.3
  (subtítulos) → 1.02–1.05 (display).
- Ênfase no hero = troca de peso (400 → 700) na mesma linha de leitura, não cor.
- Títulos de seção podem ter quebra manual (`Como funciona<br>a Medflow?`) e limitador de
  largura (`max-width: 8ch` em "Dúvidas frequentes" → quebra em duas linhas).
- Excerpt de card de blog: corta em **3 linhas** (`-webkit-line-clamp: 3`).

---

## 5. Espaçamento e layout

### 5.1 Container e gutter

```css
--gutter: clamp(24px, 6.25vw, 120px);   /* margem lateral fluida */
.container {
  max-width: calc(1680px + 2 * var(--gutter));  /* conteúdo útil máx. 1680px */
  margin-inline: auto;
  padding-inline: var(--gutter);
}
```

- Conteúdo útil até **1680px** — site pensado para telas largas.
- Gutter: 24px no mobile, 6.25vw no meio, teto 120px.

### 5.2 Ritmo vertical

| Elemento | Valor |
|---|---|
| Padding vertical de seção | `clamp(72px, 7.3vw, 140px)` (mobile: **64px**) |
| Topo da seção Blog | `clamp(56px, 5vw, 96px)` |
| Seção Aplicativo | `--ap-pad: clamp(48px, 4vw, 72px)` (mobile 64px) |
| Eyebrow → título | 18px (mobile 14px) |
| Título → conteúdo (grids) | 56–72px (mobile 32–40px) |
| Hero padding-top | `clamp(64px, 17.5vh, 190px)` (mobile 48px) |

### 5.3 Gaps recorrentes

Escala observada (base efetiva de **4px**, com saltos de 8):

`4 · 6 · 8 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 28 · 32 · 36 · 40 · 48 · 56 · 64 · 72`

| Gap | Onde |
|---|---|
| 12px | Ícone↔texto em botões, eyebrow (traço↔texto), entre botões de loja, social, blog-bar |
| 14px | Ícone-tile ↔ texto de benefício |
| 20–24px | Grid de blog/imprensa (≤1400 e mobile), header-inner, qs-intro |
| **32px** | **Gap padrão de grids de cards** (qs-cards, steps, press-grid) |
| 48px | split-head / cf-top (título ↔ lead lateral) |
| 64px | Grid do Aplicativo |
| `clamp(40px, 6.25vw, 120px)` | Grid de Contabilidade |
| `clamp(40px, 5.2vw, 100px)` | Grid de Dúvidas |
| `clamp(40px, 4.4vw, 96px)` | Título ↔ cards em "Sobre" |
| 146px | Símbolo ↔ infos no rodapé (desktop) |

### 5.4 Paddings internos de card

| Card | Padding (desktop) | Mobile |
|---|---|---|
| Card intro "Quem somos" | 28px 28px 30px | 22px 20px 24px |
| Corpo card "Para médicos" | 34px 31px 28px | 24px 20px 20px |
| Passo | 31px | 24px |
| Corpo card de imprensa | 32px 31px 30px | 24px 20px |
| Corpo card de blog | 24px 23px 22px | — |
| Card lojas | 26px 23px 23px | — |
| Pergunta FAQ | 22px 24px | 18px 16px |

_Observação_: paddings "ímpares" (31px, 23px) compensam a borda de 1px → área interna fica
em múltiplos redondos (32/24).

### 5.5 Grids das seções

| Seção | Desktop | ≤1400px | ≤1080px |
|---|---|---|---|
| Sobre (topo) | `max-content \| 1fr` (título \| 2 cards) | — | 1 coluna |
| Cards intro | 2 colunas | — | 1 coluna |
| Para médicos / unidades | 2 colunas | — | 1 coluna |
| Passos | **4 colunas** | 2 colunas | 1 coluna |
| Aplicativo | `minmax(0,630px) \| 1fr` | `1fr 1fr` | 1 coluna |
| Contabilidade | `minmax(0,760px) \| 1fr` (foto \| texto) | — | 1 coluna |
| Dúvidas | `minmax(0,520px) \| 1fr` (título \| FAQ) | — | 1 coluna |
| Imprensa / Blog | **3 colunas** | 3 (gap 20) | 1 coluna |
| Botões de loja | 2 colunas | — | 1 coluna (≤480px) |

### 5.6 Alturas fixas

| Elemento | Altura |
|---|---|
| Header | **120px** (compacto 76px; mobile 88px / compacto 64px) |
| Botão primário | 60px |
| Botão de loja | min 56px |
| Botão hambúrguer | 44×44 |
| Icon-tile / arrow-btn | 40×40 |
| Ícone de passo | 80×80 (mobile 60×60) |
| Capa imprensa | 245px (mobile 170px) |
| Mídia card blog | 238px (mobile 210px) |
| Card de passo | min 390px (só ≥1401px) |
| FAB WhatsApp | 72×72 (mobile 56×56) |
| Celular | até 380px de largura, proporção 720/1566 |

---

## 6. Raios (curvas)

Escala completa de `border-radius` usada no site:

| Raio | Elementos |
|---|---|
| **2px** | Traço do eyebrow (32×3) |
| **10px** | Botão primário, botão secundário, icon-tile, arrow-btn, hambúrguer, ícone do app no card |
| **12px** | Botões de loja (App Store / Google Play) |
| **14px** | Ícone de passo no mobile |
| **16px** | Ícone de passo (desktop), imagens dentro do post, capa do post no mobile |
| **20px** | Card de lojas, item de FAQ aberto, foto da contabilidade no mobile |
| **24px** | **Raio padrão de card** (`.card`), cards de passo, capa do post |
| **28px** | Foto da contabilidade (desktop) |
| **38px / 44px** | Tela (vídeo) do celular — mobile / desktop |
| **46px / 54px** | Moldura do celular — mobile / desktop |
| **999px** | Pílulas: tag, qs-pill, pill-filled |
| **50%** | Círculos: botão "+/−" do FAQ, FAB do WhatsApp |
| **0** | Header, seções, footer (tudo full-bleed, sem cantos) |

Regras:
- **Grande contém pequeno**: card 24 → ícone dentro 10 → pílula 999. Mídia no topo de card
  herda o raio via `overflow: hidden` no card (imagem em si não tem raio).
- Raio concêntrico no celular: moldura 54 − padding 11 ≈ tela 44 (mobile 46 − 9 ≈ 38).
- Imagens soltas (não dentro de card) recebem raio próprio: 28 / 24 / 16.

---

## 7. Bordas e divisores

| Borda | Onde |
|---|---|
| `1px solid #DED9E6` (`--borda`) | Contorno de **todo card**; divisores entre benefícios; separador do FAQ (fechado); topo do rodapé do card de imprensa/blog; `hr` do card intro; base da capa-logo da imprensa |
| `1px solid rgba(255,255,255,.14)` | Base do header; topo do menu mobile |
| `1px solid rgba(255,255,255,.16)` | Itens do menu mobile |
| `1px solid rgba(255,255,255,.28)` | Botão hambúrguer |
| `1px solid rgba(255,255,255,.38)` | Cards de passo (card "outline" sobre roxo) |
| `1px solid rgba(255,255,255,.8)` | Ícone do passo |
| `1px solid var(--roxo)` | Botão secundário |
| `3px solid var(--roxo)` (esquerda) | `blockquote` do post |
| `inset 0 0 0 2px #3A3545` | Aro interno do celular (via box-shadow) |

Regras:
- Espessura padrão **1px**. Exceções: 3px (blockquote, traço do eyebrow), 1.5px (sublinhado do
  nav, feito com gradiente).
- Em listas, o último item perde a borda (`:last-child { border-bottom: 0 }`), exceto na
  variante `benefits--plus`, que mantém a linha final.
- Sobre fundo roxo, bordas são sempre **branco translúcido**, nunca cinza.

---

## 8. Sombras e elevação

O site é **flat por padrão** — cards não têm sombra, só borda. Sombra aparece em 4 casos:

| Token sugerido | Valor | Onde |
|---|---|---|
| `shadow-header` | `0 6px 20px rgba(33,27,46,.14)` | Header quando rola > 24px (`.is-scrolled`) |
| `shadow-card-hover` | `0 12px 32px rgba(33,27,46,.08)` | Card de blog em hover (+ `translateY(-2px)`) |
| `shadow-device` | `0 32px 64px rgba(33,27,46,.18), inset 0 0 0 2px #3A3545` | Mockup do celular |
| `shadow-fab` | `0 8px 24px rgba(20,20,40,.28)` | Botão flutuante do WhatsApp |

Camadas (`z-index`): conteúdo do hero 2, imagem do hero 1, header **50**, FAB **60**.

---

## 9. Gradientes

| Nome | Valor | Onde |
|---|---|---|
| Hero (desktop) | `linear-gradient(90deg, #7137D6 0%, #7137D6 56%, #8B4DFF 100%)` | Fundo do hero |
| Hero (mobile ≤1080) | `linear-gradient(90deg, #7137D6 0%, #7137D6 38%, #8B4DFF 100%)` | Idem, clareando mais cedo |
| Sublinhado do nav | `linear-gradient(currentColor, currentColor) left bottom / 0 1.5px no-repeat` | Underline animado (cresce até `100% 1.5px`) |

Regras: gradiente **horizontal**, **sólido na metade esquerda** (onde fica o texto) e
clareando só à direita (onde fica a foto). Um único gradiente de marca no site.

---

## 10. Iconografia

### 10.1 Estilo

- SVG inline, `viewBox="0 0 24 24"`, **linha** (sem preenchimento).
- `stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; fill: none`.
- Tamanho: **22×22** dentro de tiles; **30×30** nos passos (traço **1.4**, mobile 24×24).
- Ícones de seta/ação: traço **2.2** (arrow-btn), WhatsApp do botão 1.8.
- Estilo equivalente a **Lucide/Feather** desenhado à mão — formas simples, geométricas,
  cantos `rx="2"` / `rx="2.5"` em retângulos.

### 10.2 Contêineres de ícone

| Contêiner | Tamanho | Raio | Fundo | Cor do ícone |
|---|---|---|---|---|
| `icon-tile` | 40×40 | 10px | `--lavanda` | `--roxo` |
| `step-icon` | 80×80 (60 mobile) | 16px (14 mobile) | transparente, borda branca .8 | branco |
| `arrow-btn` | 40×40 | 10px | `--lavanda` → hover `--roxo` | `--roxo` → hover branco |
| FAQ `+`/`−` | 32×32 | 50% | `--fundo` (aberto: branco) | `--roxo` |

### 10.3 Inventário de ícones usados

Relógio (dinheiro antes), calendário (organização), olho (clareza), celular (praticidade),
sliders (flexibilidade), coração (satisfação), monitor com gráfico (portal do parceiro),
etiqueta de preço (sem custo), "+" (benefícios de contabilidade), prédio/hospital (parceria),
megafone (apresentação), celular com check (solicitação), cédula (dinheiro na conta),
seta diagonal ↗ (link externo), balão do WhatsApp, Instagram, YouTube, LinkedIn,
hambúrguer / X. Logos oficiais: Apple (branco) e Google Play (4 cores).

---

## 11. Imagens e mídia

| Tipo | Tratamento |
|---|---|
| **Foto do hero** | Recorte (PNG/WebP sem fundo) de médica e médico sorrindo, ancorada embaixo à direita, `width: min(53.6vw, 1180px)`, sobrepõe o gradiente. Mobile: centralizada embaixo, `aspect-ratio 370/389`, `object-position: 58% bottom`. |
| **Banners de card** | Faixa larga `aspect-ratio 821/237` com `object-fit: cover`; pílula branca sobreposta no canto inferior esquerdo (27px, 24px). Mobile: altura fixa 240px. |
| **Foto de Contabilidade** | Retrato vertical (760×790), raio 28px, **sticky** (`top: header + 32px`) enquanto o texto rola ao lado. |
| **Capas de imprensa** | Imagem `cover` 245px de altura; ou logo do veículo `contain` (máx. 78% × 96px) sobre branco com padding 32px. |
| **Mídia de blog** | 238px, `cover` (ou `contain` para gráficos). |
| **Vídeo do app** | MP4 autoplay/muted/loop dentro de mockup de celular desenhado em CSS (`#1D1A24`, raio 54, padding 11). |
| Formatos | WebP para fotos, PNG para logos, servidos pelo CDN do Wix. `loading="lazy"` em tudo abaixo da dobra; `fetchpriority="high"` no hero. |

Fotografia: pessoas reais em ambiente de saúde (jaleco, estetoscópio, recepção, reunião),
iluminação clara, expressão sorridente — tom humano e acolhedor.

---

## 12. Movimento e interação

### 12.1 Durações e easing

| Duração | Uso |
|---|---|
| **.15s ease** | Microinterações: cor de botão, arrow-btn, botão de loja |
| **.2s ease** | Underline do nav, card de blog (sombra + translate), FAB (scale) |
| **.25s ease** | Header compacto (altura, largura do logo, sombra) |

Easing sempre `ease`. Nada de bounce/spring.

### 12.2 Estados

| Elemento | Hover / estado |
|---|---|
| Link do nav | Underline 1.5px cresce da esquerda (`background-size 0 → 100%`). Seção visível → `.is-active` (underline fixo), via IntersectionObserver (`rootMargin: -45% 0px -50% 0px`). |
| Botão primário | Fundo `#7137D6` → `#5325A5` |
| Botão secundário | Fundo transparente → `--lavanda` |
| Botão de loja | Fundo `#211B2E` → `#000`, `translateY(-1px)` |
| Card de blog | Sombra `0 12px 32px` + `translateY(-2px)` |
| Link de imprensa | Arrow-btn inverte: lavanda/roxo → roxo/branco |
| Pergunta FAQ | Texto → roxo |
| FAB WhatsApp | `scale(1.06)` |
| Ícone social | opacity .95 → 1 + `translateY(-1px)` |
| Links do rodapé | Sem sublinhado → sublinhado |

### 12.3 Comportamentos

- **Header sticky que encolhe**: ao rolar > 24px recebe `.is-scrolled` → altura 120 → 76px
  (mobile 88 → 64), logo 169 → 127px, ganha sombra. Atualização via `requestAnimationFrame`.
- `scroll-behavior: smooth` + `scroll-padding-top: var(--header-compact)` (âncoras não ficam
  sob o header).
- **Menu mobile**: tela cheia roxa abaixo do header; trava o scroll do body; fecha em
  Esc, clique em link ou ao voltar para ≥1081px.
- **FAQ**: `<details>` nativo; primeiro item vem aberto. Aberto = vira "bolha" lavanda com raio
  20px, sem borda inferior, `+` vira `−` com fundo branco.
- `prefers-reduced-motion: reduce` → desliga smooth scroll e **todas** as transições.

---

## 13. Breakpoints e responsividade

Abordagem **desktop-first** (`max-width`).

| Breakpoint | Mudanças |
|---|---|
| `≤1400px` | Passos 4 → 2 colunas (sem min-height); grid do app `1fr 1fr` gap 40; gap de imprensa/blog 20px |
| `≤1280px` | Nav 17 → 15px; logo 169 → 140px |
| **`≤1080px`** (mobile) | Header 88px; nav some, hambúrguer aparece; hero vira coluna com foto embaixo; **todos os grids → 1 coluna**; seção 64px; reduções tipográficas (§4.3); foto de contabilidade deixa de ser sticky e vira 4:3; botão primário 100% largura; rodapé empilha à esquerda; FAB 56px a 16px da borda |
| `≤480px` | Botões de loja empilham |
| `≥1081px e altura ≤760px` | Foto do hero reduz para 46vw (telas baixas) |

Usa `svh` (small viewport height) no hero e no celular para evitar pulo com a barra do
navegador mobile.

---

## 14. Componentes

### 14.1 Header (`.site-header`)

- Sticky, `top: 0`, `z-index: 50`, fundo `--roxo`, borda inferior branca .14.
- Flex `space-between`, gap 24px, altura 120px.
- Esquerda: wordmark (§2.3). Direita: 8 links âncora (Sobre, Como funciona, Aplicativo,
  Contabilidade, Dúvidas frequentes, Imprensa, Blog, Contato), gap `clamp(16px, 1.75vw, 33px)`,
  Inter 500 17px, cor `--fundo`, `padding-block: 6px`, `white-space: nowrap`.
- Hambúrguer (mobile): 44×44, raio 10, borda branca .28, ícone 20×20 traço 1.6.

### 14.2 Menu mobile (`.menu-mobile`)

- `position: fixed; inset: var(--header-h) 0 0 0`, fundo roxo, padding `28px 24px 120px`.
- Links em bloco: 24px / 400, branco, padding `22px 0 21px`, divisor branco .16.

### 14.3 Eyebrow (`.eyebrow`)

```css
display: flex; align-items: center; gap: 12px; margin: 0 0 18px;
color: var(--roxo); font-size: 13px; font-weight: 600;
letter-spacing: .16em; text-transform: uppercase;
/* ::before = traço 32×3, raio 2px, currentColor */
```
Variante `--light`: branca (sobre roxo).

### 14.4 Section title (`.section-title`)

`clamp(44px, 4.4vw, 84px)` · 600 · lh 1.02 · ls -0.045em · roxo. Variante `--light`: branco.

### 14.5 Label (`.label`)

12px · 600 · ls .1em · UPPERCASE · roxo · margin-bottom 14px. Rotula blocos dentro de cards
("Quem somos", "Nossa missão", "Benefícios", "Baixe o app").

### 14.6 Card (`.card`)

```css
background: #FFFFFF; border: 1px solid #DED9E6; border-radius: 24px;
```
Sem sombra. Mídia no topo + corpo com padding (§5.4). Variações: intro, qs-card (banner +
corpo), press-card, post-card (hover elevado), ap-stores (raio 20).

### 14.7 Card de passo (`.step`) — "card outline" sobre roxo

- Borda branca .38, raio 24, padding 31, min-height 390.
- Ícone 80×80 (raio 16, borda branca .8) no topo-esquerda; número `01`–`04` no topo-direita
  (18px, tracking .12em).
- H3 27px/600 com margem `52px 0 26px`; parágrafo 18px branco .88.

### 14.8 Lista de benefícios (`.benefits`)

- Cada item: flex, gap 14, padding 16px 0 (1º item 4px no topo), divisor `--borda`.
- Icon-tile 40×40 lavanda + bloco de texto: `strong` 19px/600 tinta + descrição 15px cinza
  (margem 3px).
- Variante `--plus` (Contabilidade): padding 18px, strong 21px, descrição 16px, ícone "+",
  mantém divisor no último item.

### 14.9 Botão primário (`.btn-primary`)

```css
display: inline-flex; align-items: center; justify-content: center; gap: 12px;
min-width: 316px; height: 60px; padding: 0 28px;
border-radius: 10px; background: #7137D6; color: #FFF;
font-size: 17px; font-weight: 600; text-decoration: none;
transition: background .15s ease;
/* hover: background #5325A5 */
```
Ícone à esquerda (22×22, traço 1.8). Mobile: `width: 100%`.

### 14.10 Botão secundário (`.btn-secondary`)

`padding: 14px 28px` · borda 1px roxo · raio 10 · fundo transparente · texto roxo 16px/600 ·
hover fundo lavanda. Usado em "Carregar mais" do blog (centralizado, margem-topo 40px).

### 14.11 Botão de loja (`.store-btn`)

- Fundo `--tinta` (#211B2E), texto branco, raio **12px**, min-height 56, padding `8px 16px`.
- Ícone 22×22 (Apple invertido para branco via `filter: invert(1)`; Google Play colorido).
- Texto em 2 linhas: `small` 11px/500 opacity .8 ("Baixe na") + nome 18px/600 ("App Store"),
  lh 1.1.
- Hover: fundo preto + sobe 1px.

### 14.12 Pílulas e tags

| Componente | Padding | Raio | Fundo | Texto |
|---|---|---|---|---|
| `.tag` | 6px 12px | 999 | lavanda | roxo-escuro, 11px/600, UPPER, ls .06em |
| `.qs-pill` | 7px 14px | 999 | branco | roxo-escuro, 13px/600 (sobre foto) |
| `.pill-filled` | 8px 14px | 999 | roxo | branco, 13px/600 |

### 14.13 Arrow button (`.arrow-btn`)

40×40, raio 10, lavanda + seta ↗ roxa (16×16, traço 2.2). No hover do link pai: roxo + seta
branca.

### 14.14 Link de imprensa (`.press-link`)

Rodapé do card: `margin-top: auto` (gruda embaixo), `padding-top: 24px`, borda-topo `--borda`,
flex `space-between`. Esquerda: "Ler matéria original" (18px/600 roxo) + domínio (13px cinza).
Direita: arrow-btn.

### 14.15 FAQ (`.faq details`)

- Fechado: divisor inferior `--borda`; `summary` padding `22px 24px`, 20px/500 tinta; botão
  "+" 32×32 circular `--fundo` + roxo.
- Aberto: fundo lavanda, raio 20, margem inferior 8, sem divisor; pergunta roxo-escuro 600,
  `padding-bottom: 12px`; botão "−" fundo branco.
- Resposta: padding `0 24px 22px`, parágrafos 18px cinza lh 1.6; links roxo 600.

### 14.16 Mockup de celular (`.phone-frame`)

```css
width: min(380px, 100%, <altura disponível * 720/1566>);
aspect-ratio: 720 / 1566; padding: 11px; border-radius: 54px;
background: #1D1A24;
box-shadow: 0 32px 64px rgba(33,27,46,.18), inset 0 0 0 2px #3A3545;
/* video: border-radius 44px; object-fit: cover */
```
Mobile: até 320px / 86vw, raio 46, padding 9, tela 38.

### 14.17 Card de post (`.post-card`)

Mídia 238px → corpo (24/23/22) → meta (13px cinza: "22 de abr. · 3 min de leitura") → H3
24px → excerpt 15px clamp 3 linhas → rodapé com divisor e stats (13px cinza, gap 14:
"7 visualizações · 0 comentário"). Card inteiro clicável; hover eleva.

### 14.18 Rodapé (`.site-footer`)

- Fundo roxo, padding `38px 36px` (vertical), flex centralizado, gap 146px.
- Esquerda: símbolo "W" `#EDEDED` 226px. Direita: blocos "Nossas redes" (3 ícones sociais
  22px, gap 12), "Contato Comercial" (telefone → WhatsApp), "Endereço" (`<address>`),
  e razão social + CNPJ (11px, nome em 600 branco).
- Títulos 15px/700; texto 13px lh 23px branco .9.
- Mobile: empilha à esquerda, gap 40, padding-bottom 120px (espaço p/ FAB), símbolo 160px,
  textos maiores (15px lh 30px).

### 14.19 FAB WhatsApp (`.whatsapp-fab`)

Fixo `right/bottom: 32px` (mobile 16px), 72×72 (mobile 56), círculo `#25D366`, ícone branco
34px (mobile 28), sombra `0 8px 24px rgba(20,20,40,.28)`, hover `scale(1.06)`, `z-index: 60`.

---

## 15. Padrões de seção (anatomia da página)

**Cabeçalho de seção** — três arranjos:

1. **Empilhado**: eyebrow → título → conteúdo (Blog, Aplicativo, Contabilidade).
2. **Split horizontal** (`.split-head` / `.cf-top`): eyebrow+título à esquerda, lead à direita
   (`max-width` 540–600px), gap 48px; em "Como funciona" alinhado pela base
   (`align-items: flex-end`). Mobile: empilha.
3. **Coluna lateral** (`.dv-grid`, `.qs-top`): título numa coluna estreita, conteúdo na outra.

**Ordem da home**: Hero → Sobre (2 cards de texto + 2 cards com banner e benefícios) →
Como funciona (4 passos sobre roxo) → Aplicativo (texto + lojas | celular com vídeo) →
Contabilidade (foto sticky | texto + benefícios + CTA WhatsApp) → Dúvidas (título | FAQ
acordeão) → Imprensa (3 cards) → Blog (3 cards + "Todos os posts") → Rodapé.

**Hero**: altura `max(640px, 100svh − header)`; título em 3 linhas
("Seu plantão, / seu dinheiro. / **Agora!**"), sem CTA; foto recortada à direita.

---

## 16. Páginas do blog

- `blog.html`: mesma seção `section--soft section--blog` da home, grade de 3 cards, status
  (`.blog-status`, 16px cinza, some quando vazio) e botão secundário "Carregar mais".
- `post.html` (`.post-page`, padding `56px 96px` vertical; mobile `32px 64px`):
  - Coluna de leitura **760px** centralizada.
  - "← Voltar" (15px/600 roxo, sublinha no hover), meta 15px cinza, título fluido 32–52px.
  - Capa com raio 24 (mobile 16), margem inferior 40.
  - Corpo 18px / **lh 1.75** / `#3A3346`; h2 28px, h3 23px, h4 20px (margem `40px 0 14px`);
    parágrafos margem 18; listas recuo 1.4em; imagens raio 16; `figcaption` 14px centralizada;
    `blockquote` com barra roxa de 3px à esquerda.
  - "Relacionados" no fim (margem 80, h2 28px).
  - Estado vazio/erro (`.post-state`): centralizado, 80px de padding, h1 36px.

---

## 17. Acessibilidade

Contrastes medidos (WCAG 2.x):

| Par | Razão | Situação |
|---|---|---|
| Branco sobre `#7137D6` | **6.52** | AA ✔ |
| `#7137D6` sobre branco | 6.52 | AA ✔ |
| `#7137D6` sobre `#F8F7FC` | 6.12 | AA ✔ |
| `#7137D6` sobre `#F0E9FD` | 5.52 | AA ✔ |
| `#5325A5` sobre `#F0E9FD` (tags) | 8.17 | AAA ✔ |
| `#211B2E` sobre branco | 16.65 | AAA ✔ |
| `#716A7D` (cinza) sobre branco | 5.17 | AA ✔ |
| `#716A7D` sobre `#F8F7FC` | 4.85 | AA ✔ |
| `#716A7D` sobre `#F0E9FD` (resposta FAQ aberta, 18px) | **4.38** | ⚠ abaixo de 4.5 p/ texto normal |
| `#80758F` (cinza-2) sobre branco | 4.32 | ✔ só porque é usado ≥22px (texto grande, mín. 3) |
| `#80758F` sobre `#F8F7FC` | 4.05 | idem — **não usar em corpo pequeno** |
| Branco sobre `#8B4DFF` | 4.56 | AA ✔ (borda direita do hero) |
| `#F6DCFF` (wordmark) sobre roxo | 5.16 | ✔ |
| Branco sobre `#25D366` (WhatsApp) | 1.98 | ⚠ só ícone; segue a cor oficial do WhatsApp |

Boas práticas presentes: `aria-label` em links de ícone, `aria-expanded`/`aria-controls` no
menu, `aria-hidden` nos SVGs decorativos, `aria-labelledby` em cada seção, `<details>` nativo
no FAQ, `<address>` e `<time datetime>` semânticos, `prefers-reduced-motion`, `:focus-visible`
no nav (mesmo efeito do hover). Alvos de toque ≥40px.

---

## 18. Voz e microcopy

- Tom **próximo, direto e otimista**, segunda pessoa ("você", "seu plantão").
- Frases curtas com exclamação pontual: "Seu plantão, seu dinheiro. Agora!", "Seu dinheiro
  na palma da mão!".
- Benefícios em par **título curto (2–5 palavras) + uma linha de explicação**.
- Eyebrows descrevem a seção em 1–3 palavras ("Passo a passo", "Suas dúvidas", "Medflow na
  mídia", "Serviços contábeis").
- Vocabulário do domínio: plantão, antecipação, recebíveis, PIX, unidade de saúde, parceira.
- CTA principal é sempre conversa no **WhatsApp** ("Falar pelo WhatsApp").

---

## 19. Tokens prontos (CSS)

Consolidação de tudo acima em um bloco reutilizável (nomes do site preservados; extras
nomeados no mesmo idioma):

```css
:root {
  /* ---- Cores de marca ---- */
  --roxo:         #7137D6;
  --roxo-claro:   #8B4DFF;
  --roxo-escuro:  #5325A5;
  --lavanda:      #F0E9FD;
  --lavanda-2:    #E9E0F7;
  --wordmark:     #F6DCFF;

  /* ---- Neutros ---- */
  --fundo:        #F8F7FC;
  --branco:       #FFFFFF;
  --tinta:        #211B2E;
  --texto-base:   #1D1730;
  --texto-post:   #3A3346;
  --cinza:        #716A7D;
  --cinza-2:      #80758F;
  --borda:        #DED9E6;
  --device:       #1D1A24;
  --device-aro:   #3A3545;

  /* ---- Sobre roxo ---- */
  --texto-claro:      rgba(255,255,255,.90);
  --texto-claro-2:    rgba(255,255,255,.88);
  --borda-clara-14:   rgba(255,255,255,.14);
  --borda-clara-16:   rgba(255,255,255,.16);
  --borda-clara-28:   rgba(255,255,255,.28);
  --borda-clara-38:   rgba(255,255,255,.38);
  --borda-clara-80:   rgba(255,255,255,.80);

  /* ---- Terceiros ---- */
  --verde-wa:     #25D366;

  /* ---- Gradiente ---- */
  --grad-hero:        linear-gradient(90deg, #7137D6 0%, #7137D6 56%, #8B4DFF 100%);
  --grad-hero-mobile: linear-gradient(90deg, #7137D6 0%, #7137D6 38%, #8B4DFF 100%);

  /* ---- Tipografia ---- */
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fs-hero:    clamp(56px, 5.2vw, 100px);
  --fs-section: clamp(44px, 4.4vw, 84px);
  --fs-post:    clamp(32px, 3.4vw, 52px);
  --ls-hero:    -0.02em;
  --ls-section: -0.045em;
  --ls-eyebrow: .16em;
  --ls-label:   .1em;

  /* ---- Raios ---- */
  --r-xs:   2px;
  --r-sm:   10px;   /* botões, icon-tile */
  --r-md:   12px;   /* botões de loja */
  --r-lg:   16px;   /* ícone de passo, imagens do post */
  --r-xl:   20px;   /* FAQ aberto, card de lojas */
  --r-card: 24px;   /* card padrão */
  --r-photo: 28px;
  --r-device: 54px;
  --r-screen: 44px;
  --r-pill: 999px;

  /* ---- Sombras ---- */
  --shadow-header: 0 6px 20px rgba(33,27,46,.14);
  --shadow-hover:  0 12px 32px rgba(33,27,46,.08);
  --shadow-device: 0 32px 64px rgba(33,27,46,.18), inset 0 0 0 2px #3A3545;
  --shadow-fab:    0 8px 24px rgba(20,20,40,.28);

  /* ---- Layout ---- */
  --gutter: clamp(24px, 6.25vw, 120px);
  --container: 1680px;
  --section-y: clamp(72px, 7.3vw, 140px);  /* mobile: 64px */
  --gap-grid: 32px;
  --header-h: 120px;        /* mobile 88px */
  --header-compact: 76px;   /* mobile 64px */

  /* ---- Movimento ---- */
  --t-fast: .15s ease;
  --t-base: .2s ease;
  --t-slow: .25s ease;

  /* ---- Breakpoints (referência; CSS não aceita var em @media) ----
     1400px · 1280px · 1080px (mobile) · 480px */
}
```

---

## 20. Checklist "parece Medflow?"

- [ ] Só uma cor de marca (`#7137D6`) + lavandas; nenhuma cor secundária competindo.
- [ ] Fundo da página `#F8F7FC`, cards brancos com borda `#DED9E6` 1px e raio 24px, sem sombra.
- [ ] Seção abre com eyebrow (traço 32×3 + CAPS 13px tracking .16em) e título 600 com
      tracking bem negativo.
- [ ] Inter em 400/500/600/700, títulos em 600, ênfase por peso.
- [ ] Ícones de linha 1.6px em tile lavanda 40×40 raio 10.
- [ ] Botões com raio 10px, altura generosa (56–60px), roxo → roxo-escuro no hover.
- [ ] Pílulas totalmente arredondadas, CAPS pequenas em roxo-escuro sobre lavanda.
- [ ] Faixas de destaque em roxo chapado com elementos "outline" brancos translúcidos.
- [ ] Transições curtas (.15–.25s ease), hover sutil (1–2px de elevação).
- [ ] Texto de apoio em `#716A7D`; `#80758F` só em texto grande.
