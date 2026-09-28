"""Regras específicas por Contratante (feature 014) — hoje só a A.H. GESTÃO MÉDICA.

A AH paga Pronto Atendimento (PA) e Pronto Socorro (PS) SEPARADOS. O normal é o atendimento
lançar uma linha por unidade (Unidade Referência = "PA Lorena"/"PS Lorena"), mas às vezes a
operação sai numa linha só, com a Unidade vazia e a divisão escrita na coluna OBS. O portal
reparte essa linha (ver `domain/divisao.py`) — a planilha não pode ganhar linha nova.

Além disso, o parceiro AH só enxerga no portal o que vence a partir de `VENCIMENTO_INICIO`
(corte aplicado no escopo do parceiro, `domain/scope.py`). O gestor mantém o histórico, mas
pendências anteriores ao corte deixam de aparecer (não há o que fazer com elas).

Ponto ÚNICO dessas regras: nenhuma outra Contratante é afetada.
"""

import unicodedata
from datetime import date

CONTRATANTE_AH = "A.H. GESTÃO MÉDICA"


def chave_contratante(nome: str | None) -> str:
    """Chave tolerante (sem acento/pontuação/espaço, MAIÚSCULAS): "A.H GESTAO MEDICA" = AH.

    Só serve para localizar a REGRA. O isolamento continua comparando a string exata
    (`scope.py`) — a regra nunca concede acesso a nada.
    """
    if not nome:
        return ""
    sem_acento = unicodedata.normalize("NFKD", str(nome)).encode("ascii", "ignore").decode()
    return "".join(c for c in sem_acento.upper() if c.isalnum())


_CHAVE_AH = chave_contratante(CONTRATANTE_AH)

# Vencimento mínimo exibido ao parceiro (inclusive): 1º ciclo acordado com a MedFlow.
_VENCIMENTO_INICIO: dict[str, date] = {_CHAVE_AH: date(2026, 10, 5)}

# Sigla escrita na OBS → Unidade Referência. Todas as unidades PA/PS da AH são de Lorena.
_SIGLAS_UNIDADE: dict[str, dict[str, str]] = {
    _CHAVE_AH: {"PA": "PA Lorena", "PS": "PS Lorena"},
}


def vencimento_inicio(contratante: str | None) -> date | None:
    """Corte de vencimento do parceiro (None = sem corte, vê tudo)."""
    return _VENCIMENTO_INICIO.get(chave_contratante(contratante))


def antes_do_corte(contratante: str | None, data_vencimento: date | None) -> bool:
    """True se a linha é anterior ao corte da Contratante (legado fora do portal do parceiro)."""
    corte = vencimento_inicio(contratante)
    return corte is not None and data_vencimento is not None and data_vencimento < corte


def siglas_unidade(contratante: str | None) -> dict[str, str] | None:
    """Mapa sigla→unidade p/ repartir linha sem Unidade (None = Contratante sem a regra)."""
    return _SIGLAS_UNIDADE.get(chave_contratante(contratante))
