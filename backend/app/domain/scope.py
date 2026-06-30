"""Isolamento por Contratante (R-001) — Princípio VI, não-negociável.

Ponto único onde o escopo do parceiro é aplicado. Toda resposta de dados de parceiro
DEVE passar por aqui antes de serializar. Gestor ignora o filtro (visão consolidada,
explicitamente autorizada por papel).
"""

from collections.abc import Iterable
from typing import TypeVar

from app.domain.models import AppUser

ROLE_GESTOR = "gestor"
ROLE_PARCEIRO = "parceiro"

# Protocolo mínimo: qualquer objeto com atributo `contratante: str`.
T = TypeVar("T")


def is_gestor(user: AppUser) -> bool:
    return user.role == ROLE_GESTOR


def filtra_por_escopo(itens: Iterable[T], user: AppUser) -> list[T]:
    """Devolve só os itens do `contratante` do usuário; gestor recebe tudo.

    Escopo do parceiro = Contratante igual **E** Unidade na allowlist (feature 003). A
    allowlist só **restringe dentro** da Contratante — nunca concede acesso cross-contratante
    (Princípio VI, inegociável). Comparação por string normalizada (trim no parser).

    Regras (falha fechada — segurança > disponibilidade):
    - Parceiro sem `contratante` → nenhuma linha.
    - `unidades is None` (nunca configurado) → sem restrição de unidade (back-compat).
    - `unidades == []` (allowlist explícita vazia) → nenhuma linha.
    """
    itens_lista = list(itens)
    if is_gestor(user):
        return itens_lista
    if not user.contratante:
        return []
    alvo = user.contratante.strip()
    do_contratante = [it for it in itens_lista if getattr(it, "contratante", None) == alvo]
    if user.unidades is None:
        return do_contratante
    permitidas = set(user.unidades)
    return [it for it in do_contratante if getattr(it, "unidade", None) in permitidas]


def escopo_permitido(user: AppUser, parceiros_pedidos: list[str] | None) -> list[str] | None:
    """Valida o filtro `?parceiros=` (só gestor). Parceiro nunca passa outro contratante.

    Retorna a lista de contratantes a aplicar (None = sem filtro extra). Para parceiro,
    sempre força o próprio escopo, ignorando o que foi pedido.
    """
    if is_gestor(user):
        return parceiros_pedidos
    return [user.contratante] if user.contratante else []
