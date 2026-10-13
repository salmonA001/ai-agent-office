import { z } from "zod";

/** The manager's plan, as the in-browser model returns it (JSON). */
export const planOutput = z.object({
  subtasks: z
    .array(
      z.object({
        agentId: z.string(),
        title: z.string(),
        brief: z.string(),
        reason: z.string(),
      }),
    )
    .min(1)
    .max(6),
});

export type PlannedSubtask = z.infer<typeof planOutput>["subtasks"][number];

/** One multiple-choice question in a practice quiz, as the model writes it. */
export const quizItem = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  answer: z.number().int(),
  explanation: z.string().default(""),
});
