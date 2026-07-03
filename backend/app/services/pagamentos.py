"""Serviço de Avisos de Pagamento (feature 004).

Fluxo: o parceiro avisa que pagou uma **Unidade** (botão na aba Vencimentos); o gestor
**verifica** ou **rejeita** o aviso numa aba própria. O aviso NÃO toca a planilha nem o CRM
— status financeiro continua vindo do sheet (mudado à mão pelo gestor). É só um quadro de
avisos persistido (Supabase Postgres, tabela `pagamentos_avisos`).

Snapshot (decisão de produto): no envio, congela `valor` (= total pendente da unidade) e a
lista de `solicitacao_codigos` cobertos — mudanças posteriores no sheet não alteram o aviso.

Isolamento (R-001): o `contratante` e o conteúdo do snapshot são derivados SEMPRE do dataset
já escopado do parceiro (nunca do corpo do request). Só o backend (service role) acessa a
tabela; o frontend jamais fala com o Postgres direto.
"""

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal

from supabase import Client

from app.domain.lotes import totais_do_lote
from app.domain.models import Solicitacao
from app.domain.status import is_pending
from app.services.serialize import money_str

TABELA = "pagamentos_avisos"

# Estados do aviso (espelham o CHECK da migration).
AVISO_PENDENTE = "pendente"
AVISO_VERIFICADO = "verificado"
AVISO_REJEITADO = "rejeitado"
AVISO_CANCELADO = "cancelado"

# "Ativo" = ocupa a unidade (trava reenvio e tira a unidade de "Falta aviso").
ATIVOS = (AVISO_PENDENTE, AVISO_VERIFICADO)

AVISO_LABELS: dict[str, str] = {
    AVISO_PENDENTE: "Aguardando verificação",
    AVISO_VERIFICADO: "Verificado",
    AVISO_REJEITADO: "Rejeitado",
    AVISO_CANCELADO: "Cancelado",
}


class PagamentoAvisoError(Exception):
    """Falha de regra de negócio do aviso (mapeada para 400 no router)."""


def snapshot_lote(
    sols_do_lote: list[Solicitacao], rebate_ativo: bool = False
) -> tuple[Decimal, Decimal, list[str]]:
    """Congela o que o aviso cobre: total pendente + rebate + códigos das solicitações pendentes.

    O lote = (unidade, data de vencimento). Usa `totais_do_lote` (mesma regra da aba Vencimentos):
    `valor` = Σ Originação das pendentes; `rebate` = Σ cashback delas quando a Contratante tem o
    serviço (feature 005), senão 0. Bloqueia se não houver pendência ou se o rebate exceder o valor
    (Valor a Pagar negativo = erro de dado; ADR 0004).
    """
    totais = totais_do_lote(sols_do_lote, rebate_ativo)
    if not totais.codigos:
        raise PagamentoAvisoError("O lote não possui valores pendentes para avisar.")
    if totais.rebate > totais.valor:
        raise PagamentoAvisoError(
            "Rebate do lote maior que a Originação — verifique os dados antes de avisar."
        )
    return totais.valor, totais.rebate, totais.codigos


def _serializa(row: dict) -> dict:
    """Linha da tabela → shape do contrato (dinheiro como string decimal)."""
    status = row["status"]
    valor = Decimal(str(row["valor"]))
    rebate = Decimal(str(row.get("rebate") or 0))  # 0 quando a Contratante não tem o serviço
    return {
        "id": str(row["id"]),
        "contratante": row["contratante"],
        "unidade": row["unidade"],
        "data_vencimento": row.get("data_vencimento"),
        "valor": money_str(valor),  # Originação (bruto) congelada no envio
        "rebate": money_str(rebate),  # Σ cashback do lote (feature 005)
        "valor_a_pagar": money_str(valor - rebate),  # o que o parceiro paga / o gestor verifica
        "solicitacao_codigos": row.get("solicitacao_codigos") or [],
        "status": status,
        "status_label": AVISO_LABELS.get(status, status),
        "motivo_rejeicao": row.get("motivo_rejeicao"),
        "created_at": row.get("created_at"),
        "verificado_at": row.get("verificado_at"),
    }


def chave_lote(unidade: str, data_vencimento: str | None) -> str:
    """Chave do lote (unidade + data ISO) usada no mapa de avisos do parceiro. DRY com o front."""
    return f"{unidade}|{data_vencimento or ''}"


def monta_meus_avisos(avisos: list[dict]) -> dict:
    """Visão do parceiro p/ a aba Vencimentos: mapa `lote → aviso vigente`.

    Lote = (unidade, data de vencimento) — chave `"unidade|data"`. Vigente = o aviso mais
    recente não-cancelado do lote. Define o estado da linha: pendente (enviado/cancelável) ·
    verificado (travado) · rejeitado (mostra motivo, libera novo).
    """
    por_lote: dict[str, dict] = {}
    # created_at ISO ordena lexicograficamente; ascendente => o último visto é o mais recente.
    for row in sorted(avisos, key=lambda r: r.get("created_at") or ""):
        if row["status"] == AVISO_CANCELADO:
            continue
        por_lote[chave_lote(row["unidade"], row.get("data_vencimento"))] = _serializa(row)
    return {"avisos": por_lote}


def monta_visao_gestor(
    validas: list[Solicitacao],
    avisos: list[dict],
    cores: dict[str, str] | None = None,
) -> dict:
    """Quadro do gestor: seções grandes por contratante, com 3 blocos cada.

    - **Aguardando verificação**: avisos `pendente`.
    - **Verificadas**: avisos `verificado`.
    - **Falta aviso**: unidades com pendência (no sheet) e sem aviso ativo; anota o motivo
      do último aviso rejeitado, se houver (contexto p/ o gestor).
    """
    cores = cores or {}

    # Pendência atual por contratante → lote (unidade, data de vencimento). Fonte: sheet.
    pend: dict[str, dict[tuple[str, str], Decimal]] = defaultdict(
        lambda: defaultdict(lambda: Decimal("0"))
    )
    for s in validas:
        if s.unidade and is_pending(s.status):
            pend[s.contratante][(s.unidade, s.data_vencimento.isoformat())] += s.valor

    # Avisos agrupados (ignora cancelados). Chave do lote ativo = (unidade, data ISO).
    aguardando: dict[str, list[dict]] = defaultdict(list)
    verificadas: dict[str, list[dict]] = defaultdict(list)
    ativos: dict[str, set[tuple[str, str]]] = defaultdict(set)
    rejeicao: dict[str, dict[tuple[str, str], str]] = defaultdict(dict)  # →lote→motivo (último)
    for row in sorted(avisos, key=lambda r: r.get("created_at") or ""):
        c, status = row["contratante"], row["status"]
        lote = (row["unidade"], row.get("data_vencimento") or "")
        if status == AVISO_PENDENTE:
            aguardando[c].append(_serializa(row))
            ativos[c].add(lote)
        elif status == AVISO_VERIFICADO:
            verificadas[c].append(_serializa(row))
            ativos[c].add(lote)
        elif status == AVISO_REJEITADO:
            if row.get("motivo_rejeicao"):
                rejeicao[c][lote] = row["motivo_rejeicao"]  # asc => fica o mais recente

    contratantes_keys = set(pend) | set(aguardando) | set(verificadas)
    contratantes = []
    for c in contratantes_keys:
        falta = [
            {
                "unidade": u,
                "data_vencimento": d,
                "valor": money_str(valor),
                "motivo_rejeicao": rejeicao[c].get((u, d)),
            }
            for (u, d), valor in pend[c].items()
            if (u, d) not in ativos[c]
        ]
        falta.sort(key=lambda f: (Decimal(f["valor"]) * -1, f["unidade"], f["data_vencimento"]))
        # Recentes primeiro nas listas de avisos.
        ag = sorted(aguardando[c], key=lambda a: a.get("created_at") or "", reverse=True)
        ve = sorted(verificadas[c], key=lambda a: a.get("created_at") or "", reverse=True)
        if not ag and not ve and not falta:
            continue  # contratante sem nada a mostrar (tudo pago, sem avisos)
        contratantes.append(
            {
                "contratante": c,
                "cor": cores.get(c),
                "aguardando": ag,
                "verificadas": ve,
                "falta_aviso": falta,
            }
        )
    # Quem tem aviso aguardando sobe (ação pendente do gestor); depois por nome.
    contratantes.sort(key=lambda x: (-len(x["aguardando"]), x["contratante"].lower()))

    return {
        "cards": {
            "aguardando": sum(len(c["aguardando"]) for c in contratantes),
            "verificadas": sum(len(c["verificadas"]) for c in contratantes),
            "falta_aviso": sum(len(c["falta_aviso"]) for c in contratantes),
        },
        "contratantes": contratantes,
    }


class PagamentosService:
    """Operações de escrita/leitura da tabela `pagamentos_avisos` (service role)."""

    def __init__(self, admin: Client) -> None:
        self._db = admin

    def _table(self):
        return self._db.table(TABELA)

    # ---- Leitura -----------------------------------------------------------------

    def listar(self) -> list[dict]:
        """Todos os avisos não-cancelados (consolidado do gestor)."""
        resp = (
            self._table()
            .select("*")
            .neq("status", AVISO_CANCELADO)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []

    def listar_do_contratante(self, contratante: str) -> list[dict]:
        """Avisos de um contratante (visão do parceiro). Inclui cancelados? Não — o
        `monta_meus_avisos` já ignora; aqui filtramos por escopo apenas."""
        resp = (
            self._table()
            .select("*")
            .eq("contratante", contratante)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []

    # ---- Escrita -----------------------------------------------------------------

    def criar(
        self,
        contratante: str,
        unidade: str,
        data_vencimento: date,
        valor: Decimal,
        codigos: list[str],
        rebate: Decimal = Decimal("0"),
    ) -> dict:
        """Cria aviso (pendente). O índice único barra 2º aviso ativo do mesmo lote
        (contratante, unidade, data de vencimento). `rebate` (feature 005) fica congelado
        junto do valor — 0 quando a Contratante não tem o serviço."""
        payload = {
            "contratante": contratante,
            "unidade": unidade,
            "data_vencimento": data_vencimento.isoformat(),
            "valor": str(valor),
            "rebate": str(rebate),
            "solicitacao_codigos": codigos,
            "status": AVISO_PENDENTE,
        }
        try:
            resp = self._table().insert(payload).execute()
        except Exception as exc:  # noqa: BLE001 — vira erro de domínio legível
            if _is_unique_violation(exc):
                raise PagamentoAvisoError(
                    "Já existe um aviso ativo para este vencimento da unidade."
                ) from exc
            raise PagamentoAvisoError("Não foi possível registrar o aviso.") from exc
        return _serializa(resp.data[0])

    def cancelar(self, aviso_id: str, contratante: str) -> None:
        """Parceiro cancela o PRÓPRIO aviso, só se ainda pendente (não verificado/rejeitado)."""
        aviso = self._buscar(aviso_id)
        if aviso is None or aviso["contratante"] != contratante:
            raise PagamentoAvisoError("Aviso não encontrado.")
        if aviso["status"] != AVISO_PENDENTE:
            raise PagamentoAvisoError("Só é possível cancelar um aviso ainda não verificado.")
        self._update(aviso_id, {"status": AVISO_CANCELADO}, esperado=AVISO_PENDENTE)

    def verificar(self, aviso_id: str) -> dict:
        """Gestor confirma o pagamento do aviso (pendente → verificado)."""
        aviso = self._exigir(aviso_id)
        if aviso["status"] != AVISO_PENDENTE:
            raise PagamentoAvisoError("Este aviso não está aguardando verificação.")
        return self._update(
            aviso_id,
            {
                "status": AVISO_VERIFICADO,
                "verificado_at": datetime.now(UTC).isoformat(),
                "motivo_rejeicao": None,
            },
            esperado=AVISO_PENDENTE,
        )

    def rejeitar(self, aviso_id: str, motivo: str) -> dict:
        """Gestor rejeita o aviso (pendente → rejeitado), com motivo."""
        aviso = self._exigir(aviso_id)
        if aviso["status"] != AVISO_PENDENTE:
            raise PagamentoAvisoError("Este aviso não está aguardando verificação.")
        motivo = (motivo or "").strip()
        if not motivo:
            raise PagamentoAvisoError("Informe o motivo da rejeição.")
        return self._update(
            aviso_id,
            {"status": AVISO_REJEITADO, "motivo_rejeicao": motivo},
            esperado=AVISO_PENDENTE,
        )

    def reabrir(self, aviso_id: str) -> dict:
        """Gestor desfaz a verificação (verificado → pendente) — corrige clique errado."""
        aviso = self._exigir(aviso_id)
        if aviso["status"] != AVISO_VERIFICADO:
            raise PagamentoAvisoError("Só um aviso verificado pode ser reaberto.")
        return self._update(
            aviso_id, {"status": AVISO_PENDENTE, "verificado_at": None}, esperado=AVISO_VERIFICADO
        )

    # ---- Internos ----------------------------------------------------------------

    def _buscar(self, aviso_id: str) -> dict | None:
        resp = self._table().select("*").eq("id", aviso_id).limit(1).execute()
        return resp.data[0] if resp.data else None

    def _exigir(self, aviso_id: str) -> dict:
        aviso = self._buscar(aviso_id)
        if aviso is None:
            raise PagamentoAvisoError("Aviso não encontrado.")
        return aviso

    def _update(self, aviso_id: str, attrs: dict, esperado: str | None = None) -> dict:
        """Atualiza o aviso. `esperado` fecha a corrida read-then-write: o UPDATE só casa se o
        status ainda for o esperado (guarda atômica no Postgres) — sem isso, um cancelar do
        parceiro concorrente com um verificar do gestor podia produzir cancelado→verificado."""
        try:
            query = self._table().update(attrs).eq("id", aviso_id)
            if esperado is not None:
                query = query.eq("status", esperado)
            resp = query.execute()
        except Exception as exc:  # noqa: BLE001
            raise PagamentoAvisoError("Não foi possível atualizar o aviso.") from exc
        if not resp.data:
            # 0 linhas: o aviso mudou de estado entre a leitura e a escrita (corrida) ou sumiu.
            raise PagamentoAvisoError("O aviso mudou de estado. Recarregue e tente novamente.")
        return _serializa(resp.data[0])


def _is_unique_violation(exc: Exception) -> bool:
    """Detecta violação do índice único (aviso ativo duplicado) do PostgREST/Postgres."""
    code = getattr(exc, "code", "") or ""
    msg = str(getattr(exc, "message", "") or exc).lower()
    return code == "23505" or "duplicate key" in msg or "23505" in msg
