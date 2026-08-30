"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Route, Map as MapIcon, Flag } from "lucide-react";
import { api, isProfileMissing, type NavigatorBundle, type AdaptResponse } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button, Card, Spinner } from "@/components/ui";
import { NextBestAction } from "@/components/NextBestAction";
import { RouteMap } from "@/components/RouteMap";
import { Simulate } from "@/components/Simulate";
import { HowWeBuilt } from "@/components/HowWeBuilt";

export default function NavigatorPage() {
  const router = useRouter();
  const { profileId, fireReroute, setProfileId } = useAppStore();
  const [bundle, setBundle] = useState<NavigatorBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"simulate" | "regenerate" | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const b = await api.getNavigator(id);
      setBundle(b);
    } catch (e) {
      // A saved learner id the server no longer knows (reset database) is not
      // an error to stare at — drop it and go chart a fresh route.
      if (isProfileMissing(e)) {
        setProfileId(null);
        fireReroute(["Your saved learner is no longer on this server — let's chart a new route."]);
        router.replace("/");
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load your route.");
    } finally {
      setLoading(false);
    }
  }, [fireReroute, router, setProfileId]);

  useEffect(() => {
    if (!profileId) {
      router.replace("/");
      return;
    }
    load(profileId);
  }, [profileId, load, router]);

  function applyResult(res: AdaptResponse) {
    setBundle(res);
    if (res.changes?.length) fireReroute(res.changes);
  }

  async function handleComplete(stepId: string) {
    if (!profileId) return;
    setCompletingId(stepId);
    try {
      applyResult(await api.completeStep(profileId, stepId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleSimulate(payload: { weeklyHours?: number; targetRole?: string }) {
    if (!profileId) return;
    setBusy("simulate");
    try {
      applyResult(await api.simulate({ profileId, ...payload }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate() {
    if (!profileId) return;
    setBusy("regenerate");
    try {
      const r = await api.regeneratePath(profileId);
      await load(profileId);
      fireReroute([`Route regenerated (v${r.roadmap.version}).`]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="mt-10"><Spinner label="Charting your route…" /></div>;
  if (error) return <Card className="mt-6 p-5 text-sm text-bad">{error}</Card>;
  if (!bundle) return null;

  const { view, gap, profile, roadmap } = bundle;

  if (!roadmap || !view) {
    return (
      <Card className="mt-6 p-6 text-center">
        <p className="font-semibold">No route yet.</p>
        <Button className="mt-3" onClick={handleRegenerate} loading={busy === "regenerate"}>
          Generate my path
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-2">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-route-soft text-route">
            <MapIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-faint">Route to</p>
            <h1 className="truncate text-xl font-semibold">{gap.roleName}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-faint">Progress</p>
              <p className="font-semibold text-route">{view.progress.overallPct}%</p>
            </div>
            <Button variant="outline" onClick={handleRegenerate} loading={busy === "regenerate"} className="!px-3">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-route transition-all duration-700"
            style={{ width: `${view.progress.overallPct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{view.progress.completedSteps}/{view.progress.totalSteps} steps</span>
          <span className="inline-flex items-center gap-1"><Flag className="h-3 w-3" /> ~{view.progress.estimatedWeeksLeft} weeks left</span>
          <span>{profile.weeklyHours}h/week</span>
          <span className="text-good">{gap.mastered.length} mastered</span>
          <span className="text-warn">{gap.partial.length} partial</span>
          <span className="text-bad">{gap.missing.length} to learn</span>
        </div>
        <p className="mt-3 rounded-xl bg-surface p-3 text-sm text-muted">{roadmap.rationale.summary}</p>
      </Card>

      {/* grid-cols-1 is load-bearing: `grid` alone would auto-place both
          children in implicit side-by-side columns (the desktop two-column
          layout squashed onto phones). One column below lg, two at lg. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <RouteMap
            phases={view.phases}
            currentPhaseIndex={view.progress.currentPhaseIndex}
            onOpen={(id) => router.push(`/step/${id}`)}
            onComplete={handleComplete}
            completingId={completingId}
          />
        </div>

        <div className="space-y-4">
          <NextBestAction
            next={view.nextAction}
            onOpen={(id) => router.push(`/step/${id}`)}
            onComplete={handleComplete}
            completing={completingId === view.nextAction?.step.id}
          />
          <Simulate
            weeklyHours={profile.weeklyHours}
            targetRoleId={gap.roleId}
            onApply={handleSimulate}
            busy={busy === "simulate"}
          />
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Route className="h-4 w-4 text-route" /> Strategy
            </div>
            <p className="mt-1 text-xs text-muted">{roadmap.rationale.strategy}</p>
          </Card>
          <HowWeBuilt how={roadmap.rationale.how} />
        </div>
      </div>
    </div>
  );
}
