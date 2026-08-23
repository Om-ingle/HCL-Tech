import type { Resource, Role, Skill } from "@/lib/domain/types";
import { SKILLS, SKILL_BY_ID } from "./skills";
import { ROLES, ROLE_BY_ID } from "./roles";
import { RESOURCES, RESOURCE_BY_ID } from "./resources";
import { QUIZ_BY_SKILL, QUIZZES } from "./quizzes";

export * from "./skills";
export * from "./roles";
export * from "./resources";
export * from "./quizzes";

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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Fuzzy goal → role matching used by the deterministic fallback extractor.
 * Returns the role whose name/alias best matches the free text, or null.
 */
export function matchRole(text: string): Role | null {
  const t = ` ${norm(text)} `;
  let best: { role: Role; score: number } | null = null;
  for (const role of ROLES) {
    const candidates = [role.name, ...role.aliases].map(norm);
    for (const c of candidates) {
      if (!c) continue;
      if (t.includes(` ${c} `) || t.includes(c)) {
        const score = c.length; // prefer the most specific (longest) match
        if (!best || score > best.score) best = { role, score };
      }
    }
  }
  return best?.role ?? null;
}

/** Skills whose name appears in free text — used to seed known-skills in fallback. */
export function detectSkills(text: string): string[] {
  const t = norm(text);
  const found = new Set<string>();
  const alias: Record<string, string> = {
    "pandas": "data-wrangling",
    "numpy": "data-wrangling",
    "dataframe": "data-wrangling",
    "machine learning": "ml-fundamentals",
    "ml": "ml-fundamentals",
    "deep learning": "deep-learning",
    "neural network": "deep-learning",
    "nlp": "nlp",
    "statistics": "statistics",
    "stats": "statistics",
    "maths": "math-linear-algebra",
    "mathematics": "math-linear-algebra",
    "linear algebra": "math-linear-algebra",
    "rest api": "software-apis",
    "apis": "software-apis",
    "api": "software-apis",
    "docker": "docker",
    "kubernetes": "kubernetes",
    "k8s": "kubernetes",
    "aws": "cloud-fundamentals",
    "cloud": "cloud-fundamentals",
    "sql": "sql",
    "git": "git",
    "linux": "linux-cli",
    "prompt": "prompt-engineering",
    "rag": "rag",
    "llm": "llm-fundamentals",
    "llms": "llm-fundamentals",
    "embeddings": "embeddings",
    "networking": "networking",
    "security": "security-fundamentals",
  };
  for (const skill of SKILLS) {
    if (t.includes(norm(skill.name))) found.add(skill.id);
  }
  for (const [phrase, id] of Object.entries(alias)) {
    if (t.includes(` ${phrase} `) || t.startsWith(`${phrase} `) || t.endsWith(` ${phrase}`) || t === phrase) {
      if (SKILL_BY_ID[id]) found.add(id);
    }
  }
  return Array.from(found);
}

export const CATALOG_STATS = {
  skills: SKILLS.length,
  roles: ROLES.length,
  resources: RESOURCES.length,
  quizzes: QUIZZES.length,
};

export { QUIZ_BY_SKILL };
