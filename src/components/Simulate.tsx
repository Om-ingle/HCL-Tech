"use client";

import { useState } from "react";
import { SlidersHorizontal, Route } from "lucide-react";
import { ROLES } from "@/lib/catalog";
import { Button, Card } from "./ui";

// "What if" controls — the reroute trigger.
export function Simulate({
  weeklyHours,
  targetRoleId,
  onApply,
  busy,
}: {
  weeklyHours: number;
  targetRoleId: string | null;
  onApply: (payload: { weeklyHours?: number; targetRole?: string }) => void;
  busy: boolean;
}) {
  const [hours, setHours] = useState(weeklyHours);
  const [role, setRole] = useState(targetRoleId ?? "");

  const changed = hours !== weeklyHours || (role && role !== targetRoleId);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-route" />
        <h3 className="text-sm font-semibold">Simulate a reroute</h3>
      </div>
      <p className="mt-1 text-xs text-muted">Change your pace or destination and watch the route recalculate.</p>

      <label className="mt-3 block text-xs font-medium text-muted">Hours per week: {hours}</label>
      <input
        type="range"
        min={2}
        max={40}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="w-full accent-route"
      />

      <label className="mt-3 block text-xs font-medium text-muted">Change destination</label>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-route"
      >
        <option value="">Keep current role</option>
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <Button
        className="mt-3 w-full"
        disabled={!changed}
        loading={busy}
        onClick={() =>
          onApply({
            ...(hours !== weeklyHours ? { weeklyHours: hours } : {}),
            ...(role && role !== targetRoleId ? { targetRole: role } : {}),
          })
        }
      >
        <Route className="h-4 w-4" /> Recalculate
      </Button>
    </Card>
  );
}
