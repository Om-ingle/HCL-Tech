import type { Difficulty, Resource, Skill } from "@/lib/domain/types";
import { SKILL_BY_ID } from "@/lib/catalog/skills";
import { skillName } from "@/lib/catalog";

// ── Layer 3: generated learning modules ───────────────────────────────────────
// When neither the internal catalog nor the canonical registry nor external
// search covers a skill, we still owe the learner something concrete. These
// modules are synthesized from SKILL GRAPH METADATA only — description,
// prerequisites, related skills, tier — so they are always on-topic and never
// contain an invented URL. `url` is deliberately absent.

const RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Stable, seed-free hash so generated content is identical across runs. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Difficulty implied by a skill's position in the graph. */
export function difficultyForSkill(skill: Skill): Difficulty {
  return skill.tier <= 2 ? "beginner" : skill.tier <= 4 ? "intermediate" : "advanced";
}

function hoursForTier(tier: number): number {
  return [6, 8, 12, 16, 20][Math.min(4, Math.max(0, tier - 1))];
}

function trimPeriod(s: string): string {
  return s.replace(/\.\s*$/, "");
}

/** A concrete, checkable syllabus derived from the graph. */
export function conceptsFor(skill: Skill): string[] {
  const out: string[] = [];
  out.push(`What ${skill.name} is, and why ${skill.domain} work depends on it`);
  out.push(`Core model: ${trimPeriod(skill.description)}`);
  const prereqs = skill.prerequisites.map(skillName).filter(Boolean);
  if (prereqs.length) out.push(`How it builds on ${prereqs.slice(0, 3).join(", ")}`);
  const related = (skill.related ?? []).map(skillName).filter(Boolean);
  if (related.length) out.push(`Where it connects next: ${related.slice(0, 3).join(", ")}`);
  const aliases = (skill.aliases ?? []).filter((a) => a.length > 3);
  if (aliases.length) out.push(`Vocabulary you'll see in job posts: ${aliases.slice(0, 4).join(", ")}`);
  out.push(`One worked example end to end, then one you write from scratch`);
  out.push(`Failure modes and how practitioners debug them`);
  return out;
}

/**
 * A self-contained study module for a skill with no discovered resource.
 * Better than "no resources found": it names the concepts, the practice, and
 * the check, all from graph facts.
 */
export function generateModule(skillId: string, level?: Difficulty): Resource | null {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return null;
  const difficulty = level ?? difficultyForSkill(skill);
  const concepts = conceptsFor(skill);
  const prereqNames = skill.prerequisites.map(skillName).filter(Boolean);
  return {
    id: `mod-${skillId}`,
    title: `${skill.name} — guided study module`,
    type: "module",
    domain: skill.domain,
    difficulty,
    skills: [skillId],
    prerequisites: skill.prerequisites,
    durationHours: hoursForTier(skill.tier),
    description:
      `A structured module we generated for ${skill.name} because no curated resource covers it yet. ` +
      `Work through the concepts in order, then do the practice task.` +
      (prereqNames.length ? ` Assumes ${prereqNames.slice(0, 2).join(" and ")}.` : ""),
    tags: [skill.domain.toLowerCase(), "generated", "module"],
    provider: "Skill Atlas",
    origin: "generated",
    concepts,
  };
}

// ── Project ladders ───────────────────────────────────────────────────────────
// Reusable per-SKILL templates, one rung per difficulty. Keyed to skills so any
// goal that touches the skill inherits the ladder — no per-career authoring.

type Rung = [title: string, deliverable: string];

const LADDERS: Record<string, [Rung, Rung, Rung]> = {
  "kernel-development": [
    ["Hello-world kernel module", "A loadable module that logs on init/exit, plus the Makefile that builds it against your running kernel."],
    ["Character device driver", "A /dev node with read/write and ioctl, correct locking, and a userspace test program."],
    ["Diagnose a kernel bug", "A written post-mortem: reproduce a fault, read the oops/panic trace, and isolate the cause with ftrace or kgdb."],
  ],
  "device-drivers": [
    ["Read a real driver", "An annotated walkthrough of an in-tree driver's probe/remove path."],
    ["Platform driver with sysfs", "A driver exposing device attributes through sysfs, with a device-tree binding."],
    ["Interrupt-driven driver", "A driver using IRQ handling and DMA, benchmarked under load."],
  ],
  "operating-systems": [
    ["Shell from scratch", "A shell supporting pipes, redirection, and job control."],
    ["Thread library or scheduler", "A user-level scheduler with at least two policies and a measured comparison."],
    ["Toy kernel that boots", "A bootable kernel with paging, interrupts, and a scheduler."],
  ],
  concurrency: [
    ["Producer/consumer queue", "A bounded blocking queue with tests that fail under a naive implementation."],
    ["Thread-pool executor", "A work-stealing pool with graceful shutdown and a benchmark vs. single-threaded."],
    ["Lock-free structure", "A lock-free queue or stack, validated with a race detector under contention."],
  ],
  ros: [
    ["Publisher/subscriber pair", "Two ROS 2 nodes exchanging messages, launched from a single launch file."],
    ["Sensor-to-actuator pipeline", "A node graph that reads sensor input, transforms it, and commands motion in simulation."],
    ["Multi-node robot stack", "A full package with parameters, TF frames, lifecycle nodes, and a recorded bag demo."],
  ],
  "control-systems": [
    ["Simulate a PID loop", "A plotted step response for a first-order plant with tuned gains and a written tuning rationale."],
    ["Stabilize an inverted pendulum", "A cart-pole controller in simulation with a stability argument."],
    ["State-space controller", "An LQR or MPC controller compared against PID on the same plant, with tracked cost."],
  ],
  "state-estimation": [
    ["1-D Kalman filter", "A filter fusing a noisy position sensor, with residual plots."],
    ["IMU + odometry fusion", "An EKF fusing two sensor streams on recorded data, with covariance analysis."],
    ["Robust estimator", "An estimator handling outliers and dropouts, benchmarked against ground truth."],
  ],
  "motion-planning": [
    ["Grid path planner", "A* on an occupancy grid with a visualized path."],
    ["Sampling-based planner", "An RRT/PRM planner in a cluttered 2-D world, with path smoothing."],
    ["Kinodynamic planner", "A planner respecting velocity/acceleration limits, evaluated on success rate and cost."],
  ],
  "autonomous-systems": [
    ["Waypoint follower", "A vehicle that follows waypoints in simulation with a safety stop."],
    ["Perception → planning loop", "A closed loop from sensing to obstacle avoidance in a simulated environment."],
    ["Full autonomy stack demo", "An integrated stack with localization, planning, and control, plus a failure-mode analysis."],
  ],
  "embedded-c": [
    ["Blink without a framework", "Direct register writes toggling a pin, with the datasheet lines you used."],
    ["Interrupt-driven sensor read", "A firmware image sampling a sensor via interrupts and a ring buffer."],
    ["Power-aware firmware", "Firmware using sleep modes, with measured current draw before and after."],
  ],
  microcontrollers: [
    ["Sensor + display device", "A working gadget that reads a sensor and shows the value."],
    ["Data-logging device", "A device buffering readings and flushing them over UART/SD with timestamps."],
    ["Multi-peripheral product", "A firmware project coordinating I2C, SPI, timers, and a watchdog."],
  ],
  rtos: [
    ["Two-task RTOS app", "Two tasks at different priorities with a queue between them."],
    ["Deadline-driven system", "A periodic control task with measured jitter and a documented worst-case path."],
    ["Priority-inversion hunt", "A reproduction of priority inversion and its fix via mutex priority inheritance."],
  ],
  "computer-graphics": [
    ["Software rasterizer", "A CPU renderer drawing shaded triangles with a depth buffer."],
    ["Textured 3-D scene", "A lit, textured scene with a movable camera."],
    ["Renderer with shadows & PBR", "A renderer with shadow mapping and physically based shading, with frame timings."],
  ],
  "graphics-apis": [
    ["First triangle", "A windowed app drawing a triangle through the modern pipeline."],
    ["Model loader + camera", "An app loading a mesh, applying transforms, and orbiting a camera."],
    ["Multi-pass pipeline", "A deferred or post-process pipeline with render targets and GPU timing."],
  ],
  "ray-tracing": [
    ["Ray-sphere tracer", "A PPM image with spheres, diffuse shading, and antialiasing."],
    ["Path tracer with materials", "A path tracer with metal/dielectric materials and importance sampling."],
    ["Accelerated tracer", "A BVH-accelerated tracer with a measured speedup over brute force."],
  ],
  "game-engine-architecture": [
    ["Game loop + input", "A fixed-timestep loop with input handling and a rendered sprite."],
    ["Entity-component system", "An ECS with at least three systems and a scene loaded from data."],
    ["Engine slice with profiler", "Renderer + physics + assets running together, with a frame-budget breakdown."],
  ],
  "quantitative-trading": [
    ["Signal on historical data", "A documented signal with summary statistics on a real price series."],
    ["Backtested strategy", "A strategy with realistic costs, out-of-sample results, and a drawdown chart."],
    ["Portfolio-level system", "A multi-asset system with position sizing, risk limits, and walk-forward validation."],
  ],
  backtesting: [
    ["Vectorized backtest", "A notebook backtest of a moving-average rule with an equity curve."],
    ["Event-driven backtester", "An engine processing bars in order with slippage and commission models."],
    ["Bias audit", "A written audit finding look-ahead, survivorship, and overfitting risks in a backtest."],
  ],
  "derivatives-pricing": [
    ["Black-Scholes calculator", "A pricer with Greeks, checked against published values."],
    ["Monte Carlo pricer", "A simulation pricer for a path-dependent option with convergence analysis."],
    ["Model comparison", "Binomial vs. Monte Carlo vs. closed form on the same instrument, with error tables."],
  ],
  "time-series": [
    ["Decompose a series", "Trend/seasonality decomposition with stationarity tests."],
    ["Forecast with validation", "An ARIMA/ETS forecast with rolling-origin evaluation against a naive baseline."],
    ["Volatility model", "A GARCH-family model with residual diagnostics."],
  ],
  "quantum-programming": [
    ["Bell state circuit", "A two-qubit entangling circuit with measured histogram output."],
    ["Grover search", "An implementation on 3+ qubits with amplification explained."],
    ["Noisy-hardware run", "The same circuit on a simulator and real backend, with error mitigation applied."],
  ],
  "quantum-algorithms": [
    ["Deutsch-Jozsa", "An implementation plus a written statement of the speedup and its limits."],
    ["Phase estimation", "A working phase-estimation routine with accuracy vs. qubit-count analysis."],
    ["Variational algorithm", "A VQE/QAOA run on a small problem, benchmarked against classical solution."],
  ],
  compilers: [
    ["Tokenizer + parser", "A parser producing an AST for a small expression language."],
    ["Tree-walking interpreter", "An interpreter with variables, functions, and closures, plus a test suite."],
    ["Compiler with codegen", "A compiler emitting bytecode or native code, with at least one optimization pass."],
  ],
  "reverse-engineering": [
    ["Analyze a small binary", "A written report on a stripped binary's behaviour from static analysis."],
    ["Reconstruct an algorithm", "Recovered pseudocode for a non-trivial routine, validated against runtime behaviour."],
    ["Unpack and document", "An analysis of an obfuscated/packed sample in an isolated lab, with indicators documented."],
  ],
  "pen-testing": [
    ["Lab web app assessment", "A findings report for a deliberately vulnerable app (authorized lab only)."],
    ["Network assessment", "An authorized lab engagement with enumeration, exploitation, and remediation advice."],
    ["Full engagement report", "A scoped lab engagement with executive summary, risk ratings, and retest notes."],
  ],
  mlops: [
    ["Containerized model API", "A Dockerized inference endpoint with a health check."],
    ["Automated retrain pipeline", "A pipeline with tracked experiments, a model registry, and CI."],
    ["Production platform slice", "Deployment with monitoring, drift alerts, and a documented rollback."],
  ],
  "gpu-programming": [
    ["First parallel kernel", "A vector-add kernel with a correctness check against CPU output."],
    ["Optimized reduction", "A tiled reduction or matmul with measured occupancy and bandwidth."],
    ["Profiled hot path", "A real workload profiled and optimized, with before/after speedup evidence."],
  ],
  "distributed-systems": [
    ["Replicated key-value store", "A two-node store with a documented consistency model."],
    ["Consensus implementation", "A working leader election plus log replication with a partition test."],
    ["Fault-injection study", "A system tested under partitions and clock skew, with observed failure modes."],
  ],
};

/** The rung of a skill's project ladder that matches a difficulty. */
function rungFor(skillId: string, difficulty: Difficulty): Rung | null {
  const ladder = LADDERS[skillId];
  return ladder ? ladder[RANK[difficulty]] : null;
}

/**
 * A project for a set of skills. Prefers an authored ladder rung for the most
 * advanced skill involved; otherwise composes a template from graph metadata.
 */
export function generateProject(skillIds: string[], difficulty: Difficulty): Resource | null {
  const skills = skillIds.map((id) => SKILL_BY_ID[id]).filter(Boolean) as Skill[];
  if (!skills.length) return null;
  const anchor = skills.slice().sort((a, b) => b.tier - a.tier)[0];
  const others = skills.filter((s) => s.id !== anchor.id).slice(0, 2);

  const rung = rungFor(anchor.id, difficulty);
  const title = rung ? rung[0] : `Build something with ${anchor.name}`;
  const deliverable = rung
    ? rung[1]
    : `A small but complete artifact that exercises ${anchor.name}${others.length ? ` together with ${others.map((s) => s.name).join(" and ")}` : ""}, plus a short README explaining your design decisions.`;

  const hours = { beginner: 8, intermediate: 14, advanced: 22 }[difficulty];
  return {
    id: `proj-${anchor.id}-${difficulty}`,
    title,
    type: "project",
    domain: anchor.domain,
    difficulty,
    skills: Array.from(new Set([anchor.id, ...others.map((s) => s.id)])),
    prerequisites: anchor.prerequisites,
    durationHours: hours,
    description: `${deliverable} Scope it to ${hours} hours — finished and explainable beats ambitious and abandoned.`,
    tags: [anchor.domain.toLowerCase(), "generated", "project", difficulty],
    provider: "Skill Atlas",
    origin: "generated",
    concepts: rung ? undefined : conceptsFor(anchor).slice(0, 3),
  };
}

/** Ladder coverage, surfaced in stats/debug output. */
export const PROJECT_LADDER_SKILL_IDS = Object.keys(LADDERS);

/** Deterministic pick from a list — used where variety matters but randomness doesn't. */
export function stablePick<T>(items: T[], seed: string): T {
  return items[hash(seed) % items.length];
}
