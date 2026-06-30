"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { UnidadeInfo } from "@/lib/types";

/**
 * Lista TODAS as unidades do sistema com um toggle por unidade (feature 003). Ligar um
 * toggle vincula a unidade ao parceiro (entra na allowlist). Cada linha mostra um badge do
 * vínculo ATUAL (por config): sem contratante (órfã) · uma contratante · 2+ (aviso forte).
 *
 * `contratanteAtual` é o parceiro em edição — destaca o vínculo a ele e calcula o aviso de
 * conflito considerando que ligar aqui passará a vinculá-lo também.
 */
export function EditorUnidades({
  unidades,
  contratanteAtual,
  selecionadas,
  onToggle,
  onTodas,
  onNenhuma,
}: {
  unidades: UnidadeInfo[];
  contratanteAtual: string;
  selecionadas: Set<string>;
  onToggle: (unidade: string, ligado: boolean) => void;
  onTodas: () => void;
  onNenhuma: () => void;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return unidades;
    return unidades.filter((u) => u.unidade.toLowerCase().includes(q));
  }, [unidades, busca]);

  const ativas = selecionadas.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{ativas}</strong> de {unidades.length} unidades ativas
        </p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onTodas}>
            Marcar todas
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onNenhuma}>
            Limpar
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar unidade…"
          className="h-9 pl-8"
        />
      </div>

      <ScrollArea className="h-72 rounded-lg border">
        <ul className="divide-y">
          {filtradas.map((u) => {
            const ligado = selecionadas.has(u.unidade);
            return (
              <li
                key={u.unidade}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{u.unidade}</span>
                  <BadgeVinculo info={u} contratanteAtual={contratanteAtual} ligado={ligado} />
                </div>
                <Switch
                  checked={ligado}
                  onCheckedChange={(v) => onToggle(u.unidade, v)}
                  aria-label={`Vincular ${u.unidade}`}
                />
              </li>
            );
          })}
          {filtradas.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma unidade encontrada.
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
}

function BadgeVinculo({
  info,
  contratanteAtual,
  ligado,
}: {
  info: UnidadeInfo;
  contratanteAtual: string;
  ligado: boolean;
}) {
  // Vínculo efetivo = config salva + a edição atual (ligar/desligar este parceiro).
  const donos = new Set(info.contratantes);
  if (ligado) donos.add(contratanteAtual);
  else donos.delete(contratanteAtual);
  const lista = [...donos].sort();

  if (lista.length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        sem contratante
      </Badge>
    );
  }
  if (lista.length === 1) {
    const nome = lista[0];
    const eAtual = nome === contratanteAtual;
    return (
      <Badge variant={eAtual ? "secondary" : "outline"} title={nome}>
        <span className="max-w-44 truncate">{nome}</span>
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" title={lista.join(" · ")} className="font-semibold">
      <AlertTriangle className={cn("size-3")} />
      {lista.length} contratantes
    </Badge>
  );
}
