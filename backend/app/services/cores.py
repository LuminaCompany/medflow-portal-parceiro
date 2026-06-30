"""Cor determinística por parceiro (RF-022/023) — agrupamento visual do gestor.

Mesma entrada → mesma cor, estável entre requisições (sem estado). Paleta pastel coerente
com DESIGN.md (fundos `-subtle`). Usado na lista de parceiros e nos itens da visão gestor.
"""

import hashlib

# Paleta pastel (fundos suaves) — hues variados, baixa saturação, legível com texto escuro.
_PALETTE = [
    "#e8e2f5",  # roxo (marca)
    "#e2eef5",  # azul
    "#e2f5e9",  # verde
    "#f5efe2",  # âmbar
    "#f5e2e6",  # rosa
    "#e9e2f5",  # lavanda
    "#e2f5f3",  # ciano
    "#f0f5e2",  # lima
]


def cor_para(contratante: str) -> str:
    """Cor estável para um contratante (hash determinístico → índice na paleta)."""
    digest = hashlib.sha1(contratante.strip().encode("utf-8")).hexdigest()
    return _PALETTE[int(digest, 16) % len(_PALETTE)]
