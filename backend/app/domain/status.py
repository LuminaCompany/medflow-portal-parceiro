"""Regra de status de pagamento — FONTE ÚNICA (research D4, data-model §4).

Centralizar evita divergência entre abas/endpoints (DRY). O backend devolve o status
já calculado + rótulo de exibição; o frontend nunca recalcula lógica financeira.
"""

from datetime import date

# Chaves internas de status
STATUS_PAGO = "pago"
STATUS_A_PAGAR = "a_pagar"
STATUS_ATRASADO = "atrasado"

# Rótulos de exibição (pt-BR) — borda de apresentação.
STATUS_LABELS: dict[str, str] = {
    STATUS_PAGO: "Pago",
    STATUS_A_PAGAR: "A Pagar",
    STATUS_ATRASADO: "Atrasado",
}


def status(quitado: bool, data_vencimento: date, hoje: date) -> str:
    """Deriva o status corrente de uma solicitação.

    - `quitado` (QUITADO == TRUE) → pago.
    - não quitado e vencimento no passado → atrasado.
    - não quitado e vencimento hoje ou futuro → a_pagar (vencimento hoje conta como a_pagar).
    """
    if quitado:
        return STATUS_PAGO
    if data_vencimento < hoje:
        return STATUS_ATRASADO
    return STATUS_A_PAGAR


def status_label(status_key: str) -> str:
    """Rótulo de exibição para um status interno."""
    return STATUS_LABELS.get(status_key, status_key)
