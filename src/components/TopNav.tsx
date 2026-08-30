"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, Map, Target, LayoutDashboard, Sparkles, MessageCircle, Check, CircleDot, Sun, Moon } from "lucide-react";
import { api } from "@/lib/client/api";
import { useAppStore } from "@/store/useAppStore";
import { cx } from "./ui";
import { useTheme } from "./useTheme";

const LINKS = [
  { href: "/navigator", label: "Map", icon: Map },
  { href: "/gap", label: "Skill Gap", icon: Target },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profileId, aiStatus, setSettingsOpen, setAssistantOpen, setProfileId, fireReroute } = useAppStore();
  const [seeding, setSeeding] = useState(false);
  const { dark, toggle, ready } = useTheme();

  async function quickDemo() {
    setSeeding(true);
    try {
      const { personas } = await api.seed();
      const pick = personas[0];
      if (pick) {
        setProfileId(pick.id);
        fireReroute([`Loaded demo persona “${pick.name}” — mapping the route to ${pick.roleName}.`]);
        router.push("/navigator");
      }
    } catch {
      /* ignore */
    } finally {
      setSeeding(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
      {/* min-h + flex-wrap: the bar reflows to a second row instead of
          overflowing when logo + nav + actions don't fit (≤~390px). Desktop
          never wraps — content fits on one line from 430px up. */}
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-route text-white">
            <Compass className="h-4 w-4" />
          </span>
          Skill Atlas
        </Link>

        {profileId && (
          <nav className="flex items-center gap-0.5 sm:ml-4 sm:gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition sm:px-3",
                    active ? "bg-route-soft text-route" : "text-muted hover:bg-line/40 hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!profileId && (
            <button
              onClick={quickDemo}
              disabled={seeding}
              className="hidden rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:text-ink sm:inline-flex disabled:opacity-50"
            >
              {seeding ? "Loading…" : "Try a demo"}
            </button>
          )}

          {profileId && (
            <button
              onClick={() => setAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:text-ink"
              title="Ask the Navigator"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-sm hover:border-route/40 sm:px-3"
            title="Configure the AI provider"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-route" />
            <span className="hidden text-muted lg:inline">AI Brain:</span>
            <span className="hidden max-w-[9rem] truncate font-medium sm:inline">
              {aiStatus ? aiStatus.providerLabel : "…"}
            </span>
            {aiStatus?.available ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-good" />
            ) : (
              <span title="Demo / fallback mode" className="inline-flex">
                <CircleDot className="h-3.5 w-3.5 text-faint" />
              </span>
            )}
          </button>

          <button
            onClick={toggle}
            className="inline-flex items-center rounded-full border border-line bg-surface p-2 text-muted hover:text-ink"
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {ready && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
