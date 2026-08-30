"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserRound, LogOut, MailCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "./ui";

/**
 * Lightweight email/password auth (Supabase Auth). One small dialog — the app
 * stays navigator-first: guests lose nothing, and signing in only adds
 * persistence for routes. When the browser is on a guest route at login, that
 * route is claimed by the account so no progress is lost.
 */
export function AuthDialog() {
  const router = useRouter();
  const {
    authOpen,
    setAuthOpen,
    user,
    setUser,
    setAiStatus,
    profileId,
    setProfileId,
    fireReroute,
  } = useAppStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authOpen) return null;

  async function refreshAiStatus() {
    // The AI-config scope changes with the signed-in state (per-user vs
    // anonymous session row) — refetch so the "AI Brain" chip stays honest.
    try {
      const r = await api.getAiConfig();
      setAiStatus(r.status);
    } catch {
      setAiStatus(null);
    }
  }

  async function submit() {
    if (!email.trim() || password.length < 8) {
      setError("Enter an email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        const r = await api.auth.login(email.trim(), password, profileId);
        setUser(r.user);
        setAuthOpen(false);
        if (r.claimed) {
          fireReroute(["Your guest route is now saved to your account — nothing was lost."]);
        }
        router.push("/");
      } else {
        const r = await api.auth.signup(email.trim(), password, profileId);
        if (r.needsConfirmation) {
          setInfo("Account created — check your email to confirm it, then log in here. Your current route stays right where it is.");
          return;
        }
        setUser(r.user);
        setAuthOpen(false);
        if (r.claimed) {
          fireReroute(["Your guest route is now saved to your account — nothing was lost."]);
        }
        router.push("/");
      }
      await refreshAiStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await api.auth.logout();
      setUser(null);
      setAuthOpen(false);
      await refreshAiStatus();
      // Account-owned routes are now inaccessible — if the active route was
      // one of them, drop it and return to the guest home experience.
      if (profileId) {
        try {
          await api.getNavigator(profileId);
        } catch {
          setProfileId(null);
          router.push("/");
          fireReroute(["Signed out — your routes are safe. Log back in to continue where you left off."]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-route";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-3 sm:p-4" onClick={() => setAuthOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-line bg-raised p-4 shadow-lift sm:p-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-route" />
            <div>
              <h2 className="text-lg font-semibold">{user ? "Your account" : mode === "login" ? "Log in" : "Create an account"}</h2>
              <p className="text-xs text-muted">
                {user
                  ? "Your routes sync across devices."
                  : "Save your routes and continue on any device — or keep exploring as a guest."}
              </p>
            </div>
          </div>
          <button onClick={() => setAuthOpen(false)} className="rounded-full p-1 text-muted hover:bg-line/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {user ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-surface px-3 py-2 text-sm">
              <p className="font-medium">{user.email}</p>
              <p className="text-xs text-muted">Signed in</p>
            </div>
            <Button variant="outline" className="w-full" onClick={logout} loading={busy}>
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={inputCls}
                placeholder="At least 8 characters"
              />
            </div>

            {error && <p className="text-sm text-bad">{error}</p>}
            {info && (
              <p className="flex items-start gap-1.5 text-sm text-good">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" /> {info}
              </p>
            )}

            <Button className="w-full" onClick={submit} loading={busy}>
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button
                className="font-medium text-route hover:underline"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                  setInfo(null);
                }}
              >
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
