"""Router "Divisão por Unidade" (feature 014) — `/api/admin/divisoes`, gestor-only.

O gestor reparte, no portal, uma linha da A.H. GESTÃO MÉDICA que chegou sem Unidade
Referência (PA/PS sem valor na OBS, valores que não batem, OBS vazia…). Contratante, código de
origem e Originação vêm SEMPRE da pendência no dataset — o corpo só traz as unidades/valores.
Salvar/desfazer invalida o dataset p/ a linha repartir (ou voltar à pendência) na hora.
"""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.auth.deps import GestorUser
from app.auth.supabase import get_supabase_auth
from app.domain.divisao import MAX_PARTES
from app.domain.models import ParteDivisao
from app.services.dataset import get_dataset_service
from app.services.divisoes import DivisaoError, DivisoesService, valida_partes
from app.services.pendencias import opcoes_unidades

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ParteIn(BaseModel):
    unidade: str = Field(max_length=120)
    valor: Decimal


class DivisaoIn(BaseModel):
    partes: list[ParteIn] = Field(min_length=1, max_length=MAX_PARTES)


def _service() -> DivisoesService:
    return DivisoesService(get_supabase_auth().admin)


@router.get("/divisoes")
def listar_divisoes(_: GestorUser) -> list[dict]:
    """Divisões já definidas pelo gestor (p/ conferir e desfazer)."""
    try:
        return _service().listar()
    except Exception as exc:  # noqa: BLE001 — tabela ausente/Postgres fora
        raise _bad_request(DivisaoError("Não foi possível carregar as divisões.")) from exc


@router.put("/divisoes/{codigo_origem}")
def salvar_divisao(codigo_origem: str, body: DivisaoIn, gestor: GestorUser) -> dict:
    """Define (ou redefine) a divisão de UMA linha pendente de divisão por unidade."""
    dataset = get_dataset_service().get()
    pendencia = next(
        (
            p
            for p in dataset.pendencias
            if p.divisao is not None and p.codigo_origem == codigo_origem
        ),
        None,
    )
    if pendencia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "not_found",
                "message": "Essa linha não está mais pendente de divisão. Recarregue a página.",
            },
        )
    try:
        partes = valida_partes(
            [ParteDivisao(unidade=p.unidade, valor=p.valor) for p in body.partes],
            pendencia,
            opcoes_unidades(dataset.validas, pendencia.contratante),
        )
        salvo = _service().salvar(pendencia, partes, gestor.nome_exibicao)
    except DivisaoError as exc:
        raise _bad_request(exc) from exc
    get_dataset_service().invalidate()
    return salvo


@router.delete("/divisoes/{divisao_id}", status_code=status.HTTP_204_NO_CONTENT)
def desfazer_divisao(divisao_id: UUID, _: GestorUser) -> Response:
    """Apaga a divisão: a linha volta à pendência de divisão na próxima leitura."""
    try:
        _service().remover(str(divisao_id))
    except DivisaoError as exc:
        raise _bad_request(exc) from exc
    get_dataset_service().invalidate()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _bad_request(exc: DivisaoError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "bad_request", "message": str(exc)},
    )
