"use client";

// Barra de filtros no topo da aba (spec 002 §3.3/§3.4). Renderiza chips ativos, o botão
// "Adicionar filtro" (campos ainda não usados) e "Limpar tudo". Auto-contida: lê/escreve
// os filtros na URL via useFiltros; as opções vêm escopadas do backend.
//
// `children` (opcional) ocupa o início da linha — usado para o campo de busca livre, que
// é separado dos chips.

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";
import { type Aba, camposDaAba, campoPorId } from "@/lib/filtros/registry";
import { useFiltros } from "@/lib/filtros/useFiltros";
import { useOpcoesFiltro } from "@/lib/filtros/useOpcoesFiltro";
import { AdicionarFiltro } from "./AdicionarFiltro";
import { ChipFiltro } from "./ChipFiltro";

interface Props {
  aba: Aba;
  papel: Role;
  children?: React.ReactNode;
}

export function BarraFiltros({ aba, papel, children }: Props) {
  const { ativos, set, remove, limpar } = useFiltros(aba);
  const { porId } = useOpcoesFiltro(aba);

  const ativosIds = useMemo(() => new Set(ativos.map((a) => a.id)), [ativos]);
  const disponiveis = useMemo(
    () => camposDaAba(aba, papel).filter((c) => !ativosIds.has(c.id)),
    [aba, papel, ativosIds],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}

      {ativos.map(({ id, valor }) => {
        const campo = campoPorId(id);
        if (!campo) return null;
        return (
          <ChipFiltro
            key={id}
            campo={campo}
            valor={valor}
            opcao={porId.get(id)}
            onAplicar={(v) => set(id, v)}
            onRemove={() => remove(id)}
          />
        );
      })}

      <AdicionarFiltro disponiveis={disponiveis} opcoesPorId={porId} onAplicar={set} />

      {ativos.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={limpar}
        >
          Limpar tudo
        </Button>
      ) : null}
    </div>
  );
}
