import { stepActionSchema } from "@/lib/validation/schemas";
import { buildNavigator, loadProfile, logEvent, setStepStatus } from "@/lib/server/service";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const { profileId, stepId } = await parseBody(req, stepActionSchema);
  const profile = await loadProfile(profileId);
  if (!profile) return fail("Profile not found.", 404);
  await setStepStatus(profileId, stepId, "skipped");
  await logEvent(profileId, "step_skipped", { stepId });
  const bundle = await buildNavigator(profile);
  return ok({ changes: ["Step skipped."], regenerated: false, ...bundle });
});
