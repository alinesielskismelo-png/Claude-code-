import type { Store } from "./types";

let cached: Store | null = null;

/** Usa o Supabase quando configurado; senão, arquivos em ./data. */
export async function getStore(): Promise<Store> {
  if (cached) return cached;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { SupabaseStore } = await import("./supabase");
    cached = new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    const { LocalStore } = await import("./local");
    cached = new LocalStore(process.env.DATA_DIR || "data");
  }
  return cached;
}

export async function saveVersion(...args: Parameters<Store["saveVersion"]>) {
  return (await getStore()).saveVersion(...args);
}

export type { Store, ListQuery } from "./types";
