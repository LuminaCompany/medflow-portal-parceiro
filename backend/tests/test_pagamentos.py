"""Feature 004/005 — snapshot do aviso de pagamento: total pendente + rebate congelados.

O rebate (Σ cashback das pendentes do lote) só é abatido quando a Contratante tem o serviço
(feature 005); pagas nunca entram no snapshot. Sem rede — funções puras de domínio.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.domain.models import Solicitacao
from app.services.pagamentos import PagamentoAvisoError, snapshot_lote


def _sol(codigo, status, valor, cashback="0"):
    return Solicitacao(
        codigo=codigo,
        quitado=(status == "pago"),
        cliente="Dr. X",
        valor=Decimal(valor),
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        contratante="BESA",
        unidade="UA",
        status=status,
        status_label=status,
        cashback=Decimal(cashback),
    )


def test_snapshot_rebate_ativo_soma_cashback_das_pendentes():
    sols = [
        _sol("1", "atrasado", "1000", "150"),
        _sol("2", "a_pagar", "500", "50"),
        _sol("3", "pago", "700", "70"),  # paga: fora do snapshot (valor e rebate)
    ]
    valor, rebate, codigos = snapshot_lote(sols, rebate_ativo=True)
    assert valor == Decimal("1500")  # só pendentes
    assert rebate == Decimal("200")  # 150 + 50 (a paga não conta)
    assert set(codigos) == {"1", "2"}


def test_snapshot_sem_servico_zera_rebate():
    sols = [_sol("1", "atrasado", "1000", "150")]
    valor, rebate, codigos = snapshot_lote(sols, rebate_ativo=False)
    assert valor == Decimal("1000")
    assert rebate == Decimal("0")  # paga a Originação cheia


def test_snapshot_sem_pendentes_levanta_erro():
    sols = [_sol("3", "pago", "700", "70")]
    with pytest.raises(PagamentoAvisoError):
        snapshot_lote(sols, rebate_ativo=True)


def test_snapshot_rebate_maior_que_valor_bloqueia():
    """Rebate > Originação (cashback digitado errado) → bloqueia (Valor a Pagar negativo, ADR 0004)."""
    sols = [_sol("1", "atrasado", "100", "150")]  # cashback 150 > valor 100
    with pytest.raises(PagamentoAvisoError):
        snapshot_lote(sols, rebate_ativo=True)


def test_snapshot_rebate_maior_que_valor_ok_sem_servico():
    """Sem serviço de rebate, o cashback alto é ignorado (rebate=0) — não bloqueia."""
    sols = [_sol("1", "atrasado", "100", "150")]
    valor, rebate, _ = snapshot_lote(sols, rebate_ativo=False)
    assert valor == Decimal("100") and rebate == Decimal("0")
