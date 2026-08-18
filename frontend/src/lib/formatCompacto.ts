// Formata valor em rótulo curto p/ topo de barra: nunca quebra em 2 linhas.
// 1.303.450,40 -> "1.3M" · 15.346 -> "15.3Mil" · 342 -> "342"
export function formatCompacto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}Mil`;
  return String(Math.round(v));
}
