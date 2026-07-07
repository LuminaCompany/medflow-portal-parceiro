"""T033 — vencimentos: agregação correta + escopo por Contratante (R-001)."""

from datetime import date, timedelta
from decimal import Decimal

from app.domain.models import AppUser, Solicitacao
from app.services.vencimentos import vencimentos_gestor, vencimentos_parceiro

HOJE = date(2026, 6, 25)


def _sol(contratante, codigo, status, valor, venc, unidade="U1", cashback="0"):
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
        cashback=Decimal(cashback),
    )


BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"

DATASET = [
    _sol(BESA, "1", "atrasado", "1000", HOJE - timedelta(days=3)),
    _sol(BESA, "2", "a_pagar", "500", HOJE + timedelta(days=3)),
    _sol(BESA, "3", "pago", "700", HOJE - timedelta(days=10)),
    _sol(AH, "4", "atrasado", "9999", HOJE - timedelta(days=1)),
]


def _user(role, contratante, rebate_ativo=False):
    return AppUser(
        id="u",
        email="e@e",
        role=role,
        contratante=contratante,
        nome_exibicao="N",
        rebate_ativo=rebate_ativo,
    )


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


def test_parceiro_lotes_por_unidade_e_data_e_escopo():
    venc_atraso = HOJE - timedelta(days=3)
    venc_futuro = HOJE + timedelta(days=3)
    dataset = [
        # UA: mesma unidade, dois vencimentos diferentes → DOIS lotes separados.
        _sol(BESA, "1", "atrasado", "1000", venc_atraso, unidade="UA"),
        _sol(BESA, "2", "a_pagar", "500", venc_futuro, unidade="UA"),
        _sol(BESA, "3", "pago", "700", HOJE - timedelta(days=10), unidade="UB"),
        _sol(AH, "4", "atrasado", "9999", HOJE - timedelta(days=1), unidade="UX"),
    ]
    out = vencimentos_parceiro(dataset, _user("parceiro", BESA), hoje=HOJE)
    linhas = out["unidades"]
    # unidade de AH nunca aparece (escopo R-001)
    assert all(l["unidade"] != "UX" for l in linhas)

    # UA gera dois lotes (um por data de vencimento).
    lotes_ua = [l for l in linhas if l["unidade"] == "UA"]
    assert len(lotes_ua) == 2
    por_data = {l["data_vencimento"]: l for l in lotes_ua}
    # Lote vencido (24/06): só vencido, dias > 0 (atraso).
    venc = por_data[venc_atraso.isoformat()]
    assert venc["vencido"] == "1000.00"
    assert venc["a_vencer"] == "0.00"
    assert venc["total_pendente"] == "1000.00"
    assert venc["dias"] == 3
    assert venc["tudo_pago"] is False
    # Lote a vencer (futuro): só a_vencer, dias < 0.
    fut = por_data[venc_futuro.isoformat()]
    assert fut["a_vencer"] == "500.00"
    assert fut["total_pendente"] == "500.00"
    assert fut["dias"] == -3

    # UB: só paga → linha única "Tudo pago" (sem data).
    ub = next(l for l in linhas if l["unidade"] == "UB")
    assert ub["tudo_pago"] is True
    assert ub["data_vencimento"] is None
    assert ub["total_pendente"] == "0.00"

    # ordena lotes por vencimento asc (vencido há mais tempo no topo); "Tudo pago" (UB) no fim.
    assert [l["unidade"] for l in linhas] == ["UA", "UA", "UB"]
    assert lotes_ua[0]["data_vencimento"] == venc_atraso.isoformat()
    # parceiro não recebe campos de gestor nas solicitações
    assert "lucro_operacional" not in venc["solicitacoes"][0]


def test_parceiro_lotes_ordenados_vencido_ha_mais_tempo_no_topo():
    """Vencido há mais tempo (menor data) no topo, independente da unidade; pago no fim."""
    dataset = [
        _sol(BESA, "1", "a_pagar", "500", HOJE + timedelta(days=5), unidade="UZ"),
        _sol(BESA, "2", "atrasado", "100", HOJE - timedelta(days=2), unidade="UB"),
        _sol(BESA, "3", "atrasado", "9000", HOJE - timedelta(days=30), unidade="UA"),
        _sol(BESA, "4", "pago", "700", HOJE - timedelta(days=1), unidade="UC"),
    ]
    linhas = vencimentos_parceiro(dataset, _user("parceiro", BESA), hoje=HOJE)["unidades"]
    # UA (-30d) mais vencido → topo; depois UB (-2d); UZ a vencer; UC "Tudo pago" no fim.
    assert [l["unidade"] for l in linhas] == ["UA", "UB", "UZ", "UC"]
    assert linhas[-1]["tudo_pago"] is True


def test_parceiro_rebate_ativo_expoe_valor_a_pagar():
    """Feature 005: Contratante com serviço → lote traz rebate (Σ cashback) e valor_a_pagar."""
    venc = HOJE - timedelta(days=3)
    dataset = [
        _sol(BESA, "1", "atrasado", "1000", venc, unidade="UA", cashback="150"),
        _sol(BESA, "2", "atrasado", "500", venc, unidade="UA", cashback="50"),
    ]
    out = vencimentos_parceiro(dataset, _user("parceiro", BESA, rebate_ativo=True), hoje=HOJE)
    lote = next(l for l in out["unidades"] if l["unidade"] == "UA")
    assert lote["total_pendente"] == "1500.00"  # Originação cheia
    assert lote["rebate"] == "200.00"  # 150 + 50
    assert lote["valor_a_pagar"] == "1300.00"  # 1500 − 200


def test_parceiro_sem_servico_paga_originacao_cheia():
    """Sem o serviço, o cashback não abate: rebate 0 e valor_a_pagar == Originação."""
    venc = HOJE - timedelta(days=3)
    dataset = [_sol(BESA, "1", "atrasado", "1000", venc, unidade="UA", cashback="150")]
    out = vencimentos_parceiro(dataset, _user("parceiro", BESA, rebate_ativo=False), hoje=HOJE)
    lote = next(l for l in out["unidades"] if l["unidade"] == "UA")
    assert lote["rebate"] == "0.00"
    assert lote["valor_a_pagar"] == "1000.00"


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
