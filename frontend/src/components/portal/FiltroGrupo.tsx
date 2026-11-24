"use client";

import { Segmentado } from "@/components/portal/Segmentado";

export interface OpcaoFiltro {
  v: string;
  label: string;
  /** Contagem opcional exibida ao lado do rótulo (ex.: nº de itens daquele filtro). */
  count?: number;
}

/** Grupo segmentado de filtro (um ativo por vez). Usado em Feedbacks e Pendências. */
export function FiltroGrupo({
  valor,
  onChange,
  opcoes,
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoFiltro[];
  className?: string;
}) {
  return <Segmentado valor={valor} onChange={onChange} opcoes={opcoes} className={className} />;
}
