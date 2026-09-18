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


def _ano_mes_texto(valor_mes: str | None, fallback: date) -> tuple[int, int]:
    """(ano, mês) a partir do texto `mm/aaaa` do sheet; cai na data quando ilegível/ausente.

    As colunas de mês são texto livre não validado: se vierem malformadas (ex.: `Junho/2026`),
    usa a data correspondente (sempre presente nas válidas) em vez de derrubar o endpoint.
    """
    if valor_mes and "/" in valor_mes:
        mm, aaaa = valor_mes.split("/", 1)
        try:
            return int(aaaa.strip()), int(mm.strip())
        except ValueError:
            pass  # célula malformada → usa a data
    return fallback.year, fallback.month


def _ano_mes(s: Solicitacao) -> tuple[int, int]:
    """(ano, mês) de ORIGINAÇÃO — `mes_originacao`, fallback `data_pedido`."""
    return _ano_mes_texto(s.mes_originacao, s.data_pedido)


def _ano_mes_vencimento(s: Solicitacao) -> tuple[int, int]:
    """(ano, mês) de VENCIMENTO — `mes_vencimento`, fallback `data_vencimento`."""
    return _ano_mes_texto(s.mes_vencimento, s.data_vencimento)


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

    Além da série por originação, devolve `serie_rebate_vencimento` (RF-020b): o MESMO recorte
    temporal aplicado à data de VENCIMENTO, agrupado por mês de vencimento — base do toggle do
    gráfico "Rebate Mensal" (quanto de rebate abate no pagamento de cada mês). Só o gráfico
    troca de base; cards, ticket médio e `serie_mensal` seguem em originação.
    """
    hoje = hoje or hoje_operacao()
    ano_ref = ano if ano is not None else hoje.year
    meses_sel = set(meses) if meses else None  # None = ano inteiro
    periodo_ativo = data_de is not None or data_ate is not None

    escopadas = aplica_filtros(filtra_por_escopo(validas, user), filtros or [])
    anos_disponiveis = sorted({_ano_mes(s)[0] for s in escopadas}, reverse=True)

    def dentro(am: tuple[int, int], d: date) -> bool:
        """Recorte temporal genérico: período pela data `d`, senão ano/meses por `am`."""
        if periodo_ativo:
            return (data_de is None or d >= data_de) and (data_ate is None or d <= data_ate)
        return am[0] == ano_ref and (meses_sel is None or am[1] in meses_sel)

    no_recorte = [s for s in escopadas if dentro(_ano_mes(s), s.data_pedido)]

    valor_total = sum((s.valor for s in no_recorte), Decimal("0"))
    total_cashback = sum((s.cashback for s in no_recorte), Decimal("0"))
    pagas = sum(1 for s in no_recorte if s.status == STATUS_PAGO)
    medicos = {s.cliente for s in no_recorte}

    # Ticket Médio (RF-019b): Originação Total ÷ nº de solicitações = média da coluna Originação.
    ticket_medio = valor_total / len(no_recorte) if no_recorte else Decimal("0")

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

    # Série do rebate por mês de VENCIMENTO (RF-020b): mesmo recorte, régua da data de vencimento.
    por_mes_rebate_venc: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for s in escopadas:
        am_venc = _ano_mes_vencimento(s)
        if not dentro(am_venc, s.data_vencimento):
            continue
        por_mes_rebate_venc[f"{am_venc[0]:04d}-{am_venc[1]:02d}"] += s.cashback
    serie_rebate_vencimento = [
        {"mes": m, "rebate": money_str(v)} for m, v in sorted(por_mes_rebate_venc.items())
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
        "serie_rebate_vencimento": serie_rebate_vencimento,
        "ano": ano_ref,
        "anos_disponiveis": anos_disponiveis,
    }
