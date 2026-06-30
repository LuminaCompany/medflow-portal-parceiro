"use client";

// Seletor de recorte temporal da Visão Geral (RF-019): toggle "ano inteiro" (padrão) vs
// "por mês". Em "por mês" o usuário escolhe todos ou apenas alguns meses do ano selecionado.
// Substitui os antigos filtros de período/mês de originação e o input de comparativo.

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

const TODOS_OS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  ano: number;
  anosDisponiveis: number[];
  porMes: boolean;
  meses: number[]; // meses selecionados (1-12) quando porMes
  onAno: (ano: number) => void;
  onPorMes: (porMes: boolean) => void;
  onMeses: (meses: number[]) => void;
}

export function SeletorTempoOverview({
  ano,
  anosDisponiveis,
  porMes,
  meses,
  onAno,
  onPorMes,
  onMeses,
}: Props) {
  const anos = anosDisponiveis.length > 0 ? anosDisponiveis : [ano];
  const todosSelecionados = meses.length === 12;

  function alternaMes(m: number) {
    onMeses(meses.includes(m) ? meses.filter((x) => x !== m) : [...meses, m].sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={String(ano)} onValueChange={(v) => onAno(Number(v))}>
            <SelectTrigger className="h-9 w-[110px] tabular-nums" aria-label="Ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)} className="tabular-nums">
                    {a}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch
              checked={porMes}
              onCheckedChange={onPorMes}
              aria-label="Recorte por mês"
            />
            <span className={cn(!porMes && "text-muted-foreground")}>
              {porMes ? "Por mês" : "Ano inteiro"}
            </span>
          </label>
        </div>

        {porMes ? (
          <button
            type="button"
            onClick={() => onMeses(todosSelecionados ? [] : TODOS_OS_MESES)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {todosSelecionados ? "Limpar" : "Selecionar todos"}
          </button>
        ) : null}
      </div>

      {porMes ? (
        <div className="flex flex-wrap gap-1.5">
          {MESES.map((nome, i) => {
            const m = i + 1;
            const ativo = meses.includes(m);
            return (
              <button
                key={nome}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternaMes(m)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
                  ativo
                    ? "bg-primary/10 text-primary ring-primary/25"
                    : "bg-muted text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {nome}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
