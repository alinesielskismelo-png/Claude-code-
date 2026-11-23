// Proteções das rotas de IA: mesma origem, tamanho do corpo e limite de pedidos.
// SUPOSIÇÃO: a autenticação da plataforma (login da Aline) é feita pelo esqueleto do app
// (middleware). Quando existir uma função de sessão no servidor, chame-a em checkRequest.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count++;
  return bucket.count <= perMinute;
}

/**
 * Recusa pedidos de outras origens. O iframe do artefato não chama esta rota direto:
 * ele fala com a página pai por postMessage e é a página pai (mesma origem) que chama.
 */
export function checkRequest(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (!host || new URL(origin).host !== host) return "Origem não permitida.";
    } catch {
      return "Origem não permitida.";
    }
  }
  return null;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
