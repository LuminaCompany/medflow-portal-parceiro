"use client";

// Editor de valor de um filtro (spec 002 §3.3). Troca a UI conforme o tipo do campo:
// multi = checklist com busca · range = min/max numérico · date = min/max de datas.
// Mantém estado local e confirma com "Aplicar" (valor vazio => remove o filtro).

import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatData, formatMoeda } from "@/lib/format";
import type { CampoDef } from "@/lib/filtros/registry";
import { rotuloOpcao } from "@/lib/filtros/serialize";
import {
  type Faixa,
  parseFaixa,
  parseMulti,
  serializaFaixa,
  serializaMulti,
} from "@/lib/filtros/serialize";
import type { OpcaoCampo } from "@/lib/filtros/useOpcoesFiltro";

interface Props {
  campo: CampoDef;
  opcao?: OpcaoCampo;
  valorInicial: string;
  onAplicar: (valor: string) => void;
}

export function EditorValor(props: Props) {
  if (props.campo.tipo === "multi") return <EditorMulti {...props} />;
  return <EditorFaixa {...props} />;
}

function Rodape({ onLimpar, podeLimpar }: { onLimpar: () => void; podeLimpar: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-muted-foreground"
        onClick={onLimpar}
        disabled={!podeLimpar}
      >
        Limpar
      </Button>
      <Button type="submit" size="sm" className="h-8">
        Aplicar
      </Button>
    </div>
  );
}

function EditorMulti({ campo, opcao, valorInicial, onAplicar }: Props) {
  const todas = useMemo(() => opcao?.opcoes ?? [], [opcao]);
  const [sel, setSel] = useState<string[]>(() => parseMulti(valorInicial));
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return todas;
    return todas.filter((v) => rotuloOpcao(campo, v).toLowerCase().includes(t));
  }, [todas, busca, campo]);

  function toggle(v: string) {
    setSel((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAplicar(serializaMulti(sel));
      }}
      className="flex flex-col gap-2"
    >
      {todas.length > 8 ? (
        <Input
          autoFocus
          placeholder="Buscar…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8"
        />
      ) : null}
      <div className="-mx-1 max-h-56 overflow-y-auto px-1">
        {filtradas.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">Nenhuma opção.</p>
        ) : (
          filtradas.map((v) => {
            const ativo = sel.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggle(v)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  ativo && "font-medium",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {ativo ? <Check className="size-3" /> : null}
                </span>
                <span className="truncate">{rotuloOpcao(campo, v)}</span>
              </button>
            );
          })
        )}
      </div>
      <Rodape onLimpar={() => setSel([])} podeLimpar={sel.length > 0} />
    </form>
  );
}

function EditorFaixa({ campo, opcao, valorInicial, onAplicar }: Props) {
  const [faixa, setFaixa] = useState<Faixa>(() => parseFaixa(valorInicial));
  const tipoInput = campo.tipo === "date" ? "date" : "number";

  const dica = (lado: "min" | "max"): string => {
    const v = lado === "min" ? opcao?.min : opcao?.max;
    if (v == null) return lado === "min" ? "mín." : "máx.";
    if (campo.formato === "moeda") return formatMoeda(v);
    if (campo.formato === "data") return formatData(v);
    return v;
  };

  const podeLimpar = faixa.min.trim() !== "" || faixa.max.trim() !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAplicar(serializaFaixa(faixa));
      }}
      className="flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          De
          <Input
            type={tipoInput}
            inputMode={tipoInput === "number" ? "decimal" : undefined}
            value={faixa.min}
            placeholder={dica("min")}
            onChange={(e) => setFaixa((f) => ({ ...f, min: e.target.value }))}
            className="h-8"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Até
          <Input
            type={tipoInput}
            inputMode={tipoInput === "number" ? "decimal" : undefined}
            value={faixa.max}
            placeholder={dica("max")}
            onChange={(e) => setFaixa((f) => ({ ...f, max: e.target.value }))}
            className="h-8"
          />
        </label>
      </div>
      <Rodape onLimpar={() => setFaixa({ min: "", max: "" })} podeLimpar={podeLimpar} />
    </form>
  );
}
