"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  FileText,
  HandCoins,
  LayoutDashboard,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Sidebar, type NavItem } from "@/components/portal/Sidebar";
import { Topbar } from "@/components/portal/Topbar";
import { PageTransition } from "@/components/portal/PageTransition";
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
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, error } = useMe();
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

  // /api/me falhou (token inválido / sem perfil) → volta ao login com aviso de sessão.
  useEffect(() => {
    if (!loading && error) router.replace("/login?expirou=1");
  }, [loading, error, router]);

  const itens = useMemo(() => (me ? NAV.filter((n) => n.roles.includes(me.role)) : []), [me]);
  const titulo = useMemo(
    () => itens.find((n) => pathname.startsWith(n.href))?.label ?? "Portal do Parceiro",
    [itens, pathname],
  );

  if (verificandoSessao || loading || !me) return <TelaCarregando />;

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
              <SheetTitle className="font-display text-lg text-white">
                med<span className="font-extrabold italic">flow</span>
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
                      className={cn("size-[19px]", ativo ? "text-sidebar-primary" : "text-sidebar-foreground/55")}
                    />
                    {item.label}
                  </Link>
                );
              })}
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

function TelaCarregando() {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span
          className="grid size-12 animate-pulse place-items-center rounded-2xl font-display text-2xl font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, oklch(0.58 0.2 292), oklch(0.45 0.16 288))" }}
        >
          <span className="italic">m</span>
        </span>
        <span className="text-sm text-muted-foreground">Carregando o portal…</span>
      </div>
    </div>
  );
}
