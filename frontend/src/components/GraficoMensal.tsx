"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMes, formatMoeda } from "@/lib/format";

const config = {
  valor: { label: "Originação", color: "var(--chart-1)" },
} satisfies ChartConfig;

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Série mensal de valor originado — Recharts via shadcn Chart. Barras com gradiente roxo,
// tooltip interativo formatado em BRL, barra ativa em destaque. Cor vinda dos tokens.
export function GraficoMensal({ serie }: { serie: { mes: string; valor: string }[] }) {
  const data = serie.map((p) => ({ mes: formatMes(p.mes), valor: Number(p.valor) }));

  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="grad-originacao" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => compacto.format(v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--accent)", opacity: 0.5, radius: 6 }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Originação</span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatMoeda(String(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="valor"
          radius={[6, 6, 0, 0]}
          fill="url(#grad-originacao)"
          maxBarSize={64}
          activeBar={{ fillOpacity: 1, stroke: "var(--chart-1)", strokeWidth: 1 }}
        />
      </BarChart>
    </ChartContainer>
  );
}
