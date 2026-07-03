"""Serialização de domínio → dict JSON (contracts/api.md).

Dinheiro vira string decimal (`"1300.00"`) para evitar erro de float no cliente — por isso
montamos dicts à mão em vez de devolver o modelo Pydantic cru (jsonable_encoder baixaria
Decimal para float). Campos `contratante`/`cor_parceiro` só entram na visão do gestor.
"""

from decimal import ROUND_HALF_UP, Decimal

from app.domain.models import Medico, Pendencia, Solicitacao

_CENTAVOS = Decimal("0.01")


def money_str(value: Decimal) -> str:
    """Dinheiro como string de 2 casas (centavos) — formato do contrato `"N.NN"`.

    Quantizar remove ruído de float vindo do Sheets (UNFORMATTED_VALUE) — ex.: um cashback
    `23.329999999…` vira `"23.33"`.
    """
    return str(value.quantize(_CENTAVOS, rounding=ROUND_HALF_UP))


def _money(value: Decimal | None) -> str | None:
    return money_str(value) if value is not None else None


def serializa_solicitacao(s: Solicitacao, incluir_gestor: bool = False) -> dict:
    """Item de solicitação no shape do contrato. `incluir_gestor` adiciona parceiro/cor."""
    item: dict = {
        "codigo": s.codigo,
        "cliente": s.cliente,
        "valor": _money(s.valor),
        "recebido_cliente": _money(s.recebido_cliente),
        "iof": _money(s.iof),
        "juros_descontos": _money(s.juros_descontos),
        "taxa_juros_mes": _money(s.taxa_juros_mes),
        "data_pedido": s.data_pedido.isoformat(),
        "prazo_dias": s.prazo_dias,
        "data_vencimento": s.data_vencimento.isoformat(),
        "unidade": s.unidade,
        "cashback": _money(s.cashback),
        "status": s.status,
        "status_label": s.status_label,
        "medico_grupo_id": s.medico_grupo_id,
    }
    if incluir_gestor:
        # Margens da MedFlow (Lucro Operacional, ÁGIO) e parceiro/cor: só na visão do gestor.
        # Parceiro NUNCA recebe esses campos (R-001 / lista-modelo de colunas) — strip no
        # backend, não basta esconder no front (o payload vaza na rede).
        item["lucro_operacional"] = _money(s.lucro_operacional)
        item["agio_base"] = _money(s.agio_base)
        item["contratante"] = s.contratante
        item["cor_parceiro"] = s.cor_parceiro
    return item


def serializa_medico(m: Medico) -> dict:
    return {
        "nome": m.nome,
        "cpf": m.cpf,
        "telefone": m.telefone,
        "email": m.email,
        "pix": m.pix,
        "pix_tipo": m.pix_tipo,
        "nascimento": m.nascimento,
        "ambiguo": m.ambiguo,
    }


def serializa_pendencia(p: Pendencia) -> dict:
    return {
        "codigo": p.codigo,
        "cliente": p.cliente,
        "contratante": p.contratante,
        "valor": _money(p.valor),
        "data_pedido": p.data_pedido.isoformat() if p.data_pedido else None,
        "data_vencimento": p.data_vencimento.isoformat() if p.data_vencimento else None,
        "linha_origem": p.linha_origem,
        "motivos": p.motivos,
    }
