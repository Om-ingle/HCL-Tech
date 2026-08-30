import { prisma } from "@/lib/db";
import { profileFromRow, profileToRow, roadmapFromRow } from "@/lib/serialize";
import { analyzeSkillGap, resolveRole } from "@/lib/domain/skillGap";
import { generateRoadmap } from "@/lib/domain/path";
import { buildPool, fetchExternal, type ResourcePool } from "@/lib/discovery";
import { hydrateRoadmap, type NavigatorView, type StepStateLite } from "@/lib/domain/nextAction";
import { getRole, matchRole, skillName } from "@/lib/catalog";
import { dynamicSkillDefsFor, ensureDynamicSkills } from "@/lib/catalog/dynamic";
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
  if (!row) return null;
  const profile = profileFromRow(row);
  // Re-register the profile's AI-inferred skills so they resolve in this
  // process — dynamic skills live in memory and are re-derived from the row.
  ensureDynamicSkills(profile.preferences.dynamicSkills);
  return profile;
}

export async function createProfile(
  input: ProfileInput,
  fixedId?: string,
  ownerId?: string | null,
): Promise<LearnerProfile> {
  // Register AI-inferred skills before anything resolves target ids.
  const dynamic = ensureDynamicSkills(input.dynamicSkills ?? []);
  const dynamicSkills = dynamicSkillDefsFor(dynamic.map((s) => s.id));
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
    preferences: {
      // Target skills confirmed on the goal screen win over inference from here on.
      ...(input.targetSkillIds?.length ? { targetSkillIds: input.targetSkillIds } : {}),
      ...(dynamicSkills.length ? { dynamicSkills } : {}),
    },
    ownerId: ownerId ?? null,
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
  // Shared learner knowledge: skills gained on one route are the learner's,
  // so mirror them into their other routes (max proficiency wins).
  if (profile.ownerId) await propagateKnownSkills(profile);
}

/** Merge `skills` into every other route the owner has (max proficiency). */
async function propagateKnownSkills(profile: LearnerProfile): Promise<void> {
  const siblings = await prisma.learnerProfile.findMany({
    where: { ownerId: profile.ownerId, id: { not: profile.id } },
    select: { id: true, knownSkills: true },
  });
  for (const sib of siblings) {
    let existing: KnownSkill[] = [];
    try {
      existing = JSON.parse(sib.knownSkills || "[]");
    } catch {
      existing = [];
    }
    const merged = mergeKnownSkills(existing, profile.knownSkills);
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      await prisma.learnerProfile.update({
        where: { id: sib.id },
        data: { knownSkills: JSON.stringify(merged) },
      });
    }
  }
}

/** Union of two known-skill lists; the higher proficiency wins per skill. */
export function mergeKnownSkills(a: KnownSkill[], b: KnownSkill[]): KnownSkill[] {
  const map = new Map<string, number>();
  for (const k of [...a, ...b]) {
    map.set(k.skillId, Math.max(map.get(k.skillId) ?? 0, k.proficiency));
  }
  // Stable order: a's order first, then new skills from b.
  const order: string[] = [...a.map((k) => k.skillId), ...b.map((k) => k.skillId)];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of order) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.map((skillId) => ({ skillId, proficiency: map.get(skillId) ?? 0 }));
}

/** The account's accumulated knowledge across all its routes. */
export async function accountKnownSkills(ownerId: string): Promise<KnownSkill[]> {
  const rows = await prisma.learnerProfile.findMany({
    where: { ownerId },
    select: { knownSkills: true },
  });
  let all: KnownSkill[] = [];
  for (const r of rows) {
    try {
      all = mergeKnownSkills(all, JSON.parse(r.knownSkills || "[]"));
    } catch {
      /* skip malformed rows */
    }
  }
  return all;
}

export async function deleteProfileCascade(id: string): Promise<void> {
  await prisma.learnerProfile.delete({ where: { id } }).catch(() => undefined);
}

// ── Resource discovery ────────────────────────────────────────────────────────
/**
 * Build the three-layer resource pool for a learner's target skills. Layer 2
 * (external search) is attempted only when a server-side search key is
 * configured; it fails soft, so this always resolves to a usable pool.
 */
export async function discoveryPool(profile: LearnerProfile, gap: SkillGap): Promise<ResourcePool> {
  const goalTerms = [
    ...(gap.resolution?.unknownTerms ?? []),
    ...(gap.resolution?.matchedTerms ?? []),
  ].slice(0, 4);
  const external = await fetchExternal(gap.orderedSkillIds, profile.experienceLevel, goalTerms);
  return buildPool(gap.orderedSkillIds, { external, level: profile.experienceLevel });
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
  const pool = await discoveryPool(profile, gap);
  const last = await prisma.learningPath.findFirst({
    where: { profileId: profile.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const roadmap = generateRoadmap(profile, gap, version, { pool });
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

// ── Routes (multi-goal: one LearnerProfile per route) ────────────────────────

/** Lightweight card data for a learner's saved routes (homepage "Your routes"). */
export interface RouteSummary {
  profileId: string;
  roleName: string;
  goalText: string;
  progressPct: number;
  currentPhase: string | null;
  nextAction: string | null;
  stepsDone: number;
  stepsTotal: number;
  updatedAt: Date;
}

export async function listRoutesForUser(ownerId: string): Promise<RouteSummary[]> {
  const rows = await prisma.learnerProfile.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  const summaries: RouteSummary[] = [];
  for (const row of rows) {
    const profile = await loadProfile(row.id);
    if (!profile) continue;
    const { view, gap } = await buildNavigator(profile);
    summaries.push({
      profileId: profile.id,
      roleName: gap.roleName,
      goalText: profile.goalText,
      progressPct: view?.progress.overallPct ?? 0,
      currentPhase: view ? view.phases[view.progress.currentPhaseIndex]?.title ?? null : null,
      nextAction: view?.nextAction?.step.title ?? null,
      stepsDone: view?.progress.completedSteps ?? 0,
      stepsTotal: view?.progress.totalSteps ?? 0,
      updatedAt: row.updatedAt,
    });
  }
  return summaries;
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
