import { generateText, Output } from "ai";
import { planOutput, planRequest } from "@/lib/schemas";
import { checkAccess, MANAGER_MODEL, parseBody, providerStatus } from "@/lib/server";

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
        "Use as few subtasks as the task needs; a simple task gets one subtask. Only use agent ids from the roster. " +
        "For each subtask give a short, plain-language reason why that agent fits, so the user can follow your decision.\n\n" +
        `Roster:\n${roster}`,
      prompt: task,
      output: Output.object({ schema: planOutput }),
      maxRetries: 1,
    });

    const ids = new Set(agents.map((a) => a.id));
    const subtasks = output.subtasks.map((s) => ({
      ...s,
      agentId: ids.has(s.agentId) ? s.agentId : agents[0].id,
    }));
    return Response.json({ subtasks });
  } catch (error) {
    console.error("plan failed", error);
    // The client switches to the in-browser AI when the cloud provider is out of quota or not set up.
    const unavailable = [400, 401, 403, 429].includes(providerStatus(error));
    return Response.json(
      {
        error: unavailable ? "The cloud AI is unavailable right now (quota or setup)." : "The manager could not plan this task.",
        code: unavailable ? "cloud_unavailable" : "plan_failed",
      },
      { status: 502 },
    );
  }
}
