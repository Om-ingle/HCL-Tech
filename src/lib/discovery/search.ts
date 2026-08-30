import type { Difficulty, Resource, ResourceType } from "@/lib/domain/types";
import { SKILL_BY_ID } from "@/lib/catalog/skills";

// ── Layer 2: external resource discovery ──────────────────────────────────────
// A pluggable search provider. There is NO search infrastructure in this project
// and no search credential is bundled, so this layer is OFF by default and the
// app is fully functional without it (Layers 1 and 3 cover every skill).
//
// Hard rules:
//   • URLs come only from a real search response. The LLM never supplies one.
//   • Keys are read from the server environment only, never sent to the browser.
//   • Any failure is swallowed — discovery degrades, it never breaks a roadmap.
//
// To enable, set on the server:
//   SEARCH_PROVIDER=tavily   SEARCH_API_KEY=...
// (Tavily's response shape is used because it returns clean title/url/content;
//  add another adapter below if you prefer a different service.)

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

export interface DiscoveryQuery {
  skillId: string;
  skillName: string;
  domain: string;
  difficulty: Difficulty;
  /** Extra words from the learner's goal we couldn't map — sharpens the query. */
  goalTerms?: string[];
  kind: "learning" | "documentation" | "project";
}

export interface SearchProvider {
  id: string;
  search(query: DiscoveryQuery): Promise<SearchHit[]>;
}

const KIND_SUFFIX: Record<DiscoveryQuery["kind"], string> = {
  learning: "tutorial course learn",
  documentation: "official documentation reference",
  project: "hands-on project ideas github",
};

export function buildQueryString(q: DiscoveryQuery): string {
  const extra = (q.goalTerms ?? []).slice(0, 2).join(" ");
  return `${q.skillName} ${q.domain} ${KIND_SUFFIX[q.kind]} ${q.difficulty} ${extra}`.trim();
}

/** Domains we trust enough to surface without human review. */
const TRUSTED = [
  /(^|\.)docs?\./i,
  /(^|\.)developer\./i,
  /(^|\.)learn\./i,
  /\.edu$/i,
  /\.edu\//i,
  /(^|\.)ocw\.mit\.edu/i,
  /(^|\.)kernel\.org/i,
  /(^|\.)gnu\.org/i,
  /(^|\.)apache\.org/i,
  /(^|\.)python\.org/i,
  /(^|\.)mozilla\.org/i,
  /(^|\.)github\.com/i,
  /(^|\.)github\.io/i,
  /(^|\.)readthedocs\.io/i,
  /(^|\.)arxiv\.org/i,
  /(^|\.)coursera\.org/i,
  /(^|\.)edx\.org/i,
  /(^|\.)freecodecamp\.org/i,
  /(^|\.)khanacademy\.org/i,
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Quality gate from §6: prefer official docs, universities, OER, reputable OSS. */
export function sourceQuality(url: string): number {
  const host = hostOf(url);
  if (!host) return -1;
  if (TRUSTED.some((re) => re.test(host) || re.test(url))) return 2;
  if (/\.(org|edu|gov)$/i.test(host)) return 1;
  if (/(blogspot|medium\.com|wordpress\.com|quora|pinterest|facebook)/i.test(host)) return -1;
  return 0;
}

function typeForKind(kind: DiscoveryQuery["kind"], url: string): ResourceType {
  if (kind === "project") return "project";
  if (kind === "documentation") return "documentation";
  return /(course|class|lecture|mooc|coursera|edx)/i.test(url) ? "course" : "tutorial";
}

/** Tavily adapter — the one wired implementation. Returns [] on any problem. */
function tavilyProvider(apiKey: string): SearchProvider {
  return {
    id: "tavily",
    async search(query) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: buildQueryString(query),
          max_results: 5,
          search_depth: "basic",
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
      return (json.results ?? [])
        .filter((r): r is { title: string; url: string; content?: string } => !!r.url && !!r.title)
        .map((r) => ({
          title: r.title,
          url: r.url,
          snippet: (r.content ?? "").slice(0, 240),
          provider: hostOf(r.url) || "web",
        }));
    },
  };
}

/** Resolve the configured provider, or null when discovery is disabled. */
export function getSearchProvider(): SearchProvider | null {
  const id = (process.env.SEARCH_PROVIDER ?? "").trim().toLowerCase();
  const key = (process.env.SEARCH_API_KEY ?? "").trim();
  if (!id || !key) return null;
  if (id === "tavily") return tavilyProvider(key);
  return null; // unknown provider name → stay off rather than guess
}

export const externalDiscoveryEnabled = () => getSearchProvider() !== null;

/** Convert real search hits into catalog-shaped resources. */
export function hitsToResources(query: DiscoveryQuery, hits: SearchHit[]): Resource[] {
  const skill = SKILL_BY_ID[query.skillId];
  if (!skill) return [];
  const seen = new Set<string>();
  return hits
    .filter((h) => {
      const host = hostOf(h.url);
      if (!host || seen.has(host)) return false;
      seen.add(host);
      return sourceQuality(h.url) >= 0;
    })
    .slice(0, 3)
    .map((h, i) => ({
      id: `ext-${query.skillId}-${i + 1}`,
      title: h.title.slice(0, 120),
      type: typeForKind(query.kind, h.url),
      domain: skill.domain,
      difficulty: query.difficulty,
      skills: [query.skillId],
      prerequisites: skill.prerequisites,
      durationHours: query.kind === "project" ? 12 : 8,
      description: h.snippet || `Discovered resource for ${skill.name} from ${h.provider}.`,
      url: h.url,
      tags: [skill.domain.toLowerCase(), "discovered", h.provider.toLowerCase()],
      provider: h.provider,
      origin: "search" as const,
    }));
}

/**
 * Discover external resources for a batch of skills. Concurrency-limited and
 * best-effort: a rejected request contributes nothing and is not retried.
 */
export async function discoverExternal(queries: DiscoveryQuery[]): Promise<Resource[]> {
  const provider = getSearchProvider();
  if (!provider || !queries.length) return [];
  const out: Resource[] = [];
  const batchSize = 4;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (q) => hitsToResources(q, await provider.search(q))),
    );
    for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
  }
  return out;
}
