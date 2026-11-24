import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";
import type { StatusKey } from "@/lib/types";

// Status nunca depende só de cor (a11y): pílula com ponto + rótulo textual.
const ESTILO: Record<StatusKey, string> = {
  pago: "bg-success-subtle text-success-ink",
  a_pagar: "bg-warning-subtle text-warning-foreground",
  atrasado: "bg-danger-subtle text-danger-ink",
};

// O rótulo é derivado do `status` (fonte única em lib/format) — não do backend.
export function BadgeStatus({
  status,
  className,
}: {
  status: StatusKey;
  className?: string;
}) {
  const label = statusLabel(status);
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap",
        ESTILO[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
