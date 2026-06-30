"use client";

// Estado dos filtros na query string da rota (spec 002 §3.2). Cada aba é uma rota
// própria, então a URL guarda os filtros daquela aba: link compartilhável, voltar/avançar
// e refresh preservados. A serialização é a MESMA enviada à API.

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { type Aba, REGISTRY, campoPorId } from "./registry";

const IDS_VALIDOS = (aba: Aba) =>
  new Set(REGISTRY.filter((c) => c.abas.includes(aba)).map((c) => c.id));

export interface FiltroAtivo {
  id: string;
  valor: string;
}

export interface UseFiltros {
  ativos: FiltroAtivo[];
  valorDe: (id: string) => string | undefined;
  set: (id: string, valor: string) => void;
  remove: (id: string) => void;
  limpar: () => void;
  /** Params de filtro serializados, p/ anexar à chamada da API (sem "?"). */
  queryString: string;
}

export function useFiltros(aba: Aba): UseFiltros {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ids = useMemo(() => IDS_VALIDOS(aba), [aba]);

  const ativos = useMemo<FiltroAtivo[]>(() => {
    const out: FiltroAtivo[] = [];
    searchParams.forEach((valor, id) => {
      if (ids.has(id) && valor) out.push({ id, valor });
    });
    // Ordena pela ordem do registry (estável visualmente).
    return out.sort((a, b) => REGISTRY.findIndex((c) => c.id === a.id) - REGISTRY.findIndex((c) => c.id === b.id));
  }, [searchParams, ids]);

  const aplicar = useCallback(
    (mutar: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutar(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const set = useCallback(
    (id: string, valor: string) => {
      if (!campoPorId(id)) return;
      aplicar((p) => (valor ? p.set(id, valor) : p.delete(id)));
    },
    [aplicar],
  );

  const remove = useCallback((id: string) => aplicar((p) => p.delete(id)), [aplicar]);

  const limpar = useCallback(() => aplicar((p) => ids.forEach((id) => p.delete(id))), [aplicar, ids]);

  const valorDe = useCallback((id: string) => searchParams.get(id) ?? undefined, [searchParams]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    ativos.forEach(({ id, valor }) => p.set(id, valor));
    return p.toString();
  }, [ativos]);

  return { ativos, valorDe, set, remove, limpar, queryString };
}
