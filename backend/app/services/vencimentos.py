"""Serviço de Vencimentos (US1 parceiro / RF-024 gestor). data-model §3, contracts/api.md.

Opera sobre o dataset VÁLIDO já escopado por Contratante (R-001). Cards + listas
(atrasados / próximos / pagos) para o parceiro; consolidado ranqueado para o gestor.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from app.domain.filtros.engine import FiltroAplicado
from app.domain.filtros.engine import aplica as aplica_filtros
from app.domain.models import AppUser, Solicitacao
from app.domain.scope import filtra_por_escopo
from app.domain.status import (
    STATUS_A_PAGAR,
    STATUS_ATRASADO,
    STATUS_PAGO,
    status_label,
)
from app.services.serialize import money_str, serializa_solicitacao

# Janela do filtro "próximos" (RF-016).
PROXIMOS_WINDOWS = {"2d": 2, "1sem": 7, "2sem": 14}
PROXIMOS_DEFAULT = "1sem"


def _pendente(s: Solicitacao) -> bool:
    return s.status in (STATUS_A_PAGAR, STATUS_ATRASADO)


def vencimentos_parceiro(
    validas: list[Solicitacao],
    user: AppUser,
    proximos: str = PROXIMOS_DEFAULT,
    filtros: list[FiltroAplicado] | None = None,
    hoje: date | None = None,
) -> dict:
    """Cards + atrasados/próximos/pagos do parceiro autenticado (escopado + filtrado)."""
    hoje = hoje or date.today()
    escopadas = aplica_filtros(filtra_por_escopo(validas, user), filtros or [])

    dias = PROXIMOS_WINDOWS.get(proximos, PROXIMOS_WINDOWS[PROXIMOS_DEFAULT])
    limite = hoje + timedelta(days=dias)

    atrasados = [s for s in escopadas if s.status == STATUS_ATRASADO]
    a_pagar = [s for s in escopadas if s.status == STATUS_A_PAGAR]
    pagos = [s for s in escopadas if s.status == STATUS_PAGO]
    proximos_lista = [s for s in a_pagar if hoje <= s.data_vencimento <= limite]

    total_pendente = sum((s.valor for s in escopadas if _pendente(s)), Decimal("0"))
    em_atraso = sum((s.valor for s in atrasados), Decimal("0"))

    # Ordenação útil: atrasados/próximos por vencimento ascendente; pagos por quitação desc.
    atrasados.sort(key=lambda s: s.data_vencimento)
    proximos_lista.sort(key=lambda s: s.data_vencimento)
    pagos.sort(key=lambda s: s.data_vencimento, reverse=True)

    return {
        "cards": {
            "total_pendente": money_str(total_pendente),
            "em_atraso": money_str(em_atraso),
            "n_atrasadas": len(atrasados),
            "n_a_pagar": len(a_pagar),
        },
        "unidades": _unidades_parceiro(escopadas),
        "atrasados": [serializa_solicitacao(s) for s in atrasados],
        "proximos": [serializa_solicitacao(s) for s in proximos_lista],
        "pagos": [serializa_solicitacao(s) for s in pagos],
    }


def _unidades_parceiro(sols: list[Solicitacao]) -> list[dict]:
    """Unidades do parceiro como barra segmentada (espelha RF-024 gestor, nível unidade).

    Cada unidade: vencido (atrasado) + a_vencer (a pagar) p/ a barra, total_pendente como
    chave de ordenação e a lista completa de solicitações (todos os status). Sem campos de
    gestor — escopo R-001. Ordena por pendência desc, depois nome; "Tudo pago" cai no fim.
    """
    por_unidade: dict[str, list[Solicitacao]] = defaultdict(list)
    for s in sols:
        por_unidade[s.unidade].append(s)

    grupos = []
    for unidade, lista in por_unidade.items():
        vencido = sum((s.valor for s in lista if s.status == STATUS_ATRASADO), Decimal("0"))
        a_vencer = sum((s.valor for s in lista if s.status == STATUS_A_PAGAR), Decimal("0"))
        total_pendente = vencido + a_vencer
        lista.sort(key=lambda s: s.data_vencimento)
        grupos.append(
            {
                "unidade": unidade,
                "vencido": vencido,
                "a_vencer": a_vencer,
                "total_pendente": total_pendente,
                "solicitacoes": lista,
            }
        )
    grupos.sort(key=lambda g: (-g["total_pendente"], g["unidade"]))

    return [
        {
            "unidade": g["unidade"],
            "vencido": money_str(g["vencido"]),
            "a_vencer": money_str(g["a_vencer"]),
            "total_pendente": money_str(g["total_pendente"]),
            "tudo_pago": g["total_pendente"] == 0,
            "solicitacoes": [serializa_solicitacao(s) for s in g["solicitacoes"]],
        }
        for g in grupos
    ]


def _status_unidade(sols: list[Solicitacao]) -> str:
    """Status agregado da unidade (worst-first): Atrasado > A Pagar > Pago.

    Pago só quando TODAS as solicitações estão quitadas; qualquer atraso vence o rótulo
    (não esconde atraso atrás de "A Pagar"). Decisão de produto (spec RF-024a).
    """
    if any(s.status == STATUS_ATRASADO for s in sols):
        return STATUS_ATRASADO
    if any(s.status == STATUS_A_PAGAR for s in sols):
        return STATUS_A_PAGAR
    return STATUS_PAGO


def _unidades_do_contratante(sols: list[Solicitacao]) -> list[dict]:
    """Agrupa as solicitações da contratante por Unidade (sempre presente — ADR 0001).

    Cada unidade: total = Σ Originação de TODAS as solicitações (incl. pagas), status rollup
    e a lista completa (todos os status). Ordena por pendência desc, depois total desc, nome.
    """
    por_unidade: dict[str, list[Solicitacao]] = defaultdict(list)
    for s in sols:
        por_unidade[s.unidade].append(s)

    grupos = []
    for unidade, lista in por_unidade.items():
        lista.sort(key=lambda s: s.data_vencimento)
        grupos.append(
            {
                "unidade": unidade,
                "total": sum((s.valor for s in lista), Decimal("0")),
                "pendente": sum((s.valor for s in lista if _pendente(s)), Decimal("0")),
                "status": _status_unidade(lista),
                "solicitacoes": lista,
            }
        )
    grupos.sort(key=lambda g: (-g["pendente"], -g["total"], g["unidade"]))

    return [
        {
            "unidade": g["unidade"],
            "total": money_str(g["total"]),
            "status": g["status"],
            "status_label": status_label(g["status"]),
            "solicitacoes": [serializa_solicitacao(s, incluir_gestor=True) for s in g["solicitacoes"]],
        }
        for g in grupos
    ]


def vencimentos_gestor(
    validas: list[Solicitacao], filtros: list[FiltroAplicado] | None = None
) -> dict:
    """Consolidado do gestor (RF-024): cards globais + lista de TODAS as contratantes.

    Cada contratante vira uma barra segmentada (vencido + a vencer) com dropdown
    contratante → unidades → solicitações. Contratante sem pendência = "Tudo pago".
    Ordena por total pendente desc; "Tudo pago" cai no fim (pendência 0).
    """
    filtradas = aplica_filtros(validas, filtros or [])
    pendentes = [s for s in filtradas if _pendente(s)]
    valor_total = sum((s.valor for s in pendentes), Decimal("0"))

    por_contratante: dict[str, list[Solicitacao]] = defaultdict(list)
    for s in filtradas:
        por_contratante[s.contratante].append(s)

    contratantes = []
    for contratante, sols in por_contratante.items():
        vencido = sum((s.valor for s in sols if s.status == STATUS_ATRASADO), Decimal("0"))
        a_vencer = sum((s.valor for s in sols if s.status == STATUS_A_PAGAR), Decimal("0"))
        total_pendente = vencido + a_vencer
        contratantes.append(
            {
                "contratante": contratante,
                "vencido": vencido,
                "a_vencer": a_vencer,
                "total_pendente": total_pendente,
                "tudo_pago": total_pendente == 0,
                "unidades": _unidades_do_contratante(sols),
            }
        )
    contratantes.sort(key=lambda c: (-c["total_pendente"], c["contratante"]))

    return {
        "cards": {
            "solicitacoes_a_pagar": len(pendentes),
            "valor_total_a_receber": money_str(valor_total),
        },
        "contratantes": [
            {
                "contratante": c["contratante"],
                "vencido": money_str(c["vencido"]),
                "a_vencer": money_str(c["a_vencer"]),
                "total_pendente": money_str(c["total_pendente"]),
                "tudo_pago": c["tudo_pago"],
                "unidades": c["unidades"],
            }
            for c in contratantes
        ],
    }
