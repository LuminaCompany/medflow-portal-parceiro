"""Normalização da planilha (entrada) — dados sujos → tipos fortes (research D3).

Converte na fronteira: moeda US `"R$ 1,300.00"` → Decimal; datas mistas ISO/BR → date;
bool `QUITADO`; descarta a linha de resumo. Mantém `linha_origem` (nº da linha na planilha)
para a área de Pendências (gestor acha rápido). Campos não parseáveis viram None — a
partição válida/pendência é decidida depois em `domain/validation.py`.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

# Prefixo do código exibido = TRIGRAMA da contratante (feature 009). Padrão = 3 primeiras
# letras; o gestor pode sobrescrever por Contratante ("Editar parceiro"). O NÚMERO não vem
# mais do sheet: o portal gera uma sequência por Contratante (ver validation._numera_e_constroi).
TAMANHO_TRIGRAMA = 3
TRIGRAMA_SEM_CONTRATANTE = "???"
LARGURA_SEQUENCIA = 5  # números sempre com 5 dígitos, zero-padded (00001, 00002, …)

# Índices de coluna na aba "Dados Tratados" (data-model §1). Mapear por posição é o contrato.
COL_CODIGO = 0
COL_QUITADO = 1
COL_CLIENTE = 2
COL_VALOR = 3
COL_RECEBIDO = 4
COL_IOF = 5
COL_JUROS = 6
COL_LUCRO = 7
COL_TAXA = 8
COL_DATA_PEDIDO = 10
COL_MES_ORIGINACAO = 11
COL_DATA_VENCIMENTO = 12
COL_MES_VENCIMENTO = 13
COL_PRAZO = 14
COL_CONTRATANTE = 16
COL_DATA_QUITACAO_REAL = 17
COL_DIAS_DIFERENCA = 18
COL_UNIDADE = 19
COL_OBS = 20
COL_AGIO = 21
COL_CASHBACK = 22

# Primeira linha de dados na planilha = linha 2 (linha 1 é o cabeçalho).
_HEADER_OFFSET = 2


@dataclass
class ParsedSolicitacao:
    """Solicitação normalizada, ainda não validada (campos podem ser None)."""

    linha_origem: int
    codigo: str | None = None
    quitado: bool = False
    cliente: str | None = None
    valor: Decimal | None = None
    recebido_cliente: Decimal | None = None
    iof: Decimal | None = None
    juros_descontos: Decimal | None = None
    lucro_operacional: Decimal | None = None
    taxa_juros_mes: Decimal | None = None
    data_pedido: date | None = None
    mes_originacao: str | None = None
    data_vencimento: date | None = None
    mes_vencimento: str | None = None
    prazo_dias: int | None = None
    contratante: str | None = None
    data_quitacao_real: date | None = None
    dias_diferenca: int | None = None
    unidade: str | None = None
    obs: str | None = None
    agio_base: Decimal | None = None
    cashback: Decimal = field(default_factory=lambda: Decimal("0"))
    # Erros estruturais de parsing (ex.: valor presente mas ilegível) — viram motivos.
    parse_errors: list[str] = field(default_factory=list)


def parse_money(raw: str | None) -> Decimal | None:
    """`"R$ 1,300.00"` → Decimal("1300.00"). Vírgula=milhar, ponto=decimal (formato US)."""
    if raw is None:
        return None
    cleaned = (
        str(raw)
        .replace("R$", "")
        .replace(" ", "")
        .replace(" ", "")
        .replace(",", "")  # separador de milhar
        .strip()
    )
    if cleaned in ("", "-"):
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def parse_percent(raw: str | None) -> Decimal | None:
    """Percentual da planilha → Decimal na escala HUMANA (6% → Decimal("6"), não "0.06").

    A planilha é lida em `UNFORMATTED_VALUE` (client.py): uma célula formatada como
    porcentagem volta como FRAÇÃO e SEM o símbolo (6% → `0.06`). Sem escalar, o painel
    mostrava "0,06%" no lugar de "6,00%". Regras:
      - raw traz "%" (string já formatada, ex.: "6.00%") → é o percentual humano, não escala;
      - raw sem "%" e 0 < |valor| < 1 → é a fração do Sheets → multiplica por 100;
      - senão mantém (ex.: número 6 já em escala humana).
    Só exibição; não entra em cálculo do portal.
    """
    if raw is None:
        return None
    texto = str(raw)
    tem_simbolo = "%" in texto
    cleaned = texto.replace("%", "").replace(" ", "").replace(",", "").strip()
    if cleaned == "":
        return None
    try:
        valor = Decimal(cleaned)
    except InvalidOperation:
        return None
    if not tem_simbolo and 0 < abs(valor) < 1:
        valor *= 100
    return valor


def parse_date_flexible(raw: str | None) -> date | None:
    """ISO `yyyy-mm-dd` ou BR `dd/mm/yyyy` → date. Tenta ISO, depois BR."""
    if raw is None:
        return None
    text = str(raw).strip()
    if text == "":
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_bool(raw: str | None) -> bool:
    """`"TRUE"` → True; vazio/`"FALSE"`/outro → False."""
    return str(raw).strip().upper() == "TRUE" if raw is not None else False


def parse_int(raw: str | None) -> int | None:
    if raw is None:
        return None
    text = str(raw).strip().replace(",", "")
    if text == "":
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _cell(row: list[str], idx: int) -> str | None:
    """Célula segura — planilha pode devolver linhas curtas (trailing vazio)."""
    if idx < len(row):
        value = row[idx]
        return value if value != "" else None
    return None


# Telefone BR: DDD opcional entre parênteses + número de 8/9 dígitos (com separador opcional).
_TELEFONE_RE = re.compile(r"\(?\d{2}\)?[\s.\-]*\d{4,5}[\s.\-]?\d{4}")


def normaliza_telefone(raw: str | None) -> str | None:
    """Extrai o 1º telefone bem-formado da célula da base.

    A base do CRM às vezes concatena o MESMO número repetido na célula (ex.:
    `"(62) 99196-0546(62) 99196-0546991960546"`), que aparecia duplicado no painel. Pega só a
    1ª ocorrência que casa o padrão BR. Sem casar nada, devolve o valor original (nunca perde
    dado — no máximo mostra o texto cru).
    """
    if raw is None:
        return None
    texto = str(raw).strip()
    if texto == "":
        return None
    m = _TELEFONE_RE.search(texto)
    return m.group(0).strip() if m else texto


def normaliza_cpf(raw: str | None) -> str | None:
    """Reconstrói o CPF quando o Sheets derruba o zero à esquerda.

    A base às vezes guarda o CPF como NÚMERO: lido em `UNFORMATTED_VALUE`, ele volta sem os
    zeros à esquerda (`04810942104` → `4810942104`, 10 dígitos — como aparecia no painel).
    Só reconstrói quando é número PURO com tamanho plausível de CPF (9–11 dígitos), zerando à
    esquerda até 11. Valor já mascarado (`048.109.421-04`), curto demais (stub de teste) ou
    longo demais é devolvido como veio — nunca perde nem inventa dado.
    """
    if raw is None:
        return None
    texto = str(raw).strip()
    if texto == "":
        return None
    if texto.isdigit() and 9 <= len(texto) <= 11:
        return texto.zfill(11)
    return texto


def _trim(raw: str | None) -> str | None:
    """Trim em chaves de casamento (`contratante`/`unidade`/`cliente`)."""
    if raw is None:
        return None
    text = str(raw).strip()
    return text if text != "" else None


def _is_summary_row(row: list[str]) -> bool:
    """Linha de resumo/total: sem código, sem cliente e sem valor (data-model §5)."""
    return (
        _cell(row, COL_CODIGO) is None
        and _cell(row, COL_CLIENTE) is None
        and _cell(row, COL_VALOR) is None
    )


def parse_solicitacoes(values: list[list[str]]) -> list[ParsedSolicitacao]:
    """Normaliza a aba Dados Tratados. `values[0]` é o cabeçalho (descartado)."""
    parsed: list[ParsedSolicitacao] = []
    for offset, row in enumerate(values[1:]):
        if _is_summary_row(row):
            continue
        linha_origem = offset + _HEADER_OFFSET
        item = ParsedSolicitacao(linha_origem=linha_origem)

        codigo_raw = _cell(row, COL_CODIGO)
        item.codigo = str(codigo_raw).strip() if codigo_raw is not None else None
        item.quitado = parse_bool(_cell(row, COL_QUITADO))
        item.cliente = _trim(_cell(row, COL_CLIENTE))

        raw_valor = _cell(row, COL_VALOR)
        item.valor = parse_money(raw_valor)
        if raw_valor is not None and item.valor is None:
            item.parse_errors.append("Valor inválido")

        item.recebido_cliente = parse_money(_cell(row, COL_RECEBIDO))
        item.iof = parse_money(_cell(row, COL_IOF))
        item.juros_descontos = parse_money(_cell(row, COL_JUROS))
        item.lucro_operacional = parse_money(_cell(row, COL_LUCRO))
        item.taxa_juros_mes = parse_percent(_cell(row, COL_TAXA))
        item.data_pedido = parse_date_flexible(_cell(row, COL_DATA_PEDIDO))
        item.mes_originacao = _cell(row, COL_MES_ORIGINACAO)
        item.data_vencimento = parse_date_flexible(_cell(row, COL_DATA_VENCIMENTO))
        item.mes_vencimento = _cell(row, COL_MES_VENCIMENTO)
        item.prazo_dias = parse_int(_cell(row, COL_PRAZO))
        item.contratante = _trim(_cell(row, COL_CONTRATANTE))
        item.data_quitacao_real = parse_date_flexible(_cell(row, COL_DATA_QUITACAO_REAL))
        item.dias_diferenca = parse_int(_cell(row, COL_DIAS_DIFERENCA))
        item.unidade = _trim(_cell(row, COL_UNIDADE))
        item.obs = _cell(row, COL_OBS)
        item.agio_base = parse_money(_cell(row, COL_AGIO))
        item.cashback = parse_money(_cell(row, COL_CASHBACK)) or Decimal("0")

        parsed.append(item)
    return parsed


def parse_cadastro(values: list[list[str]]) -> dict[str, str]:
    """Aba Cadastro de Clientes → mapa `cliente (normalizado) → contratante`.

    Colunas: Cliente, Contratante (3 cols; usa as 2 primeiras úteis). Join por nome
    normalizado (trim/caixa) — protege o vínculo médico→parceiro (R-001).
    """
    mapa: dict[str, str] = {}
    for row in values[1:]:
        cliente = _trim(_cell(row, 0))
        contratante = _trim(_cell(row, 1))
        if cliente and contratante:
            mapa[normalize_nome(cliente)] = contratante
    return mapa


def parse_base(values: list[list[str]]) -> dict[str, dict[str, str | None]]:
    """Aba `base de dados` → mapa `nome normalizado → PII do médico` (data-model §1b).

    Join por `borrower_full_name`. Indexa por header para resistir à ordem das 50 colunas.
    """
    if not values:
        return {}
    header = [str(h).strip().lower() for h in values[0]]

    def col(name: str) -> int | None:
        return header.index(name) if name in header else None

    idx_nome = col("borrower_full_name")
    idx_cpf = col("borrower_taxpayer_id")
    idx_tel = col("borrower_phone") or col("borrower_phone_number")
    idx_email = col("borrower_email") or col("borrower_email_address")
    idx_pix = col("borrower_pix_key")
    idx_pix_tipo = col("borrower_pix_key_type")
    idx_nasc = col("borrower_birth_date") or col("borrower_date_of_birth")

    base: dict[str, dict[str, str | bool | None]] = {}
    if idx_nome is None:
        return base
    # A aba tem 1 linha por EMPRÉSTIMO, então o mesmo médico repete o nome em várias linhas.
    # Nome repetido só é ambíguo (possível homônimo de OUTRA Contratante) quando há CPFs
    # distintos — mesmo CPF em todas as linhas = mesma pessoa, PII legítima. Rastreia os CPFs
    # vistos por nome; ao detectar 2+ distintos, marca ambíguo e omite a PII (R-001, Princípio VI).
    cpfs_por_chave: dict[str, set[str]] = {}
    for row in values[1:]:
        nome = _trim(_cell(row, idx_nome))
        if not nome:
            continue
        chave = normalize_nome(nome)
        cpf = normaliza_cpf(_cell(row, idx_cpf)) if idx_cpf is not None else None
        # Dedup por DÍGITOS (robusto a máscara vs. número puro do mesmo médico).
        cpf_norm = re.sub(r"\D", "", cpf) if cpf else ""
        vistos = cpfs_por_chave.setdefault(chave, set())
        if cpf_norm:
            vistos.add(cpf_norm)
        if base.get(chave, {}).get("ambiguo"):
            continue  # já resolvido como homônimo real
        if len(vistos) > 1:
            base[chave] = {"ambiguo": True}
            continue
        if chave in base:
            continue  # mesma pessoa (mesmo CPF ou CPF ausente) — mantém a 1ª PII
        base[chave] = {
            "nome": nome,
            "cpf": cpf,
            "telefone": normaliza_telefone(_cell(row, idx_tel)) if idx_tel is not None else None,
            "email": _cell(row, idx_email) if idx_email is not None else None,
            "pix": _cell(row, idx_pix) if idx_pix is not None else None,
            "pix_tipo": _cell(row, idx_pix_tipo) if idx_pix_tipo is not None else None,
            "nascimento": _cell(row, idx_nasc) if idx_nasc is not None else None,
        }
    return base


def normalize_nome(nome: str) -> str:
    """Chave de join por nome (trim + caixa baixa + colapsa espaços)."""
    return " ".join(str(nome).strip().lower().split())


def _letras_maiusculas(texto: str | None) -> list[str]:
    """Letras [A-Z] de `texto`, sem acento, MAIÚSCULAS. Ignora espaços, dígitos e pontuação."""
    if not texto:
        return []
    sem_acento = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return [c for c in sem_acento.upper() if c.isalpha()]


def trigrama_default(contratante: str | None) -> str:
    """Trigrama padrão = 3 primeiras letras da contratante (sem acento, MAIÚSCULAS).

    Sem contratante resolvida (ou sem letras) → placeholder `???` (feature 009).
    """
    return "".join(_letras_maiusculas(contratante)[:TAMANHO_TRIGRAMA]) or TRIGRAMA_SEM_CONTRATANTE


def sanitiza_trigrama(bruto: str | None) -> str:
    """Override do gestor → até 3 letras MAIÚSCULAS sem acento. Vazio/sem letras → `""`
    (o chamador cai no `trigrama_default`)."""
    return "".join(_letras_maiusculas(bruto)[:TAMANHO_TRIGRAMA])


def trigrama_efetivo(contratante: str | None, override: str | None = None) -> str:
    """Trigrama que aparece no código: override do gestor (se houver) ou o padrão da contratante."""
    return sanitiza_trigrama(override) or trigrama_default(contratante)


def formatar_codigo(trigrama: str, sequencia: int) -> str:
    """Código exibido `TRI-00001` (feature 009). `sequencia` é 1-based, por Contratante."""
    return f"{trigrama}-{sequencia:0{LARGURA_SEQUENCIA}d}"
