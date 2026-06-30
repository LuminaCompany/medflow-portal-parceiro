"use client";

import { useEffect, useState } from "react";

// Valor com atraso (DRY): evita disparar efeito/fetch a cada tecla. O valor só "assenta"
// após `delay` ms sem mudanças — usado nas buscas (Solicitações, Pendências).
export function useDebounce<T>(valor: T, delay = 350): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), delay);
    return () => clearTimeout(id);
  }, [valor, delay]);

  return debounced;
}
