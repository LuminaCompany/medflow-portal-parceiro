"""T046 — exclusão global: pendência fora de /solicitacoes, /vencimentos, /overview e de
toda métrica (RF-035) + reentrada self-healing ao corrigir a fonte (RF-037)."""

from datetime import date
from decimal import Decimal

from app.domain.models import AppUser
from app.domain.validation import particiona
from app.services.dataset import Dataset
from app.services.overview import overview
from app.services.solicitacoes import listar_solicitacoes
from app.services.vencimentos import vencimentos_parceiro
from app.sheets.parser import ParsedSolicitacao

BESA = "BESA Medical Group"
CADASTRO = {"dr. ana": BESA, "dr. bruno": BESA}
HOJE = date(2026, 6, 25)


def _parsed(codigo, cliente, contratante, valor="1000", linha=2):
    return ParsedSolicitacao(
        linha_origem=linha,
        codigo=codigo,
        cliente=cliente,
        contratante=contratante,
        valor=Decimal(valor) if valor is not None else None,
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        unidade="Unidade Central",
        quitado=False,
    )


def _user():
    return AppUser(id="u", email="e@e", role="parceiro", contratante=BESA, nome_exibicao="N")


def test_pendencia_ausente_de_todas_as_telas_e_metricas():
    parsed = [
        _parsed("1", "Dr. Ana", BESA, linha=2),  # válida
        _parsed("99", "Dr. Bruno", None, linha=3),  # SEM contratante → pendência
    ]
    validas, pendencias = particiona(parsed, CADASTRO, HOJE)
    ds = Dataset(validas=validas, pendencias=pendencias, base_medicos={})
    user = _user()

    # Pendência não entra na sequência gerada (feature 009): identifica-se pela linha do sheet.
    assert {p.codigo for p in pendencias} == {"(linha 3)"}

    # /solicitacoes — pendência ausente
    sol = listar_solicitacoes(ds, user)
    assert "(linha 3)" not in {i["codigo"] for i in sol["items"]}
    assert sol["total"] == 1

    # /vencimentos — pendência ausente de qualquer lista e do agregado
    venc = vencimentos_parceiro(ds.validas, user, hoje=HOJE)
    codigos = {i["codigo"] for i in venc["atrasados"] + venc["proximos"] + venc["pagos"]}
    assert "(linha 3)" not in codigos
    assert venc["cards"]["total_pendente"] == "1000.00"  # só a válida

    # /overview — métrica conta só a válida
    ov = overview(ds.validas, user, hoje=HOJE)
    assert ov["cards"]["total_solicitacoes"] == 1


def test_reentrada_self_healing():
    """Corrigida a fonte (contratante preenchido), a linha reentra em `validas`."""
    quebrada = [_parsed("99", "Dr. Bruno", None, linha=3)]
    validas, pend = particiona(quebrada, CADASTRO, HOJE)
    assert len(validas) == 0 and len(pend) == 1

    corrigida = [_parsed("99", "Dr. Bruno", BESA, linha=3)]
    validas2, pend2 = particiona(corrigida, CADASTRO, HOJE)
    # Feature 009: código gerado = trigrama padrão da Contratante (BESA → BES) + sequência.
    assert {s.codigo for s in validas2} == {"BES-00001"}
    assert len(pend2) == 0
