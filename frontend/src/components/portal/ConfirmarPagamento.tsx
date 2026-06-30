"use client";

import { useState } from "react";
import { CircleCheckBig, Clock, HandCoins, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, apiSend } from "@/lib/api";
import { formatData, formatMoeda } from "@/lib/format";
import type { PagamentoAviso, UnidadeVencimentosParceiro } from "@/lib/types";

/**
 * Controle de pagamento por unidade (lado do parceiro), na aba Vencimentos.
 * Renderiza o estado da linha conforme o aviso vigente:
 *  - sem aviso (ou rejeitado) + há pendência → botão "Pagar" (abre modal de confirmação);
 *  - pendente → "Aviso enviado" (abre modal com opção de cancelar);
 *  - verificado → selo "Pagamento verificado" (travado).
 *
 * É montado como IRMÃO do AccordionTrigger (nunca dentro), pra não aninhar <button>.
 */
export function PagarUnidade({
  unidade,
  aviso,
  onMutate,
}: {
  unidade: UnidadeVencimentosParceiro;
  aviso?: PagamentoAviso;
  onMutate: () => void;
}) {
  const status = aviso?.status;

  if (status === "verificado") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success">
        <CircleCheckBig className="size-3.5" />
        Pagamento verificado
      </span>
    );
  }

  if (status === "pendente") {
    return <AvisoEnviado aviso={aviso!} onMutate={onMutate} />;
  }

  // Sem aviso ativo. Nada pendente → nada a fazer.
  if (unidade.tudo_pago) return null;
  return <BotaoPagar unidade={unidade} avisoRejeitado={status === "rejeitado" ? aviso : undefined} onMutate={onMutate} />;
}

function BotaoPagar({
  unidade,
  avisoRejeitado,
  onMutate,
}: {
  unidade: UnidadeVencimentosParceiro;
  avisoRejeitado?: PagamentoAviso;
  onMutate: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const nPendentes = (unidade.solicitacoes ?? []).filter((s) => s.status !== "pago").length;

  async function confirmar() {
    setEnviando(true);
    try {
      await apiSend("POST", "/api/pagamentos/avisos", { unidade: unidade.unidade });
      toast.success("Aviso de pagamento enviado aos gestores.");
      setAberto(false);
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar o aviso.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {avisoRejeitado ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
            title={avisoRejeitado.motivo_rejeicao ?? undefined}
          >
            <TriangleAlert className="size-3" />
            Rejeitado
          </span>
        ) : null}
        <Button size="sm" onClick={() => setAberto(true)}>
          <HandCoins />
          Pagar
        </Button>
      </div>

      <Dialog open={aberto} onOpenChange={(o) => !enviando && setAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Confirmar pagamento</DialogTitle>
            <DialogDescription>
              Avise os gestores que esta unidade foi paga. Isso <strong>não</strong> altera o status
              automaticamente — os gestores verificam e atualizam manualmente.
            </DialogDescription>
          </DialogHeader>

          {/* Valor em ênfase */}
          <div className="rounded-xl border bg-muted/30 p-5 text-center">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Valor da unidade
            </p>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums text-primary">
              {formatMoeda(unidade.total_pendente)}
            </p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Unidade</dt>
            <dd className="text-right font-medium">{unidade.unidade}</dd>
            <dt className="text-muted-foreground">Solicitações</dt>
            <dd className="text-right font-medium tabular-nums">{nPendentes}</dd>
          </dl>

          {avisoRejeitado?.motivo_rejeicao ? (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
              <span className="font-semibold">Aviso anterior rejeitado:</span>{" "}
              {avisoRejeitado.motivo_rejeicao}
            </div>
          ) : null}

          <DialogFooter className="sm:justify-center">
            <Button onClick={confirmar} disabled={enviando} size="lg" className="w-full sm:w-auto">
              {enviando ? <Loader2 className="animate-spin" /> : <HandCoins />}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AvisoEnviado({ aviso, onMutate }: { aviso: PagamentoAviso; onMutate: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  async function cancelar() {
    setCancelando(true);
    try {
      await apiSend("DELETE", `/api/pagamentos/avisos/${aviso.id}`);
      toast.success("Aviso cancelado.");
      setAberto(false);
      onMutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível cancelar o aviso.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/12 px-2.5 py-1 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Clock className="size-3.5" />
        Aviso enviado
      </button>

      <Dialog open={aberto} onOpenChange={(o) => !cancelando && setAberto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Aviso de pagamento enviado</DialogTitle>
            <DialogDescription>
              Aguardando verificação dos gestores. Você pode cancelar enquanto não for verificado.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Unidade</dt>
            <dd className="text-right font-medium">{aviso.unidade}</dd>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="text-right font-medium tabular-nums">{formatMoeda(aviso.valor)}</dd>
            <dt className="text-muted-foreground">Enviado em</dt>
            <dd className="text-right font-medium">{formatData(aviso.created_at?.slice(0, 10))}</dd>
          </dl>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={cancelando}>
              Fechar
            </Button>
            <Button variant="destructive" onClick={cancelar} disabled={cancelando}>
              {cancelando ? <Loader2 className="animate-spin" /> : null}
              Cancelar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
