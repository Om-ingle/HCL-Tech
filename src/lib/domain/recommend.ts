import { RESOURCES, skillName } from "@/lib/catalog";
import type { ResourcePool } from "@/lib/discovery";
import { sourceQuality } from "@/lib/discovery/search";
import type {
  Difficulty,
  LearnerProfile,
  Recommendation,
  Resource,
  ScoreFactor,
  SkillGap,
} from "./types";

const DIFF_RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export interface RecommendContext {
  profile: LearnerProfile;
  gapMissing: Set<string>;
  gapPartial: Set<string>;
  knownStrong: Set<string>;
  completedResourceIds: Set<string>;
  focusSkillIds?: Set<string>;
  /** Every skill the resolved goal asks for — used for goal-relevance scoring. */
  goalSkillIds?: Set<string>;
  goalLabel?: string;
}

export interface RecommendOptions {
  limit?: number;
  minScore?: number;
  completedResourceIds?: string[];
  focusSkillIds?: string[];
  /** Discovery pool. When present its resources are scored alongside the catalog. */
  pool?: ResourcePool;
}

export function buildContext(
  profile: LearnerProfile,
  gap: SkillGap,
  opts?: RecommendOptions,
): RecommendContext {
  return {
    profile,
    gapMissing: new Set(gap.missing.map((i) => i.skillId)),
    gapPartial: new Set(gap.partial.map((i) => i.skillId)),
    knownStrong: new Set(
      profile.knownSkills.filter((k) => k.proficiency >= 2).map((k) => k.skillId),
    ),
    completedResourceIds: new Set(opts?.completedResourceIds ?? []),
    focusSkillIds: opts?.focusSkillIds ? new Set(opts.focusSkillIds) : undefined,
    goalSkillIds: gap.resolution ? new Set(gap.resolution.targets.map((t) => t.skillId)) : undefined,
    goalLabel: gap.resolution?.label ?? gap.roleName,
  };
}

export interface ScoreResult {
  score: number;
  factors: ScoreFactor[];
  targets: string[];
}

// Deterministic, fully-explainable scoring. Every contribution carries a note
// that the "why" text and the recommendation UI can surface verbatim.
export function scoreResource(resource: Resource, ctx: RecommendContext): ScoreResult {
  const factors: ScoreFactor[] = [];
  const add = (key: string, label: string, contribution: number, note: string) => {
    if (contribution !== 0) factors.push({ key, label, contribution: Math.round(contribution), note });
  };
  const focus = ctx.focusSkillIds;

  const targetsMissing = resource.skills.filter(
    (s) => ctx.gapMissing.has(s) && (!focus || focus.has(s)),
  );
  const targetsPartial = resource.skills.filter(
    (s) => ctx.gapPartial.has(s) && (!focus || focus.has(s)),
  );
  const targets = [...targetsMissing, ...targetsPartial];

  add(
    "gap-missing",
    "Targets a missing skill",
    targetsMissing.length * 28,
    targetsMissing.length ? `Teaches ${targetsMissing.map(skillName).join(", ")}` : "",
  );
  add(
    "gap-partial",
    "Reinforces a partial skill",
    targetsPartial.length * 14,
    targetsPartial.length ? `Strengthens ${targetsPartial.map(skillName).join(", ")}` : "",
  );

  const missingPre = resource.prerequisites.filter((p) => !ctx.knownStrong.has(p));
  if (resource.prerequisites.length) {
    if (missingPre.length === 0) {
      add("prereq", "Prerequisites met", 12, "You already have the prerequisites");
    } else {
      add(
        "prereq",
        "Missing prerequisites",
        -18 * missingPre.length,
        `Best after ${missingPre.map(skillName).join(", ")}`,
      );
    }
  }

  const lvl = DIFF_RANK[ctx.profile.experienceLevel];
  const diff = DIFF_RANK[resource.difficulty];
  const lvlGap = Math.abs(diff - lvl);
  let lvlPts = lvlGap === 0 ? 12 : lvlGap === 1 ? 2 : -8;
  lvlPts += (ctx.profile.preferences.difficultyBias ?? 0) * (diff - 1) * 6;
  add(
    "level",
    "Right level",
    lvlPts,
    lvlGap === 0 ? "Matches your experience level" : lvlGap >= 2 ? "A noticeable difficulty jump" : "",
  );

  const style = ctx.profile.learningStyle;
  const typeBias = ctx.profile.preferences.typeBias?.[resource.type] ?? 0;
  let styleMatch = 0;
  if (style === "video" && (resource.type === "course" || resource.type === "tutorial")) styleMatch = 10;
  else if (style === "reading" && (resource.type === "book" || resource.type === "documentation")) styleMatch = 10;
  else if (style === "project" && (resource.type === "project" || resource.type === "exercise")) styleMatch = 10;
  add(
    "style",
    "Matches your format",
    styleMatch + typeBias * 10,
    styleMatch ? `You prefer ${style}-based learning` : typeBias ? "Based on your feedback" : "",
  );

  const domainBias = ctx.profile.preferences.domainBias?.[resource.domain] ?? 0;
  const interestHit = ctx.profile.interests.some(
    (i) =>
      resource.tags.includes(i.toLowerCase()) ||
      resource.domain.toLowerCase().includes(i.toLowerCase()),
  );
  add(
    "interest",
    "Fits your interests",
    (interestHit ? 8 : 0) + domainBias * 8,
    interestHit ? `Related to your interest in ${resource.domain}` : "",
  );

  if (ctx.completedResourceIds.has(resource.id)) add("done", "Already completed", -1000, "You've completed this");
  const onlyKnown = resource.skills.length > 0 && resource.skills.every((s) => ctx.knownStrong.has(s));
  if (onlyKnown && targets.length === 0) add("known", "Covers known skills", -16, "You already know what this teaches");
  if (ctx.profile.preferences.dislikedResourceIds?.includes(resource.id)) {
    add("disliked", "Marked not useful", -1000, "You marked this not useful");
  }

  // Goal relevance — is this on the skill list the resolved goal actually asks for?
  if (ctx.goalSkillIds?.size) {
    const onGoal = resource.skills.filter((s) => ctx.goalSkillIds!.has(s));
    add(
      "goal",
      "On your goal's skill list",
      Math.min(onGoal.length, 2) * 6,
      onGoal.length ? `Part of what ${ctx.goalLabel ?? "your goal"} requires` : "",
    );
  }

  // Source quality (§6) — official docs, universities, OER and reputable OSS
  // outrank random content farms. Generated modules are a deliberate last resort.
  if (resource.origin === "generated" || !resource.url) {
    add("source", "Generated study module", -6, "A structured module we built because no vetted resource covers this yet");
  } else {
    const q = sourceQuality(resource.url);
    add(
      "source",
      q > 0 ? "Trusted source" : "Unverified source",
      q >= 2 ? 8 : q === 1 ? 4 : q < 0 ? -10 : 0,
      q >= 2
        ? `${resource.provider} is an official or academic source`
        : q < 0
          ? "Lower-quality publisher"
          : "",
    );
  }

  // Duration fit — a 40-hour course is a poor next step at 4h/week.
  const weeks = resource.durationHours / Math.max(ctx.profile.weeklyHours || 6, 3);
  add(
    "duration",
    weeks <= 3 ? "Fits your schedule" : "Long commitment",
    weeks <= 1 ? 6 : weeks <= 3 ? 3 : weeks <= 6 ? 0 : -6,
    weeks <= 1
      ? `About ${Math.max(1, Math.round(resource.durationHours))}h — under a week at your pace`
      : weeks > 6
        ? `Roughly ${Math.round(weeks)} weeks at ${ctx.profile.weeklyHours}h/week`
        : "",
  );

  const score = factors.reduce((s, x) => s + x.contribution, 0);
  return { score, factors, targets };
}

export function buildWhy(factors: ScoreFactor[], targets: string[]): string {
  const positives = factors.filter((x) => x.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  const notes = positives.map((p) => p.note).filter(Boolean);
  const gapLead = targets.length
    ? `Recommended because it closes your gap in ${targets.map(skillName).join(" & ")}.`
    : notes[0]
      ? `${notes[0]}.`
      : "Recommended based on your profile.";
  const extra = notes.find((n) => !gapLead.includes(n));
  return `${gapLead}${extra ? ` ${extra}.` : ""}`.trim();
}

/**
 * Candidates = the discovery pool (canonical + external + generated for the
 * learner's target skills) unioned with the full curated catalog, so open-goal
 * paths gain resources without losing anything the catalog already offered.
 */
function candidates(opts?: RecommendOptions): Resource[] {
  if (!opts?.pool) return RESOURCES;
  const seen = new Set<string>();
  const out: Resource[] = [];
  for (const r of [...opts.pool.all(), ...RESOURCES]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function recommend(
  profile: LearnerProfile,
  gap: SkillGap,
  opts?: RecommendOptions,
): Recommendation[] {
  const ctx = buildContext(profile, gap, opts);
  const scored = candidates(opts)
    .map((r) => {
      const res = scoreResource(r, ctx);
      return {
        resource: r,
        score: Math.round(res.score),
        factors: res.factors,
        why: buildWhy(res.factors, res.targets),
        targetsSkills: res.targets,
      } as Recommendation;
    })
    .filter((r) => r.score > (opts?.minScore ?? 0))
    .sort((a, b) => b.score - a.score);

  return opts?.limit ? scored.slice(0, opts.limit) : scored;
}
