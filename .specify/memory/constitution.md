<!--
SYNC IMPACT REPORT
==================
Versão: (inexistente) → 1.0.0 → 1.0.1 → 1.1.0
Tipo de mudança: Ratificação inicial (MAJOR — primeira versão).
  Emenda 1.0.1 (PATCH, 2026-06-25): correção factual de deploy — backend migra de
  Vercel para VPS/EasyPanel; frontend permanece Vercel. Sem mudança de princípio.
  Emenda 1.1.0 (MINOR, 2026-06-25): novo Princípio VII (Estrutura do Repositório &
  Organização em Camadas) — exige hierarquia de pastas (backend/, frontend/, …) e
  organização em módulos/classes coesos e hierárquicos, com guardrail KISS.

Princípios definidos:
  1. Código Limpo & Legibilidade (Clean Code)
  2. DRY — Não Repita a Si Mesmo
  3. KISS — Simplicidade Acima de Esperteza
  4. Stack & Boas Práticas (Python backend / Next.js frontend)
  5. Documentação Viva
  6. Isolamento de Dados (segurança não-negociável)
  7. Estrutura do Repositório & Organização em Camadas

Seções adicionais:
  + Restrições Técnicas & Stack
  + Fluxo de Desenvolvimento
  + Governança

Idioma de trabalho: PT-BR (definido na Governança).

Templates dependentes:
  ⚠ .specify/templates/plan-template.md   — inexistente (infra spec-kit não instalada)
  ⚠ .specify/templates/spec-template.md   — inexistente
  ⚠ .specify/templates/tasks-template.md  — inexistente
  Ao instalar a infra spec-kit, alinhar o bloco "Constitution Check" desses
  templates aos princípios abaixo.

Docs de runtime sincronizados:
  ✅ PRODUCT.md   — referenciado (fonte de propósito/usuários)
  ✅ DESIGN.md    — referenciado (fonte do sistema visual)
  ⚠ DOCUMENTATION.MD — vazio; Princípio V exige mantê-lo atualizado

TODOs deferidos: nenhum.
-->

# Constituição — MedFlow Portal do Parceiro

Portal de **visualização** (somente leitura) da operação de antecipação de
recebíveis médicos da MedFlow. Backend em **Python**, frontend em **Next.js**.
Esta constituição define as regras não-negociáveis de engenharia. Em conflito,
ela prevalece sobre preferência pessoal ou conveniência de prazo.

## Princípios Fundamentais

### I. Código Limpo & Legibilidade (Clean Code)

Código é lido muito mais vezes do que é escrito; otimizar para quem lê.

- Nomes MUST ser descritivos e revelar intenção (`valor_a_pagar`, não `vp`/`x`).
- Funções MUST fazer uma coisa só e ser curtas; preferir retornar cedo a
  aninhar condicionais profundas.
- Sem números ou strings mágicas: extrair para constantes nomeadas.
- Código morto, comentado ou "por via das dúvidas" MUST ser removido — o
  histórico de versão é a memória, não o arquivo.
- Formatação e lint MUST ser automatizados (ex.: Ruff/Black no Python, ESLint +
  Prettier no Next.js). Estilo não é assunto de revisão manual.

**Racional:** legibilidade é o multiplicador de todo o resto; sem ela, DRY e
KISS não se sustentam.

### II. DRY — Não Repita a Si Mesmo

Cada conhecimento MUST ter uma única fonte de verdade.

- Lógica de negócio duplicada MUST ser extraída para função/módulo/hook único.
- Regras compartilhadas entre backend e frontend (formatação de moeda, status de
  pagamento, validações) MUST ter uma definição canônica; quando a duplicação
  for inevitável por fronteira de linguagem, ela MUST ser explicitamente marcada
  e mantida em sincronia.
- Abstrair na **segunda** ocorrência real, não na antecipação de uma terceira —
  DRY serve à manutenção, não à arquitetura especulativa (ver KISS).

**Racional:** uma regra financeira corrigida em um só lugar elimina divergência
entre telas e endpoints.

### III. KISS — Simplicidade Acima de Esperteza

A solução mais simples que resolve o problema real é a correta.

- MUST escolher a abordagem direta; complexidade só entra quando justificada por
  requisito concreto, nunca por hipótese de futuro.
- Sem dependência, camada de abstração ou padrão de projeto que não pague seu
  custo agora. YAGNI.
- Código "esperto" que exige releitura para entender MUST ser reescrito de forma
  óbvia, ainda que mais verboso.
- Este é um portal de **leitura**: a interface NÃO MUST oferecer ações que não
  existem na operação (sem botões de gestão de médicos/contratos). Simplicidade
  de produto reflete simplicidade de código.

**Racional:** simplicidade é o que mantém um projeto pequeno entregável e
auditável por uma fintech regulada.

### IV. Stack & Boas Práticas (Python / Next.js)

Cada lado segue as convenções idiomáticas da sua plataforma.

- **Backend (Python):** type hints obrigatórios em assinaturas públicas; seguir
  PEP 8; validação de dados na fronteira (ex.: Pydantic); separar camadas
  (rotas/serviço/dados) sem lógica de negócio nos handlers; segredos só via
  variáveis de ambiente, nunca no código.
- **Frontend (Next.js):** componentes pequenos e composáveis; Server Components
  por padrão, Client Components só quando há interatividade; estado mínimo e
  local sempre que possível; tokens de design de DESIGN.md (OKLCH) como fonte de
  verdade visual — sem valores de cor/spacing hardcoded.
- Acessibilidade MUST atender WCAG AA conforme PRODUCT.md/DESIGN.md (contraste,
  teclado, foco visível, `prefers-reduced-motion`).
- Nenhum dado sensível ou financeiro MUST ser logado em claro.

**Racional:** idiomático = previsível para qualquer dev futuro e compatível com
o ferramental do ecossistema.

### V. Documentação Viva

A documentação MUST acompanhar o código no mesmo commit, não depois.

- `DOCUMENTATION.MD` MUST refletir o estado atual do projeto (arquitetura,
  decisões, como rodar, variáveis de ambiente). Mudança que o afete sem
  atualizá-lo é incompleta.
- Comentários explicativos MUST existir nas partes mais complexas e em decisões
  arquiteturais — explicar o **porquê**, não o **o quê** (o código já diz o quê).
- Comentário não MUST narrar o óbvio nem substituir um nome melhor (ver
  Princípio I).

**Racional:** o conhecimento do projeto não pode viver só na cabeça de quem
escreveu; a doc é o que permite continuidade e onboarding.

### VI. Isolamento de Dados (não-negociável)

Um parceiro NUNCA MUST acessar, ver ou inferir dados de outro parceiro.

- Toda consulta de dados de parceiro MUST ser escopada pela identidade
  autenticada no backend; o frontend nunca é a barreira de autorização.
- A visão do gestor (consolidada/todos) MUST ser separada e explicitamente
  autorizada por papel.
- Qualquer endpoint novo que retorne dado de parceiro MUST provar o escopo antes
  de ser considerado pronto.

**Racional:** é requisito de uma fintech regulada (Bacen) e princípio central de
produto em PRODUCT.md/DESIGN.md; vazamento aqui é falha crítica, não bug menor.

### VII. Estrutura do Repositório & Organização em Camadas

O repositório MUST ser organizado em pastas hierárquicas claras, e o código em
módulos/classes coesos com responsabilidade única e direção de dependência explícita.

**Hierarquia de pastas:**

- A raiz MUST separar responsabilidades em diretórios de topo autocontidos:
  `backend/` (API Python), `frontend/` (Next.js), `specs/` (specs por feature),
  `.specify/` (constituição/templates), além dos docs de runtime na raiz
  (`PRODUCT.md`, `DESIGN.md`, `DOCUMENTATION.MD`). Nenhum código de aplicação MUST
  ficar solto na raiz.
- O **backend** MUST seguir camadas hierárquicas explícitas: `routers/` (HTTP) →
  `services/` (orquestração de caso de uso) → `domain/` (modelos + regras de
  negócio) → integrações de dados (`sheets/`, `auth/`). A dependência aponta para
  dentro: camada externa conhece a interna, **nunca** o contrário; `domain/` não
  importa `routers/`.
- O **frontend** MUST agrupar por papel/feição: `app/` (rotas), `components/`,
  `lib/`, `styles/`. Co-localizar o que muda junto; a pasta cresce por
  feição/domínio, não por acúmulo de "tipos soltos".
- Um arquivo MUST ter uma responsabilidade coesa e nome que a revele. A estrutura
  alvo é a de `specs/001-portal-parceiro/plan.md` — divergências MUST atualizar o
  plano (Princípio V).

**Organização em módulos/classes:**

- Estado + comportamento que andam juntos MUST ser encapsulados numa unidade coesa:
  modelos de domínio (Pydantic), serviços que representam um caso de uso, clientes
  de integração. Cada classe/módulo SHOULD ter responsabilidade única (SRP) e expor
  a menor interface pública possível.
- Composição MUST ser preferida a herança; herança só quando há relação "é-um" real
  — sem hierarquias profundas e frágeis montadas por conveniência.
- **Guardrail KISS (Princípio III):** NÃO criar classe ou camada só para envolver
  uma função pura. Regras sem estado (ex.: `status.py`, `scope.py`) PODEM ser
  módulos de funções; classe entra quando há estado ou variação a encapsular, não
  por cerimônia. Organização hierárquica serve à navegação e ao isolamento, não ao
  excesso de abstração.

**Racional:** estrutura previsível e camadas com direção de dependência explícita
tornam o código navegável, testável e auditável; concentram o ponto onde o
isolamento por `Contratante` (Princípio VI) é garantido e facilitam onboarding.

## Restrições Técnicas & Stack

- **Backend:** Python. **Frontend:** Next.js (pnpm). **Dados/Auth:** Supabase.
  **Deploy:** Frontend no **Vercel**; backend em **VPS própria com EasyPanel**
  (container Docker, uvicorn). Hosts separados.
- Fonte de verdade de produto: `PRODUCT.md`. Fonte de verdade visual:
  `DESIGN.md`. Estado/arquitetura corrente: `DOCUMENTATION.MD`.
- **Estrutura de pastas:** `backend/` e `frontend/` como diretórios de topo
  autocontidos; layout de referência em `specs/001-portal-parceiro/plan.md`
  (Princípio VII).
- Segredos e credenciais MUST viver apenas em variáveis de ambiente.

## Fluxo de Desenvolvimento

- Toda mudança MUST passar por lint/format automatizado antes do merge.
- Revisão de código MUST verificar conformidade com os princípios acima — em
  especial Isolamento de Dados (VI) em qualquer acesso a dados.
- Atualização de `DOCUMENTATION.MD` faz parte da definição de "pronto" (DoD)
  quando a mudança afeta arquitetura, setup ou decisões.
- Desvio justificado de um princípio MUST ser documentado (no PR e, se
  arquitetural, em `DOCUMENTATION.MD`) com o motivo.

## Governança

- Esta constituição prevalece sobre outras práticas em caso de conflito.
- **Idioma de trabalho:** toda comunicação com o autor do projeto é em
  **PT-BR**. Identificadores de código podem ser em inglês quando idiomático;
  documentação e comentários explicativos em PT-BR.
- **Emendas:** propostas por PR que altere este arquivo, com racional e impacto
  nos templates/docs dependentes listados no Sync Impact Report.
- **Versionamento (SemVer):**
  - MAJOR: remoção ou redefinição incompatível de princípio/governança.
  - MINOR: novo princípio/seção ou expansão material de orientação.
  - PATCH: esclarecimento, redação, correção sem mudança semântica.
- **Conformidade:** revisões e planos devem checar aderência a estes princípios;
  complexidade não justificada MUST ser simplificada ou explicitada.

**Versão:** 1.1.0 | **Ratificada em:** 2026-06-24 | **Última emenda:** 2026-06-25
