"""Cache em processo com TTL + stale-while-revalidate (research D2).

O backend roda como container persistente (VPS/EasyPanel) → o cache sobrevive entre
requisições por toda a vida do container. TTL evita reparsear e protege a quota da
Sheets API. KISS: sem Redis/DB no MVP.

Stale-while-revalidate: passado o TTL, servimos o valor VELHO na hora e disparamos UM
refresh em background (single-flight). Nenhuma requisição de usuário espera a rede —
só o 1º load (cache frio) bloqueia. Isso mata o pico de latência que existia quando
todas as requisições travavam no lock durante o reload no fim de cada janela de TTL.
"""

import logging
import time
from collections.abc import Callable
from threading import Lock, Thread
from typing import Generic, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Cache de um único valor com expiração por tempo + SWR, thread-safe."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._value: T | None = None
        self._expires_at: float = 0.0
        self._lock = Lock()  # protege o estado e serializa o load frio (single-flight)
        self._refreshing = False  # garante um único refresh em background por vez

    def get_or_load(self, loader: Callable[[], T]) -> T:
        """Valor corrente sem esperar a rede quando já há cache.

        - Quente (dentro do TTL): retorna direto.
        - Velho (após o TTL) mas presente: retorna o velho e agenda refresh assíncrono.
        - Frio (sem valor): bloqueia só a 1ª requisição; concorrentes aguardam o mesmo
          resultado sob o lock (sem recarregar em duplicidade).
        """
        with self._lock:
            if self._value is not None:
                if time.monotonic() < self._expires_at:
                    return self._value  # quente
                self._maybe_spawn_refresh(loader)  # velho → refresh em background
                return self._value  # serve o velho imediatamente
            # Frio: carrega bloqueando, single-flight sob o lock.
            self._value = loader()
            self._expires_at = time.monotonic() + self._ttl
            return self._value

    def _maybe_spawn_refresh(self, loader: Callable[[], T]) -> None:
        """Dispara UM refresh em background (chamado com o lock preso)."""
        if self._refreshing:
            return
        self._refreshing = True
        Thread(target=self._refresh, args=(loader,), daemon=True).start()

    def _refresh(self, loader: Callable[[], T]) -> None:
        try:
            value = loader()
        except Exception:
            # Falha no refresh: mantém o valor velho; tenta de novo no próximo request.
            # Logar é essencial — sem isso, a staleness fica invisível (dívida vencida
            # some da tela se o refresh falha em silêncio por muitas janelas seguidas).
            logger.warning("Refresh do cache falhou; servindo snapshot anterior.", exc_info=True)
            with self._lock:
                self._refreshing = False
            return
        with self._lock:
            self._value = value
            self._expires_at = time.monotonic() + self._ttl
            self._refreshing = False

    def invalidate(self) -> None:
        with self._lock:
            self._value = None
            self._expires_at = 0.0
