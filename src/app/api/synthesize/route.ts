import { streamText } from "ai";
import { langRule, synthesizeRequest } from "@/lib/schemas";
import { checkAccess, MANAGER_MODEL, parseBody } from "@/lib/server";

export async function POST(request: Request) {
  const denied = checkAccess(request);
  if (denied) return denied;
  const body = await parseBody(request, synthesizeRequest);
  if ("error" in body) return body.error;
  const { task, results, lang } = body.data;

  const work = results
    .map((r) => `## ${r.title} (by ${r.agentName}, ${r.role})\n\n${r.output}`)
    .join("\n\n---\n\n");

  const result = streamText({
    model: MANAGER_MODEL,
    instructions:
      "You are the office manager. Combine your team's work into one final deliverable that fully answers the user's task. " +
      "Remove duplication, resolve contradictions, keep the useful detail. Use Markdown. Do not mention the internal process unless useful." +
      langRule(lang),
    prompt: `Task:\n${task}\n\nTeam output:\n\n${work}`,
    maxOutputTokens: 4000,
    abortSignal: request.signal,
    maxRetries: 1,
    onError({ error }) {
      console.error("synthesize failed", error);
    },
  });

  return result.toTextStreamResponse();
}
