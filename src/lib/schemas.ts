import { z } from "zod";

export const MAX_SUBTASKS = 5;

const agentRef = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(60),
});

const agentFull = agentRef.extend({
  instructions: z.string().max(2000),
});

const task = z.string().trim().min(3).max(4000);
const lang = z.enum(["en", "th"]).optional();

/** Appended to every system prompt so plans and answers come back in the user's language. */
export const langRule = (l?: "en" | "th") => (l === "th" ? " Write all of your output in Thai (ภาษาไทย)." : "");

export const planRequest = z.object({
  task,
  lang,
  // one per desk (MAX_DESKS in office-nav)
  agents: z.array(agentRef).min(1).max(24),
});

export const planOutput = z.object({
  subtasks: z
    .array(
      z.object({
        agentId: z.string().describe("id of the agent assigned to this subtask"),
        title: z.string().describe("short title, max 8 words"),
        brief: z.string().describe("precise instructions for the agent"),
        reason: z.string().describe("one short sentence: why this agent is the best fit for this part"),
      }),
    )
    .min(1)
    .max(MAX_SUBTASKS),
});

export type PlannedSubtask = z.infer<typeof planOutput>["subtasks"][number];

export const workRequest = z.object({
  task,
  lang,
  agent: agentFull,
  subtask: z.object({
    title: z.string().max(200),
    brief: z.string().max(4000),
  }),
});

export const synthesizeRequest = z.object({
  task,
  lang,
  results: z
    .array(
      z.object({
        agentName: z.string().max(40),
        role: z.string().max(60),
        title: z.string().max(200),
        output: z.string().max(20000),
      }),
    )
    .min(1)
    .max(MAX_SUBTASKS),
});
