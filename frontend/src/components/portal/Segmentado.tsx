"use client";

import { cn } from "@/lib/utils";

export interface OpcaoSegmentado {
  v: string;
  label: React.ReactNode;
  /** Contagem opcional exibida ao lado do rótulo. */
  count?: number;
}

/**
 * Controle segmentado (um ativo por vez) no vocabulário do site: trilho lavanda raio 10,
 * opção ativa = roxo chapado + texto branco (como a `.pill-filled`), inativa = roxo-escuro.
 * Fonte única p/ toggles do portal (base do rebate, formato do export, filtros de grupo…).
 */
export function Segmentado({
  valor,
  onChange,
  opcoes,
  ariaLabel,
  tamanho = "md",
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoSegmentado[];
  ariaLabel?: string;
  tamanho?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap gap-1 rounded-[10px] bg-accent p-1", className)}
    >
      {opcoes.map((o) => {
        const ativo = valor === o.v;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap",
              "transition-colors duration-150 ease-[ease]",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              tamanho === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-accent-foreground/80 hover:bg-card/70 hover:text-accent-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums",
                  ativo ? "bg-white/20 text-primary-foreground" : "bg-card text-accent-foreground",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
