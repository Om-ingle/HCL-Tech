import type { Difficulty, Resource } from "@/lib/domain/types";
import { RESOURCES, resourcesTeaching } from "@/lib/catalog";
import { SKILL_BY_ID } from "@/lib/catalog/skills";
import { canonicalFor } from "./canonical";
import { difficultyForSkill, generateModule, generateProject } from "./generate";
import { buildQueryString, discoverExternal, externalDiscoveryEnabled, type DiscoveryQuery } from "./search";

export * from "./canonical";
export * from "./generate";
export * from "./search";

// ── Resource discovery ────────────────────────────────────────────────────────
// Three layers, cheapest and most trusted first:
//   1. curated internal catalog + canonical per-skill sources  (always present)
//   2. external search results                                 (only if enabled)
//   3. generated study module from graph metadata              (never empty)
//
// The pool is built synchronously so the domain engine stays sync and testable;
// the async layer-2 fetch happens once in the server layer and is injected.

export interface PoolStats {
  catalog: number;
  canonical: number;
  external: number;
  generated: number;
  skillsCovered: number;
  skillsGeneratedOnly: string[];
}

export interface ResourcePool {
  /** Candidate resources for a skill, best-provenance first. Never empty. */
  forSkill(skillId: string): Resource[];
  /** Everything in the pool — used by recommendation scoring. */
  all(): Resource[];
  projectFor(skillIds: string[], difficulty: Difficulty): Resource | null;
  stats: PoolStats;
}

export interface BuildPoolOptions {
  /** Results from `discoverExternal` (layer 2), fetched by the server layer. */
  external?: Resource[];
  /** Learner level — biases which generated difficulty is produced. */
  level?: Difficulty;
}

export function buildPool(skillIds: string[], opts: BuildPoolOptions = {}): ResourcePool {
  const externalBySkill = new Map<string, Resource[]>();
  for (const r of opts.external ?? []) {
    for (const s of r.skills) {
      externalBySkill.set(s, [...(externalBySkill.get(s) ?? []), r]);
    }
  }

  const bySkill = new Map<string, Resource[]>();
  const stats: PoolStats = {
    catalog: 0,
    canonical: 0,
    external: 0,
    generated: 0,
    skillsCovered: 0,
    skillsGeneratedOnly: [],
  };

  for (const skillId of Array.from(new Set(skillIds))) {
    const skill = SKILL_BY_ID[skillId];
    if (!skill) continue;

    const catalog = resourcesTeaching(skillId).map((r) => ({ ...r, origin: r.origin ?? ("catalog" as const) }));
    const canonical = canonicalFor(skillId);
    const external = externalBySkill.get(skillId) ?? [];

    const combined = [...catalog, ...canonical, ...external];
    if (combined.length === 0) {
      const module = generateModule(skillId, opts.level ?? difficultyForSkill(skill));
      if (module) {
        combined.push(module);
        stats.generated++;
        stats.skillsGeneratedOnly.push(skillId);
      }
    }

    stats.catalog += catalog.length;
    stats.canonical += canonical.length;
    stats.external += external.length;
    if (combined.length) stats.skillsCovered++;
    bySkill.set(skillId, dedupe(combined));
  }

  const all = dedupe(Array.from(bySkill.values()).flat());

  return {
    forSkill: (skillId) => bySkill.get(skillId) ?? [],
    all: () => all,
    projectFor: (ids, difficulty) => {
      const authored = RESOURCES.filter(
        (r) =>
          (r.type === "project" || r.type === "exercise") &&
          r.skills.some((s) => ids.includes(s)),
      ).sort((a, b) => a.durationHours - b.durationHours);
      return authored[0] ?? generateProject(ids, difficulty);
    },
    stats,
  };
}

/** Same URL (or same id) twice adds nothing — §5's duplicate detection. */
function dedupe(resources: Resource[]): Resource[] {
  const seenId = new Set<string>();
  const seenUrl = new Set<string>();
  const out: Resource[] = [];
  for (const r of resources) {
    const urlKey = r.url ? r.url.replace(/\/+$/, "").toLowerCase() : "";
    if (seenId.has(r.id)) continue;
    if (urlKey && seenUrl.has(urlKey)) continue;
    seenId.add(r.id);
    if (urlKey) seenUrl.add(urlKey);
    out.push(r);
  }
  return out;
}

/**
 * Which skills warrant an external lookup: the ones our own catalog and the
 * canonical registry don't already cover. Keeps layer 2 cheap and targeted.
 */
export function externalQueriesFor(
  skillIds: string[],
  level: Difficulty,
  goalTerms: string[] = [],
): DiscoveryQuery[] {
  if (!externalDiscoveryEnabled()) return [];
  const out: DiscoveryQuery[] = [];
  for (const skillId of Array.from(new Set(skillIds))) {
    const skill = SKILL_BY_ID[skillId];
    if (!skill) continue;
    if (resourcesTeaching(skillId).length || canonicalFor(skillId).length) continue;
    out.push({
      skillId,
      skillName: skill.name,
      domain: skill.domain,
      difficulty: level,
      goalTerms,
      kind: skill.tier >= 4 ? "documentation" : "learning",
    });
  }
  return out.slice(0, 12); // bound the fan-out; generated modules cover the rest
}

/** Fetch layer 2 for the skills that need it. Resolves to [] when disabled. */
export async function fetchExternal(
  skillIds: string[],
  level: Difficulty,
  goalTerms: string[] = [],
): Promise<Resource[]> {
  const queries = externalQueriesFor(skillIds, level, goalTerms);
  if (!queries.length) return [];
  try {
    return await discoverExternal(queries);
  } catch {
    return []; // discovery is a bonus, never a dependency
  }
}

export { buildQueryString };
