import { getResource, skillName } from "@/lib/catalog";
import type { KnownSkill, LearnerProfile, Preferences, ResourceType } from "./types";
import { clamp } from "./util";

export interface AdaptResult {
  profile: LearnerProfile;
  changes: string[];
  regenerate: boolean;
}

function raiseSkill(known: KnownSkill[], skillId: string, level: number): KnownSkill[] {
  const out = known.map((k) => ({ ...k }));
  const existing = out.find((k) => k.skillId === skillId);
  if (existing) existing.proficiency = Math.max(existing.proficiency, level);
  else out.push({ skillId, proficiency: level });
  return out;
}

function bumpBias(
  prefs: Preferences,
  patch: {
    difficulty?: number;
    type?: Partial<Record<ResourceType, number>>;
    domain?: { name: string; delta: number };
    dislike?: string;
  },
): Preferences {
  const next: Preferences = {
    difficultyBias: prefs.difficultyBias ?? 0,
    typeBias: { ...(prefs.typeBias ?? {}) },
    domainBias: { ...(prefs.domainBias ?? {}) },
    dislikedResourceIds: [...(prefs.dislikedResourceIds ?? [])],
  };
  if (patch.difficulty) next.difficultyBias = clamp((next.difficultyBias ?? 0) + patch.difficulty, -1, 1);
  if (patch.type) for (const [t, v] of Object.entries(patch.type)) {
    next.typeBias![t as ResourceType] = clamp((next.typeBias![t as ResourceType] ?? 0) + (v ?? 0), -1, 1);
  }
  if (patch.domain) next.domainBias![patch.domain.name] = clamp((next.domainBias![patch.domain.name] ?? 0) + patch.domain.delta, -1, 1);
  if (patch.dislike && !next.dislikedResourceIds!.includes(patch.dislike)) next.dislikedResourceIds!.push(patch.dislike);
  return next;
}

// ── Completion ────────────────────────────────────────────────────────────────
export function applyCompletion(profile: LearnerProfile, skillIds: string[]): AdaptResult {
  let known = profile.knownSkills;
  for (const s of skillIds) known = raiseSkill(known, s, 2);
  const names = skillIds.map(skillName).join(", ");
  return {
    profile: { ...profile, knownSkills: known },
    changes: names ? [`Marked ${names} as working knowledge.`] : ["Step completed."],
    regenerate: false,
  };
}

// ── Assessment ────────────────────────────────────────────────────────────────
export function applyAssessment(
  profile: LearnerProfile,
  skillIds: string[],
  scorePct: number,
): AdaptResult {
  const names = skillIds.map(skillName).join(", ");
  if (scorePct >= 80) {
    let known = profile.knownSkills;
    for (const s of skillIds) known = raiseSkill(known, s, 3);
    return {
      profile: { ...profile, knownSkills: known },
      changes: [
        `Aced the checkpoint (${scorePct}%) — marked ${names} as strong.`,
        `Introductory material on these is now skippable, so your path just got shorter.`,
      ],
      regenerate: true,
    };
  }
  if (scorePct < 50) {
    let known = profile.knownSkills;
    for (const s of skillIds) known = raiseSkill(known, s, 1); // keep in gap as "aware"
    const prefs = bumpBias(profile.preferences, { difficulty: -0.5 });
    return {
      profile: { ...profile, knownSkills: known, preferences: prefs },
      changes: [
        `Scored ${scorePct}% — kept ${names} on the path and shifted to gentler, more foundational resources.`,
        `Re-take the checkpoint when you're ready.`,
      ],
      regenerate: true,
    };
  }
  let known = profile.knownSkills;
  for (const s of skillIds) known = raiseSkill(known, s, 2);
  return {
    profile: { ...profile, knownSkills: known },
    changes: [`Passed the checkpoint (${scorePct}%) — marked ${names} as working knowledge.`],
    regenerate: false,
  };
}

// ── Feedback ─────────────────────────────────────────────────────────────────
export type FeedbackSignal =
  | "too_easy"
  | "too_hard"
  | "too_long"
  | "not_useful"
  | "very_useful"
  | "interested"
  | "need_practice";

export function applyFeedback(
  profile: LearnerProfile,
  signal: FeedbackSignal,
  ctx: { resourceId?: string } = {},
): AdaptResult {
  const resource = ctx.resourceId ? getResource(ctx.resourceId) : undefined;
  const domain = resource?.domain;
  const type = resource?.type;
  let prefs = profile.preferences;
  let changes: string[] = [];

  switch (signal) {
    case "too_easy":
      prefs = bumpBias(prefs, { difficulty: 0.5 });
      changes = ["You found it too easy — nudging future recommendations more challenging."];
      break;
    case "too_hard":
      prefs = bumpBias(prefs, { difficulty: -0.5 });
      changes = ["Too hard — easing difficulty and reinforcing prerequisites first."];
      break;
    case "too_long":
      prefs = bumpBias(prefs, { type: { tutorial: 0.3, documentation: 0.3, course: -0.2, book: -0.3 } });
      changes = ["Prefer shorter resources — favoring bite-sized tutorials and docs."];
      break;
    case "not_useful":
      prefs = bumpBias(prefs, {
        dislike: ctx.resourceId,
        ...(type ? { type: { [type]: -0.3 } as Partial<Record<ResourceType, number>> } : {}),
      });
      changes = [resource ? `Removed “${resource.title}” and similar from your path.` : "Noted — removing similar resources."];
      break;
    case "very_useful":
      prefs = bumpBias(prefs, {
        ...(type ? { type: { [type]: 0.3 } as Partial<Record<ResourceType, number>> } : {}),
        ...(domain ? { domain: { name: domain, delta: 0.3 } } : {}),
      });
      changes = ["Glad it helped — surfacing more resources like it."];
      break;
    case "interested":
      prefs = bumpBias(prefs, domain ? { domain: { name: domain, delta: 0.5 } } : {});
      changes = [domain ? `More ${domain} content coming up.` : "Noted your interest."];
      break;
    case "need_practice":
      prefs = bumpBias(prefs, { difficulty: -0.3, type: { project: 0.3, exercise: 0.3 } });
      changes = ["Adding more hands-on practice before moving on."];
      break;
  }
  return { profile: { ...profile, preferences: prefs }, changes, regenerate: true };
}

// ── Time & goal ──────────────────────────────────────────────────────────────
export function applyTimeChange(profile: LearnerProfile, weeklyHours: number): AdaptResult {
  const hours = clamp(Math.round(weeklyHours), 1, 60);
  return {
    profile: { ...profile, weeklyHours: hours },
    changes: [`Adjusted to ${hours} h/week — recalculating your timeline and phase durations.`],
    regenerate: true,
  };
}

export function applyGoalChange(profile: LearnerProfile, targetRole: string, roleName: string): AdaptResult {
  return {
    profile: { ...profile, targetRole },
    changes: [`New destination: ${roleName}. Rerouting your path from where you are now.`],
    regenerate: true,
  };
}
