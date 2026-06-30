"use client";

// Chip de um filtro ativo (spec 002 §3.3). Mostra "Campo: resumo"; o corpo abre o editor
// num popover, o "×" remove o filtro.

import { useState } from "react";
import { X } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CampoDef } from "@/lib/filtros/registry";
import { resumoChip } from "@/lib/filtros/serialize";
import type { OpcaoCampo } from "@/lib/filtros/useOpcoesFiltro";
import { EditorValor } from "./EditorValor";

interface Props {
  campo: CampoDef;
  valor: string;
  opcao?: OpcaoCampo;
  onAplicar: (valor: string) => void;
  onRemove: () => void;
}

export function ChipFiltro({ campo, valor, opcao, onAplicar, onRemove }: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/[0.06] text-sm">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-l-full py-1.5 pl-3 pr-2 font-medium transition-colors hover:bg-primary/10",
          )}
          aria-label={`Editar filtro ${campo.label}`}
        >
          <span className="text-muted-foreground">{campo.label}:</span>
          <span className="max-w-[160px] truncate">{resumoChip(campo, valor)}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{campo.label}</p>
          <EditorValor
            campo={campo}
            opcao={opcao}
            valorInicial={valor}
            onAplicar={(v) => {
              onAplicar(v);
              setAberto(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${campo.label}`}
        className="grid size-7 place-items-center rounded-r-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
