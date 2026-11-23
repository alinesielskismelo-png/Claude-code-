import { fold } from "../detect";
import type { Artifact } from "../types";
import type { ListQuery } from "./types";

export function matches(a: Artifact, query: ListQuery = {}): boolean {
  if (query.tag && !a.tags.includes(query.tag.toLowerCase())) return false;
  const q = fold((query.q || "").trim());
  if (!q) return true;
  const hay = fold([a.title, a.description, a.tags.join(" ")].join(" "));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

export function countTags(items: Artifact[]) {
  const m = new Map<string, number>();
  for (const a of items) for (const t of a.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((x, y) => y.count - x.count || x.tag.localeCompare(y.tag));
}
