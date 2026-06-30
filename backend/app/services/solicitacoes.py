"""Serviço de Solicitações (US2 parceiro / US5 gestor). contracts/api.md, research D9.

Busca/filtra/pagina/agrupa sobre o dataset VÁLIDO escopado (R-001). Agrupamento por médico
é apresentacional: ordena por médico antes de paginar e nunca corta um grupo entre páginas
(RF-009) — a página efetiva pode trazer >20 itens.
"""

from decimal import Decimal

from app.domain.filtros.engine import FiltroAplicado
from app.domain.filtros.engine import aplica as aplica_filtros
from app.domain.models import AppUser, Solicitacao
from app.domain.scope import escopo_permitido, filtra_por_escopo, is_gestor
from app.services.cores import cor_para
from app.services.dataset import Dataset
from app.services.serialize import money_str, serializa_medico, serializa_solicitacao

LIMIT_PADRAO = 20


def _aplica_escopo_e_filtros(
    dataset: Dataset,
    user: AppUser,
    q: str | None,
    filtros: list[FiltroAplicado] | None,
) -> list[Solicitacao]:
    """Escopo R-001 (sempre 1º) + filtros dinâmicos + busca. Ordena por médico (grupos juntos)."""
    # Escopo primeiro e separado: o filtro de UI nunca amplia o escopo do parceiro.
    itens = filtra_por_escopo(dataset.validas, user)
    itens = aplica_filtros(itens, filtros or [])

    if q:
        termo = q.strip().lower()
        itens = [s for s in itens if _casa_busca(s, termo)]

    # Agrupa por médico: ordenar por grupo deixa as linhas do mesmo médico contíguas.
    return sorted(itens, key=lambda s: (s.medico_grupo_id or "", s.codigo))


def _casa_busca(s: Solicitacao, termo: str) -> bool:
    """Busca por código, cliente ou status (label/chave)."""
    return (
        termo in s.codigo.lower()
        or termo in s.cliente.lower()
        or termo in s.status.lower()
        or termo in s.status_label.lower()
    )


def _pagina_sem_cortar_grupo(
    itens: list[Solicitacao], offset: int, limit: int
) -> tuple[list[Solicitacao], bool]:
    """Fatia [offset, offset+limit] e estende até fechar o grupo do médico (RF-009)."""
    total = len(itens)
    if offset >= total:
        return [], False
    fim = min(offset + limit, total)
    # Estende enquanto o próximo item pertence ao mesmo médico do último incluído.
    while fim < total and itens[fim].medico_grupo_id == itens[fim - 1].medico_grupo_id:
        fim += 1
    return itens[offset:fim], fim < total


def _serializa(s: Solicitacao, gestor: bool) -> dict:
    item = serializa_solicitacao(s, incluir_gestor=gestor)
    if gestor:
        item["cor_parceiro"] = cor_para(s.contratante)
    return item


def listar_solicitacoes(
    dataset: Dataset,
    user: AppUser,
    q: str | None = None,
    filtros: list[FiltroAplicado] | None = None,
    limit: int = LIMIT_PADRAO,
    offset: int = 0,
) -> dict:
    """Lista paginada/filtrável (escopada). Resposta: items, total, has_more."""
    filtradas = _aplica_escopo_e_filtros(dataset, user, q, filtros)
    gestor = is_gestor(user)
    pagina, has_more = _pagina_sem_cortar_grupo(filtradas, offset, limit)
    return {
        "items": [_serializa(s, gestor) for s in pagina],
        "total": len(filtradas),
        "has_more": has_more,
    }


def _resumo_medico(itens_escopo: list[Solicitacao], grupo_id: str | None, gestor: bool) -> dict:
    """Agrega as solicitações (já escopadas) do mesmo médico — card do painel lateral.

    Roda só sobre o que já passou por `filtra_por_escopo` (R-001): o total de antecipação
    do médico nunca soma linha de outro parceiro nem fora da allowlist de Unidades.
    """
    grupo = [s for s in itens_escopo if s.medico_grupo_id == grupo_id]
    n = len(grupo)
    valor_total = sum((s.valor for s in grupo), Decimal("0"))
    total_recebido = sum((s.recebido_cliente or Decimal("0") for s in grupo), Decimal("0"))
    total_rebate = sum((s.cashback for s in grupo), Decimal("0"))
    ticket = valor_total / n if n else Decimal("0")
    desde = min((s.data_pedido for s in grupo), default=None)
    resumo = {
        "n_solicitacoes": n,
        "valor_total": money_str(valor_total),
        "total_recebido_cliente": money_str(total_recebido),
        "total_rebate": money_str(total_rebate),
        "ticket_medio": money_str(ticket),
        "n_pagas": sum(1 for s in grupo if s.status == "pago"),
        "n_a_pagar": sum(1 for s in grupo if s.status == "a_pagar"),
        "n_atrasadas": sum(1 for s in grupo if s.status == "atrasado"),
        "unidades": sorted({s.unidade for s in grupo if s.unidade}),
        "desde": desde.isoformat() if desde else None,
    }
    if gestor:
        # Margem MedFlow só na visão do gestor (mesma máscara D5′ do item).
        total_lucro = sum((s.lucro_operacional or Decimal("0") for s in grupo), Decimal("0"))
        resumo["total_lucro_operacional"] = money_str(total_lucro)
    return resumo


def detalhe_solicitacao(dataset: Dataset, user: AppUser, codigo: str) -> dict | None:
    """Detalhe + médico enriquecido (PII) + resumo agregado do médico, escopado.

    Crítico (R-001): nunca devolve a solicitação — nem o médico, nem o resumo — de outro
    parceiro. None se fora do escopo/inexistente.
    """
    escopadas = escopo_permitido(user, None)
    gestor = is_gestor(user)
    for s in dataset.validas:
        if s.codigo != codigo:
            continue
        # Parceiro: só se a linha for do seu contratante. Gestor (escopadas=None): qualquer.
        if escopadas is not None and s.contratante not in {c.strip() for c in escopadas}:
            return None
        medico = dataset.medico_de(s.cliente)
        # Resumo do médico: só o mesmo contratante (evita fundir homônimos de outro
        # parceiro na visão consolidada do gestor) e sempre dentro do escopo do usuário.
        no_escopo = [
            x for x in filtra_por_escopo(dataset.validas, user) if x.contratante == s.contratante
        ]
        return {
            "solicitacao": _serializa(s, gestor),
            "medico": serializa_medico(medico),
            "resumo_medico": _resumo_medico(no_escopo, s.medico_grupo_id, gestor),
        }
    return None
