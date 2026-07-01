"use client";

// Seletor de recorte temporal da Visão Geral (RF-019): toggle "ano inteiro" (padrão) vs
// "por mês" (meses do ano selecionado). Alternativamente, um PERÍODO de datas de originação
// (calendário de 2 meses, com confirmação): quando ativo, SUBSTITUI o recorte ano/meses —
// a visão passa a mostrar apenas as solicitações originadas dentro do intervalo.

import { X } from "lucide-react";

import { DateRangePicker, INTERVALO_VAZIO, type Intervalo } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
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
  intervalo: Intervalo; // período de originação (ISO); de="" = sem período
  onAno: (ano: number) => void;
  onPorMes: (porMes: boolean) => void;
  onMeses: (meses: number[]) => void;
  onIntervalo: (intervalo: Intervalo) => void;
}

export function SeletorTempoOverview({
  ano,
  anosDisponiveis,
  porMes,
  meses,
  intervalo,
  onAno,
  onPorMes,
  onMeses,
  onIntervalo,
}: Props) {
  const anos = anosDisponiveis.length > 0 ? anosDisponiveis : [ano];
  const todosSelecionados = meses.length === 12;
  const periodoAtivo = intervalo.de !== ""; // período substitui o recorte ano/meses

  function alternaMes(m: number) {
    onMeses(meses.includes(m) ? meses.filter((x) => x !== m) : [...meses, m].sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={cn("flex items-center gap-3", periodoAtivo && "opacity-50")}>
          <Select value={String(ano)} onValueChange={(v) => onAno(Number(v))} disabled={periodoAtivo}>
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

          <Field orientation="horizontal" className="w-auto" data-disabled={periodoAtivo || undefined}>
            <Checkbox
              id="recorte-por-mes"
              checked={porMes}
              disabled={periodoAtivo}
              onCheckedChange={(v) => onPorMes(v === true)}
              aria-label="Recorte por mês"
            />
            <Label
              htmlFor="recorte-por-mes"
              className={cn("cursor-pointer text-sm font-normal", !porMes && "text-muted-foreground")}
            >
              {porMes ? "Por mês" : "Ano inteiro"}
            </Label>
          </Field>
        </div>

        {/* Período de originação (calendário de 2 meses, com confirmação). Substitui ano/meses. */}
        <div className="flex items-center gap-1">
          <DateRangePicker
            value={intervalo}
            onChange={onIntervalo}
            numberOfMonths={2}
            placeholder="Período de originação"
            className="h-9 min-w-[210px]"
            aria-label="Filtrar por período de originação"
          />
          {periodoAtivo ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 text-muted-foreground"
              aria-label="Limpar período"
              onClick={() => onIntervalo(INTERVALO_VAZIO)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        {porMes && !periodoAtivo ? (
          <button
            type="button"
            onClick={() => onMeses(todosSelecionados ? [] : TODOS_OS_MESES)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {todosSelecionados ? "Limpar" : "Selecionar todos"}
          </button>
        ) : null}
      </div>

      {periodoAtivo ? (
        <p className="text-xs text-muted-foreground">
          Período de originação ativo — ano e meses são ignorados enquanto houver um intervalo.
        </p>
      ) : null}

      {porMes && !periodoAtivo ? (
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
