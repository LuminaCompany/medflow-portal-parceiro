"""Router da conta do próprio usuário (feature 007) — `POST /api/me/trocar-senha`.

Troca de senha obrigatória no 1º acesso do gestor. O alvo é SEMPRE o dono do token
(`GestorUser.id`), nunca vem do corpo — não há como um usuário alterar a senha de outro.
Gestor-only (a troca forçada só se aplica a gestores; feature 007).
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.deps import GestorUser
from app.auth.supabase import get_supabase_auth
from app.services.conta import SENHA_MIN, ContaError, trocar_senha

router = APIRouter(prefix="/api/me", tags=["conta"])


class TrocarSenhaIn(BaseModel):
    nova_senha: str = Field(min_length=SENHA_MIN)


@router.post("/trocar-senha", status_code=status.HTTP_204_NO_CONTENT)
def post_trocar_senha(body: TrocarSenhaIn, gestor: GestorUser) -> None:
    """Define a nova senha do gestor autenticado e limpa a flag de troca obrigatória."""
    try:
        trocar_senha(get_supabase_auth().admin, gestor.id, body.nova_senha)
    except ContaError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "bad_request", "message": str(exc)},
        ) from exc
