import { prisma } from "@/lib/db";
import { profileFromRow, profileToRow, roadmapFromRow } from "@/lib/serialize";
import { analyzeSkillGap, resolveRole } from "@/lib/domain/skillGap";
import { generateRoadmap } from "@/lib/domain/path";
import { hydrateRoadmap, type NavigatorView, type StepStateLite } from "@/lib/domain/nextAction";
import { getRole, matchRole, skillName } from "@/lib/catalog";
import type {
  KnownSkill,
  LearnerProfile,
  Roadmap,
  SkillGap,
  StepStatus,
} from "@/lib/domain/types";
import type { ProfileInput } from "@/lib/validation/schemas";
import type { AssistantContext } from "@/lib/ai/prompts";

// ── Profile ───────────────────────────────────────────────────────────────────

/** Normalize a target-role string to a catalog role id where possible. */
export function normalizeTargetRole(raw: string): string {
  if (getRole(raw)) return raw;
  const m = matchRole(raw);
  return m ? m.id : raw;
}

function inputToKnownSkills(input: ProfileInput): KnownSkill[] {
  if (input.knownSkills && input.knownSkills.length) return input.knownSkills;
  return (input.knownSkillIds ?? []).map((skillId) => ({ skillId, proficiency: 2 }));
}

export async function loadProfile(id: string): Promise<LearnerProfile | null> {
  const row = await prisma.learnerProfile.findUnique({ where: { id } });
  return row ? profileFromRow(row) : null;
}

export async function createProfile(input: ProfileInput, fixedId?: string): Promise<LearnerProfile> {
  const profile: LearnerProfile = {
    id: fixedId ?? "",
    name: input.name,
    targetRole: normalizeTargetRole(input.targetRole),
    goalText: input.goalText,
    experienceLevel: input.experienceLevel,
    learningStyle: input.learningStyle,
    weeklyHours: input.weeklyHours,
    timelineWeeks: input.timelineWeeks,
    careerOutcome: input.careerOutcome,
    interests: input.interests,
    knownSkills: inputToKnownSkills(input),
    preferences: {},
  };
  const row = profileToRow(profile);
  const created = fixedId
    ? await prisma.learnerProfile.upsert({
        where: { id: fixedId },
        create: { id: fixedId, ...row },
        update: row,
      })
    : await prisma.learnerProfile.create({ data: row });
  return profileFromRow(created);
}

export async function saveProfile(profile: LearnerProfile): Promise<void> {
  await prisma.learnerProfile.update({ where: { id: profile.id }, data: profileToRow(profile) });
}

export async function deleteProfileCascade(id: string): Promise<void> {
  await prisma.learnerProfile.delete({ where: { id } }).catch(() => undefined);
}

// ── Roadmap ─────────────────────────────────────────────────────────────────
export async function latestRoadmap(profileId: string): Promise<Roadmap | null> {
  const row = await prisma.learningPath.findFirst({
    where: { profileId },
    orderBy: { version: "desc" },
  });
  return row ? roadmapFromRow(row) : null;
}

/** Analyze gap, generate the next roadmap version, and persist it. */
export async function regenerateRoadmap(profile: LearnerProfile): Promise<{ roadmap: Roadmap; gap: SkillGap }> {
  const gap = analyzeSkillGap(profile);
  const last = await prisma.learningPath.findFirst({
    where: { profileId: profile.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const roadmap = generateRoadmap(profile, gap, version);
  await prisma.learningPath.create({
    data: {
      profileId: profile.id,
      version,
      phases: JSON.stringify(roadmap.phases),
      rationale: JSON.stringify(roadmap.rationale),
    },
  });
  return { roadmap, gap };
}

// ── Step state ────────────────────────────────────────────────────────────────
export async function statesMap(profileId: string): Promise<Map<string, StepStateLite>> {
  const rows = await prisma.stepState.findMany({ where: { profileId } });
  const map = new Map<string, StepStateLite>();
  for (const r of rows) map.set(r.stepId, { status: r.status as StepStatus, score: r.score });
  return map;
}

export async function setStepStatus(
  profileId: string,
  stepId: string,
  status: StepStatus,
  score?: number | null,
): Promise<void> {
  await prisma.stepState.upsert({
    where: { profileId_stepId: { profileId, stepId } },
    create: { profileId, stepId, status, score: score ?? null },
    update: { status, score: score ?? null },
  });
}

// ── Navigator (roadmap + live state) ──────────────────────────────────────────
export interface NavigatorBundle {
  profile: LearnerProfile;
  roadmap: Roadmap | null;
  view: NavigatorView | null;
  gap: SkillGap;
}

export async function buildNavigator(profile: LearnerProfile): Promise<NavigatorBundle> {
  const gap = analyzeSkillGap(profile);
  const roadmap = await latestRoadmap(profile.id);
  if (!roadmap) return { profile, roadmap: null, view: null, gap };
  const states = await statesMap(profile.id);
  const view = hydrateRoadmap(roadmap, states);
  return { profile, roadmap, view, gap };
}

// ── Events (streak / history / passport) ──────────────────────────────────────
export async function logEvent(profileId: string, type: string, payload: unknown): Promise<void> {
  await prisma.event
    .create({ data: { profileId, type, payload: JSON.stringify(payload ?? {}) } })
    .catch(() => undefined);
}

export async function recentEvents(profileId: string, take = 50) {
  return prisma.event.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, take });
}

// ── Assistant context ─────────────────────────────────────────────────────────
export async function buildAssistantContext(profileId: string): Promise<AssistantContext | null> {
  const profile = await loadProfile(profileId);
  if (!profile) return null;
  const { view, gap } = await buildNavigator(profile);
  const role = resolveRole(profile);
  const currentPhase = view ? view.phases[view.progress.currentPhaseIndex]?.title ?? null : null;
  const topGaps = gap.orderedSkillIds.slice(0, 4).map(skillName);
  return {
    profileName: profile.name,
    roleName: role?.name ?? gap.roleName,
    experienceLevel: profile.experienceLevel,
    weeklyHours: profile.weeklyHours,
    masteredCount: gap.mastered.length,
    partialCount: gap.partial.length,
    missingCount: gap.missing.length,
    topGaps,
    currentPhase,
    nextActionTitle: view?.nextAction?.step.title ?? null,
    nextActionWhy: view?.nextAction?.reason ?? null,
    overallPct: view?.progress.overallPct ?? 0,
    estimatedWeeksLeft: view?.progress.estimatedWeeksLeft ?? profile.timelineWeeks,
  };
}
