import { buildNavigator, loadProfile } from "@/lib/server/service";
import { fail, ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

type Ctx = { params: { profileId: string } };

// Latest roadmap + live navigator view (phase locks, progress, next best action).
export const GET = route(async (_req, { params }: Ctx) => {
  const profile = await loadProfile(params.profileId);
  if (!profile) return fail("Profile not found.", 404);
  const bundle = await buildNavigator(profile);
  return ok(bundle);
});
