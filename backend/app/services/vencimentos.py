"""Serviço de Vencimentos (US1 parceiro / RF-024 gestor). data-model §3, contracts/api.md.

Opera sobre o dataset VÁLIDO já escopado por Contratante (R-001). Cards + listas
(atrasados / próximos / pagos) para o parceiro; consolidado ranqueado para o gestor.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from app.domain.datas import hoje as hoje_operacao
from app.domain.filtros.engine import FiltroAplicado
from app.domain.filtros.engine import aplica as aplica_filtros
from app.domain.lotes import totais_do_lote
from app.domain.models import AppUser, Solicitacao
from app.domain.scope import filtra_por_escopo
from app.domain.status import (
    STATUS_A_PAGAR,
    STATUS_ATRASADO,
    STATUS_PAGO,
    is_pending,
    status_label,
)
from app.services.serialize import money_str, serializa_solicitacao

# Janela do filtro "próximos" (RF-016).
PROXIMOS_WINDOWS = {"2d": 2, "1sem": 7, "2sem": 14}
PROXIMOS_DEFAULT = "1sem"


def vencimentos_parceiro(
    validas: list[Solicitacao],
    user: AppUser,
    proximos: str = PROXIMOS_DEFAULT,
    filtros: list[FiltroAplicado] | None = None,
    hoje: date | None = None,
) -> dict:
    """Cards + atrasados/próximos/pagos do parceiro autenticado (escopado + filtrado)."""
    hoje = hoje or hoje_operacao()
    escopadas = aplica_filtros(filtra_por_escopo(validas, user), filtros or [])

    dias = PROXIMOS_WINDOWS.get(proximos, PROXIMOS_WINDOWS[PROXIMOS_DEFAULT])
    limite = hoje + timedelta(days=dias)

    atrasados = [s for s in escopadas if s.status == STATUS_ATRASADO]
    a_pagar = [s for s in escopadas if s.status == STATUS_A_PAGAR]
    pagos = [s for s in escopadas if s.status == STATUS_PAGO]
    proximos_lista = [s for s in a_pagar if hoje <= s.data_vencimento <= limite]

    total_pendente = sum((s.valor for s in escopadas if is_pending(s.status)), Decimal("0"))
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
        "unidades": _unidades_parceiro(escopadas, hoje, bool(getattr(user, "rebate_ativo", False))),
        "atrasados": [serializa_solicitacao(s) for s in atrasados],
        "proximos": [serializa_solicitacao(s) for s in proximos_lista],
        "pagos": [serializa_solicitacao(s) for s in pagos],
    }


def _unidades_parceiro(
    sols: list[Solicitacao], hoje: date, rebate_ativo: bool = False
) -> list[dict]:
    """Linhas de vencimento do parceiro: um LOTE por (unidade, data de vencimento) pendente.

    Pagamento é por lote (unidade + prazo): a mesma unidade pode ter vários vencimentos em
    datas diferentes, cada um avisado/pago em separado (ex.: 10 solic. p/ 24/06 + 25 p/ 06/07
    na mesma unidade = duas linhas). Cada lote traz vencido/a_vencer (barra), total_pendente,
    `data_vencimento` e `dias` (>0 = vencido → vermelho no front). Quando a Contratante tem o
    serviço de rebate (feature 005), o lote também traz `rebate` (Σ cashback) e `valor_a_pagar`
    (= total_pendente − rebate) — o modal de pagamento os usa (bate 1:1 com o snapshot do envio).
    Unidade sem pendência vira uma linha "Tudo pago" (data nula). Sem campos de gestor (R-001).

    Ordena os lotes por data de vencimento asc (vencido há mais tempo no topo), independente
    da unidade; linhas "Tudo pago" (sem pendência) caem no fim.
    """
    por_unidade: dict[str, list[Solicitacao]] = defaultdict(list)
    for s in sols:
        por_unidade[s.unidade].append(s)

    linhas: list[dict] = []
    for unidade, lista in por_unidade.items():
        pendentes = [s for s in lista if is_pending(s.status)]
        if not pendentes:
            # Unidade sem pendência: linha única "Tudo pago" (mantém a visão; pagas vivem
            # também na seção "Vencimentos Pagos"). Mostra todas as solicitações da unidade.
            lista.sort(key=lambda s: s.data_vencimento)
            linhas.append(_linha_paga(unidade, lista))
            continue
        por_data: dict[date, list[Solicitacao]] = defaultdict(list)
        for s in pendentes:
            por_data[s.data_vencimento].append(s)
        for venc in por_data:
            linhas.append(_linha_lote(unidade, venc, por_data[venc], hoje, rebate_ativo))

    # Vencido há mais tempo (menor data) primeiro; "Tudo pago" (data nula) no fim.
    linhas.sort(key=lambda l: (l["data_vencimento"] is None, l["data_vencimento"] or ""))
    return linhas


def _linha_paga(unidade: str, lista: list[Solicitacao]) -> dict:
    return {
        "unidade": unidade,
        "data_vencimento": None,
        "dias": None,
        "vencido": "0.00",
        "a_vencer": "0.00",
        "total_pendente": "0.00",
        "rebate": "0.00",
        "valor_a_pagar": "0.00",
        "tudo_pago": True,
        "solicitacoes": [serializa_solicitacao(s) for s in lista],
    }


def _linha_lote(
    unidade: str, venc: date, lote: list[Solicitacao], hoje: date, rebate_ativo: bool = False
) -> dict:
    vencido = sum((s.valor for s in lote if s.status == STATUS_ATRASADO), Decimal("0"))
    a_vencer = sum((s.valor for s in lote if s.status == STATUS_A_PAGAR), Decimal("0"))
    # total_pendente/rebate/valor_a_pagar vêm da MESMA função do snapshot do aviso (domain/lotes)
    # → o valor no modal de pagamento bate 1:1 com o que o aviso congela (feature 005).
    totais = totais_do_lote(lote, rebate_ativo)
    lote.sort(key=lambda s: s.codigo)
    return {
        "unidade": unidade,
        "data_vencimento": venc.isoformat(),
        "dias": (hoje - venc).days,  # >0 vencido; <=0 a vencer (0 = hoje)
        "vencido": money_str(vencido),
        "a_vencer": money_str(a_vencer),
        "total_pendente": money_str(totais.valor),
        "rebate": money_str(totais.rebate),
        "valor_a_pagar": money_str(totais.valor_a_pagar),
        "tudo_pago": False,
        "solicitacoes": [serializa_solicitacao(s) for s in lote],
    }


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
                "pendente": sum((s.valor for s in lista if is_pending(s.status)), Decimal("0")),
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
            "solicitacoes": [
                serializa_solicitacao(s, incluir_gestor=True) for s in g["solicitacoes"]
            ],
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
    pendentes = [s for s in filtradas if is_pending(s.status)]
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
