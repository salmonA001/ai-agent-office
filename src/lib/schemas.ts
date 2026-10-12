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
