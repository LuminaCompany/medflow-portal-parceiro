"""T050 — overview: métricas/série corretas + escopo por Contratante."""

from datetime import date
from decimal import Decimal

from app.domain.models import AppUser, Solicitacao
from app.services.overview import overview

BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"
HOJE = date(2026, 6, 25)


def _sol(
    contratante, codigo, cliente, status, valor, mes_orig, cashback="0",
    mes_venc=None, venc=date(2026, 7, 1),
):
    return Solicitacao(
        codigo=codigo,
        quitado=(status == "pago"),
        cliente=cliente,
        valor=Decimal(valor),
        cashback=Decimal(cashback),
        data_pedido=date(2026, 1, 15),
        data_vencimento=venc,
        contratante=contratante,
        mes_originacao=mes_orig,
        mes_vencimento=mes_venc,
        status=status,
        status_label=status,
    )


DATASET = [
    _sol(BESA, "1", "Dr. Ana", "pago", "1000", "01/2026", cashback="10"),
    _sol(BESA, "2", "Dr. Bruno", "a_pagar", "2000", "02/2026"),
    _sol(BESA, "3", "Dr. Ana", "atrasado", "500", "02/2026"),
    _sol(AH, "9", "Dr. Carlos", "a_pagar", "9999", "02/2026"),
]


def _user(role, contratante):
    return AppUser(id="u", email="e@e", role=role, contratante=contratante, nome_exibicao="N")


def test_cards_parceiro_escopado():
    ov = overview(DATASET, _user("parceiro", BESA), hoje=HOJE)
    c = ov["cards"]
    assert c["total_solicitacoes"] == 3  # só BESA
    assert c["valor_total"] == "3500.00"
    assert c["total_cashback"] == "10.00"
    assert c["pagas"] == 1
    assert c["em_aberto"] == 2
    assert c["medicos_impactados"] == 2  # Dr. Ana, Dr. Bruno (não Carlos)


def test_serie_mensal_normalizada_aaaa_mm():
    ov = overview(DATASET, _user("parceiro", BESA), hoje=HOJE)
    serie = {p["mes"]: p["valor"] for p in ov["serie_mensal"]}
    assert serie["2026-01"] == "1000.00"
    assert serie["2026-02"] == "2500.00"  # 2000 + 500


def test_ticket_medio_media_da_originacao():
    """Ticket Médio = Originação Total ÷ nº de solicitações (média da coluna Originação)."""
    ov = overview(DATASET, _user("parceiro", BESA), hoje=HOJE)
    # BESA: 3500 originados / 3 solicitações = 1166.67.
    assert ov["cards"]["ticket_medio"] == "1166.67"


def test_ticket_medio_sem_solicitacoes_e_zero():
    ov = overview([], _user("gestor", None), hoje=HOJE)
    assert ov["cards"]["ticket_medio"] == "0.00"


def test_recorte_por_meses_filtra_cards_e_serie():
    """Toggle 'por mês': só os meses selecionados contam (RF-019)."""
    ov = overview(DATASET, _user("parceiro", BESA), ano=2026, meses=[1], hoje=HOJE)
    assert ov["cards"]["total_solicitacoes"] == 1  # só janeiro (Dr. Ana, 1000)
    assert ov["cards"]["valor_total"] == "1000.00"
    assert [p["mes"] for p in ov["serie_mensal"]] == ["2026-01"]


def test_recorte_por_ano_inteiro_e_anos_disponiveis():
    ov = overview(DATASET, _user("parceiro", BESA), ano=2026, hoje=HOJE)
    assert ov["ano"] == 2026
    assert ov["anos_disponiveis"] == [2026]
    assert ov["cards"]["total_solicitacoes"] == 3  # ano inteiro (todos os meses)


def test_gestor_soma_global():
    ov = overview(DATASET, _user("gestor", None), hoje=HOJE)
    assert ov["cards"]["total_solicitacoes"] == 4
    assert ov["cards"]["valor_total"] == "13499.00"


def test_mes_originacao_malformado_nao_derruba_endpoint():
    """mes_originacao ilegível ('Junho/2026') cai no fallback por data_pedido, sem ValueError."""
    ruim = _sol(BESA, "7", "Dr. Ana", "a_pagar", "100", "Junho/2026")
    ov = overview([ruim], _user("parceiro", BESA), hoje=HOJE)
    # data_pedido é 2026-01-15 (fallback) → série no mês 2026-01, sem crash.
    assert ov["cards"]["total_solicitacoes"] == 1
    assert [p["mes"] for p in ov["serie_mensal"]] == ["2026-01"]


# --- Série do rebate por mês de VENCIMENTO (RF-020b, toggle do gráfico "Rebate Mensal") ---

# Todas originadas em 01/2026 (data_pedido), mas vencendo em meses diferentes de 2026.
DATASET_VENC = [
    _sol(BESA, "1", "Dr. Ana", "pago", "1000", "01/2026", cashback="10",
         mes_venc="03/2026", venc=date(2026, 3, 10)),
    _sol(BESA, "2", "Dr. Bruno", "a_pagar", "2000", "01/2026", cashback="20",
         mes_venc="04/2026", venc=date(2026, 4, 10)),
    _sol(BESA, "3", "Dr. Ana", "atrasado", "500", "01/2026", cashback="5",
         mes_venc="04/2026", venc=date(2026, 4, 20)),
    _sol(AH, "9", "Dr. Carlos", "a_pagar", "9999", "01/2026", cashback="99",
         mes_venc="04/2026", venc=date(2026, 4, 10)),
]


def test_serie_rebate_vencimento_agrupa_pelo_mes_de_vencimento():
    ov = overview(DATASET_VENC, _user("parceiro", BESA), ano=2026, hoje=HOJE)
    venc = {p["mes"]: p["rebate"] for p in ov["serie_rebate_vencimento"]}
    assert venc == {"2026-03": "10.00", "2026-04": "25.00"}  # AH fora (escopo)
    # A série por originação segue intacta: tudo em 01/2026.
    assert [p["mes"] for p in ov["serie_mensal"]] == ["2026-01"]


def test_serie_rebate_vencimento_respeita_recorte_por_meses():
    """O toggle 'por mês' passa a recortar pela data de VENCIMENTO nessa série."""
    ov = overview(DATASET_VENC, _user("parceiro", BESA), ano=2026, meses=[4], hoje=HOJE)
    assert [p["mes"] for p in ov["serie_rebate_vencimento"]] == ["2026-04"]
    # Cards seguem em originação: nenhuma solicitação originada em abril.
    assert ov["cards"]["total_solicitacoes"] == 0


def test_serie_rebate_vencimento_respeita_periodo_de_datas():
    ov = overview(
        DATASET_VENC, _user("parceiro", BESA),
        data_de=date(2026, 4, 1), data_ate=date(2026, 4, 15), hoje=HOJE,
    )
    venc = {p["mes"]: p["rebate"] for p in ov["serie_rebate_vencimento"]}
    assert venc == {"2026-04": "20.00"}  # só o vencimento de 10/04 (o de 20/04 fica fora)


def test_serie_rebate_vencimento_isolada_por_contratante():
    ov = overview(DATASET_VENC, _user("parceiro", AH), ano=2026, hoje=HOJE)
    venc = {p["mes"]: p["rebate"] for p in ov["serie_rebate_vencimento"]}
    assert venc == {"2026-04": "99.00"}  # só AH


def test_mes_vencimento_malformado_cai_na_data_vencimento():
    ruim = _sol(BESA, "7", "Dr. Ana", "a_pagar", "100", "01/2026", cashback="7",
                mes_venc="Março/2026", venc=date(2026, 3, 9))
    ov = overview([ruim], _user("parceiro", BESA), ano=2026, hoje=HOJE)
    assert [p["mes"] for p in ov["serie_rebate_vencimento"]] == ["2026-03"]
