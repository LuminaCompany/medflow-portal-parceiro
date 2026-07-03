"""Feature 007 — troca de senha obrigatória no 1º acesso.

Cobre o serviço (`trocar_senha`) e o endpoint `POST /api/me/trocar-senha`:
 - senha curta → erro de domínio (não chama o Auth);
 - sucesso grava a nova senha e limpa a flag `must_change_password` (preservando role/contratante);
 - o alvo é SEMPRE o dono do token (nunca do corpo);
 - gestor-only: parceiro recebe 403.

Usa um fake do Supabase Auth Admin API com **merge raso** de `app_metadata` (igual ao GoTrue),
para provar que limpar a flag preserva as demais chaves.
"""

import pytest
from fastapi.testclient import TestClient

import app.routers.conta as r_conta
from app.auth.deps import get_current_user
from app.domain.models import AppUser
from app.main import app
from app.services.conta import ContaError, trocar_senha


class FakeUser:
    def __init__(self, uid, email, app_metadata=None):
        self.id = uid
        self.email = email
        self.app_metadata = app_metadata or {}
        self.user_metadata = {}


class _Updated:
    def __init__(self, user):
        self.user = user


class FakeAdminAPI:
    def __init__(self, users):
        self._users = users
        self.calls: list[tuple[str, dict]] = []

    def update_user_by_id(self, uid, attrs):
        self.calls.append((uid, attrs))
        u = next(x for x in self._users if x.id == uid)
        if "password" in attrs:
            u.password = attrs["password"]
        if "app_metadata" in attrs:
            # Merge raso (igual GoTrue): chaves não reenviadas sobrevivem.
            u.app_metadata = {**u.app_metadata, **attrs["app_metadata"]}
        return _Updated(u)


class FakeClient:
    def __init__(self, users):
        self.auth = type("A", (), {"admin": FakeAdminAPI(users)})()


# ---- Serviço --------------------------------------------------------------------------


def test_trocar_senha_curta_nao_chama_auth():
    client = FakeClient([FakeUser("u1", "g@med", {"role": "gestor"})])
    with pytest.raises(ContaError):
        trocar_senha(client, "u1", "123")  # < 6
    assert client.auth.admin.calls == []


def test_trocar_senha_grava_senha_e_limpa_flag_preservando_meta():
    user = FakeUser(
        "u1", "g@med", {"role": "gestor", "contratante": None, "must_change_password": True}
    )
    client = FakeClient([user])

    trocar_senha(client, "u1", "senha-nova-123")

    assert user.password == "senha-nova-123"
    assert user.app_metadata["must_change_password"] is False
    assert user.app_metadata["role"] == "gestor"  # preservado pelo merge raso


def test_trocar_senha_user_id_vazio():
    client = FakeClient([])
    with pytest.raises(ContaError):
        trocar_senha(client, "", "senha-valida-123")


# ---- Endpoint -------------------------------------------------------------------------

http = TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def _limpa_overrides():
    yield
    app.dependency_overrides.clear()


def _gestor():
    return AppUser(id="g1", email="g@med", role="gestor", nome_exibicao="Gestor")


def test_endpoint_troca_senha_sucesso_204(monkeypatch, _limpa_overrides):
    user = FakeUser("g1", "g@med", {"role": "gestor", "must_change_password": True})
    client = FakeClient([user])
    monkeypatch.setattr(r_conta, "get_supabase_auth", lambda: type("X", (), {"admin": client})())
    app.dependency_overrides[get_current_user] = _gestor

    resp = http.post("/api/me/trocar-senha", json={"nova_senha": "senha-nova-123"})

    assert resp.status_code == 204
    # Alvo é o dono do token (g1), não algo do corpo; flag limpa.
    assert client.auth.admin.calls[0][0] == "g1"
    assert user.app_metadata["must_change_password"] is False


def test_endpoint_senha_curta_422(monkeypatch, _limpa_overrides):
    client = FakeClient([FakeUser("g1", "g@med", {"role": "gestor"})])
    monkeypatch.setattr(r_conta, "get_supabase_auth", lambda: type("X", (), {"admin": client})())
    app.dependency_overrides[get_current_user] = _gestor

    resp = http.post("/api/me/trocar-senha", json={"nova_senha": "123"})

    assert resp.status_code == 422  # barrado pelo Field(min_length) antes do serviço
    assert client.auth.admin.calls == []


def test_endpoint_parceiro_barrado_403(_limpa_overrides):
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="p1", email="p@med", role="parceiro", contratante="BESA", nome_exibicao="P"
    )
    resp = http.post("/api/me/trocar-senha", json={"nova_senha": "senha-nova-123"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"
