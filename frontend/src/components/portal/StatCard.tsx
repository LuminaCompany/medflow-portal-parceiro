"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const CHIP: Record<Tone, string> = {
  brand: "bg-primary/10 text-primary ring-primary/15",
  success: "bg-success/12 text-success ring-success/20",
  warning: "bg-warning/15 text-warning ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const GLOW: Record<Tone, string> = {
  brand: "oklch(0.62 0.19 292 / 0.16)",
  success: "oklch(0.58 0.13 150 / 0.14)",
  warning: "oklch(0.72 0.13 75 / 0.14)",
  danger: "oklch(0.57 0.21 27 / 0.14)",
  neutral: "transparent",
};

// Cartão de métrica (KPI): rótulo + chip-ícone + valor grande tabular + dica opcional.
// Entrada animada (stagger por index), hover com leve elevação e brilho.
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        className={cn(
          "group relative h-full gap-0 p-5 transition-all duration-300",
          "hover:-translate-y-0.5 hover:ring-primary/25 hover:shadow-[0_10px_30px_-12px_var(--tw-shadow-color)]",
          highlight && "ring-primary/30",
        )}
        style={{ ["--tw-shadow-color" as string]: GLOW[tone] }}
      >
        {/* brilho de canto no hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: GLOW[tone] }}
        />
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105",
              CHIP[tone],
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        </div>
        <div className="mt-3 min-w-0 font-display text-[clamp(1.05rem,0.7rem+0.7vw,1.35rem)] leading-none font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
      </Card>
    </motion.div>
  );
}
