"""T019 — parser: moeda US, datas ISO+BR, descarte de resumo."""

from datetime import date
from decimal import Decimal

from app.sheets.parser import (
    formatar_codigo,
    normaliza_cpf,
    normaliza_telefone,
    parse_base,
    parse_bool,
    parse_date_flexible,
    parse_money,
    parse_percent,
    parse_solicitacoes,
    sanitiza_trigrama,
    trigrama_default,
    trigrama_efetivo,
)


def test_trigrama_default_tres_primeiras_letras():
    assert trigrama_default("Besa") == "BES"
    assert trigrama_default("BESA Medical Group") == "BES"


def test_trigrama_default_sem_acento_e_ignora_espacos_pontuacao():
    assert trigrama_default("São Lucas") == "SAO"
    assert trigrama_default("A.H. Gestão") == "AHG"


def test_trigrama_default_bordas():
    assert trigrama_default(None) == "???"  # sem contratante
    assert trigrama_default("12 3") == "???"  # sem letras
    assert trigrama_default("AB") == "AB"  # menos de 3 letras


def test_sanitiza_trigrama_override_do_gestor():
    assert sanitiza_trigrama("xyz") == "XYZ"
    assert sanitiza_trigrama("a.b.c.d") == "ABC"  # corta em 3, tira pontuação
    assert sanitiza_trigrama("  ") == ""  # vazio → cai no default no chamador


def test_trigrama_efetivo_prefere_override():
    assert trigrama_efetivo("BESA Medical Group", "XYZ") == "XYZ"
    assert trigrama_efetivo("BESA Medical Group", "") == "BES"
    assert trigrama_efetivo("BESA Medical Group", None) == "BES"


def test_formatar_codigo_sequencia_5_digitos():
    assert formatar_codigo("BES", 1) == "BES-00001"
    assert formatar_codigo("XYZ", 42) == "XYZ-00042"
    assert formatar_codigo("???", 12345) == "???-12345"


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


def test_percent_fracao_do_unformatted_vira_escala_humana():
    # UNFORMATTED_VALUE: célula % volta como fração e sem símbolo (6% → 0.06).
    assert parse_percent("0.06") == Decimal("6.00")
    assert parse_percent("0.082") == Decimal("8.200")
    assert parse_percent("0") == Decimal("0")


def test_percent_ja_humano_ou_formatado_nao_escala():
    assert parse_percent("6.00%") == Decimal("6.00")  # string formatada (tem %)
    assert parse_percent("6") == Decimal("6")  # número já em escala humana
    assert parse_percent("") is None
    assert parse_percent(None) is None


def test_telefone_remove_duplicacao_da_celula():
    # A base do CRM concatena o mesmo número repetido — pega só a 1ª ocorrência.
    assert normaliza_telefone("(62) 99196-0546(62) 99196-0546991960546") == "(62) 99196-0546"
    assert normaliza_telefone("(11) 98888-7777") == "(11) 98888-7777"
    assert normaliza_telefone("sem numero") == "sem numero"  # sem padrão → devolve cru
    assert normaliza_telefone(None) is None


def test_cpf_reconstroi_zero_a_esquerda_perdido_pelo_sheets():
    assert normaliza_cpf("4810942104") == "04810942104"  # 10 díg → zero à esquerda
    assert normaliza_cpf("123456789") == "00123456789"  # 9 díg → 2 zeros
    assert normaliza_cpf("04810942104") == "04810942104"  # já com 11 díg
    assert normaliza_cpf("048.109.421-04") == "048.109.421-04"  # já mascarado → intacto
    assert normaliza_cpf("333") == "333"  # curto demais p/ CPF → intacto
    assert normaliza_cpf(None) is None


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
