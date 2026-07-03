"""Orquestra client → parser → validation.particiona, com cache TTL (T014).

Resultado: `Dataset` com (`validas`, `pendencias`) + mapa de PII do médico para o painel
de detalhes. É a fonte única que todos os serviços de feature consomem — todas as telas
operam sobre `validas`; só `/api/admin/pendencias` vê `pendencias`.
"""

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

    def __init__(self, settings: Settings, client: SheetsClient | None = None) -> None:
        self._settings = settings
        self._client = client or SheetsClient(settings)
        self._cache: TTLCache[Dataset] = TTLCache(settings.sheet_cache_ttl)

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
        validas, pendencias = particiona(parsed, cadastro, hoje=hoje())
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
