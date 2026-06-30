"""T054 — gestor consolidado: somatório global correto + cor estável por parceiro."""

from datetime import date, timedelta
from decimal import Decimal

from app.domain.models import Solicitacao
from app.services.cores import cor_para
from app.services.vencimentos import vencimentos_gestor

HOJE = date(2026, 6, 25)
BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"


def _sol(contratante, codigo, status, valor, venc, unidade="U1"):
    return Solicitacao(
        codigo=codigo,
        quitado=(status == "pago"),
        cliente="Dr. X",
        valor=Decimal(valor),
        data_pedido=date(2026, 1, 1),
        data_vencimento=venc,
        contratante=contratante,
        unidade=unidade,
        status=status,
        status_label=status,
    )


def test_somatorio_global_e_ranking():
    dataset = [
        _sol(BESA, "1", "atrasado", "1000", HOJE - timedelta(days=2)),
        _sol(AH, "2", "atrasado", "5000", HOJE - timedelta(days=2)),
        _sol(BESA, "3", "a_pagar", "2000", HOJE + timedelta(days=5)),
        _sol(BESA, "4", "pago", "9999", HOJE - timedelta(days=30)),  # pago não conta no pendente
    ]
    out = vencimentos_gestor(dataset)
    # pendentes: 1000 + 5000 + 2000 = 8000; 3 solicitações
    assert out["cards"]["valor_total_a_receber"] == "8000.00"
    assert out["cards"]["solicitacoes_a_pagar"] == 3
    # ordena por total pendente desc: AH(5000) antes de BESA(1000+2000=3000)
    assert [c["contratante"] for c in out["contratantes"]] == [AH, BESA]
    besa = next(c for c in out["contratantes"] if c["contratante"] == BESA)
    assert besa["vencido"] == "1000.00"
    assert besa["a_vencer"] == "2000.00"
    assert besa["total_pendente"] == "3000.00"


def test_cor_estavel_por_parceiro():
    """Mesma entrada → mesma cor; entradas distintas tendem a cores distintas."""
    assert cor_para(BESA) == cor_para(BESA)
    assert cor_para(BESA).startswith("#")
    assert cor_para(" " + BESA + " ") == cor_para(BESA)  # trim não muda a cor
