"""Feature 014 — A.H. GESTÃO MÉDICA: linha sem Unidade repartida em PA/PS pela OBS (ou pela
divisão salva do gestor), corte de vencimento do parceiro e pendência de divisão.

Os formatos de OBS abaixo foram tirados da planilha real + variações de digitação.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.domain.divisao import (
    MOTIVO_NAO_CONFERE,
    MOTIVO_NAO_IDENTIFICADA,
    MOTIVO_SALVA_DIVERGENTE,
    MOTIVO_SEM_OBS,
    MOTIVO_SEM_VALOR,
    DivisaoSalva,
    le_obs,
    parse_valor,
    rateia,
)
from app.domain.models import AppUser, ParteDivisao, Pendencia, Solicitacao
from app.domain.regras_contratante import CONTRATANTE_AH, antes_do_corte, siglas_unidade
from app.domain.scope import filtra_por_escopo
from app.domain.validation import MOTIVO_UNIDADE_AUSENTE, particiona
from app.services.divisoes import DivisaoError, valida_partes
from app.services.pagamentos import monta_visao_gestor

AH = CONTRATANTE_AH
BESA = "BESA Medical Group"
SIGLAS = siglas_unidade(AH)
PA, PS = "PA Lorena", "PS Lorena"
HOJE = date(2026, 9, 28)
POS_CORTE = date(2026, 10, 5)
PRE_CORTE = date(2026, 9, 30)
CADASTRO = {"dra. hannah": AH, "dr. besa": BESA}


def _partes(res) -> list[tuple[str, Decimal]] | None:
    return [(p.unidade, p.valor) for p in res.partes] if res.partes else None


# --- parse_valor -------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("350", "350"),
        ("10.275", "10275"),  # milhar BR
        ("4.650,00", "4650.00"),
        ("175,00", "175.00"),
        ("175,5", "175.5"),
        ("1,200.50", "1200.50"),  # US
        ("1200.50", "1200.50"),
        ("1.234.567,89", "1234567.89"),
        ("350,", "350"),  # pontuação solta no fim
    ],
)
def test_parse_valor(texto, esperado):
    assert parse_valor(texto) == Decimal(esperado)


def test_parse_valor_ilegivel():
    assert parse_valor("1.2.3") is None
    assert parse_valor("12,3456") is None


# --- le_obs: formatos resolvidos ---------------------------------------------------------


@pytest.mark.parametrize(
    "obs",
    [
        "PA (175) e PS (1550)",
        "PA (175) PS (1550)",
        "PA 175 e PS 1550",
        "PA (175,00) e PS (1.550,00)",
        "pa (175) e ps (1550)",
        "Pa(175)e Ps(1550)",
        "PA175 PS1550",
        "PA: 175 / PS: 1550",
        "PA = R$ 175,00 + PS = R$ 1.550,00",
        "PA - 175 ; PS - 1550",
        "P.A. 175 e P.S. 1550",
        "P. A (175) e P. S (1550)",
        "PA (175) e PS (1550) (safra de 10.07 - 4 pagamentos - 07.08 29.06 03.07 04.07)",
        "  PA R$175 e PS R$1550  ",
    ],
)
def test_obs_com_valores_reparte(obs):
    res = le_obs(obs, SIGLAS, Decimal("1725"))
    assert res.motivo is None
    assert _partes(res) == [(PA, Decimal("175")), (PS, Decimal("1550"))]


def test_obs_ordem_invertida_mantem_ordem_escrita():
    res = le_obs("PS (6050) e PA (525)", SIGLAS, Decimal("6575"))
    assert _partes(res) == [(PS, Decimal("6050")), (PA, Decimal("525"))]


def test_obs_diferenca_de_centavos_vai_para_a_maior_parte():
    # Real: Originação 5.399,99 p/ "PS (3.350,00) e PA (2.050,00)".
    res = le_obs("PS (3.350,00) e PA (2.050,00)", SIGLAS, Decimal("5399.99"))
    assert _partes(res) == [(PS, Decimal("3349.99")), (PA, Decimal("2050.00"))]


def test_obs_um_valor_so_completa_com_o_restante():
    res = le_obs("PA (350) e PS", SIGLAS, Decimal("7550"))
    assert _partes(res) == [(PA, Decimal("350")), (PS, Decimal("7200"))]


def test_obs_sigla_unica_sem_valor_leva_tudo():
    res = le_obs("PS", SIGLAS, Decimal("1300"))
    assert _partes(res) == [(PS, Decimal("1300"))]


# --- le_obs: vira pendência de divisão ---------------------------------------------------


@pytest.mark.parametrize(
    "obs", ["PA e PS", "PS e PA", "pa/ps", "PA e PS (safra de 10.08 - 3 pagamentos)"]
)
def test_obs_sem_valor_vira_pendencia(obs):
    res = le_obs(obs, SIGLAS, Decimal("6225"))
    assert res.partes is None
    assert res.motivo == MOTIVO_SEM_VALOR
    assert {p.unidade for p in res.sugestao} == {PA, PS}
    assert all(p.valor is None for p in res.sugestao)


def test_obs_valores_nao_batem_vira_pendencia():
    res = le_obs("PA (100) e PS (200)", SIGLAS, Decimal("1000"))
    assert res.partes is None and res.motivo == MOTIVO_NAO_CONFERE
    # A sugestão guarda o que foi lido (pré-preenche o editor do gestor).
    lidas = [(p.unidade, p.valor) for p in res.sugestao]
    assert lidas == [(PA, Decimal("100")), (PS, Decimal("200"))]


def test_obs_restante_negativo_vira_pendencia():
    res = le_obs("PA (9000) e PS", SIGLAS, Decimal("1000"))
    assert res.partes is None and res.motivo == MOTIVO_NAO_CONFERE


@pytest.mark.parametrize(
    "obs",
    [
        "PS (1300) e NEO (1250)",  # sigla fora da regra (decisão: só PA/PS automáticos)
        "UTI NEO e PS",
        "PS e UTI",
        "OK",
        "avaliar",
        "PROMOCIONAL",
        "PA 100 e PA 200",  # sigla repetida
        "REPASSAMOS R$180,00 A MAIS",
    ],
)
def test_obs_nao_reconhecida_vira_pendencia(obs):
    res = le_obs(obs, SIGLAS, Decimal("2550"))
    assert res.partes is None
    assert res.motivo == MOTIVO_NAO_IDENTIFICADA


def test_obs_vazia_vira_pendencia():
    assert le_obs(None, SIGLAS, Decimal("650")).motivo == MOTIVO_SEM_OBS
    assert le_obs("   ", SIGLAS, Decimal("650")).motivo == MOTIVO_SEM_OBS


def test_sigla_nao_casa_dentro_de_palavra():
    # "PAGAMENTOS"/"PSICO" não são PA/PS; sem nada reconhecido → pendência.
    res = le_obs("PAGAMENTOS PSICO", SIGLAS, Decimal("100"))
    assert res.partes is None and res.motivo == MOTIVO_NAO_IDENTIFICADA and res.sugestao == ()


# --- rateio --------------------------------------------------------------------------------


def test_rateia_soma_sempre_o_total():
    cotas = rateia(Decimal("86.54063999999997"), [Decimal("3800"), Decimal("17250")])
    assert cotas[0] == Decimal("15.62")
    assert sum(cotas) == Decimal("86.54063999999997")


def test_rateia_none():
    assert rateia(None, [Decimal("1"), Decimal("2")]) == [None, None]


# --- particiona (validação) ----------------------------------------------------------------


def _linha(**kw):
    from app.sheets.parser import ParsedSolicitacao

    base = dict(
        linha_origem=10,
        codigo="1414",
        cliente="Dra. Hannah",
        contratante=AH,
        valor=Decimal("21050"),
        data_pedido=date(2026, 9, 15),
        data_vencimento=POS_CORTE,
        unidade=None,
        obs="PA (3800) e PS (17250)",
        cashback=Decimal("86.54"),
        iof=Decimal("100"),
    )
    base.update(kw)
    return ParsedSolicitacao(**base)


def test_particiona_reparte_linha_ah_em_duas_solicitacoes():
    validas, pend = particiona([_linha()], CADASTRO, HOJE)
    assert pend == []
    assert [(s.codigo, s.unidade, s.valor) for s in validas] == [
        ("AHG-00001", PA, Decimal("3800")),
        ("AHG-00002", PS, Decimal("17250")),
    ]
    assert sum(s.cashback for s in validas) == Decimal("86.54")
    assert sum(s.iof for s in validas) == Decimal("100")
    assert all(s.cliente == "Dra. Hannah" and s.data_vencimento == POS_CORTE for s in validas)


def test_particiona_sem_valor_vira_pendencia_de_divisao():
    validas, pend = particiona([_linha(obs="PA e PS")], CADASTRO, HOJE)
    assert validas == []
    assert pend[0].motivos == [MOTIVO_SEM_VALOR]
    assert pend[0].codigo_origem == "1414" and pend[0].obs == "PA e PS"
    assert [p.unidade for p in pend[0].divisao] == [PA, PS]


def test_particiona_aplica_divisao_salva_do_gestor():
    salva = DivisaoSalva(
        id="d1",
        valor_total=Decimal("21050"),
        partes=(
            ParteDivisao(unidade=PA, valor=Decimal("1050")),
            ParteDivisao(unidade=PS, valor=Decimal("20000")),
        ),
    )
    validas, pend = particiona(
        [_linha(obs="PA e PS")], CADASTRO, HOJE, divisoes={(AH, "1414"): salva}
    )
    assert pend == []
    assert [(s.unidade, s.valor) for s in validas] == [
        (PA, Decimal("1050")),
        (PS, Decimal("20000")),
    ]


def test_particiona_divisao_salva_com_originacao_mudada_volta_a_pendencia():
    salva = DivisaoSalva(
        id="d1",
        valor_total=Decimal("20000"),  # o sheet agora diz 21.050
        partes=(ParteDivisao(unidade=PS, valor=Decimal("20000")),),
    )
    validas, pend = particiona([_linha()], CADASTRO, HOJE, divisoes={(AH, "1414"): salva})
    assert validas == []
    assert pend[0].motivos == [MOTIVO_SALVA_DIVERGENTE]


def test_particiona_linha_ah_com_unidade_nao_muda():
    validas, _ = particiona([_linha(unidade=PS, obs="PA e PS")], CADASTRO, HOJE)
    assert [(s.unidade, s.valor) for s in validas] == [(PS, Decimal("21050"))]


def test_particiona_ah_antes_do_corte_pendencia_some_valida_fica():
    pre_pendente = _linha(codigo="1", data_vencimento=PRE_CORTE, obs="PA e PS")
    pre_valida = _linha(codigo="2", data_vencimento=PRE_CORTE, unidade="NEO Lorena", obs=None)
    validas, pend = particiona([pre_pendente, pre_valida], CADASTRO, HOJE)
    assert pend == []  # legado não acionável: some da quarentena
    assert [s.unidade for s in validas] == ["NEO Lorena"]  # histórico do gestor mantido


def test_particiona_outra_contratante_nao_e_afetada():
    besa = _linha(contratante=BESA, cliente="Dr. Besa", obs="PA (3800) e PS (17250)",
                  data_vencimento=PRE_CORTE)
    validas, pend = particiona([besa], CADASTRO, HOJE)
    assert validas == []
    assert pend[0].motivos == [MOTIVO_UNIDADE_AUSENTE] and pend[0].divisao is None


def test_particiona_outro_motivo_mantem_pendencia_comum():
    # Cliente sem cadastro + sem unidade: não é caso de divisão (o sheet precisa de correção).
    validas, pend = particiona([_linha(cliente="Dr. Fantasma")], CADASTRO, HOJE)
    assert validas == [] and pend[0].divisao is None
    assert MOTIVO_UNIDADE_AUSENTE in pend[0].motivos


# --- corte de vencimento (escopo do parceiro) ----------------------------------------------


def _sol(contratante, codigo, venc, unidade=PS, status="a_pagar"):
    return Solicitacao(
        codigo=codigo,
        quitado=status == "pago",
        cliente="Dr. X",
        valor=Decimal("100"),
        data_pedido=date(2026, 1, 1),
        data_vencimento=venc,
        contratante=contratante,
        unidade=unidade,
        status=status,
        status_label=status,
    )


def _user(role, contratante=None, unidades=None):
    return AppUser(id="u", email="e@e", role=role, contratante=contratante,
                   nome_exibicao="N", unidades=unidades)


SOLS = [
    _sol(AH, "a-pre", PRE_CORTE),
    _sol(AH, "a-corte", POS_CORTE),
    _sol(AH, "a-pos", date(2026, 11, 30)),
    _sol(BESA, "b-pre", PRE_CORTE),
]


def test_corte_inclusive():
    assert antes_do_corte(AH, date(2026, 10, 4))
    assert not antes_do_corte(AH, POS_CORTE)
    assert not antes_do_corte(BESA, date(2020, 1, 1))


def test_parceiro_ah_so_ve_a_partir_do_corte():
    out = filtra_por_escopo(SOLS, _user("parceiro", AH, unidades=[PS]))
    assert [s.codigo for s in out] == ["a-corte", "a-pos"]


def test_outro_parceiro_nao_tem_corte():
    out = filtra_por_escopo(SOLS, _user("parceiro", BESA))
    assert [s.codigo for s in out] == ["b-pre"]


def test_gestor_ve_historico_da_ah():
    assert len(filtra_por_escopo(SOLS, _user("gestor"))) == 4


def test_falta_aviso_ignora_lote_ah_antes_do_corte():
    out = monta_visao_gestor(SOLS, avisos=[])
    por_c = {c["contratante"]: c for c in out["contratantes"]}
    assert [f["data_vencimento"] for f in por_c[AH]["falta_aviso"]] == ["2026-10-05", "2026-11-30"]
    assert [f["data_vencimento"] for f in por_c[BESA]["falta_aviso"]] == ["2026-09-30"]


# --- validação da divisão do gestor ---------------------------------------------------------


def _pend(valor="1000"):
    return Pendencia(codigo="(linha 10)", contratante=AH, valor=Decimal(valor), motivos=[],
                     linha_origem=10, codigo_origem="1414", divisao=[])


def _p(unidade, valor):
    return ParteDivisao(unidade=unidade, valor=Decimal(valor) if valor is not None else None)


def test_valida_partes_ok():
    partes = valida_partes([_p(PA, "400"), _p(PS, "600")], _pend(), [PA, PS])
    assert [(p.unidade, p.valor) for p in partes] == [(PA, Decimal("400")), (PS, Decimal("600"))]


@pytest.mark.parametrize(
    "partes",
    [
        [_p(PA, "400"), _p(PS, "500")],  # soma ≠ Originação
        [_p(PA, "400"), _p("Hosp Outro", "600")],  # unidade fora das opções
        [_p(PA, "400"), _p(PA, "600")],  # repetida
        [_p(PA, "0"), _p(PS, "1000")],  # zero
        [_p(PA, "400.001"), _p(PS, "599.999")],  # > 2 casas
        [_p(PA, None), _p(PS, "1000")],  # sem valor
        [],
    ],
)
def test_valida_partes_rejeita(partes):
    with pytest.raises(DivisaoError):
        valida_partes(partes, _pend(), [PA, PS])
