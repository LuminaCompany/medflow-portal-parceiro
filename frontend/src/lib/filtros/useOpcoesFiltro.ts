"use client";

// Opções de filtro escopadas (spec 002 §3.2): valores possíveis por campo, vindos do
// backend já filtrados pelo escopo do usuário (R-001). Metadados estáticos vêm do registry.

import { useEffect, useState } from "react";

import { apiGet } from "@/lib/api";
import type { Aba } from "./registry";

export interface OpcaoCampo {
  id: string;
  tipo: "multi" | "range" | "date";
  opcoes?: string[]; // multi
  min?: string | null; // range/date
  max?: string | null;
}

interface OpcoesResp {
  campos: OpcaoCampo[];
}

export interface UseOpcoesFiltro {
  porId: Map<string, OpcaoCampo>;
  loading: boolean;
}

export function useOpcoesFiltro(aba: Aba): UseOpcoesFiltro {
  const [porId, setPorId] = useState<Map<string, OpcaoCampo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    apiGet<OpcoesResp>(`/api/filtros/opcoes?aba=${aba}`)
      .then((data) => {
        if (ativo) setPorId(new Map(data.campos.map((c) => [c.id, c])));
      })
      .catch(() => ativo && setPorId(new Map()))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [aba]);

  return { porId, loading };
}
