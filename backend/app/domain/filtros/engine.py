"""Engine de filtros — parse (query → filtros) + aplica (filtros → itens) (spec 002 §3.2).

Puro, sem I/O. O escopo R-001 NÃO é tratado aqui: os serviços aplicam
`filtra_por_escopo` antes e só então passam a lista escopada para `aplica`. Um param
inválido é ignorado (filtro de UI não deve derrubar a requisição).
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from app.domain.filtros.registry import REGISTRY, CampoFiltro, TipoFiltro
from app.domain.models import Solicitacao

_SEP_RANGE = ".."


@dataclass(frozen=True)
class FiltroAplicado:
    """Um filtro parseado e pronto para aplicar."""

    campo: CampoFiltro
    valor: Any  # set[str] (MULTI) | (min, max) numérico (RANGE) | (ini, fim) datas (DATE)


def parse(params: Mapping[str, str], aba: str, papel: str) -> list[FiltroAplicado]:
    """Lê os query params e devolve os filtros válidos para a aba/papel.

    Ignora params desconhecidos, fora da aba, não permitidos ao papel ou malformados.
    """
    filtros: list[FiltroAplicado] = []
    for chave, bruto in params.items():
        campo = REGISTRY.get(chave)
        if campo is None or aba not in campo.abas or papel not in campo.papeis:
            continue
        if not bruto or not bruto.strip():
            continue
        valor = _parse_valor(campo.tipo, bruto.strip())
        if valor is not None:
            filtros.append(FiltroAplicado(campo, valor))
    return filtros


def aplica(itens: list[Solicitacao], filtros: list[FiltroAplicado]) -> list[Solicitacao]:
    """Aplica todos os filtros em AND. Lista vazia de filtros = devolve tudo."""
    if not filtros:
        return itens
    return [s for s in itens if all(_casa(f, s) for f in filtros)]


# --- parsing por tipo --------------------------------------------------------------

def _parse_valor(tipo: TipoFiltro, bruto: str) -> Any | None:
    if tipo is TipoFiltro.MULTI:
        opcoes = {v.strip() for v in bruto.split(",") if v.strip()}
        return opcoes or None
    if tipo is TipoFiltro.RANGE:
        return _parse_range(bruto, _to_decimal)
    if tipo is TipoFiltro.DATE:
        return _parse_range(bruto, _to_date)
    return None


def _parse_range(bruto: str, conv) -> tuple[Any, Any] | None:
    """`min..max` com bordas abertas (`..max`, `min..`). Sem `..` => igualdade exata."""
    if _SEP_RANGE in bruto:
        lo_raw, hi_raw = bruto.split(_SEP_RANGE, 1)
    else:
        lo_raw = hi_raw = bruto
    lo = conv(lo_raw) if lo_raw.strip() else None
    hi = conv(hi_raw) if hi_raw.strip() else None
    if lo is None and hi is None:
        return None
    return (lo, hi)


def _to_decimal(raw: str) -> Decimal | None:
    try:
        return Decimal(raw.strip())
    except (InvalidOperation, ValueError):
        return None


def _to_date(raw: str) -> date | None:
    try:
        return date.fromisoformat(raw.strip())
    except ValueError:
        return None


# --- predicados por tipo -----------------------------------------------------------

def _casa(f: FiltroAplicado, s: Solicitacao) -> bool:
    v = f.campo.get(s)
    if v is None:
        return False  # campo ausente nunca casa um filtro ativo
    if f.campo.tipo is TipoFiltro.MULTI:
        return str(v) in f.valor
    # RANGE e DATE compartilham a comparação min/max.
    lo, hi = f.valor
    if lo is not None and v < lo:
        return False
    return hi is None or v <= hi
