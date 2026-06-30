import { cn } from "@/lib/utils";
import type { StatusKey } from "@/lib/types";

// Status nunca depende só de cor (a11y): pílula com ponto + rótulo textual.
const ESTILO: Record<StatusKey, string> = {
  pago: "bg-success/12 text-success",
  a_pagar: "bg-warning/15 text-warning",
  atrasado: "bg-destructive/10 text-destructive",
};

export function BadgeStatus({
  status,
  label,
  className,
}: {
  status: StatusKey;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ESTILO[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
