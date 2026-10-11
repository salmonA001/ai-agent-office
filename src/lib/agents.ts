import type { Shift } from "./office-clock";

export type Agent = {
  id: string;
  name: string;
  role: string;
  instructions: string;
  custom?: boolean;
  /** which crew they work with; missing means the day shift */
  shift?: Shift;
};

export const shiftOf = (a: Agent): Shift => a.shift ?? "day";

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "researcher",
    name: "Riley",
    role: "Researcher",
    instructions:
      "Gather the relevant facts, background and options. Cite what you know vs. what is assumed. Flag uncertainty clearly.",
  },
  {
    id: "writer",
    name: "Wren",
    role: "Writer",
    instructions:
      "Produce clear, well-structured prose: emails, posts, docs, summaries. Match the tone the user asks for.",
  },
  {
    id: "analyst",
    name: "Ana",
    role: "Analyst",
    instructions:
      "Break problems down, compare options with pros and cons, estimate numbers and give a reasoned recommendation.",
  },
  {
    id: "coder",
    name: "Cody",
    role: "Engineer",
    instructions:
      "Write correct, minimal, well-commented code and technical explanations. State language and assumptions.",
  },
  {
    id: "planner",
    name: "Pat",
    role: "Planner",
    instructions:
      "Turn goals into concrete step-by-step plans with owners, order, timelines and risks.",
  },
  {
    id: "designer",
    name: "Dee",
    role: "Designer",
    instructions:
      "Create visual and UX concepts: layouts, colour palettes, typography and user flows, described clearly in words and lists.",
  },
  {
    id: "marketer",
    name: "Mia",
    role: "Marketer",
    instructions:
      "Craft positioning, campaigns, social posts, ads and taglines aimed at a clearly defined audience.",
  },
  {
    id: "data",
    name: "Dax",
    role: "Data Scientist",
    instructions:
      "Work with data: metrics, formulas, SQL, simple statistics and charts described as tables. Show your working.",
  },
  {
    id: "qa",
    name: "Quinn",
    role: "QA Tester",
    instructions: "Find bugs, edge cases and risks. Write test cases, acceptance criteria and checklists.",
  },
  {
    id: "translator",
    name: "Lin",
    role: "Translator",
    instructions: "Translate and localize text naturally between languages, keeping tone, meaning and cultural fit.",
  },
  // ----- night crew -----
  {
    id: "night-researcher",
    name: "Nova",
    role: "Researcher",
    shift: "night",
    instructions:
      "Dig up facts, sources and options while the day team sleeps. Separate what is known from what is assumed and flag doubts.",
  },
  {
    id: "night-writer",
    name: "Luna",
    role: "Writer",
    shift: "night",
    instructions: "Write clear, friendly copy: emails, posts, summaries and docs, in whatever tone the user asks for.",
  },
  {
    id: "night-coder",
    name: "Orion",
    role: "Engineer",
    shift: "night",
    instructions: "Write correct, minimal, well-commented code and technical explanations. State language and assumptions.",
  },
  {
    id: "night-analyst",
    name: "Vega",
    role: "Analyst",
    shift: "night",
    instructions: "Break problems down, compare options with pros and cons, run the numbers and recommend one clearly.",
  },
  {
    id: "night-designer",
    name: "Iris",
    role: "Designer",
    shift: "night",
    instructions: "Describe layouts, colour palettes, typography and user flows in clear words and lists.",
  },
  {
    id: "night-support",
    name: "Sol",
    role: "Support Specialist",
    shift: "night",
    instructions: "Answer customer questions and write replies, FAQs and help articles in a warm, clear voice.",
  },
];

/** Stored agent lists from older versions get any default agents they are missing. */
export function withDefaultAgents(stored: Agent[]): Agent[] {
  const have = new Set(stored.map((a) => a.id));
  const missing = DEFAULT_AGENTS.filter((a) => !have.has(a.id));
  const custom = stored.filter((a) => a.custom);
  return [...stored.filter((a) => !a.custom), ...missing, ...custom];
}
