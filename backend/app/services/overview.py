"""Serviço de Visão Geral / Dashboard (US4 parceiro / RF-021 gestor). data-model §3.

Métricas + série mensal sobre o dataset VÁLIDO escopado, recortado por um seletor de tempo
(toggle ano inteiro / meses específicos do ano — RF-019). Como `filtra_por_escopo` já ignora
o filtro para o gestor, o mesmo serviço atende os dois papéis (gestor = somatório global).
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from app.domain.datas import hoje as hoje_operacao
from app.domain.filtros.engine import FiltroAplicado
from app.domain.filtros.engine import aplica as aplica_filtros
from app.domain.models import AppUser, Solicitacao
from app.domain.scope import filtra_por_escopo
from app.domain.status import STATUS_PAGO
from app.services.serialize import money_str


def _ano_mes(s: Solicitacao) -> tuple[int, int]:
    """(ano, mês) de originação. Usa `mes_originacao` (`mm/aaaa`); senão deriva de `data_pedido`.

    `mes_originacao` é texto livre não validado no sheet: se vier ilegível (ex.: `Junho/2026`),
    cai no fallback por `data_pedido` (sempre presente nas válidas) em vez de derrubar o endpoint.
    """
    if s.mes_originacao and "/" in s.mes_originacao:
        mm, aaaa = s.mes_originacao.split("/", 1)
        try:
            return int(aaaa.strip()), int(mm.strip())
        except ValueError:
            pass  # célula malformada → usa a data do pedido
    return s.data_pedido.year, s.data_pedido.month


def overview(
    validas: list[Solicitacao],
    user: AppUser,
    ano: int | None = None,
    meses: list[int] | None = None,
    data_de: date | None = None,
    data_ate: date | None = None,
    filtros: list[FiltroAplicado] | None = None,
    hoje: date | None = None,
) -> dict:
    """Cards + série mensal recortados pelo seletor de tempo (ano / meses ou período de datas).

    Escopo R-001 primeiro, depois filtros dinâmicos (chips) e, por fim, o recorte temporal.
    Se um PERÍODO for informado (`data_de` e/ou `data_ate`), ele SUBSTITUI o recorte ano/meses:
    entram só as solicitações cuja data de originação (`data_pedido`) caia no intervalo inclusivo
    [`data_de`, `data_ate`] (bordas abertas quando um dos limites é None). Sem período, vale o
    recorte por `ano` (default = ano corrente) e, opcionalmente, `meses` (toggle "por mês";
    vazio/None = ano inteiro). Cards e série refletem o recorte.
    """
    hoje = hoje or hoje_operacao()
    ano_ref = ano if ano is not None else hoje.year
    meses_sel = set(meses) if meses else None  # None = ano inteiro
    periodo_ativo = data_de is not None or data_ate is not None

    escopadas = aplica_filtros(filtra_por_escopo(validas, user), filtros or [])
    anos_disponiveis = sorted({_ano_mes(s)[0] for s in escopadas}, reverse=True)

    def no_intervalo(s: Solicitacao) -> bool:
        if periodo_ativo:
            d = s.data_pedido
            return (data_de is None or d >= data_de) and (data_ate is None or d <= data_ate)
        am = _ano_mes(s)
        return am[0] == ano_ref and (meses_sel is None or am[1] in meses_sel)

    no_recorte = [s for s in escopadas if no_intervalo(s)]

    valor_total = sum((s.valor for s in no_recorte), Decimal("0"))
    total_cashback = sum((s.cashback for s in no_recorte), Decimal("0"))
    pagas = sum(1 for s in no_recorte if s.status == STATUS_PAGO)
    medicos = {s.cliente for s in no_recorte}

    # Ticket Médio (RF-019b): Originação Total ÷ médicos distintos = média dos totais por médico.
    ticket_medio = valor_total / len(medicos) if medicos else Decimal("0")

    # Série mensal dentro do recorte (RF-020): originação e rebate (Σ cashback) por mês.
    por_mes: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    por_mes_rebate: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for s in no_recorte:
        ano_s, mes_s = _ano_mes(s)
        chave = f"{ano_s:04d}-{mes_s:02d}"
        por_mes[chave] += s.valor
        por_mes_rebate[chave] += s.cashback
    serie = [
        {"mes": m, "valor": money_str(v), "rebate": money_str(por_mes_rebate[m])}
        for m, v in sorted(por_mes.items())
    ]

    return {
        "cards": {
            "total_solicitacoes": len(no_recorte),
            "valor_total": money_str(valor_total),
            "total_cashback": money_str(total_cashback),
            "ticket_medio": money_str(ticket_medio),
            "em_aberto": len(no_recorte) - pagas,
            "pagas": pagas,
            "medicos_impactados": len(medicos),
        },
        "serie_mensal": serie,
        "ano": ano_ref,
        "anos_disponiveis": anos_disponiveis,
    }
