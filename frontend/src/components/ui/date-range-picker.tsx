"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** Intervalo de datas em ISO "yyyy-MM-dd" ("" quando vazio). de==ate = um único dia. */
export interface Intervalo {
  de: string
  ate: string
}

export const INTERVALO_VAZIO: Intervalo = { de: "", ate: "" }

function isoParaData(iso: string): Date | undefined {
  if (!iso) return undefined
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function dataParaIso(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function intervaloParaRange({ de, ate }: Intervalo): DateRange | undefined {
  const from = isoParaData(de)
  if (!from) return undefined
  return { from, to: isoParaData(ate) }
}

// react-day-picker entrega só `from` até o 2º clique; tratamos "um dia" como de==ate.
function rangeParaIntervalo(range: DateRange | undefined): Intervalo {
  if (!range?.from) return INTERVALO_VAZIO
  const de = dataParaIso(range.from)
  return { de, ate: range.to ? dataParaIso(range.to) : de }
}

function fmt(iso: string): string {
  const d = isoParaData(iso)
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : ""
}

function rotuloIntervalo({ de, ate }: Intervalo): string {
  if (!de) return ""
  return de === ate || !ate ? fmt(de) : `${fmt(de)} – ${fmt(ate)}`
}

interface Props {
  value: Intervalo
  onChange: (intervalo: Intervalo) => void
  placeholder?: string
  className?: string
  numberOfMonths?: number
  "aria-label"?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Escolher período",
  className,
  numberOfMonths = 2,
  "aria-label": ariaLabel,
}: Props) {
  const [aberto, setAberto] = React.useState(false)
  const [rascunho, setRascunho] = React.useState<DateRange | undefined>(() =>
    intervaloParaRange(value)
  )

  // Sincroniza o rascunho com o valor externo só na abertura (não bagunça a seleção em curso).
  function onOpenChange(next: boolean) {
    if (next) setRascunho(intervaloParaRange(value))
    setAberto(next)
  }

  function aplicar() {
    onChange(rangeParaIntervalo(rascunho))
    setAberto(false)
  }

  const rotulo = rotuloIntervalo(value)

  return (
    <Popover open={aberto} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          data-empty={!rotulo}
          className={cn(
            "justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon />
          {rotulo ? (
            <span className="tabular-nums">{rotulo}</span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          autoFocus
          locale={ptBR}
          numberOfMonths={numberOfMonths}
          selected={rascunho}
          defaultMonth={rascunho?.from}
          onSelect={setRascunho}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRascunho(undefined)}
            disabled={!rascunho?.from}
          >
            Limpar
          </Button>
          <Button type="button" size="sm" onClick={aplicar}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
