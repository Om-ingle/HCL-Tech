import { profileUpdateSchema } from "@/lib/validation/schemas";
import { getRole } from "@/lib/catalog";
import { ensureDynamicSkills } from "@/lib/catalog/dynamic";
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
import { guardProfile } from "@/lib/server/auth";
import type { LearnerProfile } from "@/lib/domain/types";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export const GET = route(async (_req, { params }: Ctx) => {
  await guardProfile(params.id);
  const profile = await loadProfile(params.id);
  if (!profile) return fail("Profile not found.", 404);
  const bundle = await buildNavigator(profile);
  return ok(bundle);
});

// Update editable fields, then reroute (regenerate) the roadmap.
export const PATCH = route(async (req, { params }: Ctx) => {
  await guardProfile(params.id);
  const existing = await loadProfile(params.id);
  if (!existing) return fail("Profile not found.", 404);
  const patch = await parseBody(req, profileUpdateSchema.omit({ id: true }).partial());

  // Changing the goal invalidates a confirmed target-skill list from the old
  // goal — otherwise the override keeps the previous route's skills alive.
  const goalChanged =
    (patch.goalText !== undefined && patch.goalText.trim() !== existing.goalText.trim()) ||
    (patch.targetRole !== undefined && patch.targetRole !== existing.targetRole);

  // Register any AI-inferred skills from the patch before gap analysis uses them.
  if (patch.dynamicSkills?.length) ensureDynamicSkills(patch.dynamicSkills);

  const next: LearnerProfile = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.targetRole !== undefined ? { targetRole: normalizeTargetRole(patch.targetRole) } : {}),
    ...(patch.goalText !== undefined ? { goalText: patch.goalText } : {}),
    // A destination change alone (no new goal text) must not leave the old
    // goal's words in goalText — resolveGoal scans it for skill terms.
    ...(patch.targetRole !== undefined &&
    patch.goalText === undefined &&
    patch.targetRole !== existing.targetRole
      ? { goalText: getRole(normalizeTargetRole(patch.targetRole))?.name ?? patch.targetRole }
      : {}),
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
    // Retargeting: an empty array clears the override and returns to inference.
    ...(patch.targetSkillIds !== undefined
      ? {
          preferences: {
            ...existing.preferences,
            targetSkillIds: patch.targetSkillIds.length ? patch.targetSkillIds : undefined,
            // New skills for a new goal — old dynamic skills don't carry over
            // unless the patch explicitly re-supplies them.
            dynamicSkills: patch.dynamicSkills ?? existing.preferences.dynamicSkills,
          },
        }
      : goalChanged
        ? { preferences: { ...existing.preferences, targetSkillIds: undefined, dynamicSkills: undefined } }
        : {}),
    ...(patch.dynamicSkills !== undefined && patch.targetSkillIds === undefined
      ? {
          preferences: {
            ...existing.preferences,
            ...(goalChanged ? { targetSkillIds: undefined } : {}),
            dynamicSkills: patch.dynamicSkills.length ? patch.dynamicSkills : undefined,
          },
        }
      : {}),
  };
  await saveProfile(next);
  await regenerateRoadmap(next);
  await logEvent(next.id, "profile_updated", {});
  const bundle = await buildNavigator(next);
  return ok(bundle);
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  await guardProfile(params.id);
  await deleteProfileCascade(params.id);
  return ok({ deleted: params.id });
});
