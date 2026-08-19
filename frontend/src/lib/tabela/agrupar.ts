// Agrupamento por Cliente das solicitações de um lote (aba Vencimentos do parceiro).
//
// Uma linha por cliente com os agregados do grupo; as solicitações viram filhas expansíveis.
// Só vale na ordem por Cliente (a página decide) — funções puras, sem React/DOM.

import type { Dir } from "@/components/DataTable";
import type { Solicitacao, StatusKey } from "@/lib/types";

import { PESO_STATUS, comparaCronologica } from "./ordenar";

const SEM_CLIENTE = "Sem cliente";

export interface GrupoCliente {
  chave: string; // nome normalizado — único no lote, serve de key do React e do Set de expandidos
  cliente: string; // nome como veio do sheet (1ª ocorrência)
  itens: Solicitacao[]; // sempre em ordem cronológica
  valor: number; // Σ Originação
  cashback: number; // Σ Rebate
  dataVencimento: string | null; // data única do grupo; null quando divergem
  nDatas: number; // quantas datas distintas de vencimento
  status: StatusKey; // rollup pior-primeiro (Vencido > A Vencer > Pago)
  statusUniforme: boolean; // false = o grupo mistura status
}

// Nomes vêm do sheet sem padronização de caixa/espaço; normaliza só para agrupar
// (a exibição usa o nome original). NÃO remove acento: "Joao" e "João" são clientes distintos
// no sheet e fundi-los inventaria um agregado que não existe.
function chaveCliente(cliente: string | null | undefined): string {
  return (cliente ?? "").trim().toUpperCase() || SEM_CLIENTE;
}

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Agrupa por cliente e ordena os grupos alfabeticamente (`dir` controla A→Z / Z→A).
 * Dentro do grupo, as filhas ficam em ordem cronológica (data do pedido asc).
 */
export function agrupaPorCliente(itens: Solicitacao[], dir: Dir): GrupoCliente[] {
  const mapa = new Map<string, Solicitacao[]>();
  for (const s of itens) {
    const chave = chaveCliente(s.cliente);
    const arr = mapa.get(chave);
    if (arr) arr.push(s);
    else mapa.set(chave, [s]);
  }

  const grupos: GrupoCliente[] = [];
  for (const [chave, lista] of mapa) {
    lista.sort(comparaCronologica);
    const datas = new Set(lista.map((s) => s.data_vencimento).filter(Boolean));
    const statuses = new Set(lista.map((s) => s.status));
    const pior = lista.reduce<StatusKey>(
      (acc, s) => (PESO_STATUS[s.status] > PESO_STATUS[acc] ? s.status : acc),
      "pago"
    );
    grupos.push({
      chave,
      cliente: lista[0].cliente?.trim() || SEM_CLIENTE,
      itens: lista,
      valor: lista.reduce((a, s) => a + (Number(s.valor) || 0), 0),
      cashback: lista.reduce((a, s) => a + (Number(s.cashback) || 0), 0),
      // Uma data só → mostra a data; várias → "Várias (n)" na célula.
      dataVencimento: datas.size === 1 ? [...datas][0] : null,
      nDatas: datas.size,
      status: pior,
      statusUniforme: statuses.size <= 1,
    });
  }

  const mult = dir === "asc" ? 1 : -1;
  grupos.sort((a, b) => COLLATOR.compare(a.cliente, b.cliente) * mult);
  return grupos;
}
