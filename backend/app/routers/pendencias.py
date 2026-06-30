"""Router "Pendências de Dados" — `GET /api/admin/pendencias` (T044, gestor-only RF-034)."""

from fastapi import APIRouter, Query

from app.auth.deps import GestorUser
from app.services.dataset import get_dataset_service
from app.services.pendencias import LIMIT_PADRAO, listar_pendencias

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/pendencias")
def get_pendencias(
    _: GestorUser,
    q: str | None = None,
    limit: int = Query(LIMIT_PADRAO, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    dataset = get_dataset_service().get()
    return listar_pendencias(dataset.pendencias, q=q, limit=limit, offset=offset)
