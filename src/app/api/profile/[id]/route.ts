import { profileUpdateSchema } from "@/lib/validation/schemas";
import {
  buildNavigator,
  deleteProfileCascade,
  loadProfile,
  logEvent,
  normalizeTargetRole,
  regenerateRoadmap,
  saveProfile,
} from "@/lib/server/service";
import { fail, ok, parseBody, route } from "@/lib/server/http";
import type { LearnerProfile } from "@/lib/domain/types";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export const GET = route(async (_req, { params }: Ctx) => {
  const profile = await loadProfile(params.id);
  if (!profile) return fail("Profile not found.", 404);
  const bundle = await buildNavigator(profile);
  return ok(bundle);
});

// Update editable fields, then reroute (regenerate) the roadmap.
export const PATCH = route(async (req, { params }: Ctx) => {
  const existing = await loadProfile(params.id);
  if (!existing) return fail("Profile not found.", 404);
  const patch = await parseBody(req, profileUpdateSchema.omit({ id: true }).partial());

  const next: LearnerProfile = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.targetRole !== undefined ? { targetRole: normalizeTargetRole(patch.targetRole) } : {}),
    ...(patch.goalText !== undefined ? { goalText: patch.goalText } : {}),
    ...(patch.experienceLevel !== undefined ? { experienceLevel: patch.experienceLevel } : {}),
    ...(patch.learningStyle !== undefined ? { learningStyle: patch.learningStyle } : {}),
    ...(patch.weeklyHours !== undefined ? { weeklyHours: patch.weeklyHours } : {}),
    ...(patch.timelineWeeks !== undefined ? { timelineWeeks: patch.timelineWeeks } : {}),
    ...(patch.careerOutcome !== undefined ? { careerOutcome: patch.careerOutcome } : {}),
    ...(patch.interests !== undefined ? { interests: patch.interests } : {}),
    ...(patch.knownSkills !== undefined
      ? { knownSkills: patch.knownSkills }
      : patch.knownSkillIds !== undefined
        ? { knownSkills: patch.knownSkillIds.map((skillId) => ({ skillId, proficiency: 2 })) }
        : {}),
  };
  await saveProfile(next);
  await regenerateRoadmap(next);
  await logEvent(next.id, "profile_updated", {});
  const bundle = await buildNavigator(next);
  return ok(bundle);
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  await deleteProfileCascade(params.id);
  return ok({ deleted: params.id });
});
