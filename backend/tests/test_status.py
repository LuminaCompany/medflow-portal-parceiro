"""T020 — status: pago/atrasado/a_pagar; vencimento hoje = a_pagar."""

from datetime import date

from app.domain.status import (
    STATUS_A_PAGAR,
    STATUS_ATRASADO,
    STATUS_PAGO,
    casa_busca_status,
    status,
    status_label,
)

HOJE = date(2026, 6, 25)


def test_quitado_eh_pago():
    assert status(True, date(2026, 1, 1), HOJE) == STATUS_PAGO
    # quitado prevalece mesmo com vencimento futuro
    assert status(True, date(2030, 1, 1), HOJE) == STATUS_PAGO


def test_vencido_eh_atrasado():
    assert status(False, date(2026, 6, 24), HOJE) == STATUS_ATRASADO


def test_futuro_eh_a_pagar():
    assert status(False, date(2026, 6, 26), HOJE) == STATUS_A_PAGAR


def test_vencimento_hoje_eh_a_pagar():
    """Borda crítica: vencimento hoje conta como A Pagar, não Atrasado (research D4)."""
    assert status(False, HOJE, HOJE) == STATUS_A_PAGAR


def test_labels():
    assert status_label(STATUS_PAGO) == "Pago"
    assert status_label(STATUS_A_PAGAR) == "A Pagar"
    assert status_label(STATUS_ATRASADO) == "Atrasado"


def test_busca_status_casa_rotulos_da_ui():
    """O usuário busca o que VÊ: 'vencido'→atrasado, 'a vencer'→a_pagar (rótulos do front)."""
    assert casa_busca_status(STATUS_ATRASADO, "vencido")
    assert casa_busca_status(STATUS_A_PAGAR, "a vencer")
    assert casa_busca_status(STATUS_PAGO, "pago")
    # a chave interna também casa
    assert casa_busca_status(STATUS_ATRASADO, "atrasado")
    # não casa termo de outro status
    assert not casa_busca_status(STATUS_PAGO, "vencido")
