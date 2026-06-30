// Serialização de valores de filtro (spec 002 §3.3). Mesma convenção da API:
// multi = csv · range/date = "min..max" (bordas abertas: "..max", "min.."). Cobre o
// ida/volta entre a string da URL e o que os editores manipulam, + resumo do chip.

import { formatData, formatMes, formatMoeda } from "@/lib/format";
import { type CampoDef, STATUS_LABEL } from "./registry";

const SEP = "..";

// --- multi -------------------------------------------------------------------------

export function parseMulti(valor: string): string[] {
  return valor.split(",").map((v) => v.trim()).filter(Boolean);
}

export function serializaMulti(valores: string[]): string {
  return valores.join(",");
}

// --- range / date ------------------------------------------------------------------

export interface Faixa {
  min: string;
  max: string;
}

export function parseFaixa(valor: string): Faixa {
  if (valor.includes(SEP)) {
    const [min, max] = valor.split(SEP);
    return { min: min ?? "", max: max ?? "" };
  }
  return { min: valor, max: valor };
}

/** "" se ambos vazios (filtro inexistente). */
export function serializaFaixa({ min, max }: Faixa): string {
  const lo = min.trim();
  const hi = max.trim();
  if (!lo && !hi) return "";
  return `${lo}${SEP}${hi}`;
}

// --- rótulos -----------------------------------------------------------------------

/** Rótulo de uma opção (multi) conforme o formato do campo. */
export function rotuloOpcao(campo: CampoDef, valor: string): string {
  if (campo.formato === "status") return STATUS_LABEL[valor] ?? valor;
  if (campo.formato === "mes") return formatMes(valor);
  return valor;
}

function rotuloFaixaItem(campo: CampoDef, v: string): string {
  if (campo.formato === "moeda") return formatMoeda(v);
  if (campo.formato === "data") return formatData(v);
  return v;
}

/** Resumo curto exibido no chip a partir do valor serializado. */
export function resumoChip(campo: CampoDef, valor: string): string {
  if (campo.tipo === "multi") {
    const itens = parseMulti(valor);
    if (itens.length === 0) return "—";
    const primeiro = rotuloOpcao(campo, itens[0]);
    return itens.length === 1 ? primeiro : `${primeiro} +${itens.length - 1}`;
  }
  const { min, max } = parseFaixa(valor);
  const lo = min.trim();
  const hi = max.trim();
  if (lo && hi) return `${rotuloFaixaItem(campo, lo)} – ${rotuloFaixaItem(campo, hi)}`;
  if (lo) return `≥ ${rotuloFaixaItem(campo, lo)}`;
  if (hi) return `≤ ${rotuloFaixaItem(campo, hi)}`;
  return "—";
}
