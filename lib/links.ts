/** Tag que liga um artefato do site ao endereço dele no claude.ai (claude.ai/artifact/<id>). */
export function claudeTag(ref: string): string {
  return `claude:${ref.toLowerCase()}`;
}

/** Tag do artefato que abre como página inicial do site. */
export const HOME_TAG = "inicio";

/** Procura no site o artefato com esta tag. */
export async function findByTag(tag: string): Promise<string | null> {
  const r = await fetch(`/api/artifacts?tag=${encodeURIComponent(tag)}`);
  if (!r.ok) return null;
  const j = await r.json();
  return j.artifacts?.[0]?.id ?? null;
}
