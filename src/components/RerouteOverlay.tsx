"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigation, LocateFixed } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

// The signature "GPS recalculating" moment — plays whenever the path reroutes.
export function RerouteOverlay() {
  const reroute = useAppStore((s) => s.reroute);
  const clearReroute = useAppStore((s) => s.clearReroute);
  const [phase, setPhase] = useState<"recalc" | "done">("recalc");

  useEffect(() => {
    if (!reroute) return;
    setPhase("recalc");
    const t1 = setTimeout(() => setPhase("done"), 1100);
    const t2 = setTimeout(() => clearReroute(), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reroute, clearReroute]);

  return (
    <AnimatePresence>
      {reroute && (
        <motion.div
          key={reroute.seq}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={clearReroute}
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 12, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-line bg-raised p-6 shadow-lift"
          >
            <div className="flex items-center gap-3">
              <motion.span
                animate={phase === "recalc" ? { rotate: [0, -20, 20, -12, 0] } : { rotate: 0 }}
                transition={{ repeat: phase === "recalc" ? Infinity : 0, duration: 0.9 }}
                className="grid h-11 w-11 place-items-center rounded-full bg-route-soft text-route"
              >
                {phase === "recalc" ? <LocateFixed className="h-5 w-5" /> : <Navigation className="h-5 w-5" />}
              </motion.span>
              <div>
                <p className="text-xs uppercase tracking-wide text-faint">Learning GPS</p>
                <p className="font-semibold">
                  {phase === "recalc" ? "Recalculating route…" : "Route updated"}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {phase === "done" && (
                <motion.ul
                  key="changes"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 space-y-2"
                >
                  {reroute.changes.map((c, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink"
                    >
                      <span className="text-route">→</span>
                      {c}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>

            <p className="mt-4 text-center text-xs text-faint">tap anywhere to dismiss</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
