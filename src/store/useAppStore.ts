"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicAiStatus } from "@/lib/ai/config";
import type { AuthUser } from "@/lib/client/api";

export interface RerouteInfo {
  changes: string[];
  seq: number; // increments each reroute so the overlay re-triggers
}

interface AppState {
  profileId: string | null;
  setProfileId: (id: string | null) => void;

  /** Signed-in account (session cookies are the source of truth; this is a cache). */
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  /** False when the server has no Supabase auth env vars → hide all auth UI. */
  authConfigured: boolean;
  setAuthConfigured: (v: boolean) => void;

  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;

  aiStatus: PublicAiStatus | null;
  setAiStatus: (s: PublicAiStatus | null) => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;

  reroute: RerouteInfo | null;
  fireReroute: (changes: string[]) => void;
  clearReroute: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profileId: null,
      setProfileId: (id) => set({ profileId: id }),

      user: null,
      setUser: (u) => set({ user: u }),
      authConfigured: false,
      setAuthConfigured: (v) => set({ authConfigured: v }),

      authOpen: false,
      setAuthOpen: (v) => set({ authOpen: v }),

      aiStatus: null,
      setAiStatus: (s) => set({ aiStatus: s }),

      settingsOpen: false,
      setSettingsOpen: (v) => set({ settingsOpen: v }),

      assistantOpen: false,
      setAssistantOpen: (v) => set({ assistantOpen: v }),

      reroute: null,
      fireReroute: (changes) => set({ reroute: { changes, seq: (get().reroute?.seq ?? 0) + 1 } }),
      clearReroute: () => set({ reroute: null }),
    }),
    {
      name: "skill-atlas",
      partialize: (s) => ({ profileId: s.profileId }),
    },
  ),
);
