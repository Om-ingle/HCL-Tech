import type { DynamicSkillDef, Skill, SkillTier } from "@/lib/domain/types";
import { SKILLS, SKILL_BY_ID } from "./skills";

// ── Dynamic skills ─────────────────────────────────────────────────────────────
// The curated catalog can't know every goal's domain. When the LLM understands a
// goal like "chemistry in battery", the topics it infers (electrochemistry, redox
// reactions, …) are registered here as full graph citizens: gap analysis,
// prerequisite ordering, quizzes, and the discovery layers (including generated
// study modules) all work on them unchanged. Registration is idempotent and
// never overwrites a curated skill.

const PREFIX = "dyn-";

/** Stable, process-independent id for an LLM-inferred skill name. */
export function dynamicSkillId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${PREFIX}${slug || "topic"}`;
}

export function isDynamicSkillId(id: string): boolean {
  return id.startsWith(PREFIX);
}

function asTier(t: number | undefined): SkillTier {
  const n = Math.round(t ?? 3);
  return (n < 1 ? 1 : n > 5 ? 5 : n) as SkillTier;
}

/**
 * Register one dynamic skill. Returns the skill (existing one if the id is
 * already known) or null when the definition is unusable.
 */
export function registerDynamicSkill(def: DynamicSkillDef): Skill | null {
  const name = def?.name?.trim();
  if (!name || name.length < 2 || name.length > 80 || /^https?:\/\//i.test(name)) return null;
  const id = def.id?.startsWith(PREFIX) ? def.id : dynamicSkillId(name);
  const existing = SKILL_BY_ID[id];
  if (existing) return existing;
  const skill: Skill = {
    id,
    name,
    domain: def.domain?.trim().slice(0, 60) || "Custom",
    tier: asTier(def.tier),
    prerequisites: [],
    description:
      def.description?.trim().slice(0, 400) ||
      `${name}, as required by your goal. Added by AI goal understanding — no curated catalog entry yet.`,
    aliases: [],
  };
  SKILLS.push(skill);
  SKILL_BY_ID[skill.id] = skill;
  return skill;
}

/** Register a list of dynamic skill definitions (e.g. from a stored profile). */
export function ensureDynamicSkills(defs: DynamicSkillDef[] | null | undefined): Skill[] {
  if (!Array.isArray(defs)) return [];
  const out: Skill[] = [];
  for (const d of defs.slice(0, 40)) {
    const s = registerDynamicSkill(d);
    if (s && isDynamicSkillId(s.id)) out.push(s);
  }
  return out;
}

/** Persistable definitions for the dynamic skills among these ids. */
export function dynamicSkillDefsFor(ids: string[]): DynamicSkillDef[] {
  const out: DynamicSkillDef[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isDynamicSkillId(id) || seen.has(id)) continue;
    const s = SKILL_BY_ID[id];
    if (!s) continue;
    seen.add(id);
    out.push({ id: s.id, name: s.name, domain: s.domain, description: s.description, tier: s.tier });
  }
  return out;
}
