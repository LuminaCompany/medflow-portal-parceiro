"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

// Icon-tile do site (40×40, raio 10). Marca = lavanda/roxo; status usam o "subtle" do tom.
const TILE: Record<Tone, string> = {
  brand: "bg-accent text-primary",
  success: "bg-success-subtle text-success-ink",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-danger-subtle text-danger-ink",
  neutral: "bg-muted text-muted-foreground",
};

// Cartão de métrica (KPI) no padrão "card" do site: branco, borda 1px, raio 24, sem sombra.
// Hover = sombra `--shadow-hover` + sobe 2px (card de blog, §12.2). Entrada em cascata curta.
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "brand",
  index = 0,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: React.ReactNode;
  tone?: Tone;
  index?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-card animate-fade-up flex h-full flex-col p-5 xl:p-6",
        "transition-[box-shadow,transform] duration-200 ease-[ease] hover:-translate-y-0.5 hover:shadow-hover",
        highlight && "border-primary",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps pt-1 text-muted-foreground">{label}</span>
        <span className={cn("icon-tile", TILE[tone])}>
          <Icon />
        </span>
      </div>
      <div className="mt-5 min-w-0 text-[clamp(1.1rem,0.55rem+0.7vw,1.6rem)] leading-none font-semibold whitespace-nowrap tracking-[-0.03em] text-strong tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-3 text-[13px] leading-snug text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
