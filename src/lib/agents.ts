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
];
