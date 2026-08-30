import { accountKnownSkills, listRoutesForUser } from "@/lib/server/service";
import { currentUser } from "@/lib/server/auth";
import { fail, ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

// The signed-in learner's saved routes (one LearnerProfile per goal), newest
// activity first, plus the account's accumulated known skills so a new route's
// confirmation screen can show what carries over. Guests get a 401 — their
// active route lives in the browser.
export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return fail("Sign in to see your saved routes.", 401);
  const [routes, known] = await Promise.all([
    listRoutesForUser(user.id),
    accountKnownSkills(user.id),
  ]);
  return ok({
    routes,
    user,
    knownSkillIds: known.map((k) => k.skillId),
  });
});
