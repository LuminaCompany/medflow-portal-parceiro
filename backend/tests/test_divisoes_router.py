"""Feature 014 — router `/api/admin/divisoes`: gestor-only; contratante/código/Originação vêm
da PENDÊNCIA no dataset (nunca do corpo); salvar/desfazer invalida o dataset."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

import app.routers.divisoes as r_div
from app.auth.deps import get_current_user
from app.domain.models import AppUser, ParteDivisao, Pendencia, Solicitacao
from app.main import app
from app.services.dataset import Dataset

AH = "A.H. GESTÃO MÉDICA"
PA, PS = "PA Lorena", "PS Lorena"

client = TestClient(app, raise_server_exceptions=False)


class _FakeDataset:
    def __init__(self, ds: Dataset):
        self._ds = ds
        self.invalidacoes = 0

    def get(self) -> Dataset:
        return self._ds

    def invalidate(self) -> None:
        self.invalidacoes += 1


class _FakeDivisoes:
    def __init__(self):
        self.salvos: list[tuple[Pendencia, tuple[ParteDivisao, ...], str]] = []
        self.removidos: list[str] = []

    def listar(self):
        return []

    def salvar(self, pendencia, partes, autor):
        self.salvos.append((pendencia, partes, autor))
        return {"id": "x", "contratante": pendencia.contratante}

    def remover(self, divisao_id):
        self.removidos.append(divisao_id)


def _pendencia(codigo_origem="1414", divisao=True):
    return Pendencia(
        codigo="(linha 10)",
        cliente="Dra. Hannah",
        contratante=AH,
        valor=Decimal("1000"),
        motivos=["PA/PS sem valor"],
        linha_origem=10,
        codigo_origem=codigo_origem,
        divisao=[ParteDivisao(unidade=PA), ParteDivisao(unidade=PS)] if divisao else None,
    )


def _valida_ah():
    return Solicitacao(
        codigo="AHG-00001", quitado=False, cliente="Dr. X", valor=Decimal("1"),
        data_pedido=date(2026, 9, 1), data_vencimento=date(2026, 10, 5), contratante=AH,
        unidade="NEO Lorena", status="a_pagar", status_label="A Vencer",
    )


@pytest.fixture
def fakes(monkeypatch):
    ds = _FakeDataset(
        Dataset(
            validas=[_valida_ah()],
            pendencias=[_pendencia(), _pendencia(codigo_origem="999", divisao=False)],
            base_medicos={},
        )
    )
    svc = _FakeDivisoes()
    monkeypatch.setattr(r_div, "get_dataset_service", lambda: ds)
    monkeypatch.setattr(r_div, "_service", lambda: svc)
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="g", email="g@g", role="gestor", nome_exibicao="Gestor Teste"
    )
    yield ds, svc
    app.dependency_overrides.clear()


def _corpo(pa="400.00", ps="600.00"):
    return {"partes": [{"unidade": PA, "valor": pa}, {"unidade": PS, "valor": ps}]}


def test_salvar_usa_contratante_da_pendencia_e_invalida(fakes):
    ds, svc = fakes
    # Mesmo que o corpo tente mandar outra contratante, ela é ignorada (não existe no schema).
    corpo = {**_corpo(), "contratante": "BESA Medical Group"}
    resp = client.put("/api/admin/divisoes/1414", json=corpo)
    assert resp.status_code == 200, resp.text
    pend, partes, autor = svc.salvos[0]
    assert pend.contratante == AH and pend.codigo_origem == "1414"
    assert [(p.unidade, p.valor) for p in partes] == [(PA, Decimal("400")), (PS, Decimal("600"))]
    assert autor == "Gestor Teste"
    assert ds.invalidacoes == 1


def test_salvar_aceita_unidade_ja_existente_da_contratante(fakes):
    _, svc = fakes
    corpo = {"partes": [{"unidade": "NEO Lorena", "valor": "1000"}]}
    assert client.put("/api/admin/divisoes/1414", json=corpo).status_code == 200
    assert svc.salvos[0][1][0].unidade == "NEO Lorena"


def test_salvar_soma_errada_400(fakes):
    _, svc = fakes
    resp = client.put("/api/admin/divisoes/1414", json=_corpo(ps="500.00"))
    assert resp.status_code == 400
    assert "Originação" in resp.json()["error"]["message"]
    assert svc.salvos == []


def test_salvar_linha_que_nao_e_divisao_404(fakes):
    assert client.put("/api/admin/divisoes/999", json=_corpo()).status_code == 404
    assert client.put("/api/admin/divisoes/nao-existe", json=_corpo()).status_code == 404


def test_desfazer_invalida(fakes):
    ds, svc = fakes
    resp = client.delete("/api/admin/divisoes/6f1c2a4e-1111-4222-8333-444455556666")
    assert resp.status_code == 204
    assert svc.removidos == ["6f1c2a4e-1111-4222-8333-444455556666"]
    assert ds.invalidacoes == 1


def test_desfazer_id_invalido_422(fakes):
    assert client.delete("/api/admin/divisoes/abc").status_code == 422


def test_parceiro_barrado_em_todas_as_rotas():
    app.dependency_overrides[get_current_user] = lambda: AppUser(
        id="p", email="p@p", role="parceiro", contratante=AH, nome_exibicao="AH"
    )
    try:
        casos = [
            client.get("/api/admin/divisoes"),
            client.put("/api/admin/divisoes/1414", json=_corpo()),
            client.delete("/api/admin/divisoes/6f1c2a4e-1111-4222-8333-444455556666"),
        ]
        for resp in casos:
            assert resp.status_code == 403
            assert resp.json()["error"]["code"] == "forbidden"
    finally:
        app.dependency_overrides.clear()
