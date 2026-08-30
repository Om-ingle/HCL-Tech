"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Wand2, ArrowRight, Sparkles, Cpu, Target, RefreshCw, Route as RouteIcon } from "lucide-react";
import { ROLES, SKILLS, skillName } from "@/lib/catalog";
import { api, type PersonaMeta, type TargetSkill, type GoalResolveResponse, type RouteSummary } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { Button, Card, Chip, cx } from "@/components/ui";
import type {
  Difficulty,
  GoalMethod,
  GoalResolution,
  LearningStyle,
  ProfileDraft,
} from "@/lib/domain/types";

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
  const { setProfileId, fireReroute, setSettingsOpen, user } = useAppStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [source, setSource] = useState<"llm" | "fallback">("fallback");
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [resolution, setResolution] = useState<GoalResolution | null>(null);
  const [targets, setTargets] = useState<TargetSkill[]>([]);
  const [dynamicSkills, setDynamicSkills] = useState<GoalResolveResponse["dynamicSkills"]>([]);
  const [personas, setPersonas] = useState<PersonaMeta[]>([]);
  const [seeding, setSeeding] = useState<string | null>(null);
  // Saved routes for a signed-in learner (multi-goal). Guests see personas.
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  // The account's accumulated skills — prefilled into new-route onboarding so
  // the confirmation screen shows what carries over.
  const [accountSkills, setAccountSkills] = useState<string[]>([]);
  // Set when the offline engine honestly can't map the goal (dancing, cooking…)
  // and no AI provider is configured — show connect-AI guidance, not a fake route.
  const [unmapped, setUnmapped] = useState<GoalResolution | null>(null);

  useEffect(() => {
    api.listPersonas().then((r) => setPersonas(r.personas)).catch(() => {});
  }, []);

  const loadRoutes = useCallback(async () => {
    if (!user) {
      setRoutes(null);
      setAccountSkills([]);
      return;
    }
    try {
      const r = await api.listRoutes();
      setRoutes(r.routes);
      setAccountSkills(r.knownSkillIds ?? []);
    } catch {
      setRoutes(null);
    }
  }, [user]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  function openRoute(r: RouteSummary) {
    setProfileId(r.profileId);
    fireReroute([`Continuing your route to ${r.roleName}.`]);
    router.push("/navigator");
  }

  async function onboard() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setUnmapped(null);
    try {
      const r = await api.onboard(text);
      setNote(r.note);
      setAiAvailable(r.aiStatus.available);
      // Out-of-domain goal with no working AI → connect-AI guidance, never a
      // generic software roadmap pretending to be about dancing.
      if (r.source === "fallback" && r.resolution.methods.includes("unmapped")) {
        setUnmapped(r.resolution);
        return;
      }
      setDraft(
        user && accountSkills.length
          ? // Signed in: what the account already knows shows on the confirm
            // screen too, not just in the server-side merge at creation time.
            { ...r.draft, knownSkillIds: Array.from(new Set([...(r.draft.knownSkillIds ?? []), ...accountSkills])) }
          : r.draft,
      );
      setSource(r.source);
      setProvider(r.provider);
      setResolution(r.resolution);
      setTargets(r.targets);
      setDynamicSkills(r.dynamicSkills ?? []);
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
              Chart your route to any goal.
            </h1>
            <p className="mt-3 text-muted">
              Explain it the way you would to a friend — “third year, want to get into data”, “I know some
              C and want to work on the kernel”, Hinglish is fine too. I'll map the skills between here and
              there, and reroute as you learn.
            </p>
          </div>

          <Card className="mt-6 p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. i'm in 3rd year, know a bit of python, want to get into data engineering. maybe 6 hrs a week"
              className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-route"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 basis-40 text-xs text-faint">
                Type it however it comes out — there's no fixed list of roles.
              </p>
              <Button onClick={onboard} loading={loading} disabled={!text.trim()}>
                <Wand2 className="h-4 w-4" /> Map my route
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          </Card>

          {unmapped && (
            <Card className="mt-4 border-warn/40 p-5">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-warn" />
                <h2 className="text-base font-semibold">
                  “{unmapped.label}” is outside my offline learning knowledge
                </h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                {aiAvailable
                  ? "I won't fake a software roadmap for a goal like this. Your AI provider just failed to answer for it — check the provider/model in settings (free models rate-limit), then retry below."
                  : "The built-in catalog covers tech skills, and I won't fake a software roadmap for a goal like this. Connect an AI provider and I'll map the real skills behind it — the way I did for battery chemistry."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setSettingsOpen(true)}>
                  <Cpu className="h-4 w-4" /> Open AI Settings
                </Button>
                <Button variant="outline" onClick={onboard} loading={loading}>
                  <RefreshCw className="h-4 w-4" /> Retry this goal
                </Button>
              </div>
              <p className="mt-3 text-xs text-faint">
                Your goal text is still in the box above — retry works the moment a provider is ready.
              </p>
            </Card>
          )}

          {user ? (
            /* Signed in: their saved routes (multi-goal). Each card is a full
               independent route — switching just points the browser at that
               profile id; roadmap/progress live server-side. */
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted">Your routes</p>
                <span className="text-xs text-faint">
                  {routes?.length ? `${routes.length} goal${routes.length === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {routes === null ? (
                  <Card className="p-4 text-sm text-muted">Loading your routes…</Card>
                ) : (
                  <>
                    {routes.map((r) => (
                      <Card key={r.profileId} className="flex flex-col p-4">
                        <div className="flex items-start gap-2">
                          <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-route" />
                          <p className="min-w-0 flex-1 truncate font-semibold" title={r.goalText || r.roleName}>
                            {r.roleName}
                          </p>
                          <span className="shrink-0 text-sm font-semibold text-route">{r.progressPct}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-route transition-all" style={{ width: `${r.progressPct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {r.currentPhase ? `Current: ${r.currentPhase}` : "Not started yet"}
                        </p>
                        {r.nextAction && (
                          <p className="mt-1 line-clamp-1 text-xs text-faint" title={r.nextAction}>
                            Next: {r.nextAction}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-faint">
                          {r.stepsDone}/{r.stepsTotal} steps
                        </p>
                        <Button variant="soft" className="mt-3" onClick={() => openRoute(r)}>
                          Continue route <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Card>
                    ))}
                    <Card className="flex flex-col items-start justify-center border-dashed p-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDraft(null);
                          document.querySelector("textarea")?.focus();
                        }}
                      >
                        <Wand2 className="h-4 w-4" /> Create a new route
                      </Button>
                      <p className="mt-1 text-xs text-faint">
                        Describe a new goal — your skills carry over.
                      </p>
                    </Card>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Guest: the demo personas, exactly as before. */
            <div className="mt-8">
              <p className="mb-3 text-center text-sm font-medium text-muted">…or look in on a real learner</p>
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
                      View {p.name}'s route <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <ConfirmDraft
          draft={draft}
          source={source}
          provider={provider}
          note={note}
          aiAvailable={aiAvailable}
          resolution={resolution}
          targets={targets}
          dynamicSkills={dynamicSkills}
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
  provider,
  note,
  aiAvailable,
  resolution,
  targets,
  dynamicSkills,
  onBack,
  onConfirm,
  onError,
  error,
}: {
  draft: ProfileDraft;
  source: "llm" | "fallback";
  provider?: string;
  note?: string;
  aiAvailable: boolean;
  resolution: GoalResolution | null;
  targets: TargetSkill[];
  dynamicSkills: GoalResolveResponse["dynamicSkills"];
  onBack: () => void;
  onConfirm: (profileId: string, roleName: string) => void;
  onError: (msg: string | null) => void;
  error: string | null;
}) {
  const [name, setName] = useState(draft.name ?? "Learner");
  // The resolver is the authority on the destination; `draft.targetRoleId` is
  // only a guess from the same sentence, so it must not pin an open goal to a
  // predefined role. A null roleId means "keep my own goal".
  const [roleId, setRoleId] = useState(resolution ? resolution.roleId ?? "" : draft.targetRoleId ?? "");
  const [freeRole] = useState(draft.targetRole ?? "");
  const [experience, setExperience] = useState<Difficulty>(draft.experienceLevel ?? "beginner");
  const [style, setStyle] = useState<LearningStyle>(draft.learningStyle ?? "mixed");
  const [weeklyHours, setWeeklyHours] = useState(draft.weeklyHours ?? 8);
  const [timelineWeeks, setTimelineWeeks] = useState(draft.timelineWeeks ?? 24);
  const [known, setKnown] = useState<string[]>(draft.knownSkillIds ?? []);
  const [addSkill, setAddSkill] = useState("");
  const [saving, setSaving] = useState(false);
  // Open-goal confirmation (§13): the goal and its target skills are editable.
  const [goalText, setGoalText] = useState(draft.goalText ?? resolution?.goalText ?? "");
  const [res, setRes] = useState<GoalResolution | null>(resolution);
  const [picked, setPicked] = useState<TargetSkill[]>(targets);
  const [dyn, setDyn] = useState<GoalResolveResponse["dynamicSkills"]>(dynamicSkills);
  const [addTarget, setAddTarget] = useState("");
  const [redetecting, setRedetecting] = useState(false);

  const destination = roleId
    ? ROLES.find((r) => r.id === roleId)?.name ?? roleId
    : res?.label || freeRole || "your goal";

  async function redetect() {
    if (!goalText.trim()) return;
    setRedetecting(true);
    onError(null);
    try {
      // Re-read the goal text on its own — the whole point of the button — so a
      // stale role selection can't steer the result back to where it was.
      const r = await api.resolveGoal(goalText);
      setRes(r.resolution);
      setPicked(r.targets);
      setDyn(r.dynamicSkills ?? []);
      setRoleId(r.resolution.roleId ?? "");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't re-read that goal.");
    } finally {
      setRedetecting(false);
    }
  }

  // Picking a predefined role should visibly re-target the skill list, so the
  // chips never contradict the destination shown above them.
  async function onRoleChange(id: string) {
    setRoleId(id);
    if (!id) return void redetect();
    setRedetecting(true);
    onError(null);
    try {
      const r = await api.resolveGoal(goalText || id, id);
      setRes(r.resolution);
      setPicked(r.targets);
      setDyn(r.dynamicSkills ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't load that role's skills.");
    } finally {
      setRedetecting(false);
    }
  }

  async function confirm() {
    setSaving(true);
    onError(null);
    try {
      const targetRole = roleId || res?.label || freeRole || "Software Engineer";
      const bundle = await api.createProfile({
        name,
        targetRole,
        goalText,
        experienceLevel: experience,
        learningStyle: style,
        weeklyHours,
        timelineWeeks,
        careerOutcome: draft.careerOutcome ?? "",
        interests: draft.interests ?? [],
        knownSkillIds: known,
        targetSkillIds: picked.map((t) => t.skillId),
        // Only the dynamic defs actually backing a picked target — matched by id
        // when we have one, else by name.
        dynamicSkills: dyn.filter((d) =>
          picked.some((p) => (d.id ? p.skillId === d.id : p.name === d.name)),
        ),
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
          {source === "llm"
            ? `read by AI${provider ? ` · ${provider}` : ""}`
            : aiAvailable
              ? "AI unavailable for this call — parsed locally"
              : "parsed locally (no AI configured)"}
        </span>
      </div>
      {note && <p className="mt-1 text-xs text-warn">{note}</p>}
      {draft.notes?.map((n, i) => (
        <p key={i} className="mt-1 text-xs text-muted">
          {n}
        </p>
      ))}

      <GoalPanel
        res={res}
        goalText={goalText}
        setGoalText={setGoalText}
        picked={picked}
        setPicked={setPicked}
        addTarget={addTarget}
        setAddTarget={setAddTarget}
        redetect={redetect}
        redetecting={redetecting}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Closest known role (optional)">
          <select value={roleId} onChange={(e) => onRoleChange(e.target.value)} className={inputCls}>
            <option value="">
              {res?.label ? `Keep my goal: ${res.label}` : freeRole ? `Keep my goal: ${freeRole}` : "Keep my own goal"}
            </option>
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={confirm} loading={saving} className="min-w-0 max-w-full">
          <span className="truncate">Start my route to {destination}</span> <ArrowRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </Card>
  );
}

const METHOD_LABEL: Record<GoalMethod, string> = {
  role: "matched a role we already map",
  archetype: "matched a known goal pattern",
  terms: "read the skills named in your words",
  domain: "placed your goal in a field",
  llm: "AI proposed skills, checked against our graph",
  starter: "no clear signal — starting from foundations",
  unmapped: "outside my offline learning knowledge",
};

/**
 * §13: show what the system inferred from an arbitrary goal — never silently
 * swap it for a different role — and let the learner edit the target skills.
 */
function GoalPanel({
  res,
  goalText,
  setGoalText,
  picked,
  setPicked,
  addTarget,
  setAddTarget,
  redetect,
  redetecting,
}: {
  res: GoalResolution | null;
  goalText: string;
  setGoalText: (v: string) => void;
  picked: TargetSkill[];
  setPicked: (v: TargetSkill[]) => void;
  addTarget: string;
  setAddTarget: (v: string) => void;
  redetect: () => void;
  redetecting: boolean;
}) {
  if (!res) return null;
  const pickedIds = new Set(picked.map((t) => t.skillId));
  const unsure = res.confidence < 0.6;

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-route" />
        <span className="text-sm font-semibold">Understood as</span>
        <span className="rounded-full bg-route-soft px-2 py-0.5 text-xs font-medium text-route">
          {res.label}
        </span>
        {res.domains.slice(0, 3).map((d) => (
          <span key={d} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {d}
          </span>
        ))}
        <span
          className={cx(
            "ml-auto text-xs",
            unsure ? "text-warn" : "text-faint",
          )}
          title={res.methods.map((m) => METHOD_LABEL[m]).join(" · ")}
        >
          {unsure ? "Low confidence — please check" : "Confident"} ·{" "}
          {Math.round(res.confidence * 100)}%
        </span>
      </div>

      <p className="mt-2 text-xs text-muted">
        How I read it: {res.methods.map((m) => METHOD_LABEL[m]).join("; ")}.
      </p>
      {res.unknownTerms.length > 0 && (
        <p className="mt-1 text-xs text-warn">
          I couldn't map {res.unknownTerms.slice(0, 4).join(", ")} to a skill I know — I'll use those words to
          search for resources, but they won't change your route. Add the right skills below if I missed
          something.
        </p>
      )}

      <Field label="Your goal, in your words" className="mt-3">
        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-line bg-paper p-3 text-sm outline-none focus:border-route"
        />
        <div className="mt-2 flex justify-end">
          <Button variant="outline" onClick={redetect} loading={redetecting} disabled={!goalText.trim()}>
            <RefreshCw className="h-4 w-4" /> Re-detect skills
          </Button>
        </div>
      </Field>

      <Field label={`Target skills I detected (${picked.length})`} className="mt-3">
        <div className="flex flex-wrap gap-2">
          {picked.length === 0 && (
            <span className="text-xs text-faint">
              None yet — add at least one, or re-detect from your goal.
            </span>
          )}
          {picked.map((t) => (
            <Chip
              key={t.skillId}
              active
              onClick={() => setPicked(picked.filter((x) => x.skillId !== t.skillId))}
              title={`${t.domain} — click to remove`}
            >
              {t.name} ✕
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
            className={cx(inputCls, "flex-1")}
          >
            <option value="">Add a target skill…</option>
            {SKILLS.filter((s) => !pickedIds.has(s.id)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.domain}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => {
              const s = SKILLS.find((x) => x.id === addTarget);
              if (!s) return;
              setPicked([...picked, { skillId: s.id, name: s.name, domain: s.domain, targetLevel: 3 }]);
              setAddTarget("");
            }}
          >
            Add
          </Button>
        </div>
        <p className="mt-1 text-xs text-faint">
          Prerequisites get filled in automatically — you only need the end goals.
        </p>
      </Field>
    </div>
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
