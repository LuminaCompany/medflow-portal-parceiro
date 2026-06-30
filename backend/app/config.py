"""Configuração central via variáveis de ambiente (Pydantic Settings).

Fonte única de verdade para segredos e parâmetros de runtime. Segredos NUNCA vivem
no código (Princípio IV da constituição) — só aqui, carregados do ambiente.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variáveis de ambiente do backend. Ver `backend/.env.example`."""

    # Fonte única: `.env` na raiz do repositório. Rodando de `backend/`, é `../.env`;
    # mantém `.env` local como fallback. Variáveis reais do ambiente têm prioridade.
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Google Sheets (fonte financeira) ---
    google_service_account_json: str = ""  # conteúdo do JSON da Service Account
    sheet_id: str = ""
    sheet_tab_solicitacoes: str = "Dados Tratados"
    sheet_tab_cadastro: str = "Cadastro de Clientes"
    sheet_tab_base: str = "base de dados"
    sheet_cache_ttl: int = 180  # segundos

    # --- Supabase (auth + usuários) ---
    supabase_url: str = ""
    supabase_anon_key: str = ""  # valida o token do usuário via /auth/v1/user
    supabase_service_role_key: str = ""  # SÓ no backend, nunca no frontend
    supabase_jwt_secret: str = ""  # opcional (validação local HS256, não usada por padrão)

    # --- HTTP ---
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """`CORS_ORIGINS` é csv no env; expõe como lista para o middleware."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Instância única (cacheada) das settings — evita reparsear o ambiente."""
    return Settings()
