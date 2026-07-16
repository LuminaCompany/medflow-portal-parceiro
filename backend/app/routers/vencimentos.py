"""Router de Vencimentos — `GET /api/vencimentos` (T031, T053 gestor).

Parceiro: cards + atrasados/próximos/pagos (escopado). Gestor: consolidado ranqueado.
"""

from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi import status as http_status
from fastapi.responses import Response

from app.auth.deps import CurrentUser
from app.domain.filtros.engine import parse as parse_filtros
from app.domain.filtros.registry import ABA_VENCIMENTOS
from app.domain.scope import is_gestor
from app.services.dataset import get_dataset_service
from app.services.solicitacoes import (
    FORMATO_PDF,
    FORMATO_XLSX,
    MEDIA_POR_FORMATO,
    exporta_lote_pdf,
    exporta_lote_xlsx,
)
from app.services.vencimentos import (
    PROXIMOS_DEFAULT,
    vencimentos_gestor,
    vencimentos_parceiro,
)

router = APIRouter(prefix="/api", tags=["vencimentos"])


@router.get("/vencimentos")
def get_vencimentos(
    request: Request,
    user: CurrentUser,
    proximos: str = Query(PROXIMOS_DEFAULT, description="2d | 1sem | 2sem"),
) -> dict:
    papel = "gestor" if is_gestor(user) else "parceiro"
    filtros = parse_filtros(request.query_params, ABA_VENCIMENTOS, papel)
    dataset = get_dataset_service().get()
    if is_gestor(user):
        return vencimentos_gestor(dataset.validas, filtros=filtros)
    return vencimentos_parceiro(dataset.validas, user, proximos=proximos, filtros=filtros)


@router.get("/vencimentos/export")
def export_vencimentos(
    user: CurrentUser,
    unidade: str = Query(..., description="Unidade do lote a exportar"),
    data_vencimento: str | None = Query(
        None, description="Vencimento do lote (ISO). Ausente = unidade inteira"
    ),
    contratante: str | None = Query(None, description="Desambigua a unidade (gestor)"),
    formato: str = Query(FORMATO_XLSX, description="xlsx (planilha) | pdf (Rel. Fechamento)"),
) -> Response:
    """Exporta o lote (unidade + vencimento) da aba Vencimentos em XLSX (modelo da
    planilha-mestre) ou PDF (Relatório de Fechamento). Escopo R-001 no serviço — o arquivo
    nunca carrega dado de outra Contratante nem fora da allowlist de Unidades."""
    if formato not in MEDIA_POR_FORMATO:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "bad_request", "message": "formato inválido (use xlsx ou pdf)."},
        )
    venc: date | None = None
    if data_vencimento:
        try:
            venc = date.fromisoformat(data_vencimento)
        except ValueError as e:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail={"code": "bad_request", "message": "data_vencimento inválida (use ISO)."},
            ) from e
    dataset = get_dataset_service().get()
    exporta = exporta_lote_pdf if formato == FORMATO_PDF else exporta_lote_xlsx
    conteudo = exporta(dataset, user, unidade, venc, contratante)
    sufixo = venc.isoformat() if venc else date.today().isoformat()
    nome = f"vencimentos_{sufixo}.{formato}"
    return Response(
        content=conteudo,
        media_type=MEDIA_POR_FORMATO[formato],
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )
