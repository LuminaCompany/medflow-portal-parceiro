"""Router de auth/sessão — `GET /api/me` (T018).

Alimenta header/menu de conta e o roteamento por papel no frontend.
"""

from fastapi import APIRouter

from app.auth.deps import CurrentUser
from app.domain.models import AppUser

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/me", response_model=AppUser)
def get_me(user: CurrentUser) -> AppUser:
    """Usuário atual: id, nome_exibicao, role, contratante (null p/ gestor)."""
    return user
