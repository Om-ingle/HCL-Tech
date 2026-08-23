import type {
  HydratedStep,
  Phase,
  Roadmap,
  Step,
  StepStatus,
} from "./types";

export type { HydratedStep } from "./types";

export interface StepStateLite {
  status: StepStatus;
  score?: number | null;
}

export interface PhaseView {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  skillIds: string[];
  concepts: string[];
  milestone: string;
  estimatedWeeks: number;
  prerequisitePhaseIds: string[];
  steps: HydratedStep[];
  phaseStatus: "locked" | "active" | "done";
  completed: number;
  total: number;
}

export interface NextAction {
  step: HydratedStep;
  phaseTitle: string;
  reason: string;
}

export interface NavigatorView {
  phases: PhaseView[];
  progress: {
    overallPct: number;
    completedSteps: number;
    totalSteps: number;
    currentPhaseIndex: number;
    estimatedWeeksLeft: number;
  };
  nextAction: NextAction | null;
}

const isResolved = (s: StepStatus) => s === "completed" || s === "skipped";

export function hydrateRoadmap(
  roadmap: Roadmap,
  states: Map<string, StepStateLite>,
): NavigatorView {
  // phaseDone depends only on persisted resolved statuses.
  const phaseDone = new Map<string, boolean>();
  for (const phase of roadmap.phases) {
    const done = phase.steps.every((st) => isResolved(states.get(st.id)?.status ?? "locked"));
    phaseDone.set(phase.id, phase.steps.length > 0 ? done : true);
  }

  const phaseUnlocked = (phase: Phase) =>
    phase.prerequisitePhaseIds.every((pid) => phaseDone.get(pid) ?? false);

  const views: PhaseView[] = roadmap.phases.map((phase) => {
    const unlocked = phaseUnlocked(phase);
    const hydratedSteps: HydratedStep[] = phase.steps.map((step) => {
      const persisted = states.get(step.id)?.status;
      let status: StepStatus;
      if (persisted && persisted !== "locked" && persisted !== "available") {
        status = persisted; // completed / skipped / in_progress
      } else if (!unlocked) {
        status = "locked";
      } else {
        const preOk = step.prerequisiteStepIds.every((sid) =>
          isResolved(states.get(sid)?.status ?? "locked"),
        );
        status = preOk ? "available" : "locked";
      }
      return {
        ...step,
        status,
        score: states.get(step.id)?.score ?? null,
        phaseId: phase.id,
        phaseIndex: phase.index,
      };
    });

    const completed = hydratedSteps.filter((s) => isResolved(s.status)).length;
    const total = hydratedSteps.length;
    const phaseStatus: PhaseView["phaseStatus"] = !unlocked
      ? "locked"
      : completed >= total && total > 0
        ? "done"
        : "active";

    return {
      id: phase.id,
      index: phase.index,
      title: phase.title,
      subtitle: phase.subtitle,
      skillIds: phase.skillIds,
      concepts: phase.concepts,
      milestone: phase.milestone,
      estimatedWeeks: phase.estimatedWeeks,
      prerequisitePhaseIds: phase.prerequisitePhaseIds,
      steps: hydratedSteps,
      phaseStatus,
      completed,
      total,
    };
  });

  const totalSteps = views.reduce((s, p) => s + p.total, 0);
  const completedSteps = views.reduce((s, p) => s + p.completed, 0);
  const overallPct = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
  const currentPhaseIndex = Math.max(
    0,
    views.findIndex((p) => p.phaseStatus === "active"),
  );
  const estimatedWeeksLeft = views
    .filter((p) => p.phaseStatus !== "done")
    .reduce((s, p) => s + p.estimatedWeeks, 0);

  return {
    phases: views,
    progress: { overallPct, completedSteps, totalSteps, currentPhaseIndex, estimatedWeeksLeft },
    nextAction: computeNextAction(views),
  };
}

function computeNextAction(views: PhaseView[]): NextAction | null {
  for (const phase of views) {
    if (phase.phaseStatus === "locked" || phase.phaseStatus === "done") continue;
    const candidate =
      phase.steps.find((s) => s.status === "in_progress") ??
      phase.steps.find((s) => s.status === "available");
    if (candidate) {
      return {
        step: candidate,
        phaseTitle: phase.title,
        reason: `${candidate.why} It's the next unlocked step in ${phase.title}, so tackling it now keeps your prerequisites in order.`,
      };
    }
  }
  // nothing available but not everything done → surface earliest available anywhere
  for (const phase of views) {
    const c = phase.steps.find((s) => s.status === "available");
    if (c) return { step: c, phaseTitle: phase.title, reason: c.why };
  }
  return null;
}
