"use client";

import { createClient } from "@supabase/supabase-js";

// Client Supabase (browser) — APENAS auth + anon key. Nunca a service role aqui.
// O isolamento de dados é responsabilidade do backend (R-001).
//
// Fallbacks evitam que `createClient` lance durante o build/prerender quando as envs
// públicas ainda não estão presentes (ex.: `next build` sem ambiente). Em produção as
// `NEXT_PUBLIC_*` reais são injetadas no build (Vercel) e substituem estes placeholders.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
