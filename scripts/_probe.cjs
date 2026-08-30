const path = require("path");
const jiti = require("jiti")(__filename, {
  interopDefault: true, esmResolve: false,
  alias: { "@": path.resolve(__dirname, "..", "src") },
});
const { buildPool } = jiti("../src/lib/discovery/index.ts");
const { SKILLS } = jiti("../src/lib/catalog/index.ts");
const genOnly = [];
for (const s of SKILLS) {
  const st = buildPool([s.id], { level: "beginner" }).stats;
  if (st.catalog === 0 && st.canonical === 0) genOnly.push(s.id);
}
console.log("generated-only skills (%d): %s", genOnly.length, genOnly.join(", "));
