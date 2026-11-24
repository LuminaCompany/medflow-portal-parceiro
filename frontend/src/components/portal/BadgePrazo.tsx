import { CalendarClock } from "lucide-react";

import { diasVencimento, formatData } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Selo do prazo de vencimento de um lote: data + dias relativos. Vermelho quando já vencido
 * (dias > 0), roxo (brand) quando ainda a vencer. Usado na aba Vencimentos (barra do lote),
 * nos modais de pagamento e no quadro do gestor. Nada renderiza sem data (ex.: "Tudo pago").
 */
export function BadgePrazo({
  data,
  className,
}: {
  data: string | null | undefined;
  className?: string;
}) {
  const dias = diasVencimento(data);
  if (!data || dias == null) return null;
  const vencido = dias > 0;
  const rel = vencido
    ? `${dias}d atrás`
    : dias === 0
      ? "vence hoje"
      : `em ${Math.abs(dias)}d`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        vencido ? "bg-destructive text-white" : "bg-accent text-accent-foreground",
        className,
      )}
      title={`Vencimento ${formatData(data)}`}
    >
      <CalendarClock className="size-3.5" />
      <span className="tabular-nums">{formatData(data)}</span>
      <span className="font-medium opacity-85">· {rel}</span>
    </span>
  );
}
