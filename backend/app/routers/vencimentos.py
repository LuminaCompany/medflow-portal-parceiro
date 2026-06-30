"""Router de Vencimentos — `GET /api/vencimentos` (T031, T053 gestor).

Parceiro: cards + atrasados/próximos/pagos (escopado). Gestor: consolidado ranqueado.
"""

from fastapi import APIRouter, Query, Request

from app.auth.deps import CurrentUser
from app.domain.filtros.engine import parse as parse_filtros
from app.domain.filtros.registry import ABA_VENCIMENTOS
from app.domain.scope import is_gestor
from app.services.dataset import get_dataset_service
from app.services.vencimentos import (
    PROXIMOS_DEFAULT,
    vencimentos_gestor,
    vencimentos_parceiro,
)

router = APIRouter(prefix="/api", tags=["vencimentos"])


@router.get("/vencimentos")
def get_vencimentos(
    request: Request,
    user: CurrentUser,
    proximos: str = Query(PROXIMOS_DEFAULT, description="2d | 1sem | 2sem"),
) -> dict:
    papel = "gestor" if is_gestor(user) else "parceiro"
    filtros = parse_filtros(request.query_params, ABA_VENCIMENTOS, papel)
    dataset = get_dataset_service().get()
    if is_gestor(user):
        return vencimentos_gestor(dataset.validas, filtros=filtros)
    return vencimentos_parceiro(dataset.validas, user, proximos=proximos, filtros=filtros)
