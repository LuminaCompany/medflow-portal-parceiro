"""T033 — vencimentos: agregação correta + escopo por Contratante (R-001)."""

from datetime import date, timedelta
from decimal import Decimal

from app.domain.models import AppUser, Solicitacao
from app.services.vencimentos import vencimentos_gestor, vencimentos_parceiro

HOJE = date(2026, 6, 25)


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


BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"

DATASET = [
    _sol(BESA, "1", "atrasado", "1000", HOJE - timedelta(days=3)),
    _sol(BESA, "2", "a_pagar", "500", HOJE + timedelta(days=3)),
    _sol(BESA, "3", "pago", "700", HOJE - timedelta(days=10)),
    _sol(AH, "4", "atrasado", "9999", HOJE - timedelta(days=1)),
]


def _user(role, contratante):
    return AppUser(id="u", email="e@e", role=role, contratante=contratante, nome_exibicao="N")


def test_cards_parceiro_agrega_so_o_proprio():
    out = vencimentos_parceiro(DATASET, _user("parceiro", BESA), proximos="1sem", hoje=HOJE)
    # total_pendente = atrasado(1000) + a_pagar(500) = 1500; em_atraso = 1000
    assert out["cards"]["total_pendente"] == "1500.00"
    assert out["cards"]["em_atraso"] == "1000.00"
    assert out["cards"]["n_atrasadas"] == 1
    assert out["cards"]["n_a_pagar"] == 1


def test_parceiro_nao_ve_outro_contratante():
    out = vencimentos_parceiro(DATASET, _user("parceiro", BESA), hoje=HOJE)
    codigos = {i["codigo"] for i in out["atrasados"] + out["proximos"] + out["pagos"]}
    assert "4" not in codigos  # solicitação de AH nunca aparece


def test_parceiro_unidades_segmentadas_e_escopadas():
    dataset = [
        _sol(BESA, "1", "atrasado", "1000", HOJE - timedelta(days=3), unidade="UA"),
        _sol(BESA, "2", "a_pagar", "500", HOJE + timedelta(days=3), unidade="UA"),
        _sol(BESA, "3", "pago", "700", HOJE - timedelta(days=10), unidade="UB"),
        _sol(AH, "4", "atrasado", "9999", HOJE - timedelta(days=1), unidade="UX"),
    ]
    out = vencimentos_parceiro(dataset, _user("parceiro", BESA), hoje=HOJE)
    unidades = {u["unidade"]: u for u in out["unidades"]}
    # unidade de AH nunca aparece (escopo R-001)
    assert "UX" not in unidades
    # UA: vencido(1000) + a_vencer(500) = pendente 1500
    assert unidades["UA"]["vencido"] == "1000.00"
    assert unidades["UA"]["a_vencer"] == "500.00"
    assert unidades["UA"]["total_pendente"] == "1500.00"
    assert unidades["UA"]["tudo_pago"] is False
    # UB: só paga → tudo_pago, pendente 0
    assert unidades["UB"]["tudo_pago"] is True
    assert unidades["UB"]["total_pendente"] == "0.00"
    # ordena por pendência desc: UA (1500) antes de UB (0)
    assert [u["unidade"] for u in out["unidades"]] == ["UA", "UB"]
    # parceiro não recebe campos de gestor nas solicitações
    assert "lucro_operacional" not in out["unidades"][0]["solicitacoes"][0]


def test_proximos_respeita_janela():
    # vence em 3 dias → entra em 1sem, não em 2d
    out_2d = vencimentos_parceiro(DATASET, _user("parceiro", BESA), proximos="2d", hoje=HOJE)
    out_1sem = vencimentos_parceiro(DATASET, _user("parceiro", BESA), proximos="1sem", hoje=HOJE)
    assert len(out_2d["proximos"]) == 0
    assert len(out_1sem["proximos"]) == 1


def test_gestor_consolida_e_ranqueia():
    out = vencimentos_gestor(DATASET)
    # pendentes: 1000(BESA) + 500(BESA) + 9999(AH) = 11499; 3 solicitações
    assert out["cards"]["solicitacoes_a_pagar"] == 3
    assert out["cards"]["valor_total_a_receber"] == "11499.00"
    # ordena por total pendente desc: AH(9999) antes de BESA(1500)
    nomes = [c["contratante"] for c in out["contratantes"]]
    assert nomes == [AH, BESA]
    besa = next(c for c in out["contratantes"] if c["contratante"] == BESA)
    assert besa["vencido"] == "1000.00"  # 1 atrasada
    assert besa["a_vencer"] == "500.00"  # 1 a_pagar
    assert besa["total_pendente"] == "1500.00"
    assert besa["tudo_pago"] is False


def test_gestor_lista_todas_contratantes_tudo_pago_no_fim():
    dataset = [
        _sol(BESA, "1", "atrasado", "1000", HOJE - timedelta(days=2)),
        _sol(AH, "2", "pago", "700", HOJE - timedelta(days=5)),  # AH tudo pago
    ]
    out = vencimentos_gestor(dataset)
    nomes = [c["contratante"] for c in out["contratantes"]]
    assert nomes == [BESA, AH]  # AH (tudo pago, 0 pendente) por último
    ah = out["contratantes"][-1]
    assert ah["contratante"] == AH
    assert ah["tudo_pago"] is True
    assert ah["total_pendente"] == "0.00"


def test_gestor_rollup_status_unidade_worst_first():
    dataset = [
        _sol(BESA, "1", "atrasado", "100", HOJE - timedelta(days=2), unidade="UA"),
        _sol(BESA, "2", "a_pagar", "200", HOJE + timedelta(days=2), unidade="UA"),
        _sol(BESA, "3", "pago", "300", HOJE - timedelta(days=9), unidade="UA"),
    ]
    out = vencimentos_gestor(dataset)
    unidade = out["contratantes"][0]["unidades"][0]
    assert unidade["unidade"] == "UA"
    assert unidade["status"] == "atrasado"  # qualquer atraso vence o rollup
    # total da unidade = Σ Originação de TODAS (incl. paga): 100+200+300
    assert unidade["total"] == "600.00"
    assert len(unidade["solicitacoes"]) == 3


def test_gestor_unidade_pago_so_se_todas_pagas():
    dataset = [
        _sol(BESA, "1", "pago", "100", HOJE - timedelta(days=2), unidade="UA"),
        _sol(BESA, "2", "a_pagar", "200", HOJE + timedelta(days=2), unidade="UB"),
    ]
    out = vencimentos_gestor(dataset)
    unidades = {u["unidade"]: u for u in out["contratantes"][0]["unidades"]}
    assert unidades["UA"]["status"] == "pago"  # todas pagas
    assert unidades["UB"]["status"] == "a_pagar"  # pendente
