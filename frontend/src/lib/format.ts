// Formatação de exibição (pt-BR) — util ÚNICO do frontend (DRY, Princípio II).
// Backend manda dinheiro como string decimal e datas ISO; aqui só formatamos.

import type { StatusKey } from "@/lib/types";

// Rótulos de status — FONTE ÚNICA de exibição no frontend. As CHAVES internas
// (pago/a_pagar/atrasado) não mudam; só o texto mostrado ao usuário. O front NÃO usa
// mais o `status_label` vindo do backend para os três status de solicitação.
export const STATUS_LABEL: Record<StatusKey, string> = {
  pago: "Pago",
  a_pagar: "A Vencer",
  atrasado: "Vencido",
};

/** Rótulo de exibição de um status de solicitação. */
export function statusLabel(status: StatusKey): string {
  return STATUS_LABEL[status] ?? status;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DATE_BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "1300.00" → "R$ 1.300,00". null/inválido → "—". */
export function formatMoeda(valor: string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const n = Number(valor);
  if (Number.isNaN(n)) return "—";
  return BRL.format(n);
}

/** "2025-12-30" → "30/12/2025". null/inválido → "—". */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_BR.format(d);
}

const DATA_HORA_BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/**
 * Timestamptz ISO ("2026-06-30T23:30:00+00:00") → data no fuso BRT ("01/07/2026").
 * Use para `created_at`/`verificado_at`: `.slice(0,10)` pegava a data UTC e mostrava o dia
 * seguinte em envios noturnos (UTC−3). null/inválido → "—".
 */
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATA_HORA_BR.format(d);
}

/**
 * Dias relativos ao vencimento: `>0` vencido (dias em atraso), `<=0` a vencer (0 = hoje).
 * null se a data for ausente/inválida. Espelha o cálculo do backend (`hoje - venc`).
 */
export function diasVencimento(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const venc = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(venc.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((hoje.getTime() - venc.getTime()) / 86_400_000);
}

/** "2026-01" → "jan/2026" (rótulo de mês para gráficos). */
export function formatMes(mes: string | null | undefined): string {
  if (!mes) return "—";
  const [ano, m] = mes.split("-");
  const nomes = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${nomes[idx]}/${ano}` : mes;
}

/** "6.00" → "6,00%" (taxa, só exibição). */
export function formatPercent(valor: string | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const n = Number(valor);
  if (Number.isNaN(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`;
}
