"use client";

import { cn } from "@/lib/utils";

export interface OpcaoFiltro {
  v: string;
  label: string;
  /** Contagem opcional exibida ao lado do rótulo (ex.: nº de itens daquele filtro). */
  count?: number;
}

/** Grupo segmentado de filtro (um ativo por vez). Usado em Feedbacks e Pendências. */
export function FiltroGrupo({
  valor,
  onChange,
  opcoes,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoFiltro[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap rounded-lg border bg-muted/30 p-0.5", className)}>
      {opcoes.map((o) => {
        const ativo = valor === o.v;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ativo
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  ativo ? "text-muted-foreground" : "text-muted-foreground/70",
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
