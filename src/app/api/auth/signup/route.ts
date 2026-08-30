import { credentialsSchema } from "@/lib/validation/schemas";
import { authConfigured, claimProfileForUser, supabaseServer } from "@/lib/server/auth";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Email/password signup. When the browser is on a guest route, that route is
// attached to the new account so the learner continues where they left off.
// If the project requires email confirmation, no session exists yet — the
// route stays a guest route and is claimed at first login instead.
export const POST = route(async (req) => {
  if (!authConfigured()) {
    return fail("Accounts are not configured on this server (Supabase auth env vars missing).", 503);
  }
  const { email, password, profileId } = await parseBody(req, credentialsSchema);
  const supabase = supabaseServer()!;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return fail(error.message, 400);

  if (!data.session || !data.user) {
    return ok({ needsConfirmation: true, user: null, claimed: false });
  }

  const claimed = await claimProfileForUser(profileId, data.user.id);
  return ok({
    needsConfirmation: false,
    user: { id: data.user.id, email: data.user.email ?? email },
    claimed,
  });
});
