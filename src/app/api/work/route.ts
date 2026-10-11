import { streamText } from "ai";
import { workRequest } from "@/lib/schemas";
import { checkAccess, parseBody, WORKER_MODEL } from "@/lib/server";

export async function POST(request: Request) {
  const denied = checkAccess(request);
  if (denied) return denied;
  const body = await parseBody(request, workRequest);
  if ("error" in body) return body.error;
  const { task, agent, subtask } = body.data;

  const result = streamText({
    model: WORKER_MODEL,
    instructions:
      `You are ${agent.name}, the ${agent.role} in an AI agent office. ${agent.instructions}\n` +
      "You are one of several agents working in parallel on parts of a larger task. " +
      "Do only your assigned part, completely and concretely. Use Markdown. Do not ask follow-up questions; state assumptions instead.",
    prompt: `Overall task:\n${task}\n\nYour assignment: ${subtask.title}\n${subtask.brief}`,
    maxOutputTokens: 2500,
    abortSignal: request.signal,
    maxRetries: 1,
    onError({ error }) {
      console.error("work failed", error);
    },
  });

  return result.toTextStreamResponse();
}
