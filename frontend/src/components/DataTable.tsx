import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Coluna<T> {
  id: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  align?: "right" | "center";
  headClassName?: string;
  cellClassName?: string;
  /** Coluna clicável para ordenar. A chave enviada ao backend é `sortKey ?? id`. */
  sortable?: boolean;
  sortKey?: string;
}

export type Dir = "asc" | "desc";
export interface OrdemTabela {
  col: string; // sortKey da coluna ativa
  dir: Dir;
}

interface GrupoMeta {
  ord: number; // ordinal do grupo (paridade alterna o tom → separa grupos vizinhos)
}

// Marca runs de linhas adjacentes com a mesma chave (`groupBy`). Só vira grupo com 2+ linhas.
// `ord` alterna para que duas aglomerações coladas (ex.: Eliane×2 seguido de Michel×2) não
// virem uma banda única — o tom muda entre uma e outra.
function calcGrupos<T>(
  itens: T[],
  groupBy?: (item: T) => string | null | undefined,
): (GrupoMeta | null)[] {
  if (!groupBy) return itens.map(() => null);
  const ids = itens.map((it) => groupBy(it) ?? null);
  const meta: (GrupoMeta | null)[] = new Array(itens.length).fill(null);
  let i = 0;
  let ord = 0;
  while (i < itens.length) {
    const id = ids[i];
    if (id == null) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < itens.length && ids[j] === id) j += 1;
    if (j - i > 1) {
      for (let k = i; k < j; k++) meta[k] = { ord };
      ord += 1;
    }
    i = j;
  }
  return meta;
}

// Tabela genérica (coração do portal). Header estilo planilha, hover suave, linhas
// clicáveis e acento vivo por parceiro (barra colorida à esquerda). Scroll horizontal
// automático (shadcn Table) — suporta muitas colunas sem quebrar. `groupBy` desenha uma
// listra grossa englobando as linhas adjacentes do mesmo grupo (ex.: médico).
export function DataTable<T>({
  colunas,
  itens,
  onRowClick,
  rowAccent,
  groupBy,
  getKey,
  vazio,
  ordem,
  onOrdenar,
}: {
  colunas: Coluna<T>[];
  itens: T[];
  onRowClick?: (item: T) => void;
  rowAccent?: (item: T) => string | null | undefined;
  groupBy?: (item: T) => string | null | undefined;
  getKey?: (item: T, index: number) => string | number;
  vazio?: { titulo: string; descricao?: string };
  /** Ordenação ativa (coluna + direção). Só afeta as colunas com `sortable`. */
  ordem?: OrdemTabela;
  /** Clique num cabeçalho ordenável — recebe a `sortKey` da coluna. */
  onOrdenar?: (col: string) => void;
}) {
  if (itens.length === 0) {
    return (
      <Empty className="rounded-xl bg-card ring-1 ring-foreground/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>{vazio?.titulo ?? "Nada por aqui"}</EmptyTitle>
          {vazio?.descricao ? <EmptyDescription>{vazio.descricao}</EmptyDescription> : null}
        </EmptyHeader>
      </Empty>
    );
  }

  function alignClass(align?: "right" | "center") {
    return align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  }

  const grupos = calcGrupos(itens, groupBy);

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="border-border/70 bg-muted/40 hover:bg-muted/40">
            {colunas.map((c) => {
              const chave = c.sortKey ?? c.id;
              const ativo = c.sortable && ordem?.col === chave;
              return (
                <TableHead
                  key={c.id}
                  aria-sort={
                    ativo ? (ordem?.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={cn(
                    "h-11 px-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
                    alignClass(c.align),
                    c.headClassName,
                  )}
                >
                  {c.sortable && onOrdenar ? (
                    <button
                      type="button"
                      onClick={() => onOrdenar(chave)}
                      className={cn(
                        "inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                        ativo && "text-foreground",
                      )}
                    >
                      {c.header}
                      {ativo ? (
                        ordem?.dir === "asc" ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item, i) => {
            const accent = rowAccent?.(item);
            const g = grupos[i];
            return (
              <TableRow
                key={getKey ? getKey(item, i) : i}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                // Linha clicável precisa ser operável por teclado (Enter/Espaço) e focável.
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(item);
                        }
                      }
                    : undefined
                }
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                data-clickable={onRowClick ? "" : undefined}
                className={cn(
                  "border-border/60 transition-colors",
                  // Banda sutil unindo as linhas do mesmo médico; o tom alterna entre grupos
                  // vizinhos para que duas aglomerações coladas não se fundam.
                  g != null && (g.ord % 2 === 0 ? "bg-primary/[0.05]" : "bg-muted/55"),
                  onRowClick &&
                    "cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                )}
              >
                {colunas.map((c, ci) => (
                  <TableCell
                    key={c.id}
                    style={
                      ci === 0 && accent
                        ? { boxShadow: `inset 3px 0 0 0 ${accent}` }
                        : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-sm text-foreground",
                      alignClass(c.align),
                      c.align === "right" && "tabular-nums",
                      c.cellClassName,
                    )}
                  >
                    {c.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
