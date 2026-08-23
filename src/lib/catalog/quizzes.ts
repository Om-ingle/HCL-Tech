import type { QuizQuestion } from "@/lib/domain/types";

// ── Assessment question bank ──────────────────────────────────────────────────
// A few MCQs per commonly-assessed skill. The path generator attaches an
// assessment step per phase and pulls questions for that phase's skills. Skills
// without questions fall back to a generic self-check (handled in code).

export const QUIZZES: QuizQuestion[] = [
  // python
  { id: "q-python-1", skillId: "python", question: "What does a Python list comprehension `[x*2 for x in nums]` produce?", options: ["A new list with each element doubled", "The original list, mutated in place", "A generator that must be closed", "A dictionary keyed by index"], answerIndex: 0 },
  { id: "q-python-2", skillId: "python", question: "Which structure is immutable in Python?", options: ["list", "dict", "tuple", "set"], answerIndex: 2 },

  // data-wrangling
  { id: "q-wrangling-1", skillId: "data-wrangling", question: "In Pandas, `df.groupby('col').mean()` returns…", options: ["The mean of each group of rows sharing a value in 'col'", "A single scalar mean of the whole frame", "The rows where 'col' equals its mean", "A plot of the column"], answerIndex: 0 },
  { id: "q-wrangling-2", skillId: "data-wrangling", question: "What does NumPy 'broadcasting' allow?", options: ["Operations between arrays of compatible but different shapes", "Sending arrays over the network", "Automatic GPU execution", "Lossless compression of arrays"], answerIndex: 0 },

  // statistics
  { id: "q-stats-1", skillId: "statistics", question: "A p-value of 0.03 most nearly means…", options: ["A 3% chance the result is due to random variation under the null", "The hypothesis is 97% true", "The effect size is 0.03", "There is no relationship"], answerIndex: 0 },
  { id: "q-stats-2", skillId: "statistics", question: "Which is a measure of spread?", options: ["Mean", "Median", "Standard deviation", "Mode"], answerIndex: 2 },

  // ml-fundamentals
  { id: "q-mlfund-1", skillId: "ml-fundamentals", question: "Overfitting is when a model…", options: ["Fits training data well but generalizes poorly", "Is too simple to learn the pattern", "Trains too quickly", "Uses too little memory"], answerIndex: 0 },
  { id: "q-mlfund-2", skillId: "ml-fundamentals", question: "Why split data into train/test sets?", options: ["To estimate performance on unseen data", "To double the dataset size", "To speed up training only", "To remove all outliers"], answerIndex: 0 },

  // supervised-learning
  { id: "q-sup-1", skillId: "supervised-learning", question: "Which is a classification task?", options: ["Predicting whether an email is spam", "Predicting tomorrow's exact temperature", "Grouping customers without labels", "Reducing dimensions with PCA"], answerIndex: 0 },

  // model-evaluation
  { id: "q-eval-1", skillId: "model-evaluation", question: "For an imbalanced dataset, which metric is most informative?", options: ["Accuracy", "Precision/Recall or F1", "Training time", "Number of features"], answerIndex: 1 },
  { id: "q-eval-2", skillId: "model-evaluation", question: "Data leakage typically causes…", options: ["Overly optimistic validation scores", "Slower training", "Lower memory usage", "Better generalization"], answerIndex: 0 },

  // feature-engineering
  { id: "q-feat-1", skillId: "feature-engineering", question: "One-hot encoding is used to…", options: ["Represent categorical variables numerically", "Normalize continuous variables", "Reduce the number of rows", "Remove missing values"], answerIndex: 0 },

  // model-deployment
  { id: "q-deploy-1", skillId: "model-deployment", question: "A common way to serve a model is to…", options: ["Expose it behind a REST API endpoint", "Email the weights to users", "Paste predictions into a spreadsheet", "Retrain on every request from scratch"], answerIndex: 0 },

  // software-apis
  { id: "q-api-1", skillId: "software-apis", question: "Which HTTP method is conventionally used to create a resource?", options: ["GET", "POST", "DELETE", "HEAD"], answerIndex: 1 },

  // sql
  { id: "q-sql-1", skillId: "sql", question: "Which clause filters grouped rows in SQL?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], answerIndex: 1 },

  // docker
  { id: "q-docker-1", skillId: "docker", question: "A Docker image is best described as…", options: ["A read-only template used to create containers", "A running process", "A virtual machine hypervisor", "A cloud region"], answerIndex: 0 },

  // llm-fundamentals
  { id: "q-llm-1", skillId: "llm-fundamentals", question: "A 'token' in an LLM is roughly…", options: ["A chunk of text (often ~4 characters)", "A user session ID", "A GPU core", "An API key"], answerIndex: 0 },
  { id: "q-llm-2", skillId: "llm-fundamentals", question: "The 'context window' limits…", options: ["How much text the model can consider at once", "The number of users", "The model's training data size", "The temperature setting"], answerIndex: 0 },

  // prompt-engineering
  { id: "q-prompt-1", skillId: "prompt-engineering", question: "Which reliably improves structured output?", options: ["Asking for a specific JSON schema and giving an example", "Increasing temperature to 2.0", "Making the prompt as vague as possible", "Removing all instructions"], answerIndex: 0 },

  // rag
  { id: "q-rag-1", skillId: "rag", question: "RAG reduces hallucination primarily by…", options: ["Retrieving relevant documents and grounding the answer in them", "Fine-tuning on every query", "Lowering the token limit", "Disabling the model's sampling"], answerIndex: 0 },

  // embeddings
  { id: "q-emb-1", skillId: "embeddings", question: "Two texts with similar meaning tend to have embeddings that are…", options: ["Close together (high cosine similarity)", "Exactly identical", "Orthogonal by design", "Always zero vectors"], answerIndex: 0 },

  // security-fundamentals
  { id: "q-sec-1", skillId: "security-fundamentals", question: "The 'CIA triad' in security stands for…", options: ["Confidentiality, Integrity, Availability", "Control, Isolation, Auditing", "Cryptography, Identity, Access", "Compliance, Insurance, Assurance"], answerIndex: 0 },

  // networking
  { id: "q-net-1", skillId: "networking", question: "DNS is primarily responsible for…", options: ["Resolving domain names to IP addresses", "Encrypting all traffic", "Blocking malware", "Assigning MAC addresses"], answerIndex: 0 },

  // web-security
  { id: "q-web-1", skillId: "web-security", question: "SQL injection is best prevented by…", options: ["Parameterized queries / prepared statements", "Hiding the login page", "Using longer passwords", "Disabling cookies"], answerIndex: 0 },
];

export const QUIZ_BY_SKILL: Record<string, QuizQuestion[]> = QUIZZES.reduce(
  (acc, q) => {
    (acc[q.skillId] ??= []).push(q);
    return acc;
  },
  {} as Record<string, QuizQuestion[]>,
);
