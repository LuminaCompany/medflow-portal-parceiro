"""Relógio de negócio — "hoje"/"agora" no fuso da operação (America/Sao_Paulo).

O container de produção roda em UTC; usar `date.today()` cru faz o status pago/a_pagar/
atrasado e o "dias" dos lotes virarem um dia cedo entre ~21h e 00h BRT. Centralizar aqui é a
FONTE ÚNICA do "hoje" financeiro (DRY) — todo serviço que precisa da data corrente usa `hoje()`.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

# Fuso da operação MedFlow. Independe do timezone do servidor (UTC no VPS/EasyPanel).
FUSO_OPERACAO = ZoneInfo("America/Sao_Paulo")


def agora() -> datetime:
    """Instante corrente, ciente do fuso da operação."""
    return datetime.now(FUSO_OPERACAO)


def hoje() -> date:
    """Data corrente no fuso da operação (não no fuso do servidor)."""
    return agora().date()
