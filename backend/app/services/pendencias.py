"""Serviço "Pendências de Dados" (US7, gestor-only). data-model §6, contracts/api.md.

Expõe as `pendencias` já particionadas pela validação (motivos + linha de origem) com busca
e paginação. NUNCA aparecem em nenhum outro endpoint nem em métrica (RF-035) — a partição
acontece no `dataset` e todas as outras telas usam só `validas`.

Pendência de divisão por unidade (feature 014) leva junto as unidades que o gestor pode
escolher ao repartir a linha no portal.
"""

from app.domain.models import Pendencia, Solicitacao
from app.domain.regras_contratante import siglas_unidade
from app.services.serialize import serializa_pendencia

LIMIT_PADRAO = 20


def _casa_busca(p: Pendencia, termo: str) -> bool:
    alvos = [p.codigo, p.cliente or "", p.contratante or "", p.obs or "", *p.motivos]
    return any(termo in a.lower() for a in alvos)


def opcoes_unidades(validas: list[Solicitacao], contratante: str | None) -> list[str]:
    """Unidades escolhíveis ao dividir uma linha da Contratante: as que já aparecem no sheet
    para ela + as da regra de siglas (PA/PS). Só unidades da PRÓPRIA Contratante."""
    unidades = set((siglas_unidade(contratante) or {}).values())
    unidades.update(s.unidade for s in validas if s.contratante == contratante and s.unidade)
    return sorted(unidades, key=str.lower)


def listar_pendencias(
    pendencias: list[Pendencia],
    q: str | None = None,
    limit: int = LIMIT_PADRAO,
    offset: int = 0,
    validas: list[Solicitacao] | None = None,
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

    opcoes: dict[str | None, list[str]] = {}
    for p in pagina:
        if p.divisao is not None and p.contratante not in opcoes:
            opcoes[p.contratante] = opcoes_unidades(validas or [], p.contratante)
    return {
        "items": [serializa_pendencia(p, opcoes.get(p.contratante)) for p in pagina],
        "total": total,
        "has_more": offset + limit < total,
    }
