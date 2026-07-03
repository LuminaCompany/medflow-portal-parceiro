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

const SEM_UNIDADE = "Sem unidade";

interface Grupo {
  chave: string; // unidade|data (único por lote)
  unidade: string;
  data: string;
  itens: Solicitacao[];
  total: number;
  dias: number; // > 0 = dias em atraso; < 0 = dias até vencer
}

// Agrupa por LOTE (unidade + data de vencimento) — cada barra passa a identificar a unidade,
// espelhando a seção "Vencimentos" principal (antes agrupava só por data, misturando unidades).
function agrupar(itens: Solicitacao[]): Grupo[] {
  const map = new Map<string, Solicitacao[]>();
  for (const s of itens) {
    const unidade = s.unidade ?? SEM_UNIDADE;
    const chave = `${unidade}|${s.data_vencimento}`;
    const arr = map.get(chave);
    if (arr) arr.push(s);
    else map.set(chave, [s]);
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const grupos = [...map.entries()].map(([chave, list]) => {
    const unidade = list[0].unidade ?? SEM_UNIDADE;
    const data = list[0].data_vencimento;
    const venc = new Date(`${data}T00:00:00`);
    const dias = Math.round((hoje.getTime() - venc.getTime()) / 86_400_000);
    return {
      chave,
      unidade,
      data,
      itens: list,
      total: list.reduce((a, s) => a + Number(s.valor || 0), 0),
      dias,
    };
  });
  // Ordena por data e, dentro da mesma data, por unidade.
  grupos.sort((a, b) =>
    a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.unidade.localeCompare(b.unidade),
  );
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
    id: "cashback",
    header: "Rebate",
    align: "right",
    cell: (s) => <span className="text-success">{formatMoeda(s.cashback)}</span>,
  },
  {
    id: "status",
    header: "Status",
    align: "right",
    cell: (s) => <BadgeStatus status={s.status} />,
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
      defaultValue={defaultOpenFirst ? [grupos[0].chave] : []}
      className="gap-2"
    >
      {grupos.map((g) => (
        <AccordionItem
          key={g.chave}
          value={g.chave}
          className="overflow-hidden rounded-xl border bg-card not-last:border-b"
        >
          <AccordionTrigger className="items-center px-4 hover:no-underline data-[state=open]:bg-muted/40">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <BadgeAtraso dias={g.dias} tone={tone} />
              <div className="flex flex-col">
                <span className="font-display text-sm font-semibold">{g.unidade}</span>
                <span className="text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatData(g.data)}</span> ·{" "}
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
      ? "bg-success/12 text-success-ink"
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
