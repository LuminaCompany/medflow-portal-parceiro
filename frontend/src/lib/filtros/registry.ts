// Registry de filtros — FONTE ÚNICA do frontend (spec 002 §3.3).
// Espelha o registry do backend (app/domain/filtros/registry.py). Adicionar um filtro =
// uma entrada aqui + (se campo novo) um getter no backend. As páginas não mudam.

import type { Role } from "@/lib/types";

export type Aba = "solicitacoes" | "vencimentos" | "overview";
export type TipoFiltro = "multi" | "range" | "date";

// Formato governa como o valor/opções aparecem (chip e editor).
export type FormatoFiltro = "moeda" | "data" | "mes" | "status" | "texto";

export interface CampoDef {
  id: string;
  label: string;
  tipo: TipoFiltro;
  abas: Aba[];
  papeis: Role[];
  formato: FormatoFiltro;
}

const AMBOS: Role[] = ["parceiro", "gestor"];

export const REGISTRY: CampoDef[] = [
  { id: "status", label: "Status", tipo: "multi", formato: "status", papeis: AMBOS,
    abas: ["solicitacoes", "vencimentos", "overview"] },
  { id: "unidade", label: "Unidade", tipo: "multi", formato: "texto", papeis: AMBOS,
    abas: ["solicitacoes", "vencimentos", "overview"] },
  { id: "medico", label: "Médico", tipo: "multi", formato: "texto", papeis: AMBOS,
    abas: ["solicitacoes", "vencimentos"] },
  { id: "valor", label: "Originação (R$)", tipo: "range", formato: "moeda", papeis: AMBOS,
    abas: ["solicitacoes", "vencimentos"] },
  { id: "data_pedido", label: "Data do pedido", tipo: "date", formato: "data", papeis: AMBOS,
    abas: ["solicitacoes"] },
  { id: "data_vencimento", label: "Vencimento", tipo: "date", formato: "data", papeis: AMBOS,
    abas: ["solicitacoes", "vencimentos"] },
  { id: "mes_originacao", label: "Mês de originação", tipo: "multi", formato: "mes", papeis: AMBOS,
    abas: ["solicitacoes"] },
  { id: "mes_vencimento", label: "Mês de vencimento", tipo: "multi", formato: "mes", papeis: AMBOS,
    abas: ["solicitacoes"] },
  { id: "cashback", label: "Rebate (R$)", tipo: "range", formato: "moeda", papeis: AMBOS,
    abas: ["solicitacoes"] },
  { id: "prazo_dias", label: "Prazo (dias)", tipo: "range", formato: "texto", papeis: AMBOS,
    abas: ["solicitacoes"] },
  { id: "contratante", label: "Contratante", tipo: "multi", formato: "texto", papeis: ["gestor"],
    abas: ["solicitacoes", "vencimentos", "overview"] },
];

const POR_ID = new Map(REGISTRY.map((c) => [c.id, c]));

export function campoPorId(id: string): CampoDef | undefined {
  return POR_ID.get(id);
}

/** Campos que aparecem nesta aba para este papel (ordem do registry). */
export function camposDaAba(aba: Aba, papel: Role): CampoDef[] {
  return REGISTRY.filter((c) => c.abas.includes(aba) && c.papeis.includes(papel));
}

// Rótulos de status (pt-BR) — usados quando formato === "status".
export const STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  a_pagar: "A Pagar",
  atrasado: "Atrasado",
};
