"""Engine de filtros (spec 002): parse por tipo, aplicação AND, bordas abertas, opções."""

from datetime import date
from decimal import Decimal

from app.domain.filtros.engine import aplica, parse
from app.domain.filtros.registry import (
    ABA_OVERVIEW,
    ABA_SOLICITACOES,
    ABA_VENCIMENTOS,
    REGISTRY,
)
from app.domain.models import AppUser, Solicitacao
from app.services.opcoes import opcoes_de_filtro

BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"


def _sol(codigo, *, contratante=BESA, cliente="Dr. Ana", status="a_pagar", valor="100",
         unidade=None, pedido=date(2026, 1, 10), venc=date(2026, 7, 1), cashback="0",
         prazo=30, mes_orig=None, mes_venc=None):
    return Solicitacao(
        codigo=codigo, quitado=(status == "pago"), cliente=cliente, valor=Decimal(valor),
        cashback=Decimal(cashback), prazo_dias=prazo, data_pedido=pedido,
        data_vencimento=venc, mes_originacao=mes_orig, mes_vencimento=mes_venc,
        contratante=contratante, unidade=unidade, status=status, status_label=status,
        medico_grupo_id=cliente,
    )


def _user(role, contratante):
    return AppUser(id="u", email="e@e", role=role, contratante=contratante, nome_exibicao="N")


ITENS = [
    _sol("1", status="atrasado", valor="1000", unidade="Lorena", cashback="10"),
    _sol("2", status="a_pagar", valor="3000", unidade="Aparecida", cashback="50"),
    _sol("3", status="pago", valor="9000", unidade="Lorena", cashback="200",
         pedido=date(2026, 3, 5)),
    _sol("4", contratante=AH, status="a_pagar", valor="5000", cliente="Dr. Zé"),
]


def _ids(itens):
    return {s.codigo for s in itens}


# --- MULTI -------------------------------------------------------------------------

def test_multi_status():
    f = parse({"status": "atrasado,pago"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"1", "3"}


def test_multi_unidade():
    f = parse({"unidade": "Lorena"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"1", "3"}


# --- RANGE -------------------------------------------------------------------------

def test_range_valor_fechado():
    f = parse({"valor": "1000..5000"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"1", "2", "4"}


def test_range_borda_aberta_min():
    f = parse({"valor": "5000.."}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"3", "4"}


def test_range_borda_aberta_max():
    f = parse({"valor": "..1000"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"1"}


# --- DATE --------------------------------------------------------------------------

def test_date_range_pedido():
    f = parse({"data_pedido": "2026-02-01..2026-12-31"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"3"}


# --- combinação / robustez ---------------------------------------------------------

def test_and_de_varios_filtros():
    f = parse({"status": "a_pagar", "valor": "..4000"}, ABA_SOLICITACOES, "parceiro")
    assert _ids(aplica(ITENS, f)) == {"2"}


def test_param_invalido_ou_desconhecido_e_ignorado():
    assert parse({"naoexiste": "x", "valor": "abc..def"}, ABA_SOLICITACOES, "parceiro") == []
    assert aplica(ITENS, []) == ITENS


def test_campo_so_gestor_ignorado_para_parceiro():
    assert parse({"contratante": AH}, ABA_SOLICITACOES, "parceiro") == []
    f = parse({"contratante": AH}, ABA_SOLICITACOES, "gestor")
    assert _ids(aplica(ITENS, f)) == {"4"}


def test_campo_fora_da_aba_ignorado():
    # `cashback` não existe na aba overview.
    assert parse({"cashback": "0..100"}, ABA_OVERVIEW, "parceiro") == []


# --- opções escopadas (RF-F05) -----------------------------------------------------

def test_opcoes_parceiro_so_suas_unidades():
    out = opcoes_de_filtro(ITENS, _user("parceiro", BESA), ABA_SOLICITACOES)
    campos = {c["id"]: c for c in out["campos"]}
    assert set(campos["unidade"]["opcoes"]) == {"Lorena", "Aparecida"}
    assert "Dr. Zé" not in campos["medico"]["opcoes"]  # médico de outro parceiro
    assert "contratante" not in campos  # parceiro não vê filtro de contratante


def test_opcoes_gestor_tem_contratante_e_faixas():
    out = opcoes_de_filtro(ITENS, _user("gestor", None), ABA_SOLICITACOES)
    campos = {c["id"]: c for c in out["campos"]}
    assert set(campos["contratante"]["opcoes"]) == {BESA, AH}
    assert campos["valor"]["min"] == "1000.00"
    assert campos["valor"]["max"] == "9000.00"


def test_vencimentos_overview_expoem_campos_certos():
    venc = {c.id for c in REGISTRY.values() if ABA_VENCIMENTOS in c.abas}
    assert {"status", "unidade", "valor", "data_vencimento"} <= venc
    # Visão Geral: recorte temporal saiu dos chips e virou o toggle ano/mês — sobram só
    # os filtros não-temporais (status/unidade + contratante p/ gestor).
    over = {c.id for c in REGISTRY.values() if ABA_OVERVIEW in c.abas}
    assert "periodo" not in over
    assert "mes_originacao" not in over
    assert {"status", "unidade"} <= over
