"""Router de administração de parceiros (US3 + feature 003) — `/api/admin/*` (T040).

Todas as rotas exigem papel gestor (`GestorUser` → 403 ao parceiro, RF-028).

Modelo partner-centric (feature 003): Parceiro = Contratante (cor + allowlist de unidades,
sincronizadas entre seus logins). Endpoints de apoio à UI: `contratantes` (dropdown da
criação) e `unidades` (toggles + badges de vínculo).
"""

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field

from app.auth.deps import GestorUser
from app.auth.supabase import get_supabase_auth
from app.services.cores import cor_para
from app.services.dataset import get_dataset_service
from app.services.partners import PartnersError, PartnersService

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Cor do parceiro: hex #rrggbb (escolhida pelo gestor numa roda de cores no frontend).
COR_HEX = r"^#[0-9a-fA-F]{6}$"


class CriarLoginIn(BaseModel):
    email: EmailStr
    nome_exibicao: str
    contratante: str
    senha_inicial: str
    cor: str | None = Field(default=None, pattern=COR_HEX)


class EditarLoginIn(BaseModel):
    nome_exibicao: str | None = None
    senha: str | None = None


class EditarConfigIn(BaseModel):
    contratante: str
    cor: str | None = Field(default=None, pattern=COR_HEX)
    unidades: list[str] | None = None


def _service() -> PartnersService:
    return PartnersService(get_supabase_auth().admin)


# ---- Leitura / apoio à UI --------------------------------------------------------


@router.get("/partners")
def listar_partners(_: GestorUser) -> list[dict]:
    """Parceiros = TODAS as Contratantes do sheet (existem por si) + as que já têm login.

    Contratante do sheet ainda sem login aparece como card vazio (cor determinística, sem
    allowlist). A config (cor + unidades) só persiste quando há ≥1 login — o front bloqueia
    'Editar parceiro' até lá. Logins NÃO são criados automaticamente.
    """
    com_login = {p["contratante"]: p for p in _service().listar_partners()}
    do_sheet = {s.contratante for s in get_dataset_service().get().validas if s.contratante}
    for contratante in do_sheet:
        if contratante not in com_login:
            com_login[contratante] = {
                "contratante": contratante,
                "cor": cor_para(contratante),
                "unidades": None,
                "logins": [],
            }
    return sorted(com_login.values(), key=lambda p: p["contratante"].lower())


@router.get("/parceiros")
def listar_parceiros(_: GestorUser) -> list[dict]:
    """Logins (flat) com papel parceiro — usado no painel 'Gerenciar logins'."""
    return _service().listar()


@router.get("/contratantes")
def listar_contratantes(_: GestorUser) -> list[dict]:
    """Contratantes distintas do sheet (dropdown da criação de login)."""
    totais: dict[str, int] = {}
    for s in get_dataset_service().get().validas:
        totais[s.contratante] = totais.get(s.contratante, 0) + 1
    return [
        {"contratante": c, "total": t}
        for c, t in sorted(totais.items(), key=lambda kv: kv[0].lower())
    ]


@router.get("/unidades")
def listar_unidades(_: GestorUser) -> list[dict]:
    """Universo de Unidades (existem no sheet) + vínculo atual por config (badges).

    Por unidade:
    - `contratantes`: parceiros que já têm a unidade na allowlist (vínculo por CONFIG).
    - `status`: `orfa` (0), `ok` (1) ou `conflito` (2+, aviso forte) — sobre `contratantes`.
    - `sheet_contratantes`: contratantes que coocorrem com a unidade no sheet (origem do dado;
      usado p/ pré-marcar o default quando o parceiro ainda não tem allowlist explícita).

    Existência da unidade = aparecer no sheet (CONTEXT.md / feature 003).
    """
    sheet_por_unidade: dict[str, set[str]] = {}
    for s in get_dataset_service().get().validas:
        if s.unidade:
            sheet_por_unidade.setdefault(s.unidade, set()).add(s.contratante)

    mapa = _service().mapa_unidades_por_contratante()
    saida = []
    for unidade in sorted(sheet_por_unidade):
        donos = sorted(c for c, units in mapa.items() if unidade in set(units))
        status_vinc = "orfa" if not donos else ("ok" if len(donos) == 1 else "conflito")
        saida.append(
            {
                "unidade": unidade,
                "contratantes": donos,
                "status": status_vinc,
                "sheet_contratantes": sorted(sheet_por_unidade[unidade]),
            }
        )
    return saida


# ---- Escrita ---------------------------------------------------------------------


@router.post("/parceiros", status_code=status.HTTP_201_CREATED)
def criar_login(body: CriarLoginIn, _: GestorUser) -> dict:
    """Cria um login. Se a Contratante é nova, pré-vincula por padrão as unidades que
    coocorrem com ela no sheet (replica o comportamento atual); senão herda a config dela."""
    try:
        return _service().criar_login(
            email=body.email,
            nome_exibicao=body.nome_exibicao,
            contratante=body.contratante,
            senha_inicial=body.senha_inicial,
            cor=body.cor,
            unidades_default=_unidades_coocorrentes(body.contratante),
        )
    except PartnersError as exc:
        raise _bad_request(exc) from exc


@router.put("/parceiros/{user_id}")
def editar_login(user_id: str, body: EditarLoginIn, _: GestorUser) -> dict:
    try:
        return _service().editar_login(
            user_id,
            nome_exibicao=body.nome_exibicao,
            senha=body.senha,
        )
    except PartnersError as exc:
        raise _bad_request(exc) from exc


@router.put("/partners")
def editar_config(body: EditarConfigIn, _: GestorUser) -> dict:
    """Edita a config do Parceiro (cor + allowlist de unidades) — fan-out para todos os logins."""
    try:
        return _service().editar_config(
            contratante=body.contratante,
            cor=body.cor,
            unidades=body.unidades,
        )
    except PartnersError as exc:
        raise _bad_request(exc) from exc


@router.delete("/parceiros/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_login(user_id: str, _: GestorUser) -> Response:
    try:
        _service().remover(user_id)
    except PartnersError as exc:
        raise _bad_request(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Internos --------------------------------------------------------------------


def _unidades_coocorrentes(contratante: str) -> list[str]:
    """Unidades que aparecem no sheet em linhas da Contratante (default ON na criação)."""
    alvo = contratante.strip()
    return sorted(
        {
            s.unidade
            for s in get_dataset_service().get().validas
            if s.contratante == alvo and s.unidade
        }
    )


def _bad_request(exc: PartnersError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "bad_request", "message": str(exc)},
    )
