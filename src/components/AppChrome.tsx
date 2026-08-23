"use client";

import { useEffect } from "react";
import { api } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { TopNav } from "./TopNav";
import { AiSettings } from "./AiSettings";
import { RerouteOverlay } from "./RerouteOverlay";
import { Assistant } from "./Assistant";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const setAiStatus = useAppStore((s) => s.setAiStatus);

  // Fetch the (key-free) AI status once so the "AI Brain" chip is accurate.
  useEffect(() => {
    api
      .getAiConfig()
      .then((r) => setAiStatus(r.status))
      .catch(() => setAiStatus(null));
  }, [setAiStatus]);

  return (
    <div className="min-h-screen bg-topo">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">{children}</main>
      <RerouteOverlay />
      <AiSettings />
      <Assistant />
    </div>
  );
}
