"""App FastAPI — monta routers, CORS e formato único de erro (T017, contracts/api.md).

Toda rota de dados exige JWT Supabase; o isolamento (R-001) é garantido nos serviços
antes de serializar. Erros sempre no formato `{ "error": { "code", "message" } }`,
em pt-BR, sem vazar stack nem dado de outro parceiro.
"""

from contextlib import asynccontextmanager, suppress
from threading import Thread

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routers import (
    auth,
    filtros,
    overview,
    pagamentos,
    partners,
    pendencias,
    solicitacoes,
    vencimentos,
)
from app.services.dataset import get_dataset_service

settings = get_settings()


def _warm_cache() -> None:
    """Pré-carrega o dataset (Sheets → cache) fora do caminho de request."""
    # Sem creds/rede no boot não pode derrubar o app; o 1º request recarrega.
    with suppress(Exception):
        get_dataset_service().get()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Aquece o cache em background: o boot não espera a Sheets API e o 1º request
    # real (pós-deploy) não paga o load frio.
    Thread(target=_warm_cache, daemon=True).start()
    yield


app = FastAPI(title="MedFlow — Portal do Parceiro", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Normaliza HTTPException → formato único. `detail` já vem como {code,message} das deps."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        body = {"error": detail}
    else:
        body = {"error": {"code": _code_for(exc.status_code), "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request", "message": "Requisição inválida."}},
    )


def _code_for(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
    }.get(status_code, "error")


@app.get("/health", tags=["infra"])
def health() -> dict[str, str]:
    """Health check para o EasyPanel/uptime."""
    return {"status": "ok"}


# Routers — cada feature monta o seu (isolamento garantido no serviço).
app.include_router(auth.router)
app.include_router(vencimentos.router)
app.include_router(solicitacoes.router)
app.include_router(overview.router)
app.include_router(partners.router)
app.include_router(pendencias.router)
app.include_router(filtros.router)
app.include_router(pagamentos.router)
