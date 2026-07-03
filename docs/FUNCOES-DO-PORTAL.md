# Catálogo Completo de Funções — Portal do Parceiro (MedFlow)

> **Propósito deste documento**
> Este é o inventário exaustivo de **tudo o que um usuário pode ver e fazer** no Portal do
> Parceiro: cada aba, botão, filtro, alternância, modal, ação de escrita e diferença entre
> papéis. Serve de base para verificação/QA manual e para conferir se o comportamento
> implementado bate com o esperado.
>
> **⚠️ ESTE ARQUIVO DEVE SER MANTIDO ATUALIZADO.** Sempre que uma função for adicionada,
> removida ou tiver seu comportamento alterado (novo botão, novo filtro, mudança de regra,
> mudança de quem pode fazer o quê), **atualize este documento no mesmo commit**. Um item
> aqui que não corresponde mais ao código é um bug de documentação — corrija na fonte.
>
> _Última varredura do código: 2026-07-02._

---

## 0. Conceitos e papéis

O portal é **somente leitura** sobre os dados financeiros (Google Sheets), com **uma única
exceção de escrita**: os *Avisos de Pagamento* (tabela Postgres). Nenhuma ação do portal
altera a planilha ou o CRM — o status financeiro continua sendo editado manualmente pelo
gestor na planilha.

Existem **dois papéis** (campo `role` em `GET /api/me`):

| Papel | Quem é | Escopo de dados |
|-------|--------|-----------------|
| **`parceiro`** | Login vinculado a **1 Contratante** | Vê **apenas** as solicitações do seu Contratante **E** cujas Unidades estão na sua *allowlist*. Nunca vê dados de outro parceiro nem margens da MedFlow. |
| **`gestor`** | Login administrativo | Vê **tudo** (visão consolidada, todos os Contratantes) + abas administrativas exclusivas. |

**Regra de isolamento (R-001, inegociável):** o escopo do parceiro é aplicado **no backend**
(`domain/scope.py`), antes de serializar. Esconder no frontend não basta — o dado sensível
nunca sai do servidor para um parceiro. A *allowlist* de Unidades só **restringe dentro** do
Contratante; nunca concede acesso cruzado.

### Navegação por papel (abas visíveis na barra lateral)

| Aba | Rota | Parceiro | Gestor |
|-----|------|:--------:|:------:|
| Visão Geral (Dashboard) | `/dashboard` | ✅ | ✅ |
| Solicitações | `/solicitacoes` | ✅ | ✅ |
| Vencimentos | `/vencimentos` | ✅ | ✅ |
| Pagamentos | `/pagamentos` | ❌ | ✅ |
| Parceiros | `/parceiros` | ❌ | ✅ |
| Pendências | `/pendencias` | ❌ | ✅ |

> O parceiro **nunca vê pistas** das abas exclusivas do gestor — elas nem aparecem no menu
> (`NAV.filter` por `roles` em [layout.tsx](../frontend/src/app/(portal)/layout.tsx)). Se um
> parceiro tentar acessar a rota/endpoint direto, o backend responde **403** (`GestorUser`).

---

## 1. Autenticação e sessão

### 1.1 Tela de Login — `/login` (pública)
Arquivo: [login/page.tsx](../frontend/src/app/(auth)/login/page.tsx)

| Função | Como funciona |
|--------|---------------|
| **Campo E-mail** | Input de e-mail (obrigatório). |
| **Campo Senha** | Input de senha mascarada (obrigatório). |
| **Botão "Entrar"** | Autentica via Supabase (`signInWithPassword`). Enquanto processa, mostra spinner + "Entrando…". Sucesso → redireciona para `/dashboard`. Erro → mensagem "E-mail ou senha inválidos." |
| **Aviso de sessão expirada** | Se a URL vier com `?expirou=1` (redirecionado do portal ao tomar 401), mostra o banner "Sua sessão expirou. Entre novamente para continuar." |
| Painel de marca (desktop) | Puramente visual: logo + benefícios. Sem interação. |

**Não existe** cadastro público, recuperação de senha nem "lembrar-me" na tela de login.
Contas são criadas **apenas** pelo gestor (aba Parceiros).

### 1.2 Guarda de rota (todas as páginas do portal)
Arquivo: [layout.tsx](../frontend/src/app/(portal)/layout.tsx)

- Sem sessão Supabase → redireciona para `/login`.
- Backend retorna **401** (identidade recusada) → redireciona para `/login?expirou=1`.
- Backend retorna **5xx / erro de rede** com sessão válida → mostra **tela de erro** com
  botão **"Tentar de novo"** (recarrega a página). **Não** desloga por soluço transitório.
- Enquanto verifica sessão / carrega `/api/me` → tela "Carregando o portal…".

### 1.3 Logout
Disponível no **Menu de Conta** (rodapé da sidebar) → **"Sair da conta"**. Faz
`supabase.auth.signOut()` e volta para `/login`. (Ambos os papéis.)

---

## 2. Layout global (presente em todas as abas do portal)

### 2.1 Barra lateral (Sidebar) — desktop
Arquivo: [Sidebar.tsx](../frontend/src/components/portal/Sidebar.tsx)

| Função | Como funciona |
|--------|---------------|
| **Logo → Dashboard** | Clicar na logo (topo) leva para `/dashboard`. |
| **Itens de navegação** | Lista as abas do papel; item ativo destacado (barra roxa + realce). Clicar navega. |
| **Rótulo do papel** | Mostra "Parceiro" ou "Gestor" no rodapé. |
| **Alternância de tema** | Ver §2.4. |
| **Menu de conta** | Ver §2.5. |

### 2.2 Recolher / expandir sidebar (desktop)
- **Botão painel (PanelLeft)** na Topbar recolhe/expande a sidebar (76px ↔ 264px).
- A preferência é **persistida** em `localStorage` (`mf-sidebar-collapsed`) — sobrevive a
  recarregamentos.
- Quando recolhida, os itens viram só ícones com **tooltip** ao passar o mouse.

### 2.3 Menu mobile
- Em telas pequenas, a Topbar mostra o **botão Menu (hambúrguer)**, que abre a navegação
  num painel lateral (Sheet). Clicar num item navega e fecha o painel.

### 2.4 Alternância de tema (claro/escuro)
Arquivo: [ThemeToggle.tsx](../frontend/src/components/ThemeToggle.tsx)
- Botão sol/lua no rodapé da sidebar. Alterna o tema do **conteúdo** entre claro e escuro
  (a sidebar é sempre escura). Persistido pelo `next-themes`. Ambos os papéis.

### 2.5 Menu de conta
Arquivo: [AccountMenu.tsx](../frontend/src/components/AccountMenu.tsx)
- Avatar (iniciais do nome) + nome + papel. Ao clicar, abre dropdown com:
  - Cabeçalho (nome + papel).
  - **"Sair da conta"** → logout (§1.3).

### 2.6 Topbar
Arquivo: [Topbar.tsx](../frontend/src/components/portal/Topbar.tsx)
- Botão recolher (desktop) / menu (mobile), separador e **título da seção atual**.
- **Selo "Visão do gestor · todos os parceiros"** aparece **só para o gestor** no canto direito.

### 2.7 Transições e feedback
- Transição animada entre páginas (`PageTransition`).
- **Toasts** (canto superior central) confirmam ações de escrita (enviado / verificado /
  rejeitado / erro etc.) via `sonner`.

---

## 3. Sistema de Filtros Dinâmicos (chips) — compartilhado

Presente nas abas **Visão Geral, Solicitações e Vencimentos**. Componível: o usuário monta
os filtros que quiser como "chips". Arquivos: [BarraFiltros.tsx](../frontend/src/components/filtros/BarraFiltros.tsx),
[registry.ts](../frontend/src/lib/filtros/registry.ts), [EditorValor.tsx](../frontend/src/components/filtros/EditorValor.tsx).

### 3.1 Controles da barra de filtros
| Função | Como funciona |
|--------|---------------|
| **Botão "Adicionar filtro"** | Abre popover em 2 passos: (1) escolhe o **campo** (só os ainda não usados, já filtrados por aba + papel); (2) edita o **valor** e clica "Aplicar". Desabilitado quando todos os campos já estão em uso. |
| **Chip de filtro ativo** | Mostra "Campo: resumo do valor". Clicar no corpo reabre o editor (popover) para ajustar; o **"×"** remove o filtro. |
| **Botão "Limpar tudo"** | Aparece quando há ≥1 filtro ativo; remove todos de uma vez. |
| **Persistência** | Os filtros ativos vivem na **URL** (query string) — recarregar mantém, e o link pode ser compartilhado. |
| **Opções escopadas** | As opções de cada filtro vêm do backend (`GET /api/filtros/opcoes?aba=`) **já restritas ao escopo** do usuário — o parceiro só vê opções do próprio Contratante/Unidades. |

### 3.2 Editores por tipo de campo
- **`multi` (checklist):** lista de opções com marcação múltipla; se houver >8 opções, aparece
  um campo **"Buscar…"**. Botões **"Limpar"** e **"Aplicar"**. Aplica "mostra apenas os
  selecionados".
- **`range` (min/máx numérico):** dois campos "De" e "Até" (placeholder com o mín./máx.
  disponíveis). Filtra pelo intervalo.
- **`date` (min/máx de datas):** dois *date pickers* "De" e "Até".

### 3.3 Campos de filtro disponíveis (por aba e papel)

| Campo (rótulo) | Tipo | Solicitações | Vencimentos | Visão Geral | Papel |
|----------------|------|:---:|:---:|:---:|-------|
| **Status** | multi | ✅ | ✅ | ✅ | ambos |
| **Unidade** | multi | ✅ | ✅ | ✅ | ambos |
| **Médico** | multi | ✅ | ✅ | — | ambos |
| **Originação (R$)** | range | ✅ | ✅ | — | ambos |
| **Data do pedido** | date | ✅ | — | — | ambos |
| **Vencimento** | date | ✅ | ✅ | — | ambos |
| **Mês de originação** | multi | ✅ | — | — | ambos |
| **Mês de vencimento** | multi | ✅ | — | — | ambos |
| **Rebate (R$)** | range | ✅ | — | — | ambos |
| **Prazo (dias)** | range | ✅ | — | — | ambos |
| **Contratante** | multi | ✅ | ✅ | ✅ | **só gestor** |

> **Filtro de Status** (exemplo detalhado): o usuário escolhe entre **Pago**, **A Vencer**
> (chave interna `a_pagar`) e **Vencido** (chave interna `atrasado`). O resultado passa a
> mostrar **apenas** as solicitações nos status selecionados. É o único `multi` com opções
> fixas; os demais `multi` (Unidade, Médico, Contratante, Meses) têm opções **derivadas dos
> dados** do escopo.

> **Filtro Contratante** existe **apenas para o gestor** — é como ele foca a visão em um ou
> mais parceiros específicos. O parceiro nunca recebe esse campo (e o backend rejeitaria).

---

## 4. Aba: Visão Geral / Dashboard — `/dashboard`
Arquivo: [dashboard/page.tsx](../frontend/src/app/(portal)/dashboard/page.tsx) · Endpoint: `GET /api/overview`

Acesso: **parceiro e gestor**. O parceiro vê os próprios números; o gestor vê o **somatório
global** (todos os parceiros). Mesmo layout para os dois.

### 4.1 Recorte temporal (`SeletorTempoOverview`)
Arquivo: [SeletorTempoOverview.tsx](../frontend/src/components/portal/SeletorTempoOverview.tsx)

| Função | Como funciona |
|--------|---------------|
| **Seletor de Ano** | Dropdown com os anos que têm dados no escopo. Recorta as métricas por ano de **originação**. Se o ano corrente não tiver dados, cai automaticamente no ano mais recente disponível. |
| **Checkbox "Ano inteiro" / "Por mês"** | Desligado = ano inteiro. Ligado = habilita a seleção de meses específicos. |
| **Chips de meses (Jan…Dez)** | Aparecem quando "Por mês" está ligado. Cada mês é um toggle. Recorta as métricas aos meses selecionados. |
| **"Selecionar todos" / "Limpar"** (meses) | Marca/desmarca todos os 12 meses de uma vez. |
| **Período de originação (DateRangePicker)** | Calendário de 2 meses com confirmação. Quando ativo, **substitui** o recorte ano/meses: mostra apenas solicitações originadas no intervalo `[de, até]` (inclusivo). |
| **Botão "×" (limpar período)** | Aparece quando há período ativo; volta ao recorte ano/meses. Enquanto o período está ativo, os controles de ano/mês ficam esmaecidos e desabilitados, com aviso explicativo. |

### 4.2 Barra de filtros (chips)
Aplica os filtros da §3 sobre os cards **e** o gráfico. Para o gestor, inclui o chip
**Contratante**.

### 4.3 KPIs (cards de topo) — refletem o recorte + filtros
| Card | Significado |
|------|-------------|
| **Total de Solicitações** | Contagem de solicitações no recorte. |
| **Originação Total** | Soma dos valores de originação. |
| **Total de Rebate** | Soma do cashback. |
| **Em Aberto / Pagas** | Contagem de não-pagas / pagas. |
| **Médicos Impactados** | Clientes (médicos) distintos. |

### 4.4 Gráfico e cartões laterais
| Função | Como funciona |
|--------|---------------|
| **Gráfico "Solicitações Mensais"** | Barras da soma de originação por mês dentro do recorte. Vazio → estado "Sem histórico ainda". |
| **Card "Ticket Médio"** | Originação total ÷ médicos distintos, com detalhamento. |
| **Atalho "Próximos Vencimentos"** | Link/card que leva para `/vencimentos`. |

---

## 5. Aba: Solicitações — `/solicitacoes`
Arquivo: [solicitacoes/page.tsx](../frontend/src/app/(portal)/solicitacoes/page.tsx) · Endpoints: `GET /api/solicitacoes`, `GET /api/solicitacoes/{codigo}`

Acesso: **parceiro e gestor**. Lista tabular de solicitações, escopada.

### 5.1 Busca e filtros
| Função | Como funciona |
|--------|---------------|
| **Campo de busca livre** | Busca por **código, cliente ou status** (com debounce). O status casa os rótulos exibidos: digitar "Vencido" ou "A Vencer" funciona, além das chaves internas. Busca é server-side. |
| **Barra de filtros (chips)** | Todos os campos da §3 aplicáveis a Solicitações. Gestor tem também o chip **Contratante**. |

### 5.2 Colunas da tabela (`SlidersHorizontal` → "Colunas")
Arquivo: [colunasSolicitacao.tsx](../frontend/src/components/colunasSolicitacao.tsx)

| Função | Como funciona |
|--------|---------------|
| **Menu "Colunas"** | Dropdown com checkboxes para mostrar/ocultar colunas não-essenciais. |
| **Colunas essenciais (fixas)** | Código, Cliente, Status — sempre visíveis. |
| **Colunas visíveis por padrão** | Pedido, Originação, Quitação (+ **Parceiro** só p/ gestor). |
| **Colunas ocultas por padrão** | Recebido cliente, IOF, Taxa ao mês, Prazo, Unidade referência, Rebate. |
| **Coluna "Parceiro"** | **Só existe para o gestor** (mostra o Contratante). |
| **Acento de cor na linha** | **Só para o gestor**: linhas ganham a cor do parceiro (definida na aba Parceiros). |

### 5.3 Tabela, agrupamento e paginação
| Função | Como funciona |
|--------|---------------|
| **Agrupamento por médico** | Linhas do mesmo médico ficam contíguas. Para o gestor, o agrupamento inclui o Contratante (não funde homônimos de parceiros diferentes). |
| **Contador de registros** | "X de Y registros". |
| **Botão "Ver mais"** | Paginação incremental (páginas de 20; nunca corta um grupo de médico no meio). |
| **Clique na linha → Detalhe** | Abre painel lateral (Sheet) com o detalhe (§5.4). |

### 5.4 Painel de Detalhe da solicitação
Arquivo: [DetalheSolicitacao.tsx](../frontend/src/components/DetalheSolicitacao.tsx)

- **Hero do médico:** total antecipado + agregados (nº solicitações, ticket médio, pagas, em
  aberto, rebate acumulado, desde, nº unidades). Para o **gestor**, mostra também **Lucro
  operacional** agregado.
- **Financeiro:** Originação, Recebido pelo cliente, IOF, Juros e descontos, Taxa de juros
  (mês), Rebate. **Só para o gestor:** **Lucro operacional** e **ÁGIO base**.
- **Datas & unidade:** Data do pedido, Vencimento, Prazo, Unidade.
- **Médico (PII):** Nome, CPF, Telefone, E-mail, PIX, Nascimento.
- Botão **"Tentar de novo"** se o detalhe falhar ao carregar.

> **Diferença de papel crítica:** os campos de **margem da MedFlow** (`lucro_operacional`,
> `agio_base`) e o **Contratante/cor** só são incluídos no payload do gestor — o backend faz
> *strip* para o parceiro (`serializa_solicitacao(..., incluir_gestor)`). O parceiro **nunca**
> recebe esses valores, nem pela rede.

---

## 6. Aba: Vencimentos — `/vencimentos`
Arquivo: [vencimentos/page.tsx](../frontend/src/app/(portal)/vencimentos/page.tsx) · Endpoint: `GET /api/vencimentos`

Acesso: **parceiro e gestor**, mas com **visões bem diferentes**. A barra de filtros (§3)
aplica-se aos dois.

### 6.1 Visão do PARCEIRO
Conceito central: **lote = (Unidade + data de vencimento)**. Uma mesma unidade pode ter
vários vencimentos, pagos/avisados em separado.

| Função | Como funciona |
|--------|---------------|
| **Cards** | Total Pendente, Em Atraso (destaca em vermelho se houver), Próximos (contagem), Pagos (contagem). |
| **Lista de "Vencimentos" (acordeão)** | Uma linha por lote, com barra segmentada (vencido em vermelho + a vencer em âmbar), selo de **prazo** (`BadgePrazo`, vermelho se vencido) e total pendente. Expandir mostra a tabela de solicitações do lote (Código, Cliente, Originação, Rebate, Vencimento, Status). |
| **Botão "Pagar" (por lote)** | Ver §6.3 — o núcleo da feature de Avisos de Pagamento. |
| **Selo "Tudo pago"** | Unidade sem pendência aparece com selo verde e sem botão Pagar. |
| **Seção "Vencimentos por atraso"** | Card destacado (vermelho) que aparece **só se houver atrasados**, agrupando as datas vencidas. |
| **Seção "Próximos Vencimentos"** + **Seletor de período** | Dropdown: **Próximos 2 dias** / **Próxima semana** (padrão) / **Próximas 2 semanas**. Filtra a lista de próximos vencimentos por janela. |
| **Seção "Vencimentos Pagos"** | Datas já confirmadas como pagas. |

### 6.2 Visão do GESTOR
| Função | Como funciona |
|--------|---------------|
| **Cards** | Solicitações a Pagar (contagem global) e Total a Receber (valor global pendente). |
| **Lista por Contratante (acordeão)** | Cada contratante = barra segmentada (vencido + a vencer) + total pendente; "Tudo pago" quando zerado. |
| **Seletor "Agrupar por"** | Dropdown: **Agrupar por unidade** (padrão) ou **Agrupar por vencimento** (lotes). Muda como o conteúdo do contratante é aberto. |
| **Linha de Unidade → janela** | Clicar abre modal grande com **todas** as solicitações da unidade (scrollável). |
| **Linha de Lote → janela** | (No modo "por vencimento") clicar abre modal com as solicitações daquele lote/data. |

> O gestor **não** tem botão "Pagar" — quem avisa pagamento é o parceiro. O gestor verifica
> na aba Pagamentos (§7).

### 6.3 Fluxo "Pagar" (Avisos de Pagamento) — lado do PARCEIRO
Arquivo: [ConfirmarPagamento.tsx](../frontend/src/components/portal/ConfirmarPagamento.tsx)
Endpoints: `POST /api/pagamentos/avisos`, `DELETE /api/pagamentos/avisos/{id}`, `GET /api/pagamentos/meus`

O controle de cada lote muda conforme o estado do aviso vigente:

| Estado | O que o parceiro vê / pode fazer |
|--------|----------------------------------|
| **Sem aviso** (e há pendência) | Botão **"Pagar"**. Abre modal "Confirmar pagamento" com o valor do lote, prazo, unidade, nº de solicitações. **Confirmar** envia o aviso aos gestores. Deixa claro que **não** altera o status automaticamente. |
| **Rejeitado** | Além do botão "Pagar", mostra um selo **"Rejeitado"** (com o motivo no tooltip / dentro do modal). O parceiro pode reenviar. |
| **Pendente** (enviado) | Selo clicável **"Em Análise"**. Abre modal com os dados do aviso e o botão **"Cancelar aviso"** (só possível enquanto não verificado). |
| **Verificado** | Selo travado **"Pagamento verificado"** — sem ações. |

**Regras importantes do "Pagar":**
- O valor e os códigos são **congelados no servidor** (snapshot) a partir do dataset já
  escopado — o corpo do request só informa unidade + data.
- O modal envia o **valor esperado** (eco). Se o snapshot recomputado divergir (dado mudou no
  sheet **ou** filtro de UI ativo reduziu o lote), o backend **barra o envio** com aviso para
  recarregar — em vez de congelar um valor não confirmado.
- **Serviço de Rebate (feature 005):** se o Contratante tiver o serviço ligado e o lote tiver
  cashback, o modal mostra **Originação − Rebate = Valor a Pagar**. Quem não tem o serviço vê
  só o valor cheio. (O toggle é do gestor, §8.3.)
- Só um aviso **ativo** (pendente ou verificado) por lote `(contratante, unidade, data)` —
  índice único no banco impede duplicidade.

---

## 7. Aba: Pagamentos — `/pagamentos` — **SÓ GESTOR**
Arquivo: [pagamentos/page.tsx](../frontend/src/app/(portal)/pagamentos/page.tsx)
Endpoints: `GET /api/pagamentos`, `POST .../verificar`, `POST .../rejeitar`, `POST .../reabrir`

O gestor gerencia os avisos enviados pelos parceiros. **Parceiro não acessa** (403).

| Função | Como funciona |
|--------|---------------|
| **Cards** | Em Análise (destaca se >0), Verificadas, Falta aviso. |
| **Seções por Contratante** | Cada parceiro com bolinha de cor + badges de contagem. Dividido em 3 blocos. |
| **Bloco "Em Análise"** | Cards de avisos pendentes com valor (ou Originação/Rebate/Valor a Pagar quando há rebate), prazo, data de envio e lista expansível das solicitações cobertas. |
| **Botão "Verificar pagamento"** | Confirma o aviso (**pendente → verificado**). Toast de sucesso e recarrega. |
| **Botão "Rejeitar"** | Abre modal exigindo **motivo** (obrigatório; Enter confirma). Rejeita (**pendente → rejeitado**); o parceiro vê o motivo e pode reenviar. |
| **Bloco "Verificadas"** | Avisos já confirmados. Cada um com botão **"Desfazer"** (**verificado → pendente**), para corrigir clique errado. |
| **Bloco "Falta aviso"** | Unidades com pendência no sheet e **sem** aviso ativo; anota o motivo do último aviso rejeitado, se houver. Apenas informativo (sem ação). |

**Máquina de estados do aviso** (backend, com guarda de corrida atômica):
```
pendente ──verificar──▶ verificado ──reabrir(Desfazer)──▶ pendente
pendente ──rejeitar──▶ rejeitado (parceiro pode enviar novo)
pendente ──cancelar(parceiro)──▶ cancelado
```
- **Verificar/Rejeitar** só valem sobre `pendente`; **Reabrir** só sobre `verificado`;
  **Cancelar** (parceiro) só sobre `pendente`. Qualquer transição fora disso → erro 400.

---

## 8. Aba: Parceiros — `/parceiros` — **SÓ GESTOR**
Arquivo: [parceiros/page.tsx](../frontend/src/app/(portal)/parceiros/page.tsx)
Endpoints: `GET/POST/PUT/DELETE /api/admin/{partners,parceiros,contratantes,unidades}`

Administração de parceiros. **Parceiro não acessa** (403). Cada **parceiro = um Contratante**
(cor + allowlist de unidades + 1..N logins; config sincronizada entre os logins).

### 8.1 Lista e cartões
| Função | Como funciona |
|--------|---------------|
| **Lista de cartões de parceiro** | Um por Contratante (todas as Contratantes do sheet aparecem, mesmo sem login). Mostra cor, nº de logins (ou "sem login"), e "todas as unidades" ou "N de M unidades". |
| **Botão "Adicionar login"** (topo) | Abre o diálogo de criação de login (§8.2). |
| **Botão "Editar parceiro"** (por cartão) | Abre o diálogo de config: cor + unidades + rebate (§8.3). **Desabilitado** enquanto o parceiro não tiver ≥1 login (tooltip explica). |
| **Botão "Gerenciar logins" / "Adicionar login"** (por cartão) | Abre o painel de logins (§8.4). O rótulo vira "Adicionar login" quando o parceiro ainda não tem nenhum. |

### 8.2 Diálogo "Adicionar login"
| Campo/Ação | Regras |
|------------|--------|
| **Contratante** | Dropdown das Contratantes do sheet (com contagem). Fixo quando aberto a partir de um cartão específico. |
| **E-mail** | Obrigatório. |
| **Nome de exibição** | Obrigatório. |
| **Senha inicial** | Obrigatória, mínimo 6 caracteres (valida ao vivo). |
| **Botão "Criar acesso"** | Cria o login (`POST /api/admin/parceiros`). Se a Contratante é nova, pré-vincula por padrão as unidades que coocorrem com ela no sheet. Toast de sucesso; recarrega. |
| **Botão "Cancelar"** | Fecha sem salvar. |

### 8.3 Diálogo "Editar parceiro" (config)
| Função | Como funciona |
|--------|---------------|
| **ColorPicker (roda de cores + hex + presets)** | Define a **cor** do parceiro (usada em acento de linha, quadros e badges). Roda RGB/hex livre + 8 presets. |
| **EditorUnidades (allowlist)** | Lista **todas** as unidades com um toggle cada. Ligar = a unidade entra na allowlist do parceiro (ele passa a enxergá-la). Tem **busca**, contagem de ativas, e botões **"Marcar todas"** / **"Limpar"**. Cada unidade mostra um badge de vínculo atual: *sem contratante* (órfã), *uma contratante* ou *2+ contratantes* (aviso forte de conflito). |
| **Toggle "Serviço de rebate (cashback)"** | Liga/desliga o serviço de rebate **por Contratante** (feature 005). Ligado: no pagamento o parceiro paga Originação − Rebate, e o gestor verifica o Valor a Pagar já descontado. |
| **Botão "Salvar"** | `PUT /api/admin/partners` — aplica cor + unidades + rebate a **todos os logins** do parceiro (fan-out). |
| **Botão "Cancelar"** | Fecha sem salvar. |

### 8.4 Painel "Gerenciar logins" (Sheet lateral)
| Função | Como funciona |
|--------|---------------|
| **Lista de logins** | Nome, e-mail, data de criação de cada login do parceiro. |
| **Botão editar (lápis) por login** | Abre diálogo "Editar login": muda **Nome de exibição** e/ou **Nova senha** (opcional). Salva via `PUT /api/admin/parceiros/{id}`. |
| **Botão remover (lixeira) por login** | Abre diálogo de confirmação "Remover acesso" (a sessão do login é invalidada; **ação irreversível**). Confirma via `DELETE /api/admin/parceiros/{id}`. |
| **Botão "Adicionar login a este parceiro"** | Fecha o painel e abre o diálogo de criação já com o Contratante fixado. |

---

## 9. Aba: Pendências de Dados — `/pendencias` — **SÓ GESTOR**
Arquivo: [pendencias/page.tsx](../frontend/src/app/(portal)/pendencias/page.tsx) · Endpoint: `GET /api/admin/pendencias`

Solicitações **reprovadas na validação** da planilha (dado faltando/inválido). Elas somem de
todas as outras telas/métricas e **voltam sozinhas** ao corrigir a planilha. **Parceiro não
acessa** (403).

| Função | Como funciona |
|--------|---------------|
| **Campo de busca** | Busca por código, cliente ou motivo (debounce, server-side). |
| **Tabela de pendências** | Colunas: Linha (origem no sheet), Código, Cliente, Contratante, Originação, Motivos (chips de erro). |
| **Botão "Ver mais"** | Paginação incremental (páginas de 50). |
| **Seção "Contratantes como Individual"** | Bloco separado, abaixo, para médicos "sem franquia" (Contratante = `INDIVIDUAL`). Não são erro de dado e **não aparecem para parceiros**. |
| **Botão "Tentar de novo"** | Recarrega em caso de erro. |

---

## 10. Componentes transversais de exibição

| Componente | Onde aparece | Comportamento |
|------------|--------------|---------------|
| **BadgeStatus** | Tabelas, detalhe, vencimentos | Pílula de status: **Pago** (verde), **A Vencer** (âmbar), **Vencido** (vermelho). Nunca depende só de cor (ponto + texto). Rótulo derivado no front (fonte única). |
| **BadgePrazo** | Vencimentos, modais de pagamento, quadro do gestor | Selo com data + dias relativos ("em 3d", "vence hoje", "5d atrás"). Vermelho se vencido, roxo se a vencer. Não renderiza sem data. |
| **DataTable** | Solicitações, vencimentos, pendências | Tabela genérica com clique de linha, agrupamento e estado vazio. |
| **StatCard** | Dashboard, vencimentos, pagamentos | Cartão de KPI com ícone/tom; suporta destaque. |
| **ErroCarregamento** | Várias abas | Estado de erro com botão "Tentar de novo". |
| **Skeletons** | Todas as abas | Placeholders enquanto carrega. |

---

## 11. Referência rápida de endpoints × papel

| Método | Rota | Parceiro | Gestor | Observação |
|--------|------|:---:|:---:|-----------|
| GET | `/api/me` | ✅ | ✅ | Papel + contratante. |
| GET | `/api/overview` | ✅ (escopo) | ✅ (global) | Dashboard. |
| GET | `/api/solicitacoes` | ✅ (escopo) | ✅ | Sem margens p/ parceiro. |
| GET | `/api/solicitacoes/{codigo}` | ✅ (escopo) | ✅ | 404 se fora do escopo. |
| GET | `/api/parceiros/lista` | ❌ 403 | ✅ | Cores dos parceiros. |
| GET | `/api/vencimentos` | ✅ (escopo) | ✅ | Visões distintas. |
| GET | `/api/filtros/opcoes` | ✅ (escopo) | ✅ | Opções de filtro. |
| GET | `/api/pagamentos/meus` | ✅ | (n/a) | Estado dos avisos do parceiro. |
| POST | `/api/pagamentos/avisos` | ✅ | ❌ 403 | Enviar aviso. |
| DELETE | `/api/pagamentos/avisos/{id}` | ✅ (próprio) | ❌ 403 | Cancelar aviso (se pendente). |
| GET | `/api/pagamentos` | ❌ 403 | ✅ | Consolidado do gestor. |
| POST | `/api/pagamentos/avisos/{id}/verificar` | ❌ 403 | ✅ | pendente→verificado. |
| POST | `/api/pagamentos/avisos/{id}/rejeitar` | ❌ 403 | ✅ | pendente→rejeitado (+motivo). |
| POST | `/api/pagamentos/avisos/{id}/reabrir` | ❌ 403 | ✅ | verificado→pendente. |
| GET | `/api/admin/partners` | ❌ 403 | ✅ | Lista de parceiros. |
| GET | `/api/admin/parceiros` | ❌ 403 | ✅ | Logins (flat). |
| GET | `/api/admin/contratantes` | ❌ 403 | ✅ | Dropdown de criação. |
| GET | `/api/admin/unidades` | ❌ 403 | ✅ | Universo + vínculos. |
| POST | `/api/admin/parceiros` | ❌ 403 | ✅ | Criar login. |
| PUT | `/api/admin/parceiros/{id}` | ❌ 403 | ✅ | Editar login. |
| PUT | `/api/admin/partners` | ❌ 403 | ✅ | Config (cor/unidades/rebate). |
| DELETE | `/api/admin/parceiros/{id}` | ❌ 403 | ✅ | Remover login. |
| GET | `/api/admin/pendencias` | ❌ 403 | ✅ | Pendências de dados. |
| GET | `/health` | pública | pública | Health check. |

---

## 12. Matriz resumida: o que cada papel PODE FAZER

| Função | Parceiro | Gestor |
|--------|:--------:|:------:|
| Entrar / sair | ✅ | ✅ |
| Trocar tema, recolher menu | ✅ | ✅ |
| Ver Dashboard (escopado / global) | ✅ | ✅ |
| Recorte temporal + filtros no Dashboard | ✅ | ✅ |
| Listar/buscar/filtrar Solicitações | ✅ | ✅ |
| Escolher colunas visíveis | ✅ | ✅ |
| Ver detalhe da solicitação (com PII do médico) | ✅ | ✅ |
| Ver margens da MedFlow (lucro/ágio) | ❌ | ✅ |
| Ver coluna/cor "Parceiro" | ❌ | ✅ |
| Filtrar por Contratante | ❌ | ✅ |
| Ver Vencimentos por lote (unidade+data) | ✅ | ✅ (consolidado) |
| Alternar janela "próximos" (2d/1sem/2sem) | ✅ | — |
| Alternar "agrupar por unidade/vencimento" | — | ✅ |
| **Enviar aviso de "Pagar"** | ✅ | ❌ |
| **Cancelar o próprio aviso** (se pendente) | ✅ | ❌ |
| **Verificar / Rejeitar / Reabrir aviso** | ❌ | ✅ |
| Aba Pagamentos (gestão de avisos) | ❌ | ✅ |
| Criar / editar / remover logins | ❌ | ✅ |
| Definir cor + allowlist de unidades | ❌ | ✅ |
| Ligar/desligar serviço de rebate | ❌ | ✅ |
| Ver Pendências de Dados | ❌ | ✅ |

---

### Notas de manutenção
- Fontes de verdade: registry de filtros em [registry.ts](../frontend/src/lib/filtros/registry.ts)
  (front) espelhado em `app/domain/filtros/registry.py` (back); isolamento em
  [scope.py](../backend/app/domain/scope.py); estados do aviso em
  [pagamentos.py](../backend/app/services/pagamentos.py); rótulos de status em
  [status.py](../backend/app/domain/status.py) / [format.ts](../frontend/src/lib/format.ts).
- Ao mexer em qualquer um desses, **reflita a mudança aqui**.
