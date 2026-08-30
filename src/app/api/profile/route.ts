import { hydrateRoadmap } from "@/lib/domain/nextAction";
import { profileInputSchema } from "@/lib/validation/schemas";
import {
  accountKnownSkills,
  createProfile,
  logEvent,
  mergeKnownSkills,
  regenerateRoadmap,
} from "@/lib/server/service";
import { currentUser } from "@/lib/server/auth";
import { ok, parseBody, route } from "@/lib/server/http";
import type { KnownSkill } from "@/lib/domain/types";

export const runtime = "nodejs";

// Create a profile from a confirmed draft, then generate roadmap v1.
// For a signed-in learner this is "create a new route": the profile is attached
// to their account and seeded with the knowledge they've already demonstrated
// on other routes, so skills carry over instead of being re-learned.
export const POST = route(async (req) => {
  const input = await parseBody(req, profileInputSchema);
  const user = await currentUser();

  let knownSkills: KnownSkill[] | undefined;
  if (user) {
    // Union of the account's knowledge across its routes with what this draft
    // claims — a learner who knows Python keeps knowing it on every new route.
    const account = await accountKnownSkills(user.id);
    const draft = (input.knownSkills?.length ? input.knownSkills : []).concat(
      (input.knownSkillIds ?? []).map((skillId) => ({ skillId, proficiency: 2 })),
    );
    const merged = mergeKnownSkills(account, draft);
    if (merged.length) knownSkills = merged;
  }

  // knownSkillIds would re-derive proficiency-2 entries and drop the merged
  // proficiencies, so it's removed entirely when the merged list applies.
  const { knownSkillIds: _drop, ...rest } = input;
  const profile = await createProfile(
    knownSkills ? { ...rest, knownSkills, knownSkillIds: [] } : input,
    undefined,
    user?.id ?? null,
  );
  const { roadmap, gap } = await regenerateRoadmap(profile);
  await logEvent(profile.id, "profile_created", { targetRole: profile.targetRole });
  const view = hydrateRoadmap(roadmap, new Map());
  return ok({ profile, roadmap, gap, view });
});
