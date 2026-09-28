"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleCheckBig, Loader2, Plus, Split, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import {
  centavosParaTexto,
  formatData,
  formatDataHora,
  formatMoeda,
  parseMoedaCentavos,
} from "@/lib/format";
import type { DivisaoSalva, Pendencia } from "@/lib/types";

// Espelha `MAX_PARTES` do backend (domain/divisao.py).
const MAX_PARTES = 6;

type Linha = { unidade: string; valor: string };

/**
 * "Divisão por unidade" (feature 014, gestor-only) — seção no topo de Pendências.
 *
 * A A.H. GESTÃO MÉDICA paga PA e PS separados. Quando a antecipação chega na planilha numa
 * linha só, sem Unidade Referência, e a observação não diz quanto é de cada unidade, ela cai
 * aqui: o gestor informa as unidades + valores e, ao salvar, a antecipação passa a aparecer no
 * portal dividida (a planilha não muda). Também lista as divisões já feitas, com "Desfazer".
 */
export function SecaoDivisao({
  itens,
  contratante,
  onMutate,
}: {
  itens: Pendencia[];
  /** Filtro de parceiro ativo na página (null = todos) — recorta a lista de salvas. */
  contratante: string | null;
  onMutate: () => void;
}) {
  const [salvas, setSalvas] = useState<DivisaoSalva[]>([]);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    apiGet<DivisaoSalva[]>("/api/admin/divisoes")
      .then((d) => ativo && setSalvas(d))
      .catch(() => ativo && setSalvas([])); // lista auxiliar: falha não bloqueia a página
    return () => {
      ativo = false;
    };
  }, [versao]);

  const salvasVisiveis = useMemo(
    () => (contratante ? salvas.filter((s) => s.contratante === contratante) : salvas),
    [salvas, contratante]
  );

  const mutou = () => {
    setVersao((v) => v + 1);
    onMutate();
  };

  if (itens.length === 0 && salvasVisiveis.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning ring-1 ring-warning/20">
          <Split className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
            Divisão por unidade
            {itens.length > 0 ? (
              <Badge className="bg-warning/15 text-warning-foreground">
                {itens.length} pendente{itens.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            Antecipações lançadas sem Unidade Referência. Informe quanto é de cada unidade (ex.: PA
            e PS) — ao salvar, elas aparecem no portal divididas. A planilha não é alterada.
          </p>
        </div>
      </div>

      {itens.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {itens.map((p) => (
            <EditorDivisao key={p.codigo_origem ?? p.linha_origem} pendencia={p} onSalvo={mutou} />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success-ink">
          <CircleCheckBig className="size-4" />
          Nenhuma antecipação aguardando divisão.
        </p>
      )}

      {salvasVisiveis.length > 0 ? (
        <DivisoesSalvas itens={salvasVisiveis} onDesfeito={mutou} />
      ) : null}
    </section>
  );
}

function linhasIniciais(p: Pendencia): Linha[] {
  const sugerida = p.divisao?.sugerida ?? [];
  if (sugerida.length === 0) {
    // Nada lido na observação: começa com uma unidade levando a Originação inteira.
    const total = parseMoedaCentavos(p.valor ?? "");
    return [{ unidade: "", valor: total != null ? centavosParaTexto(total) : "" }];
  }
  return sugerida.map((s) => {
    const c = s.valor != null ? parseMoedaCentavos(s.valor) : null;
    return { unidade: s.unidade, valor: c != null ? centavosParaTexto(c) : "" };
  });
}

function EditorDivisao({ pendencia, onSalvo }: { pendencia: Pendencia; onSalvo: () => void }) {
  const opcoes = pendencia.divisao?.unidades_opcoes ?? [];
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasIniciais(pendencia));
  const [salvando, setSalvando] = useState(false);

  const totalCentavos = parseMoedaCentavos(pendencia.valor ?? "") ?? 0;
  const valores = linhas.map((l) => (l.valor.trim() ? parseMoedaCentavos(l.valor) : null));
  const invalidos = linhas.some(
    (l, i) => l.valor.trim() !== "" && (valores[i] == null || valores[i] === 0)
  );
  const vazias = linhas.filter((l) => l.valor.trim() === "").length;
  const soma = valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  const restante = totalCentavos - soma;
  const usadas = linhas.map((l) => l.unidade);
  const unidadesOk = linhas.every((l) => l.unidade) && new Set(usadas).size === usadas.length;
  // Uma linha em branco recebe o restante no envio ("PA 3.800 + PS = o que sobrar").
  const fechaSoma = (vazias === 0 && restante === 0) || (vazias === 1 && restante > 0);
  const podeSalvar = unidadesOk && !invalidos && fechaSoma && !salvando;

  const atualiza = (i: number, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function salvar() {
    if (!pendencia.codigo_origem) return;
    const partes = linhas.map((l, i) => ({
      unidade: l.unidade,
      valor: ((valores[i] ?? restante) / 100).toFixed(2),
    }));
    setSalvando(true);
    try {
      await apiSend("PUT", `/api/admin/divisoes/${encodeURIComponent(pendencia.codigo_origem)}`, {
        partes,
      });
      toast.success(`Divisão salva — ${pendencia.cliente ?? "antecipação"} já aparece no portal.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar a divisão.");
    } finally {
      setSalvando(false);
    }
  }

  let resumo: { texto: string; tom: string };
  if (invalidos) resumo = { texto: "Valor inválido", tom: "text-danger-ink" };
  else if (restante < 0)
    resumo = { texto: `Excede em ${formatMoeda(String(-restante / 100))}`, tom: "text-danger-ink" };
  else if (vazias === 1 && restante > 0)
    resumo = {
      texto: `${formatMoeda(String(restante / 100))} vai para a unidade em branco`,
      tom: "text-muted-foreground",
    };
  else if (restante === 0 && vazias === 0)
    resumo = { texto: "Soma confere", tom: "text-success-ink" };
  else
    resumo = {
      texto: `Faltam ${formatMoeda(String(restante / 100))}`,
      tom: "text-warning-foreground",
    };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{pendencia.cliente ?? "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Linha {pendencia.linha_origem} · Pedido {formatData(pendencia.data_pedido)} · Vence{" "}
            {formatData(pendencia.data_vencimento)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold tabular-nums text-primary">
            {formatMoeda(pendencia.valor)}
          </p>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Originação
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {pendencia.motivos.map((m) => (
          <span
            key={m}
            className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning-foreground"
          >
            {m}
          </span>
        ))}
        <span className="text-muted-foreground">
          Obs.:{" "}
          {pendencia.obs?.trim() ? (
            <span className="text-foreground/80">“{pendencia.obs.trim()}”</span>
          ) : (
            <em>vazia</em>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={l.unidade || undefined}
              onValueChange={(v) => atualiza(i, { unidade: v })}
            >
              <SelectTrigger className="h-9 w-full min-w-0 flex-1" aria-label={`Unidade ${i + 1}`}>
                <SelectValue placeholder="Escolha a unidade" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((u) => (
                  <SelectItem key={u} value={u} disabled={u !== l.unidade && usadas.includes(u)}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-36 shrink-0">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={l.valor}
                onChange={(e) => atualiza(i, { valor: e.target.value })}
                placeholder={vazias === 1 && restante > 0 ? centavosParaTexto(restante) : "0,00"}
                aria-label={`Valor da unidade ${i + 1}`}
                aria-invalid={l.valor.trim() !== "" && (valores[i] == null || valores[i] === 0)}
                className="h-9 pl-8 text-right tabular-nums"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
              disabled={linhas.length === 1}
              aria-label={`Remover unidade ${i + 1}`}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLinhas((ls) => [...ls, { unidade: "", valor: "" }])}
          disabled={linhas.length >= Math.min(MAX_PARTES, opcoes.length)}
        >
          <Plus />
          Adicionar unidade
        </Button>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium tabular-nums ${resumo.tom}`}>{resumo.texto}</span>
          <Button size="sm" onClick={salvar} disabled={!podeSalvar || !pendencia.codigo_origem}>
            {salvando ? <Loader2 className="animate-spin" /> : <CircleCheckBig />}
            Salvar divisão
          </Button>
        </div>
      </div>
    </div>
  );
}

function DivisoesSalvas({ itens, onDesfeito }: { itens: DivisaoSalva[]; onDesfeito: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  async function desfazer(d: DivisaoSalva) {
    setDesfazendo(d.id);
    try {
      await apiSend("DELETE", `/api/admin/divisoes/${d.id}`);
      toast.success("Divisão desfeita — a antecipação voltou para as pendências.");
      setConfirmando(null);
      onDesfeito();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível desfazer.");
    } finally {
      setDesfazendo(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-warning/20 pt-3">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="self-start text-xs font-bold tracking-wide text-muted-foreground uppercase hover:text-foreground"
        aria-expanded={aberto}
      >
        {aberto ? "▾" : "▸"} Divisões já definidas ({itens.length})
      </button>
      {aberto ? (
        <ul className="flex flex-col gap-2">
          {itens.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {d.cliente ?? "—"}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {formatMoeda(d.valor_total)} · cód. CRM {d.codigo_origem}
                  </span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {d.partes.map((p) => (
                    <span
                      key={p.unidade}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-foreground/80"
                    >
                      {p.unidade} · {formatMoeda(p.valor)}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {d.criado_por ?? "—"} em {formatDataHora(d.updated_at ?? d.created_at)}
                </p>
              </div>
              {confirmando === d.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmando(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => desfazer(d)}
                    disabled={desfazendo === d.id}
                  >
                    {desfazendo === d.id ? <Loader2 className="animate-spin" /> : <Undo2 />}
                    Confirmar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setConfirmando(d.id)}
                >
                  <Undo2 />
                  Desfazer
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
