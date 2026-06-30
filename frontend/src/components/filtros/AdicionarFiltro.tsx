"use client";

// Popover "Adicionar filtro" (spec 002 §3.3): passo 1 escolhe o campo (só os ainda não
// usados, já filtrados por aba/papel pelo chamador); passo 2 edita o valor.

import { useState } from "react";
import { ChevronLeft, ListFilter, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CampoDef } from "@/lib/filtros/registry";
import type { OpcaoCampo } from "@/lib/filtros/useOpcoesFiltro";
import { EditorValor } from "./EditorValor";

interface Props {
  disponiveis: CampoDef[];
  opcoesPorId: Map<string, OpcaoCampo>;
  onAplicar: (id: string, valor: string) => void;
}

export function AdicionarFiltro({ disponiveis, opcoesPorId, onAplicar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [campo, setCampo] = useState<CampoDef | null>(null);

  function fechar() {
    setAberto(false);
    setCampo(null);
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) setCampo(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed" disabled={disponiveis.length === 0 && !campo}>
          <Plus className="size-3.5" />
          Adicionar filtro
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {campo ? (
          <>
            <button
              type="button"
              onClick={() => setCampo(null)}
              className="flex items-center gap-1 px-1 pb-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              {campo.label}
            </button>
            <EditorValor
              campo={campo}
              opcao={opcoesPorId.get(campo.id)}
              valorInicial=""
              onAplicar={(v) => {
                if (v) onAplicar(campo.id, v);
                fechar();
              }}
            />
          </>
        ) : (
          <>
            <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground">
              <ListFilter className="size-3.5" />
              Filtrar por
            </p>
            <div className="-mx-1 max-h-64 overflow-y-auto px-1">
              {disponiveis.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Todos os filtros já estão em uso.</p>
              ) : (
                disponiveis.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCampo(c)}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {c.label}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
