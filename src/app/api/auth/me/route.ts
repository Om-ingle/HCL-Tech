import { authConfigured, currentUser } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Who am I? Drives the account chip and whether the homepage shows saved
// routes. authConfigured lets the UI hide auth entirely when the server has
// no Supabase auth env vars.
export const GET = route(async () => {
  const user = await currentUser();
  return ok({ user, authConfigured: authConfigured() });
});
