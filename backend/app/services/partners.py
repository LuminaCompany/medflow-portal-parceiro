"""Administração de parceiros e logins (US3 + feature 003) — única ação de ESCRITA do portal.

Opera direto no **Supabase Auth** (`auth.users`) via Admin API (service role). `role`,
`contratante`, `cor` e `unidades` (allowlist) vivem no `app_metadata` (seguro, não-editável
pelo usuário); o nome de exibição no `user_metadata`. Service role nunca trafega para o front.

Modelo (feature 003): **Parceiro = Contratante**. A config de parceiro (`cor` + allowlist de
`unidades`) é da Contratante e fica **sincronizada** no `app_metadata` de TODOS os logins dela
— editar a config faz fan-out para cada login. Cada Contratante pode ter 1..N logins.
"""

from supabase import Client

from app.services.cores import cor_para

ROLE_PARCEIRO = "parceiro"


class PartnersError(Exception):
    """Falha na operação de administração (mapeada para 400 no router)."""


def _erro_criacao(exc: Exception) -> str:
    """Traduz a falha do Auth (gotrue) numa mensagem pt-BR honesta. A mensagem é sobre o
    dado que está sendo criado — não vaza informação de outro parceiro. Sem chute de causa."""
    msg = str(getattr(exc, "message", "") or exc)
    low = msg.lower()
    if any(t in low for t in ("already", "registered", "exists", "duplicate")):
        return "E-mail já cadastrado."
    if "password" in low:
        return "Senha inválida (mínimo de 6 caracteres)."
    if "email" in low and ("valid" in low or "format" in low):
        return "E-mail inválido."
    return "Não foi possível criar o login. Verifique os dados e tente novamente."


def _app_meta(user: object) -> dict:
    return getattr(user, "app_metadata", None) or {}


def _user_meta(user: object) -> dict:
    return getattr(user, "user_metadata", None) or {}


def _nome(user: object) -> str:
    m = _user_meta(user)
    return m.get("display_name") or m.get("full_name") or m.get("name") or (
        getattr(user, "email", "") or ""
    )


def _cor(user: object) -> str | None:
    """Cor do parceiro: escolhida pelo gestor (app_metadata.cor) ou determinística."""
    meta = _app_meta(user)
    contratante = meta.get("contratante")
    return meta.get("cor") or (cor_para(contratante) if contratante else None)


def _unidades(user: object) -> list[str] | None:
    """Allowlist crua do login (None = nunca configurada; lista = explícita)."""
    raw = _app_meta(user).get("unidades")
    if raw is None:
        return None
    return [str(u) for u in raw]


def _rebate_ativo(user: object) -> bool:
    """Serviço de rebate (cashback) ativo p/ o login (feature 005). Ausente = False."""
    return bool(_app_meta(user).get("rebate_ativo", False))


def _serializa(user: object) -> dict:
    created = getattr(user, "created_at", None)
    return {
        "id": str(getattr(user, "id", "")),
        "email": getattr(user, "email", "") or "",
        "nome_exibicao": _nome(user),
        "contratante": _app_meta(user).get("contratante"),
        "cor": _cor(user),
        "unidades": _unidades(user),
        "rebate_ativo": _rebate_ativo(user),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
    }


class PartnersService:
    """CRUD de parceiros/logins via Supabase Auth Admin API (partner-centric)."""

    def __init__(self, admin: Client) -> None:
        self._admin = admin

    # ---- Leitura -----------------------------------------------------------------

    def listar(self) -> list[dict]:
        """Lista os logins com papel `parceiro` (flat) — usado por 'Gerenciar logins'."""
        return [_serializa(u) for u in self._parceiros()]

    def listar_partners(self) -> list[dict]:
        """Parceiros agrupados por Contratante (feature 003).

        Cada item: `{contratante, cor, unidades, logins: [...]}`. `cor`/`unidades` saem da
        config canônica da Contratante (sincronizada entre os logins).
        """
        grupos: dict[str, list[object]] = {}
        for u in self._parceiros():
            contratante = _app_meta(u).get("contratante") or ""
            grupos.setdefault(contratante, []).append(u)

        partners = []
        for contratante, logins in grupos.items():
            partners.append(
                {
                    "contratante": contratante,
                    "cor": self._cor_canonica(logins, contratante),
                    "unidades": self._unidades_canonica(logins),
                    "rebate_ativo": self._rebate_ativo_canonica(logins),
                    "logins": [_serializa(u) for u in logins],
                }
            )
        partners.sort(key=lambda p: p["contratante"].lower())
        return partners

    def mapa_cores(self) -> dict[str, str]:
        """Mapa contratante -> cor (escolhida pelo gestor ou determinística). Usado na
        visão consolidada do gestor (chips/realce por parceiro)."""
        out: dict[str, str] = {}
        for u in self._parceiros():
            contratante = _app_meta(u).get("contratante")
            cor = _cor(u)
            if contratante and cor:
                out[contratante] = cor
        return out

    def mapa_unidades_por_contratante(self) -> dict[str, list[str]]:
        """Mapa contratante -> allowlist de unidades (config canônica). Alimenta os badges
        de vínculo no editor de unidades (órfã / vinculada / conflito 2+ contratantes)."""
        grupos: dict[str, list[object]] = {}
        for u in self._parceiros():
            contratante = _app_meta(u).get("contratante")
            if contratante:
                grupos.setdefault(contratante, []).append(u)
        out: dict[str, list[str]] = {}
        for contratante, logins in grupos.items():
            unidades = self._unidades_canonica(logins)
            if unidades is not None:
                out[contratante] = unidades
        return out

    # ---- Escrita -----------------------------------------------------------------

    def criar_login(
        self,
        email: str,
        nome_exibicao: str,
        contratante: str,
        senha_inicial: str,
        cor: str | None = None,
        unidades_default: list[str] | None = None,
    ) -> dict:
        """Cria um login de parceiro (RF-026).

        Contratante NOVA → usa `cor`/`unidades_default` informados (defaults). Contratante já
        existente → **herda** a config canônica dela (ignora os defaults), mantendo o vínculo
        sincronizado entre todos os logins.
        """
        existentes = self._logins_da_contratante(contratante)
        if existentes:
            cor_final = self._cor_canonica(existentes, contratante)
            unidades_final = self._unidades_canonica(existentes)
            rebate_final = self._rebate_ativo_canonica(existentes)
        else:
            cor_final = cor or cor_para(contratante)
            unidades_final = unidades_default
            rebate_final = False

        app_metadata: dict = {"role": ROLE_PARCEIRO, "contratante": contratante}
        if cor_final:
            app_metadata["cor"] = cor_final
        if unidades_final is not None:
            app_metadata["unidades"] = unidades_final
        if rebate_final:
            app_metadata["rebate_ativo"] = True
        try:
            created = self._admin.auth.admin.create_user(
                {
                    "email": email,
                    "password": senha_inicial,
                    "email_confirm": True,
                    "user_metadata": {"display_name": nome_exibicao},
                    "app_metadata": app_metadata,
                }
            )
        except Exception as exc:  # noqa: BLE001 — vira erro de domínio legível
            raise PartnersError(_erro_criacao(exc)) from exc
        return _serializa(created.user)

    def editar_login(
        self,
        user_id: str,
        nome_exibicao: str | None = None,
        senha: str | None = None,
    ) -> dict:
        """Edita campos do LOGIN individual (nome/senha). Config de parceiro (cor/unidades)
        é alterada em `editar_config` — não aqui."""
        attrs: dict = {}
        if nome_exibicao is not None:
            attrs["user_metadata"] = {"display_name": nome_exibicao}
        if senha:
            attrs["password"] = senha
        if not attrs:
            raise PartnersError("Nada para atualizar.")
        try:
            updated = self._admin.auth.admin.update_user_by_id(user_id, attrs)
        except Exception as exc:  # noqa: BLE001
            raise PartnersError("Não foi possível atualizar o login.") from exc
        return _serializa(updated.user)

    def editar_config(
        self,
        contratante: str,
        cor: str | None = None,
        unidades: list[str] | None = None,
        rebate_ativo: bool | None = None,
    ) -> dict:
        """Edita a config da Contratante (cor, allowlist de unidades e/ou serviço de rebate)
        com **fan-out**: grava em TODOS os logins dela (mantém o vínculo sincronizado).
        RF-027a + feature 003; `rebate_ativo` na feature 005."""
        logins = self._logins_da_contratante(contratante)
        if not logins:
            raise PartnersError("Parceiro sem logins para configurar.")
        if cor is None and unidades is None and rebate_ativo is None:
            raise PartnersError("Nada para atualizar.")
        for login in logins:
            meta: dict = {"role": ROLE_PARCEIRO, "contratante": contratante}
            # Merge raso do GoTrue: reenvia a config existente + as mudanças desta chamada.
            cor_atual = _app_meta(login).get("cor")
            unidades_atual = _unidades(login)
            rebate_atual = _rebate_ativo(login)
            cor_final = cor if cor is not None else cor_atual
            unidades_final = unidades if unidades is not None else unidades_atual
            rebate_final = rebate_ativo if rebate_ativo is not None else rebate_atual
            if cor_final:
                meta["cor"] = cor_final
            if unidades_final is not None:
                meta["unidades"] = unidades_final
            # SEMPRE gravar a chave (mesmo False): o merge raso do GoTrue só sobrescreve o que é
            # reenviado. Omitir quando False deixava o `true` antigo sobreviver → desligar o rebate
            # nunca persistia e o parceiro seguia pagando Originação − Rebate.
            meta["rebate_ativo"] = bool(rebate_final)
            try:
                self._admin.auth.admin.update_user_by_id(
                    str(getattr(login, "id", "")), {"app_metadata": meta}
                )
            except Exception as exc:  # noqa: BLE001
                raise PartnersError(
                    "Não foi possível atualizar a configuração do parceiro."
                ) from exc
        return {
            "contratante": contratante,
            "cor": cor if cor is not None else self._cor_canonica(logins, contratante),
            "unidades": unidades if unidades is not None else self._unidades_canonica(logins),
            "rebate_ativo": (
                rebate_ativo if rebate_ativo is not None else self._rebate_ativo_canonica(logins)
            ),
        }

    def remover(self, user_id: str) -> None:
        """Remove login (RF-027), invalidando a sessão do parceiro removido."""
        try:
            self._admin.auth.admin.delete_user(user_id)
        except Exception as exc:  # noqa: BLE001
            raise PartnersError("Não foi possível remover o login.") from exc

    # ---- Internos ----------------------------------------------------------------

    def _parceiros(self) -> list:
        """Logins com papel parceiro (de todos os usuários do Auth)."""
        return [u for u in self._listar_todos() if _app_meta(u).get("role") == ROLE_PARCEIRO]

    def _logins_da_contratante(self, contratante: str) -> list:
        alvo = contratante.strip()
        return [
            u for u in self._parceiros() if (_app_meta(u).get("contratante") or "").strip() == alvo
        ]

    @staticmethod
    def _cor_canonica(logins: list[object], contratante: str) -> str | None:
        for u in logins:
            cor = _app_meta(u).get("cor")
            if cor:
                return cor
        return cor_para(contratante) if contratante else None

    @staticmethod
    def _unidades_canonica(logins: list[object]) -> list[str] | None:
        """Primeira allowlist explícita encontrada (config sincronizada); None se nenhuma."""
        for u in logins:
            unidades = _unidades(u)
            if unidades is not None:
                return unidades
        return None

    @staticmethod
    def _rebate_ativo_canonica(logins: list[object]) -> bool:
        """Serviço de rebate da Contratante: ativo se qualquer login o tem (config sincronizada)."""
        return any(_rebate_ativo(u) for u in logins)

    def _listar_todos(self) -> list:
        """Pagina por todos os usuários do Auth (Admin API)."""
        todos: list = []
        page = 1
        while True:
            lote = self._admin.auth.admin.list_users(page=page, per_page=200)
            if not lote:
                break
            todos.extend(lote)
            if len(lote) < 200:
                break
            page += 1
        return todos
