"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, TriangleAlert, UserRound } from "lucide-react";

import { DataTable, type Coluna } from "@/components/DataTable";
import { SecaoDivisao } from "@/components/portal/DivisaoUnidades";
import { ErroCarregamento } from "@/components/portal/ErroCarregamento";
import { FiltroGrupo, type OpcaoFiltro } from "@/components/portal/FiltroGrupo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import { formatMoeda } from "@/lib/format";
import type { Paginada, Pendencia } from "@/lib/types";

const PAGINA = 50;
// Teto do `limit` no backend: a lista é buscada inteira, página a página, porque os
// filtros e as contagens dos botões são calculados no cliente.
const LOTE_API = 200;

const CONTRATANTE_INDIVIDUAL = "INDIVIDUAL";
// Parceiro fixado como 1º botão (decisão de produto); os demais seguem A→Z.
const PARCEIRO_FIXO = "A.H. GESTÃO MÉDICA";

const FILTRO_INDIVIDUAL = "individual";
// "Parceiro" = tudo que não é INDIVIDUAL (inclui a pendência sem Contratante, que senão
// ficaria invisível — não existe filtro "Todas").
const FILTRO_PARCEIRO = "parceiro";
const PREFIXO_PARCEIRO = "p:";

const contratanteDe = (p: Pendencia) => (p.contratante ?? "").trim();

// Pendência de divisão por unidade (feature 014, A.H.): vai para a seção própria no topo, com
// editor — não repete na tabela de pendências de dado.
const ehDivisao = (p: Pendencia) => p.divisao != null;

// Médicos "sem franquia" chegam com Contratante = "INDIVIDUAL" (não são erro de dado a
// corrigir na fonte): ficam no filtro "Individuais".
const ehIndividual = (p: Pendencia) =>
  contratanteDe(p).toUpperCase() === CONTRATANTE_INDIVIDUAL;

// Comparação tolerante a acento/pontuação/caixa ("A.H GESTAO MEDICA" = "A.H. GESTÃO MÉDICA").
const chaveNome = (s: string) =>
  s.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

function filtrar(itens: Pendencia[], filtro: string): Pendencia[] {
  if (filtro === FILTRO_INDIVIDUAL) return itens.filter(ehIndividual);
  if (filtro === FILTRO_PARCEIRO) return itens.filter((p) => !ehIndividual(p));
  const contratante = filtro.slice(PREFIXO_PARCEIRO.length);
  return itens.filter((p) => contratanteDe(p) === contratante);
}

/** Um botão por Contratante com pendência (fixo primeiro, resto A→Z). O parceiro
 * selecionado continua visível (com 0) se a busca o esvaziar, para poder ser desmarcado. */
function opcoesParceiros(itens: Pendencia[], filtro: string): OpcaoFiltro[] {
  const contagem = new Map<string, number>();
  for (const p of itens) {
    const c = contratanteDe(p);
    if (c && !ehIndividual(p)) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  }
  if (filtro.startsWith(PREFIXO_PARCEIRO)) {
    const selecionado = filtro.slice(PREFIXO_PARCEIRO.length);
    if (!contagem.has(selecionado)) contagem.set(selecionado, 0);
  }
  const fixo = chaveNome(PARCEIRO_FIXO);
  return [...contagem.entries()]
    .sort(
      ([a], [b]) =>
        Number(chaveNome(b) === fixo) - Number(chaveNome(a) === fixo) ||
        a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    )
    .map(([c, n]) => ({ v: `${PREFIXO_PARCEIRO}${c}`, label: c, count: n }));
}

/** Busca TODAS as pendências (o backend limita cada página a `LOTE_API`). */
async function carregarTodas(q: string): Promise<Pendencia[]> {
  const todas: Pendencia[] = [];
  for (;;) {
    const params = new URLSearchParams({ limit: String(LOTE_API), offset: String(todas.length) });
    if (q) params.set("q", q);
    const d = await apiGet<Paginada<Pendencia>>(`/api/admin/pendencias?${params}`);
    todas.push(...d.items);
    if (!d.has_more || d.items.length === 0) return todas;
  }
}

// "Pendências de Dados" (gestor-only): solicitações reprovadas na validação, com motivo(s)
// e linha de origem. Some de toda outra tela/métrica; volta sozinha ao corrigir a planilha.
export default function PendenciasPage() {
  const [q, setQ] = useState("");
  const qBusca = useDebounce(q.trim());
  const [filtro, setFiltro] = useState(FILTRO_PARCEIRO);
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [mostrar, setMostrar] = useState(PAGINA);
  // Recarga após salvar/desfazer uma divisão: sem skeleton, para não desmontar os editores
  // (o gestor pode estar preenchendo outras divisões).
  const silencioso = useRef(false);

  useEffect(() => {
    let ativo = true; // descarta resposta de uma busca já substituída por outra
    if (!silencioso.current) setCarregando(true);
    silencioso.current = false;
    setErro(null);
    carregarTodas(qBusca)
      .then((d) => {
        if (!ativo) return;
        setItens(d);
        setMostrar(PAGINA);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar pendências.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [qBusca, tentativa]);

  const filtradas = useMemo(() => filtrar(itens, filtro), [itens, filtro]);
  const divisoes = useMemo(() => filtradas.filter(ehDivisao), [filtradas]);
  const visiveis = useMemo(() => filtradas.filter((p) => !ehDivisao(p)), [filtradas]);
  const recarregarSilencioso = () => {
    silencioso.current = true;
    setTentativa((t) => t + 1);
  };
  const parceiros = useMemo(() => opcoesParceiros(itens, filtro), [itens, filtro]);
  const nIndividuais = useMemo(() => itens.filter(ehIndividual).length, [itens]);

  const trocarFiltro = (v: string) => {
    setFiltro(v);
    setMostrar(PAGINA);
  };

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
              className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground"
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
            {itens.length} solicitaç{itens.length === 1 ? "ão" : "ões"} reprovada
            {itens.length === 1 ? "" : "s"} na validação da planilha. Corrija na fonte e elas
            voltam às telas normais automaticamente.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, cliente, motivo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar pendências"
            className="h-10 pl-9"
          />
        </div>
        <FiltroGrupo
          valor={filtro}
          onChange={trocarFiltro}
          opcoes={[
            { v: FILTRO_INDIVIDUAL, label: "Individuais", count: nIndividuais },
            { v: FILTRO_PARCEIRO, label: "Parceiro", count: itens.length - nIndividuais },
          ]}
        />
        {parceiros.length > 0 ? (
          <FiltroGrupo valor={filtro} onChange={trocarFiltro} opcoes={parceiros} />
        ) : null}
      </div>

      {carregando ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : erro ? (
        <ErroCarregamento onRetry={() => setTentativa((t) => t + 1)} mensagem={erro} />
      ) : (
        <>
          {filtro !== FILTRO_INDIVIDUAL ? (
            <SecaoDivisao
              itens={divisoes}
              contratante={
                filtro.startsWith(PREFIXO_PARCEIRO) ? filtro.slice(PREFIXO_PARCEIRO.length) : null
              }
              onMutate={recarregarSilencioso}
            />
          ) : null}
          {filtro === FILTRO_INDIVIDUAL ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="size-4 shrink-0" />
              Médicos sem franquia (Contratante “INDIVIDUAL”). Não aparecem para os parceiros.
            </p>
          ) : null}
          <DataTable
            colunas={colunas}
            itens={visiveis.slice(0, mostrar)}
            getKey={(p) => `${p.linha_origem}-${p.codigo}`}
            vazio={
              filtro === FILTRO_INDIVIDUAL
                ? { titulo: "Nenhum individual", descricao: "Nenhum médico sem franquia pendente." }
                : {
                    titulo: "Nenhuma pendência",
                    descricao: "Todos os dados da planilha estão consistentes.",
                  }
            }
          />
          {visiveis.length > mostrar ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground tabular-nums">
                {Math.min(mostrar, visiveis.length)} de {visiveis.length}
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
