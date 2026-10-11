import { generateText, Output } from "ai";
import { planOutput, planRequest } from "@/lib/schemas";
import { checkAccess, MANAGER_MODEL, parseBody } from "@/lib/server";

export async function POST(request: Request) {
  const denied = checkAccess(request);
  if (denied) return denied;
  const body = await parseBody(request, planRequest);
  if ("error" in body) return body.error;
  const { task, agents } = body.data;

  const roster = agents.map((a) => `- id "${a.id}": ${a.name}, ${a.role}`).join("\n");

  try {
    const { output } = await generateText({
      model: MANAGER_MODEL,
      instructions:
        "You are the office manager of a team of AI agents. Split the user's task into 1-5 independent subtasks " +
        "that can be worked on in parallel, and assign each to the best-suited agent from the roster. " +
        "Use as few subtasks as the task needs; a simple task gets one subtask. Only use agent ids from the roster.\n\n" +
        `Roster:\n${roster}`,
      prompt: task,
      output: Output.object({ schema: planOutput }),
    });

    const ids = new Set(agents.map((a) => a.id));
    const subtasks = output.subtasks.map((s) => ({
      ...s,
      agentId: ids.has(s.agentId) ? s.agentId : agents[0].id,
    }));
    return Response.json({ subtasks });
  } catch (error) {
    console.error("plan failed", error);
    const gatewayBlocked = [400, 401, 403].includes((error as { statusCode?: number }).statusCode ?? 0);
    return Response.json(
      {
        error: gatewayBlocked
          ? "The AI provider rejected the request. Add a GOOGLE_GENERATIVE_AI_API_KEY (free at aistudio.google.com) in Vercel → Settings → Environment Variables, or enable AI Gateway billing."
          : "The manager could not plan this task.",
      },
      { status: 502 },
    );
  }
}
