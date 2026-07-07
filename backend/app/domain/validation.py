"""Validação & Quarentena — particiona em `validas` / `pendencias` (data-model §6, D11).

Falha em QUALQUER regra obrigatória → a solicitação vai para a quarentena (gestor-only)
e é removida do dataset válido (some de toda outra visão/agregação — RF-033/035).
Derivado em memória a cada carga: corrigiu a fonte, a linha volta sozinha (self-healing).
"""

from collections import defaultdict
from datetime import date

from app.domain.datas import hoje as hoje_operacao
from app.domain.models import Pendencia, Solicitacao
from app.domain.status import status, status_label
from app.sheets.parser import (
    ParsedSolicitacao,
    formatar_codigo,
    normalize_nome,
    trigrama_efetivo,
)

# Motivos legíveis (data-model §6) — strings exibidas ao gestor.
MOTIVO_CLIENTE_AUSENTE = "Cliente ausente"
MOTIVO_CONTRATANTE_FALTANDO = "Contratante faltando"
MOTIVO_CLIENTE_SEM_CADASTRO = "Cliente sem cadastro"
MOTIVO_CONTRATANTE_DIVERGENTE = "Contratante divergente do cadastro"
MOTIVO_INDIVIDUAL = "Médico sem franquia (INDIVIDUAL)"
MOTIVO_VALOR_INVALIDO = "Valor inválido"
MOTIVO_DATA_PEDIDO = "Data do Pedido inválida"
MOTIVO_DATA_QUITACAO = "Data de Quitação ausente"
MOTIVO_QUITACAO_SEM_DATA = "Quitação sem data real"
MOTIVO_UNIDADE_AUSENTE = "Unidade Referência ausente"

CONTRATANTE_INDIVIDUAL = "INDIVIDUAL"


def _motivos(item: ParsedSolicitacao, cadastro: dict[str, str]) -> list[str]:
    """Coleta TODOS os motivos de reprovação (uma linha pode acumular vários)."""
    motivos: list[str] = list(item.parse_errors)

    # O código não vem mais do sheet (feature 009): o portal o gera. Logo, código de origem
    # ausente NÃO reprova a linha — a validação exige só os campos de negócio abaixo.
    if not item.cliente:
        motivos.append(MOTIVO_CLIENTE_AUSENTE)

    if not item.contratante:
        motivos.append(MOTIVO_CONTRATANTE_FALTANDO)
    elif item.contratante.upper() == CONTRATANTE_INDIVIDUAL:
        motivos.append(MOTIVO_INDIVIDUAL)

    # Vínculo médico→parceiro é a verdade do Cadastro (protege R-001 contra erro de digitação).
    if item.cliente:
        chave = normalize_nome(item.cliente)
        cadastro_contratante = cadastro.get(chave)
        if cadastro_contratante is None:
            motivos.append(MOTIVO_CLIENTE_SEM_CADASTRO)
        elif item.contratante and item.contratante != cadastro_contratante:
            motivos.append(MOTIVO_CONTRATANTE_DIVERGENTE)

    if (item.valor is None or item.valor <= 0) and MOTIVO_VALOR_INVALIDO not in motivos:
        motivos.append(MOTIVO_VALOR_INVALIDO)

    if item.data_pedido is None:
        motivos.append(MOTIVO_DATA_PEDIDO)

    if item.data_vencimento is None:
        motivos.append(MOTIVO_DATA_QUITACAO)

    if item.quitado and item.data_quitacao_real is None:
        motivos.append(MOTIVO_QUITACAO_SEM_DATA)

    # Unidade Referência é obrigatória (ADR 0001): agrupa Vencimentos do gestor por unidade.
    if not item.unidade:
        motivos.append(MOTIVO_UNIDADE_AUSENTE)

    return motivos


def _para_solicitacao(item: ParsedSolicitacao, hoje: date, codigo: str) -> Solicitacao:
    """Constrói o modelo válido. `codigo` já é o gerado pelo portal (`_numera_e_constroi`)."""
    assert item.cliente and item.contratante
    assert item.valor is not None and item.data_pedido and item.data_vencimento
    status_key = status(item.quitado, item.data_vencimento, hoje)
    return Solicitacao(
        codigo=codigo,
        quitado=item.quitado,
        cliente=item.cliente,
        valor=item.valor,
        recebido_cliente=item.recebido_cliente,
        iof=item.iof,
        juros_descontos=item.juros_descontos,
        lucro_operacional=item.lucro_operacional,
        taxa_juros_mes=item.taxa_juros_mes,
        data_pedido=item.data_pedido,
        mes_originacao=item.mes_originacao,
        data_vencimento=item.data_vencimento,
        mes_vencimento=item.mes_vencimento,
        prazo_dias=item.prazo_dias,
        contratante=item.contratante,
        data_quitacao_real=item.data_quitacao_real,
        dias_diferenca=item.dias_diferenca,
        unidade=item.unidade,
        obs=item.obs,
        agio_base=item.agio_base,
        cashback=item.cashback,
        status=status_key,
        status_label=status_label(status_key),
        medico_grupo_id=normalize_nome(item.cliente),
    )


def _para_pendencia(item: ParsedSolicitacao, motivos: list[str]) -> Pendencia:
    # Pendências não entram na sequência gerada (feature 009): identifica-se pela linha do sheet.
    return Pendencia(
        codigo=f"(linha {item.linha_origem})",
        cliente=item.cliente,
        contratante=item.contratante,
        valor=item.valor,
        data_pedido=item.data_pedido,
        data_vencimento=item.data_vencimento,
        motivos=motivos,
        linha_origem=item.linha_origem,
    )


def _numera_e_constroi(
    validos: list[ParsedSolicitacao],
    hoje: date,
    trigramas: dict[str, str],
) -> list[Solicitacao]:
    """Gera o código de cada válida (feature 009): sequência POR Contratante, ordenada por
    data do pedido (desempate estável = linha de origem no sheet). Prefixo = trigrama efetivo
    da Contratante (`trigramas` traz os overrides do gestor; ausente → trigrama padrão).

    A sequência é "pura" — não depende do código de origem do sheet. Recalculada a cada carga:
    inserir/editar uma linha com data anterior desloca os números seguintes daquela Contratante.
    """
    por_contratante: dict[str, list[ParsedSolicitacao]] = defaultdict(list)
    for item in validos:
        por_contratante[item.contratante].append(item)  # type: ignore[arg-type]

    saida: list[Solicitacao] = []
    for contratante, grupo in por_contratante.items():
        grupo.sort(key=lambda i: (i.data_pedido, i.linha_origem))
        trigrama = trigrama_efetivo(contratante, trigramas.get(contratante))
        for sequencia, item in enumerate(grupo, start=1):
            saida.append(_para_solicitacao(item, hoje, formatar_codigo(trigrama, sequencia)))
    return saida


def particiona(
    itens: list[ParsedSolicitacao],
    cadastro: dict[str, str],
    hoje: date | None = None,
    trigramas: dict[str, str] | None = None,
) -> tuple[list[Solicitacao], list[Pendencia]]:
    """Particiona normalizados em (válidas, pendências).

    `cadastro`: mapa cliente→contratante (verdade do vínculo). `trigramas`: overrides de
    prefixo por Contratante (feature 009; vazio = usa o padrão de 3 letras). Toda tela usa
    `validas`; `/api/admin/pendencias` usa `pendencias`.
    """
    hoje = hoje or hoje_operacao()
    validos: list[ParsedSolicitacao] = []
    pendencias: list[Pendencia] = []
    for item in itens:
        motivos = _motivos(item, cadastro)
        if motivos:
            pendencias.append(_para_pendencia(item, motivos))
        else:
            validos.append(item)
    validas = _numera_e_constroi(validos, hoje, trigramas or {})
    return validas, pendencias
