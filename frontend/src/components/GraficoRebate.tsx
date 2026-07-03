"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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

// Série mensal do rebate (Σ cashback) — gráfico de área (linha) via shadcn Chart, em verde
// (var(--chart-4)). Mesmo eixo Y compacto do gráfico de originação. Cor vinda dos tokens.
export function GraficoRebate({ serie }: { serie: { mes: string; rebate: string }[] }) {
  const data = serie.map((p) => ({ mes: formatMes(p.mes), rebate: Number(p.rebate) }));

  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="fill-rebate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.1} />
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
          cursor={false}
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
        <Area
          dataKey="rebate"
          type="natural"
          fill="url(#fill-rebate)"
          stroke="var(--chart-4)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
