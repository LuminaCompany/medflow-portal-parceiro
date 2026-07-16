"""Relatório de Fechamento em PDF (feature 010) — modelo oficial da Medflow.

Réplica do modelo `exportação modelo lumina.pdf`: A4 paisagem, papel timbrado (logo +
título + rodapé com os contatos do gerente de contas) desenhado como imagem de fundo em
TODAS as páginas, tabela de detalhe agrupada por Unidade — cada grupo abre numa página
nova e fecha com uma faixa SUBTOTAL — e uma página final de resumo (Unidade × Subtotal ×
Rebate + VALOR TOTAL GERAL).

O papel timbrado é o BITMAP extraído do próprio modelo (`assets/relatorio_fundo.png`):
cabeçalho e rodapé saem pixel a pixel iguais, sem redesenhar logo/ícones. Só a tabela é
composta aqui — é o "quanto de páginas/conteúdo" que varia entre um relatório e outro.

NÃO decide escopo: recebe as solicitações JÁ filtradas por `filtra_por_escopo` (R-001).
Quem chama é responsável pelo isolamento cross-Contratante — ver `services/solicitacoes.py`.
"""

from collections import defaultdict
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Table,
    TableStyle,
)

from app.domain.models import Solicitacao

# Papel timbrado (1920×1357, mesma proporção do A4 paisagem) — extraído do modelo oficial.
_FUNDO = str(Path(__file__).resolve().parent.parent / "assets" / "relatorio_fundo.png")

# Geometria do modelo (medida no PDF oficial com PyMuPDF). A tabela começa em y=90.71pt do
# topo (= 32mm) e a última linha que ainda cabe termina antes de 476.22pt (= 42mm da base),
# folga que mantém o rodapé timbrado livre.
_PAGINA = landscape(A4)  # 841.89 × 595.28 pt
_MARGEM_LATERAL = 14 * mm
_MARGEM_TOPO = 32 * mm
_MARGEM_BASE = 42 * mm
_LARGURA_UTIL = _PAGINA[0] - 2 * _MARGEM_LATERAL  # 762.52pt

# Paleta do modelo.
_ROXO = colors.HexColor("#7030A0")  # faixas de cabeçalho, SUBTOTAL e TOTAL GERAL
_ZEBRA = colors.HexColor("#F5F5F5")  # linhas ímpares do corpo
_TEXTO = colors.HexColor("#505050")  # corpo da tabela

# Tipografia do modelo: corpo Helvetica 8/9.2, cabeçalho Bold 9/10.35, faixas BoldOblique.
_PAD = 4.25  # padding das células do detalhe (todas as bordas)
_FONTE_CORPO, _TAM_CORPO, _LEAD_CORPO = "Helvetica", 8, 9.2
_FONTE_CAB, _TAM_CAB, _LEAD_CAB = "Helvetica-Bold", 9, 10.35
_FONTE_FAIXA = "Helvetica-BoldOblique"

# Resumo (última página): fonte 10 e padding 8.5 → linhas de 28.5pt.
_PAD_RESUMO = 8.5
_TAM_RESUMO, _LEAD_RESUMO = 10, 11.5


def _brl(v: Decimal | None) -> str:
    """Decimal → "R$ 13.499,99" (pt-BR: ponto de milhar, vírgula decimal)."""
    if v is None:
        return ""
    # Formata no padrão US e troca os separadores de uma vez (sentinela evita passo duplo).
    return "R$ " + f"{v:,.2f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def _percent(v: Decimal | None) -> str:
    """Decimal em escala humana → "8.20%". O modelo usa PONTO decimal no percentual
    (e vírgula no dinheiro) — divergência do próprio modelo, replicada de propósito."""
    return "" if v is None else f"{v:.2f}%"


def _data(d: date | None) -> str:
    return "" if d is None else d.strftime("%d/%m/%Y")


def _inteiro(v: int | None) -> str:
    return "" if v is None else str(v)


def _rebate(v: Decimal | None) -> str:
    """Rebate zerado/ausente sai como "-" no corpo (o modelo não escreve "R$ 0,00" na linha;
    só na faixa de SUBTOTAL)."""
    return _brl(v) if v else "-"


# Colunas do detalhe: (cabeçalho, getter, largura no modelo). São as mesmas 11 do XLSX de
# lote — o modelo traz ainda "Desconto (-IOF)", removida por decisão de produto.
# As larguras vêm do modelo oficial; a folga da coluna removida foi para "Cliente" (a única
# que quebra linha), e "Prazo"/"Vencimento" ganharam ~1pt para o cabeçalho não quebrar —
# assim TODA coluna quebra (ou não) exatamente como no modelo. Normalizadas em `_larguras`.
_COLS: list[tuple[str, Callable[[Solicitacao], str], float]] = [
    ("Código", lambda s: s.codigo, 56.56),
    ("Cliente", lambda s: s.cliente, 186.38),
    ("Originação", lambda s: _brl(s.valor), 64.66),
    ("Recebido Cliente", lambda s: _brl(s.recebido_cliente), 71.23),
    ("IOF", lambda s: _brl(s.iof), 42.74),
    ("Taxa ao Mês", lambda s: _percent(s.taxa_juros_mes), 53.47),
    ("Data Pedido", lambda s: _data(s.data_pedido), 52.84),
    ("Prazo", lambda s: _inteiro(s.prazo_dias), 33.89),
    ("Vencimento", lambda s: _data(s.data_vencimento), 60.26),
    ("Unidade Referência", lambda s: s.unidade or "", 80.78),
    ("Rebate", lambda s: _rebate(s.cashback), 59.71),
]
_COL_CLIENTE = 1
_COL_ORIGINACAO = 2
_COL_UNIDADE = 9
_COL_REBATE = 10

# Colunas de texto livre: viram Paragraph para QUEBRAR dentro da célula (uma string crua
# vazaria por cima da coluna vizinha). As demais são curtas e de largura previsível.
_COLS_QUE_QUEBRAM = frozenset({_COL_CLIENTE, _COL_UNIDADE})


def _larguras() -> list[float]:
    """Larguras do modelo normalizadas para fechar exatamente a largura útil da página."""
    brutas = [c[2] for c in _COLS]
    fator = _LARGURA_UTIL / sum(brutas)
    return [w * fator for w in brutas]


def _estilo(fonte: str, tam: float, lead: float, cor, alinha: int) -> ParagraphStyle:
    return ParagraphStyle(
        "c", fontName=fonte, fontSize=tam, leading=lead, textColor=cor, alignment=alinha
    )


_P_CAB = _estilo(_FONTE_CAB, _TAM_CAB, _LEAD_CAB, colors.white, TA_CENTER)
_P_CLIENTE = _estilo(_FONTE_CORPO, _TAM_CORPO, _LEAD_CORPO, _TEXTO, TA_LEFT)
_P_UNIDADE = _estilo(_FONTE_CORPO, _TAM_CORPO, _LEAD_CORPO, _TEXTO, TA_CENTER)


def _fundo(canvas, doc) -> None:
    """Papel timbrado em todas as páginas, sangrando na página inteira (como no modelo)."""
    canvas.saveState()
    canvas.drawImage(_FUNDO, 0, 0, width=_PAGINA[0], height=_PAGINA[1], mask="auto")
    canvas.restoreState()


def _linha_detalhe(s: Solicitacao) -> list:
    celulas: list = []
    for i, (_, getter, _w) in enumerate(_COLS):
        texto = getter(s)
        if i == _COL_CLIENTE:
            celulas.append(Paragraph(texto, _P_CLIENTE))
        elif i == _COL_UNIDADE:
            celulas.append(Paragraph(texto, _P_UNIDADE))
        else:
            celulas.append(texto)
    return celulas


def _faixa_subtotal(itens: list[Solicitacao]) -> list:
    """Faixa roxa que fecha o grupo: só "SUBTOTAL" + Σ Originação + Σ Rebate (demais vazias)."""
    linha: list = [""] * len(_COLS)
    linha[0] = "SUBTOTAL"
    linha[_COL_ORIGINACAO] = _brl(sum((s.valor for s in itens), Decimal("0")))
    linha[_COL_REBATE] = _brl(sum((s.cashback for s in itens), Decimal("0")))
    return linha


def _tabela_detalhe(itens: list[Solicitacao]) -> Table:
    """Tabela de UM grupo (Unidade): cabeçalho roxo + linhas zebradas + faixa SUBTOTAL."""
    dados = [[Paragraph(c[0], _P_CAB) for c in _COLS]]
    dados += [_linha_detalhe(s) for s in itens]
    dados.append(_faixa_subtotal(itens))
    ultima = len(dados) - 1

    estilo = [
        ("FONTNAME", (0, 1), (-1, -1), _FONTE_CORPO),
        ("FONTSIZE", (0, 1), (-1, -1), _TAM_CORPO),
        ("LEADING", (0, 1), (-1, -1), _LEAD_CORPO),
        ("TEXTCOLOR", (0, 1), (-1, -1), _TEXTO),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), _PAD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), _PAD),
        ("LEFTPADDING", (0, 0), (-1, -1), _PAD),
        ("RIGHTPADDING", (0, 0), (-1, -1), _PAD),
        # Cabeçalho roxo (repetido no topo de cada página quando o grupo se parte).
        ("BACKGROUND", (0, 0), (-1, 0), _ROXO),
        # Zebra do corpo: 1ª linha de dados cinza, alternando.
        *[
            ("BACKGROUND", (0, r), (-1, r), _ZEBRA if r % 2 else colors.white)
            for r in range(1, ultima)
        ],
        # Faixa SUBTOTAL: roxa, texto branco em negrito itálico; "SUBTOTAL" à esquerda.
        ("BACKGROUND", (0, ultima), (-1, ultima), _ROXO),
        ("FONTNAME", (0, ultima), (-1, ultima), _FONTE_FAIXA),
        ("FONTSIZE", (0, ultima), (-1, ultima), _TAM_CAB),
        ("LEADING", (0, ultima), (-1, ultima), _LEAD_CAB),
        ("TEXTCOLOR", (0, ultima), (-1, ultima), colors.white),
        ("ALIGN", (0, ultima), (0, ultima), "LEFT"),
    ]
    return Table(dados, colWidths=_larguras(), repeatRows=1, style=TableStyle(estilo))


# --- Página de resumo --------------------------------------------------------------------
# Larguras do modelo (3 colunas somando a largura útil): Unidade | Subtotal | Rebate.
_RESUMO_LARG = [332.82, 229.73, 199.97]


def _tabela_resumo(grupos: list[tuple[str, list[Solicitacao]]]) -> Table:
    """Última página: uma linha por Unidade + faixa VALOR TOTAL GERAL."""
    p_cab = _estilo(_FONTE_CAB, _TAM_RESUMO, _LEAD_RESUMO, colors.white, TA_CENTER)
    p_esq = _estilo(_FONTE_CORPO, _TAM_RESUMO, _LEAD_RESUMO, _TEXTO, TA_LEFT)

    dados: list[list] = [
        [Paragraph(t, p_cab) for t in ("Unidade", "Subtotal", "Rebate")],
    ]
    total = Decimal("0")
    total_rebate = Decimal("0")
    for unidade, itens in grupos:
        subtotal = sum((s.valor for s in itens), Decimal("0"))
        rebate = sum((s.cashback for s in itens), Decimal("0"))
        total += subtotal
        total_rebate += rebate
        dados.append([Paragraph(unidade, p_esq), _brl(subtotal), _brl(rebate)])
    dados.append(["VALOR TOTAL GERAL", _brl(total), _brl(total_rebate)])
    ultima = len(dados) - 1

    fator = _LARGURA_UTIL / sum(_RESUMO_LARG)
    estilo = [
        ("FONTNAME", (0, 1), (-1, -1), _FONTE_CORPO),
        ("FONTSIZE", (0, 1), (-1, -1), _TAM_RESUMO),
        ("LEADING", (0, 1), (-1, -1), _LEAD_RESUMO),
        ("TEXTCOLOR", (0, 1), (-1, -1), _TEXTO),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), _PAD_RESUMO),
        ("BOTTOMPADDING", (0, 0), (-1, -1), _PAD_RESUMO),
        ("LEFTPADDING", (0, 0), (-1, -1), _PAD_RESUMO),
        ("RIGHTPADDING", (0, 0), (-1, -1), _PAD_RESUMO),
        ("BACKGROUND", (0, 0), (-1, 0), _ROXO),
        # Corpo: unidade à esquerda, valores à direita; zebra a partir da 1ª linha de dados.
        ("ALIGN", (1, 1), (-1, ultima - 1), "RIGHT"),
        *[
            ("BACKGROUND", (0, r), (-1, r), _ZEBRA if r % 2 else colors.white)
            for r in range(1, ultima)
        ],
        # Faixa VALOR TOTAL GERAL: tudo centralizado (inclusive o rótulo) — como no modelo.
        ("BACKGROUND", (0, ultima), (-1, ultima), _ROXO),
        ("FONTNAME", (0, ultima), (-1, ultima), _FONTE_FAIXA),
        ("TEXTCOLOR", (0, ultima), (-1, ultima), colors.white),
        ("ALIGN", (0, ultima), (-1, ultima), "CENTER"),
    ]
    # `repeatRows`: com muitas Unidades o resumo passa de uma página — o cabeçalho tem de
    # reaparecer no topo da seguinte (senão a 2ª página vira uma tabela sem título).
    return Table(
        dados,
        colWidths=[w * fator for w in _RESUMO_LARG],
        repeatRows=1,
        style=TableStyle(estilo),
    )


def _agrupa_por_unidade(itens: list[Solicitacao]) -> list[tuple[str, list[Solicitacao]]]:
    """Agrupa por Unidade (nome, ordem alfabética); dentro do grupo ordena por código —
    que é a ordem por data do pedido, já que o código é gerado nessa sequência (feature 009)."""
    por_unidade: dict[str, list[Solicitacao]] = defaultdict(list)
    for s in itens:
        por_unidade[s.unidade or "—"].append(s)
    for lista in por_unidade.values():
        lista.sort(key=lambda s: s.codigo)
    return sorted(por_unidade.items())


def relatorio_fechamento_pdf(itens: list[Solicitacao]) -> bytes:
    """Monta o Relatório de Fechamento das `itens` (JÁ escopadas). Retorna os bytes do PDF.

    Uma página (ou mais) por Unidade, cada uma fechada por SUBTOTAL, e o resumo no fim.
    Sem itens, sai só o resumo zerado — o arquivo continua válido e sem dado nenhum.
    """
    buf = BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=_PAGINA,
        leftMargin=_MARGEM_LATERAL,
        rightMargin=_MARGEM_LATERAL,
        topMargin=_MARGEM_TOPO,
        bottomMargin=_MARGEM_BASE,
        title="Relatório de Fechamento",
        author="Medflow",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="timbrado", frames=[frame], onPage=_fundo)])

    grupos = _agrupa_por_unidade(itens)
    story: list = []
    for i, (_, lista) in enumerate(grupos):
        if i:
            story.append(PageBreak())  # cada Unidade abre numa página nova
        story.append(_tabela_detalhe(lista))
    if grupos:
        story.append(PageBreak())
    story.append(_tabela_resumo(grupos))

    doc.build(story)
    return buf.getvalue()
