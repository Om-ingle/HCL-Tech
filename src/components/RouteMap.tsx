"use client";

import {
  Lock,
  CheckCircle2,
  Circle,
  SkipForward,
  MapPin,
  Flag,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import type { HydratedStep, PhaseView } from "@/lib/domain/nextAction";
import { Badge, Button, cx } from "./ui";

const KIND_ICON = { resource: BookOpen, project: FlaskConical, assessment: ClipboardCheck } as const;

const STEP_STATUS_ICON = {
  completed: <CheckCircle2 className="h-4 w-4 text-good" />,
  skipped: <SkipForward className="h-4 w-4 text-faint" />,
  in_progress: <Circle className="h-4 w-4 text-marker" />,
  available: <Circle className="h-4 w-4 text-route" />,
  locked: <Lock className="h-4 w-4 text-faint" />,
} as const;

export function RouteMap({
  phases,
  currentPhaseIndex,
  onOpen,
  onComplete,
  completingId,
}: {
  phases: PhaseView[];
  currentPhaseIndex: number;
  onOpen: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  completingId: string | null;
}) {
  return (
    <div className="relative">
      {/* the route line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-line" aria-hidden />
      <ul className="space-y-4">
        {phases.map((phase, i) => (
          <PhaseStation
            key={phase.id}
            phase={phase}
            isCurrent={i === currentPhaseIndex}
            onOpen={onOpen}
            onComplete={onComplete}
            completingId={completingId}
          />
        ))}
      </ul>
    </div>
  );
}

function PhaseStation({
  phase,
  isCurrent,
  onOpen,
  onComplete,
  completingId,
}: {
  phase: PhaseView;
  isCurrent: boolean;
  onOpen: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  completingId: string | null;
}) {
  const done = phase.phaseStatus === "done";
  const locked = phase.phaseStatus === "locked";
  const isCapstone = phase.title === "Capstone & Portfolio";

  return (
    <li className="relative pl-10">
      {/* station marker */}
      <span
        className={cx(
          "absolute left-0 top-1 grid h-8 w-8 place-items-center rounded-full border-2 bg-paper",
          done ? "border-good text-good" : locked ? "border-line text-faint" : "border-route text-route",
          isCurrent && "ring-4 ring-marker-soft",
        )}
      >
        {isCapstone ? (
          <Flag className="h-4 w-4" />
        ) : isCurrent ? (
          <MapPin className="h-4 w-4 text-marker" />
        ) : done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <span className="text-xs font-semibold">{phase.index + 1}</span>
        )}
      </span>

      <div
        className={cx(
          "rounded-2xl border bg-raised p-4 shadow-card transition",
          locked ? "opacity-60" : "opacity-100",
          isCurrent ? "border-marker/50" : "border-line",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{phase.title}</h3>
          {isCurrent && <Badge tone="route">You are here</Badge>}
          {done && <Badge tone="mastered">Done</Badge>}
          {locked && <Badge tone="neutral">Locked</Badge>}
          <span className="ml-auto text-xs text-faint">
            ~{phase.estimatedWeeks}w · {phase.completed}/{phase.total} steps
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{phase.subtitle}</p>

        <div className="mt-1 flex items-center gap-1.5 text-xs text-route">
          <Flag className="h-3.5 w-3.5" />
          <span className="text-muted">{phase.milestone}</span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {phase.steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onOpen={onOpen}
              onComplete={onComplete}
              completing={completingId === step.id}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

function StepRow({
  step,
  onOpen,
  onComplete,
  completing,
}: {
  step: HydratedStep;
  onOpen: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  completing: boolean;
}) {
  const Icon = KIND_ICON[step.kind] ?? BookOpen;
  const actionable = step.status === "available" || step.status === "in_progress";
  const resolved = step.status === "completed" || step.status === "skipped";

  return (
    <li
      className={cx(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
        actionable ? "hover:bg-surface" : "",
      )}
    >
      <span className="shrink-0">{STEP_STATUS_ICON[step.status]}</span>
      <Icon className="h-4 w-4 shrink-0 text-faint" />
      <button
        onClick={() => onOpen(step.id)}
        className={cx(
          "min-w-0 flex-1 truncate text-left",
          resolved ? "text-muted line-through decoration-line" : "text-ink hover:text-route",
          step.status === "locked" && "text-faint",
        )}
        title={step.title}
      >
        {step.title}
        {step.score != null && <span className="ml-2 text-xs text-good">{step.score}%</span>}
      </button>

      {step.url && (
        <a
          href={step.url}
          target="_blank"
          rel="noreferrer"
          className="hidden text-faint hover:text-route group-hover:inline"
          title="Open resource"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {actionable && step.kind !== "assessment" && (
        <Button variant="soft" onClick={() => onComplete(step.id)} loading={completing} className="!px-2 !py-0.5 !text-xs">
          Done
        </Button>
      )}
      {actionable && step.kind === "assessment" && (
        <Button variant="soft" onClick={() => onOpen(step.id)} className="!px-2 !py-0.5 !text-xs">
          Checkpoint
        </Button>
      )}
    </li>
  );
}
