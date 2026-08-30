"use client";

import { Navigation, Clock, ArrowRight, BookOpen, FlaskConical, ClipboardCheck } from "lucide-react";
import type { NextAction } from "@/lib/domain/nextAction";
import { Button, Card } from "./ui";

const KIND_ICON = {
  resource: BookOpen,
  project: FlaskConical,
  assessment: ClipboardCheck,
} as const;

export function NextBestAction({
  next,
  onOpen,
  onComplete,
  completing,
}: {
  next: NextAction | null;
  onOpen: (stepId: string) => void;
  onComplete: (stepId: string) => void;
  completing: boolean;
}) {
  if (!next) {
    return (
      <Card className="border-good/40 bg-good/5 p-5">
        <div className="flex items-center gap-2 text-good">
          <Navigation className="h-5 w-5" />
          <p className="font-semibold">You've reached your destination 🎉</p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Every unlocked step is done. Take a checkpoint, add a new goal, or push your weekly hours to go further.
        </p>
      </Card>
    );
  }

  const Icon = KIND_ICON[next.step.kind] ?? BookOpen;
  return (
    <Card className="relative overflow-hidden border-marker/40 bg-marker-soft/40 p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-marker/10" />
      <div className="flex flex-wrap items-center gap-2 text-marker">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-marker text-white">
          <Navigation className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide">Next best action</p>
        <span className="ml-auto pl-1 text-xs text-muted">in {next.phaseTitle}</span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{next.step.title}</h3>
          <p className="mt-1 text-sm text-muted">{next.reason}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-faint">
            <span className="inline-flex items-center gap-1 capitalize">
              <Clock className="h-3.5 w-3.5" /> ~{next.step.durationHours}h · {next.step.type}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={() => onOpen(next.step.id)}>
          {next.step.kind === "assessment" ? "Take checkpoint" : "Start this step"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        {next.step.kind !== "assessment" && (
          <Button variant="outline" onClick={() => onComplete(next.step.id)} loading={completing}>
            Mark done
          </Button>
        )}
      </div>
    </Card>
  );
}
