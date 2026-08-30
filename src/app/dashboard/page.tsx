"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Trophy, ClipboardCheck, CheckCircle2, MapPin, Award, Activity } from "lucide-react";
import { api, isProfileMissing, type DashboardData } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Card, ProgressRing, Spinner, Badge } from "@/components/ui";

export default function DashboardPage() {
  const router = useRouter();
  const { profileId, setProfileId, fireReroute } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      router.replace("/");
      return;
    }
    api
      .dashboard(profileId)
      .then(setData)
      .catch((e) => {
        // A saved learner id the server no longer knows → back to onboarding.
        if (isProfileMissing(e)) {
          setProfileId(null);
          fireReroute(["Your saved learner is no longer on this server — let's chart a new route."]);
          router.replace("/");
          return;
        }
      })
      .finally(() => setLoading(false));
  }, [profileId, router, setProfileId, fireReroute]);

  if (loading) return <div className="mt-10"><Spinner label="Loading your progress…" /></div>;
  if (!data) return null;

  return (
    <div className="mt-2 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{data.profileName}'s progress</h1>
        <Badge tone="route">{data.roleName}</Badge>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing pct={data.progress.overallPct} />
          <div>
            <p className="text-sm font-medium">Overall progress</p>
            <p className="text-xs text-muted">
              {data.progress.completedSteps}/{data.progress.totalSteps} steps
            </p>
            <p className="mt-1 text-xs text-muted">~{data.progress.estimatedWeeksLeft} weeks left</p>
          </div>
        </Card>

        <Metric icon={<Flame className="h-5 w-5 text-marker" />} label="Day streak" value={`${data.streakDays}`} sub={`${data.weeklyHours}h/week target`} />
        <Metric
          icon={<MapPin className="h-5 w-5 text-route" />}
          label="Phases done"
          value={`${data.phases.done}/${data.phases.total}`}
          sub={data.phases.currentTitle ? `Now: ${data.phases.currentTitle}` : "—"}
        />
        <Metric
          icon={<ClipboardCheck className="h-5 w-5 text-good" />}
          label="Checkpoints"
          value={data.checkpoints.taken ? `${data.checkpoints.averageScore}%` : "—"}
          sub={`${data.checkpoints.taken} taken`}
        />
      </div>

      {/* Next action */}
      {data.nextAction && (
        <Card className="border-marker/40 bg-marker-soft/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-marker">Next best action</p>
          <p className="mt-1 font-medium">{data.nextAction.title}</p>
          <p className="mt-0.5 text-sm text-muted">{data.nextAction.why}</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Skill passport */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-route" />
            <h2 className="font-semibold">Skill passport</h2>
            <span className="ml-auto text-xs text-muted">
              {data.skills.atTarget}/{data.skills.totalTarget} at target
            </span>
          </div>
          {data.passport.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Stamp your first skill by acing a checkpoint or completing steps.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.passport.map((s) => (
                <span
                  key={s.skillId}
                  className="inline-flex items-center gap-1 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 text-xs font-medium text-good"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {s.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2 text-xs">
            <span className="text-good">{data.skills.atTarget} mastered</span>
            <span className="text-warn">{data.skills.partial} partial</span>
            <span className="text-bad">{data.skills.missing} to learn</span>
          </div>
        </Card>

        {/* Activity */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-route" />
            <h2 className="font-semibold">Recent activity</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {data.activity.length === 0 && <li className="text-sm text-muted">No activity yet.</li>}
            {data.activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-route" />
                <span>{a.label}</span>
                <span className="ml-auto text-xs text-faint">{new Date(a.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-faint">
        <Trophy className="h-3.5 w-3.5" />
        Keep going — every completed step reshapes your route.
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}
