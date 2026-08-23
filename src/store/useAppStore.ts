"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicAiStatus } from "@/lib/ai/config";

export interface RerouteInfo {
  changes: string[];
  seq: number; // increments each reroute so the overlay re-triggers
}

interface AppState {
  profileId: string | null;
  setProfileId: (id: string | null) => void;

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
