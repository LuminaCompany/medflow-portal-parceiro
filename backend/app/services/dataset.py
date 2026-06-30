"""Orquestra client → parser → validation.particiona, com cache TTL (T014).

Resultado: `Dataset` com (`validas`, `pendencias`) + mapa de PII do médico para o painel
de detalhes. É a fonte única que todos os serviços de feature consomem — todas as telas
operam sobre `validas`; só `/api/admin/pendencias` vê `pendencias`.
"""

from dataclasses import dataclass
from datetime import date
from functools import lru_cache

from app.config import Settings, get_settings
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


@dataclass
class Dataset:
    """Snapshot normalizado e particionado da planilha (uma janela de TTL)."""

    validas: list[Solicitacao]
    pendencias: list[Pendencia]
    base_medicos: dict[str, dict[str, str | None]]  # nome normalizado → PII

    def medico_de(self, cliente: str) -> Medico:
        """PII do médico para o painel de detalhes (join por nome). Fallback: só o nome."""
        dados = self.base_medicos.get(normalize_nome(cliente))
        if not dados:
            return Medico(nome=cliente)
        return Medico(**dados)


class DatasetService:
    """Carrega+normaliza+valida → (validas, pendencias), cacheado por TTL."""

    def __init__(self, settings: Settings, client: SheetsClient | None = None) -> None:
        self._settings = settings
        self._client = client or SheetsClient(settings)
        self._cache: TTLCache[Dataset] = TTLCache(settings.sheet_cache_ttl)

    def _load(self) -> Dataset:
        cadastro = parse_cadastro(self._client.read_cadastro())
        base = parse_base(self._client.read_base())
        parsed = parse_solicitacoes(self._client.read_solicitacoes())
        validas, pendencias = particiona(parsed, cadastro, hoje=date.today())
        return Dataset(validas=validas, pendencias=pendencias, base_medicos=base)

    def get(self) -> Dataset:
        """Dataset corrente (do cache ou recarregado no fim do TTL)."""
        return self._cache.get_or_load(self._load)

    def invalidate(self) -> None:
        self._cache.invalidate()


@lru_cache
def get_dataset_service() -> DatasetService:
    """Instância única do serviço (cache TTL compartilhado por todo o processo)."""
    return DatasetService(get_settings())
