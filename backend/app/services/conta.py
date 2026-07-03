"""Conta do próprio usuário (feature 007) — troca de senha obrigatória no 1º acesso.

Opera **só sobre o próprio usuário** (o `user_id` vem SEMPRE do token, nunca do corpo). Usa a
Admin API (service role) para (1) definir a nova senha — invalidando a antiga — e (2) limpar a
flag `must_change_password` do `app_metadata`. Nenhum dado de planilha/escopo é tocado.
"""

from supabase import Client

# Mínimo do próprio GoTrue (Supabase). Manter alinhado à mensagem de erro do parceiro.
SENHA_MIN = 6


class ContaError(Exception):
    """Falha ao alterar a conta do próprio usuário (mapeada para 400 no router)."""


def trocar_senha(admin: Client, user_id: str, nova_senha: str) -> None:
    """Define nova senha do próprio usuário e limpa a flag de troca obrigatória.

    O `app_metadata` é merge raso no GoTrue: reenviar só `{must_change_password: False}` limpa a
    flag e preserva `role`/`contratante`/demais chaves. A senha antiga deixa de funcionar assim
    que a nova é gravada.
    """
    if not user_id:
        raise ContaError("Usuário inválido.")
    if len(nova_senha or "") < SENHA_MIN:
        raise ContaError(f"A senha deve ter no mínimo {SENHA_MIN} caracteres.")
    try:
        admin.auth.admin.update_user_by_id(
            user_id,
            {"password": nova_senha, "app_metadata": {"must_change_password": False}},
        )
    except Exception as exc:  # noqa: BLE001 — vira erro de domínio legível
        raise ContaError("Não foi possível alterar a senha. Tente novamente.") from exc
