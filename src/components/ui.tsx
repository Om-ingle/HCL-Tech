"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "outline" | "danger" | "soft";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-route text-white hover:brightness-110 shadow-card",
  soft: "bg-route-soft text-route hover:brightness-95",
  ghost: "text-ink hover:bg-line/50",
  outline: "border border-line bg-raised text-ink hover:bg-line/30",
  danger: "bg-bad text-white hover:brightness-110",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-raised shadow-card", className)}>{children}</div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-route bg-route-soft text-route"
          : "border-line bg-surface text-muted hover:border-route/40 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  mastered: "bg-good/10 text-good border-good/30",
  partial: "bg-warn/10 text-warn border-warn/30",
  missing: "bg-bad/10 text-bad border-bad/30",
  neutral: "bg-line/40 text-muted border-line",
  route: "bg-route-soft text-route border-route/30",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof STATUS_STYLES;
  children: ReactNode;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[tone])}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ProgressRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--route)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * clamped) / 100}
        style={{ transition: "stroke-dashoffset 700ms ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="rotate-90 fill-ink text-sm font-semibold"
        style={{ transformOrigin: "center" }}
      >
        {clamped}%
      </text>
    </svg>
  );
}
