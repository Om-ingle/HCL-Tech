import type { Difficulty, LearningStyle, ProfileDraft } from "@/lib/domain/types";
import { detectSkills, matchRole } from "@/lib/catalog";
import type { AssistantContext } from "./prompts";

// ── Deterministic profile extraction (no LLM) ─────────────────────────────────
// Good enough to keep onboarding working with zero API credits.

function detectExperience(t: string): Difficulty | undefined {
  if (/\b(complete beginner|beginner|newbie|novice|no experience|new to|from scratch|just start|starting out|zero|never (?:coded|programmed|written|done))\b/.test(t))
    return "beginner";
  if (/\b(advanced|senior|expert|years of|extensive|professional|lead)\b/.test(t)) return "advanced";
  if (/\b(intermediate|some experience|a bit of|familiar|comfortable|know the basics|worked with)\b/.test(t))
    return "intermediate";
  return undefined;
}

function detectStyle(t: string): LearningStyle | undefined {
  const video = /\b(videos?|watch(?:ing)?|youtube|lectures?|visual)\b/.test(t);
  const reading = /\b(read(?:ing)?|books?|articles?|documentation|docs|text|written)\b/.test(t);
  const project = /\b(projects?|hands.?on|build(?:ing)?|practice|by doing|exercises?|code along)\b/.test(t);
  const picked = [video, reading, project].filter(Boolean).length;
  if (picked !== 1) return video || reading || project ? "mixed" : undefined;
  if (video) return "video";
  if (reading) return "reading";
  return "project";
}

function detectWeeklyHours(t: string): number | undefined {
  const m =
    t.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:a|per|\/)?\s*week/) ||
    t.match(/(\d+)\s*(?:hours?|hrs?)\s*weekly/);
  if (m) return clampInt(parseInt(m[1], 10), 1, 80);
  const perDay = t.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:a|per|\/)?\s*day/);
  if (perDay) return clampInt(parseInt(perDay[1], 10) * 5, 1, 80);
  return undefined;
}

function detectTimelineWeeks(t: string): number | undefined {
  const months = t.match(/(\d+)\s*months?/);
  if (months) return clampInt(parseInt(months[1], 10) * 4, 2, 200);
  const weeks = t.match(/(\d+)\s*weeks?/);
  if (weeks) return clampInt(parseInt(weeks[1], 10), 2, 200);
  const years = t.match(/(\d+)\s*years?/);
  if (years) return clampInt(parseInt(years[1], 10) * 52, 2, 200);
  return undefined;
}

function detectName(raw: string): string | undefined {
  const m =
    raw.match(/(?:\b[Ii]'?m|\b[Ii] am|[Mm]y name is|\b[Nn]ame'?s|[Tt]his is|[Cc]all me)\s+([A-Z][a-zA-Z]{1,20})\b/) ||
    raw.match(/^\s*([A-Z][a-zA-Z]{1,20})\s+here\b/);
  if (m) {
    const name = m[1];
    if (!/^(a|an|the|really|very|new|just|not|interested|looking|trying)$/i.test(name)) return name;
  }
  return undefined;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function extractProfileFallback(rawText: string): ProfileDraft {
  const raw = rawText.trim();
  const t = ` ${raw.toLowerCase()} `;
  const role = matchRole(raw);
  const knownSkillIds = detectSkills(raw);
  const notes: string[] = ["Parsed locally without AI — you can edit any field."];

  const draft: ProfileDraft = {
    goalText: raw.slice(0, 400),
    extractionSource: "fallback",
    notes,
  };

  const name = detectName(raw);
  if (name) draft.name = name;
  if (role) {
    draft.targetRoleId = role.id;
    draft.targetRole = role.name;
  }
  const exp = detectExperience(t);
  if (exp) draft.experienceLevel = exp;
  const style = detectStyle(t);
  if (style) draft.learningStyle = style;
  const hours = detectWeeklyHours(t);
  if (hours) draft.weeklyHours = hours;
  const weeks = detectTimelineWeeks(t);
  if (weeks) draft.timelineWeeks = weeks;
  if (knownSkillIds.length) draft.knownSkillIds = knownSkillIds;

  if (!role)
    notes.push(
      "I read your goal directly from your words — no predefined role needed. Pick one below only if it helps.",
    );
  return draft;
}

// ── Deterministic assistant (no LLM) ──────────────────────────────────────────
export function assistantFallback(question: string, ctx: AssistantContext): string {
  const q = question.toLowerCase();
  const gaps = ctx.topGaps.length ? ctx.topGaps.slice(0, 3).join(", ") : "your current phase skills";

  if (/\bwhy\b/.test(q) && (/next|recommend|this|first|start/.test(q))) {
    if (ctx.nextActionTitle) {
      return `Right now the best move is “${ctx.nextActionTitle}”. ${
        ctx.nextActionWhy ?? "It unblocks the skills your target role needs next."
      } It sits in ${ctx.currentPhase ?? "your active phase"} on the way to ${ctx.roleName}.`;
    }
  }
  if (/how long|time|weeks|finish|done|timeline/.test(q)) {
    return `At ${ctx.weeklyHours}h/week you're about ${ctx.overallPct}% of the way to ${ctx.roleName}, with roughly ${ctx.estimatedWeeksLeft} weeks of study left. Bumping your weekly hours (try the Simulate control) shortens that estimate.`;
  }
  if (/gap|missing|need|weak|lack/.test(q)) {
    return `Your biggest gaps for ${ctx.roleName} are ${gaps}. You've mastered ${ctx.masteredCount} skills, ${ctx.partialCount} are partial, and ${ctx.missingCount} are still missing — the roadmap tackles them in prerequisite order.`;
  }
  if (/skip|already know|too easy|know this/.test(q)) {
    return `If a step is too easy, mark it complete or use “too easy” feedback — I'll reroute and pull later material forward. Take the checkpoint for that skill to confirm mastery and skip ahead safely.`;
  }
  if (/hard|difficult|stuck|struggl|too fast/.test(q)) {
    return `If something feels too hard, use the “too hard” feedback on that step — I'll reroute toward gentler resources and add practice before moving on. Your current focus is ${ctx.currentPhase ?? "the active phase"}.`;
  }
  if (/change|different|switch|instead|shorten|faster/.test(q)) {
    return `You can change direction anytime: use Simulate to try new weekly hours or a new target role, and I'll recalculate the route. You're currently heading toward ${ctx.roleName} (${ctx.overallPct}% there).`;
  }
  // Generic
  return `You're working toward ${ctx.roleName} — ${ctx.overallPct}% complete with about ${ctx.estimatedWeeksLeft} weeks left. ${
    ctx.nextActionTitle ? `Your next best action is “${ctx.nextActionTitle}”.` : ""
  } Ask me about your gaps, timeline, or why a step is recommended. (Answered locally — add an AI key in Settings for richer replies.)`;
}
