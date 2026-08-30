import { norm } from "./text";

// ── Goal archetypes ──────────────────────────────────────────────────────────
// A destination is NOT a new career object with its own resources — it is just a
// label plus a handful of ANCHOR skills already in the graph. Prerequisites are
// expanded from the graph at resolve time, so adding a goal costs ~1 line and
// never duplicates a skill or a resource.
//
// `match` phrases are matched word-boundary-aware against the learner's goal
// text; the longest matching phrase wins. Anchors are `[skillId, targetLevel]`
// where level is 1 aware / 2 working / 3 strong.

export interface GoalArchetype {
  id: string;
  label: string;
  domain: string;
  match: string[];
  anchors: [string, number][];
}

export const GOAL_ARCHETYPES: GoalArchetype[] = [
  {
    id: "kernel-developer",
    label: "Linux Kernel Developer",
    domain: "Systems",
    match: ["kernel developer", "kernel development", "kernel engineer", "linux kernel", "kernel programmer", "kernel hacker", "os developer", "operating system developer"],
    anchors: [["kernel-development", 3], ["device-drivers", 2], ["memory-management", 3], ["concurrency", 2], ["debugging-tools", 2], ["build-systems", 2], ["filesystems", 1]],
  },
  {
    id: "systems-engineer",
    label: "Systems Software Engineer",
    domain: "Systems",
    match: ["systems engineer", "systems programmer", "systems software", "low level developer", "low level engineer", "infrastructure software"],
    anchors: [["systems-programming", 3], ["concurrency", 3], ["memory-management", 2], ["network-programming", 2], ["performance-optimization", 2], ["debugging-tools", 2]],
  },
  {
    id: "compiler-engineer",
    label: "Compiler Engineer",
    domain: "Systems",
    match: ["compiler engineer", "compiler developer", "compiler design", "llvm engineer", "toolchain engineer", "programming language designer"],
    anchors: [["compilers", 3], ["assembly", 2], ["performance-optimization", 2], ["algorithms", 3], ["build-systems", 2]],
  },
  {
    id: "robotics-engineer",
    label: "Robotics Engineer",
    domain: "Robotics",
    match: ["robotics engineer", "robotics", "robot engineer", "robotics developer", "robotics software", "mechatronics engineer"],
    anchors: [["ros", 3], ["kinematics", 2], ["control-systems", 3], ["state-estimation", 2], ["sensors-actuators", 2], ["motion-planning", 2], ["robot-simulation", 2]],
  },
  {
    id: "autonomy-engineer",
    label: "Autonomy / Self-Driving Engineer",
    domain: "Robotics",
    match: ["autonomous systems", "self driving", "autonomous vehicle", "autonomy engineer", "autonomous robotics", "underwater robotics", "drone engineer", "uav engineer", "auv"],
    anchors: [["autonomous-systems", 3], ["slam", 2], ["state-estimation", 3], ["motion-planning", 3], ["control-systems", 2], ["computer-vision", 2], ["sensors-actuators", 2]],
  },
  {
    id: "control-engineer",
    label: "Control Systems Engineer",
    domain: "Robotics",
    match: ["control engineer", "control systems engineer", "control theory", "controls engineer", "guidance and control"],
    anchors: [["control-systems", 3], ["optimal-control", 2], ["state-estimation", 2], ["signal-processing", 2], ["numerical-methods", 2]],
  },
  {
    id: "embedded-engineer",
    label: "Embedded Systems Engineer",
    domain: "Embedded",
    match: ["embedded systems engineer", "embedded engineer", "embedded developer", "embedded systems", "firmware engineer", "firmware developer", "iot engineer"],
    anchors: [["embedded-c", 3], ["microcontrollers", 3], ["hardware-interfaces", 2], ["rtos", 2], ["digital-electronics", 2], ["debugging-tools", 2]],
  },
  {
    id: "quant-developer",
    label: "Quantitative Developer",
    domain: "Quantitative Finance",
    match: ["quant developer", "quantitative developer", "quant dev", "quantitative engineer", "quant engineer", "quant software"],
    anchors: [["quantitative-trading", 2], ["backtesting", 3], ["time-series", 3], ["financial-markets", 2], ["low-latency-programming", 2], ["cpp-programming", 2], ["portfolio-theory", 1]],
  },
  {
    id: "quant-researcher",
    label: "Quantitative Researcher",
    domain: "Quantitative Finance",
    match: ["quant researcher", "quantitative researcher", "quant analyst", "quantitative analyst", "quantitative finance", "derivatives pricing", "quant"],
    anchors: [["derivatives-pricing", 3], ["stochastic-processes", 3], ["time-series", 3], ["portfolio-theory", 2], ["financial-markets", 2], ["numerical-methods", 2]],
  },
  {
    id: "algo-trader",
    label: "Algorithmic Trading Engineer",
    domain: "Quantitative Finance",
    match: ["algorithmic trading", "algo trading", "systematic trading", "trading systems", "hft engineer", "high frequency trading", "trading engineer"],
    anchors: [["quantitative-trading", 3], ["low-latency-programming", 3], ["backtesting", 3], ["financial-markets", 3], ["time-series", 2]],
  },
  {
    id: "game-engine-programmer",
    label: "Game Engine Programmer",
    domain: "Graphics",
    match: ["game engine programmer", "game engine developer", "engine programmer", "game engine", "engine developer"],
    anchors: [["game-engine-architecture", 3], ["rendering-pipeline", 3], ["physics-simulation", 2], ["performance-optimization", 3], ["animation-systems", 2], ["graphics-apis", 2]],
  },
  {
    id: "graphics-engineer",
    label: "Computer Graphics Engineer",
    domain: "Graphics",
    match: ["graphics engineer", "computer graphics", "graphics programmer", "rendering engineer", "graphics developer", "shader programmer", "visual computing"],
    anchors: [["computer-graphics", 3], ["graphics-apis", 3], ["shaders", 3], ["rendering-pipeline", 3], ["ray-tracing", 2], ["gpu-programming", 2]],
  },
  {
    id: "game-developer",
    label: "Game Developer",
    domain: "Graphics",
    match: ["game developer", "game programmer", "gamedev", "game development", "unity developer", "unreal developer"],
    anchors: [["game-programming", 3], ["computer-graphics", 2], ["physics-simulation", 2], ["animation-systems", 1], ["cpp-programming", 2]],
  },
  {
    id: "gpu-engineer",
    label: "GPU / Parallel Computing Engineer",
    domain: "Graphics",
    match: ["gpu engineer", "cuda developer", "gpu programming", "parallel computing engineer", "hpc engineer", "high performance computing"],
    anchors: [["gpu-programming", 3], ["performance-optimization", 3], ["computer-architecture", 2], ["numerical-methods", 2], ["concurrency", 2]],
  },
  {
    id: "quantum-engineer",
    label: "Quantum Software Engineer",
    domain: "Quantum Computing",
    match: ["quantum software engineer", "quantum software", "quantum computing", "quantum engineer", "quantum developer", "quantum programmer", "quantum information"],
    anchors: [["quantum-programming", 3], ["quantum-computing", 3], ["quantum-algorithms", 2], ["quantum-mechanics", 2], ["math-linear-algebra", 3], ["quantum-error-correction", 1]],
  },
  {
    id: "mlops-engineer",
    label: "MLOps Engineer",
    domain: "MLOps",
    match: ["mlops engineer", "mlops", "ml platform engineer", "ml infrastructure engineer", "ml ops"],
    anchors: [["mlops", 3], ["model-deployment", 3], ["ml-pipelines", 3], ["model-monitoring", 2], ["kubernetes", 2], ["ci-cd", 2], ["infrastructure-as-code", 2]],
  },
  {
    id: "security-engineer",
    label: "Cybersecurity Engineer",
    domain: "Security",
    match: ["cybersecurity engineer", "security engineer", "cyber security engineer", "cybersecurity", "infosec engineer", "application security engineer", "appsec engineer"],
    anchors: [["security-fundamentals", 3], ["networking", 3], ["web-security", 3], ["cryptography", 2], ["threat-analysis", 2], ["cloud-security", 2], ["incident-response", 2]],
  },
  {
    id: "pentester",
    label: "Penetration Tester",
    domain: "Security",
    match: ["penetration tester", "pentester", "ethical hacker", "red team", "offensive security", "bug bounty"],
    anchors: [["pen-testing", 3], ["web-security", 3], ["networking", 3], ["reverse-engineering", 2], ["binary-exploitation", 1]],
  },
  {
    id: "reverse-engineer",
    label: "Reverse Engineer / Malware Analyst",
    domain: "Security",
    match: ["reverse engineer", "reverse engineering", "malware analyst", "malware analysis", "binary analysis"],
    anchors: [["reverse-engineering", 3], ["assembly", 3], ["binary-exploitation", 2], ["operating-systems", 2], ["c-programming", 2]],
  },
  {
    id: "data-engineer",
    label: "Data Engineer",
    domain: "Data",
    match: ["data engineer", "data engineering", "etl developer", "analytics engineer", "data platform engineer"],
    anchors: [["data-engineering", 3], ["sql", 3], ["big-data", 2], ["streaming-data", 2], ["databases", 2], ["docker", 2]],
  },
  {
    id: "devops-engineer",
    label: "DevOps / Platform Engineer",
    domain: "Cloud",
    match: ["devops engineer", "devops", "platform engineer", "sre", "site reliability", "infrastructure engineer"],
    anchors: [["ci-cd", 3], ["docker", 3], ["kubernetes", 3], ["infrastructure-as-code", 3], ["cloud-compute", 2], ["linux-cli", 3]],
  },
  {
    id: "frontend-engineer",
    label: "Frontend Engineer",
    domain: "Software",
    match: ["frontend engineer", "frontend developer", "front end developer", "ui engineer", "react developer", "web developer"],
    anchors: [["web-frontend", 3], ["software-apis", 2], ["testing", 2], ["git", 2]],
  },
  {
    id: "mobile-engineer",
    label: "Mobile Engineer",
    domain: "Software",
    match: ["mobile engineer", "mobile developer", "android developer", "ios developer", "app developer", "flutter developer"],
    anchors: [["mobile-development", 3], ["software-apis", 2], ["testing", 2], ["git", 2]],
  },
  {
    id: "distributed-systems-engineer",
    label: "Distributed Systems Engineer",
    domain: "Software",
    match: ["distributed systems engineer", "distributed systems", "backend infrastructure", "database engineer"],
    anchors: [["distributed-systems", 3], ["system-design", 3], ["concurrency", 2], ["networking", 2], ["databases", 2]],
  },
  {
    id: "research-engineer",
    label: "ML Research Engineer",
    domain: "Machine Learning",
    match: ["research engineer", "ml researcher", "machine learning researcher", "ai researcher", "deep learning engineer", "reinforcement learning"],
    anchors: [["deep-learning", 3], ["reinforcement-learning", 2], ["math-linear-algebra", 3], ["optimization", 2], ["model-evaluation", 2], ["fine-tuning", 2]],
  },
  {
    id: "computer-vision-engineer",
    label: "Computer Vision Engineer",
    domain: "Machine Learning",
    match: ["computer vision engineer", "computer vision", "cv engineer", "image processing engineer", "perception engineer"],
    anchors: [["computer-vision", 3], ["deep-learning", 3], ["signal-processing", 2], ["model-deployment", 2]],
  },
];

export interface ArchetypeMatch {
  archetype: GoalArchetype;
  term: string;
}

/** Longest-phrase-wins archetype match against free goal text. */
export function matchArchetype(text: string): ArchetypeMatch | null {
  const padded = ` ${norm(text)} `;
  let best: ArchetypeMatch | null = null;
  for (const archetype of GOAL_ARCHETYPES) {
    for (const phrase of archetype.match) {
      const p = norm(phrase);
      if (!padded.includes(` ${p} `)) continue;
      if (!best || p.length > norm(best.term).length) best = { archetype, term: phrase };
    }
  }
  return best;
}

export const ARCHETYPE_BY_ID: Record<string, GoalArchetype> = Object.fromEntries(
  GOAL_ARCHETYPES.map((a) => [a.id, a]),
);
