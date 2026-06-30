"""Dependências FastAPI de autenticação/autorização (T016).

`get_current_user` resolve o usuário do Bearer token; `require_gestor` barra parceiros
em rotas `/api/admin/*` (403, RF-028/034). O isolamento por dados é aplicado nos serviços
(scope.py); aqui guardamos só o papel.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.auth.supabase import AuthError, SupabaseAuth, get_supabase_auth
from app.domain.models import AppUser
from app.domain.scope import is_gestor


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    auth: SupabaseAuth = Depends(get_supabase_auth),
) -> AppUser:
    """Extrai e valida o Bearer token → AppUser. 401 se ausente/inválido."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": "Autenticação necessária."},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        return auth.resolve_user(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": str(exc)},
        ) from exc


CurrentUser = Annotated[AppUser, Depends(get_current_user)]


def require_gestor(user: CurrentUser) -> AppUser:
    """Garante papel gestor. 403 ao parceiro (mensagem pt-BR, sem vazar detalhe)."""
    if not is_gestor(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Acesso restrito ao gestor."},
        )
    return user


GestorUser = Annotated[AppUser, Depends(require_gestor)]
