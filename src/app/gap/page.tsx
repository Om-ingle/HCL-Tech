"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, ExternalLink, ChevronRight, TrendingUp, Compass } from "lucide-react";
import { api } from "@/lib/client/api";
import { skillName } from "@/lib/catalog";
import { useAppStore } from "@/store/useAppStore";
import { Badge, Card, Spinner, cx } from "@/components/ui";
import { FeedbackBar } from "@/components/FeedbackBar";
import type { Recommendation, SkillGap, SkillGapItem } from "@/lib/domain/types";

type Discovery = NonNullable<Awaited<ReturnType<typeof api.skillGap>>["discovery"]>;

export default function GapPage() {
  const router = useRouter();
  const profileId = useAppStore((s) => s.profileId);
  const [gap, setGap] = useState<SkillGap | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const r = await api.skillGap(id);
    setGap(r.gap);
    setRecs(r.recommendations);
    setDiscovery(r.discovery ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profileId) {
      router.replace("/");
      return;
    }
    load(profileId).catch(() => setLoading(false));
  }, [profileId, load, router]);

  if (loading) return <div className="mt-10"><Spinner label="Analyzing your skills…" /></div>;
  if (!gap || !profileId) return null;

  return (
    <div className="mt-2 space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-route" />
          <h1 className="text-xl font-semibold">Skill gap for {gap.roleName}</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Comparing what you know against what {gap.roleName} needs — ordered so prerequisites always come first.
        </p>

        {/* Ordered learning sequence */}
        {gap.orderedSkillIds.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Recommended learning order</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {gap.orderedSkillIds.slice(0, 12).map((id, i) => (
                <span key={id} className="inline-flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-faint" />}
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs">{skillName(id)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* §13/§14: what the resolver actually inferred from an open goal. */}
        {gap.resolution && (
          <div className="mt-4 rounded-xl border border-line bg-surface p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
              <Compass className="h-3.5 w-3.5" /> How we read your goal
              {gap.resolution.domains.slice(0, 3).map((d) => (
                <span key={d} className="rounded-full bg-raised px-2 py-0.5 text-[11px] normal-case text-muted">
                  {d}
                </span>
              ))}
            </p>
            <ul className="mt-2 space-y-1">
              {gap.resolution.notes.map((n, i) => (
                <li key={i} className="text-xs text-muted">
                  • {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <GapColumn title="Mastered" tone="mastered" items={gap.mastered} empty="Nothing yet — you'll get there." />
        <GapColumn title="Partial" tone="partial" items={gap.partial} empty="No partial skills." />
        <GapColumn title="To learn" tone="missing" items={gap.missing} empty="No missing skills — nice!" />
      </div>

      {/* Recommendations */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-route" />
          <h2 className="text-lg font-semibold">Top recommendations</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Scored against your gaps, level, and preferences — every point is explained.</p>
        {discovery && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-surface px-2 py-0.5 text-muted" title="Hand-vetted resources in our library">
              {discovery.catalog} curated
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-muted" title="Official docs, university courses, and reputable open-source material">
              {discovery.canonical} official / university
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-muted" title="Found by live search — requires a server-side search key">
              {discovery.external} found by search
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-muted" title="Built from the skill graph where no vetted resource exists — no invented links">
              {discovery.generated} study modules
            </span>
            {discovery.skillsGeneratedOnly.length > 0 && (
              <span className="rounded-full bg-marker-soft px-2 py-0.5 text-marker">
                still looking for material on {discovery.skillsGeneratedOnly.slice(0, 3).map(skillName).join(", ")}
              </span>
            )}
          </div>
        )}
        <div className="mt-4 space-y-3">
          {recs.map((rec) => (
            <RecommendationCard key={rec.resource.id} rec={rec} profileId={profileId} onFeedback={() => load(profileId)} />
          ))}
          {recs.length === 0 && <p className="text-sm text-muted">No new recommendations — you may have completed the essentials.</p>}
        </div>
      </Card>
    </div>
  );
}

function GapColumn({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "mastered" | "partial" | "missing";
  items: SkillGapItem[];
  empty: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && <li className="text-xs text-faint">{empty}</li>}
        {items.map((item) => (
          <li key={item.skillId} className="rounded-lg bg-surface p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="ml-auto text-[10px] text-faint">{item.domain}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{item.reason}</p>
            {tone !== "missing" && (
              <div className="mt-1 flex gap-0.5">
                {[1, 2, 3].map((lvl) => (
                  <span
                    key={lvl}
                    className={cx(
                      "h-1.5 flex-1 rounded-full",
                      lvl <= item.proficiency ? "bg-route" : lvl <= item.targetLevel ? "bg-line" : "bg-transparent",
                    )}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecommendationCard({
  rec,
  profileId,
  onFeedback,
}: {
  rec: Recommendation;
  profileId: string;
  onFeedback: () => void;
}) {
  const topFactors = rec.factors.filter((f) => f.note).sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{rec.resource.title}</span>
            <Badge tone="neutral">{rec.resource.type}</Badge>
            <span className="text-xs text-faint">~{rec.resource.durationHours}h</span>
            {rec.resource.provider && <span className="text-xs text-faint">· {rec.resource.provider}</span>}
          </div>
          <p className="mt-1 text-sm text-muted">{rec.why}</p>
          {rec.targetsSkills.length > 0 && (
            <p className="mt-1 text-xs text-route">Closes: {rec.targetsSkills.map(skillName).join(", ")}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topFactors.map((f) => (
              <span key={f.key} className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-muted" title={f.note}>
                {f.contribution > 0 ? "+" : ""}
                {f.contribution} {f.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-route-soft px-2 py-0.5 text-xs font-semibold text-route">{rec.score}</span>
          {rec.resource.url ? (
            <a href={rec.resource.url} target="_blank" rel="noreferrer" className="text-faint hover:text-route">
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span
              className="text-faint"
              title="Guided study module built from the skill graph — no external link to invent"
            >
              <Compass className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
      <div className="mt-2">
        <FeedbackBar profileId={profileId} resourceId={rec.resource.id} compact onResult={onFeedback} />
      </div>
    </div>
  );
}
