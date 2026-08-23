import { feedbackSchema } from "@/lib/validation/schemas";
import { applyFeedback } from "@/lib/domain/adapt";
import {
  buildNavigator,
  loadProfile,
  logEvent,
  regenerateRoadmap,
  saveProfile,
} from "@/lib/server/service";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Feedback chips tune preferences and reroute future recommendations.
export const POST = route(async (req) => {
  const { profileId, signal, stepId, resourceId } = await parseBody(req, feedbackSchema);
  const profile = await loadProfile(profileId);
  if (!profile) return fail("Profile not found.", 404);

  const adapt = applyFeedback(profile, signal, { resourceId });
  await saveProfile(adapt.profile);
  if (adapt.regenerate) await regenerateRoadmap(adapt.profile);
  await logEvent(profileId, "feedback", { signal, resourceId, stepId });

  const bundle = await buildNavigator(adapt.profile);
  return ok({ changes: adapt.changes, regenerated: adapt.regenerate, ...bundle });
});
