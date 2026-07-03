"use client";

import { useEffect, useState } from "react";

import { ApiError, apiGet } from "./api";
import type { Me } from "./types";

interface MeState {
  me: Me | null;
  loading: boolean;
  error: string | null;
  // true SÓ quando o backend recusou a identidade (401). Falha transitória (500/rede) NÃO
  // marca isto — assim o layout não desloga uma sessão válida por um soluço do backend.
  naoAutenticado: boolean;
}

/** Carrega `GET /api/me` (papel + contratante) para guardas de rota e header. */
export function useMe(): MeState {
  const [state, setState] = useState<MeState>({
    me: null,
    loading: true,
    error: null,
    naoAutenticado: false,
  });

  useEffect(() => {
    let active = true;
    apiGet<Me>("/api/me")
      .then((me) => active && setState({ me, loading: false, error: null, naoAutenticado: false }))
      .catch(
        (e) =>
          active &&
          setState({
            me: null,
            loading: false,
            error: e.message,
            naoAutenticado: e instanceof ApiError && e.statusHttp === 401,
          }),
      );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
