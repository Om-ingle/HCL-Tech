import { analyzeSkillGap } from "@/lib/domain/skillGap";
import { recommend } from "@/lib/domain/recommend";
import { discoveryPool, loadProfile, statesMap } from "@/lib/server/service";
import { fail, ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

type Ctx = { params: { profileId: string } };

// Skill-gap analysis (mastered / partial / missing, ordered) + top recommendations.
export const GET = route(async (_req, { params }: Ctx) => {
  const profile = await loadProfile(params.profileId);
  if (!profile) return fail("Profile not found.", 404);

  const gap = analyzeSkillGap(profile);
  const states = await statesMap(params.profileId);
  const completedResourceIds = Array.from(states.entries())
    .filter(([id, s]) => s.status === "completed" && id.startsWith("step-res-"))
    .map(([id]) => id.replace("step-res-", ""));

  const pool = await discoveryPool(profile, gap);
  const recommendations = recommend(profile, gap, {
    limit: 6,
    minScore: 1,
    completedResourceIds,
    pool,
  });
  return ok({ gap, recommendations, discovery: pool.stats });
});
