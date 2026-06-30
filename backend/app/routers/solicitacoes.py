"""Router de Solicitações (T035, T052 lista de parceiros).

`GET /api/solicitacoes` (lista paginada/filtrável) e `GET /api/solicitacoes/{codigo}`
(detalhe + médico). Tudo escopado por Contratante no serviço (R-001).
"""

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi import status as http_status

from app.auth.deps import CurrentUser
from app.auth.supabase import get_supabase_auth
from app.domain.filtros.engine import parse as parse_filtros
from app.domain.filtros.registry import ABA_SOLICITACOES
from app.domain.scope import is_gestor
from app.services.cores import cor_para
from app.services.dataset import get_dataset_service
from app.services.partners import PartnersService
from app.services.solicitacoes import (
    LIMIT_PADRAO,
    detalhe_solicitacao,
    listar_solicitacoes,
)

router = APIRouter(prefix="/api", tags=["solicitacoes"])


def papel_de(user) -> str:
    return "gestor" if is_gestor(user) else "parceiro"


@router.get("/solicitacoes")
def get_solicitacoes(
    request: Request,
    user: CurrentUser,
    limit: int = Query(LIMIT_PADRAO, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
) -> dict:
    # Demais query params (status, unidade, valor, …) viram filtros dinâmicos via engine.
    filtros = parse_filtros(request.query_params, ABA_SOLICITACOES, papel_de(user))
    dataset = get_dataset_service().get()
    return listar_solicitacoes(
        dataset,
        user,
        q=q,
        filtros=filtros,
        limit=limit,
        offset=offset,
    )


@router.get("/solicitacoes/{codigo}")
def get_solicitacao(codigo: str, user: CurrentUser) -> dict:
    dataset = get_dataset_service().get()
    detalhe = detalhe_solicitacao(dataset, user, codigo)
    if detalhe is None:
        # 404 também quando a linha existe mas é de outro parceiro (não vaza existência).
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Solicitação não encontrada."},
        )
    return detalhe


@router.get("/parceiros/lista")
def get_parceiros_lista(user: CurrentUser) -> list[dict]:
    """Lista de contratantes distintos + cor + total — barra de botões do gestor (RF-022)."""
    if not is_gestor(user):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Acesso restrito ao gestor."},
        )
    dataset = get_dataset_service().get()
    totais: dict[str, int] = {}
    for s in dataset.validas:
        totais[s.contratante] = totais.get(s.contratante, 0) + 1
    # Cor escolhida pelo gestor (app_metadata) com fallback determinístico.
    cores = PartnersService(get_supabase_auth().admin).mapa_cores()
    return [
        {"contratante": c, "cor": cores.get(c) or cor_para(c), "total": t}
        for c, t in sorted(totais.items(), key=lambda kv: kv[1], reverse=True)
    ]
