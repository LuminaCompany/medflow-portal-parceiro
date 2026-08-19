// Ordenação client-side de solicitações (aba Vencimentos do parceiro).
//
// Os lotes vêm INTEIROS no payload de `/api/vencimentos` (sem paginação), então ordenar aqui
// não gera request nem toca o escopo R-001 — só reordena o que o backend já filtrou.
// Funções puras: nada de React/DOM.

import type { Dir, OrdemTabela } from "@/components/DataTable";
import type { Solicitacao, StatusKey } from "@/lib/types";

type TipoColuna = "texto" | "numero" | "data" | "status";

// Tipo de cada coluna ordenável — define o comparador E a direção do 1º clique.
const TIPO_POR_COLUNA: Record<string, TipoColuna> = {
  codigo: "texto",
  cliente: "texto",
  unidade: "texto",
  valor: "numero",
  cashback: "numero",
  data_pedido: "data",
  data_vencimento: "data",
  status: "status",
};

// Peso semântico do status: pior primeiro quando a direção é desc (Vencido > A Vencer > Pago).
// Espelha o rollup do backend (`_status_unidade`, services/vencimentos.py).
export const PESO_STATUS: Record<StatusKey, number> = { pago: 0, a_pagar: 1, atrasado: 2 };

// pt-BR com `sensitivity: "base"` → "Álvaro" cai junto de "Alvaro" (nomes do sheet vêm sem
// padronização de acento/caixa); `numeric` mantém BES-9 antes de BES-10.
const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function campo(s: Solicitacao, col: string): string {
  const v = (s as unknown as Record<string, unknown>)[col];
  return v == null ? "" : String(v);
}

function numero(s: Solicitacao, col: string): number {
  const n = Number(campo(s, col));
  return Number.isNaN(n) ? 0 : n;
}

/** Comparador ascendente de duas solicitações por uma coluna. */
export function comparaPorColuna(a: Solicitacao, b: Solicitacao, col: string): number {
  switch (TIPO_POR_COLUNA[col] ?? "texto") {
    case "numero":
      return numero(a, col) - numero(b, col);
    // Datas chegam em ISO (YYYY-MM-DD) → ordem lexicográfica == cronológica.
    case "data":
      return campo(a, col).localeCompare(campo(b, col));
    case "status":
      return PESO_STATUS[a.status] - PESO_STATUS[b.status];
    default:
      return COLLATOR.compare(campo(a, col), campo(b, col));
  }
}

/**
 * Ordem cronológica: data do pedido asc, desempate pelo código.
 * É a ordem "natural" do lote (a sequência da feat. 009 é numerada por data do pedido) e serve
 * de desempate em qualquer outra ordenação e de ordem das filhas dentro de um grupo de cliente.
 */
export function comparaCronologica(a: Solicitacao, b: Solicitacao): number {
  const d = campo(a, "data_pedido").localeCompare(campo(b, "data_pedido"));
  return d !== 0 ? d : COLLATOR.compare(a.codigo, b.codigo);
}

/** Direção do 1º clique numa coluna: texto começa A→Z; número/data/status começa do maior. */
export function dirInicial(col: string): Dir {
  return (TIPO_POR_COLUNA[col] ?? "texto") === "texto" ? "asc" : "desc";
}

/** Clique num cabeçalho: mesma coluna inverte a direção; coluna nova usa `dirInicial`. */
export function proximaOrdem(atual: OrdemTabela, col: string): OrdemTabela {
  if (atual.col === col) return { col, dir: atual.dir === "asc" ? "desc" : "asc" };
  return { col, dir: dirInicial(col) };
}

/** Lista plana ordenada (usada fora da ordem por Cliente, onde não há agrupamento). */
export function ordenaPlano(itens: Solicitacao[], ordem: OrdemTabela): Solicitacao[] {
  const mult = ordem.dir === "asc" ? 1 : -1;
  return [...itens].sort((a, b) => {
    const c = comparaPorColuna(a, b, ordem.col) * mult;
    return c !== 0 ? c : comparaCronologica(a, b);
  });
}
