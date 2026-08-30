import { credentialsSchema } from "@/lib/validation/schemas";
import { authConfigured, claimProfileForUser, supabaseServer } from "@/lib/server/auth";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Email/password login. A guest route the browser is currently on (created
// before this login) is attached to the account — logging in never makes the
// learner start over.
export const POST = route(async (req) => {
  if (!authConfigured()) {
    return fail("Accounts are not configured on this server (Supabase auth env vars missing).", 503);
  }
  const { email, password, profileId } = await parseBody(req, credentialsSchema);
  const supabase = supabaseServer()!;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail("Invalid email or password.", 401);

  const claimed = await claimProfileForUser(profileId, data.user.id);
  return ok({
    user: { id: data.user.id, email: data.user.email ?? email },
    claimed,
  });
});
