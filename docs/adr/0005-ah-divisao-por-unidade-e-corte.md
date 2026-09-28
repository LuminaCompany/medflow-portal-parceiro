# A.H. GESTÃO MÉDICA: divisão PA/PS pela observação + corte de vencimento

**Status:** accepted (2026-09-28) — feature 014. Regras **exclusivas** da Contratante
A.H. GESTÃO MÉDICA; nenhuma outra Contratante muda. Decidido com o Matheus (MedFlow) em reunião
(`docs/Transcrição-reunião-sobre AH GESTÃO MEDICA`) e com o Lucas na implementação.

## Contexto

1. A AH paga **Pronto Atendimento (PA)** e **Pronto Socorro (PS)** separadamente. O atendimento
   normalmente lança uma linha por unidade (`Unidade Referência` = `PA Lorena`/`PS Lorena`), mas
   às vezes a operação de um médico sai numa linha só: a Unidade fica **vazia** e a divisão vai
   na coluna **OBS** — com valor (`"PA (175) e PS (1550)"`, `"PS (4.650,00) e PA (5.200,00)"`,
   `"PA 350 e PS 7200"`…) ou sem (`"PA e PS"`). Sem Unidade a linha caía em Pendências
   ("Unidade Referência ausente") e sumia do parceiro.
2. A MedFlow **não consegue** abrir linha nova na planilha (desconfigura a planilha-mãe).
3. A AH está há mais de um ano na MedFlow; mostrar todo o histórico ao parceiro seria bagunça.
   Acordado: o parceiro só vê o que **vence a partir de 05/10/2026** (inclusive).

## Decisão

**O portal reparte a linha na leitura (nunca escreve no sheet) e recorta o parceiro por data.**

1. **Regras num ponto só** — `domain/regras_contratante.py`: corte `05/10/2026` e mapa de siglas
   `PA→PA Lorena`, `PS→PS Lorena`. Lookup por chave tolerante (sem acento/pontuação); o
   isolamento continua comparando a string exata em `scope.py` — a regra nunca concede acesso.
2. **Linha AH, vencimento ≥ corte, Unidade vazia e sem outro problema** → `domain/divisao.py`:
   - OBS com valores que somam a Originação (tolerância R$ 1,00 — há Originações como 5.399,99
     para "3.350 + 2.050"; a diferença vai para a maior parte) → vira **N solicitações**, uma por
     unidade. Um valor só ("PA (350) e PS") → a outra leva o restante. Sigla única sem valor
     ("PS") → a linha inteira é daquela unidade.
   - Os demais campos em dinheiro (cashback/rebate, IOF, recebido, juros, lucro, ágio) são
     **rateados** na proporção da Originação; a última parte absorve o arredondamento (a soma
     sempre bate com a linha original).
   - Leitor **tolerante** (caixa, `P.A.`, `PA:350`, `PA-350`, `PA=R$ 350`, `PA350`, moeda BR ou
     US, parênteses de comentário como "(safra de 10.07 …)") e que **falha fechado**: sobrou texto
     não entendido (NEO, UTI, "avaliar", "OK"…), sigla repetida, soma que não bate ou OBS vazia →
     **pendência de divisão**. Nunca inventa uma repartição.
   - Só PA/PS são automáticos (decisão do Lucas: após o corte não se espera NEO/UTI; se vier,
     cai no manual e o gestor escolhe a unidade).
3. **Pendência de divisão** (novo "status" em Pendências, seção própria no topo): o gestor
   informa unidades + valores no portal. Fica salvo na tabela `divisoes_unidade`
   (service role, RLS deny-all; chave `(contratante, código de origem da coluna A)` — o código do
   CRM, estável e único). A divisão salva **vence** a OBS e congela a Originação (`valor_total`):
   se o sheet mudar o valor, deixa de valer e a linha volta à pendência — nunca reparte valor
   errado. "Desfazer" apaga a divisão. Unidades escolhíveis = as da própria Contratante no sheet +
   PA/PS Lorena. Contratante/código/valor vêm SEMPRE da pendência no dataset, nunca do corpo.
4. **Corte de vencimento** (`filtra_por_escopo`): o parceiro AH só recebe itens com
   `data_vencimento ≥ 05/10/2026` (sem data → fora, falha fechada). O **gestor mantém o
   histórico** (dashboard/solicitações/vencimentos). Anterior ao corte: pendências da AH **somem**
   da quarentena e lotes não entram em "Falta aviso" (o parceiro não os vê, logo não há o que
   fazer com eles); as regras de divisão não se aplicam (histórico segue como estava).

## Consequências

- Uma linha repartida gera 2+ códigos `AHG-…` consecutivos (sequência por data do pedido e linha
  de origem, desempate pela ordem das partes).
- Salvar/desfazer invalida o dataset (reload imediato). O `TTLCache` ganhou geração: um refresh
  em background que começou antes do `invalidate()` não grava por cima.
- Se o Postgres cair, a carga do sheet segue com o **último mapa bom** de divisões.
- Migration `supabase/migrations/20260928_divisoes_unidade.sql` é aplicada manualmente. Sem ela
  o portal funciona (divisões automáticas pela OBS incluídas), só o salvar manual falha.
- Mudar a data de corte ou as siglas = editar `regras_contratante.py` (não há UI; KISS — pedido
  pontual de um parceiro).
