"""Serviço de Feedbacks (feature 006).

Parceiro OU gestor envia um feedback (sugestão / bug) apontando a aba onde o item está e uma
descrição. O gestor vê todos numa aba própria e marca "feito" quando resolvido (ou reabre).

NÃO toca sheet/CRM nem dado financeiro — é só um mural de feedbacks persistido no Postgres do
portal (tabela `feedbacks`, service role, RLS deny-all). O gestor é o destinatário: vê TODOS os
feedbacks de todos os parceiros (não há isolamento por Contratante aqui). O autor é gravado só
como contexto (nome/papel/contratante) de quem reportou.
"""

from datetime import UTC, datetime

from supabase import Client

from app.domain.models import AppUser

TABELA = "feedbacks"

TIPOS = ("sugestao", "bug")

FEEDBACK_ABERTO = "aberto"
FEEDBACK_FEITO = "feito"

TIPO_LABELS: dict[str, str] = {"sugestao": "Sugestão", "bug": "Bug / erro"}
STATUS_LABELS: dict[str, str] = {FEEDBACK_ABERTO: "Aberto", FEEDBACK_FEITO: "Concluído"}

MAX_DESCRICAO = 4000


class FeedbackError(Exception):
    """Falha de regra de negócio do feedback (mapeada para 400 no router)."""


def _serializa(row: dict) -> dict:
    """Linha da tabela → shape do contrato."""
    status = row["status"]
    tipo = row["tipo"]
    return {
        "id": str(row["id"]),
        "autor_nome": row["autor_nome"],
        "autor_papel": row["autor_papel"],
        "contratante": row.get("contratante"),
        "aba": row["aba"],
        "tipo": tipo,
        "tipo_label": TIPO_LABELS.get(tipo, tipo),
        "descricao": row["descricao"],
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "concluido_por": row.get("concluido_por"),
        "concluido_at": row.get("concluido_at"),
        "created_at": row.get("created_at"),
    }


class FeedbacksService:
    """Operações de escrita/leitura da tabela `feedbacks` (service role)."""

    def __init__(self, admin: Client) -> None:
        self._db = admin

    def _table(self):
        return self._db.table(TABELA)

    # ---- Escrita -----------------------------------------------------------------

    def criar(self, autor: AppUser, aba: str, tipo: str, descricao: str) -> dict:
        """Cria um feedback (aberto). O autor vem SEMPRE do usuário autenticado (nunca do corpo)."""
        aba = (aba or "").strip()
        descricao = (descricao or "").strip()
        if tipo not in TIPOS:
            raise FeedbackError("Tipo inválido.")
        if not aba:
            raise FeedbackError("Escolha a aba do feedback.")
        if not descricao:
            raise FeedbackError("Descreva o seu feedback.")
        if len(descricao) > MAX_DESCRICAO:
            raise FeedbackError("Descrição muito longa.")
        payload = {
            "autor_id": autor.id,
            "autor_nome": autor.nome_exibicao,
            "autor_papel": autor.role,
            "contratante": autor.contratante,
            "aba": aba[:120],
            "tipo": tipo,
            "descricao": descricao,
            "status": FEEDBACK_ABERTO,
        }
        try:
            resp = self._table().insert(payload).execute()
        except Exception as exc:  # noqa: BLE001 — vira erro de domínio legível
            raise FeedbackError("Não foi possível registrar o feedback.") from exc
        return _serializa(resp.data[0])

    def marcar_feito(self, feedback_id: str, gestor_nome: str) -> dict:
        """Gestor marca o feedback como concluído (aberto → feito)."""
        return self._update(
            feedback_id,
            {
                "status": FEEDBACK_FEITO,
                "concluido_por": gestor_nome,
                "concluido_at": datetime.now(UTC).isoformat(),
            },
        )

    def reabrir(self, feedback_id: str) -> dict:
        """Gestor desfaz a conclusão (feito → aberto) — corrige clique errado."""
        return self._update(
            feedback_id,
            {"status": FEEDBACK_ABERTO, "concluido_por": None, "concluido_at": None},
        )

    # ---- Leitura -----------------------------------------------------------------

    def listar(self) -> list[dict]:
        """Todos os feedbacks (visão do gestor), mais recentes primeiro."""
        resp = self._table().select("*").order("created_at", desc=True).execute()
        return [_serializa(r) for r in (resp.data or [])]

    # ---- Internos ----------------------------------------------------------------

    def _update(self, feedback_id: str, attrs: dict) -> dict:
        try:
            resp = self._table().update(attrs).eq("id", feedback_id).execute()
        except Exception as exc:  # noqa: BLE001
            raise FeedbackError("Não foi possível atualizar o feedback.") from exc
        if not resp.data:
            raise FeedbackError("Feedback não encontrado.")
        return _serializa(resp.data[0])
