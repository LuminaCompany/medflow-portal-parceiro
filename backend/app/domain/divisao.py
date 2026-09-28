"""Divisão de uma antecipação sem Unidade em N unidades (feature 014 — A.H. GESTÃO MÉDICA).

Quando o atendimento lança PA e PS numa linha só, a Unidade Referência fica vazia e a divisão
vai na coluna OBS, em formatos variados (vistos na planilha real):

    "PA (175) e PS (1550)"      "PS (4.650,00) e PA (5.200,00)"    "PA 350 e PS 7200"
    "PA (175) PS (1550)"        "PA (1.200,00) e PS (2.050,00) (safra de 10.07 - …)"
    "PA e PS"  /  "PS e PA"     (sem valor → o gestor informa no portal)

O leitor é tolerante (caixa, "P.A.", "PA:350", "PA-350", "PA=R$ 350", sem espaço, moeda BR ou
US, parênteses de comentário) e **falha fechado**: qualquer texto que sobre sem ser entendido
(ex.: "NEO", "UTI", "avaliar") ou valores que não somem a Originação mandam a linha para a
pendência de divisão — nunca inventa uma repartição.

Resolvida a divisão, a linha vira N solicitações (uma por unidade). Os demais valores em
dinheiro (cashback/rebate, IOF, recebido…) são rateados na proporção da Originação de cada
parte; a última parte absorve o arredondamento (a soma sempre bate com a linha original).
"""

import re
from dataclasses import dataclass, replace
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.domain.models import ParteDivisao
from app.sheets.parser import ParsedSolicitacao

CENTAVO = Decimal("0.01")
# Diferença máxima entre Σ(valores da OBS) e a Originação que ainda é só arredondamento: a
# planilha tem Originação 5.399,99 p/ "PS (3.350,00) e PA (2.050,00)". Acima disso, pendência.
TOLERANCIA = Decimal("1.00")
MAX_PARTES = 6

# Motivos da pendência de divisão (exibidos ao gestor).
MOTIVO_SEM_VALOR = "PA/PS sem valor"
MOTIVO_NAO_CONFERE = "Valores da observação não batem com a Originação"
MOTIVO_NAO_IDENTIFICADA = "Unidade não identificada na observação"
MOTIVO_SEM_OBS = "Unidade e observação vazias"
MOTIVO_SALVA_DIVERGENTE = "Divisão salva não confere com a Originação atual"

# Campos em dinheiro rateados entre as partes (Originação é a própria parte).
_CAMPOS_RATEADOS = (
    "recebido_cliente",
    "iof",
    "juros_descontos",
    "lucro_operacional",
    "agio_base",
    "cashback",
)

_LETRA = "A-Za-zÀ-ÿ"
# Sigla isolada: "PA", "ps", "P.A.", "P. S", "PA350". Não casa dentro de palavra ("PAGAMENTOS").
_SIGLA_RE = re.compile(rf"(?<![{_LETRA}])P\s?\.?\s?([AS])\.?(?![{_LETRA}])", re.IGNORECASE)
# Valor logo após a sigla: "PA 350", "PA (175)", "PA: R$ 1.200,00", "PA-350", "PA=350".
_VALOR_RE = re.compile(r"\s*[:=\-–]?\s*\(?\s*(?:R\$\s*)?(\d[\d.,]*)\s*\)?", re.IGNORECASE)
_PARENTESES_RE = re.compile(r"\([^()]*\)")
_TEM_LETRA_RE = re.compile(rf"[{_LETRA}]")
# O que pode sobrar entre as partes sem mudar o sentido: "e", vírgula, hífen, "+", "/", "R$"…
_CONECTORES_RE = re.compile(
    rf"(?<![{_LETRA}])e(?![{_LETRA}])|R\$|[\s,;/+&=:()\-–—.]", re.IGNORECASE
)


@dataclass(frozen=True)
class DivisaoSalva:
    """Divisão definida pelo gestor no portal (tabela `divisoes_unidade`)."""

    id: str
    valor_total: Decimal  # Originação da linha quando foi salva (trava contra mudança no sheet)
    partes: tuple[ParteDivisao, ...]


@dataclass(frozen=True)
class Resultado:
    """`partes` preenchido = divisão resolvida (soma = Originação). Senão, `motivo` da
    pendência e a `sugestao` lida (pré-preenche o editor do gestor)."""

    partes: tuple[ParteDivisao, ...] | None
    sugestao: tuple[ParteDivisao, ...]
    motivo: str | None


def centavos(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def parse_valor(texto: str) -> Decimal | None:
    """Número escrito à mão → Decimal. Aceita BR ("1.200,50", "10.275", "175,00") e US
    ("1,200.50", "1200.5"). Ambíguo/ilegível → None."""
    t = texto.strip().rstrip(".,")
    if not t:
        return None
    if "," in t and "." in t:
        # O último separador é o decimal.
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")
        else:
            t = t.replace(",", "")
    elif "," in t:
        grupos = t.split(",")
        if len(grupos) == 2 and len(grupos[1]) in (1, 2):
            t = t.replace(",", ".")  # decimal BR
        elif all(len(g) == 3 for g in grupos[1:]):
            t = t.replace(",", "")  # milhar
        else:
            return None
    elif "." in t:
        grupos = t.split(".")
        if all(len(g) == 3 for g in grupos[1:]):
            t = t.replace(".", "")  # milhar BR ("10.275")
        elif len(grupos) != 2:
            return None  # "1.2.3" — ilegível
    try:
        return Decimal(t)
    except InvalidOperation:
        return None


def _sem_comentarios(obs: str) -> str:
    """Remove parênteses de comentário ("(safra de 10.07 - 4 pagamentos …)"). Mantém os que
    são só número ("(175)") ou que citam uma sigla ("(PA 350)")."""

    def troca(m: re.Match[str]) -> str:
        grupo = m.group(0)
        if _TEM_LETRA_RE.search(grupo) and not _SIGLA_RE.search(grupo):
            return " "
        return grupo

    return _PARENTESES_RE.sub(troca, obs)


def le_siglas(obs: str | None) -> tuple[list[tuple[str, Decimal | None]], bool]:
    """Lê `[("PA"|"PS", valor|None), …]` na ordem escrita + se sobrou texto não entendido."""
    if not obs:
        return [], False
    texto = _sem_comentarios(str(obs))
    lidas: list[tuple[str, Decimal | None]] = []
    resto: list[str] = []
    pos = 0
    for m in _SIGLA_RE.finditer(texto):
        if m.start() < pos:
            continue  # já consumido como valor da sigla anterior
        resto.append(texto[pos : m.start()])
        fim = m.end()
        valor: Decimal | None = None
        mv = _VALOR_RE.match(texto, fim)
        if mv:
            valor = parse_valor(mv.group(1))
            if valor is None:
                resto.append(mv.group(1))  # número ilegível → não reconhecido
            fim = mv.end()
        lidas.append((f"P{m.group(1).upper()}", valor))
        pos = fim
    resto.append(texto[pos:])
    sobra = _CONECTORES_RE.sub("", "".join(resto))
    return lidas, bool(sobra)


def le_obs(obs: str | None, siglas: dict[str, str], total: Decimal) -> Resultado:
    """Interpreta a OBS de uma linha sem Unidade. Só resolve quando não há dúvida."""
    if not (obs or "").strip():
        return Resultado(None, (), MOTIVO_SEM_OBS)
    lidas, sobrou = le_siglas(obs)
    sugestao: list[ParteDivisao] = []
    for sigla, valor in lidas:
        unidade = siglas.get(sigla)
        if unidade and all(p.unidade != unidade for p in sugestao):
            sugestao.append(ParteDivisao(unidade=unidade, valor=valor))
    sug = tuple(sugestao)

    if not lidas:
        return Resultado(None, sug, MOTIVO_NAO_IDENTIFICADA)
    repetida = len(sug) != len(lidas)
    if sobrou or repetida:
        return Resultado(None, sug, MOTIVO_NAO_IDENTIFICADA)

    valores = [p.valor for p in sug]
    faltam = sum(v is None for v in valores)
    conhecidos = [v for v in valores if v is not None]
    if any(v <= 0 for v in conhecidos):
        return Resultado(None, sug, MOTIVO_NAO_CONFERE)

    if faltam == len(sug):
        # Uma sigla só e sem valor ("PS") → a linha inteira é daquela unidade.
        if len(sug) == 1:
            return Resultado((ParteDivisao(unidade=sug[0].unidade, valor=total),), sug, None)
        return Resultado(None, sug, MOTIVO_SEM_VALOR)

    if faltam == 1:
        # "PA (350) e PS" → PS = Originação − 350.
        resto = total - sum(conhecidos, Decimal("0"))
        if resto < CENTAVO:
            return Resultado(None, sug, MOTIVO_NAO_CONFERE)
        partes = tuple(
            ParteDivisao(unidade=p.unidade, valor=p.valor if p.valor is not None else resto)
            for p in sug
        )
        return Resultado(partes, sug, None)

    if faltam > 1:
        return Resultado(None, sug, MOTIVO_SEM_VALOR)

    # Todas com valor: a soma tem de bater (tolerância só p/ arredondamento de centavos).
    diferenca = total - sum(conhecidos, Decimal("0"))
    if abs(diferenca) > TOLERANCIA:
        return Resultado(None, sug, MOTIVO_NAO_CONFERE)
    maior = max(range(len(sug)), key=lambda i: conhecidos[i])
    partes = tuple(
        ParteDivisao(unidade=p.unidade, valor=p.valor + (diferenca if i == maior else 0))
        for i, p in enumerate(sug)
    )
    return Resultado(partes, sug, None)


def resolve(
    obs: str | None,
    total: Decimal,
    siglas: dict[str, str],
    salva: DivisaoSalva | None = None,
) -> Resultado:
    """Divisão salva pelo gestor vence a OBS — mas só enquanto a Originação não mudar."""
    if salva is not None:
        if centavos(salva.valor_total) != centavos(total):
            return Resultado(None, salva.partes, MOTIVO_SALVA_DIVERGENTE)
        return Resultado(salva.partes, salva.partes, None)
    return le_obs(obs, siglas, total)


def rateia(total: Decimal | None, pesos: list[Decimal]) -> list[Decimal | None]:
    """Reparte `total` na proporção de `pesos`; a última cota absorve o arredondamento."""
    if total is None:
        return [None] * len(pesos)
    soma = sum(pesos, Decimal("0"))
    cotas = [centavos(total * p / soma) for p in pesos[:-1]]
    return [*cotas, total - sum(cotas, Decimal("0"))]


def reparte(item: ParsedSolicitacao, partes: tuple[ParteDivisao, ...]) -> list[ParsedSolicitacao]:
    """Uma linha → N linhas (uma por unidade), com os valores em dinheiro rateados."""
    pesos = [p.valor for p in partes if p.valor is not None]
    assert len(pesos) == len(partes), "divisão resolvida sempre tem valor em todas as partes"
    rateios = {campo: rateia(getattr(item, campo), pesos) for campo in _CAMPOS_RATEADOS}
    saida = []
    for i, parte in enumerate(partes):
        extras = {campo: rateios[campo][i] for campo in _CAMPOS_RATEADOS}
        saida.append(
            replace(
                item,
                unidade=parte.unidade,
                valor=parte.valor,
                parte=i + 1,
                parse_errors=list(item.parse_errors),
                **extras,
            )
        )
    return saida
