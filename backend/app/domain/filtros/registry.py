"""Registry de campos filtráveis — FONTE ÚNICA do backend (spec 002 §3.2).

Cada `CampoFiltro` declara: como extrair o valor da solicitação (`get`), o tipo de
comparação (`tipo`), em quais abas aparece e para quais papéis. Adicionar um filtro novo
= acrescentar uma entrada aqui (e o `CampoDef` espelho no frontend). Nada de tocar nos
serviços ou rotas.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any

from app.domain.models import Solicitacao

# Identificadores de aba (casam com o `?aba=` e com o registry do frontend).
ABA_SOLICITACOES = "solicitacoes"
ABA_VENCIMENTOS = "vencimentos"
ABA_OVERVIEW = "overview"

PAPEL_PARCEIRO = "parceiro"
PAPEL_GESTOR = "gestor"
_AMBOS = frozenset({PAPEL_PARCEIRO, PAPEL_GESTOR})


class TipoFiltro(StrEnum):
    """Operador de comparação aplicado pelo engine."""

    MULTI = "multi"  # valor ∈ conjunto (csv na query)
    RANGE = "range"  # min ≤ valor ≤ max, numérico (`min..max` na query)
    DATE = "date"  # ini ≤ data ≤ fim (`ini..fim` ISO na query)


@dataclass(frozen=True)
class CampoFiltro:
    """Definição de um campo filtrável."""

    id: str
    tipo: TipoFiltro
    get: Callable[[Solicitacao], Any]
    abas: frozenset[str]
    papeis: frozenset[str] = _AMBOS


def _mes_key(valor_mes: str | None, fallback: date) -> str:
    """Normaliza `mm/aaaa` (planilha) para `aaaa-mm`; cai em `data` quando ausente."""
    if valor_mes and "/" in valor_mes:
        mm, aaaa = valor_mes.split("/", 1)
        return f"{aaaa.strip()}-{mm.strip().zfill(2)}"
    return f"{fallback.year:04d}-{fallback.month:02d}"


def mes_originacao_key(s: Solicitacao) -> str:
    return _mes_key(s.mes_originacao, s.data_pedido)


def mes_vencimento_key(s: Solicitacao) -> str:
    return _mes_key(s.mes_vencimento, s.data_vencimento)


# Registry — único dict. Ordem aqui = ordem sugerida no popover "Adicionar filtro".
REGISTRY: dict[str, CampoFiltro] = {
    "status": CampoFiltro(
        "status", TipoFiltro.MULTI, lambda s: s.status,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS, ABA_OVERVIEW}),
    ),
    "unidade": CampoFiltro(
        "unidade", TipoFiltro.MULTI, lambda s: s.unidade,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS, ABA_OVERVIEW}),
    ),
    "medico": CampoFiltro(
        "medico", TipoFiltro.MULTI, lambda s: s.cliente,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS}),
    ),
    "valor": CampoFiltro(
        "valor", TipoFiltro.RANGE, lambda s: s.valor,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS}),
    ),
    "data_pedido": CampoFiltro(
        "data_pedido", TipoFiltro.DATE, lambda s: s.data_pedido,
        frozenset({ABA_SOLICITACOES}),
    ),
    "data_vencimento": CampoFiltro(
        "data_vencimento", TipoFiltro.DATE, lambda s: s.data_vencimento,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS}),
    ),
    "mes_originacao": CampoFiltro(
        "mes_originacao", TipoFiltro.MULTI, mes_originacao_key,
        frozenset({ABA_SOLICITACOES}),
    ),
    "mes_vencimento": CampoFiltro(
        "mes_vencimento", TipoFiltro.MULTI, mes_vencimento_key,
        frozenset({ABA_SOLICITACOES}),
    ),
    "cashback": CampoFiltro(
        "cashback", TipoFiltro.RANGE, lambda s: s.cashback,
        frozenset({ABA_SOLICITACOES}),
    ),
    "prazo_dias": CampoFiltro(
        "prazo_dias", TipoFiltro.RANGE, lambda s: s.prazo_dias,
        frozenset({ABA_SOLICITACOES}),
    ),
    # Só gestor — o parceiro nunca filtra por contratante (papeis restrito + escopo R-001).
    "contratante": CampoFiltro(
        "contratante", TipoFiltro.MULTI, lambda s: s.contratante,
        frozenset({ABA_SOLICITACOES, ABA_VENCIMENTOS, ABA_OVERVIEW}),
        papeis=frozenset({PAPEL_GESTOR}),
    ),
}


def campos_da_aba(aba: str, papel: str) -> list[CampoFiltro]:
    """Campos disponíveis para uma aba e papel (alimenta o endpoint de opções)."""
    return [c for c in REGISTRY.values() if aba in c.abas and papel in c.papeis]
