"""Divisões por Unidade definidas pelo gestor (feature 014 — A.H. GESTÃO MÉDICA).

Quando a linha da AH chega sem Unidade Referência e a OBS não diz (com certeza) quanto é de PA
e quanto é de PS, ela cai na pendência de divisão. O gestor informa as unidades + valores no
portal e a divisão fica salva aqui (tabela `divisoes_unidade`, service role, RLS deny-all).
Na próxima carga do dataset a linha é repartida como se a OBS estivesse completa.

NÃO toca sheet/CRM. Chave = (contratante, código de origem da coluna A — código do CRM, estável).
A Originação da linha é congelada em `valor_total`: se o sheet mudar o valor, a divisão deixa
de valer e a linha volta à pendência (`MOTIVO_SALVA_DIVERGENTE`) — nunca reparte valor errado.
"""

from decimal import Decimal, InvalidOperation

from supabase import Client

from app.domain.divisao import MAX_PARTES, DivisaoSalva, centavos
from app.domain.models import ParteDivisao, Pendencia
from app.services.serialize import money_str

TABELA = "divisoes_unidade"


class DivisaoError(Exception):
    """Falha de regra de negócio da divisão (mapeada para 400 no router)."""


def valida_partes(
    partes: list[ParteDivisao],
    pendencia: Pendencia,
    unidades_opcoes: list[str],
) -> tuple[ParteDivisao, ...]:
    """Confere a divisão do gestor contra a linha pendente (valores SEMPRE do dataset)."""
    if not 1 <= len(partes) <= MAX_PARTES:
        raise DivisaoError(f"Informe de 1 a {MAX_PARTES} unidades.")
    if pendencia.valor is None:
        raise DivisaoError("A linha não tem Originação válida.")
    permitidas = set(unidades_opcoes)
    vistas: set[str] = set()
    saida: list[ParteDivisao] = []
    for p in partes:
        unidade = (p.unidade or "").strip()
        if unidade not in permitidas:
            raise DivisaoError(f"Unidade inválida: {unidade or '(vazia)'}.")
        if unidade in vistas:
            raise DivisaoError(f"Unidade repetida: {unidade}.")
        vistas.add(unidade)
        if p.valor is None or p.valor <= 0:
            raise DivisaoError(f"Informe um valor maior que zero para {unidade}.")
        if centavos(p.valor) != p.valor:
            raise DivisaoError(f"Valor de {unidade} com mais de 2 casas decimais.")
        saida.append(ParteDivisao(unidade=unidade, valor=p.valor))
    soma = sum((p.valor for p in saida if p.valor is not None), Decimal("0"))
    total = centavos(pendencia.valor)
    if soma != total:
        raise DivisaoError(
            f"A soma das unidades (R$ {money_str(soma)}) precisa ser igual à Originação "
            f"(R$ {money_str(total)})."
        )
    return tuple(saida)


def _partes_da_linha(row: dict) -> tuple[ParteDivisao, ...]:
    partes = []
    for p in row.get("partes") or []:
        try:
            partes.append(ParteDivisao(unidade=str(p["unidade"]), valor=Decimal(str(p["valor"]))))
        except (KeyError, InvalidOperation, TypeError):
            continue
    return tuple(partes)


def _serializa(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "contratante": row["contratante"],
        "codigo_origem": row["codigo_origem"],
        "cliente": row.get("cliente"),
        "valor_total": money_str(Decimal(str(row["valor_total"]))),
        "partes": [
            {"unidade": p.unidade, "valor": money_str(p.valor)}
            for p in _partes_da_linha(row)
            if p.valor is not None
        ],
        "criado_por": row.get("criado_por"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


class DivisoesService:
    """Leitura/escrita da tabela `divisoes_unidade` (service role)."""

    def __init__(self, admin: Client) -> None:
        self._db = admin

    def _table(self):
        return self._db.table(TABELA)

    def _todas(self) -> list[dict]:
        return self._table().select("*").order("updated_at", desc=True).execute().data or []

    def listar(self) -> list[dict]:
        """Divisões salvas (gestor), mais recentes primeiro."""
        return [_serializa(r) for r in self._todas()]

    def mapa(self) -> dict[tuple[str, str], DivisaoSalva]:
        """`(contratante, código de origem) → divisão` p/ a carga do dataset."""
        saida: dict[tuple[str, str], DivisaoSalva] = {}
        for row in self._todas():
            partes = _partes_da_linha(row)
            if not partes:
                continue
            saida[(row["contratante"], row["codigo_origem"])] = DivisaoSalva(
                id=str(row["id"]),
                valor_total=Decimal(str(row["valor_total"])),
                partes=partes,
            )
        return saida

    def salvar(
        self,
        pendencia: Pendencia,
        partes: tuple[ParteDivisao, ...],
        autor: str,
    ) -> dict:
        """Cria/substitui a divisão da linha. Contratante/código/valor vêm da PENDÊNCIA (dataset),
        nunca do corpo do request."""
        if not pendencia.contratante or not pendencia.codigo_origem or pendencia.valor is None:
            raise DivisaoError("A linha não tem código de origem — corrija na planilha.")
        payload = {
            "contratante": pendencia.contratante,
            "codigo_origem": pendencia.codigo_origem,
            "cliente": pendencia.cliente,
            "valor_total": money_str(pendencia.valor),
            "partes": [
                {"unidade": p.unidade, "valor": money_str(p.valor)} for p in partes if p.valor
            ],
            "criado_por": autor,
        }
        try:
            resp = (
                self._table()
                .upsert(payload, on_conflict="contratante,codigo_origem")
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — vira erro de domínio legível
            raise DivisaoError("Não foi possível salvar a divisão.") from exc
        if not resp.data:
            raise DivisaoError("Não foi possível salvar a divisão.")
        return _serializa(resp.data[0])

    def remover(self, divisao_id: str) -> None:
        """Desfaz a divisão: a linha volta para a pendência na próxima carga."""
        try:
            resp = self._table().delete().eq("id", divisao_id).execute()
        except Exception as exc:  # noqa: BLE001
            raise DivisaoError("Não foi possível desfazer a divisão.") from exc
        if not resp.data:
            raise DivisaoError("Divisão não encontrada.")
