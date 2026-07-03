"""T019 — parser: moeda US, datas ISO+BR, descarte de resumo."""

from datetime import date
from decimal import Decimal

from app.sheets.parser import (
    formatar_codigo,
    parse_base,
    parse_bool,
    parse_date_flexible,
    parse_money,
    parse_solicitacoes,
)


def test_formatar_codigo_prefixo_contratante():
    assert formatar_codigo("Besa", "1102") == "BESA-1102"
    assert formatar_codigo("BESA Medical Group", "99") == "BESA-99"


def test_formatar_codigo_sem_acento_e_ignora_espacos():
    assert formatar_codigo("São Lucas", "7") == "SAOL-7"
    assert formatar_codigo("A.H. Gestão", "5") == "AHGE-5"


def test_formatar_codigo_bordas():
    assert formatar_codigo(None, "10") == "???-10"  # sem contratante
    assert formatar_codigo("Besa", None) is None  # sem número
    assert formatar_codigo("Besa", "  ") is None
    assert formatar_codigo("AB", "3") == "AB-3"  # menos de 4 letras


def test_money_us_format():
    assert parse_money("R$ 1,300.00") == Decimal("1300.00")
    assert parse_money("2799.99") == Decimal("2799.99")
    assert parse_money("R$ 12,345.67") == Decimal("12345.67")


def test_money_empty_is_none():
    assert parse_money("") is None
    assert parse_money(None) is None
    assert parse_money("-") is None


def test_date_iso_and_br():
    assert parse_date_flexible("2025-12-30") == date(2025, 12, 30)
    assert parse_date_flexible("14/01/2026") == date(2026, 1, 14)
    assert parse_date_flexible("") is None
    assert parse_date_flexible("texto") is None


def test_bool_quitado():
    assert parse_bool("TRUE") is True
    assert parse_bool("true") is True
    assert parse_bool("FALSE") is False
    assert parse_bool("") is False
    assert parse_bool(None) is False


def _header() -> list[str]:
    return ["Solicitação"] + [""] * 22


def test_descarta_linha_resumo():
    """Linha sem código, cliente e valor (resumo/total) é descartada."""
    rows = [
        _header(),
        _make_row(codigo="159", cliente="Dr. A", valor="R$ 1,000.00"),
        [""] * 23,  # resumo: tudo vazio
    ]
    parsed = parse_solicitacoes(rows)
    assert len(parsed) == 1
    assert parsed[0].codigo == "159"
    assert parsed[0].valor == Decimal("1000.00")


def test_linha_origem():
    """linha_origem aponta a linha real da planilha (cabeçalho = linha 1)."""
    rows = [_header(), _make_row(codigo="1", cliente="X", valor="10")]
    parsed = parse_solicitacoes(rows)
    assert parsed[0].linha_origem == 2


def test_parse_base_nome_unico_expoe_pii():
    rows = [
        ["borrower_full_name", "borrower_taxpayer_id"],
        ["Maria Souza", "333"],
    ]
    base = parse_base(rows)
    assert base["maria souza"]["cpf"] == "333"
    assert "ambiguo" not in base["maria souza"]


def test_parse_base_nome_repetido_marca_ambiguo_sem_pii():
    """Nome normalizado repetido com CPF DIFERENTE (homônimo real) → PII omitida (R-001)."""
    rows = [
        ["borrower_full_name", "borrower_taxpayer_id"],
        ["Joao Silva", "111"],
        ["joao  silva", "222"],  # mesmo nome normalizado, CPF diferente
    ]
    base = parse_base(rows)
    assert base["joao silva"] == {"ambiguo": True}
    assert "cpf" not in base["joao silva"]


def test_parse_base_mesma_pessoa_varios_emprestimos_mantem_pii():
    """1 linha por empréstimo: mesmo nome + MESMO CPF em N linhas = mesma pessoa, PII preservada."""
    rows = [
        ["borrower_full_name", "borrower_taxpayer_id", "borrower_pix_key"],
        ["Ana Costa", "999", "ana@pix"],
        ["ana  costa", "999", "ana@pix"],  # 2º empréstimo do mesmo médico
        ["Ana Costa", "999", "ana@pix"],  # 3º empréstimo
    ]
    base = parse_base(rows)
    assert base["ana costa"].get("ambiguo") is None
    assert base["ana costa"]["cpf"] == "999"
    assert base["ana costa"]["pix"] == "ana@pix"


def test_parse_base_ambiguo_persiste_apos_terceira_linha_do_mesmo_cpf():
    """Depois de virar ambíguo (2 CPFs), uma 3ª linha repetindo um CPF não ressuscita a PII."""
    rows = [
        ["borrower_full_name", "borrower_taxpayer_id"],
        ["Rui Lima", "111"],
        ["Rui Lima", "222"],  # ambíguo aqui
        ["Rui Lima", "111"],  # não deve reexpor PII
    ]
    base = parse_base(rows)
    assert base["rui lima"] == {"ambiguo": True}


def _make_row(codigo="", cliente="", valor="", contratante="", quitado="", venc=""):
    row = [""] * 23
    row[0] = codigo
    row[1] = quitado
    row[2] = cliente
    row[3] = valor
    row[12] = venc
    row[16] = contratante
    return row
