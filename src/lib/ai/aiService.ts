import type { Difficulty, LearningStyle, ProfileDraft } from "@/lib/domain/types";
import { detectSkills, matchRole } from "@/lib/catalog";
import type { AiConfigInput } from "@/lib/validation/schemas";
import {
  configForTest,
  getStoredKey,
  resolveAiConfig,
  toPublicStatus,
  type PublicAiStatus,
} from "./config";
import { getProvider } from "./registry";
import { buildAssistantRequest, buildExtractionRequest, type AssistantContext } from "./prompts";
import { assistantFallback, extractProfileFallback } from "./fallback";
import type { TestResult } from "./types";

export type AiSource = "llm" | "fallback";

export interface ExtractionOutcome {
  draft: ProfileDraft;
  source: AiSource;
  provider?: string;
}

export interface AssistantOutcome {
  text: string;
  source: AiSource;
  provider?: string;
}

/** Public, key-free status for the UI ("AI Brain: <provider> ✓"). */
export async function getAiStatus(): Promise<PublicAiStatus> {
  const cfg = await resolveAiConfig();
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
export async function extractProfile(text: string): Promise<ExtractionOutcome> {
  const baseline = extractProfileFallback(text);
  const cfg = await resolveAiConfig();
  if (!cfg.available || cfg.mode === "demo") return { draft: baseline, source: "fallback" };

  const provider = getProvider(cfg.provider);
  if (!provider) return { draft: baseline, source: "fallback" };

  try {
    const raw = await provider.generateStructured(buildExtractionRequest(text), cfg);
    if (raw && typeof raw === "object") {
      return {
        draft: mergeLlmDraft(baseline, raw as Record<string, unknown>, text),
        source: "llm",
        provider: provider.label,
      };
    }
  } catch (err) {
    console.warn(`[ai] extraction fell back to deterministic (${provider.id}):`, safeErr(err));
  }
  return { draft: baseline, source: "fallback" };
}

// ── Assistant Q&A ─────────────────────────────────────────────────────────────
export async function answerQuestion(question: string, ctx: AssistantContext): Promise<AssistantOutcome> {
  const cfg = await resolveAiConfig();
  if (cfg.available && cfg.mode !== "demo") {
    const provider = getProvider(cfg.provider);
    if (provider) {
      try {
        const r = await provider.generate(buildAssistantRequest(question, ctx), cfg);
        const text = r.text?.trim();
        if (text) return { text, source: "llm", provider: provider.label };
      } catch (err) {
        console.warn(`[ai] assistant fell back to deterministic (${provider.id}):`, safeErr(err));
      }
    }
  }
  return { text: assistantFallback(question, ctx), source: "fallback" };
}

// ── Connection test (AI Settings) ─────────────────────────────────────────────
export async function testConnection(input: AiConfigInput): Promise<TestResult> {
  const provider = getProvider(input.provider);
  if (!provider) return { ok: false, message: `Unknown provider "${input.provider}".` };
  const existingKey = await getStoredKey();
  const cfg = configForTest(input, existingKey);
  if (!cfg.apiKey) return { ok: false, message: "No API key provided." };
  try {
    return await provider.testConnection(cfg);
  } catch (err) {
    return { ok: false, message: safeErr(err) };
  }
}

/** Strip anything key-shaped from an error before it can reach a log. */
function safeErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/(key|token|bearer)[=:\s"']*[A-Za-z0-9._-]{6,}/gi, "$1=***").slice(0, 300);
}
