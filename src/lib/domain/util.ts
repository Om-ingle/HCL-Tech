import { SKILL_BY_ID } from "@/lib/catalog/skills";

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100));

/** All (transitive) prerequisites of the given skills, excluding the inputs. */
export function prerequisiteClosure(skillIds: string[]): string[] {
  const result = new Set<string>();
  const visit = (id: string) => {
    const s = SKILL_BY_ID[id];
    if (!s) return;
    for (const p of s.prerequisites) {
      if (!result.has(p)) {
        result.add(p);
        visit(p);
      }
    }
  };
  for (const id of skillIds) visit(id);
  return Array.from(result);
}

/**
 * Order a set of skill ids so prerequisites (that are also in the set) come
 * first. Tie-broken by tier then name for determinism. Cycle-safe: if a cycle
 * blocks progress, the lowest-tier remaining node is forced next.
 */
export function orderSkills(ids: string[]): string[] {
  const set = new Set(ids);
  const indeg = new Map<string, number>();
  const deps = new Map<string, string[]>();
  for (const id of ids) {
    const prereqs = (SKILL_BY_ID[id]?.prerequisites ?? []).filter((p) => set.has(p));
    deps.set(id, prereqs);
    indeg.set(id, prereqs.length);
  }
  const tier = (id: string) => SKILL_BY_ID[id]?.tier ?? 3;
  const name = (id: string) => SKILL_BY_ID[id]?.name ?? id;
  const placed = new Set<string>();
  const out: string[] = [];

  const readyList = () =>
    ids
      .filter((id) => !placed.has(id) && (indeg.get(id) ?? 0) === 0)
      .sort((a, b) => tier(a) - tier(b) || name(a).localeCompare(name(b)));

  while (out.length < ids.length) {
    let batch = readyList();
    if (batch.length === 0) {
      const remaining = ids
        .filter((id) => !placed.has(id))
        .sort((a, b) => tier(a) - tier(b) || name(a).localeCompare(name(b)));
      if (remaining.length === 0) break;
      batch = [remaining[0]]; // break cycle
    }
    const next = batch[0];
    out.push(next);
    placed.add(next);
    for (const id of ids) {
      if (placed.has(id)) continue;
      if ((deps.get(id) ?? []).includes(next)) {
        indeg.set(id, (indeg.get(id) ?? 1) - 1);
      }
    }
  }
  return out;
}
