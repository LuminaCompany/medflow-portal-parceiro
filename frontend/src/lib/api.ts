"use client";

import { supabase } from "./supabase";

// Wrapper de fetch da API: anexa o JWT Supabase (Authorization: Bearer) e normaliza erros.
// O frontend NUNCA lê a planilha direto — sempre via esta API (isolamento R-001).

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusHttp: number
  ) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(await authHeader()) },
    cache: "no-store",
  });
  return handle<T>(res);
}

/** GET que baixa um arquivo binário (ex.: XLSX). Anexa o JWT como as demais chamadas. */
export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...(await authHeader()) },
    cache: "no-store",
  });
  if (!res.ok) {
    // Corpo de erro é JSON estruturado mesmo quando o sucesso seria binário.
    let code = "error";
    let message = mensagemPadrao(res.status);
    try {
      const data = JSON.parse(await res.text()) as { error?: { code?: string; message?: string } };
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new ApiError(code, message, res.status);
  }
  return res.blob();
}

export async function apiSend<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // Corpo pode NÃO ser JSON: 500 text/plain do Starlette ou HTML de proxy (502/504 do EasyPanel).
  // Parsear sem guarda estourava SyntaxError e o usuário via "Unexpected token I in JSON".
  let data: { error?: { code?: string; message?: string } } | null = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(err.code ?? "error", err.message ?? mensagemPadrao(res.status), res.status);
  }
  return data as T;
}

/** Mensagem pt-BR de fallback quando o backend não devolve um corpo de erro estruturado. */
function mensagemPadrao(status: number): string {
  if (status >= 500) return "O serviço está indisponível no momento. Tente novamente em instantes.";
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem acesso a este recurso.";
  return "Erro inesperado.";
}
