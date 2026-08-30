import type { Resource, Role, Skill } from "@/lib/domain/types";
import { norm as normText } from "./text";
import { SKILLS, SKILL_BY_ID } from "./skills";
import { ROLES, ROLE_BY_ID } from "./roles";
import { RESOURCES, RESOURCE_BY_ID } from "./resources";
import { QUIZ_BY_SKILL, QUIZZES } from "./quizzes";

export * from "./skills";
export * from "./roles";
export * from "./resources";
export * from "./quizzes";
export * from "./goals";

export function getSkill(id: string): Skill | undefined {
  return SKILL_BY_ID[id];
}

export function getRole(id: string): Role | undefined {
  return ROLE_BY_ID[id];
}

export function getResource(id: string): Resource | undefined {
  return RESOURCE_BY_ID[id];
}

export function skillName(id: string): string {
  return SKILL_BY_ID[id]?.name ?? id;
}

/** Resources that teach a given skill, best (most focused) first. */
export function resourcesTeaching(skillId: string): Resource[] {
  return RESOURCES.filter((r) => r.skills.includes(skillId)).sort(
    (a, b) => a.skills.length - b.skills.length || a.durationHours - b.durationHours,
  );
}

export function allDomains(): string[] {
  return Array.from(new Set(SKILLS.map((s) => s.domain)));
}

export function skillsInDomain(domain: string): Skill[] {
  return SKILLS.filter((s) => s.domain === domain);
}

export const norm = normText;

/**
 * Every searchable phrase → skill id, built from the graph (names + aliases).
 * Longest phrases first so "linear algebra" wins over "algebra"-ish substrings
 * and "high frequency trading" wins over "trading".
 */
export const SKILL_TERMS: { term: string; skillId: string; weight: number }[] = (() => {
  const out: { term: string; skillId: string; weight: number }[] = [];
  for (const s of SKILLS) {
    out.push({ term: norm(s.name), skillId: s.id, weight: 1 });
    out.push({ term: norm(s.id.replace(/-/g, " ")), skillId: s.id, weight: 1 });
    for (const a of s.aliases ?? []) out.push({ term: norm(a), skillId: s.id, weight: 0.9 });
  }
  const seen = new Set<string>();
  return out
    .filter((t) => t.term.length >= 2 && !seen.has(`${t.term}|${t.skillId}`) && seen.add(`${t.term}|${t.skillId}`) !== undefined)
    .sort((a, b) => b.term.length - a.term.length);
})();

/** Domain name → the phrases that imply it (domain names + their skills' words). */
export const DOMAIN_TERMS: { term: string; domain: string }[] = (() => {
  const extra: Record<string, string[]> = {
    Systems: ["systems", "low level", "kernel", "operating system", "os dev"],
    Robotics: ["robotics", "robot", "drone", "autonomous", "mechatronics"],
    Embedded: ["embedded", "firmware", "microcontroller", "iot", "hardware"],
    Graphics: ["graphics", "rendering", "game", "gamedev", "3d", "visual computing"],
    "Quantitative Finance": ["quant", "quantitative", "trading", "finance", "financial", "hedge fund"],
    "Quantum Computing": ["quantum"],
    Security: ["security", "cyber", "hacking", "pentest", "soc"],
    "Machine Learning": ["machine learning", "ml", "deep learning", "ai research"],
    "AI & LLMs": ["llm", "generative ai", "genai", "ai engineer", "agents"],
    MLOps: ["mlops", "ml platform", "ml infrastructure"],
    Data: ["data", "analytics", "analyst", "etl", "warehouse"],
    Cloud: ["cloud", "devops", "sre", "platform", "infrastructure"],
    Software: ["software", "backend", "frontend", "full stack", "fullstack", "web", "mobile"],
    Math: ["math", "maths", "mathematics"],
    Programming: ["programming", "coding", "developer"],
    "Computer Science": ["computer science", "cs", "algorithms"],
  };
  const out: { term: string; domain: string }[] = [];
  for (const d of Array.from(new Set(SKILLS.map((s) => s.domain)))) {
    out.push({ term: norm(d), domain: d });
    for (const t of extra[d] ?? []) out.push({ term: norm(t), domain: d });
  }
  return out.sort((a, b) => b.term.length - a.term.length);
})();

/** Word-boundary-aware containment test on already-normalized text. */
function hasPhrase(paddedText: string, phrase: string): boolean {
  return paddedText.includes(` ${phrase} `);
}

/**
 * Fuzzy goal → role matching used by the deterministic fallback extractor.
 * Returns the role whose name/alias best matches the free text, or null.
 */
export function matchRole(text: string): Role | null {
  return matchRoleDetailed(text)?.role ?? null;
}

/** Same as `matchRole` but reports which phrase matched (for method arbitration). */
export function matchRoleDetailed(text: string): { role: Role; term: string } | null {
  const t = ` ${norm(text)} `;
  let best: { role: Role; term: string; score: number } | null = null;
  for (const role of ROLES) {
    const candidates = [role.name, ...role.aliases];
    for (const raw of candidates) {
      const c = norm(raw);
      if (!c) continue;
      if (t.includes(` ${c} `) || t.includes(c)) {
        const score = c.length; // prefer the most specific (longest) match
        if (!best || score > best.score) best = { role, term: raw, score };
      }
    }
  }
  return best ? { role: best.role, term: best.term } : null;
}

export interface TermMatch {
  skillId: string;
  term: string;
  weight: number;
}

/**
 * All skills whose name or alias appears in free text, strongest match first.
 * Overlapping matches are collapsed so "linear algebra" doesn't also count as
 * a weaker generic hit.
 */
export function matchSkillTerms(text: string): TermMatch[] {
  const padded = ` ${norm(text)} `;
  const hits = new Map<string, TermMatch>();
  const consumed: [number, number][] = [];
  for (const { term, skillId, weight } of SKILL_TERMS) {
    const at = padded.indexOf(` ${term} `);
    if (at < 0) continue;
    const span: [number, number] = [at, at + term.length + 2];
    // Skip a match fully contained in a longer one already accepted.
    if (consumed.some(([s, e]) => span[0] >= s && span[1] <= e)) continue;
    consumed.push(span);
    const score = weight * (1 + term.length / 40);
    const prev = hits.get(skillId);
    if (!prev || score > prev.weight) hits.set(skillId, { skillId, term, weight: score });
  }
  return Array.from(hits.values()).sort((a, b) => b.weight - a.weight);
}

/** Domains implied by free text, most specific first. */
export function matchDomains(text: string): string[] {
  const padded = ` ${norm(text)} `;
  const out: string[] = [];
  for (const { term, domain } of DOMAIN_TERMS) {
    if (out.includes(domain)) continue;
    if (hasPhrase(padded, term)) out.push(domain);
  }
  return out;
}

/** Direct neighbours of a skill: declared `related` plus reverse prerequisites. */
export function relatedSkills(skillId: string): string[] {
  const s = SKILL_BY_ID[skillId];
  if (!s) return [];
  const out = new Set<string>(s.related ?? []);
  for (const other of SKILLS) {
    if (other.prerequisites.includes(skillId)) out.add(other.id);
  }
  out.delete(skillId);
  return Array.from(out).filter((id) => SKILL_BY_ID[id]);
}

/** Skills whose name appears in free text — used to seed known-skills in fallback. */
export function detectSkills(text: string): string[] {
  return matchSkillTerms(text).map((m) => m.skillId);
}

export const CATALOG_STATS = {
  skills: SKILLS.length,
  roles: ROLES.length,
  resources: RESOURCES.length,
  quizzes: QUIZZES.length,
};

export { QUIZ_BY_SKILL };
