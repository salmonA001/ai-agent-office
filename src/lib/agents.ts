export type Agent = {
  id: string;
  name: string;
  role: string;
  instructions: string;
  custom?: boolean;
};

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
];

/** Stored agent lists from older versions get any default agents they are missing. */
export function withDefaultAgents(stored: Agent[]): Agent[] {
  const have = new Set(stored.map((a) => a.id));
  const missing = DEFAULT_AGENTS.filter((a) => !have.has(a.id));
  const custom = stored.filter((a) => a.custom);
  return [...stored.filter((a) => !a.custom), ...missing, ...custom];
}
