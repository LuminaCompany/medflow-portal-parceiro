"use client";

// Diálogo de exportação da aba Solicitações (feature 008). O usuário escolhe o FORMATO, as
// COLUNAS e monta FILTROS próprios (independentes dos chips da página, começam em branco).
// Ao exportar, o backend gera o arquivo já escopado (R-001) — nunca carrega dado de outra
// Contratante. Sem filtro, o botão vira "Exportar tudo".
//
// Formato (feature 010): XLS = planilha com as colunas escolhidas; PDF = Relatório de
// Fechamento no modelo oficial da Medflow, de LAYOUT FIXO — por isso a escolha de colunas
// só vale no XLS e some quando o formato é PDF.

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { AdicionarFiltro } from "@/components/filtros/AdicionarFiltro";
import { ChipFiltro } from "@/components/filtros/ChipFiltro";
import { colunasSolicitacao } from "@/components/colunasSolicitacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiGetBlob } from "@/lib/api";
import { camposDaAba, campoPorId } from "@/lib/filtros/registry";
import { useOpcoesFiltro } from "@/lib/filtros/useOpcoesFiltro";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ABA = "solicitacoes" as const;

type Formato = "xlsx" | "pdf";

export function ExportarSolicitacoes({ papel, gestor }: { papel: Role; gestor: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [formato, setFormato] = useState<Formato>("xlsx");

  // Colunas disponíveis (mesmo modelo da tabela; inclui "Parceiro" só no gestor).
  const colunas = useMemo(() => colunasSolicitacao(gestor), [gestor]);
  // Seleção de colunas — começa com todas marcadas.
  const [cols, setCols] = useState<Set<string>>(() => new Set(colunas.map((c) => c.id)));

  // Filtros próprios do export: id → valor serializado (mesma convenção da URL/API).
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const { porId } = useOpcoesFiltro(ABA);

  const [exportando, setExportando] = useState(false);

  const ativos = useMemo(
    () => Object.entries(filtros).filter(([, v]) => v),
    [filtros],
  );
  const disponiveis = useMemo(
    () => camposDaAba(ABA, papel).filter((c) => !filtros[c.id]),
    [papel, filtros],
  );

  function setFiltro(id: string, valor: string) {
    setFiltros((prev) => {
      const next = { ...prev };
      if (valor) next[id] = valor;
      else delete next[id];
      return next;
    });
  }

  function toggleCol(id: string) {
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todasMarcadas = cols.size === colunas.length;
  function toggleTodas() {
    setCols(todasMarcadas ? new Set() : new Set(colunas.map((c) => c.id)));
  }

  const pdf = formato === "pdf";

  async function exportar() {
    if (!pdf && cols.size === 0) return;
    setExportando(true);
    try {
      const params = new URLSearchParams({ formato });
      // Ordem canônica das colunas (não a de clique) — o backend reordena de qualquer forma.
      // O PDF tem layout fixo (modelo oficial) e ignora `cols`; nem mandamos.
      if (!pdf) {
        params.set("cols", colunas.filter((c) => cols.has(c.id)).map((c) => c.id).join(","));
      }
      ativos.forEach(([id, valor]) => params.set(id, valor));

      const blob = await apiGetBlob(`/api/solicitacoes/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solicitacoes_${new Date().toISOString().slice(0, 10)}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Download />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar solicitações</DialogTitle>
          <DialogDescription>
            Escolha o formato e (opcionalmente) filtros. O arquivo respeita seu escopo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Formato: XLS (colunas escolhíveis) | PDF (modelo fixo de fechamento) */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Formato</span>
            <div className="grid grid-cols-2 gap-2">
              <ToggleFormato
                ativo={!pdf}
                onClick={() => setFormato("xlsx")}
                icon={<FileSpreadsheet className="size-4" />}
                label="XLS"
                hint="Excel / Google Sheets"
              />
              <ToggleFormato
                ativo={pdf}
                onClick={() => setFormato("pdf")}
                icon={<FileText className="size-4" />}
                label="PDF"
                hint="Relatório de Fechamento"
              />
            </div>
          </div>

          {/* Filtros próprios */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filtros</span>
              {ativos.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setFiltros({})}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ativos.map(([id, valor]) => {
                const campo = campoPorId(id);
                if (!campo) return null;
                return (
                  <ChipFiltro
                    key={id}
                    campo={campo}
                    valor={valor}
                    opcao={porId.get(id)}
                    onAplicar={(v) => setFiltro(id, v)}
                    onRemove={() => setFiltro(id, "")}
                  />
                );
              })}
              <AdicionarFiltro
                disponiveis={disponiveis}
                opcoesPorId={porId}
                onAplicar={setFiltro}
              />
              {ativos.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nenhum filtro — exporta tudo do seu escopo.
                </span>
              ) : null}
            </div>
          </div>

          {/* Seleção de colunas — só no XLS: o PDF segue o layout fixo do modelo oficial. */}
          {pdf ? (
            <p className="text-xs text-muted-foreground">
              O PDF sai no modelo oficial da Medflow (colunas fixas), agrupado por unidade e
              com uma página de resumo no fim.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Colunas</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={toggleTodas}
                >
                  {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {colunas.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox checked={cols.has(c.id)} onCheckedChange={() => toggleCol(c.id)} />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancelar
            </Button>
          </DialogClose>
          <Button size="sm" onClick={exportar} disabled={(!pdf && cols.size === 0) || exportando}>
            {exportando
              ? "Exportando…"
              : ativos.length > 0
                ? "Exportar"
                : "Exportar tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleFormato({
  ativo,
  onClick,
  icon,
  label,
  hint,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        ativo ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent/60",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className={cn("text-xs", ativo ? "text-primary/80" : "text-muted-foreground")}>
        {hint}
      </span>
    </button>
  );
}
