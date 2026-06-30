"""T038 — solicitações: busca/paginação/agrupamento + detalhe NÃO vaza médico de outro."""

from datetime import date
from decimal import Decimal

from app.domain.filtros.engine import parse as parse_filtros
from app.domain.filtros.registry import ABA_SOLICITACOES
from app.domain.models import AppUser, Solicitacao
from app.services.dataset import Dataset
from app.services.solicitacoes import detalhe_solicitacao, listar_solicitacoes
from app.sheets.parser import normalize_nome

BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"


def _sol(contratante, codigo, cliente, status="a_pagar", valor="100"):
    return Solicitacao(
        codigo=codigo,
        quitado=(status == "pago"),
        cliente=cliente,
        valor=Decimal(valor),
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        contratante=contratante,
        status=status,
        status_label=status,
        medico_grupo_id=normalize_nome(cliente),
    )


def _dataset(validas, base=None):
    return Dataset(validas=validas, pendencias=[], base_medicos=base or {})


def _user(role, contratante):
    return AppUser(id="u", email="e@e", role=role, contratante=contratante, nome_exibicao="N")


VALIDAS = [
    _sol(BESA, "1", "Dr. Ana", status="atrasado"),
    _sol(BESA, "2", "Dr. Ana", status="a_pagar"),  # mesmo médico → mesmo grupo
    _sol(BESA, "3", "Dr. Bruno", status="pago"),
    _sol(AH, "9", "Dr. Carlos"),
]


def test_escopo_parceiro_nao_lista_outro():
    out = listar_solicitacoes(_dataset(VALIDAS), _user("parceiro", BESA))
    codigos = {i["codigo"] for i in out["items"]}
    assert "9" not in codigos
    assert out["total"] == 3


def test_busca_por_cliente():
    out = listar_solicitacoes(_dataset(VALIDAS), _user("parceiro", BESA), q="bruno")
    assert {i["codigo"] for i in out["items"]} == {"3"}


def test_filtro_status():
    filtros = parse_filtros({"status": "atrasado"}, ABA_SOLICITACOES, "parceiro")
    out = listar_solicitacoes(_dataset(VALIDAS), _user("parceiro", BESA), filtros=filtros)
    assert {i["codigo"] for i in out["items"]} == {"1"}


def test_paginacao_nao_corta_grupo_de_medico():
    """RF-009: limit=1 mas Dr. Ana tem 2 linhas → página estende até fechar o grupo."""
    out = listar_solicitacoes(_dataset(VALIDAS), _user("parceiro", BESA), limit=1, offset=0)
    grupos = {i["medico_grupo_id"] for i in out["items"]}
    # As 2 linhas da Dr. Ana saem juntas (>1 item), nenhum grupo partido.
    ana = [i for i in out["items"] if i["medico_grupo_id"] == normalize_nome("Dr. Ana")]
    assert len(ana) == 2
    assert len(grupos) == 1


def test_detalhe_escopado_nao_vaza_medico_de_outro_parceiro():
    base = {normalize_nome("Dr. Carlos"): {"nome": "Dr. Carlos", "cpf": "111", "telefone": None,
            "email": None, "pix": None, "pix_tipo": None, "nascimento": None}}
    ds = _dataset(VALIDAS, base)
    # Parceiro BESA tenta abrir a solicitação "9" (de AH) → None (404 no router).
    assert detalhe_solicitacao(ds, _user("parceiro", BESA), "9") is None
    # Gestor vê normalmente, com PII.
    det = detalhe_solicitacao(ds, _user("gestor", None), "9")
    assert det is not None
    assert det["medico"]["cpf"] == "111"


def test_detalhe_inclui_resumo_do_medico():
    """Card do painel: agrega todas as solicitações (no escopo) do médico clicado."""
    det = detalhe_solicitacao(_dataset(VALIDAS), _user("parceiro", BESA), "1")
    r = det["resumo_medico"]
    assert r["n_solicitacoes"] == 2  # Dr. Ana tem 2 linhas na BESA
    assert r["valor_total"] == "200.00"
    assert r["ticket_medio"] == "100.00"
    assert r["n_atrasadas"] == 1
    assert r["n_a_pagar"] == 1
    assert r["n_pagas"] == 0


def test_resumo_medico_nao_funde_homonimo_de_outro_contratante():
    """Isolamento (R-001): mesmo nome em outro parceiro não entra no resumo do médico."""
    validas = VALIDAS + [_sol(AH, "10", "Dr. Ana", valor="500")]
    det = detalhe_solicitacao(_dataset(validas), _user("gestor", None), "1")
    assert det["resumo_medico"]["n_solicitacoes"] == 2  # só a Dr. Ana da BESA
    assert det["resumo_medico"]["valor_total"] == "200.00"


def test_margens_so_para_gestor():
    """D5′: parceiro NÃO recebe Lucro Operacional/ÁGIO; gestor recebe (strip no backend)."""
    s = _sol(BESA, "1", "Dr. Ana")
    s.lucro_operacional = Decimal("180.00")
    s.agio_base = Decimal("5.00")
    ds = _dataset([s])

    parceiro = listar_solicitacoes(ds, _user("parceiro", BESA))["items"][0]
    assert "lucro_operacional" not in parceiro
    assert "agio_base" not in parceiro

    gestor = listar_solicitacoes(ds, _user("gestor", None))["items"][0]
    assert gestor["lucro_operacional"] == "180.00"
    assert gestor["agio_base"] == "5.00"


def test_margens_so_para_gestor_no_detalhe():
    """Mesma máscara D5′ vale no painel de detalhes (RF-013)."""
    s = _sol(BESA, "1", "Dr. Ana")
    s.lucro_operacional = Decimal("180.00")
    base = {normalize_nome("Dr. Ana"): {"nome": "Dr. Ana", "cpf": "111", "telefone": None,
            "email": None, "pix": None, "pix_tipo": None, "nascimento": None}}
    ds = _dataset([s], base)

    det_p = detalhe_solicitacao(ds, _user("parceiro", BESA), "1")
    assert "lucro_operacional" not in det_p["solicitacao"]
    assert det_p["medico"]["cpf"] == "111"  # PII mantida ao parceiro

    det_g = detalhe_solicitacao(ds, _user("gestor", None), "1")
    assert det_g["solicitacao"]["lucro_operacional"] == "180.00"


def test_gestor_filtra_por_contratante():
    filtros = parse_filtros({"contratante": "A.H. GESTÃO MÉDICA"}, ABA_SOLICITACOES, "gestor")
    out = listar_solicitacoes(_dataset(VALIDAS), _user("gestor", None), filtros=filtros)
    assert {i["codigo"] for i in out["items"]} == {"9"}
    assert out["items"][0]["cor_parceiro"] is not None


def test_parceiro_nao_amplia_escopo_via_contratante():
    """RF-F06: parceiro filtrando por contratante de outro não vê nada além do seu escopo."""
    # `contratante` é só-gestor no registry → parse ignora p/ parceiro; escopo R-001 mantém BESA.
    filtros = parse_filtros({"contratante": "A.H. GESTÃO MÉDICA"}, ABA_SOLICITACOES, "parceiro")
    out = listar_solicitacoes(_dataset(VALIDAS), _user("parceiro", BESA), filtros=filtros)
    assert "9" not in {i["codigo"] for i in out["items"]}
    assert out["total"] == 3
