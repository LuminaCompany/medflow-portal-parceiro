"""Auth Supabase — valida o token e resolve o usuário → papel/contratante (T015).

O token do usuário é validado pelo próprio Supabase via `auth.get_user(token)`
(`GET /auth/v1/user`), o que dispensa o segredo de assinatura local e funciona tanto com
JWT HS256 quanto com chaves assimétricas (JWKS).

`role` e `contratante` vivem no **`app_metadata`** do usuário (`auth.users`) — editável só
por service role/admin, nunca pelo próprio usuário. É a base do isolamento (R-001): um
parceiro não consegue se promover a gestor (ao contrário de `user_metadata`, que o usuário
pode alterar via API pública). `nome_exibicao` vem do `user_metadata` (display name).
"""

from functools import lru_cache

from supabase import Client, create_client

from app.config import Settings, get_settings
from app.domain.models import AppUser


class AuthError(Exception):
    """Falha de autenticação/autorização (mapeada para 401 no handler)."""


class SupabaseAuth:
    """Valida tokens (via Supabase) e resolve o perfil do usuário (`app_metadata`)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._anon: Client | None = None
        self._admin: Client | None = None

    def _get_anon(self) -> Client:
        """Client com anon key — usado só para validar o token do usuário (get_user)."""
        if self._anon is None:
            self._anon = create_client(
                self._settings.supabase_url,
                self._settings.supabase_anon_key,
            )
        return self._anon

    def _get_admin(self) -> Client:
        """Client com service role — Admin API do Auth (gerência de logins). Nunca no front."""
        if self._admin is None:
            self._admin = create_client(
                self._settings.supabase_url,
                self._settings.supabase_service_role_key,
            )
        return self._admin

    def resolve_user(self, token: str) -> AppUser:
        """Token → AppUser (papel + contratante do `app_metadata`). Falha fechada."""
        try:
            resp = self._get_anon().auth.get_user(token)
        except Exception as exc:  # noqa: BLE001 — qualquer falha vira 401
            raise AuthError("Token inválido ou expirado.") from exc

        user = getattr(resp, "user", None)
        if user is None or not getattr(user, "id", None):
            raise AuthError("Token inválido ou expirado.")

        return montar_app_user(user)

    @property
    def admin(self) -> Client:
        """Acesso ao client service role para os serviços de administração de logins."""
        return self._get_admin()


def montar_app_user(user: object) -> AppUser:
    """Constrói o AppUser a partir do usuário do Auth (app_metadata + user_metadata).

    `role` ausente → `parceiro` (falha fechada: sem contratante, não vê dado de ninguém).
    """
    app_meta = getattr(user, "app_metadata", None) or {}
    user_meta = getattr(user, "user_metadata", None) or {}
    email = getattr(user, "email", "") or ""
    nome = (
        user_meta.get("display_name")
        or user_meta.get("full_name")
        or user_meta.get("name")
        or email
    )
    return AppUser(
        id=str(getattr(user, "id", "")),
        email=email,
        role=app_meta.get("role") or "parceiro",
        contratante=app_meta.get("contratante"),
        nome_exibicao=nome,
        unidades=_unidades_meta(app_meta),
    )


def _unidades_meta(app_meta: dict) -> list[str] | None:
    """Allowlist de Unidades do `app_metadata` (feature 003). Chave ausente → None
    (sem restrição, back-compat); lista presente → allowlist explícita."""
    raw = app_meta.get("unidades")
    if raw is None:
        return None
    return [str(u) for u in raw]


@lru_cache
def get_supabase_auth() -> SupabaseAuth:
    return SupabaseAuth(get_settings())
