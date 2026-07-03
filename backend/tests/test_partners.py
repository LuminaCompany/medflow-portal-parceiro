"""Feature 003 — PartnersService partner-centric: agrupamento por Contratante e config
(cor + allowlist de unidades) sincronizada entre todos os logins da Contratante.

Usa um fake do Supabase Auth Admin API (sem rede). O `update_user_by_id` faz **merge raso**
de `app_metadata` — espelhando o GoTrue real — para que desligar `rebate_ativo` (chave omitida
vs. gravada como False) seja testado de verdade.
"""

from app.services.partners import PartnersService


class FakeUser:
    def __init__(self, uid, email, app_metadata=None, user_metadata=None):
        self.id = uid
        self.email = email
        self.app_metadata = app_metadata or {}
        self.user_metadata = user_metadata or {}
        self.created_at = None


class _Created:
    def __init__(self, user):
        self.user = user


class FakeAdminAPI:
    def __init__(self, users):
        self._users = users

    def list_users(self, page=1, per_page=200):
        return list(self._users) if page == 1 else []

    def create_user(self, payload):
        u = FakeUser(
            uid=f"u{len(self._users) + 1}",
            email=payload["email"],
            app_metadata=dict(payload.get("app_metadata") or {}),
            user_metadata=dict(payload.get("user_metadata") or {}),
        )
        self._users.append(u)
        return _Created(u)

    def update_user_by_id(self, uid, attrs):
        u = next(x for x in self._users if x.id == uid)
        if "app_metadata" in attrs:
            # Merge RASO (igual GoTrue): chaves não reenviadas sobrevivem. É exatamente por isso
            # que desligar rebate exige gravar a chave como False, não apenas omiti-la.
            u.app_metadata = {**u.app_metadata, **attrs["app_metadata"]}
        if "user_metadata" in attrs:
            u.user_metadata = {**u.user_metadata, **attrs["user_metadata"]}
        return _Created(u)

    def delete_user(self, uid):
        self._users[:] = [x for x in self._users if x.id != uid]


class FakeClient:
    def __init__(self, users):
        self.auth = type("A", (), {"admin": FakeAdminAPI(users)})()


def _meta(role="parceiro", contratante=None, cor=None, unidades=None):
    m = {"role": role}
    if contratante is not None:
        m["contratante"] = contratante
    if cor is not None:
        m["cor"] = cor
    if unidades is not None:
        m["unidades"] = unidades
    return m


def _svc(users):
    return PartnersService(FakeClient(users))


def test_listar_partners_agrupa_por_contratante():
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA", "UB"])),
        FakeUser("u2", "b@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA", "UB"])),
        FakeUser("u3", "c@ah.com", _meta(contratante="AH", unidades=["UX"])),
        FakeUser("g", "gestor@x.com", _meta(role="gestor")),  # ignorado
    ]
    partners = _svc(users).listar_partners()
    nomes = [p["contratante"] for p in partners]
    assert nomes == ["AH", "BESA"]
    besa = next(p for p in partners if p["contratante"] == "BESA")
    assert besa["cor"] == "#111111"
    assert besa["unidades"] == ["UA", "UB"]
    assert len(besa["logins"]) == 2


def test_criar_login_contratante_nova_usa_default():
    users: list = []
    svc = _svc(users)
    out = svc.criar_login(
        email="a@besa.com",
        nome_exibicao="A",
        contratante="BESA",
        senha_inicial="x",
        unidades_default=["UA", "UB"],
    )
    assert out["unidades"] == ["UA", "UB"]
    assert users[0].app_metadata["unidades"] == ["UA", "UB"]


def test_criar_segundo_login_herda_config_da_contratante():
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#222222", unidades=["UA"])),
    ]
    svc = _svc(users)
    out = svc.criar_login(
        email="b@besa.com",
        nome_exibicao="B",
        contratante="BESA",
        senha_inicial="x",
        unidades_default=["UA", "UB", "UC"],  # deve ser IGNORADO (herda da contratante)
    )
    assert out["unidades"] == ["UA"]
    assert out["cor"] == "#222222"


def test_editar_config_faz_fanout_para_todos_os_logins():
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA", "UB"])),
        FakeUser("u2", "b@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA", "UB"])),
    ]
    svc = _svc(users)
    svc.editar_config(contratante="BESA", unidades=["UA"])
    assert users[0].app_metadata["unidades"] == ["UA"]
    assert users[1].app_metadata["unidades"] == ["UA"]
    # cor preservada no fan-out
    assert users[0].app_metadata["cor"] == "#111111"


def test_editar_config_unidades_vazia_persiste_lista_vazia():
    users = [FakeUser("u1", "a@besa.com", _meta(contratante="BESA", unidades=["UA"]))]
    svc = _svc(users)
    svc.editar_config(contratante="BESA", unidades=[])
    assert users[0].app_metadata["unidades"] == []


def test_editar_config_fanout_rebate_ativo():
    """Feature 005: liga/desliga o serviço de rebate com fan-out para todos os logins."""
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA")),
        FakeUser("u2", "b@besa.com", _meta(contratante="BESA")),
    ]
    svc = _svc(users)
    out = svc.editar_config(contratante="BESA", rebate_ativo=True)
    assert out["rebate_ativo"] is True
    assert users[0].app_metadata.get("rebate_ativo") is True
    assert users[1].app_metadata.get("rebate_ativo") is True
    # Desligar DEVE persistir mesmo com merge raso do GoTrue: a chave é gravada como False
    # (não apenas omitida), senão o `true` antigo sobreviveria e o parceiro seguiria com desconto.
    out_off = svc.editar_config(contratante="BESA", rebate_ativo=False)
    assert out_off["rebate_ativo"] is False
    assert users[0].app_metadata["rebate_ativo"] is False
    assert users[1].app_metadata["rebate_ativo"] is False


def test_editar_config_rebate_preserva_unidades_e_cor():
    """Mexer só no rebate não apaga cor/unidades (merge da config sincronizada)."""
    users = [FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA"]))]
    svc = _svc(users)
    svc.editar_config(contratante="BESA", rebate_ativo=True)
    assert users[0].app_metadata["cor"] == "#111111"
    assert users[0].app_metadata["unidades"] == ["UA"]
    assert users[0].app_metadata["rebate_ativo"] is True


def test_listar_partners_expoe_rebate_ativo():
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA")),
        FakeUser("u2", "b@ah.com", {"role": "parceiro", "contratante": "AH", "rebate_ativo": True}),
    ]
    partners = {p["contratante"]: p for p in _svc(users).listar_partners()}
    assert partners["BESA"]["rebate_ativo"] is False  # ausente = desligado
    assert partners["AH"]["rebate_ativo"] is True


def test_mapa_unidades_por_contratante():
    users = [
        FakeUser("u1", "a@besa.com", _meta(contratante="BESA", unidades=["UA", "UB"])),
        FakeUser("u2", "c@ah.com", _meta(contratante="AH", unidades=["UB"])),  # UB em 2 → conflito
    ]
    mapa = _svc(users).mapa_unidades_por_contratante()
    assert mapa == {"BESA": ["UA", "UB"], "AH": ["UB"]}


def test_erro_criacao_traduz_causas():
    from app.services.partners import _erro_criacao

    assert _erro_criacao(Exception("User already registered")) == "E-mail já cadastrado."
    assert "6 caracteres" in _erro_criacao(Exception("Password should be at least 6 characters"))
    assert _erro_criacao(Exception("invalid email format")) == "E-mail inválido."
    assert _erro_criacao(Exception("boom")).startswith("Não foi possível criar")


# --- Router POST /api/admin/parceiros: wiring real (gestor, dataset + admin mockados) -------

def _criar_via_endpoint(monkeypatch, users, payload):
    from fastapi.testclient import TestClient

    import app.routers.partners as R
    from app.auth.deps import get_current_user
    from app.domain.models import AppUser
    from app.main import app

    monkeypatch.setattr(R, "_service", lambda: PartnersService(FakeClient(users)))
    monkeypatch.setattr(R, "_unidades_coocorrentes", lambda c: ["UPA Centro", "UBS Norte"])
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="g", email="g@x", role="gestor", contratante=None, nome_exibicao="G"
    )
    try:
        return TestClient(app, raise_server_exceptions=False).post(
            "/api/admin/parceiros", json=payload
        )
    finally:
        app.dependency_overrides.clear()


def test_post_criar_login_201_com_default_de_unidades(monkeypatch):
    users: list = []
    resp = _criar_via_endpoint(
        monkeypatch,
        users,
        {"email": "a@besa.com", "nome_exibicao": "A", "contratante": "BESA", "senha_inicial": "secret1"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["contratante"] == "BESA"
    assert body["unidades"] == ["UPA Centro", "UBS Norte"]


def test_post_segundo_login_herda_e_ignora_default(monkeypatch):
    users = [FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#222222", unidades=["UA"]))]
    resp = _criar_via_endpoint(
        monkeypatch,
        users,
        {"email": "b@besa.com", "nome_exibicao": "B", "contratante": "BESA", "senha_inicial": "secret1"},
    )
    assert resp.status_code == 201
    assert resp.json()["unidades"] == ["UA"]


def _sol(contratante, unidade):
    from datetime import date
    from decimal import Decimal

    from app.domain.models import Solicitacao

    return Solicitacao(
        codigo="X", quitado=False, cliente="Dr", valor=Decimal("1"),
        data_pedido=date(2026, 1, 1), data_vencimento=date(2026, 7, 1),
        contratante=contratante, unidade=unidade, status="a_pagar", status_label="A Pagar",
    )


def test_get_partners_inclui_contratantes_do_sheet_sem_login(monkeypatch):
    from fastapi.testclient import TestClient

    import app.routers.partners as R
    from app.auth.deps import get_current_user
    from app.domain.models import AppUser
    from app.main import app

    users = [FakeUser("u1", "a@besa.com", _meta(contratante="BESA", cor="#111111", unidades=["UA"]))]
    monkeypatch.setattr(R, "_service", lambda: PartnersService(FakeClient(users)))
    dataset = type("DS", (), {"validas": [_sol("BESA", "UA"), _sol("AH", "UB"), _sol("SOL", "UC")]})()
    monkeypatch.setattr(R, "get_dataset_service", lambda: type("S", (), {"get": lambda self: dataset})())
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="g", email="g@x", role="gestor", contratante=None, nome_exibicao="G"
    )
    try:
        body = TestClient(app, raise_server_exceptions=False).get("/api/admin/partners").json()
    finally:
        app.dependency_overrides.clear()

    by = {p["contratante"]: p for p in body}
    assert set(by) == {"AH", "BESA", "SOL"}  # todas as do sheet aparecem
    assert by["BESA"]["logins"] and by["BESA"]["unidades"] == ["UA"]  # com login mantém config
    assert by["AH"]["logins"] == [] and by["AH"]["unidades"] is None  # sem login = card vazio
    assert by["SOL"]["cor"]  # cor determinística presente
