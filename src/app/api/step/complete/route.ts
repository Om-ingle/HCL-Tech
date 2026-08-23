import { stepActionSchema } from "@/lib/validation/schemas";
import { applyCompletion } from "@/lib/domain/adapt";
import {
  buildNavigator,
  latestRoadmap,
  loadProfile,
  logEvent,
  saveProfile,
  setStepStatus,
} from "@/lib/server/service";
import { findStep } from "@/lib/server/assessment";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Mark a step complete → raise its skills to working knowledge (no reroute).
export const POST = route(async (req) => {
  const { profileId, stepId } = await parseBody(req, stepActionSchema);
  const profile = await loadProfile(profileId);
  if (!profile) return fail("Profile not found.", 404);
  const roadmap = await latestRoadmap(profileId);
  if (!roadmap) return fail("No roadmap yet.", 404);
  const found = findStep(roadmap, stepId);
  if (!found) return fail("Step not found in current roadmap.", 404);

  await setStepStatus(profileId, stepId, "completed");
  const adapt = applyCompletion(profile, found.step.skillIds);
  await saveProfile(adapt.profile);
  await logEvent(profileId, "step_completed", { stepId, skillIds: found.step.skillIds });

  const bundle = await buildNavigator(adapt.profile);
  return ok({ changes: adapt.changes, regenerated: false, ...bundle });
});
