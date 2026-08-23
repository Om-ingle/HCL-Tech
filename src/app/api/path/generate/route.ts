import { z } from "zod";
import { hydrateRoadmap } from "@/lib/domain/nextAction";
import { loadProfile, logEvent, regenerateRoadmap, statesMap } from "@/lib/server/service";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

const bodySchema = z.object({ profileId: z.string() });

// Force a fresh roadmap version (used by "Regenerate path").
export const POST = route(async (req) => {
  const { profileId } = await parseBody(req, bodySchema);
  const profile = await loadProfile(profileId);
  if (!profile) return fail("Profile not found.", 404);
  const { roadmap, gap } = await regenerateRoadmap(profile);
  await logEvent(profileId, "path_regenerated", { version: roadmap.version });
  const view = hydrateRoadmap(roadmap, await statesMap(profileId));
  return ok({ roadmap, gap, view });
});
