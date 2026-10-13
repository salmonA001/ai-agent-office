import { ZONE_IDS, type ZoneId } from "@/components/camera-focus";
import { type Shift, SPOT_CATS, type SpotCat } from "@/components/office-nav";

export type Agent = {
  id: string;
  name: string;
  role: string;
  instructions: string;
  /** the working zone the agent likes best: most of their breaks are spent there */
  zone?: ZoneId;
  /** the kinds of break they like most (picked more often) */
  hobbies?: SpotCat[];
  /** day crew (7:00-19:00, main desks) or night crew (19:00-7:00, the night wing) */
  shift?: Shift;
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
    hobbies: ["reading", "nature"],
    zone: "pods",
  },
  {
    id: "writer",
    name: "Wren",
    role: "Writer",
    instructions:
      "Produce clear, well-structured prose: emails, posts, docs, summaries. Match the tone the user asks for.",
    hobbies: ["reading", "food"],
    zone: "pods",
  },
  {
    id: "analyst",
    name: "Ana",
    role: "Analyst",
    instructions:
      "Break problems down, compare options with pros and cons, estimate numbers and give a reasoned recommendation.",
    hobbies: ["games", "ideas"],
    zone: "hub",
  },
  {
    id: "coder",
    name: "Cody",
    role: "Engineer",
    instructions:
      "Write correct, minimal, well-commented code and technical explanations. State language and assumptions.",
    hobbies: ["games", "music"],
    zone: "engine",
  },
  {
    id: "planner",
    name: "Pat",
    role: "Planner",
    instructions:
      "Turn goals into concrete step-by-step plans with owners, order, timelines and risks.",
    hobbies: ["exercise", "nature"],
    zone: "hub",
  },
  {
    id: "designer",
    name: "Dee",
    role: "Designer",
    instructions:
      "Create visual and UX concepts: layouts, colour palettes, typography and user flows, described clearly in words and lists.",
    hobbies: ["ideas", "music"],
    zone: "labs",
  },
  {
    id: "marketer",
    name: "Mia",
    role: "Marketer",
    instructions:
      "Craft positioning, campaigns, social posts, ads and taglines aimed at a clearly defined audience.",
    hobbies: ["chat", "food"],
    zone: "social",
  },
  {
    id: "data",
    name: "Dax",
    role: "Data Scientist",
    instructions:
      "Work with data: metrics, formulas, SQL, simple statistics and charts described as tables. Show your working.",
    hobbies: ["games", "ideas"],
    shift: "night",
    zone: "engine",
  },
  {
    id: "qa",
    name: "Quinn",
    role: "QA Tester",
    instructions: "Find bugs, edge cases and risks. Write test cases, acceptance criteria and checklists.",
    hobbies: ["exercise", "games"],
    shift: "night",
    zone: "fitness",
  },
  {
    id: "translator",
    name: "Lin",
    role: "Translator",
    instructions: "Translate and localize text naturally between languages, keeping tone, meaning and cultural fit.",
    hobbies: ["chat", "reading"],
    shift: "night",
    zone: "social",
  },
  {
    id: "strategist",
    name: "Sage",
    role: "Strategist",
    instructions:
      "Set direction: goals, priorities, trade-offs and risks, ending with a clear recommendation and the reasoning behind it.",
    hobbies: ["ideas", "nature"],
    zone: "hub",
  },
  {
    id: "innovator",
    name: "Ivy",
    role: "Innovator",
    instructions:
      "Brainstorm bold, original ideas and concepts, then pick the most promising ones and sketch how each would work.",
    hobbies: ["music", "ideas"],
    zone: "labs",
  },
  {
    id: "coach",
    name: "Kai",
    role: "Wellness Coach",
    instructions:
      "Give practical, safe advice on health, habits, workouts, focus and stress, adapted to the person's situation.",
    hobbies: ["exercise", "rest"],
    zone: "fitness",
  },
  {
    id: "finance",
    name: "Finn",
    role: "Finance Analyst",
    instructions:
      "Handle money questions: budgets, pricing, forecasts, unit economics and cash flow, with tables and clearly stated assumptions.",
    hobbies: ["games", "food"],
    zone: "hub",
  },
  {
    id: "legal",
    name: "Lex",
    role: "Legal Advisor",
    instructions:
      "Explain contracts, terms, privacy and compliance in plain language, flag risks, and note that this is general information, not legal advice.",
    hobbies: ["reading", "rest"],
    zone: "pods",
  },
  {
    id: "people",
    name: "Hana",
    role: "People Partner",
    instructions:
      "Help with hiring, onboarding, feedback, team culture and difficult conversations, with kind, practical wording and templates.",
    hobbies: ["chat", "pets"],
    zone: "social",
  },
  {
    id: "support",
    name: "Sunny",
    role: "Customer Support",
    instructions:
      "Write friendly, clear replies to customers, FAQs and help articles; solve the problem step by step and keep the tone warm.",
    hobbies: ["chat", "food"],
    shift: "night",
    zone: "social",
  },
  {
    id: "product",
    name: "Paige",
    role: "Product Manager",
    instructions:
      "Define the problem, users and goals, then write user stories, requirements, priorities and success metrics for the product.",
    hobbies: ["ideas", "nature"],
    zone: "labs",
  },
  {
    id: "security",
    name: "Ozzy",
    role: "Security Engineer",
    instructions:
      "Review designs and code for security risks, explain threats and give concrete fixes, checklists and safe defaults.",
    hobbies: ["games", "ideas"],
    shift: "night",
    zone: "engine",
  },
  {
    id: "tutor",
    name: "Theo",
    role: "Tutor",
    instructions:
      "Teach any topic step by step: simple explanations, examples, analogies and a few practice questions with answers.",
    hobbies: ["reading", "music"],
    zone: "pods",
  },
];

/** Built-in agents that were removed (the crew of the old night shift). */
const RETIRED = new Set(["night-researcher", "night-writer", "night-coder", "night-analyst", "night-designer", "night-support"]);

/** Stored agent lists from older versions get any default agents they are missing, and lose retired ones. */
export function withDefaultAgents(stored: Agent[]): Agent[] {
  const kept = stored
    .filter((a) => a.custom || !RETIRED.has(a.id))
    // drop fields from older versions (e.g. the shift)
    .map(({ id, name, role, instructions, zone, hobbies, shift, custom }) => {
      const builtIn = DEFAULT_AGENTS.find((d) => d.id === id);
      return {
        id,
        name,
        role,
        instructions,
        ...(custom ? { custom } : {}),
        // the zone and hobbies picked in the agent panel (or when hiring), else the built-in ones
        zone: zone && ZONE_IDS.includes(zone) ? zone : builtIn?.zone,
        hobbies: Array.isArray(hobbies) ? hobbies.filter((h) => SPOT_CATS.includes(h)) : builtIn?.hobbies,
        shift: shift === "night" || shift === "day" ? shift : (builtIn?.shift ?? "day"),
      };
    });
  const have = new Set(kept.map((a) => a.id));
  const missing = DEFAULT_AGENTS.filter((a) => !have.has(a.id));
  return [...kept.filter((a) => !a.custom), ...missing, ...kept.filter((a) => a.custom)];
}
