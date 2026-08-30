import {
  SKILL_BY_ID,
  SKILLS,
  getRole,
  matchArchetype,
  matchDomains,
  matchRoleDetailed,
  matchSkillTerms,
  norm,
  relatedSkills,
  skillsInDomain,
} from "@/lib/catalog";
import type { GoalMethod, GoalResolution, LearnerProfile, RoleTargetSkill } from "./types";
import { prerequisiteClosure } from "./util";

// ── Goal resolver ─────────────────────────────────────────────────────────────
// Turns ANY natural-language goal into a concrete target-skill set, using only
// the skill graph. Deterministic by construction; an LLM hint (if a provider is
// configured) is merged in as one more signal and is ALWAYS validated against
// the graph — a skill the LLM invents simply doesn't exist and is dropped.

/** Optional, cheap LLM assist. Never trusted verbatim. */
export interface GoalHint {
  label?: string;
  domain?: string;
  skills?: string[]; // ids, names, or aliases — validated against the graph
}

const STARTER_SEED = ["programming-fundamentals", "python", "git", "linux-cli", "algorithms"];

const STOPWORDS = new Set(
  ("i want to be become a an the as work working job career learn learning master become" +
    " get into for in on of and or with my me myself want wanna would like hoping hope" +
    " engineer engineering developer development specialist professional expert role" +
    " senior junior lead switch switching transition transitioning move moving into" +
    " eventually someday future goal goals plan planning aiming aim try trying build" +
    " building make making do doing know knowing skills skill next year years month months").split(
    /\s+/,
  ),
);

/** Map free-text skill names/ids/aliases onto real graph ids. Unmapped → dropped. */
export function validateSkillNames(names: string[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const raw of names) {
    const key = norm(raw);
    if (!key) continue;
    const direct = SKILL_BY_ID[raw] ?? SKILL_BY_ID[key.replace(/\s+/g, "-")];
    if (direct) {
      ids.push(direct.id);
      continue;
    }
    const byName = SKILLS.find((s) => norm(s.name) === key);
    if (byName) {
      ids.push(byName.id);
      continue;
    }
    const byAlias = SKILLS.find((s) => (s.aliases ?? []).some((a) => norm(a) === key));
    if (byAlias) {
      ids.push(byAlias.id);
      continue;
    }
    const fuzzy = matchSkillTerms(raw)[0];
    if (fuzzy) ids.push(fuzzy.skillId);
    else unknown.push(raw.trim());
  }
  return { ids: Array.from(new Set(ids)), unknown };
}

/**
 * Extra filler we never want in `unknownTerms`. These aren't stopwords for
 * label-building (that would over-trim titles), but as leftover search terms
 * they're worthless — and the UI reports unknown terms to the learner, so
 * "we couldn't map 'beginner', 'wants'" reads as a bug rather than honesty.
 */
const FILLER = new Set(
  ("beginner beginners intermediate advanced basic basics novice complete absolute total" +
    " experience experienced background familiar comfortable confident strong solid decent" +
    " little some none zero already currently recently lately today tomorrow" +
    " wants needs want need able help helps ship shipping using uses used" +
    " understand understanding prefer prefers prefers really very quite pretty" +
    " better best good great nice cool awesome much many lots more most less" +
    " enough maybe probably possibly perhaps definitely honestly basically" +
    " stuff things thing ways side area areas field fields world level levels" +
    " path paths route roadmap guide guides course courses tutorial tutorials" +
    " book books video videos resource resources project projects practice practicing" +
    " hands time times hour hours week weeks weekly month monthly daily" +
    " software technology tech industry company companies team teams" +
    " maybe sort kind like also just only even still because since" +
    " real write writes writing written wrote create creating" +
    " sure what whatever when where which while whom whose" +
    " about from over under after before through during than then" +
    " there their they them this that these those your ours well" +
    " something anything everything nothing someone anyone").split(/\s+/),
);

/** Leftover meaningful words we could not map — used to bias resource discovery. */
function leftoverTerms(text: string, matchedTerms: string[]): string[] {
  const consumed = new Set(matchedTerms.flatMap((t) => norm(t).split(" ")));
  return Array.from(
    new Set(
      norm(text)
        .split(" ")
        .filter(
          (w) => w.length >= 4 && !STOPWORDS.has(w) && !FILLER.has(w) && !consumed.has(w),
        ),
    ),
  ).slice(0, 6);
}

/** Representative skills for a domain: its foundations plus its flagship skill. */
function domainSeed(domain: string): string[] {
  const inDomain = skillsInDomain(domain).slice().sort((a, b) => a.tier - b.tier);
  if (!inDomain.length) return [];
  const core = inDomain.filter((s) => s.tier <= 3).slice(0, 4).map((s) => s.id);
  const flagship = inDomain[inDomain.length - 1].id;
  return Array.from(new Set([...core, flagship]));
}

const CONNECTORS = new Set(["and", "the", "for", "with", "into", "from", "of", "in", "on", "to", "a", "an", "at", "my"]);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) =>
      i > 0 && CONNECTORS.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.length <= 2
          ? w
          : w[0].toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** Best-effort human label for a goal we resolved from free text. */
export function labelFromText(text: string, fallback: string): string {
  const cleaned = text
    .replace(/^\s*(i\s+(want|would like|wanna|hope|aim|plan|need)\s+to\s+(become|be|work as|get into|learn)?\s*)/i, "")
    .replace(/^\s*i\s+(want|would like|wanna|hope|aim|plan|need)\s+/i, "")
    .replace(/^\s*(a|an|the)\s+/i, "")
    .replace(/[.!?,;].*$/s, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6);
  while (words.length && (CONNECTORS.has(words[words.length - 1].toLowerCase()) || STOPWORDS.has(words[words.length - 1].toLowerCase()))) {
    words.pop();
  }
  const short = words.join(" ");
  return short.length >= 3 ? titleCase(short) : fallback;
}

export interface ResolveGoalInput {
  goalText?: string;
  targetRole?: string;
  targetRoleId?: string;
}

/**
 * Decide how much authority a target role has over the goal text.
 *
 * Onboarding *guesses* a role from the same sentence ("Python", "projects" →
 * Data Scientist). Treating that guess as authoritative would silently replace
 * an unusual goal with the nearest predefined role — a robotics goal becoming a
 * Data Scientist route. So a guessed role only counts when the text itself gave
 * us nothing better; a role the learner explicitly chose always wins.
 */
export function buildGoalInput(
  text: string,
  targetRole?: string,
  roleIsGuess?: boolean,
): ResolveGoalInput {
  const targetRoleId = targetRole && getRole(targetRole) ? targetRole : undefined;
  if (!targetRole || !roleIsGuess) return { goalText: text, targetRole, targetRoleId };
  const textOnly = resolveGoal({ goalText: text });
  const strongEnough =
    textOnly.methods[0] === "role" ||
    textOnly.methods[0] === "archetype" ||
    (textOnly.confidence >= 0.6 && textOnly.targets.length >= 3);
  return strongEnough ? { goalText: text } : { goalText: text, targetRole, targetRoleId };
}

/**
 * Resolve a goal to target skills. Order of authority:
 *   predefined role → goal archetype → skill terms in the text → domain → LLM
 *   hint → foundational starter route.
 * Every branch produces real graph skills, so the roadmap is always buildable.
 */
export function resolveGoal(input: ResolveGoalInput, hint?: GoalHint): GoalResolution {
  const goalText = (input.goalText ?? "").trim();
  const roleText = (input.targetRole ?? "").trim();
  const text = `${roleText} ${goalText}`.trim();

  const methods: GoalMethod[] = [];
  const notes: string[] = [];
  const matchedTerms: string[] = [];
  const targets = new Map<string, number>();
  const addTarget = (skillId: string, level: number) => {
    if (!SKILL_BY_ID[skillId]) return;
    targets.set(skillId, Math.max(targets.get(skillId) ?? 0, level));
  };

  let label = "";
  let domain = "";
  let roleId: string | null = null;
  let confidence = 0;

  // 1 ── Predefined role (explicit id wins outright; keeps demo personas exact).
  const explicitRole = input.targetRoleId ? getRole(input.targetRoleId) : undefined;
  const roleHit = explicitRole
    ? { role: explicitRole, term: explicitRole.name }
    : roleText && getRole(roleText)
      ? { role: getRole(roleText)!, term: getRole(roleText)!.name }
      : matchRoleDetailed(text);
  const archetypeHit = matchArchetype(text);

  // Longest phrase wins between a role and an archetype, so "MLOps Engineer"
  // beats the "ML Engineer" role and "Kernel Developer" isn't swallowed at all.
  const preferArchetype =
    !!archetypeHit &&
    !explicitRole &&
    (!roleHit || norm(archetypeHit.term).length > norm(roleHit.term).length);

  if (roleHit && !preferArchetype) {
    const role = roleHit.role;
    roleId = role.id;
    label = role.name;
    domain = role.domain;
    confidence = explicitRole ? 1 : 0.9;
    methods.push("role");
    matchedTerms.push(roleHit.term);
    for (const t of role.targetSkills) addTarget(t.skillId, t.targetLevel);
    notes.push(`Recognized “${roleHit.term}” as the ${role.name} route.`);
  } else if (archetypeHit) {
    const a = archetypeHit.archetype;
    label = a.label;
    domain = a.domain;
    confidence = 0.85;
    methods.push("archetype");
    matchedTerms.push(archetypeHit.term);
    for (const [skillId, level] of a.anchors) addTarget(skillId, level);
    notes.push(`Read “${archetypeHit.term}” as the ${a.label} route (${a.domain}).`);
  }

  // 2 ── Skill names/aliases mentioned directly in the goal. Always applied, so
  //      "robotics engineer focused on computer vision" keeps the vision part.
  const termHits = matchSkillTerms(text);
  if (termHits.length) {
    const top = termHits.slice(0, 8);
    for (const [i, hit] of top.entries()) {
      addTarget(hit.skillId, i === 0 && !targets.size ? 3 : 2);
      matchedTerms.push(hit.term);
    }
    if (!methods.length) {
      methods.push("terms");
      confidence = Math.min(0.75, 0.4 + 0.08 * top.length);
      domain = SKILL_BY_ID[top[0].skillId]?.domain ?? "";
      label = labelFromText(text, SKILL_BY_ID[top[0].skillId]?.name ?? "Custom goal");
      // Thin seed → widen sideways through the graph neighbourhood.
      if (top.length <= 2) {
        for (const id of relatedSkills(top[0].skillId).slice(0, 4)) addTarget(id, 2);
        notes.push(
          `Expanded from ${SKILL_BY_ID[top[0].skillId]?.name} to its neighbouring skills in the graph.`,
        );
      }
    }
    const named = top.map((h) => SKILL_BY_ID[h.skillId]?.name).filter(Boolean).slice(0, 4);
    if (named.length) notes.push(`Picked up ${named.join(", ")} from your own words.`);
  }

  // 3 ── Domain keywords ("underwater robotics control" → Robotics). When the
  //      goal named no domain but did name a skill, use that skill's own domain
  //      so a two-word goal still produces a substantial target set.
  const keywordDomains = matchDomains(text);
  const inferredDomains = Array.from(
    new Set(Array.from(targets.keys()).map((id) => SKILL_BY_ID[id]?.domain).filter(Boolean)),
  ) as string[];
  const seedDomains = keywordDomains.length ? keywordDomains : inferredDomains;
  if (seedDomains.length && targets.size < 4) {
    methods.push("domain");
    for (const d of seedDomains.slice(0, 2)) for (const id of domainSeed(d)) addTarget(id, 2);
    if (!domain) domain = seedDomains[0];
    if (!label) label = labelFromText(text, `${seedDomains[0]} Specialist`);
    confidence = Math.max(confidence, keywordDomains.length ? 0.5 : 0.45);
    notes.push(
      keywordDomains.length
        ? `Placed your goal in ${seedDomains.slice(0, 2).join(" + ")} and seeded that area's core skills.`
        : `Only a few skills matched, so we filled in the core of ${seedDomains.slice(0, 2).join(" + ")} around them.`,
    );
  }

  // 4 ── LLM hint (optional). Validated against the graph; inventions dropped.
  let unknownFromHint: string[] = [];
  if (hint?.skills?.length) {
    const { ids, unknown } = validateSkillNames(hint.skills);
    unknownFromHint = unknown;
    const added = ids.filter((id) => !targets.has(id));
    for (const id of ids) addTarget(id, 2);
    if (added.length) {
      methods.push("llm");
      confidence = Math.max(confidence, 0.8);
      notes.push(
        `AI suggested ${added.slice(0, 4).map((id) => SKILL_BY_ID[id]?.name).filter(Boolean).join(", ")}${added.length > 4 ? ` +${added.length - 4} more` : ""}; kept the ones that exist in our skill graph.`,
      );
    }
    if (!label && hint.label) label = hint.label;
    if (!domain && hint.domain) domain = hint.domain;
    // The LLM read the whole sentence; a fuzzy role hit on part of it is only a
    // guess. When the LLM names the goal, its understanding wins over the guess
    // (skills from both stay — only the label/destination is corrected).
    if (hint.label && roleId && !input.targetRoleId && !roleText) {
      label = hint.label;
      roleId = null;
      if (hint.domain) domain = hint.domain;
      notes.push(`AI read this as “${hint.label}”, not just the nearest predefined role.`);
    }
  }

  // 5 ── Nothing recognized → foundational starter route (never a dead end).
  if (targets.size === 0) {
    methods.push("starter");
    for (const id of STARTER_SEED) addTarget(id, 2);
    // Show the learner's own words (minus "I want to…") rather than a generic
    // tech label — even unparseable goals deserve their name on screen.
    label = labelFromText(text, "Your Goal");
    domain = domain || "Programming";
    confidence = 0.25;
    notes.push(
      "We couldn't map this goal to a known area yet, so we started you on programming foundations — edit the target skills to steer it.",
    );
  }

  const seedIds = Array.from(targets.keys());
  const allDomains = Array.from(
    new Set([domain, ...seedIds.map((id) => SKILL_BY_ID[id]?.domain).filter(Boolean)]),
  ).filter(Boolean) as string[];

  const unknownTerms = Array.from(new Set([...leftoverTerms(text, matchedTerms), ...unknownFromHint]));

  return {
    goalText: goalText || roleText,
    label: label || "Custom goal",
    domain: domain || allDomains[0] || "Programming",
    domains: allDomains,
    roleId,
    targets: seedIds.map((skillId) => ({ skillId, targetLevel: targets.get(skillId)! })),
    methods,
    matchedTerms: Array.from(new Set(matchedTerms)),
    unknownTerms,
    confidence,
    notes,
  };
}

/** Resolve straight from a stored profile (what the engine calls at runtime). */
export function resolveGoalForProfile(profile: LearnerProfile, hint?: GoalHint): GoalResolution {
  const resolution = resolveGoal(
    {
      goalText: profile.goalText,
      targetRole: profile.targetRole,
      targetRoleId: getRole(profile.targetRole) ? profile.targetRole : undefined,
    },
    hint,
  );
  // An explicitly chosen target-skill override always wins over inference.
  const override = profile.preferences.targetSkillIds;
  if (override?.length) {
    const { ids, unknown } = validateSkillNames(override);
    if (ids.length) {
      const names = ids.map((id) => SKILL_BY_ID[id]?.name).filter(Boolean);
      // With confirmed targets, the goal is the learner's own words — never let
      // the generic starter label survive when we
      // couldn't pattern-match the goal text but they picked real skills.
      const ownWords = profile.goalText || profile.targetRole || "";
      const label =
        resolution.methods.includes("starter") && ownWords.trim()
          ? labelFromText(ownWords, profile.targetRole || resolution.label)
          : resolution.label;
      // Inference notes that contradict the override are dropped — the learner's
      // confirmed list is now the reason the path looks the way it does.
      const kept = resolution.notes.filter(
        (n) => !n.startsWith("We couldn't map this goal") && !n.startsWith("Only a few skills matched"),
      );
      return {
        ...resolution,
        label,
        targets: ids.map((skillId) => ({
          skillId,
          targetLevel: resolution.targets.find((t) => t.skillId === skillId)?.targetLevel ?? 2,
        })),
        confidence: 1,
        unknownTerms: Array.from(new Set([...resolution.unknownTerms, ...unknown])),
        notes: [
          `Using the ${names.length} target skill${names.length === 1 ? "" : "s"} you confirmed: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` +${names.length - 5} more` : ""}.`,
          ...kept,
        ],
      };
    }
  }
  return resolution;
}

/**
 * Seed targets + their full prerequisite closure. The graph — not the goal text
 * and not the LLM — is the source of truth for what must come first.
 */
export function expandTargets(resolution: GoalResolution): {
  targets: RoleTargetSkill[];
  addedPrerequisites: string[];
} {
  const base: RoleTargetSkill[] = resolution.targets.map((t) => ({ ...t }));
  const present = new Set(base.map((t) => t.skillId));
  const added: string[] = [];
  for (const p of prerequisiteClosure(base.map((t) => t.skillId))) {
    if (!present.has(p) && SKILL_BY_ID[p]) {
      base.push({ skillId: p, targetLevel: 2 });
      present.add(p);
      added.push(p);
    }
  }
  return { targets: base, addedPrerequisites: added };
}
