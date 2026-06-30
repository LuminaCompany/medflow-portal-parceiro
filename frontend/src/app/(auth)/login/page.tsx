"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

// Login (Supabase). Roteamento por papel resolve no portal após autenticar (RF-002/004).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Sessão expirada/inválida (redirecionado do portal): explica por que voltou ao login.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expirou") === "1") {
      setAviso("Sua sessão expirou. Entre novamente para continuar.");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Painel de marca (desktop) */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 60% at 15% 0%, oklch(0.6 0.2 292 / 0.35), transparent 60%), radial-gradient(80% 60% at 100% 100%, oklch(0.55 0.18 300 / 0.28), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="animate-glow pointer-events-none absolute top-1/3 -left-20 size-72 rounded-full blur-3xl"
          style={{ background: "oklch(0.62 0.2 295 / 0.25)" }}
        />

        <div className="relative flex items-center gap-3">
          <span
            className="grid size-11 place-items-center rounded-xl font-display text-xl font-extrabold text-white ring-1 ring-white/15"
            style={{ background: "linear-gradient(135deg, oklch(0.58 0.2 292), oklch(0.45 0.16 288))" }}
          >
            <span className="italic">m</span>
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-white">
            med<span className="font-extrabold italic">flow</span>
          </span>
        </div>

        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-3xl leading-tight font-bold text-white">
            Transparência total na antecipação de recebíveis médicos.
          </h2>
          <p className="mt-4 text-sidebar-foreground/70">
            Acompanhe solicitações, valores e vencimentos em um só lugar — com a clareza que a sua
            operação merece.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {[
              { icon: TrendingUp, t: "Visão consolidada da sua carteira" },
              { icon: Wallet, t: "Vencimentos e rebate sempre à mão" },
              { icon: ShieldCheck, t: "Seus dados, isolados e seguros" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3 text-sidebar-foreground/85">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-sidebar-primary-foreground ring-1 ring-white/10">
                  <Icon className="size-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Formulário */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Marca (mobile) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span
              className="grid size-10 place-items-center rounded-xl font-display text-lg font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, oklch(0.58 0.2 292), oklch(0.45 0.16 288))" }}
            >
              <span className="italic">m</span>
            </span>
            <span className="font-display text-xl font-bold tracking-tight">
              med<span className="font-extrabold italic">flow</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Acesse o portal</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Portal do Parceiro — entre com suas credenciais.
          </p>

          {aviso ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-lg bg-warning/10 px-3.5 py-2.5 text-sm font-medium text-warning ring-1 ring-warning/20"
            >
              {aviso}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8">
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
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="senha">Senha</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
              </Field>

              <Button type="submit" size="lg" disabled={carregando} className="mt-1 h-11 w-full text-sm">
                {carregando ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight />
                  </>
                )}
              </Button>
            </FieldGroup>
          </form>
        </div>
      </div>
    </main>
  );
}
