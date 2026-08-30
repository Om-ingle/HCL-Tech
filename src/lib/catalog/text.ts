/** Shared text normalization for all catalog matching (kept dependency-free). */
export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9/+# ]/g, " ").replace(/\s+/g, " ").trim();

/** Word-boundary-aware phrase test. `text` may be raw; `phrase` is normalized. */
export function hasPhrase(text: string, phrase: string): boolean {
  return ` ${norm(text)} `.includes(` ${norm(phrase)} `);
}
