"""Orquestra client → parser → validation.particiona, com cache TTL (T014).

Resultado: `Dataset` com (`validas`, `pendencias`) + mapa de PII do médico para o painel
de detalhes. É a fonte única que todos os serviços de feature consomem — todas as telas
operam sobre `validas`; só `/api/admin/pendencias` vê `pendencias`.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

from app.config import Settings, get_settings
from app.domain.datas import hoje
from app.domain.models import Medico, Pendencia, Solicitacao
from app.domain.validation import particiona
from app.sheets.cache import TTLCache
from app.sheets.client import SheetsClient
from app.sheets.parser import (
    normalize_nome,
    parse_base,
    parse_cadastro,
    parse_solicitacoes,
)


class EmptyDatasetError(RuntimeError):
    """Leitura da planilha veio vazia (transitória) — não deve virar snapshot cacheado."""


@dataclass
class Dataset:
    """Snapshot normalizado e particionado da planilha (uma janela de TTL)."""

    validas: list[Solicitacao]
    pendencias: list[Pendencia]
    base_medicos: dict[str, dict[str, str | bool | None]]  # nome normalizado → PII

    def medico_de(self, cliente: str) -> Medico:
        """PII do médico para o painel de detalhes (join por nome). Fallback: só o nome.

        Nome normalizado ambíguo (2+ médicos com mesmo nome na base, possível homônimo de
        outra Contratante) → devolve só o nome + flag `ambiguo`, sem PII (não vaza dado do
        homônimo). O `nome` vem da solicitação já escopada (R-001), não da base.
        """
        dados = self.base_medicos.get(normalize_nome(cliente))
        if not dados:
            return Medico(nome=cliente)
        if dados.get("ambiguo"):
            return Medico(nome=cliente, ambiguo=True)
        return Medico(**dados)


class DatasetService:
    """Carrega+normaliza+valida → (validas, pendencias), cacheado por TTL."""

    def __init__(
        self,
        settings: Settings,
        client: SheetsClient | None = None,
        trigramas_provider: Callable[[], dict[str, str]] | None = None,
    ) -> None:
        self._settings = settings
        self._client = client or SheetsClient(settings)
        self._cache: TTLCache[Dataset] = TTLCache(settings.sheet_cache_ttl)
        # Overrides de trigrama por Contratante (feature 009). Provider externo (config do
        # gestor no Auth); ausente/falha → {} (o parser cai no trigrama padrão de 3 letras).
        self._trigramas_provider = trigramas_provider

    def _trigramas(self) -> dict[str, str]:
        """Mapa contratante→trigrama override. Falha fechada: erro do Auth não derruba a carga."""
        if self._trigramas_provider is None:
            return {}
        try:
            return self._trigramas_provider()
        except Exception:  # noqa: BLE001 — sem overrides o código só cai no padrão, não quebra
            return {}

    def _load(self) -> Dataset:
        # Uma única chamada à Sheets API (batchGet) traz as 3 abas de uma vez.
        sol_rows, cad_rows, base_rows = self._client.read_all()
        # Sanity check: uma aba "Dados Tratados" saudável SEMPRE tem ao menos o cabeçalho.
        # Vazio total = leitura transitória (aba limpa/re-import em andamento). Tratar como erro
        # para NÃO substituir um snapshot bom por 0 solicitações (que viraria "tudo pago").
        if not sol_rows:
            raise EmptyDatasetError(
                "Aba de solicitações veio vazia — leitura transitória, mantém snapshot anterior."
            )
        cadastro = parse_cadastro(cad_rows)
        base = parse_base(base_rows)
        parsed = parse_solicitacoes(sol_rows)
        validas, pendencias = particiona(
            parsed, cadastro, hoje=hoje(), trigramas=self._trigramas()
        )
        return Dataset(validas=validas, pendencias=pendencias, base_medicos=base)

    def get(self) -> Dataset:
        """Dataset corrente (do cache ou recarregado no fim do TTL)."""
        return self._cache.get_or_load(self._load)

    def invalidate(self) -> None:
        self._cache.invalidate()


def _carrega_trigramas() -> dict[str, str]:
    """Overrides de trigrama por Contratante (feature 009), lidos do Auth (app_metadata).

    Import tardio evita ciclo (partners→auth→models). Chamado a cada recarga do sheet (TTL);
    quando o gestor muda um trigrama, o router de config invalida o cache p/ rebuild imediato.
    """
    from app.auth.supabase import get_supabase_auth
    from app.services.partners import PartnersService

    return PartnersService(get_supabase_auth().admin).mapa_trigramas()


@lru_cache
def get_dataset_service() -> DatasetService:
    """Instância única do serviço (cache TTL compartilhado por todo o processo)."""
    return DatasetService(get_settings(), trigramas_provider=_carrega_trigramas)
