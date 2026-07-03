"""Router de Avisos de Pagamento (feature 004) — `/api/pagamentos/*`.

Parceiro: envia/cancela aviso e lê o estado dos seus avisos (badges na aba Vencimentos).
Gestor: consolidado por contratante (Aguardando / Verificadas / Falta aviso) + verificar /
rejeitar / reabrir. Isolamento (R-001): o snapshot do aviso vem SEMPRE do dataset escopado
do parceiro — o corpo do request só informa qual unidade.
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from app.auth.deps import CurrentUser, GestorUser
from app.auth.supabase import get_supabase_auth
from app.domain.scope import filtra_por_escopo, is_gestor
from app.services.dataset import get_dataset_service
from app.services.pagamentos import (
    PagamentoAvisoError,
    PagamentosService,
    monta_meus_avisos,
    monta_visao_gestor,
    snapshot_lote,
)
from app.services.partners import PartnersService

router = APIRouter(prefix="/api/pagamentos", tags=["pagamentos"])


class AvisoIn(BaseModel):
    unidade: str
    data_vencimento: date
    # Eco do valor (Originação) que o parceiro viu no modal. Se divergir do snapshot recomputado
    # no servidor (dado atualizado no sheet OU filtro de UI ativo reduzindo a linha), barra o envio
    # em vez de congelar em silêncio um valor diferente do confirmado.
    valor_esperado: Decimal | None = None


class RejeitarIn(BaseModel):
    motivo: str


def _service() -> PagamentosService:
    return PagamentosService(get_supabase_auth().admin)


def _bad_request(exc: PagamentoAvisoError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "bad_request", "message": str(exc)},
    )


# ---- Parceiro --------------------------------------------------------------------


@router.post("/avisos", status_code=status.HTTP_201_CREATED)
def criar_aviso(body: AvisoIn, user: CurrentUser) -> dict:
    """Parceiro avisa o pagamento de UM lote (unidade + data de vencimento).

    Valor + códigos congelados no servidor a partir do dataset já escopado (R-001) — o corpo
    só informa qual unidade e qual vencimento.
    """
    if is_gestor(user) or not user.contratante:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Apenas parceiros enviam avisos."},
        )
    escopadas = filtra_por_escopo(get_dataset_service().get().validas, user)
    sols = [
        s
        for s in escopadas
        if s.unidade == body.unidade and s.data_vencimento == body.data_vencimento
    ]
    if not sols:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Vencimento não encontrado no seu escopo."},
        )
    try:
        valor, rebate, codigos = snapshot_lote(sols, user.rebate_ativo)
        if body.valor_esperado is not None and body.valor_esperado != valor:
            raise PagamentoAvisoError(
                "O valor deste lote mudou (dados atualizados ou filtro ativo). "
                "Recarregue a página e confirme novamente."
            )
        return _service().criar(
            user.contratante, body.unidade, body.data_vencimento, valor, codigos, rebate
        )
    except PagamentoAvisoError as exc:
        raise _bad_request(exc) from exc


@router.delete("/avisos/{aviso_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_aviso(aviso_id: str, user: CurrentUser) -> Response:
    """Parceiro cancela o próprio aviso (só se ainda pendente)."""
    if is_gestor(user) or not user.contratante:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Apenas parceiros cancelam avisos."},
        )
    try:
        _service().cancelar(aviso_id, user.contratante)
    except PagamentoAvisoError as exc:
        raise _bad_request(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/meus")
def meus_avisos(user: CurrentUser) -> dict:
    """Estado dos avisos do parceiro por unidade (alimenta os badges em Vencimentos)."""
    if is_gestor(user) or not user.contratante:
        return {"avisos": {}}
    return monta_meus_avisos(_service().listar_do_contratante(user.contratante))


# ---- Gestor ----------------------------------------------------------------------


@router.get("")
def consolidado(_: GestorUser) -> dict:
    """Quadro do gestor: por contratante → Aguardando / Verificadas / Falta aviso."""
    validas = get_dataset_service().get().validas
    cores = PartnersService(get_supabase_auth().admin).mapa_cores()
    return monta_visao_gestor(validas, _service().listar(), cores=cores)


@router.post("/avisos/{aviso_id}/verificar")
def verificar(aviso_id: str, _: GestorUser) -> dict:
    try:
        return _service().verificar(aviso_id)
    except PagamentoAvisoError as exc:
        raise _bad_request(exc) from exc


@router.post("/avisos/{aviso_id}/rejeitar")
def rejeitar(aviso_id: str, body: RejeitarIn, _: GestorUser) -> dict:
    try:
        return _service().rejeitar(aviso_id, body.motivo)
    except PagamentoAvisoError as exc:
        raise _bad_request(exc) from exc


@router.post("/avisos/{aviso_id}/reabrir")
def reabrir(aviso_id: str, _: GestorUser) -> dict:
    try:
        return _service().reabrir(aviso_id)
    except PagamentoAvisoError as exc:
        raise _bad_request(exc) from exc
