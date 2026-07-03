"""Modelos de domínio (Pydantic v2).

Valores monetários trafegam como `Decimal` no backend e são serializados como string
decimal (`"1300.00"`) na borda HTTP — evita erro de float no cliente (contracts/api.md).
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class Solicitacao(BaseModel):
    """Item de antecipação (aba Dados Tratados). Mapa de colunas em data-model §1."""

    model_config = ConfigDict(extra="ignore")

    codigo: str
    quitado: bool
    cliente: str
    valor: Decimal
    recebido_cliente: Decimal | None = None
    iof: Decimal | None = None
    juros_descontos: Decimal | None = None
    lucro_operacional: Decimal | None = None  # margem MedFlow — só gestor (D5')
    taxa_juros_mes: Decimal | None = None
    data_pedido: date
    mes_originacao: str | None = None
    data_vencimento: date
    mes_vencimento: str | None = None
    prazo_dias: int | None = None
    contratante: str  # chave de isolamento (parceiro)
    data_quitacao_real: date | None = None
    dias_diferenca: int | None = None
    unidade: str | None = None
    obs: str | None = None
    agio_base: Decimal | None = None
    cashback: Decimal = Decimal("0")

    # Derivados (preenchidos no serviço)
    status: str
    status_label: str
    medico_grupo_id: str | None = None
    cor_parceiro: str | None = None  # só na visão do gestor


class Medico(BaseModel):
    """Enriquecimento via `base de dados` (PII), join por nome. data-model §1b."""

    nome: str
    cpf: str | None = None
    telefone: str | None = None
    email: str | None = None
    pix: str | None = None
    pix_tipo: str | None = None
    nascimento: str | None = None
    ambiguo: bool = False  # nome repetido na base → PII omitida (possível homônimo)


class Pendencia(BaseModel):
    """Solicitação reprovada na validação (quarentena gestor-only). data-model §6."""

    codigo: str
    cliente: str | None = None
    contratante: str | None = None
    valor: Decimal | None = None
    data_pedido: date | None = None
    data_vencimento: date | None = None
    motivos: list[str]
    linha_origem: int


class Parceiro(BaseModel):
    """Derivado de `Contratante`. Fronteira de isolamento; `cor` para o gestor (RF-023)."""

    contratante: str
    cor: str | None = None
    total: int = 0


class AppUser(BaseModel):
    """Usuário autenticado (Supabase `app_users`). data-model §2."""

    id: str
    email: str
    role: str  # "parceiro" | "gestor"
    contratante: str | None = None
    nome_exibicao: str
    # Allowlist de Unidades do parceiro (definida pelo gestor, sincronizada entre os logins
    # da Contratante). `None` = nunca configurada → sem restrição de unidade (back-compat).
    # Lista (mesmo vazia) = allowlist explícita; `[]` = não vê nenhuma solicitação. Feature 003.
    unidades: list[str] | None = None
    # Serviço de rebate (cashback) ativo p/ esta Contratante (feature 005): no pagamento, o
    # parceiro paga Originação − Rebate (Σ cashback do lote). Config do gestor, sincronizada
    # entre os logins (app_metadata). Ausente/False = paga a Originação cheia (comportamento atual).
    rebate_ativo: bool = False
    # Troca de senha obrigatória no 1º acesso (feature 007): flag `must_change_password` no
    # `app_metadata`, definida pelo gestor ao criar o login no Supabase. True = portal bloqueia
    # até o usuário definir uma nova senha (`POST /api/me/trocar-senha`), que limpa a flag.
    # Ausente/False = acesso normal (back-compat). Aplicada só a gestores no frontend.
    must_change_password: bool = False


class MetricasOverview(BaseModel):
    """Cards + série mensal da Visão Geral (por escopo). data-model §3."""

    total_solicitacoes: int
    valor_total: Decimal
    total_cashback: Decimal
    ticket_medio: Decimal
    em_aberto: int
    pagas: int
    medicos_impactados: int
