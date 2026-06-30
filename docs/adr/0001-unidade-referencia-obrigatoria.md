# Unidade Referência passa a ser obrigatória

**Status:** accepted (2026-06-26) — reverte a decisão original de `data-model §2.1` que
tratava `unidade = None` como válida.

Para a aba Vencimentos do gestor, toda solicitação é agrupada por **Unidade** dentro da
sua **Contratante** (dropdown contratante → unidades → solicitações). Para garantir esse
invariante sem um grupo-fantasma "Sem unidade", decidimos tornar **Unidade Referência um
campo obrigatório**: solicitação válida com unidade vazia agora vai para a **quarentena**
(`domain/validation.py`), com o motivo "Unidade Referência ausente".

## Consequences

- Qualquer solicitação hoje **válida mas sem unidade** sai de **todas** as visões e passa a
  aparecer só na área de Pendências do gestor (RF-033/035) até a fonte ser corrigida —
  self-healing na próxima carga, como as demais regras.
- O agrupamento por Unidade (back e front) pode assumir `unidade` sempre presente no dataset
  válido; não há caminho "Sem unidade".
