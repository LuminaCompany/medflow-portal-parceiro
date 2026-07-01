"""Cache TTL + stale-while-revalidate e o batchGet do client (otimização de latência)."""

import time

from app.config import Settings
from app.sheets.cache import TTLCache
from app.sheets.client import SheetsClient


def test_hot_cache_nao_recarrega():
    calls = {"n": 0}

    def loader() -> int:
        calls["n"] += 1
        return calls["n"]

    cache: TTLCache[int] = TTLCache(ttl_seconds=100)
    assert cache.get_or_load(loader) == 1
    assert cache.get_or_load(loader) == 1  # dentro do TTL → sem recarregar
    assert calls["n"] == 1


def test_swr_serve_velho_e_refaz_em_background():
    calls = {"n": 0}

    def loader() -> int:
        calls["n"] += 1
        return calls["n"]

    cache: TTLCache[int] = TTLCache(ttl_seconds=0)  # tudo vira velho na hora
    assert cache.get_or_load(loader) == 1  # frio: bloqueia e devolve v1
    # Velho: devolve v1 IMEDIATAMENTE (sem esperar a rede) e dispara refresh async.
    assert cache.get_or_load(loader) == 1
    for _ in range(200):  # aguarda o refresh em background concluir
        if calls["n"] >= 2:
            break
        time.sleep(0.01)
    assert calls["n"] == 2


def test_invalidate_forca_recarga():
    calls = {"n": 0}

    def loader() -> int:
        calls["n"] += 1
        return calls["n"]

    cache: TTLCache[int] = TTLCache(ttl_seconds=100)
    assert cache.get_or_load(loader) == 1
    cache.invalidate()
    assert cache.get_or_load(loader) == 2  # frio de novo → recarrega


class _FakeExec:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def execute(self) -> dict:
        return self._payload


class _FakeValues:
    def __init__(self, payload: dict, captured: dict) -> None:
        self._payload = payload
        self._captured = captured

    def batchGet(self, **kwargs):  # noqa: N802 (espelha a API do google client)
        self._captured.update(kwargs)
        return _FakeExec(self._payload)


class _FakeSpreadsheets:
    def __init__(self, payload: dict, captured: dict) -> None:
        self._values = _FakeValues(payload, captured)

    def values(self):
        return self._values


class _FakeService:
    def __init__(self, payload: dict, captured: dict) -> None:
        self._spreadsheets = _FakeSpreadsheets(payload, captured)

    def spreadsheets(self):
        return self._spreadsheets


def test_read_all_batchget_mapeia_ranges_em_ordem():
    payload = {
        "valueRanges": [
            {"values": [["a", 1]]},  # solicitacoes (int → normalizado p/ str)
            {"values": [["cliente", "contratante"]]},  # cadastro
            {},  # base sem valores
        ]
    }
    captured: dict = {}
    settings = Settings()
    client = SheetsClient(settings)
    client._get_service = lambda: _FakeService(payload, captured)  # type: ignore[method-assign]

    sol, cad, base = client.read_all()

    assert sol == [["a", "1"]]  # _to_str converteu o int
    assert cad == [["cliente", "contratante"]]
    assert base == []  # valueRange sem 'values' → lista vazia
    # Uma única chamada pedindo as 3 abas na ordem esperada.
    assert captured["ranges"] == [
        settings.sheet_tab_solicitacoes,
        settings.sheet_tab_cadastro,
        settings.sheet_tab_base,
    ]
