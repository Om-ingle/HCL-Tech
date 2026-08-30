import { SKILLS, SKILL_BY_ID, QUIZ_BY_SKILL, skillName, allDomains } from "@/lib/catalog";
import type { QuizQuestion, Skill } from "./types";
import { prerequisiteClosure } from "./util";

// ── Assessment templates ──────────────────────────────────────────────────────
// Curated quizzes only cover a fraction of the graph, so checkpoints for every
// other skill are generated from GRAPH FACTS. Each template's correct answer is
// derived from the graph itself, which makes the key trustworthy without an LLM
// and without hand-writing a quiz per career.
//
// Generation is deterministic (stable hash, no RNG), so a question id can be
// re-derived at grading time instead of being stored.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministically pick `n` items, striding by hash so picks look varied.
 * The stride may not be coprime with the pool size, so the walk is bounded by
 * one pass and any shortfall is backfilled in order — never unbounded.
 */
function pick<T>(pool: T[], seed: string, n: number): T[] {
  if (pool.length <= n) return pool.slice();
  const start = hash(seed) % pool.length;
  const stride = 1 + (hash(`${seed}#s`) % (pool.length - 1));
  const out: T[] = [];
  const taken = new Set<number>();
  for (let k = 0; k < pool.length && out.length < n; k++) {
    const i = (start + k * stride) % pool.length;
    if (taken.has(i)) continue;
    taken.add(i);
    out.push(pool[i]);
  }
  for (let i = 0; i < pool.length && out.length < n; i++) {
    if (taken.has(i)) continue;
    taken.add(i);
    out.push(pool[i]);
  }
  return out;
}

/** Place the correct answer at a stable position so it isn't always first. */
function assemble(correct: string, distractors: string[], seed: string) {
  const options = distractors.slice();
  const at = hash(seed) % (options.length + 1);
  options.splice(at, 0, correct);
  return { options, answerIndex: at };
}

const clip = (s: string, n = 110) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** Skills that directly build on the given skill. */
function dependents(skillId: string): Skill[] {
  return SKILLS.filter((s) => s.prerequisites.includes(skillId));
}

// Both of these walk the whole graph, and hasAssessment() is called for every
// skill of every roadmap, so results are memoized per process.
const unrelatedCache = new Map<string, Skill[]>();
const questionCache = new Map<string, QuizQuestion[]>();

/** Skills safe to use as wrong answers: unrelated in both directions. */
function unrelatedSkills(skill: Skill): Skill[] {
  const cached = unrelatedCache.get(skill.id);
  if (cached) return cached;
  const banned = new Set<string>([skill.id, ...prerequisiteClosure([skill.id]), ...skill.prerequisites]);
  for (const s of SKILLS) {
    if (prerequisiteClosure([s.id]).includes(skill.id)) banned.add(s.id);
  }
  const out = SKILLS.filter((s) => !banned.has(s.id) && s.domain !== skill.domain);
  unrelatedCache.set(skill.id, out);
  return out;
}

/**
 * Up to four graph-derived questions for a skill. Ids are `gen-<skill>-<n>` and
 * regenerate identically, so grading needs no storage.
 */
export function generatedQuestionsForSkill(skillId: string): QuizQuestion[] {
  const memo = questionCache.get(skillId);
  if (memo) return memo;
  const out = buildQuestions(skillId);
  questionCache.set(skillId, out);
  return out;
}

function buildQuestions(skillId: string): QuizQuestion[] {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return [];
  const out: QuizQuestion[] = [];
  const others = unrelatedSkills(skill);

  // 1 ── Prerequisite awareness.
  if (skill.prerequisites.length) {
    const correct = skillName(skill.prerequisites[0]);
    const distractors = pick(others, `${skillId}-pre`, 3).map((s) => s.name);
    if (distractors.length === 3) {
      const { options, answerIndex } = assemble(correct, distractors, `${skillId}-pre-a`);
      out.push({
        id: `gen-${skillId}-1`,
        skillId,
        question: `Which of these should you already be comfortable with before ${skill.name}?`,
        options,
        answerIndex,
      });
    }
  }

  // 2 ── Conceptual definition.
  {
    const correct = clip(skill.description);
    const distractors = pick(others, `${skillId}-def`, 3).map((s) => clip(s.description));
    if (distractors.length === 3) {
      const { options, answerIndex } = assemble(correct, distractors, `${skillId}-def-a`);
      out.push({
        id: `gen-${skillId}-2`,
        skillId,
        question: `Which statement best describes ${skill.name}?`,
        options,
        answerIndex,
      });
    }
  }

  // 3 ── Where it sits in practice.
  {
    const correct = skill.domain;
    const distractors = pick(
      allDomains().filter((d) => d !== skill.domain),
      `${skillId}-dom`,
      3,
    );
    if (distractors.length === 3) {
      const { options, answerIndex } = assemble(correct, distractors, `${skillId}-dom-a`);
      out.push({
        id: `gen-${skillId}-3`,
        skillId,
        question: `${skill.name} belongs to which area of practice?`,
        options,
        answerIndex,
      });
    }
  }

  // 4 ── What it unlocks next.
  const next = dependents(skillId);
  if (next.length) {
    const correct = next[0].name;
    const distractors = pick(others, `${skillId}-next`, 3).map((s) => s.name);
    if (distractors.length === 3) {
      const { options, answerIndex } = assemble(correct, distractors, `${skillId}-next-a`);
      out.push({
        id: `gen-${skillId}-4`,
        skillId,
        question: `Once ${skill.name} is solid, which of these directly builds on it?`,
        options,
        answerIndex,
      });
    }
  }

  return out;
}

/** Curated questions first, generated ones as backfill. Never empty for a real skill. */
export function questionsForSkill(skillId: string, limit = 2): QuizQuestion[] {
  const curated = QUIZ_BY_SKILL[skillId] ?? [];
  if (curated.length >= limit) return curated.slice(0, limit);
  const generated = generatedQuestionsForSkill(skillId);
  return [...curated, ...generated].slice(0, Math.max(limit, curated.length));
}

/** True when a skill can be assessed at all — with generation, effectively always. */
export function hasAssessment(skillId: string): boolean {
  return questionsForSkill(skillId).length > 0;
}

/** Re-derive a generated question from its id (used by grading). */
export function findGeneratedQuestion(id: string): QuizQuestion | undefined {
  const m = /^gen-(.+)-(\d+)$/.exec(id);
  if (!m) return undefined;
  return generatedQuestionsForSkill(m[1]).find((q) => q.id === id);
}
