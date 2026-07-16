"use client";

// Botão "Exportar" das barras da aba Vencimentos. Clicar abre, deslizando para a direita,
// a escolha do formato: XLS (planilha) ou PDF (Relatório de Fechamento). O arquivo é gerado
// ESCOPADO no backend (R-001): nunca carrega dado de outra Contratante. `dataVencimento`
// ausente = unidade inteira; `contratante` desambigua a unidade na visão do gestor.

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiGetBlob } from "@/lib/api";

type Formato = "xlsx" | "pdf";

export function ExportarLote({
  unidade,
  dataVencimento,
  contratante,
}: {
  unidade: string;
  dataVencimento?: string | null;
  contratante?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [exportando, setExportando] = useState<Formato | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou no Esc — o menu não tem overlay próprio (é inline na barra).
  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function exportar(formato: Formato) {
    setExportando(formato);
    try {
      const params = new URLSearchParams({ unidade, formato });
      if (dataVencimento) params.set("data_vencimento", dataVencimento);
      if (contratante) params.set("contratante", contratante);

      const blob = await apiGetBlob(`/api/vencimentos/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sufixo = dataVencimento ?? new Date().toISOString().slice(0, 10);
      a.download = `vencimentos_${unidade}_${sufixo}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setExportando(null);
    }
  }

  return (
    <div ref={raiz} className="flex items-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => setAberto((v) => !v)}
        disabled={exportando !== null}
        aria-expanded={aberto}
        aria-label={`Exportar ${unidade}`}
        title="Exportar unidade"
      >
        <Download className="size-4" />
      </Button>

      {/* Formatos: deslizam para a direita do botão. `grid-cols-[0fr]` → `[1fr]` anima a
          largura sem hardcodar px (o conteúdo é que define o tamanho final). Fechado, o
          `overflow-hidden` recolhe os botões a zero; `aria-hidden` + `tabIndex=-1` os tiram
          do leitor de tela e da navegação por teclado (não usar `invisible`: sob
          `transition-all` a visibilidade vira no meio da animação e corta o deslize). */}
      <div
        aria-hidden={!aberto}
        className={`grid transition-all duration-200 ease-out ${
          aberto ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center gap-1 pl-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => exportar("xlsx")}
              disabled={exportando !== null}
              tabIndex={aberto ? 0 : -1}
              title="Exportar planilha (Excel / Google Sheets)"
            >
              <FileSpreadsheet className="size-4" />
              XLS
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => exportar("pdf")}
              disabled={exportando !== null}
              tabIndex={aberto ? 0 : -1}
              title="Exportar Relatório de Fechamento (PDF)"
            >
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
