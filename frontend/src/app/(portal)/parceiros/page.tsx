"use client";

import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { EditorUnidades } from "@/components/portal/EditorUnidades";
import { ColorPicker } from "@/components/portal/ColorPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiSend } from "@/lib/api";
import { formatData } from "@/lib/format";
import type { ContratanteOpcao, Parceiro, ParceiroLogin, UnidadeInfo } from "@/lib/types";

const COR_PADRAO = "#7C3AED";

export default function ParceirosPage() {
  const [partners, setPartners] = useState<Parceiro[]>([]);
  const [contratantes, setContratantes] = useState<ContratanteOpcao[]>([]);
  const [unidades, setUnidades] = useState<UnidadeInfo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Diálogos / painéis
  const [criando, setCriando] = useState<{ contratante?: string } | null>(null);
  const [editandoConfig, setEditandoConfig] = useState<Parceiro | null>(null);
  const [gerenciando, setGerenciando] = useState<Parceiro | null>(null);

  async function recarregar() {
    setCarregando(true);
    // Fetches independentes: uma falha não pode zerar as outras (e some o dropdown).
    const [p, c, u] = await Promise.allSettled([
      apiGet<Parceiro[]>("/api/admin/partners"),
      apiGet<ContratanteOpcao[]>("/api/admin/contratantes"),
      apiGet<UnidadeInfo[]>("/api/admin/unidades"),
    ]);
    if (p.status === "fulfilled") setPartners(p.value);
    if (c.status === "fulfilled") setContratantes(c.value);
    if (u.status === "fulfilled") setUnidades(u.value);

    const falhou = [p, c, u].some((r) => r.status === "rejected");
    if (falhou) {
      const motivo =
        [p, c, u].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      toast.error(
        `Falha ao carregar dados do servidor${
          motivo ? `: ${(motivo.reason as Error).message}` : "."
        }`,
      );
    }
    setCarregando(false);
  }

  useEffect(() => {
    recarregar();
  }, []);

  // Mantém o painel "Gerenciar logins" sincronizado após recarregar.
  const gerenciandoAtual = useMemo(
    () => (gerenciando ? partners.find((p) => p.contratante === gerenciando.contratante) ?? null : null),
    [gerenciando, partners],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parceiros</h1>
          <p className="mt-1 text-muted-foreground">
            Cada parceiro é uma Contratante: defina a cor, as unidades visíveis e os logins de acesso.
          </p>
        </div>
        <Button onClick={() => setCriando({})} size="lg" className="h-10">
          <UserPlus />
          Adicionar login
        </Button>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">Nenhuma contratante encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifique a conexão com o servidor e se a planilha tem solicitações válidas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {partners.map((p) => (
            <CartaoParceiro
              key={p.contratante}
              parceiro={p}
              totalUnidades={unidades.length}
              onEditarConfig={() => setEditandoConfig(p)}
              onGerenciar={() => setGerenciando(p)}
            />
          ))}
        </ul>
      )}

      {/* Criar login */}
      <DialogCriarLogin
        aberto={!!criando}
        contratanteFixa={criando?.contratante}
        contratantes={contratantes}
        carregando={carregando}
        onFechar={() => setCriando(null)}
        onCriado={recarregar}
      />

      {/* Editar parceiro (cor + unidades) */}
      <DialogConfig
        parceiro={editandoConfig}
        unidades={unidades}
        onFechar={() => setEditandoConfig(null)}
        onSalvo={recarregar}
      />

      {/* Gerenciar logins */}
      <PainelLogins
        parceiro={gerenciandoAtual}
        aberto={!!gerenciando}
        onFechar={() => setGerenciando(null)}
        onAdicionarLogin={(contratante) => {
          setGerenciando(null); // fecha o painel antes de abrir o diálogo (evita modal sobre modal)
          setCriando({ contratante });
        }}
        onMudou={recarregar}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------

function CartaoParceiro({
  parceiro,
  totalUnidades,
  onEditarConfig,
  onGerenciar,
}: {
  parceiro: Parceiro;
  totalUnidades: number;
  onEditarConfig: () => void;
  onGerenciar: () => void;
}) {
  const ativas = parceiro.unidades?.length ?? totalUnidades;
  const restrito = parceiro.unidades !== null;
  const semLogin = parceiro.logins.length === 0;
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
      style={{ borderLeft: `4px solid ${parceiro.cor ?? "#94a3b8"}` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="size-4 shrink-0 rounded-full ring-1 ring-border"
          style={{ background: parceiro.cor ?? "#94a3b8" }}
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{parceiro.contratante || "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={semLogin ? "destructive" : "outline"}>
              <Users className="size-3" />
              {semLogin
                ? "sem login"
                : `${parceiro.logins.length} ${parceiro.logins.length === 1 ? "login" : "logins"}`}
            </Badge>
            <Badge variant="outline">
              {restrito ? `${ativas} de ${totalUnidades} unidades` : "todas as unidades"}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEditarConfig}
          disabled={semLogin}
          title={semLogin ? "Adicione um login a este parceiro antes de configurar." : undefined}
        >
          <SlidersHorizontal />
          Editar parceiro
        </Button>
        <Button size="sm" variant={semLogin ? "default" : "outline"} onClick={onGerenciar}>
          <KeyRound />
          {semLogin ? "Adicionar login" : "Gerenciar logins"}
        </Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------

function DialogCriarLogin({
  aberto,
  contratanteFixa,
  contratantes,
  carregando,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  contratanteFixa?: string;
  contratantes: ContratanteOpcao[];
  carregando: boolean;
  onFechar: () => void;
  onCriado: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [contratante, setContratante] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setEmail("");
      setNome("");
      setSenha("");
      setContratante(contratanteFixa ?? "");
      setErro(null);
    }
  }, [aberto, contratanteFixa]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await apiSend("POST", "/api/admin/parceiros", {
        email,
        nome_exibicao: nome,
        contratante,
        senha_inicial: senha,
      });
      toast.success("Login criado com sucesso.");
      onFechar();
      await onCriado();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">Adicionar login</DialogTitle>
          <DialogDescription>
            {contratanteFixa
              ? `Novo login para ${contratanteFixa}.`
              : "Crie um acesso e vincule-o a uma Contratante."}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="c-contratante">Contratante (parceiro)</FieldLabel>
            {contratanteFixa ? (
              <Input id="c-contratante" value={contratanteFixa} disabled />
            ) : carregando ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando contratantes…
              </div>
            ) : contratantes.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Nenhuma contratante encontrada. Verifique a conexão com o servidor e se a planilha
                tem solicitações válidas.
              </div>
            ) : (
              <Select value={contratante} onValueChange={setContratante}>
                <SelectTrigger id="c-contratante" className="w-full">
                  <SelectValue placeholder="Selecione a contratante" />
                </SelectTrigger>
                <SelectContent>
                  {contratantes.map((c) => (
                    <SelectItem key={c.contratante} value={c.contratante}>
                      {c.contratante} ({c.total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="c-email">E-mail</FieldLabel>
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-nome">Nome de exibição</FieldLabel>
            <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-senha">Senha inicial</FieldLabel>
            <Input
              id="c-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={senha.length > 0 && senha.length < 6}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </Field>
        </FieldGroup>

        {erro ? <ErroBox msg={erro} /> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando || !contratante || !email || !nome.trim() || senha.length < 6}
          >
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Criar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------

function DialogConfig({
  parceiro,
  unidades,
  onFechar,
  onSalvo,
}: {
  parceiro: Parceiro | null;
  unidades: UnidadeInfo[];
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [cor, setCor] = useState(COR_PADRAO);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [rebateAtivo, setRebateAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!parceiro) return;
    setCor(parceiro.cor ?? COR_PADRAO);
    setRebateAtivo(parceiro.rebate_ativo);
    setErro(null);
    if (parceiro.unidades !== null) {
      setSelecionadas(new Set(parceiro.unidades));
    } else {
      // Legado/sem config: default = unidades que coocorrem com a contratante no sheet.
      const padrao = unidades
        .filter((u) => u.sheet_contratantes.includes(parceiro.contratante))
        .map((u) => u.unidade);
      setSelecionadas(new Set(padrao));
    }
  }, [parceiro, unidades]);

  function toggle(unidade: string, ligado: boolean) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (ligado) next.add(unidade);
      else next.delete(unidade);
      return next;
    });
  }

  async function salvar() {
    if (!parceiro) return;
    setErro(null);
    setSalvando(true);
    try {
      await apiSend("PUT", "/api/admin/partners", {
        contratante: parceiro.contratante,
        cor,
        unidades: [...selecionadas],
        rebate_ativo: rebateAtivo,
      });
      toast.success("Parceiro atualizado.");
      onFechar();
      await onSalvo();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!parceiro} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">
            Editar {parceiro?.contratante}
          </DialogTitle>
          <DialogDescription>
            Cor de identificação e quais unidades este parceiro enxerga. Vale para todos os logins dele.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-snug font-medium">Cor do parceiro</span>
            <ColorPicker value={cor} onChange={setCor} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm leading-snug font-medium">Unidades vinculadas</span>
            {parceiro ? (
              <EditorUnidades
                unidades={unidades}
                contratanteAtual={parceiro.contratante}
                selecionadas={selecionadas}
                onToggle={toggle}
                onTodas={() => setSelecionadas(new Set(unidades.map((u) => u.unidade)))}
                onNenhuma={() => setSelecionadas(new Set())}
              />
            ) : null}
          </div>
        </div>

        {/* Serviço de rebate (cashback) — feature 005: no pagamento o parceiro paga
            Originação − Rebate; o gestor verifica o Valor a Pagar. */}
        <label
          htmlFor="cfg-rebate"
          className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Serviço de rebate (cashback)</p>
            <p className="text-xs text-muted-foreground">
              No pagamento, o parceiro paga a Originação <strong>menos</strong> o rebate (cashback).
              O gestor verifica o Valor a Pagar já descontado.
            </p>
          </div>
          <Checkbox
            id="cfg-rebate"
            checked={rebateAtivo}
            onCheckedChange={(v) => setRebateAtivo(v === true)}
            aria-label="Ativar serviço de rebate (cashback)"
            className="size-5 shrink-0"
          />
        </label>

        {erro ? <ErroBox msg={erro} /> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------

function PainelLogins({
  parceiro,
  aberto,
  onFechar,
  onAdicionarLogin,
  onMudou,
}: {
  parceiro: Parceiro | null;
  aberto: boolean;
  onFechar: () => void;
  onAdicionarLogin: (contratante: string) => void;
  onMudou: () => Promise<void>;
}) {
  const [editando, setEditando] = useState<ParceiroLogin | null>(null);
  const [removendo, setRemovendo] = useState<ParceiroLogin | null>(null);

  return (
    <>
      <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-lg font-bold">
              Logins · {parceiro?.contratante}
            </SheetTitle>
            <SheetDescription>
              Acessos vinculados a este parceiro. Todos compartilham a cor e as unidades.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-4">
            {parceiro?.logins.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.nome_exibicao}</p>
                  <p className="truncate text-xs text-muted-foreground">{l.email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    desde {formatData(l.created_at?.slice(0, 10))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditando(l)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setRemovendo(l)}
                    aria-label={`Remover ${l.nome_exibicao}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="mt-1"
              onClick={() => parceiro && onAdicionarLogin(parceiro.contratante)}
            >
              <Plus />
              Adicionar login a este parceiro
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DialogEditarLogin login={editando} onFechar={() => setEditando(null)} onSalvo={onMudou} />
      <DialogRemoverLogin login={removendo} onFechar={() => setRemovendo(null)} onRemovido={onMudou} />
    </>
  );
}

function DialogEditarLogin({
  login,
  onFechar,
  onSalvo,
}: {
  login: ParceiroLogin | null;
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (login) {
      setNome(login.nome_exibicao);
      setSenha("");
      setErro(null);
    }
  }, [login]);

  async function salvar() {
    if (!login) return;
    setErro(null);
    setSalvando(true);
    try {
      await apiSend("PUT", `/api/admin/parceiros/${login.id}`, {
        nome_exibicao: nome,
        senha: senha || undefined,
      });
      toast.success("Login atualizado.");
      onFechar();
      await onSalvo();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!login} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">Editar login</DialogTitle>
          <DialogDescription>{login?.email}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="e-nome">Nome de exibição</FieldLabel>
            <Input id="e-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="e-senha">Nova senha (opcional)</FieldLabel>
            <Input
              id="e-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>
        </FieldGroup>
        {erro ? <ErroBox msg={erro} /> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogRemoverLogin({
  login,
  onFechar,
  onRemovido,
}: {
  login: ParceiroLogin | null;
  onFechar: () => void;
  onRemovido: () => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    if (!login) return;
    setSalvando(true);
    try {
      await apiSend("DELETE", `/api/admin/parceiros/${login.id}`);
      toast.success("Acesso removido.");
      onFechar();
      await onRemovido();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!login} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">Remover acesso</DialogTitle>
          <DialogDescription>
            Remover o acesso de <strong className="text-foreground">{login?.nome_exibicao}</strong> (
            {login?.email})? A sessão dele será invalidada. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Remover acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErroBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive ring-1 ring-destructive/20">
      {msg}
    </div>
  );
}
