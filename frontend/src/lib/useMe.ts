"use client";

import { useEffect, useState } from "react";

import { apiGet } from "./api";
import type { Me } from "./types";

interface MeState {
  me: Me | null;
  loading: boolean;
  error: string | null;
}

/** Carrega `GET /api/me` (papel + contratante) para guardas de rota e header. */
export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ me: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    apiGet<Me>("/api/me")
      .then((me) => active && setState({ me, loading: false, error: null }))
      .catch((e) => active && setState({ me: null, loading: false, error: e.message }));
    return () => {
      active = false;
    };
  }, []);

  return state;
}
