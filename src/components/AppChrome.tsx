"use client";

import { useEffect } from "react";
import { api } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { TopNav } from "./TopNav";
import { AiSettings } from "./AiSettings";
import { RerouteOverlay } from "./RerouteOverlay";
import { Assistant } from "./Assistant";
import { AuthDialog } from "./AuthDialog";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const setAiStatus = useAppStore((s) => s.setAiStatus);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthConfigured = useAppStore((s) => s.setAuthConfigured);

  // Fetch the (key-free) AI status and the session's user once so the "AI
  // Brain" chip and the account chip are accurate.
  useEffect(() => {
    api
      .getAiConfig()
      .then((r) => setAiStatus(r.status))
      .catch(() => setAiStatus(null));
    api
      .auth.me()
      .then((r) => {
        setUser(r.user);
        setAuthConfigured(r.authConfigured);
      })
      .catch(() => setAuthConfigured(false));
  }, [setAiStatus, setUser, setAuthConfigured]);

  return (
    <div className="min-h-screen bg-topo">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">{children}</main>
      <RerouteOverlay />
      <AiSettings />
      <Assistant />
      <AuthDialog />
    </div>
  );
}
