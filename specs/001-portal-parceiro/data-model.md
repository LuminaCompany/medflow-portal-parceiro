# Modelo de Dados — Portal do Parceiro MedFlow (Fase 1)

Fonte financeira: **planilha Google Sheets** (3 abas, ver §0). Usuários/papéis: **Supabase**.
Nada financeiro é persistido em banco — o portal espelha a planilha em cache.

---

## 0. As 3 abas e seus papéis (decidido)

| Aba | Cols | ~Linhas | Papel no portal |
|---|---|---|---|
| **Dados Tratados** (`gid=278430548`) | 23 | 40 | **Fonte primária das solicitações**. Única com `QUITADO`, `Cashback`, `Unidade`, `Contratante`. O portal mostra o que está aqui (decisão do usuário) |
| **Cadastro de Clientes** | 3 | 137 | Mapa **Cliente→Contratante** (médico→parceiro). Referência p/ resolver/validar o parceiro e listar parceiros (7 distintos) |
| **base de dados** | 50 | 615 | Bruta do sistema de crédito. **Enriquece o painel de detalhes do médico** (PII completa). `funding_name`=MEDFLOW (não é parceiro); status só `ISSUED` (sem info de pagamento) |

**Decisões do usuário (2026-06-25)**:
- Universo de solicitações = **Dados Tratados** (cresce conforme a equipe trata mais linhas).
- **Visibilidade por papel (D5′, revisão 2026-06-25)**: o parceiro vê só a **lista-modelo**
  de colunas (Cliente, Originação, Recebido Cliente, IOF, Taxa ao Mês, Desconto (-IOF),
  Data Pedido, Prazo, Vencimento, Unidade Referência, Cashback + código e status). As
  **margens da MedFlow `Lucro Operacional` e `ÁGIO BASE` saem da visão do parceiro** (strip
  no backend); o **gestor mantém todas**. A **PII do médico** (CPF, PIX, e-mail, telefone,
  nascimento) **continua visível ao parceiro** no painel de detalhes.
- Isolamento (R-001) continua por **Contratante**; a máscara de margens é **ortogonal** ao
  escopo — um parceiro nunca vê dados (nem margens) de outro nem as margens do próprio.

---

## 1. Mapa de colunas (aba Dados Tratados) → modelo de domínio

23 colunas. Mapa para `Solicitacao` (expostas ao parceiro dentro do escopo, **exceto** as
margens marcadas "gestor apenas (D5′)"):

| # | Coluna planilha | Campo domínio | Tipo | Notas |
|---|---|---|---|---|
| 0 | Solicitação | `codigo` | str/int | nº cru da planilha; **exibido** como `AAA-N` (sigla da contratante + nº, ex.: `BES-1102`) — derivado no backend |
| 1 | QUITADO | `quitado` | bool | TRUE = pago (deriva status) |
| 2 | Cliente | `cliente` | str | nome do médico; linha vazia = resumo (descartar) |
| 3 | Originação | `valor` | Decimal | valor total da antecipação |
| 4 | Recebido Cliente | `recebido_cliente` | Decimal | |
| 5 | IOF | `iof` | Decimal | |
| 6 | Juros e Descontos | `juros_descontos` | Decimal | |
| 7 | Lucro Operacional | `lucro_operacional` | Decimal | **gestor apenas (D5′)** |
| 8 | Taxa de Juros (Mês) | `taxa_juros_mes` | Decimal% | |
| 9 | (sem nome) | — | — | ignorar |
| 10 | Data do Pedido | `data_pedido` | date | ISO `yyyy-mm-dd` |
| 11 | Mês de Originação | `mes_originacao` | str | `mm/aaaa` (agregação) |
| 12 | Data de Quitação | `data_vencimento` | date | **vencimento/prazo**; ISO |
| 13 | Mês de Vencimento | `mes_vencimento` | str | `mm/aaaa` |
| 14 | Prazo (Dias) | `prazo_dias` | int | |
| 15 | (sem nome) | — | — | ignorar |
| 16 | Contratante | `contratante` | str | **chave de isolamento (parceiro)** |
| 17 | Data Quitação Real | `data_quitacao_real` | date\|None | BR `dd/mm/aaaa`; só se pago |
| 18 | Dias de Diferença (atraso) | `dias_diferenca` | int\|None | pós-quitação |
| 19 | Unidade Referência | `unidade` | str\|None | sub-unidade da franquia; **pertence ao `contratante` da mesma linha** (§2.1) |
| 20 | OBS | `obs` | str\|None | |
| 21 | ÁGIO BASE | `agio_base` | Decimal | **gestor apenas (D5′)** |
| 22 | Cashback Parceiro | `cashback` | Decimal | R$ por solicitação; **rótulo de UI: Rebate** |

Status é **derivado** (§4), não vem direto da planilha.

## 1b. Painel de detalhes do médico (enriquecimento via `base de dados`)

Join por nome (`Cliente` ↔ `borrower_full_name`). Campos expostos ao parceiro (D5′: **PII
mantida**): CPF (`borrower_taxpayer_id`), telefone, e-mail, PIX (`borrower_pix_key` + tipo),
nascimento. As **margens da MedFlow no painel** (Lucro Operacional, ÁGIO) são **gestor-only**
e não chegam ao parceiro. **Atenção**: continua escopado ao parceiro dono do médico (via
Contratante).

---

## 2. Entidades

### `Solicitacao` (item de antecipação)
Campos conforme mapa acima + `status` derivado.

- **`status`**: `"pago" | "a_pagar" | "atrasado"` — calculado (ver §4).
- **Regras**: `valor`, `cashback`, `recebido_cliente`, `iof` ≥ 0; `data_vencimento`
  obrigatória para cálculo de status; linha sem `cliente` é descartada (resumo).

### 2.1 Vínculo `Unidade` → `Contratante`
Não há tabela de mapa. `unidade` (col 19) e `contratante` (col 16) ficam na **mesma linha**
de `Dados Tratados`. **Regra**: uma `Unidade` pertence ao `Contratante` que está na mesma
linha. Relação **1→N** (parceiro tem várias sub-unidades). Para listar unidades de um
parceiro: agrupar `unidade` distinta por `contratante` (com `_trim` em ambos, §5).

> **`unidade` é obrigatória (ADR 0001, 2026-06-26)**. Reverte a regra anterior: linha sem
> `unidade` agora é **pendência** (§6, motivo "Unidade Referência ausente"), não entra em
> `validas`. Garante que toda solicitação válida tem unidade — a aba Vencimentos do gestor
> agrupa por unidade dentro da contratante sem precisar de um grupo "Sem unidade".

### `Parceiro` (derivado de `Contratante`)
- `nome` (= valor de `Contratante`), `total_solicitacoes`, agregados. Fronteira de
  isolamento. No gestor recebe `cor` para agrupamento visual (RF-023).

### `AppUser` (Supabase **Auth** — sem tabela própria)
Os dados do usuário vêm de `auth.users`. **Não há tabela `app_users`** (removida): papel e
parceiro ficam no `app_metadata` do usuário.

| Campo | Origem | Notas |
|---|---|---|
| `id` | `auth.users.id` | uuid |
| `email` | `auth.users.email` | login |
| `role` | `app_metadata.role` | `parceiro`\|`gestor` — **só admin/service role edita** |
| `contratante` | `app_metadata.contratante` | casa com `Solicitacao.contratante`; null p/ gestor |
| `nome_exibicao` | `user_metadata.display_name` | mostrado no menu de conta |

- **Segurança (R-001)**: papel/contratante em `app_metadata` (não `user_metadata`) — o
  usuário **não** consegue alterar o próprio papel pela API pública. O backend valida o
  token via `auth.get_user` e lê o `app_metadata`. Admin (gestor) gerencia logins via Auth
  Admin API (service role no backend) ou pelo dashboard do Supabase — mesma fonte.

### `MetricasOverview` (derivado, por escopo)
`total_solicitacoes`, `valor_total`, `total_cashback`, `ticket_medio`, `em_aberto`,
`pagas`, `medicos_impactados`, `serie_mensal[]` (um ponto por mês), `ano`,
`anos_disponiveis[]`. No gestor = somatório global. Recorte temporal pelo toggle ano/mês
(`?ano`/`?meses`, RF-019). Rótulos de UI: `valor_total` → **Originação Total**;
`total_cashback` → **Total de Rebate**.

### `Vencimentos` (derivado)
`total_pendente` (a_pagar+atrasado), `em_atraso` (Σ atrasado), `n_atrasadas`,
`n_a_pagar`, e listas: `atrasados[]`, `proximos[]` (filtro 2d/1sem/2sem),
`pagos[]` (status Pago — todas as quitadas, RF-017).

---

## 3. Cálculos / Agregações

- **Total Pendente** = Σ `valor` onde `status ∈ {a_pagar, atrasado}`.
- **Em Atraso** = Σ `valor` onde `status == atrasado`.
- **Médicos impactados** = contagem distinta de `cliente` no escopo.
- **Em Aberto / Pagas** = contagem `status != pago` / `status == pago`.
- **Série mensal** = Σ `valor` por `mes_originacao` (ou mês de `data_pedido`); cobre os
  meses do **recorte temporal** (RF-020). Saída normalizada como `aaaa-mm`.
- **Ticket Médio** = `valor_total` ÷ médicos distintos no recorte (= média dos totais por
  médico). 0 médicos → `0.00` (RF-019).
- **Recorte temporal** (RF-019) = toggle "ano inteiro" (todos os meses de `ano`) vs. "por
  mês" (subconjunto de meses de `ano`); aplicado sobre `mes_originacao`.
- **Gestor consolidado** = mesmas fórmulas sem filtro de `contratante`.
- **Cards do gestor (Vencimentos)**: `solicitacoes_a_pagar` = nº de solicitações
  pendentes (a_pagar + atrasado); `valor_total_a_receber` = Σ `valor` pendente
  (a_pagar + atrasado) (RF-024).
- **Lista do gestor (Vencimentos)** = **todas** as contratantes (não só as com pendência),
  uma por linha, ordenadas por `total_pendente` (= `vencido` + `a_vencer`) **desc**; quem tem
  `total_pendente == 0` vem por último, marcado `tudo_pago` (RF-024). Cada contratante abre em
  **unidades**, e cada unidade abre em suas **solicitações** (todos os status).
  - **`vencido`** = Σ `valor` da contratante onde `status == atrasado`; **`a_vencer`** = Σ onde
    `status == a_pagar` (a barra é segmentada nesses dois).
  - **Total da unidade** = Σ `valor` (Originação) de **todas** as solicitações da unidade,
    incluindo pagas.
  - **Status da unidade** (rollup worst-first): `atrasado` se houver qualquer atrasada; senão
    `a_pagar` se houver qualquer pendente; senão `pago` (só quando todas quitadas). Fonte única
    no backend (DRY); o frontend não recalcula.
  - **Futuro (fora do escopo atual)**: 4º status `em_analise` por unidade + ação "Verificar
    Pagamento" (em_análise → pago). Bloqueado por gatilho inexistente e por definir persistência
    (planilha é a verdade; portal read-only hoje) — vira ADR quando construído.

Todos os valores monetários em `Decimal`; formatação de exibição (R$ pt-BR) na borda.

---

## 4. Máquina de status (fonte única — `domain/status.py`)

```
def status(quitado: bool, data_vencimento: date, hoje: date) -> str:
    if quitado:                      return "pago"
    if data_vencimento < hoje:       return "atrasado"
    return "a_pagar"                 # vencimento hoje => a_pagar
```

Rótulos de exibição: `pago→"Pago"`, `a_pagar→"A Pagar"`, `atrasado→"Atrasado"`.
Backend retorna `status` + `status_label` (DRY: frontend não recalcula).

---

## 5. Normalização (parser — entrada)

- **Moeda** `"R$ 1,300.00"` → `Decimal("1300.00")` (remove `R$`, espaços, `,` de milhar).
- **Data** ISO `yyyy-mm-dd` **ou** BR `dd/mm/yyyy` → `date` (tenta ISO, depois BR).
- **Bool** `QUITADO`: `"TRUE"`→True, vazio/`"FALSE"`→False.
- **Ignorar** a linha de **resumo/total** (sem código, sem cliente e sem valor).
- **Trim** em `contratante`/`unidade` para casar isolamento e agrupar.

---

## 6. Validação & Quarentena ("Pendências de Dados")

Após normalizar, cada solicitação passa por `domain/validation.py`. Falha em **qualquer**
regra obrigatória → a solicitação vai para a **quarentena** (gestor-only) e é **removida**
do dataset válido (some de toda outra visão/agregação — RF-033/035).

**Regras obrigatórias (cada falha gera um motivo legível)**:

| Regra | Motivo exibido |
|---|---|
| `cliente` vazio | "Cliente ausente" |
| `contratante` vazio | "Contratante faltando" |
| `cliente` não existe no `Cadastro de Clientes` (não resolve parceiro) | "Cliente sem cadastro" |
| `contratante` da linha ≠ `contratante` do cadastro do cliente | "Contratante divergente do cadastro" |
| `contratante` = `INDIVIDUAL` (médico sem franquia, sem login de parceiro) | "Médico sem franquia (INDIVIDUAL)" |
| `valor`/Originação ausente ou ≤ 0 ou não parseável | "Valor inválido" |
| `data_pedido` ausente/inválida | "Data do Pedido inválida" |
| `data_vencimento` (Data de Quitação) ausente/inválida | "Data de Quitação ausente" |
| `quitado=TRUE` sem `data_quitacao_real` | "Quitação sem data real" |
| `unidade` (Unidade Referência) ausente/vazia | "Unidade Referência ausente" (ADR 0001) |

> A regra de "Contratante divergente" usa `Cadastro de Clientes` como verdade do vínculo
> médico→parceiro; protege o isolamento (R-001) contra erro de digitação na aba tratada.

**Entidade `Pendencia`** (resposta da área):
```
codigo, cliente, contratante (se houver), valor (se houver),
data_pedido (se houver), data_vencimento (se houver),
motivos: list[str]            # 1+ motivos
linha_origem: int             # nº da linha na planilha, p/ o gestor achar rápido
```

**Particionamento do dataset** (no serviço, após cache):
```
validas, pendencias = particiona(solicitacoes_normalizadas)
# todas as features (parceiro e gestor) usam `validas`
# /api/admin/pendencias usa `pendencias`
```

**Reentrada**: ao recarregar (fim do TTL) com a fonte corrigida, a solicitação reentra em
`validas` automaticamente (RF-037) — sem estado persistido no portal.
