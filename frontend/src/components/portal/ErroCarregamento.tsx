"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Estado de erro de carregamento (DRY): substitui o skeleton eterno / "vazio" enganoso
// quando um fetch falha. Sempre oferece o próximo passo (tentar de novo) — guideline.
export function ErroCarregamento({
  onRetry,
  mensagem,
  className,
}: {
  onRetry: () => void;
  mensagem?: string | null;
  className?: string;
}) {
  return (
    <Empty className={className ?? "rounded-xl border border-destructive/25 bg-destructive/[0.03]"}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>Não foi possível carregar</EmptyTitle>
        <EmptyDescription>
          {mensagem || "Verifique sua conexão e tente novamente."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw />
          Tentar novamente
        </Button>
      </EmptyContent>
    </Empty>
  );
}
