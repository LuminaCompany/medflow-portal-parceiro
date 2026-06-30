"""Router de filtros — `GET /api/filtros/opcoes?aba=` (spec 002 §3.2).

Devolve os campos filtráveis da aba e seus valores possíveis, escopados ao usuário
(R-001). Os metadados estáticos ficam no registry do frontend.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status

from app.auth.deps import CurrentUser
from app.domain.filtros.registry import ABA_OVERVIEW, ABA_SOLICITACOES, ABA_VENCIMENTOS
from app.services.dataset import get_dataset_service
from app.services.opcoes import opcoes_de_filtro

router = APIRouter(prefix="/api", tags=["filtros"])

_ABAS_VALIDAS = {ABA_SOLICITACOES, ABA_VENCIMENTOS, ABA_OVERVIEW}


@router.get("/filtros/opcoes")
def get_opcoes(
    user: CurrentUser,
    aba: str = Query(..., description="solicitacoes | vencimentos | overview"),
) -> dict:
    if aba not in _ABAS_VALIDAS:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "bad_request", "message": "Aba inválida."},
        )
    dataset = get_dataset_service().get()
    return opcoes_de_filtro(dataset.validas, user, aba)
