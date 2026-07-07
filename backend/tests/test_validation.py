"""T021 — validation: cada regra gera o motivo certo; múltiplos motivos; partição."""

from datetime import date
from decimal import Decimal

from app.domain.validation import (
    MOTIVO_CLIENTE_AUSENTE,
    MOTIVO_CLIENTE_SEM_CADASTRO,
    MOTIVO_CONTRATANTE_DIVERGENTE,
    MOTIVO_CONTRATANTE_FALTANDO,
    MOTIVO_DATA_QUITACAO,
    MOTIVO_INDIVIDUAL,
    MOTIVO_QUITACAO_SEM_DATA,
    MOTIVO_UNIDADE_AUSENTE,
    MOTIVO_VALOR_INVALIDO,
    particiona,
)
from app.sheets.parser import ParsedSolicitacao

HOJE = date(2026, 6, 25)
CADASTRO = {"dr. a": "BESA Medical Group", "dr. b": "A.H. GESTÃO MÉDICA"}


def _valida(**kw) -> ParsedSolicitacao:
    base = dict(
        linha_origem=2,
        codigo="1",
        cliente="Dr. A",
        contratante="BESA Medical Group",
        valor=Decimal("1000.00"),
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        unidade="Unidade Central",
        quitado=False,
    )
    base.update(kw)
    return ParsedSolicitacao(**base)


def test_linha_valida_nao_vira_pendencia():
    validas, pend = particiona([_valida()], CADASTRO, HOJE)
    assert len(validas) == 1 and len(pend) == 0
    assert validas[0].status == "a_pagar"


def test_cliente_ausente():
    _, pend = particiona([_valida(cliente=None)], CADASTRO, HOJE)
    assert MOTIVO_CLIENTE_AUSENTE in pend[0].motivos


def test_codigo_origem_ausente_ainda_e_valida():
    """Feature 009: o código não vem mais do sheet — código de origem vazio NÃO reprova.
    O portal gera o código (sequência por Contratante)."""
    validas, pend = particiona([_valida(codigo=None)], CADASTRO, HOJE)
    assert len(validas) == 1 and len(pend) == 0
    assert validas[0].codigo == "BES-00001"  # trigrama padrão de "BESA Medical Group" + seq 1


def test_contratante_faltando():
    _, pend = particiona([_valida(contratante=None)], CADASTRO, HOJE)
    assert MOTIVO_CONTRATANTE_FALTANDO in pend[0].motivos


def test_cliente_sem_cadastro():
    _, pend = particiona([_valida(cliente="Dr. Z")], CADASTRO, HOJE)
    assert MOTIVO_CLIENTE_SEM_CADASTRO in pend[0].motivos


def test_contratante_divergente():
    _, pend = particiona([_valida(contratante="MMR Serviços Médicos")], CADASTRO, HOJE)
    assert MOTIVO_CONTRATANTE_DIVERGENTE in pend[0].motivos


def test_individual():
    _, pend = particiona([_valida(contratante="INDIVIDUAL", cliente="Solo")], CADASTRO, HOJE)
    assert MOTIVO_INDIVIDUAL in pend[0].motivos


def test_valor_invalido():
    _, pend = particiona([_valida(valor=Decimal("0"))], CADASTRO, HOJE)
    assert MOTIVO_VALOR_INVALIDO in pend[0].motivos


def test_data_quitacao_ausente():
    _, pend = particiona([_valida(data_vencimento=None)], CADASTRO, HOJE)
    assert MOTIVO_DATA_QUITACAO in pend[0].motivos


def test_quitado_sem_data_real():
    _, pend = particiona([_valida(quitado=True, data_quitacao_real=None)], CADASTRO, HOJE)
    assert MOTIVO_QUITACAO_SEM_DATA in pend[0].motivos


def test_unidade_ausente_vira_pendencia():
    """ADR 0001: Unidade Referência vazia → quarentena."""
    validas, pend = particiona([_valida(unidade=None)], CADASTRO, HOJE)
    assert len(validas) == 0
    assert MOTIVO_UNIDADE_AUSENTE in pend[0].motivos


def test_multiplos_motivos():
    item = _valida(cliente=None, contratante=None, valor=None, data_vencimento=None)
    _, pend = particiona([item], CADASTRO, HOJE)
    assert len(pend[0].motivos) >= 3
    assert pend[0].linha_origem == 2


# --- Feature 009: sequência do código gerada pelo portal ---------------------------------


def test_sequencia_por_contratante_ordena_por_data_do_pedido():
    """Números são por Contratante, começam em 00001 e seguem a data do pedido (desempate =
    linha de origem). A ordem das linhas no sheet não fura a sequência por data."""
    itens = [
        _valida(cliente="Dr. A", data_pedido=date(2026, 3, 1), linha_origem=2),
        _valida(cliente="Dr. A", data_pedido=date(2026, 1, 1), linha_origem=3),
        _valida(cliente="Dr. A", data_pedido=date(2026, 2, 1), linha_origem=4),
    ]
    validas, _ = particiona(itens, CADASTRO, HOJE)
    por_data = {s.data_pedido: s.codigo for s in validas}
    assert por_data[date(2026, 1, 1)] == "BES-00001"
    assert por_data[date(2026, 2, 1)] == "BES-00002"
    assert por_data[date(2026, 3, 1)] == "BES-00003"


def test_sequencia_independente_entre_contratantes():
    """Cada Contratante tem a própria sequência começando em 00001 (feature 009)."""
    itens = [
        _valida(cliente="Dr. A", contratante="BESA Medical Group"),
        _valida(cliente="Dr. B", contratante="A.H. GESTÃO MÉDICA"),
    ]
    validas, _ = particiona(itens, CADASTRO, HOJE)
    codigos = {s.contratante: s.codigo for s in validas}
    assert codigos["BESA Medical Group"] == "BES-00001"
    assert codigos["A.H. GESTÃO MÉDICA"] == "AHG-00001"  # trigrama padrão (sem acento, letras)


def test_trigrama_override_muda_o_prefixo():
    """Override do gestor (mapa `trigramas`) substitui as 3 letras padrão no código."""
    itens = [_valida(cliente="Dr. A", contratante="BESA Medical Group")]
    validas, _ = particiona(itens, CADASTRO, HOJE, trigramas={"BESA Medical Group": "XYZ"})
    assert validas[0].codigo == "XYZ-00001"
