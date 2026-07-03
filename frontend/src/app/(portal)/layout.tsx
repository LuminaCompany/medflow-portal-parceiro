"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  FileText,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  MessageSquarePlus,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Sidebar, type NavItem } from "@/components/portal/Sidebar";
import { FeedbackDialog } from "@/components/portal/FeedbackDialog";
import { TrocarSenhaObrigatoria } from "@/components/portal/TrocarSenhaObrigatoria";
import { Topbar } from "@/components/portal/Topbar";
import { PageTransition } from "@/components/portal/PageTransition";
import { APP_VERSION } from "@/lib/version";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/useMe";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavDef extends NavItem {
  roles: Role[];
}

// Abas por papel. Parceiro nunca vê pistas de Parceiros/Pendências (gestor-only).
const NAV: NavDef[] = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, roles: ["parceiro", "gestor"] },
  { href: "/solicitacoes", label: "Solicitações", icon: FileText, roles: ["parceiro", "gestor"] },
  { href: "/vencimentos", label: "Vencimentos", icon: CalendarClock, roles: ["parceiro", "gestor"] },
  { href: "/pagamentos", label: "Pagamentos", icon: HandCoins, roles: ["gestor"] },
  { href: "/parceiros", label: "Parceiros", icon: Users, roles: ["gestor"] },
  { href: "/pendencias", label: "Pendências", icon: TriangleAlert, roles: ["gestor"] },
  { href: "/feedbacks", label: "Feedbacks", icon: MessageSquare, roles: ["gestor"] },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, error, naoAutenticado } = useMe();
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Preferência de colapso persistida.
  useEffect(() => {
    setCollapsed(localStorage.getItem("mf-sidebar-collapsed") === "1");
  }, []);
  function toggleCollapse() {
    setCollapsed((v) => {
      localStorage.setItem("mf-sidebar-collapsed", v ? "0" : "1");
      return !v;
    });
  }

  // Guarda de rota: sem sessão Supabase → login.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setVerificandoSessao(false);
    });
  }, [router]);

  // Só desloga quando o backend RECUSA a identidade (401). Falha transitória (500/rede) mostra
  // tela de erro com "tentar de novo" — não expulsa quem tem sessão Supabase válida.
  useEffect(() => {
    if (!loading && naoAutenticado) router.replace("/login?expirou=1");
  }, [loading, naoAutenticado, router]);

  const itens = useMemo(() => (me ? NAV.filter((n) => n.roles.includes(me.role)) : []), [me]);
  const titulo = useMemo(
    () => itens.find((n) => pathname.startsWith(n.href))?.label ?? "Portal do Parceiro",
    [itens, pathname],
  );

  if (verificandoSessao || loading) return <TelaCarregando />;
  // Erro transitório (backend 5xx / rede) com sessão válida → tela de erro, não logout nem hang.
  if (error && !naoAutenticado) return <TelaErro mensagem={error} />;
  if (!me) return <TelaCarregando />; // naoAutenticado: redirecionando para /login
  // Troca de senha obrigatória no 1º acesso (feature 007): bloqueia o portal (só gestor).
  if (me.role === "gestor" && me.must_change_password)
    return <TrocarSenhaObrigatoria nome={me.nome_exibicao} />;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex min-h-svh bg-background">
        {/* Atmosfera de fundo do conteúdo — brilho roxo discreto */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            background:
              "radial-gradient(80% 50% at 80% -5%, oklch(0.62 0.18 292 / 0.06), transparent 60%)",
          }}
        />

        <Sidebar items={itens} nome={me.nome_exibicao} papel={me.role} collapsed={collapsed} />

        {/* Navegação mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-sidebar-border/60 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="border-b border-sidebar-border/50">
              <SheetTitle asChild>
                <div className="relative h-8 w-[150px]">
                  <Image
                    src="/logo-roxo.png"
                    alt="medflow"
                    fill
                    sizes="150px"
                    className="object-contain object-left"
                  />
                </div>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {itens.map((item) => {
                const ativo = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      ativo
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Icon
                      className={cn("size-[19px]", ativo ? "text-sidebar-primary" : "text-sidebar-foreground/75")}
                    />
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-2 border-t border-sidebar-border/50 pt-3">
                <FeedbackDialog
                  role={me.role}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60"
                    >
                      <MessageSquarePlus className="size-[19px] shrink-0" />
                      Dar uma sugestão ou reportar um erro
                    </button>
                  }
                />
                <p className="px-3 pt-2 text-[11px] font-medium tracking-wide text-sidebar-foreground/50">
                  Versão {APP_VERSION}
                </p>
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            titulo={titulo}
            onToggleCollapse={toggleCollapse}
            onOpenMobile={() => setMobileOpen(true)}
            gestor={me.role === "gestor"}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1240px]">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  );
}

function TelaErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <TriangleAlert className="size-10 text-warning" />
        <div>
          <p className="font-display text-lg font-bold">Não foi possível carregar o portal</p>
          <p className="mt-1 text-sm text-muted-foreground">{mensagem}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

function TelaCarregando() {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fav.icon.png" alt="MedFlow" className="size-12 animate-pulse" />
        <span className="text-sm text-muted-foreground">Carregando o portal…</span>
      </div>
    </div>
  );
}
