import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/db";
import { aiSessionId } from "@/lib/server/session";
import { HttpError } from "@/lib/server/http";

/**
 * Supabase Auth (email/password only). Identity comes from the session cookies
 * maintained by @supabase/ssr; everything else (ownership of routes) is
 * enforced here against the Prisma layer, server-side.
 *
 * Auth is optional by design: guests keep the full anonymous experience. When
 * the Supabase env vars are missing, `currentUser()` returns null and the app
 * behaves exactly as it did before accounts existed.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Server-side Supabase client bound to this request's cookies. */
export function supabaseServer() {
  if (!authConfigured()) return null;
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — refreshed cookies are set by the
          // browser client instead. Safe to ignore.
        }
      },
    },
  });
}

/** The authenticated user for this request, or null (guest / unconfigured). */
export async function currentUser(): Promise<AuthUser | null> {
  const supabase = supabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Ownership guard for profile-scoped routes. A route with no owner (guest or
 * demo persona) stays accessible the way it always was; a route owned by an
 * account is visible ONLY to that account. 403 (not 404) so the legitimate
 * owner of a stale link understands what happened.
 */
export async function guardProfile(profileId: string): Promise<void> {
  const row = await prisma.learnerProfile.findUnique({
    where: { id: profileId },
    select: { ownerId: true },
  });
  if (!row) throw new HttpError("Profile not found.", 404);
  if (!row.ownerId) return;
  const user = await currentUser();
  if (!user || user.id !== row.ownerId) {
    throw new HttpError("This route belongs to another account.", 403);
  }
}

/**
 * AI-config scope: authenticated users get a stable per-user scope ("u-<id>")
 * so their saved provider/key follows them across devices while remaining
 * private to them; guests keep the anonymous ai_sid session. Never global.
 */
export async function aiScopeId(): Promise<string> {
  const user = await currentUser();
  return user ? `u-${user.id}` : aiSessionId();
}

/**
 * Attach a guest route to an account (guest → account transition). Only an
 * unowned, non-persona profile can be claimed — never another user's route and
 * never a demo persona (those stay shared).
 */
export async function claimProfileForUser(profileId: string | undefined, userId: string): Promise<boolean> {
  if (!profileId || profileId.startsWith("persona-")) return false;
  const claimed = await prisma.learnerProfile.updateMany({
    where: { id: profileId, ownerId: null },
    data: { ownerId: userId },
  });
  return claimed.count > 0;
}
