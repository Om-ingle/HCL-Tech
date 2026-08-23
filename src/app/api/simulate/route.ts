import { simulateSchema } from "@/lib/validation/schemas";
import { applyGoalChange, applyTimeChange } from "@/lib/domain/adapt";
import { getRole } from "@/lib/catalog";
import {
  buildNavigator,
  loadProfile,
  logEvent,
  normalizeTargetRole,
  regenerateRoadmap,
  saveProfile,
} from "@/lib/server/service";
import { fail, ok, parseBody, route } from "@/lib/server/http";
import type { LearnerProfile } from "@/lib/domain/types";

export const runtime = "nodejs";

// "What if" controls: change weekly hours and/or target role, then reroute.
export const POST = route(async (req) => {
  const { profileId, weeklyHours, targetRole } = await parseBody(req, simulateSchema);
  const loaded = await loadProfile(profileId);
  if (!loaded) return fail("Profile not found.", 404);

  let profile: LearnerProfile = loaded;
  const changes: string[] = [];

  if (weeklyHours !== undefined) {
    const a = applyTimeChange(profile, weeklyHours);
    profile = a.profile;
    changes.push(...a.changes);
  }
  if (targetRole !== undefined) {
    const norm = normalizeTargetRole(targetRole);
    const role = getRole(norm);
    const a = applyGoalChange(profile, norm, role?.name ?? targetRole);
    profile = a.profile;
    changes.push(...a.changes);
  }

  await saveProfile(profile);
  await regenerateRoadmap(profile);
  await logEvent(profileId, "simulate", { weeklyHours, targetRole });

  const bundle = await buildNavigator(profile);
  return ok({ changes, regenerated: true, ...bundle });
});
