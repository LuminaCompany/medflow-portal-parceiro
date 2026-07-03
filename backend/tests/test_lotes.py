"""domain/lotes — totais do lote (fonte única do snapshot do aviso e da linha de Vencimentos)."""

from datetime import date
from decimal import Decimal

from app.domain.lotes import totais_do_lote
from app.domain.models import Solicitacao


def _sol(status, valor, cashback="0"):
    return Solicitacao(
        codigo=f"C{valor}",
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


def test_totais_somam_so_pendentes():
    sols = [_sol("atrasado", "1000", "150"), _sol("a_pagar", "500", "50"), _sol("pago", "700", "70")]
    t = totais_do_lote(sols, rebate_ativo=True)
    assert t.valor == Decimal("1500")  # paga fora
    assert t.rebate == Decimal("200")  # 150 + 50
    assert t.valor_a_pagar == Decimal("1300")
    assert set(t.codigos) == {"C1000", "C500"}


def test_sem_servico_zera_rebate():
    t = totais_do_lote([_sol("atrasado", "1000", "150")], rebate_ativo=False)
    assert t.rebate == Decimal("0")
    assert t.valor_a_pagar == Decimal("1000")


def test_lote_so_pagas_fica_vazio():
    t = totais_do_lote([_sol("pago", "700", "70")], rebate_ativo=True)
    assert t.codigos == [] and t.valor == Decimal("0") and t.rebate == Decimal("0")
