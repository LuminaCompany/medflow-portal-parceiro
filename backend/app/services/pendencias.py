"""Serviço "Pendências de Dados" (US7, gestor-only). data-model §6, contracts/api.md.

Expõe as `pendencias` já particionadas pela validação (motivos + linha de origem) com busca
e paginação. NUNCA aparecem em nenhum outro endpoint nem em métrica (RF-035) — a partição
acontece no `dataset` e todas as outras telas usam só `validas`.
"""

from app.domain.models import Pendencia
from app.services.serialize import serializa_pendencia

LIMIT_PADRAO = 20


def _casa_busca(p: Pendencia, termo: str) -> bool:
    alvos = [p.codigo, p.cliente or "", p.contratante or "", *p.motivos]
    return any(termo in a.lower() for a in alvos)


def listar_pendencias(
    pendencias: list[Pendencia],
    q: str | None = None,
    limit: int = LIMIT_PADRAO,
    offset: int = 0,
) -> dict:
    """Lista paginada/filtrável de pendências (motivos[] + linha_origem)."""
    itens = pendencias
    if q:
        termo = q.strip().lower()
        itens = [p for p in itens if _casa_busca(p, termo)]

    # Ordena pela linha de origem — ajuda o gestor a localizar na planilha.
    itens = sorted(itens, key=lambda p: p.linha_origem)
    total = len(itens)
    pagina = itens[offset : offset + limit]
    return {
        "items": [serializa_pendencia(p) for p in pagina],
        "total": total,
        "has_more": offset + limit < total,
    }
