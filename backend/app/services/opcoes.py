"""Opções de filtro escopadas por aba/usuário (spec 002 §3.2 / RF-F05).

Alimenta `GET /api/filtros/opcoes`. Os valores dinâmicos (unidades, médicos, meses,
contratantes, faixas de valor/data) saem do dataset VÁLIDO já escopado por Contratante —
o parceiro só recebe opções do próprio escopo (R-001). Metadados estáticos (label,
formato) vivem no registry do frontend; aqui só os valores.
"""

from datetime import date
from decimal import Decimal

from app.domain.filtros.registry import CampoFiltro, TipoFiltro, campos_da_aba
from app.domain.models import AppUser, Solicitacao
from app.domain.scope import filtra_por_escopo, is_gestor
from app.domain.status import STATUS_LABELS
from app.services.serialize import money_str


def opcoes_de_filtro(validas: list[Solicitacao], user: AppUser, aba: str) -> dict:
    """Campos disponíveis na aba + seus valores possíveis, escopados ao usuário."""
    escopadas = filtra_por_escopo(validas, user)
    papel = "gestor" if is_gestor(user) else "parceiro"
    campos = [_campo_opcoes(c, escopadas) for c in campos_da_aba(aba, papel)]
    return {"campos": campos}


def _campo_opcoes(campo: CampoFiltro, itens: list[Solicitacao]) -> dict:
    base = {"id": campo.id, "tipo": campo.tipo.value}
    if campo.tipo is TipoFiltro.MULTI:
        base["opcoes"] = _valores_multi(campo, itens)
    else:  # RANGE / DATE
        base.update(_faixa(campo, itens))
    return base


def _valores_multi(campo: CampoFiltro, itens: list[Solicitacao]) -> list[str]:
    """Valores distintos (ordenados) do campo. Status sempre traz os três rótulos fixos."""
    if campo.id == "status":
        return list(STATUS_LABELS.keys())
    brutos = {campo.get(s) for s in itens}
    return sorted(str(v) for v in brutos if v is not None and str(v) != "")


def _faixa(campo: CampoFiltro, itens: list[Solicitacao]) -> dict:
    """min/max do campo (None quando não há dados). Dinheiro vira string `N.NN`."""
    valores = [v for v in (campo.get(s) for s in itens) if v is not None]
    if not valores:
        return {"min": None, "max": None}
    lo, hi = min(valores), max(valores)
    return {"min": _fmt(lo), "max": _fmt(hi)}


def _fmt(v: object) -> str:
    if isinstance(v, Decimal):
        return money_str(v)
    if isinstance(v, date):
        return v.isoformat()
    return str(v)
