import { hydrateRoadmap } from "@/lib/domain/nextAction";
import { profileInputSchema } from "@/lib/validation/schemas";
import { createProfile, logEvent, regenerateRoadmap } from "@/lib/server/service";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Create a profile from a confirmed draft, then generate roadmap v1.
export const POST = route(async (req) => {
  const input = await parseBody(req, profileInputSchema);
  const profile = await createProfile(input);
  const { roadmap, gap } = await regenerateRoadmap(profile);
  await logEvent(profile.id, "profile_created", { targetRole: profile.targetRole });
  const view = hydrateRoadmap(roadmap, new Map());
  return ok({ profile, roadmap, gap, view });
});
