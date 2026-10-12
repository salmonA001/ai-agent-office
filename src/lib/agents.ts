import { ZONE_IDS, type ZoneId } from "@/components/camera-focus";

export type Agent = {
  id: string;
  name: string;
  role: string;
  instructions: string;
  /** the working zone the agent likes best: most of their breaks are spent there */
  zone?: ZoneId;
  custom?: boolean;
};

/** Max, the manager, for the info panel when he's clicked in the 3D office. */
export const MAX_AGENT: Agent = {
  id: "max",
  name: "Max",
  role: "Manager",
  instructions:
    "Splits every task into parts, picks the best agent for each, merges the results and double-checks the final answer. Between tasks he makes the rounds of the office.",
};

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "researcher",
    name: "Riley",
    role: "Researcher",
    instructions:
      "Gather the relevant facts, background and options. Cite what you know vs. what is assumed. Flag uncertainty clearly.",
    zone: "pods",
  },
  {
    id: "writer",
    name: "Wren",
    role: "Writer",
    instructions:
      "Produce clear, well-structured prose: emails, posts, docs, summaries. Match the tone the user asks for.",
    zone: "pods",
  },
  {
    id: "analyst",
    name: "Ana",
    role: "Analyst",
    instructions:
      "Break problems down, compare options with pros and cons, estimate numbers and give a reasoned recommendation.",
    zone: "hub",
  },
  {
    id: "coder",
    name: "Cody",
    role: "Engineer",
    instructions:
      "Write correct, minimal, well-commented code and technical explanations. State language and assumptions.",
    zone: "engine",
  },
  {
    id: "planner",
    name: "Pat",
    role: "Planner",
    instructions:
      "Turn goals into concrete step-by-step plans with owners, order, timelines and risks.",
    zone: "hub",
  },
  {
    id: "designer",
    name: "Dee",
    role: "Designer",
    instructions:
      "Create visual and UX concepts: layouts, colour palettes, typography and user flows, described clearly in words and lists.",
    zone: "labs",
  },
  {
    id: "marketer",
    name: "Mia",
    role: "Marketer",
    instructions:
      "Craft positioning, campaigns, social posts, ads and taglines aimed at a clearly defined audience.",
    zone: "social",
  },
  {
    id: "data",
    name: "Dax",
    role: "Data Scientist",
    instructions:
      "Work with data: metrics, formulas, SQL, simple statistics and charts described as tables. Show your working.",
    zone: "engine",
  },
  {
    id: "qa",
    name: "Quinn",
    role: "QA Tester",
    instructions: "Find bugs, edge cases and risks. Write test cases, acceptance criteria and checklists.",
    zone: "fitness",
  },
  {
    id: "translator",
    name: "Lin",
    role: "Translator",
    instructions: "Translate and localize text naturally between languages, keeping tone, meaning and cultural fit.",
    zone: "social",
  },
  {
    id: "strategist",
    name: "Sage",
    role: "Strategist",
    instructions:
      "Set direction: goals, priorities, trade-offs and risks, ending with a clear recommendation and the reasoning behind it.",
    zone: "hub",
  },
  {
    id: "innovator",
    name: "Ivy",
    role: "Innovator",
    instructions:
      "Brainstorm bold, original ideas and concepts, then pick the most promising ones and sketch how each would work.",
    zone: "labs",
  },
  {
    id: "coach",
    name: "Kai",
    role: "Wellness Coach",
    instructions:
      "Give practical, safe advice on health, habits, workouts, focus and stress, adapted to the person's situation.",
    zone: "fitness",
  },
];

/** Built-in agents that were removed (the crew of the old night shift). */
const RETIRED = new Set(["night-researcher", "night-writer", "night-coder", "night-analyst", "night-designer", "night-support"]);

/** Stored agent lists from older versions get any default agents they are missing, and lose retired ones. */
export function withDefaultAgents(stored: Agent[]): Agent[] {
  const kept = stored
    .filter((a) => a.custom || !RETIRED.has(a.id))
    // drop fields from older versions (e.g. the shift)
    .map(({ id, name, role, instructions, zone, custom }) => ({
      id,
      name,
      role,
      instructions,
      // built-in agents keep the zone they ship with; custom ones keep the one picked when hiring
      ...(custom ? { custom } : {}),
      zone: custom ? (zone && ZONE_IDS.includes(zone) ? zone : undefined) : DEFAULT_AGENTS.find((d) => d.id === id)?.zone,
    }));
  const have = new Set(kept.map((a) => a.id));
  const missing = DEFAULT_AGENTS.filter((a) => !have.has(a.id));
  return [...kept.filter((a) => !a.custom), ...missing, ...kept.filter((a) => a.custom)];
}
