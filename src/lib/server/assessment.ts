import { QUIZZES } from "@/lib/catalog";
import { findGeneratedQuestion, questionsForSkill } from "@/lib/domain/quizGen";
import type { QuizQuestion, Roadmap, Step } from "@/lib/domain/types";

const QUESTION_BY_ID: Record<string, QuizQuestion> = Object.fromEntries(
  QUIZZES.map((q) => [q.id, q]),
);

/** Curated question, or a graph-generated one re-derived from its id. */
function lookupQuestion(id: string): QuizQuestion | undefined {
  return QUESTION_BY_ID[id] ?? findGeneratedQuestion(id);
}

export interface PublicQuestion {
  id: string;
  skillId: string;
  question: string;
  options: string[];
}

/**
 * Questions for a set of skills, capped, with the answer key stripped.
 * Falls back to graph-generated questions for skills with no curated quiz, so
 * open-goal paths still get real checkpoints.
 */
export function questionsForSkills(skillIds: string[], perSkill = 2): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const s of skillIds) out.push(...questionsForSkill(s, perSkill));
  return out;
}

export function toPublic(qs: QuizQuestion[]): PublicQuestion[] {
  return qs.map(({ id, skillId, question, options }) => ({ id, skillId, question, options }));
}

export interface GradeResult {
  correct: number;
  total: number;
  scorePct: number;
  skillIds: string[];
}

/** Grade submitted answers against the server-side answer key. */
export function gradeAnswers(answers: { questionId: string; choiceIndex: number }[]): GradeResult {
  let correct = 0;
  let total = 0;
  const skills = new Set<string>();
  for (const a of answers) {
    const q = lookupQuestion(a.questionId);
    if (!q) continue;
    total += 1;
    skills.add(q.skillId);
    if (q.answerIndex === a.choiceIndex) correct += 1;
  }
  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, scorePct, skillIds: Array.from(skills) };
}

export function findStep(roadmap: Roadmap, stepId: string): { step: Step; phaseTitle: string } | null {
  for (const phase of roadmap.phases) {
    const step = phase.steps.find((s) => s.id === stepId);
    if (step) return { step, phaseTitle: phase.title };
  }
  return null;
}
