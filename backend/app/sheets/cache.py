"""Cache em processo com TTL (research D2).

O backend roda como container persistente (VPS/EasyPanel) → o cache sobrevive entre
requisições por toda a vida do container. TTL evita reparsear e protege a quota da
Sheets API. KISS: sem Redis/DB no MVP.
"""

import time
from collections.abc import Callable
from threading import Lock
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Cache de um único valor com expiração por tempo, thread-safe."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._value: T | None = None
        self._expires_at: float = 0.0
        self._lock = Lock()

    def get_or_load(self, loader: Callable[[], T]) -> T:
        """Retorna o valor em cache se válido; senão recarrega via `loader` e guarda.

        O lock garante uma única recarga concorrente por janela de TTL.
        """
        now = time.monotonic()
        with self._lock:
            if self._value is not None and now < self._expires_at:
                return self._value
            value = loader()
            self._value = value
            self._expires_at = now + self._ttl
            return value

    def invalidate(self) -> None:
        with self._lock:
            self._value = None
            self._expires_at = 0.0
