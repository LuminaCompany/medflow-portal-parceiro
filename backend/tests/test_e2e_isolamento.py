"""T063 — E2E de isolamento (R-001/CS-002): manipular `parceiros`/ID por parceiro resulta
em 403/dado vazio, nunca vazamento. Exercita os endpoints reais com dataset injetado."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import app.routers.overview as r_overview
import app.routers.solicitacoes as r_sol
import app.routers.vencimentos as r_venc
from app.auth.deps import get_current_user
from app.domain.models import AppUser, Solicitacao
from app.main import app
from app.services.dataset import Dataset

BESA = "BESA Medical Group"
AH = "A.H. GESTÃO MÉDICA"

client = TestClient(app, raise_server_exceptions=False)


def _sol(contratante, codigo):
    return Solicitacao(
        codigo=codigo,
        quitado=False,
        cliente=f"Dr. {codigo}",
        valor=Decimal("1000"),
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        contratante=contratante,
        status="a_pagar",
        status_label="A Pagar",
        medico_grupo_id=f"dr-{codigo}",
    )


class _FakeService:
    def __init__(self, ds: Dataset):
        self._ds = ds

    def get(self) -> Dataset:
        return self._ds


@pytest.fixture(autouse=True)
def _injeta_dataset(monkeypatch):
    ds = Dataset(
        validas=[_sol(BESA, "1"), _sol(AH, "99")],
        pendencias=[],
        base_medicos={},
    )
    fake = lambda: _FakeService(ds)  # noqa: E731
    monkeypatch.setattr(r_sol, "get_dataset_service", fake)
    monkeypatch.setattr(r_venc, "get_dataset_service", fake)
    monkeypatch.setattr(r_overview, "get_dataset_service", fake)
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="u", email="p@p", role="parceiro", contratante=BESA, nome_exibicao="BESA"
    )
    yield
    app.dependency_overrides.clear()


def test_lista_so_traz_o_proprio_parceiro():
    resp = client.get("/api/solicitacoes")
    assert resp.status_code == 200
    assert {i["codigo"] for i in resp.json()["items"]} == {"1"}


def test_forcar_parceiros_de_outro_eh_ignorado():
    # parceiro tenta filtrar pelo contratante de outro → escopo próprio prevalece (vazio de AH)
    resp = client.get("/api/solicitacoes?parceiros=A.H.%20GEST%C3%83O%20M%C3%89DICA")
    assert resp.status_code == 200
    codigos = {i["codigo"] for i in resp.json()["items"]}
    assert "99" not in codigos


def test_detalhe_de_outro_parceiro_404():
    resp = client.get("/api/solicitacoes/99")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_vencimentos_nao_vaza_outro_parceiro():
    resp = client.get("/api/vencimentos")
    assert resp.status_code == 200
    body = resp.json()
    codigos = {
        i["codigo"] for i in body["atrasados"] + body["proximos"] + body["pagos"]
    }
    assert "99" not in codigos
