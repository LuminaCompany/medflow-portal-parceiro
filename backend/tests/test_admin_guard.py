"""T042 — guarda de admin: parceiro recebe 403 em /api/admin/* (RF-028/034).

Sobrescreve só a dependência de usuário (sem Supabase real). O caminho do parceiro
curto-circuita em `require_gestor` antes de tocar qualquer serviço.
"""

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import get_current_user
from app.domain.models import AppUser
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _override_parceiro():
    return AppUser(
        id="u", email="p@p", role="parceiro", contratante="BESA Medical Group", nome_exibicao="P"
    )


@pytest.fixture(autouse=True)
def _limpa_overrides():
    yield
    app.dependency_overrides.clear()


def test_parceiro_recebe_403_em_admin_parceiros():
    app.dependency_overrides[get_current_user] = _override_parceiro
    casos = [
        client.get("/api/admin/parceiros"),
        client.post("/api/admin/parceiros", json={}),
        client.get("/api/admin/pendencias"),
    ]
    for resp in casos:
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "forbidden"


def test_sem_token_recebe_401():
    resp = client.get("/api/admin/parceiros")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_parceiro_lista_gestor_only_403():
    app.dependency_overrides[get_current_user] = _override_parceiro
    resp = client.get("/api/parceiros/lista")
    assert resp.status_code == 403
