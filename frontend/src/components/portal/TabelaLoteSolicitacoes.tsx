"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { BadgeStatus } from "@/components/BadgeStatus";
import { DataTable, type Coluna, type OrdemTabela } from "@/components/DataTable";
import { formatData, formatMoeda } from "@/lib/format";
import { agrupaPorCliente, type GrupoCliente } from "@/lib/tabela/agrupar";
import { ordenaPlano, proximaOrdem } from "@/lib/tabela/ordenar";
import { cn } from "@/lib/utils";
import type { Solicitacao } from "@/lib/types";

/**
 * Tabela de solicitações de um lote na aba Vencimentos (visão do parceiro).
 *
 * Ordena por clique no cabeçalho (mesmo gesto da aba Solicitações) — client-side, porque o
 * lote já vem inteiro no payload. Na ordem PADRÃO (Cliente A→Z) as solicitações do mesmo
 * cliente colapsam numa linha-mãe com os totais do cliente (Originação e Rebate somados);
 * clicar expande as filhas em ordem cronológica. Qualquer outra coluna desfaz o agrupamento
 * e mostra a lista plana (espelha a RF-009 da aba Solicitações).
 *
 * Cada instância guarda a própria ordem/expansão: ordenar um lote não mexe nos outros.
 */

type Linha =
  | { tipo: "grupo"; grupo: GrupoCliente; aberto: boolean }
  | { tipo: "item"; s: Solicitacao; filha: boolean };

const ORDEM_PADRAO: OrdemTabela = { col: "cliente", dir: "asc" };

export function TabelaLoteSolicitacoes({
  itens,
  mostrarVencimento = true,
}: {
  itens: Solicitacao[];
  /** Coluna "Vencimento" — desligada na seção Pagos (lá o lote inteiro tem a mesma data). */
  mostrarVencimento?: boolean;
}) {
  const [ordem, setOrdem] = useState<OrdemTabela>(ORDEM_PADRAO);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const agrupado = ordem.col === "cliente";

  const alternar = useCallback((chave: string) => {
    setAbertos((prev) => {
      const proximo = new Set(prev);
      // delete() devolve false quando não existia → então é abrir.
      if (!proximo.delete(chave)) proximo.add(chave);
      return proximo;
    });
  }, []);

  const linhas = useMemo<Linha[]>(() => {
    if (!agrupado) {
      return ordenaPlano(itens, ordem).map((s) => ({ tipo: "item", s, filha: false }));
    }
    const out: Linha[] = [];
    for (const grupo of agrupaPorCliente(itens, ordem.dir)) {
      const aberto = abertos.has(grupo.chave);
      out.push({ tipo: "grupo", grupo, aberto });
      if (aberto) for (const s of grupo.itens) out.push({ tipo: "item", s, filha: true });
    }
    return out;
  }, [itens, ordem, agrupado, abertos]);

  const colunas = useMemo(() => construirColunas(mostrarVencimento), [mostrarVencimento]);

  return (
    <DataTable
      colunas={colunas}
      itens={linhas}
      getKey={(l, i) => (l.tipo === "grupo" ? `g:${l.grupo.chave}` : `i:${l.s.codigo}:${i}`)}
      ordem={ordem}
      onOrdenar={(col) => setOrdem((o) => proximaOrdem(o, col))}
      onRowClick={(l) => {
        if (l.tipo === "grupo") alternar(l.grupo.chave);
      }}
      rowClickable={(l) => l.tipo === "grupo"}
      rowExpanded={(l) => (l.tipo === "grupo" ? l.aberto : undefined)}
      rowClassName={(l) =>
        l.tipo === "item" && l.filha
          ? "bg-muted/25"
          : l.tipo === "grupo" && l.aberto
            ? "bg-muted/40"
            : undefined
      }
      vazio={{ titulo: "Nenhuma solicitação", descricao: "Este lote não tem solicitações." }}
    />
  );
}

function construirColunas(mostrarVencimento: boolean): Coluna<Linha>[] {
  const cols: Coluna<Linha>[] = [
    {
      id: "codigo",
      header: "Código",
      sortable: true,
      cell: (l) =>
        l.tipo === "grupo" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
            <ChevronRight
              aria-hidden
              className={cn("size-3.5 transition-transform", l.aberto && "rotate-90")}
            />
            {l.grupo.itens.length} solic.
          </span>
        ) : (
          <span
            className={cn(
              "font-mono text-xs font-medium text-foreground/80",
              l.filha && "ml-5 inline-block"
            )}
          >
            {l.s.codigo}
          </span>
        ),
    },
    {
      id: "cliente",
      header: "Cliente",
      sortable: true,
      cell: (l) =>
        l.tipo === "grupo" ? (
          <span className="font-medium">{l.grupo.cliente}</span>
        ) : (
          <span className={cn(l.filha && "text-muted-foreground")}>{l.s.cliente}</span>
        ),
    },
    {
      id: "valor",
      header: "Originação",
      align: "right",
      sortable: true,
      cell: (l) =>
        l.tipo === "grupo" ? (
          <span className="font-semibold">{formatMoeda(String(l.grupo.valor))}</span>
        ) : (
          formatMoeda(l.s.valor)
        ),
    },
    {
      id: "cashback",
      header: "Rebate",
      align: "right",
      sortable: true,
      cell: (l) => (
        <span className={cn("text-success", l.tipo === "grupo" && "font-semibold")}>
          {formatMoeda(l.tipo === "grupo" ? String(l.grupo.cashback) : l.s.cashback)}
        </span>
      ),
    },
  ];

  if (mostrarVencimento) {
    cols.push({
      id: "data_vencimento",
      header: "Vencimento",
      align: "right",
      sortable: true,
      cell: (l) => {
        if (l.tipo === "item") return formatData(l.s.data_vencimento);
        // Datas divergentes só acontecem na linha "Tudo pago" (unidade sem pendência mostra
        // todas as solicitações, de vencimentos diferentes) — resume e detalha no title.
        if (l.grupo.dataVencimento) return formatData(l.grupo.dataVencimento);
        return (
          <span className="text-muted-foreground" title={intervaloDatas(l.grupo)}>
            Várias ({l.grupo.nDatas})
          </span>
        );
      },
    });
  }

  cols.push({
    id: "status",
    header: "Status",
    align: "right",
    sortable: true,
    cell: (l) =>
      l.tipo === "item" ? (
        <BadgeStatus status={l.s.status} />
      ) : (
        // Rollup pior-primeiro; se o grupo mistura status, o title avisa.
        <BadgeStatus
          status={l.grupo.status}
          className={cn(!l.grupo.statusUniforme && "ring-1 ring-current/25")}
        />
      ),
  });

  return cols;
}

function intervaloDatas(g: GrupoCliente): string {
  const datas = g.itens
    .map((s) => s.data_vencimento)
    .filter(Boolean)
    .sort();
  if (datas.length === 0) return "";
  return `${formatData(datas[0])} – ${formatData(datas[datas.length - 1])}`;
}
