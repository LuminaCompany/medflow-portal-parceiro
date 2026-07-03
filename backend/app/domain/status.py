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


def is_pending(status_key: str) -> bool:
    """Pendente de pagamento (a vencer OU vencida). FONTE ÚNICA da regra de "pendente" —
    antes duplicada como `_pendente` em vencimentos.py e pagamentos.py (Princípio II)."""
    return status_key in (STATUS_A_PAGAR, STATUS_ATRASADO)


# Aliases de BUSCA por status. O usuário digita o que VÊ na tela, e a UI renomeia
# a_pagar→"A Vencer" e atrasado→"Vencido" (frontend/src/lib/format.ts, CONTEXT.md). A busca é
# server-side, então precisamos casar esses rótulos aqui. Duplicação consciente de fronteira
# (Princípio II): manter em sincronia com STATUS_LABEL do frontend.
STATUS_SEARCH_ALIASES: dict[str, tuple[str, ...]] = {
    STATUS_PAGO: ("pago",),
    STATUS_A_PAGAR: ("a pagar", "a vencer"),
    STATUS_ATRASADO: ("atrasado", "vencido"),
}


def casa_busca_status(status_key: str, termo: str) -> bool:
    """True se `termo` (já em minúsculas) casa a chave ou um rótulo/alias de busca do status."""
    if termo in status_key:
        return True
    return any(termo in alias for alias in STATUS_SEARCH_ALIASES.get(status_key, ()))
