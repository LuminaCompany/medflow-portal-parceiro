"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, apiSend } from "@/lib/api";

const SENHA_MIN = 6;

/**
 * Tela bloqueante de troca de senha obrigatória no 1º acesso (feature 007). Renderizada
 * NO LUGAR do portal enquanto `me.must_change_password` for true — não há como pular
 * (sem fechar/ESC). Ao concluir, o backend limpa a flag e recarregamos a página para que
 * `GET /api/me` retorne o estado atualizado e o portal apareça.
 */
export function TrocarSenhaObrigatoria({ nome }: { nome: string }) {
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const curta = nova.length > 0 && nova.length < SENHA_MIN;
  const divergem = confirma.length > 0 && nova !== confirma;
  const podeSalvar =
    nova.length >= SENHA_MIN && nova === confirma && !salvando;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < SENHA_MIN) {
      setErro(`A senha deve ter no mínimo ${SENHA_MIN} caracteres.`);
      return;
    }
    if (nova !== confirma) {
      setErro("As senhas não coincidem.");
      return;
    }
    setSalvando(true);
    try {
      await apiSend("POST", "/api/me/trocar-senha", { nova_senha: nova });
      // Flag limpa no backend: recarrega para reavaliar `me` e liberar o portal.
      window.location.reload();
    } catch (err) {
      setSalvando(false);
      setErro(
        err instanceof ApiError ? err.message : "Não foi possível alterar a senha. Tente novamente.",
      );
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Defina uma nova senha</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Olá{nome ? `, ${nome}` : ""}. Por segurança, crie uma nova senha antes de acessar o
            portal. A senha atual deixará de funcionar.
          </p>
        </div>

        <form onSubmit={onSubmit}>
          {erro ? (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive ring-1 ring-destructive/20"
            >
              {erro}
            </div>
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nova-senha">Nova senha</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  aria-invalid={curta || undefined}
                  className="h-10 pl-9"
                />
              </div>
              {curta ? (
                <p className="text-xs font-medium text-destructive">
                  Use ao menos {SENHA_MIN} caracteres.
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="confirma-senha">Confirme a nova senha</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirma-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  aria-invalid={divergem || undefined}
                  className="h-10 pl-9"
                />
              </div>
              {divergem ? (
                <p className="text-xs font-medium text-destructive">As senhas não coincidem.</p>
              ) : null}
            </Field>

            <Button
              type="submit"
              size="lg"
              disabled={!podeSalvar}
              className="mt-1 h-11 w-full text-sm"
            >
              {salvando ? (
                <>
                  <Loader2 className="animate-spin" />
                  Salvando…
                </>
              ) : (
                <>
                  Salvar e entrar
                  <ArrowRight />
                </>
              )}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
