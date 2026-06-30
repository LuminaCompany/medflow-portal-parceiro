"""T022 — scope: parceiro NUNCA recebe linha de outro Contratante (R-001)."""

from datetime import date
from decimal import Decimal

from app.domain.models import AppUser, Solicitacao
from app.domain.scope import escopo_permitido, filtra_por_escopo


def _sol(contratante: str, codigo: str, unidade: str | None = None) -> Solicitacao:
    return Solicitacao(
        codigo=codigo,
        quitado=False,
        cliente="Dr. X",
        valor=Decimal("100"),
        data_pedido=date(2026, 1, 1),
        data_vencimento=date(2026, 7, 1),
        contratante=contratante,
        unidade=unidade,
        status="a_pagar",
        status_label="A Pagar",
    )


def _user(role: str, contratante: str | None, unidades: list[str] | None = None) -> AppUser:
    return AppUser(
        id="u", email="e@e", role=role, contratante=contratante, nome_exibicao="N", unidades=unidades
    )


DATASET = [_sol("BESA Medical Group", "1"), _sol("A.H. GESTÃO MÉDICA", "2")]


def test_parceiro_so_ve_o_proprio():
    user = _user("parceiro", "BESA Medical Group")
    out = filtra_por_escopo(DATASET, user)
    assert [s.codigo for s in out] == ["1"]


def test_parceiro_nunca_ve_outro():
    user = _user("parceiro", "A.H. GESTÃO MÉDICA")
    out = filtra_por_escopo(DATASET, user)
    assert all(s.contratante == "A.H. GESTÃO MÉDICA" for s in out)
    assert "1" not in [s.codigo for s in out]


def test_parceiro_sem_contratante_nao_ve_nada():
    """Falha fechada: parceiro sem escopo definido não recebe linha alguma."""
    user = _user("parceiro", None)
    assert filtra_por_escopo(DATASET, user) == []


def test_gestor_ve_tudo():
    user = _user("gestor", None)
    out = filtra_por_escopo(DATASET, user)
    assert len(out) == 2


def test_escopo_permitido_parceiro_ignora_pedido_de_outro():
    user = _user("parceiro", "BESA Medical Group")
    # tenta forçar outro contratante via query → é sobrescrito pelo próprio escopo
    assert escopo_permitido(user, ["A.H. GESTÃO MÉDICA"]) == ["BESA Medical Group"]


def test_escopo_permitido_gestor_passa_filtro():
    user = _user("gestor", None)
    assert escopo_permitido(user, ["BESA Medical Group"]) == ["BESA Medical Group"]
    assert escopo_permitido(user, None) is None


# --- Feature 003: allowlist de Unidade refina DENTRO da Contratante --------------------

DATASET_UNID = [
    _sol("BESA Medical Group", "1", unidade="UPA Centro"),
    _sol("BESA Medical Group", "2", unidade="UBS Norte"),
    _sol("A.H. GESTÃO MÉDICA", "3", unidade="Hosp. Leste"),
]


def test_unidades_none_sem_restricao_backcompat():
    """Allowlist nunca configurada (None) → parceiro vê todas as unidades da contratante."""
    user = _user("parceiro", "BESA Medical Group", unidades=None)
    out = filtra_por_escopo(DATASET_UNID, user)
    assert sorted(s.codigo for s in out) == ["1", "2"]


def test_unidades_allowlist_restringe_dentro_do_contratante():
    user = _user("parceiro", "BESA Medical Group", unidades=["UPA Centro"])
    out = filtra_por_escopo(DATASET_UNID, user)
    assert [s.codigo for s in out] == ["1"]


def test_unidades_vazia_nao_ve_nada():
    """Allowlist explícita vazia ([]) → falha fechada, nenhuma solicitação."""
    user = _user("parceiro", "BESA Medical Group", unidades=[])
    assert filtra_por_escopo(DATASET_UNID, user) == []


def test_unidade_de_outro_contratante_na_allowlist_nao_concede_acesso():
    """Unidade de outra contratante na allowlist NUNCA fura o isolamento (Princípio VI)."""
    user = _user("parceiro", "BESA Medical Group", unidades=["Hosp. Leste"])
    assert filtra_por_escopo(DATASET_UNID, user) == []


def test_gestor_ignora_allowlist_de_unidade():
    user = _user("gestor", None, unidades=["UPA Centro"])
    assert len(filtra_por_escopo(DATASET_UNID, user)) == 3
