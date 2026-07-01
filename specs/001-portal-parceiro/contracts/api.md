# Contratos da API — Portal do Parceiro MedFlow

API Python (FastAPI). Único gateway de dados. **Toda** rota de dados exige JWT Supabase
(`Authorization: Bearer <token>`). O backend resolve `role` + `contratante` do token e
aplica isolamento (R-001) **antes** de responder. Respostas em JSON, valores monetários
como string decimal (`"1300.00"`) para evitar erro de float no cliente.

Convenções:
- `401` sem token / inválido · `403` papel sem permissão · `404` recurso inexistente.
- Escopo do parceiro é **sempre** o seu `contratante`; ele não pode passar outro.
- Paginação: `?limit=20&offset=0`; resposta traz `items`, `total`, `has_more`. O
  agrupamento por médico (RF-012) **nunca é cortado**: se o limite cair no meio de um
  grupo, a página estende até fechá-lo (pode devolver >20 itens).

---

## Auth / Sessão

### `GET /api/me`
Retorna o usuário atual (para header/menu de conta e roteamento de papel).
```json
{ "id":"uuid", "nome_exibicao":"AMA", "role":"parceiro", "contratante":"BESA Medical Group" }
```
- Gestor: `"role":"gestor"`, `"contratante":null`.

---

## Solicitações

### `GET /api/solicitacoes`
Lista paginada, escopada e filtrável (US2 / US5).

**Query params**:
| Param | Tipo | Default | Notas |
|---|---|---|---|
| `limit` | int | 20 | "Ver mais" soma offset |
| `offset` | int | 0 | |
| `q` | str | — | busca por código, cliente ou status (separada dos filtros) |
| *(filtros dinâmicos)* | vários | — | qualquer campo do registry da aba `solicitacoes` (ver §Filtros). Ex.: `status=atrasado`, `unidade=AMA,Fusam`, `valor=1000..5000`, `data_pedido=2025-11-01..2026-03-31`, `contratante=...` (só gestor) |

> **Mudança (spec 002)**: os antigos params `status` e `parceiros` foram absorvidos pelo
> sistema de **filtros dinâmicos**. `status` continua válido (é um campo do registry);
> `parceiros` foi substituído por `contratante` (multi, só-gestor). O escopo R-001 é
> aplicado **antes** dos filtros — o filtro de UI nunca amplia escopo.

**Resposta** (item). O parceiro vê a **lista-modelo** de campos (D5′); as **margens da
MedFlow** (`lucro_operacional`, `agio_base`) e `contratante`/`cor_parceiro` são exclusivas
da visão do gestor e **não aparecem** no payload do parceiro (strip no backend):
```json
{
  "items": [{
    "codigo": "AHG-159",                       // AAA-N: sigla da contratante + nº (data-model §1)
    "cliente": "Argélia Gomes Granjeiro de Souza",
    "valor": "2799.99",
    "recebido_cliente": "2505.52",
    "iof": "20.58",
    "juros_descontos": "274.47",            // Desconto (-IOF) — visível ao parceiro
    "taxa_juros_mes": "6.00",               // Taxa ao Mês, % (só exibição)
    "data_pedido": "2025-11-07",
    "prazo_dias": 53,
    "data_vencimento": "2025-12-30",
    "unidade": null,
    "cashback": "23.33",
    "status": "pago",
    "status_label": "Pago",
    "medico_grupo_id": "argelia-gomes...",   // agrupamento por médico (RF-012)
    "lucro_operacional": "180.00",          // gestor apenas — margem MedFlow (D5′)
    "agio_base": "0.00",                    // gestor apenas — margem MedFlow (D5′)
    "contratante": "A.H. GESTÃO MÉDICA",       // gestor apenas
    "cor_parceiro": "#e8e2f5"                  // gestor apenas (RF-023)
  }],
  "total": 13,
  "has_more": false
}
```

### `GET /api/solicitacoes/{codigo}`
Detalhe da solicitação + dados do médico (painel lateral, RF-013). Escopado por
Contratante. Enriquecido com `base de dados` (join por nome): inclui **todos** os campos
do médico — CPF, telefone, e-mail, PIX, nascimento — além do financeiro bruto (decisão do
usuário: tudo visível ao parceiro, dentro do seu escopo).
```json
{
  "solicitacao": { /* shape do item */ },
  "medico": { "nome":"...", "cpf":"...", "telefone":"...", "email":"...",
              "pix":"...", "pix_tipo":"...", "nascimento":"..." }
}
```

### `GET /api/parceiros/lista` *(gestor)*
Lista de `contratante` distintos + `cor` — alimenta o **acento de cor por linha** (RF-023).
O filtro por parceiro virou o chip `contratante` (ver §Filtros).
```json
[{ "contratante":"BESA Medical Group", "cor":"#e8e2f5", "total":22 }]
```

---

## Vencimentos

### `GET /api/vencimentos`
Cards + seções (US1 parceiro / RF-024 gestor).

**Query**: `?proximos=1sem` (`2d`|`1sem`|`2sem`, default `1sem`) + filtros dinâmicos da aba
`vencimentos` (ver §Filtros): `status`, `unidade`, `medico`, `valor`, `data_vencimento`,
`contratante` (só gestor). Aplicados após o escopo, antes da agregação/cards.

**Resposta (parceiro)**:
```json
{
  "cards": { "total_pendente":"52675.00", "em_atraso":"52675.00", "n_atrasadas":2, "n_a_pagar":0 },
  "unidades": [ /* uma linha por LOTE (unidade + data de vencimento): {unidade, data_vencimento, dias, vencido, a_vencer, total_pendente, tudo_pago, solicitacoes[]}. `dias`>0 = vencido (vermelho no front), <=0 a vencer. Unidade sem pendência vira UMA linha "tudo_pago" (data_vencimento/dias nulos, com todas as solicitações). Ordena unidades por pendência desc; dentro da unidade, lotes por data asc; tudo_pago no fim. Pagamento é por lote. */ ],
  "atrasados": [ /* itens (mesmo shape de solicitações) */ ],
  "proximos":  [ /* itens que vencem até o filtro */ ],
  "pagos":     [ /* solicitações pagas — status Pago (RF-017) */ ]
}
```

**Resposta (gestor)** — consolidado. Lista **todas** as contratantes (não só as com
pendência), ordenadas por `total_pendente` desc; quem tem 0 pendente vem por último com
`tudo_pago=true`. Cada contratante traz barra segmentada (`vencido`+`a_vencer`) e o dropdown
aninhado contratante → unidades → solicitações (RF-024):
```json
{
  "cards": { "solicitacoes_a_pagar": 23, "valor_total_a_receber":"123456.00" },  // a_pagar + atrasado
  "contratantes": [{
    "contratante": "BESA Medical Group",
    "vencido": "279292.43",        // Σ status atrasado
    "a_vencer": "0.00",            // Σ status a_pagar
    "total_pendente": "279292.43", // vencido + a_vencer (chave de ordenação)
    "tudo_pago": false,            // true ⇔ total_pendente == 0
    "unidades": [{
      "unidade": "UPA III - Ermelino",
      "total": "45000.00",         // Σ Originação de TODAS as solicitações da unidade (incl. pagas)
      "status": "atrasado",        // rollup worst-first: atrasado > a_pagar > pago
      "status_label": "Atrasado",
      "solicitacoes": [ /* item de solicitação (gestor, ver §Solicitações) */ ]
    }]
  }]
}
```

> Em uma carga só (decisão de produto): o gestor recebe contratantes+unidades+solicitações
> aninhadas; nada é lazy-loaded por dropdown. O rollup de status da unidade é **canônico no
> backend** (DRY) — o frontend não recalcula.
>
> **Futuro (fora do escopo atual)**: status `em_analise` por unidade + ação `POST` "Verificar
> Pagamento" (em_análise → pago). Depende de um gatilho ainda inexistente e de definir a
> persistência (a planilha é a verdade; o portal é read-only hoje). Ver `spec.md` RF-024.

---

## Visão Geral / Dashboard

### `GET /api/overview`
Métricas + série mensal (US4 parceiro / RF-021 gestor consolidado).

**Query** — recorte temporal por **toggle ano/mês** (RF-019): `?ano=aaaa` (default: ano
corrente) e, no modo "por mês", `?meses=1,2,...` (csv 1–12). Sem `meses` = ano inteiro.
Alternativamente, um **período de originação** via `?data_de=aaaa-mm-dd`/`?data_ate=aaaa-mm-dd`
(calendário de 2 meses, confirmado no front) restringe à **data de originação** (`data_pedido`)
dentro do intervalo **inclusivo** (bordas abertas quando um limite falta). Quando qualquer um
dos dois é informado, o período **substitui** o recorte `ano`/`meses`. Os `cards` e a `serie_mensal`
refletem esse recorte **mais** os **filtros dinâmicos** não-temporais da aba `overview`
(ver §Filtros): `status`, `unidade`, `contratante` (só gestor). A `serie_mensal` cobre os
meses do recorte (RF-020), formato `aaaa-mm`. `anos_disponiveis` lista os anos com dados
(alimenta o seletor de ano).

> **`total_cashback`** é o agregado do campo `cashback` (rótulo de produto: **Rebate**).
> **`ticket_medio`** = `valor_total` ÷ médicos distintos = média dos totais por médico
> (RF-019). O card "Comparativo" e o param `mes` foram **removidos**.
```json
{
  "cards": {
    "total_solicitacoes": 13, "valor_total":"124232.79", "total_cashback":"0.00",
    "ticket_medio":"62116.40", "em_aberto": 2, "pagas": 11, "medicos_impactados": 2
  },
  "serie_mensal": [{ "mes":"2026-01", "valor":"39000.00" }],
  "ano": 2026,
  "anos_disponiveis": [2026, 2025]
}
```
- Gestor: mesmos campos, somatório global.

---

## Administração de Parceiros *(somente gestor)*

### `GET /api/admin/parceiros`
Lista os logins de parceiros (RF-025).
```json
[{ "id":"uuid","email":"ama@...","nome_exibicao":"AMA","contratante":"BESA Medical Group","created_at":"..." }]
```

### `POST /api/admin/parceiros`
Cria login de parceiro (RF-026). Usa Supabase Admin (service role) no backend.
```json
// req
{ "email":"novo@parceiro.com", "nome_exibicao":"NEO Lorena", "contratante":"A.H. GESTÃO MÉDICA", "senha_inicial":"..." }
// 201 -> usuário criado
```

### `PUT /api/admin/parceiros/{id}`
Edita login (RF-027a): altera `nome_exibicao`/`contratante` vinculado e/ou redefine a
senha. Usa Supabase Admin (service role) no backend.
```json
// req (campos opcionais; enviar só o que muda)
{ "nome_exibicao":"NEO Lorena", "contratante":"MMR Serviços Médicos", "senha":"..." }
// 200 -> usuário atualizado
```

### `DELETE /api/admin/parceiros/{id}`
Remove login (RF-027); confirmação é no frontend. Invalida sessão do parceiro removido.

### `GET /api/admin/pendencias` *(gestor)*
Área **"Pendências de Dados"** (RF-033..037): solicitações reprovadas na validação, que
**não** aparecem em nenhum outro endpoint nem em métrica. Suporta `?q=` e paginação.
```json
{
  "items": [{
    "codigo": "512",
    "cliente": "Fulano de Tal",
    "contratante": null,
    "valor": "3100.00",
    "data_pedido": "2026-05-13",
    "data_vencimento": null,
    "linha_origem": 38,
    "motivos": ["Contratante faltando", "Data de Quitação ausente"]
  }],
  "total": 3,
  "has_more": false
}
```

**Guardas**: todas as rotas `/api/admin/*` exigem `role == gestor` (`403` caso contrário,
RF-028/034). Service role **nunca** trafega para o frontend.

> **Exclusão global**: todos os endpoints de dados (`/api/solicitacoes`, `/api/vencimentos`,
> `/api/overview`, e as variantes do gestor) operam **apenas sobre o dataset válido**;
> solicitações em pendência ficam fora de listas e de toda agregação (RF-035).

---

## Filtros dinâmicos *(spec 002-filtros-dinamicos)*

Filtros componíveis em todas as abas. Cada endpoint de dados aceita, além dos params
próprios, os **campos do registry** válidos para sua aba e papel. O backend aplica o
escopo R-001 **primeiro** e os filtros depois (AND). Convenção de serialização (mesma na
URL do front e na query da API):

| Tipo | Formato query | Exemplo |
|---|---|---|
| `multi` | csv | `status=atrasado,pago` · `unidade=AMA,Fusam` |
| `range` | `min..max` (bordas abertas) | `valor=1000..5000` · `cashback=..100` · `prazo_dias=30..` |
| `date` | `ini..fim` ISO (bordas abertas) | `data_pedido=2025-11-01..2026-03-31` |

Campos por aba (papel `gestor` adiciona `contratante`; `parceiro` recebe só o próprio escopo):

| Campo | Tipo | solicitacoes | vencimentos | overview |
|---|---|:--:|:--:|:--:|
| `status` | multi | ✓ | ✓ | ✓ |
| `unidade` | multi | ✓ | ✓ | ✓ |
| `medico` | multi | ✓ | ✓ | — |
| `valor` | range | ✓ | ✓ | — |
| `data_pedido` | date | ✓ | — | — |
| `data_vencimento` | date | ✓ | ✓ | — |
| `mes_originacao` | multi | ✓ | — | — |
| `mes_vencimento` | multi | ✓ | — | — |
| `cashback` | range | ✓ | — | — |
| `prazo_dias` | range | ✓ | — | — |
| `contratante` | multi (só gestor) | ✓ | ✓ | ✓ |

> A Visão Geral não usa mais chips temporais (`periodo`/`mes_originacao`); o recorte por
> tempo é o toggle ano/mês (`?ano`/`?meses`, ver §Visão Geral). Os campos `valor`/`cashback`
> são identificadores de contrato; os rótulos de UI são **Originação**/**Rebate**.

Params desconhecidos, fora da aba, não permitidos ao papel, ou malformados são **ignorados**
(filtro de UI não derruba a requisição).

### `GET /api/filtros/opcoes?aba=<solicitacoes|vencimentos|overview>`
Opções possíveis de cada campo da aba, **escopadas ao usuário** (R-001: o parceiro só
recebe as suas unidades/médicos/meses). Metadados estáticos (label, formato) vivem no
registry do frontend; aqui só os valores. `multi` → `opcoes[]`; `range`/`date` → `min`/`max`.
```json
{
  "campos": [
    { "id":"status", "tipo":"multi", "opcoes":["pago","a_pagar","atrasado"] },
    { "id":"unidade", "tipo":"multi", "opcoes":["AMA","Fusam"] },
    { "id":"valor", "tipo":"range", "min":"1300.00", "max":"32276.11" },
    { "id":"data_pedido", "tipo":"date", "min":"2025-11-07", "max":"2026-05-13" }
  ]
}
```
> As opções de `status` são as **chaves** (`pago`/`a_pagar`/`atrasado`). O rótulo de exibição
> é resolvido no frontend (`lib/format.ts → STATUS_LABEL`): **Pago / A Vencer / Vencido**.
> O `status_label` no payload das solicitações segue inalterado (uso interno/legado).
- `400` se `aba` inválida. Exige JWT como todas as rotas de dados.

---

## Erros (formato único)
```json
{ "error": { "code":"forbidden", "message":"Acesso restrito ao gestor." } }
```
Mensagens claras em pt-BR; nunca vazar detalhe de outro parceiro nem stack.
