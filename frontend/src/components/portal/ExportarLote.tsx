"use client";

// Botão "Exportar" das barras da aba Vencimentos. Baixa o XLSX de UM lote (unidade +
// vencimento) no modelo da planilha-mestre. O arquivo é gerado ESCOPADO no backend (R-001):
// nunca carrega dado de outra Contratante. `dataVencimento` ausente = unidade inteira;
// `contratante` desambigua a unidade na visão do gestor.

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiGetBlob } from "@/lib/api";

export function ExportarLote({
  unidade,
  dataVencimento,
  contratante,
}: {
  unidade: string;
  dataVencimento?: string | null;
  contratante?: string;
}) {
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      const params = new URLSearchParams({ unidade });
      if (dataVencimento) params.set("data_vencimento", dataVencimento);
      if (contratante) params.set("contratante", contratante);

      const blob = await apiGetBlob(`/api/vencimentos/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sufixo = dataVencimento ?? new Date().toISOString().slice(0, 10);
      a.download = `vencimentos_${unidade}_${sufixo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8 shrink-0"
      onClick={exportar}
      disabled={exportando}
      aria-label={`Exportar ${unidade}`}
      title="Exportar unidade"
    >
      <Download className="size-4" />
    </Button>
  );
}
