"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleDollarSign, ClipboardList, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const DESTAQUES = [
  { icon: ClipboardList, t: "Visão consolidada da sua carteira" },
  { icon: CircleDollarSign, t: "Vencimentos e rebate sempre à mão" },
  { icon: ShieldCheck, t: "Seus dados, isolados e seguros" },
];

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
    <main className="grid min-h-svh bg-white lg:grid-cols-[1.62fr_1fr]">
      {/* Painel de marca (desktop) — gradiente ciano→roxo com ondas do "w" da marca */}
      <aside className="relative hidden overflow-hidden px-16 py-14 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(150deg, oklch(0.72 0.13 205) 0%, oklch(0.55 0.19 285) 38%, oklch(0.5 0.21 295) 68%, oklch(0.44 0.19 300) 100%)",
          }}
        />
        <svg
          aria-hidden
          className="absolute inset-0 size-full"
          viewBox="0 0 1040 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <path
            d="M-60 900 C 120 560, 210 150, 400 132 C 560 118, 585 470, 690 468 C 800 466, 880 250, 1100 120 L 1100 900 Z"
            fill="#ffffff"
            fillOpacity="0.10"
          />
          <path
            d="M-60 900 C 140 700, 300 430, 470 424 C 620 419, 660 660, 760 656 C 870 652, 960 500, 1100 430 L 1100 900 Z"
            fill="#ffffff"
            fillOpacity="0.07"
          />
        </svg>

        <div className="relative h-12 w-[210px]">
          <Image
            src="/logo-roxo.png"
            alt="medflow"
            fill
            priority
            sizes="210px"
            className="object-contain object-left"
          />
        </div>

        <div className="relative mt-auto">
          <h2 className="font-display max-w-xl text-[2.6rem] leading-[1.15] font-extrabold text-white">
            Transparência total na antecipação de recebíveis médicos.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-snug text-white/75">
            Acompanhe solicitações, valores e vencimentos em um só lugar, com a clareza que a sua
            operação merece.
          </p>

          <ul className="mt-12 flex items-center">
            {DESTAQUES.map(({ icon: Icon, t }, i) => (
              <li
                key={t}
                className={`flex items-center gap-2.5 pr-5 text-[13px] leading-tight text-white/90 xl:pr-6 xl:whitespace-nowrap ${
                  i > 0 ? "border-l border-white/20 pl-5 xl:pl-6" : ""
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[oklch(0.5_0.21_295)]">
                  <Icon className="size-4.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Formulário */}
      <div className="relative flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-[26rem]">
          {/* Marca (mobile) — logo branca sobre chip roxo */}
          <div className="mb-8 flex lg:hidden">
            <div
              className="relative inline-flex items-center rounded-xl px-3.5 py-2.5"
              style={{
                background: "linear-gradient(135deg, oklch(0.58 0.2 292), oklch(0.45 0.16 288))",
              }}
            >
              <div className="relative h-8 w-[150px]">
                <Image
                  src="/logo-roxo.png"
                  alt="medflow"
                  fill
                  priority
                  sizes="150px"
                  className="object-contain object-left"
                />
              </div>
            </div>
          </div>

          <h1 className="font-display text-[2.15rem] leading-none font-extrabold tracking-tight text-[oklch(0.5_0.23_296)]">
            Acesse o portal
          </h1>
          <p className="mt-2.5 text-[0.95rem] text-[oklch(0.62_0.13_293)]">
            Portal do Parceiro, entre com suas credenciais.
          </p>

          {aviso ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-lg bg-warning/15 px-4 py-2.5 text-sm font-semibold text-warning-foreground"
            >
              {aviso}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-7">
            {erro ? (
              <div
                role="alert"
                className="mb-6 rounded-lg bg-[oklch(0.68_0.16_28)] px-4 py-3 text-sm font-bold text-[oklch(0.28_0.11_28)]"
              >
                {erro}
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm text-[oklch(0.62_0.13_293)]"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-[oklch(0.5_0.21_295)]" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-lg border-[oklch(0.72_0.13_293)] bg-[oklch(0.93_0.05_294)] pl-11 text-[0.95rem] text-[oklch(0.35_0.12_294)] placeholder:text-[oklch(0.58_0.1_293)] focus-visible:border-[oklch(0.5_0.21_295)] dark:bg-[oklch(0.93_0.05_294)]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="senha"
                  className="mb-1.5 block text-sm text-[oklch(0.62_0.13_293)]"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-[oklch(0.5_0.21_295)]" />
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="h-12 rounded-lg border-[oklch(0.72_0.13_293)] bg-[oklch(0.93_0.05_294)] pl-11 text-[0.95rem] text-[oklch(0.35_0.12_294)] placeholder:text-[oklch(0.58_0.1_293)] focus-visible:border-[oklch(0.5_0.21_295)] dark:bg-[oklch(0.93_0.05_294)]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.47_0.21_295)] text-sm font-bold tracking-[0.08em] text-white uppercase transition-colors hover:bg-[oklch(0.42_0.2_295)] disabled:opacity-70"
              >
                {carregando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
