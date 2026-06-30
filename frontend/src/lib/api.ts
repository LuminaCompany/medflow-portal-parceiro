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
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(err.code ?? "error", err.message ?? "Erro inesperado.", res.status);
  }
  return data as T;
}
