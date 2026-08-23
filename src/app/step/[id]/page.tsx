"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  ExternalLink,
  Clock,
  CheckCircle2,
  Target,
  Trophy,
  RotateCcw,
  Navigation,
} from "lucide-react";
import { api, type NavigatorBundle } from "@/lib/client/api";
import type { HydratedStep } from "@/lib/domain/nextAction";
import type { PublicQuestion } from "@/lib/server/assessment";
import { skillName } from "@/lib/catalog";
import { useAppStore } from "@/store/useAppStore";
import { Badge, Button, Card, Spinner, cx } from "@/components/ui";
import { FeedbackBar } from "@/components/FeedbackBar";

const KIND_ICON = { resource: BookOpen, project: FlaskConical, assessment: ClipboardCheck } as const;

function locate(bundle: NavigatorBundle | null, stepId: string): { step: HydratedStep; phaseTitle: string } | null {
  if (!bundle?.view) return null;
  for (const phase of bundle.view.phases) {
    const step = phase.steps.find((s) => s.id === stepId);
    if (step) return { step, phaseTitle: phase.title };
  }
  return null;
}

export default function StepPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const stepId = decodeURIComponent(String(params.id));
  const { profileId, fireReroute } = useAppStore();

  const [bundle, setBundle] = useState<NavigatorBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Assessment state
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ scorePct: number; correct: number; total: number } | null>(null);
  const [retaking, setRetaking] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setBundle(await api.getNavigator(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this step.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileId) {
      router.replace("/");
      return;
    }
    load(profileId);
  }, [profileId, load, router]);

  const found = useMemo(() => locate(bundle, stepId), [bundle, stepId]);
  const step = found?.step ?? null;

  const isAssessment = step?.kind === "assessment";
  const alreadyDone = step?.status === "completed";
  const showQuiz = isAssessment && (!alreadyDone || retaking) && !result;

  // Fetch quiz questions when we need to render the checkpoint.
  useEffect(() => {
    if (!profileId || !step || !isAssessment || !showQuiz || questions) return;
    api
      .getQuiz(profileId, step.id)
      .then((q) => setQuestions(q.questions))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the checkpoint."));
  }, [profileId, step, isAssessment, showQuiz, questions]);

  async function markComplete() {
    if (!profileId || !step) return;
    setCompleting(true);
    try {
      const res = await api.completeStep(profileId, step.id);
      if (res.changes?.length) fireReroute(res.changes);
      router.push("/navigator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark complete.");
      setCompleting(false);
    }
  }

  async function submitCheckpoint() {
    if (!profileId || !step || !questions) return;
    setSubmitting(true);
    try {
      const payload = questions.map((q) => ({ questionId: q.id, choiceIndex: answers[q.id] }));
      const res = await api.submitAssessment(profileId, step.id, payload);
      setResult({ scorePct: res.scorePct, correct: res.correct, total: res.total });
      setBundle(res);
      setRetaking(false);
      if (res.changes?.length) fireReroute(res.changes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit the checkpoint.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="mt-10"><Spinner label="Opening step…" /></div>;

  if (!step) {
    return (
      <Card className="mt-6 p-6 text-center">
        <p className="font-semibold">This step isn't on your current route.</p>
        <p className="mt-1 text-sm text-muted">It may have been rerouted away. Head back to your map.</p>
        <Button className="mx-auto mt-4" variant="outline" onClick={() => router.push("/navigator")}>
          <ArrowLeft className="h-4 w-4" /> Back to route
        </Button>
      </Card>
    );
  }

  const Icon = KIND_ICON[step.kind] ?? BookOpen;
  const allAnswered = questions ? questions.every((q) => answers[q.id] != null) : false;

  return (
    <div className="mx-auto mt-2 max-w-2xl space-y-4">
      <button
        onClick={() => router.push("/navigator")}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-route"
      >
        <ArrowLeft className="h-4 w-4" /> Back to route
      </button>

      {error && <Card className="border-bad/30 bg-bad/5 p-3 text-sm text-bad">{error}</Card>}

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-route-soft text-route">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="route">{step.type}</Badge>
              <span className="text-xs text-faint">in {found?.phaseTitle}</span>
              {alreadyDone && (
                <Badge tone="mastered">
                  Completed{step.score != null ? ` · ${step.score}%` : ""}
                </Badge>
              )}
              {step.status === "locked" && <Badge tone="neutral">Locked</Badge>}
            </div>
            <h1 className="mt-1 text-xl font-semibold leading-snug">{step.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> ~{step.durationHours}h
              </span>
              <span className="capitalize">{step.difficulty}</span>
            </div>
          </div>
        </div>

        {/* Why this step */}
        <div className="mt-4 rounded-xl border border-marker/30 bg-marker-soft/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marker">
            <Target className="h-3.5 w-3.5" /> Why this step
          </p>
          <p className="mt-1 text-sm text-ink">{step.why}</p>
        </div>

        {step.description && <p className="mt-3 text-sm text-muted">{step.description}</p>}

        {step.skillIds.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Builds</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {step.skillIds.map((id) => (
                <span key={id} className="rounded-full bg-surface px-2.5 py-1 text-xs">
                  {skillName(id)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Resource / project actions */}
      {!isAssessment && (
        <Card className="p-5">
          {step.url && (
            <a href={step.url} target="_blank" rel="noreferrer">
              <Button variant="soft" className="w-full">
                Open resource <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
          <div className={cx("flex flex-wrap gap-2", step.url && "mt-3")}>
            <Button onClick={markComplete} loading={completing} disabled={alreadyDone}>
              <CheckCircle2 className="h-4 w-4" />
              {alreadyDone ? "Completed" : "Mark complete"}
            </Button>
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-medium text-muted">How was it? Your feedback reroutes what comes next.</p>
            {profileId && <FeedbackBar profileId={profileId} stepId={step.id} resourceId={step.resourceId} onResult={setBundle} />}
          </div>
        </Card>
      )}

      {/* Assessment result */}
      {result && (
        <Card className="border-route/40 p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-route-soft text-route">
            <Trophy className="h-7 w-7" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{result.scorePct}%</p>
          <p className="text-sm text-muted">
            {result.correct}/{result.total} correct
            {result.scorePct >= 70 ? " — checkpoint cleared!" : " — we'll reinforce the weak spots."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => router.push("/navigator")}>
              <Navigation className="h-4 w-4" /> See your updated route
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setAnswers({});
                setQuestions(null);
                setRetaking(true);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          </div>
        </Card>
      )}

      {/* Assessment: already done, offer retake */}
      {isAssessment && alreadyDone && !showQuiz && !result && (
        <Card className="p-5 text-center">
          <p className="font-semibold">You've cleared this checkpoint{step.score != null ? ` at ${step.score}%` : ""}.</p>
          <Button className="mx-auto mt-3" variant="outline" onClick={() => setRetaking(true)}>
            <RotateCcw className="h-4 w-4" /> Retake checkpoint
          </Button>
        </Card>
      )}

      {/* Assessment quiz */}
      {showQuiz && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-route" />
            <h2 className="font-semibold">Checkpoint</h2>
            {questions && <span className="ml-auto text-xs text-faint">{questions.length} questions</span>}
          </div>

          {!questions ? (
            <div className="mt-4"><Spinner label="Loading questions…" /></div>
          ) : questions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No questions available for this checkpoint yet.</p>
          ) : (
            <>
              <ol className="mt-4 space-y-5">
                {questions.map((q, qi) => (
                  <li key={q.id}>
                    <p className="text-sm font-medium">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const selected = answers[q.id] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                            className={cx(
                              "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                              selected
                                ? "border-route bg-route-soft text-route"
                                : "border-line bg-surface text-ink hover:border-route/40",
                            )}
                          >
                            <span
                              className={cx(
                                "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]",
                                selected ? "border-route bg-route text-white" : "border-line text-faint",
                              )}
                            >
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
              <Button className="mt-5 w-full" onClick={submitCheckpoint} loading={submitting} disabled={!allAnswered}>
                {allAnswered ? "Submit checkpoint" : "Answer all questions to submit"}
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
