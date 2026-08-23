"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Wand2, ArrowRight, Sparkles, Cpu } from "lucide-react";
import { ROLES, SKILLS, skillName } from "@/lib/catalog";
import { api, type PersonaMeta } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button, Card, Chip, cx } from "@/components/ui";
import type { Difficulty, LearningStyle, ProfileDraft } from "@/lib/domain/types";

const EXPERIENCE: { id: Difficulty; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];
const STYLES: { id: LearningStyle; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "reading", label: "Reading" },
  { id: "project", label: "Projects" },
  { id: "mixed", label: "Mixed" },
];

export default function HomePage() {
  const router = useRouter();
  const { setProfileId, fireReroute } = useAppStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [source, setSource] = useState<"llm" | "fallback">("fallback");
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [seeding, setSeeding] = useState<string | null>(null);

  useEffect(() => {
    api.listPersonas().then((r) => setPersonas(r.personas)).catch(() => {});
  }, []);

  async function onboard() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.onboard(text);
      setDraft(r.draft);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read that.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPersona(p: PersonaMeta) {
    setSeeding(p.id);
    try {
      await api.seed();
      setProfileId(p.id);
      fireReroute([`Loaded “${p.name}” — mapping the route to ${roleLabel(p.targetRole)}.`]);
      router.push("/navigator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load persona.");
    } finally {
      setSeeding(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!draft ? (
        <>
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-route-soft px-3 py-1 text-xs font-medium text-route">
              <Compass className="h-3.5 w-3.5" /> Learning GPS
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Chart your route to the role you want.
            </h1>
            <p className="mt-3 text-muted">
              Tell me where you are and where you're headed. I'll map the skills between you and your goal —
              and reroute as you learn.
            </p>
          </div>

          <Card className="mt-6 p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. I'm a beginner who wants to become a data scientist. I can study ~10 hours a week and prefer hands-on projects."
              className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-route"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-faint">Natural language — no forms required.</p>
              <Button onClick={onboard} loading={loading} disabled={!text.trim()}>
                <Wand2 className="h-4 w-4" /> Map my route
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          </Card>

          <div className="mt-8">
            <p className="mb-3 text-center text-sm font-medium text-muted">…or start from a demo traveler</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {personas.map((p) => (
                <Card key={p.id} className="flex flex-col p-4">
                  <div className="text-2xl">{p.emoji}</div>
                  <p className="mt-1 font-semibold">{p.name}</p>
                  <p className="mt-1 flex-1 text-xs text-muted">{p.headline}</p>
                  <Button
                    variant="soft"
                    className="mt-3"
                    loading={seeding === p.id}
                    onClick={() => loadPersona(p)}
                  >
                    Follow this route <ArrowRight className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <ConfirmDraft
          draft={draft}
          source={source}
          onBack={() => setDraft(null)}
          onError={setError}
          error={error}
          onConfirm={(profileId, roleName) => {
            setProfileId(profileId);
            fireReroute([`Route mapped toward ${roleName}. Here's your path.`]);
            router.push("/navigator");
          }}
        />
      )}
    </div>
  );
}

function roleLabel(idOrText: string): string {
  return ROLES.find((r) => r.id === idOrText)?.name ?? idOrText;
}

function ConfirmDraft({
  draft,
  source,
  onBack,
  onConfirm,
  onError,
  error,
}: {
  draft: ProfileDraft;
  source: "llm" | "fallback";
  onBack: () => void;
  onConfirm: (profileId: string, roleName: string) => void;
  onError: (msg: string | null) => void;
  error: string | null;
}) {
  const [name, setName] = useState(draft.name ?? "Learner");
  const [roleId, setRoleId] = useState(draft.targetRoleId ?? "");
  const [freeRole] = useState(draft.targetRole ?? "");
  const [experience, setExperience] = useState<Difficulty>(draft.experienceLevel ?? "beginner");
  const [style, setStyle] = useState<LearningStyle>(draft.learningStyle ?? "mixed");
  const [weeklyHours, setWeeklyHours] = useState(draft.weeklyHours ?? 8);
  const [timelineWeeks, setTimelineWeeks] = useState(draft.timelineWeeks ?? 24);
  const [known, setKnown] = useState<string[]>(draft.knownSkillIds ?? []);
  const [addSkill, setAddSkill] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedRoleName = roleId ? ROLES.find((r) => r.id === roleId)?.name ?? roleId : freeRole || "your goal";

  async function confirm() {
    setSaving(true);
    onError(null);
    try {
      const targetRole = roleId || freeRole || "Software Engineer";
      const bundle = await api.createProfile({
        name,
        targetRole,
        goalText: draft.goalText ?? "",
        experienceLevel: experience,
        learningStyle: style,
        weeklyHours,
        timelineWeeks,
        careerOutcome: draft.careerOutcome ?? "",
        interests: draft.interests ?? [],
        knownSkillIds: known,
      });
      onConfirm(bundle.profile.id, bundle.gap.roleName);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't create your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Here's what I understood</h2>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-faint">
          {source === "llm" ? <Sparkles className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
          {source === "llm" ? "read by AI" : "parsed locally"}
        </span>
      </div>
      {draft.notes?.map((n, i) => (
        <p key={i} className="mt-1 text-xs text-muted">
          {n}
        </p>
      ))}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Target role">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputCls}>
            {!roleId && <option value="">{freeRole ? `From your words: ${freeRole}` : "Choose a role"}</option>}
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Experience level" className="mt-4">
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE.map((e) => (
            <Chip key={e.id} active={experience === e.id} onClick={() => setExperience(e.id)}>
              {e.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Preferred learning style" className="mt-4">
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={`Hours per week: ${weeklyHours}`}>
          <input
            type="range"
            min={2}
            max={40}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(Number(e.target.value))}
            className="w-full accent-route"
          />
        </Field>
        <Field label={`Target timeline: ${timelineWeeks} weeks`}>
          <input
            type="range"
            min={4}
            max={104}
            value={timelineWeeks}
            onChange={(e) => setTimelineWeeks(Number(e.target.value))}
            className="w-full accent-route"
          />
        </Field>
      </div>

      <Field label="Skills you already have" className="mt-4">
        <div className="flex flex-wrap gap-2">
          {known.length === 0 && <span className="text-xs text-faint">None yet — that's fine.</span>}
          {known.map((id) => (
            <Chip key={id} active onClick={() => setKnown((k) => k.filter((x) => x !== id))} title="Remove">
              {skillName(id)} ✕
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <select value={addSkill} onChange={(e) => setAddSkill(e.target.value)} className={cx(inputCls, "flex-1")}>
            <option value="">Add a skill…</option>
            {SKILLS.filter((s) => !known.includes(s.id)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.domain}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              if (addSkill) {
                setKnown((k) => [...k, addSkill]);
                setAddSkill("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Field>

      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={confirm} loading={saving}>
          Start my route to {resolvedRoleName} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-route";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
