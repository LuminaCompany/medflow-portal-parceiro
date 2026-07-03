"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { BarraFiltros } from "@/components/filtros/BarraFiltros";
import { DataTable, type OrdemTabela } from "@/components/DataTable";
import { DetalheSolicitacao } from "@/components/DetalheSolicitacao";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { ExportarSolicitacoes } from "@/components/portal/ExportarSolicitacoes";
import { colunasSolicitacao } from "@/components/colunasSolicitacao";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { useFiltros } from "@/lib/filtros/useFiltros";
import { useMe } from "@/lib/useMe";
import type {
  Paginada,
  ParceiroBotao,
  Solicitacao,
  SolicitacaoDetalhe,
} from "@/lib/types";

const PAGINA = 20;

function SolicitacoesView() {
  const { me } = useMe();
  const gestor = me?.role === "gestor";
  const papel = gestor ? "gestor" : "parceiro";

  const [q, setQ] = useState("");
  const qBusca = useDebounce(q.trim());
  const { queryString } = useFiltros("solicitacoes");
  const [parceiros, setParceiros] = useState<ParceiroBotao[]>([]);

  // Ordenação da tabela (feature 008). Padrão: data do pedido, mais recente primeiro. O 1º
  // clique numa coluna ordena decrescente (seta ↓); clicar de novo alterna p/ crescente (↑).
  const [ordem, setOrdem] = useState<OrdemTabela>({ col: "data_pedido", dir: "desc" });

  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [detalhe, setDetalhe] = useState<SolicitacaoDetalhe | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [detalheCodigo, setDetalheCodigo] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  const cols = useMemo(() => colunasSolicitacao(gestor), [gestor]);
  const [visiveis, setVisiveis] = useState<Set<string>>(new Set());
  useEffect(() => {
    setVisiveis(new Set(cols.filter((c) => !c.defaultHidden).map((c) => c.id)));
  }, [cols]);
  const colsVisiveis = useMemo(() => cols.filter((c) => visiveis.has(c.id)), [cols, visiveis]);
  // Acento de linha (gestor) na cor escolhida do parceiro — vinda de /parceiros/lista.
  const coresParceiro = useMemo(
    () => new Map(parceiros.map((p) => [p.contratante, p.cor])),
    [parceiros],
  );

  // Cores dos parceiros (gestor) para o acento de linha — o filtro de contratante é um chip.
  useEffect(() => {
    if (gestor) apiGet<ParceiroBotao[]>("/api/parceiros/lista").then(setParceiros).catch(() => {});
  }, [gestor]);

  const buscar = useCallback(
    async (novoOffset: number, acumular: boolean) => {
      setCarregando(true);
      setErro(null);
      const params = new URLSearchParams(queryString); // status/unidade/valor/… (chips)
      params.set("limit", String(PAGINA));
      params.set("offset", String(novoOffset));
      params.set("sort", ordem.col);
      params.set("dir", ordem.dir);
      if (qBusca) params.set("q", qBusca);
      try {
        const data = await apiGet<Paginada<Solicitacao>>(`/api/solicitacoes?${params}`);
        setItens((prev) => (acumular ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setHasMore(data.has_more);
        setOffset(novoOffset + data.items.length);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar solicitações.");
        if (!acumular) setItens([]);
      } finally {
        setCarregando(false);
      }
    },
    [qBusca, queryString, ordem],
  );

  useEffect(() => {
    buscar(0, false);
  }, [buscar]);

  // Clique no cabeçalho: mesma coluna → alterna direção; nova coluna → começa decrescente.
  function ordenarPor(col: string) {
    setOrdem((prev) =>
      prev.col === col ? { col, dir: prev.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" },
    );
  }

  async function abrirDetalhe(s: Solicitacao) {
    setSheetAberto(true);
    setDetalhe(null);
    setErroDetalhe(null);
    setDetalheCodigo(s.codigo);
    try {
      const d = await apiGet<SolicitacaoDetalhe>(
        `/api/solicitacoes/${encodeURIComponent(s.codigo)}`,
      );
      setDetalhe(d);
    } catch (e) {
      setErroDetalhe(e instanceof Error ? e.message : "Erro ao carregar o detalhe.");
    }
  }

  function toggleColuna(id: string) {
    setVisiveis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Solicitações de Antecipação</h1>
        <p className="mt-1 text-muted-foreground">
          Filtre, busque e explore {total} solicitaç{total === 1 ? "ão" : "ões"} de recebíveis.
        </p>
      </div>

      {/* Barra de filtros (chips) + busca + colunas */}
      <div className="flex flex-col gap-3">
        <BarraFiltros aba="solicitacoes" papel={papel}>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, cliente ou status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar solicitações"
              className="h-8 pl-9"
            />
          </div>
        </BarraFiltros>

        <div className="flex justify-end gap-2">
          <ExportarSolicitacoes papel={papel} gestor={gestor} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal />
                Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {cols
                .filter((c) => !c.essential)
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={visiveis.has(c.id)}
                    onCheckedChange={() => toggleColuna(c.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabela */}
      {carregando && itens.length === 0 ? (
        <Skeleton className="h-[420px] rounded-xl" />
      ) : erro && itens.length === 0 ? (
        <ErroCarregamento onRetry={() => buscar(0, false)} mensagem={erro} />
      ) : (
        <DataTable
          colunas={colsVisiveis}
          itens={itens}
          onRowClick={abrirDetalhe}
          getKey={(s) => s.codigo}
          ordem={ordem}
          onOrdenar={ordenarPor}
          groupBy={
            // O agrupamento visual por médico só faz sentido na ordem por médico (coluna
            // Cliente) — aí as linhas do mesmo médico ficam contíguas. Nas demais ordens, não
            // agrupa. Inclui o contratante p/ o gestor não fundir homônimos de parceiros.
            ordem.col === "cliente"
              ? (s) => (s.medico_grupo_id ? `${s.medico_grupo_id}|${s.contratante ?? ""}` : null)
              : undefined
          }
          rowAccent={
            gestor ? (s) => coresParceiro.get(s.contratante ?? "") ?? s.cor_parceiro : undefined
          }
          vazio={{
            titulo: "Nenhuma solicitação encontrada",
            descricao: "Ajuste a busca ou os filtros para ver resultados.",
          }}
        />
      )}

      {/* Rodapé / paginação */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground tabular-nums">
          {itens.length} de {total} registros
        </span>
        {hasMore ? (
          <Button variant="outline" onClick={() => buscar(offset, true)} disabled={carregando}>
            {carregando ? "Carregando…" : "Ver mais"}
          </Button>
        ) : null}
      </div>

      {/* Detalhe */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-bold">Detalhe da solicitação</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {detalhe ? (
              <DetalheSolicitacao detalhe={detalhe} />
            ) : erroDetalhe ? (
              <ErroCarregamento
                onRetry={() =>
                  detalheCodigo && abrirDetalhe({ codigo: detalheCodigo } as Solicitacao)
                }
                mensagem={erroDetalhe}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function SolicitacoesPage() {
  // useSearchParams (em useFiltros) exige fronteira de Suspense no app router.
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-xl" />}>
      <SolicitacoesView />
    </Suspense>
  );
}
