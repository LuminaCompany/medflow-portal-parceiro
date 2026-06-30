import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fonte única de ambiente: `.env` na raiz do repositório (um nível acima de `frontend/`).
// Carregamos manualmente para o process.env antes do build/dev, de modo que o Next inline
// as variáveis NEXT_PUBLIC_* a partir desse arquivo único (sem duplicar em frontend/.env.local).
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
if (existsSync(rootEnv)) {
  for (const linha of readFileSync(rootEnv, "utf-8").split(/\r?\n/)) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const chave = trimmed.slice(0, idx).trim();
    const valor = trimmed.slice(idx + 1).trim();
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
