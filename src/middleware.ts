import { NextResponse, type NextRequest } from "next/server";

/**
 * Anonymous AI-config session. Every browser gets one opaque id in an HttpOnly
 * cookie; AI provider config is stored per-session server-side, so one
 * visitor's saved key is never visible to (or used by) another visitor.
 * A fresh/incognito browser arrives with no cookie → no session → Demo/Fallback.
 */
export const AI_SID_COOKIE = "ai_sid";

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(AI_SID_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{16,64}$/i.test(existing)) return NextResponse.next();

  const sid = crypto.randomUUID();
  // Make the id visible to this same request's route handlers (the response
  // cookie only reaches the browser afterwards).
  req.cookies.set(AI_SID_COOKIE, sid);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(AI_SID_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$).*)"],
};
