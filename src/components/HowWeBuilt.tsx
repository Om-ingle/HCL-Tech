"use client";

import { useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { Card, cx } from "@/components/ui";

/**
 * §14: a lightweight, always-honest explanation of how the route was assembled —
 * goal reading, prerequisite ordering, and where each resource came from. Every
 * line is generated deterministically in `generateRoadmap`, never by the LLM.
 */
export function HowWeBuilt({
  how,
  className,
  defaultOpen = false,
}: {
  how?: string[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!how || how.length === 0) return null;

  return (
    <Card className={cx("p-4", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold"
        aria-expanded={open}
      >
        <Wrench className="h-4 w-4 text-route" />
        How we built your path
        <ChevronDown
          className={cx("ml-auto h-4 w-4 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <ul className="mt-3 space-y-2">
          {how.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-route" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-faint">
          {how.length} decision{how.length === 1 ? "" : "s"} behind this route — tap to read them.
        </p>
      )}
    </Card>
  );
}
