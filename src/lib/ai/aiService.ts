import type { Difficulty, DynamicSkillDef, GoalResolution, LearningStyle, ProfileDraft } from "@/lib/domain/types";
import { detectSkills, getRole, matchRole } from "@/lib/catalog";
import { dynamicSkillDefsFor, dynamicSkillId, ensureDynamicSkills } from "@/lib/catalog/dynamic";
import { resolveGoal, buildGoalInput, validateSkillNames, type GoalHint } from "@/lib/domain/goalResolver";
import type { AiConfigInput } from "@/lib/validation/schemas";
import {
  configForTest,
  getStoredKey,
  resolveAiConfig,
  toPublicStatus,
  type PublicAiStatus,
} from "./config";
import { getProvider } from "./registry";
import { PROVIDER_META, type ResolvedAiConfig, type LLMProvider } from "./types";
import {
  buildAssistantRequest,
  buildExtractionRequest,
  buildGoalRequest,
  type AssistantContext,
  type AssistantHistoryMessage,
} from "./prompts";
import { assistantFallback, extractProfileFallback } from "./fallback";
import type { TestResult } from "./types";

export type AiSource = "llm" | "fallback";

export interface ExtractionOutcome {
  draft: ProfileDraft;
  source: AiSource;
  provider?: string;
  /** Set when the saved model was retired/invalid and the default was used. */
  note?: string;
}

export interface AssistantOutcome {
  text: string;
  source: AiSource;
  provider?: string;
  /** Set when a configured provider was tried but failed (key-safe reason). */
  note?: string;
}

/** Public, key-free status for the UI ("AI Brain: <provider> ✓"). */
export async function getAiStatus(sessionId: string): Promise<PublicAiStatus> {
  const cfg = await resolveAiConfig(sessionId);
  return toPublicStatus(cfg);
}

// ── Profile extraction (Step 4 of the flow) ───────────────────────────────────
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const STYLES: LearningStyle[] = ["video", "reading", "project", "mixed"];

function asInt(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
}

/** Merge a raw LLM extraction object over the deterministic baseline draft. */
function mergeLlmDraft(base: ProfileDraft, obj: Record<string, unknown>, rawText: string): ProfileDraft {
  const out: ProfileDraft = { ...base, extractionSource: "llm", notes: ["Understood by AI — edit anything that's off."] };

  if (typeof obj.name === "string" && obj.name.trim()) out.name = obj.name.trim().slice(0, 40);

  if (typeof obj.targetRole === "string" && obj.targetRole.trim()) {
    const role = matchRole(obj.targetRole);
    if (role) {
      out.targetRoleId = role.id;
      out.targetRole = role.name;
    } else {
      out.targetRole = obj.targetRole.trim().slice(0, 80);
      out.targetRoleId = undefined;
    }
  }

  if (typeof obj.experienceLevel === "string" && DIFFICULTIES.includes(obj.experienceLevel as Difficulty))
    out.experienceLevel = obj.experienceLevel as Difficulty;
  if (typeof obj.learningStyle === "string" && STYLES.includes(obj.learningStyle as LearningStyle))
    out.learningStyle = obj.learningStyle as LearningStyle;

  const wh = asInt(obj.weeklyHours, 1, 80);
  if (wh) out.weeklyHours = wh;
  const tw = asInt(obj.timelineWeeks, 2, 200);
  if (tw) out.timelineWeeks = tw;

  if (typeof obj.careerOutcome === "string" && obj.careerOutcome.trim())
    out.careerOutcome = obj.careerOutcome.trim().slice(0, 200);

  const interests = asStringArray(obj.interests);
  if (interests.length) out.interests = interests.slice(0, 8);

  // Map free-text known skills → catalog skill ids, unioned with the baseline detection.
  const known = asStringArray(obj.knownSkills);
  const mapped = known.length ? detectSkills(known.join(". ")) : [];
  const union = new Set<string>([...(base.knownSkillIds ?? []), ...mapped]);
  if (union.size) out.knownSkillIds = Array.from(union);

  if (!out.goalText) out.goalText = rawText.slice(0, 400);
  return out;
}

/**
 * Extract a learner profile from free text.
 * Always computes the deterministic baseline; upgrades with the LLM when a
 * provider is available and mode ≠ demo. Any provider error falls back silently
 * (no key material is ever logged).
 */
export async function extractProfile(text: string, sessionId: string): Promise<ExtractionOutcome> {
  const baseline = extractProfileFallback(text);
  const cfg = await resolveAiConfig(sessionId);
  if (!cfg.available || cfg.mode === "demo") return { draft: baseline, source: "fallback" };

  const provider = getProvider(cfg.provider);
  if (!provider) return { draft: baseline, source: "fallback" };

  try {
    const { value: raw, note } = await callWithModelFallback(
      provider, cfg, (c) => provider.generateStructured(buildExtractionRequest(text), c),
    );
    if (raw && typeof raw === "object") {
      return {
        draft: mergeLlmDraft(baseline, raw as Record<string, unknown>, text),
        source: "llm",
        provider: provider.label,
        ...(note ? { note } : {}),
      };
    }
  } catch (err) {
    console.warn(`[ai] extraction fell back to deterministic (${provider.id}):`, safeErr(err));
  }
  return { draft: baseline, source: "fallback" };
}

// ── Goal resolution (open-goal engine) ────────────────────────────────────────
export interface GoalOutcome {
  resolution: GoalResolution;
  source: AiSource;
  provider?: string;
  /** Set when a configured provider was tried but the goal call failed. */
  note?: string;
  /** LLM-inferred skills registered outside the curated catalog, so the client
   *  can persist them with the profile. Empty when nothing new was created. */
  dynamicSkills: DynamicSkillDef[];
}

/** Accept candidateSkills as plain strings OR {name, blurb} objects — models vary. */
function parseCandidates(v: unknown): { name: string; blurb?: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; blurb?: string }[] = [];
  for (const x of v) {
    if (typeof x === "string") out.push({ name: x });
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (typeof o.name === "string" && o.name.trim()) {
        out.push({ name: o.name, blurb: typeof o.blurb === "string" ? o.blurb : undefined });
      }
    }
  }
  return out.slice(0, 16);
}

/**
 * Resolve ANY natural-language goal to target skills. The deterministic resolver
 * runs first and always produces a usable result; when a provider is configured
 * we add ONE small structured call as a hint. Candidate skills that exist in the
 * graph are validated normally; topics OUTSIDE the catalog (battery chemistry,
 * electrochemistry, …) are registered as dynamic skills so the goal genuinely
 * drives the route — resources come from the discovery layers (including
 * generated study modules, never invented URLs). Called once at onboarding —
 * never on every roadmap regeneration.
 */
export async function resolveGoalText(
  text: string,
  targetRole?: string,
  opts: { roleIsGuess?: boolean; sessionId?: string } = {},
): Promise<GoalOutcome> {
  const input = buildGoalInput(text, targetRole, opts.roleIsGuess);
  const baseline = resolveGoal(input);
  const cfg = await resolveAiConfig(opts.sessionId ?? "");
  if (!cfg.available || cfg.mode === "demo") return { resolution: baseline, source: "fallback", dynamicSkills: [] };

  const provider = getProvider(cfg.provider);
  if (!provider) return { resolution: baseline, source: "fallback", dynamicSkills: [] };

  try {
    const { value: raw, note: modelNote } = await callWithModelFallback(
      provider, cfg, (c) => provider.generateStructured(buildGoalRequest(text), c),
    );
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const domain = typeof obj.domain === "string" ? obj.domain.trim().slice(0, 40) : undefined;
      const candidates = parseCandidates(obj.candidateSkills);
      // Map onto the catalog; register the genuinely-new topics as dynamic skills.
      const { ids, unknown } = validateSkillNames(candidates.map((c) => c.name));
      const newTopics = unknown
        .map((name) => {
          const blurb = candidates.find((c) => c.name === name)?.blurb;
          return { id: dynamicSkillId(name), name, domain: domain ?? "Custom", description: blurb };
        })
        .slice(0, 8);
      const registered = ensureDynamicSkills(newTopics);
      // "Unusable output" guard: JSON that parses but yields zero usable skills
      // must count as an AI failure, not an AI success with nothing to show.
      if (ids.length + registered.length === 0) {
        throw new Error("model returned no usable candidate skills");
      }
      const hint: GoalHint = {
        label: typeof obj.goal === "string" ? obj.goal.trim().slice(0, 80) : undefined,
        domain,
        skills: [...ids, ...registered.map((s) => s.id)],
      };
      const resolution = resolveGoal(input, hint);
      return {
        resolution,
        source: "llm",
        provider: provider.label,
        ...(modelNote ? { note: modelNote } : {}),
        dynamicSkills: dynamicSkillDefsFor(resolution.targets.map((t) => t.skillId)),
      };
    }
    } catch (err) {
      // Surface WHY in the UI badge — a failed provider call must never be
      // presented as "no AI configured".
      console.warn(`[ai] goal resolution fell back to deterministic (${provider.id}):`, safeErr(err));
      return {
        resolution: baseline,
        source: "fallback",
        note: `${provider.label} call failed — used local parsing. (${safeErr(err)})`,
        dynamicSkills: [],
      };
    }
    return { resolution: baseline, source: "fallback", dynamicSkills: [] };
  }

// ── Assistant Q&A ─────────────────────────────────────────────────────────────
export async function answerQuestion(
  question: string,
  ctx: AssistantContext,
  history: AssistantHistoryMessage[] = [],
  sessionId = "",
): Promise<AssistantOutcome> {
  const cfg = await resolveAiConfig(sessionId);
  if (cfg.available && cfg.mode !== "demo") {
    const provider = getProvider(cfg.provider);
    if (provider) {
      try {
        const { value: r, note: modelNote } = await callWithModelFallback(
          provider, cfg, (c) => provider.generate(buildAssistantRequest(question, ctx, history), c),
        );
        const text = r.text?.trim();
        if (text) return { text, source: "llm", provider: provider.label, ...(modelNote ? { note: modelNote } : {}) };
        throw new Error("Empty response from provider");
      } catch (err) {
        // Keep answering deterministically, but surface WHY in the UI badge so a
        // misconfigured key never masquerades as "the AI said this".
        const reason = safeErr(err);
        console.warn(`[ai] assistant fell back to deterministic (${provider.id}):`, reason);
        return {
          text: assistantFallback(question, ctx),
          source: "fallback",
          note: `${provider.label} call failed — used the built-in answer. (${reason})`,
        };
      }
    }
  }
  return { text: assistantFallback(question, ctx), source: "fallback" };
}

// ── Connection test (AI Settings) ─────────────────────────────────────────────
export async function testConnection(input: AiConfigInput, sessionId = ""): Promise<TestResult> {
  const provider = getProvider(input.provider);
  if (!provider) return { ok: false, message: `Unknown provider "${input.provider}".` };
  const existingKey = await getStoredKey(sessionId);
  const cfg = configForTest(input, existingKey);
  if (!cfg.apiKey) return { ok: false, message: "No API key provided." };
  try {
    const first = await provider.testConnection(cfg);
    if (first.ok) return first;
    // A retired/invalid model id must not read as "connection broken": retry
    // once with the provider's current default and say so.
    const fallbackModel = PROVIDER_META[input.provider]?.defaultModel;
    if (fallbackModel && fallbackModel !== cfg.model && MODEL_GONE.test(first.message)) {
      const second = await provider.testConnection({ ...cfg, model: fallbackModel });
      if (second.ok) {
        return { ...second, message: `Model "${cfg.model}" is unavailable — retried with ${fallbackModel}. ${second.message}` };
      }
      return second;
    }
    return first;
  } catch (err) {
    return { ok: false, message: safeErr(err) };
  }
}

/** Strip anything key-shaped from an error before it can reach a log. */
function safeErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/(key|token|bearer)[=:\s"']*[A-Za-z0-9._-]{6,}/gi, "$1=***").slice(0, 300);
}

/** Vendor phrasing for "that model id doesn't exist (any more)". */
const MODEL_GONE = /\b404\b|not found|not_found|no such model|does not exist|model.*(retired|deprecated|unsupported|unavailable)|unsupported model|invalid model/i;

/**
 * Run a provider call; if the vendor rejects the SAVED model as retired/invalid,
 * retry once with that provider's current default and surface a clear note.
 * A retired slug in the DB must never look like "AI is broken".
 */
async function callWithModelFallback<T>(
  provider: LLMProvider,
  cfg: ResolvedAiConfig,
  fn: (cfg: ResolvedAiConfig) => Promise<T>,
): Promise<{ value: T; note?: string }> {
  try {
    return { value: await fn(cfg) };
  } catch (err) {
    const fallbackModel = PROVIDER_META[cfg.provider]?.defaultModel;
    if (!fallbackModel || fallbackModel === cfg.model || !MODEL_GONE.test(safeErr(err))) throw err;
    const value = await fn({ ...cfg, model: fallbackModel });
    return { value, note: `Saved model "${cfg.model}" is unavailable — used ${fallbackModel} instead.` };
  }
}
