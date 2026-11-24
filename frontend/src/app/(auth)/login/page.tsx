"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, Eye, Loader2, Lock, LogIn, Mail, ShieldCheck, type LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

// Benefícios em par "título curto + uma linha" (voz do site, §18).
const DESTAQUES = [
  { icon: Eye, t: "Clareza", d: "Visão consolidada da sua carteira." },
  { icon: CalendarClock, t: "Organização", d: "Vencimentos e rebate sempre à mão." },
  { icon: ShieldCheck, t: "Segurança", d: "Seus dados, isolados e protegidos." },
];

// Login (Supabase). Roteamento por papel resolve no portal após autenticar (RF-002/004).
// Visual = hero do site Medflow: gradiente horizontal roxo → roxo-claro, título grande com
// ênfase por peso, eyebrow claro; formulário em superfície clara com botão primário 60px.
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
    <main className="grid min-h-svh bg-background lg:grid-cols-[1.35fr_1fr]">
      {/* Painel de marca (desktop) — hero do site */}
      <aside
        className="relative hidden flex-col overflow-hidden px-[clamp(40px,5vw,96px)] py-12 text-white lg:flex"
        style={{ background: "var(--grad-hero)" }}
      >
        <div className="relative h-10 w-[169px]">
          <Image
            src="/logo-roxo.png"
            alt="medflow"
            fill
            priority
            sizes="169px"
            className="object-contain object-left"
          />
        </div>

        <div className="my-auto max-w-[640px] pt-16 pb-10">
          <p className="mb-[18px] flex items-center gap-3 text-[13px] font-semibold tracking-[0.16em] uppercase before:h-[3px] before:w-8 before:rounded-[2px] before:bg-current">
            Portal do Parceiro
          </p>
          <h1 className="text-[clamp(44px,4.2vw,76px)] leading-[1.05] font-normal tracking-[-0.02em] text-white">
            Seus recebíveis,
            <br />
            com transparência.
            <br />
            <strong className="font-bold">Agora!</strong>
          </h1>
          <p className="mt-6 max-w-[520px] text-[clamp(18px,1.3vw,22px)] leading-[1.55] text-white/[0.88]">
            Acompanhe solicitações, valores e vencimentos em um só lugar, com a clareza que a sua
            operação merece.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-4 xl:gap-6">
          {DESTAQUES.map(({ icon: Icon, t, d }) => (
            <li
              key={t}
              className="flex flex-col gap-4 rounded-[24px] border border-white/[0.38] p-5 xl:p-6"
            >
              <span className="grid size-12 place-items-center rounded-2xl border border-white/80">
                <Icon className="size-6" strokeWidth={1.4} />
              </span>
              <span>
                <span className="block text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                  {t}
                </span>
                <span className="mt-1.5 block text-sm leading-snug text-white/[0.88]">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Formulário */}
      <div className="flex flex-col">
        {/* Header roxo (mobile) — igual ao do site */}
        <header className="flex h-[88px] items-center border-b border-white/[0.14] bg-[#7137D6] px-6 lg:hidden">
          <div className="relative h-8 w-[120px]">
            <Image
              src="/logo-roxo.png"
              alt="medflow"
              fill
              priority
              sizes="120px"
              className="object-contain object-left"
            />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-16 sm:px-10">
          <div className="w-full max-w-[440px]">
            <p className="eyebrow mb-[18px]">Acesso restrito</p>
            <h2 className="text-[clamp(40px,3.2vw,56px)] leading-[1.02] font-semibold tracking-[-0.045em] text-heading">
              Acesse o portal
            </h2>
            <p className="mt-4 text-[17px] leading-[1.6] text-muted-foreground">
              Entre com as credenciais enviadas pela equipe Medflow.
            </p>

            {aviso ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-8 rounded-[10px] bg-warning-subtle px-4 py-3 text-sm font-semibold text-warning-foreground"
              >
                {aviso}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-6">
              <Campo id="email" label="E-mail" icon={Mail}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={erro ? true : undefined}
                  className="h-14 pl-12 text-base"
                />
              </Campo>

              <Campo id="senha" label="Senha" icon={Lock}>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? "login-erro" : undefined}
                  className="h-14 pl-12 text-base"
                />
              </Campo>

              {erro ? (
                <p
                  id="login-erro"
                  role="alert"
                  className="-mt-2 rounded-[10px] bg-danger-subtle px-4 py-3 text-sm font-semibold text-danger-ink"
                >
                  {erro}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={carregando}
                className="mt-2 inline-flex h-[60px] w-full items-center justify-center gap-3 rounded-[10px] bg-primary px-7 text-[17px] font-semibold text-primary-foreground transition-colors duration-150 ease-[ease] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:opacity-70"
              >
                {carregando ? (
                  <>
                    <Loader2 className="size-[22px] animate-spin" strokeWidth={1.8} />
                    Entrando…
                  </>
                ) : (
                  <>
                    <LogIn className="size-[22px]" strokeWidth={1.8} />
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function Campo({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-strong">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary"
          strokeWidth={1.6}
        />
        {children}
      </div>
    </div>
  );
}
