"""Totais de um LOTE de pagamento (unidade + data de vencimento) — regra de domínio única.

Um lote é pago pelo total das suas solicitações **pendentes**. Quando a Contratante tem o
serviço de rebate (feature 005), abate-se Σ cashback dessas mesmas pendentes.

Esta é a FONTE ÚNICA desse cálculo (Princípio II): tanto o snapshot do aviso (services/
pagamentos.py) quanto a linha da aba Vencimentos (services/vencimentos.py) a consomem — antes
a soma era duplicada nos dois arquivos, "sincronizada" só por um comentário, e podia divergir.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.domain.models import Solicitacao
from app.domain.status import is_pending


@dataclass(frozen=True)
class TotaisLote:
    """Snapshot dos totais do lote: só as solicitações pendentes entram."""

    valor: Decimal  # Σ Originação das pendentes (bruto)
    rebate: Decimal  # Σ cashback das pendentes (0 quando a Contratante não tem o serviço)
    codigos: list[str]  # códigos das pendentes cobertas

    @property
    def valor_a_pagar(self) -> Decimal:
        """O que o parceiro paga / o gestor verifica: Originação − Rebate."""
        return self.valor - self.rebate


def totais_do_lote(sols: list[Solicitacao], rebate_ativo: bool = False) -> TotaisLote:
    """Totais das solicitações **pendentes** de `sols`. Pagas nunca entram (não é o que se paga).

    `rebate_ativo` (feature 005): quando True, `rebate` = Σ cashback das pendentes; senão 0.
    Somas em `Decimal` (sem float). Não levanta erro — as validações de negócio (lote vazio,
    rebate > valor) ficam no chamador (`snapshot_lote`), que decide o que é bloqueante.
    """
    pendentes = [s for s in sols if is_pending(s.status)]
    valor = sum((s.valor for s in pendentes), Decimal("0"))
    rebate = sum((s.cashback for s in pendentes), Decimal("0")) if rebate_ativo else Decimal("0")
    return TotaisLote(valor=valor, rebate=rebate, codigos=[s.codigo for s in pendentes])
