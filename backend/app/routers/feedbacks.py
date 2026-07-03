"""Router de Feedbacks (feature 006) — `/api/feedbacks/*`.

Envio (parceiro OU gestor): POST cria um feedback (sugestão / bug). O autor vem SEMPRE do token
(nunca do corpo). Gestão (gestor-only): listar todos, marcar "feito", reabrir.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth.deps import CurrentUser, GestorUser
from app.auth.supabase import get_supabase_auth
from app.services.feedbacks import FeedbackError, FeedbacksService

router = APIRouter(prefix="/api/feedbacks", tags=["feedbacks"])


class FeedbackIn(BaseModel):
    aba: str
    tipo: str  # "sugestao" | "bug"
    descricao: str


def _service() -> FeedbacksService:
    return FeedbacksService(get_supabase_auth().admin)


def _bad_request(exc: FeedbackError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "bad_request", "message": str(exc)},
    )


# ---- Envio (parceiro OU gestor) --------------------------------------------------


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(body: FeedbackIn, user: CurrentUser) -> dict:
    """Qualquer usuário autenticado envia um feedback. Autor derivado do token."""
    try:
        return _service().criar(user, body.aba, body.tipo, body.descricao)
    except FeedbackError as exc:
        raise _bad_request(exc) from exc


# ---- Gestão (gestor-only) --------------------------------------------------------


@router.get("")
def listar(_: GestorUser) -> dict:
    """Todos os feedbacks (mural do gestor)."""
    itens = _service().listar()
    abertos = sum(1 for f in itens if f["status"] == "aberto")
    return {
        "cards": {
            "abertos": abertos,
            "concluidos": len(itens) - abertos,
            "sugestoes": sum(1 for f in itens if f["tipo"] == "sugestao"),
            "bugs": sum(1 for f in itens if f["tipo"] == "bug"),
        },
        "feedbacks": itens,
    }


@router.post("/{feedback_id}/feito")
def marcar_feito(feedback_id: str, gestor: GestorUser) -> dict:
    try:
        return _service().marcar_feito(feedback_id, gestor.nome_exibicao)
    except FeedbackError as exc:
        raise _bad_request(exc) from exc


@router.post("/{feedback_id}/reabrir")
def reabrir(feedback_id: str, _: GestorUser) -> dict:
    try:
        return _service().reabrir(feedback_id)
    except FeedbackError as exc:
        raise _bad_request(exc) from exc
