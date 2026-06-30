"""Router de Visão Geral — `GET /api/overview` (T048). Parceiro escopado / gestor global."""

from fastapi import APIRouter, Query, Request

from app.auth.deps import CurrentUser
from app.domain.filtros.engine import parse as parse_filtros
from app.domain.filtros.registry import ABA_OVERVIEW
from app.domain.scope import is_gestor
from app.services.dataset import get_dataset_service
from app.services.overview import overview

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview")
def get_overview(
    request: Request,
    user: CurrentUser,
    ano: int | None = Query(None, description="ano de originação; default = ano corrente"),
    meses: str | None = Query(None, description="meses 1-12 (csv); vazio = ano inteiro"),
) -> dict:
    papel = "gestor" if is_gestor(user) else "parceiro"
    filtros = parse_filtros(request.query_params, ABA_OVERVIEW, papel)
    meses_sel = [int(m) for m in meses.split(",") if m.strip()] if meses else None
    dataset = get_dataset_service().get()
    return overview(dataset.validas, user, ano=ano, meses=meses_sel, filtros=filtros)
