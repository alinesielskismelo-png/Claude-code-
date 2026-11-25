/** Arquivos que os artefatos guardam (fotos, PDFs): limites e tipos aceitos. */
export const MAX_ASSET_BYTES = 4 * 1024 * 1024; // limite de corpo das funções da Vercel é ~4,5 MB
export const ASSET_ID_RE = /^[A-Za-z0-9_-]{32}$/;

/** Tipos que o navegador pode mostrar direto; o resto é servido como download. */
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif|bmp)|application\/pdf|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|text\/plain)$/i;

export function safeContentType(t: string | null | undefined): { type: string; inline: boolean } {
  const type = (t || "").split(";")[0].trim().toLowerCase();
  if (INLINE.test(type)) return { type, inline: true };
  return { type: "application/octet-stream", inline: false };
}

export function newAssetId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}
