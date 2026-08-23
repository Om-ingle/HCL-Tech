import type { Skill } from "@/lib/domain/types";

// ── Skill graph ───────────────────────────────────────────────────────────────
// `tier` is a rough foundational→advanced ordering; `prerequisites` form a DAG
// used for topological ordering and step-locking. Kept intentionally acyclic.

export const SKILLS: Skill[] = [
  // Programming / foundations
  { id: "programming-fundamentals", name: "Programming Fundamentals", domain: "Programming", tier: 1, prerequisites: [], description: "Variables, control flow, functions, and data structures." },
  { id: "python", name: "Python", domain: "Programming", tier: 1, prerequisites: [], description: "General-purpose programming with Python, the lingua franca of data & AI." },
  { id: "git", name: "Git & Version Control", domain: "Software", tier: 1, prerequisites: [], description: "Track changes, branch, and collaborate with Git." },
  { id: "linux-cli", name: "Linux & Command Line", domain: "Software", tier: 1, prerequisites: [], description: "Navigate and operate systems from the shell." },

  // Math
  { id: "math-linear-algebra", name: "Linear Algebra", domain: "Math", tier: 2, prerequisites: [], description: "Vectors, matrices, and operations underpinning ML." },
  { id: "statistics", name: "Statistics", domain: "Math", tier: 2, prerequisites: [], description: "Descriptive and inferential statistics for data work." },
  { id: "probability", name: "Probability", domain: "Math", tier: 2, prerequisites: [], description: "Distributions, expectation, and probabilistic reasoning." },

  // Data
  { id: "sql", name: "SQL", domain: "Data", tier: 2, prerequisites: ["programming-fundamentals"], description: "Query and shape relational data." },
  { id: "data-wrangling", name: "Data Wrangling (NumPy/Pandas)", domain: "Data", tier: 2, prerequisites: ["python"], description: "Manipulate arrays and dataframes with NumPy and Pandas." },
  { id: "data-visualization", name: "Data Visualization", domain: "Data", tier: 2, prerequisites: ["python", "statistics"], description: "Communicate insight with charts and dashboards." },
  { id: "data-cleaning", name: "Data Cleaning", domain: "Data", tier: 2, prerequisites: ["data-wrangling"], description: "Handle missing, dirty, and inconsistent data." },
  { id: "eda", name: "Exploratory Data Analysis", domain: "Data", tier: 3, prerequisites: ["data-wrangling", "statistics", "data-visualization"], description: "Profile datasets to form hypotheses." },

  // Machine Learning
  { id: "ml-fundamentals", name: "ML Fundamentals", domain: "Machine Learning", tier: 3, prerequisites: ["data-wrangling", "statistics", "math-linear-algebra"], description: "Core ideas: training, generalization, bias/variance." },
  { id: "supervised-learning", name: "Supervised Learning", domain: "Machine Learning", tier: 3, prerequisites: ["ml-fundamentals"], description: "Regression and classification models." },
  { id: "unsupervised-learning", name: "Unsupervised Learning", domain: "Machine Learning", tier: 3, prerequisites: ["ml-fundamentals"], description: "Clustering and dimensionality reduction." },
  { id: "model-evaluation", name: "Model Evaluation", domain: "Machine Learning", tier: 3, prerequisites: ["supervised-learning"], description: "Metrics, validation, and avoiding leakage." },
  { id: "feature-engineering", name: "Feature Engineering", domain: "Machine Learning", tier: 3, prerequisites: ["data-wrangling", "ml-fundamentals"], description: "Transform raw data into predictive features." },
  { id: "deep-learning", name: "Deep Learning", domain: "Machine Learning", tier: 4, prerequisites: ["supervised-learning", "math-linear-algebra"], description: "Neural networks with PyTorch/TensorFlow." },
  { id: "nlp", name: "Natural Language Processing", domain: "Machine Learning", tier: 4, prerequisites: ["deep-learning"], description: "Model and process human language." },
  { id: "computer-vision", name: "Computer Vision", domain: "Machine Learning", tier: 4, prerequisites: ["deep-learning"], description: "Model and interpret images." },

  // MLOps / ML Engineering
  { id: "software-apis", name: "REST APIs", domain: "Software", tier: 3, prerequisites: ["programming-fundamentals"], description: "Design and build HTTP APIs." },
  { id: "model-deployment", name: "Model Deployment", domain: "MLOps", tier: 4, prerequisites: ["ml-fundamentals", "software-apis"], description: "Serve models behind an API." },
  { id: "ml-pipelines", name: "ML Pipelines", domain: "MLOps", tier: 4, prerequisites: ["model-deployment", "data-wrangling"], description: "Automate training and data workflows." },
  { id: "mlops", name: "MLOps", domain: "MLOps", tier: 5, prerequisites: ["model-deployment", "docker"], description: "Operationalize ML: CI/CD, registries, reproducibility." },
  { id: "model-monitoring", name: "Model Monitoring", domain: "MLOps", tier: 5, prerequisites: ["mlops"], description: "Detect drift and degradation in production." },

  // Software
  { id: "databases", name: "Databases", domain: "Software", tier: 3, prerequisites: ["sql"], description: "Relational modeling, indexing, transactions." },
  { id: "testing", name: "Software Testing", domain: "Software", tier: 3, prerequisites: ["programming-fundamentals"], description: "Unit, integration, and automated testing." },
  { id: "system-design", name: "System Design", domain: "Software", tier: 4, prerequisites: ["software-apis", "databases"], description: "Design scalable, reliable services." },

  // Cloud / DevOps
  { id: "docker", name: "Docker & Containers", domain: "Cloud", tier: 3, prerequisites: ["linux-cli"], description: "Package apps into portable containers." },
  { id: "ci-cd", name: "CI/CD", domain: "Cloud", tier: 4, prerequisites: ["git", "docker", "testing"], description: "Automate build, test, and release." },
  { id: "cloud-fundamentals", name: "Cloud Fundamentals", domain: "Cloud", tier: 3, prerequisites: ["linux-cli"], description: "Core cloud concepts and the shared-responsibility model." },
  { id: "cloud-compute", name: "Cloud Compute", domain: "Cloud", tier: 3, prerequisites: ["cloud-fundamentals"], description: "VMs, serverless, and autoscaling." },
  { id: "cloud-storage", name: "Cloud Storage & Databases", domain: "Cloud", tier: 3, prerequisites: ["cloud-fundamentals"], description: "Object stores, managed databases, and caching." },
  { id: "infrastructure-as-code", name: "Infrastructure as Code", domain: "Cloud", tier: 4, prerequisites: ["cloud-fundamentals"], description: "Provision infra declaratively (Terraform)." },
  { id: "kubernetes", name: "Kubernetes", domain: "Cloud", tier: 5, prerequisites: ["docker", "cloud-compute"], description: "Orchestrate containers at scale." },

  // AI & LLMs
  { id: "llm-fundamentals", name: "LLM Fundamentals", domain: "AI & LLMs", tier: 3, prerequisites: ["python"], description: "How large language models work: tokens, context, sampling." },
  { id: "prompt-engineering", name: "Prompt Engineering", domain: "AI & LLMs", tier: 3, prerequisites: ["llm-fundamentals"], description: "Design reliable prompts and structured outputs." },
  { id: "embeddings", name: "Embeddings", domain: "AI & LLMs", tier: 3, prerequisites: ["llm-fundamentals"], description: "Represent meaning as vectors for search & retrieval." },
  { id: "vector-databases", name: "Vector Databases", domain: "AI & LLMs", tier: 4, prerequisites: ["embeddings"], description: "Store and query embeddings at scale." },
  { id: "rag", name: "Retrieval-Augmented Generation", domain: "AI & LLMs", tier: 4, prerequisites: ["prompt-engineering", "embeddings"], description: "Ground LLM answers in your own data." },
  { id: "llm-apps", name: "Building LLM Applications", domain: "AI & LLMs", tier: 4, prerequisites: ["prompt-engineering", "software-apis"], description: "Ship production apps on top of LLM APIs." },
  { id: "llm-evaluation", name: "LLM Evaluation", domain: "AI & LLMs", tier: 4, prerequisites: ["llm-apps"], description: "Measure quality, safety, and regressions." },
  { id: "agents", name: "AI Agents", domain: "AI & LLMs", tier: 5, prerequisites: ["llm-apps", "rag"], description: "Tool-using, multi-step autonomous systems." },
  { id: "fine-tuning", name: "Fine-Tuning", domain: "AI & LLMs", tier: 5, prerequisites: ["deep-learning", "llm-fundamentals"], description: "Adapt models to a domain or task." },

  // Security
  { id: "security-fundamentals", name: "Security Fundamentals", domain: "Security", tier: 2, prerequisites: [], description: "CIA triad, threats, and defense in depth." },
  { id: "networking", name: "Networking", domain: "Security", tier: 2, prerequisites: [], description: "TCP/IP, DNS, and the protocols attacks ride on." },
  { id: "cryptography", name: "Cryptography", domain: "Security", tier: 3, prerequisites: ["security-fundamentals"], description: "Hashing, symmetric/asymmetric encryption, TLS." },
  { id: "web-security", name: "Web Security", domain: "Security", tier: 3, prerequisites: ["security-fundamentals", "software-apis"], description: "OWASP Top 10 and secure web apps." },
  { id: "threat-analysis", name: "Threat Analysis", domain: "Security", tier: 4, prerequisites: ["security-fundamentals", "networking"], description: "Identify, model, and prioritize threats." },
  { id: "incident-response", name: "Incident Response", domain: "Security", tier: 4, prerequisites: ["threat-analysis"], description: "Detect, contain, and recover from incidents." },
  { id: "pen-testing", name: "Penetration Testing", domain: "Security", tier: 4, prerequisites: ["web-security", "networking"], description: "Authorized offensive testing of systems." },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
);
