// Formatação de exibição (pt-BR) — util ÚNICO do frontend (DRY, Princípio II).
// Backend manda dinheiro como string decimal e datas ISO; aqui só formatamos.

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
