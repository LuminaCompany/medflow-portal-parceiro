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
        <Sidebar items={itens} nome={me.nome_exibicao} papel={me.role} collapsed={collapsed} />

        {/* Navegação mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[300px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="border-b border-sidebar-border px-6 py-6">
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
            <nav className="flex flex-col gap-1 p-4">
              {itens.map((item) => {
                const ativo = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-[10px] px-3 text-base transition-colors duration-150",
                      ativo
                        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                        : "font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={1.6} />
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-3 border-t border-sidebar-border pt-3">
                <FeedbackDialog
                  role={me.role}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left text-sm font-medium text-sidebar-foreground/85 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <MessageSquarePlus className="size-5 shrink-0" strokeWidth={1.6} />
                      Dar uma sugestão ou reportar um erro
                    </button>
                  }
                />
                <p className="px-3 pt-2 text-[11px] font-semibold tracking-[0.1em] text-sidebar-foreground/70 uppercase">
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
          <main className="flex-1 px-4 pt-8 pb-16 sm:px-6 lg:px-10 lg:pt-10">
            <div className="mx-auto w-full max-w-[1400px]">
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
      <div className="surface-card flex max-w-md flex-col items-center gap-5 px-8 py-10 text-center">
        <span className="icon-tile">
          <TriangleAlert />
        </span>
        <div>
          <p className="block-title">Não foi possível carregar o portal</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{mensagem}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-12 items-center justify-center rounded-[10px] bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
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
        <img src="/fav.icon.png" alt="Medflow" className="size-12 animate-pulse" />
        <span className="eyebrow">Carregando o portal</span>
      </div>
    </div>
  );
}
