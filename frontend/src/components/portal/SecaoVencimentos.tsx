"use client";

import { CalendarClock } from "lucide-react";

import { BadgeStatus } from "@/components/BadgeStatus";
import { DataTable, type Coluna } from "@/components/DataTable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatData, formatMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Solicitacao } from "@/lib/types";

type Tone = "danger" | "brand" | "success";

interface Grupo {
  data: string;
  itens: Solicitacao[];
  total: number;
  dias: number; // > 0 = dias em atraso; < 0 = dias até vencer
}

function agrupar(itens: Solicitacao[]): Grupo[] {
  const map = new Map<string, Solicitacao[]>();
  for (const s of itens) {
    const arr = map.get(s.data_vencimento);
    if (arr) arr.push(s);
    else map.set(s.data_vencimento, [s]);
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const grupos = [...map.entries()].map(([data, list]) => {
    const venc = new Date(`${data}T00:00:00`);
    const dias = Math.round((hoje.getTime() - venc.getTime()) / 86_400_000);
    return {
      data,
      itens: list,
      total: list.reduce((a, s) => a + Number(s.valor || 0), 0),
      dias,
    };
  });
  grupos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return grupos;
}

const subColunas: Coluna<Solicitacao>[] = [
  {
    id: "codigo",
    header: "Código",
    cell: (s) => (
      <span className="font-mono text-xs font-medium text-foreground/80">{s.codigo}</span>
    ),
  },
  { id: "cliente", header: "Cliente", cell: (s) => s.cliente },
  { id: "valor", header: "Originação", align: "right", cell: (s) => formatMoeda(s.valor) },
  {
    id: "status",
    header: "Status",
    align: "right",
    cell: (s) => <BadgeStatus status={s.status} label={s.status_label} />,
  },
];

export function SecaoVencimentos({
  itens,
  tone = "brand",
  defaultOpenFirst = false,
}: {
  itens: Solicitacao[];
  tone?: Tone;
  defaultOpenFirst?: boolean;
}) {
  const grupos = agrupar(itens);
  if (grupos.length === 0) return null;

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultOpenFirst ? [grupos[0].data] : []}
      className="gap-2"
    >
      {grupos.map((g) => (
        <AccordionItem
          key={g.data}
          value={g.data}
          className="overflow-hidden rounded-xl border bg-card not-last:border-b"
        >
          <AccordionTrigger className="items-center px-4 hover:no-underline data-[state=open]:bg-muted/40">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <BadgeAtraso dias={g.dias} tone={tone} />
              <div className="flex flex-col">
                <span className="font-display text-sm font-semibold tabular-nums">
                  {formatData(g.data)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.itens.length} solicitaç{g.itens.length === 1 ? "ão" : "ões"}
                </span>
              </div>
              <span className="ml-auto pr-2 font-display text-sm font-bold tabular-nums">
                {formatMoeda(String(g.total))}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2 pb-2">
            <DataTable colunas={subColunas} itens={g.itens} getKey={(s) => s.codigo} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function BadgeAtraso({ dias, tone }: { dias: number; tone: Tone }) {
  if (tone === "danger" && dias > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white">
        <CalendarClock className="size-3.5" />
        {dias}d atrás
      </span>
    );
  }
  const cls =
    tone === "success"
      ? "bg-success/12 text-success"
      : dias < 0
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  const texto =
    tone === "success" ? "Pago" : dias < 0 ? `em ${Math.abs(dias)}d` : dias === 0 ? "hoje" : `${dias}d`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        cls,
      )}
    >
      <CalendarClock className="size-3.5" />
      {texto}
    </span>
  );
}
