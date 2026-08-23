import type { KnownSkill, LearnerProfile } from "@/lib/domain/types";

export interface Persona {
  id: string; // stable id so re-seeding is idempotent
  emoji: string;
  headline: string; // one-line pitch for the persona switcher
  sampleOnboardingText: string; // what they'd type into onboarding (demo shortcut)
  profile: Omit<LearnerProfile, "id"> & { id: string };
}

function known(pairs: [string, number][]): KnownSkill[] {
  return pairs.map(([skillId, proficiency]) => ({ skillId, proficiency }));
}

// Three deliberately different starting points → three visibly different roadmaps.
export const PERSONAS: Persona[] = [
  {
    id: "persona-maya",
    emoji: "🌱",
    headline: "Complete beginner aiming to become a Data Scientist",
    sampleOnboardingText:
      "Hi, I'm Maya. I'm a complete beginner — I've never really coded — but I want to become a data scientist. I can study about 10 hours a week and I'd like to get there in around 6 months. I learn best by doing small projects.",
    profile: {
      id: "persona-maya",
      name: "Maya",
      targetRole: "data-scientist",
      goalText:
        "Complete beginner who wants to become a data scientist. No coding background yet. Prefers hands-on projects.",
      experienceLevel: "beginner",
      learningStyle: "project",
      weeklyHours: 10,
      timelineWeeks: 24,
      careerOutcome: "Land an entry-level data scientist role.",
      interests: ["healthcare", "data storytelling"],
      knownSkills: known([]),
      preferences: {},
    },
  },
  {
    id: "persona-dev",
    emoji: "📈",
    headline: "Intermediate Python dev moving into ML Engineering",
    sampleOnboardingText:
      "I'm Dev. I've been writing Python for a couple of years and I'm comfortable with pandas and SQL, plus some basic statistics. I want to become a machine learning engineer. I have about 8 hours a week and want to be job-ready in 4 months. I like reading docs and building things.",
    profile: {
      id: "persona-dev",
      name: "Dev",
      targetRole: "ml-engineer",
      goalText:
        "Intermediate Python developer with pandas, SQL and basic stats. Wants to move into machine learning engineering and ship models to production.",
      experienceLevel: "intermediate",
      learningStyle: "mixed",
      weeklyHours: 8,
      timelineWeeks: 16,
      careerOutcome: "Transition from software work into an ML engineer role.",
      interests: ["recommender systems", "MLOps"],
      knownSkills: known([
        ["python", 3],
        ["programming-fundamentals", 3],
        ["data-wrangling", 2],
        ["sql", 2],
        ["statistics", 1],
        ["git", 2],
      ]),
      preferences: {},
    },
  },
  {
    id: "persona-sam",
    emoji: "🤖",
    headline: "Backend developer pivoting to AI / LLM Engineering",
    sampleOnboardingText:
      "Hey, I'm Sam, a backend software engineer. I'm strong with Python, REST APIs, Git and Docker, but I've never built anything with LLMs. I want to become an AI/LLM engineer and build RAG apps and agents. I've got 12 hours a week and want to move fast — maybe 3 months. I like reading documentation.",
    profile: {
      id: "persona-sam",
      name: "Sam",
      targetRole: "ai-llm-engineer",
      goalText:
        "Backend software engineer strong in Python, REST APIs, Git and Docker. No LLM experience yet. Wants to become an AI/LLM engineer building RAG apps and agents.",
      experienceLevel: "advanced",
      learningStyle: "reading",
      weeklyHours: 12,
      timelineWeeks: 12,
      careerOutcome: "Become an AI/LLM engineer shipping production LLM apps.",
      interests: ["developer tools", "AI agents"],
      knownSkills: known([
        ["python", 3],
        ["programming-fundamentals", 3],
        ["software-apis", 3],
        ["git", 3],
        ["linux-cli", 2],
        ["docker", 2],
        ["testing", 2],
        ["databases", 2],
        ["sql", 2],
      ]),
      preferences: {},
    },
  },
];

export const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p]),
);
