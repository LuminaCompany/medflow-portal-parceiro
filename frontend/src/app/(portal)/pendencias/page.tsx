"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, TriangleAlert } from "lucide-react";

import { DataTable, type Coluna } from "@/components/DataTable";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { formatMoeda } from "@/lib/format";
import type { Paginada, Pendencia } from "@/lib/types";

const PAGINA = 50;

// "Pendências de Dados" (gestor-only): solicitações reprovadas na validação, com motivo(s)
// e linha de origem. Some de toda outra tela/métrica; volta sozinha ao corrigir a planilha.
export default function PendenciasPage() {
  const [q, setQ] = useState("");
  const qBusca = useDebounce(q.trim());
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [mostrar, setMostrar] = useState(PAGINA);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams({ limit: "200" });
    if (qBusca) params.set("q", qBusca);
    apiGet<Paginada<Pendencia>>(`/api/admin/pendencias?${params}`)
      .then((d) => {
        setItens(d.items);
        setTotal(d.total);
        setMostrar(PAGINA);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar pendências."))
      .finally(() => setCarregando(false));
  }, [qBusca]);

  useEffect(() => {
    carregar();
  }, [carregar, tentativa]);

  const colunas: Coluna<Pendencia>[] = [
    { id: "linha", header: "Linha", align: "right", cell: (p) => String(p.linha_origem) },
    {
      id: "codigo",
      header: "Código",
      cell: (p) => <span className="font-mono text-xs font-medium text-foreground/80">{p.codigo}</span>,
    },
    { id: "cliente", header: "Cliente", cell: (p) => p.cliente ?? "—" },
    { id: "contratante", header: "Contratante", cell: (p) => p.contratante ?? "—" },
    { id: "valor", header: "Originação", align: "right", cell: (p) => formatMoeda(p.valor) },
    {
      id: "motivos",
      header: "Motivos",
      cell: (p) => (
        <div className="flex flex-wrap gap-1.5">
          {p.motivos.map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
            >
              {m}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-warning/15 text-warning ring-1 ring-warning/20">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pendências de Dados</h1>
          <p className="mt-0.5 max-w-2xl text-muted-foreground">
            {total} solicitaç{total === 1 ? "ão" : "ões"} com dado faltando ou inválido na planilha.
            Corrija na fonte e elas voltam às telas normais automaticamente.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, cliente, motivo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar pendências"
          className="h-10 pl-9"
        />
      </div>

      {carregando ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : erro ? (
        <ErroCarregamento onRetry={() => setTentativa((t) => t + 1)} mensagem={erro} />
      ) : (
        <>
          <DataTable
            colunas={colunas}
            itens={itens.slice(0, mostrar)}
            getKey={(p) => `${p.linha_origem}-${p.codigo}`}
            vazio={{
              titulo: "Nenhuma pendência",
              descricao: "Todos os dados da planilha estão consistentes.",
            }}
          />
          {itens.length > mostrar ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground tabular-nums">
                {Math.min(mostrar, itens.length)} de {itens.length}
              </span>
              <Button variant="outline" onClick={() => setMostrar((m) => m + PAGINA)}>
                Ver mais
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
