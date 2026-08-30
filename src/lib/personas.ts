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
    id: "persona-ananya",
    emoji: "🌱",
    headline: "Final-year student, first real dive into data",
    sampleOnboardingText:
      "Hi, I'm Ananya. Final-year student — honestly I've barely coded, just some C in first year that I've forgotten by now. I want to get into data science before I graduate. Around 8-10 hours a week is realistic with classes, and I have maybe 6 months. I learn best when I'm actually building small things, not watching lectures.",
    profile: {
      id: "persona-ananya",
      name: "Ananya",
      targetRole: "data-scientist",
      goalText:
        "Final-year student with almost no coding experience, aiming for an entry-level data role by graduation. Learns by building small projects.",
      experienceLevel: "beginner",
      learningStyle: "project",
      weeklyHours: 10,
      timelineWeeks: 24,
      careerOutcome: "Land an analyst or junior data scientist role after graduating.",
      interests: ["cricket stats", "data storytelling"],
      knownSkills: known([]),
      preferences: {},
    },
  },
  {
    id: "persona-karthik",
    emoji: "📈",
    headline: "Two years into a dev job, moving toward ML",
    sampleOnboardingText:
      "I'm Karthik. Been working as a software developer for about two years — mostly Python, comfortable with pandas and SQL, though my stats is shaky. I want to move into machine learning engineering, not just notebooks — actually deploying models. 8 hours a week is realistic alongside my job, hoping for 4-5 months. I like reading docs and building things.",
    profile: {
      id: "persona-karthik",
      name: "Karthik",
      targetRole: "ml-engineer",
      goalText:
        "Working Python developer with pandas, SQL and basic stats. Wants to move into machine learning engineering and ship models to production, not just notebooks.",
      experienceLevel: "intermediate",
      learningStyle: "mixed",
      weeklyHours: 8,
      timelineWeeks: 16,
      careerOutcome: "Move from general software work into an ML engineer role.",
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
    id: "persona-elena",
    emoji: "🤖",
    headline: "Backend engineer adding LLMs to her toolkit",
    sampleOnboardingText:
      "Hey, I'm Elena — backend engineer, five years in. Python, REST APIs, Git, Docker, the usual stack. Somehow got through all of it without building anything with LLMs, and now everyone at work wants RAG. I want to actually understand it — RAG apps, agents, the lot. Maybe 12 hours a week, 3 months. I like reading documentation.",
    profile: {
      id: "persona-elena",
      name: "Elena",
      targetRole: "ai-llm-engineer",
      goalText:
        "Senior backend engineer strong in Python, REST APIs, Git and Docker. No LLM experience yet. Wants to become an AI/LLM engineer building RAG apps and agents.",
      experienceLevel: "advanced",
      learningStyle: "reading",
      weeklyHours: 12,
      timelineWeeks: 12,
      careerOutcome: "Become the person on the team who ships production LLM apps.",
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
