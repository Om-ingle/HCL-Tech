"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Zap, Snowflake, Timer, Heart, Dumbbell } from "lucide-react";
import { api, type AdaptResponse } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { cx } from "./ui";

const SIGNALS = [
  { id: "very_useful", label: "Useful", icon: ThumbsUp },
  { id: "not_useful", label: "Not useful", icon: ThumbsDown },
  { id: "too_easy", label: "Too easy", icon: Zap },
  { id: "too_hard", label: "Too hard", icon: Snowflake },
  { id: "too_long", label: "Too long", icon: Timer },
  { id: "need_practice", label: "Need practice", icon: Dumbbell },
  { id: "interested", label: "More like this", icon: Heart },
] as const;

export function FeedbackBar({
  profileId,
  stepId,
  resourceId,
  compact,
  onResult,
}: {
  profileId: string;
  stepId?: string;
  resourceId?: string;
  compact?: boolean;
  onResult?: (res: AdaptResponse) => void;
}) {
  const fireReroute = useAppStore((s) => s.fireReroute);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function send(signal: string) {
    setBusy(signal);
    try {
      const res = await api.feedback({ profileId, signal, stepId, resourceId });
      setSent(signal);
      if (res.changes?.length) fireReroute(res.changes);
      onResult?.(res);
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  const list = compact ? SIGNALS.slice(0, 4) : SIGNALS;

  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          disabled={!!busy}
          onClick={() => send(id)}
          className={cx(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-50",
            sent === id
              ? "border-route bg-route-soft text-route"
              : "border-line bg-surface text-muted hover:border-route/40 hover:text-ink",
          )}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
      {sent && <span className="self-center text-xs text-good">Noted — route updated.</span>}
    </div>
  );
}
