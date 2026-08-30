import { authConfigured, supabaseServer } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Sign out: clears the session cookies. Account-owned routes become
// inaccessible until the next login (enforced server-side per request).
export const POST = route(async () => {
  const supabase = supabaseServer();
  if (supabase) await supabase.auth.signOut();
  return ok({ user: null });
});
