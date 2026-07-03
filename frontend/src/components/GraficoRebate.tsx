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
  rebate: { label: "Rebate", color: "var(--chart-4)" },
} satisfies ChartConfig;

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Série mensal do rebate (Σ cashback) — Recharts via shadcn Chart. Espelha o gráfico de
// originação (mesmo eixo Y compacto), mas em verde (var(--chart-4)). Cor vinda dos tokens.
export function GraficoRebate({ serie }: { serie: { mes: string; rebate: string }[] }) {
  const data = serie.map((p) => ({ mes: formatMes(p.mes), rebate: Number(p.rebate) }));

  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="grad-rebate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.5} />
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
                  <span className="text-muted-foreground">Rebate</span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatMoeda(String(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="rebate"
          radius={[6, 6, 0, 0]}
          fill="url(#grad-rebate)"
          maxBarSize={64}
          activeBar={{ fillOpacity: 1, stroke: "var(--chart-4)", strokeWidth: 1 }}
        />
      </BarChart>
    </ChartContainer>
  );
}
