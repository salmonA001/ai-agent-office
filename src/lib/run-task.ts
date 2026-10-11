import type { Agent } from "./agents";
import type { PlannedSubtask } from "./schemas";

export type SubtaskStatus = "queued" | "working" | "done" | "error";
export type TaskStatus = "planning" | "working" | "synthesizing" | "done" | "error" | "cancelled";

export type Subtask = PlannedSubtask & {
  id: string;
  status: SubtaskStatus;
  output: string;
};

export type Task = {
  id: string;
  prompt: string;
  createdAt: number;
  status: TaskStatus;
  subtasks: Subtask[];
  final: string;
  error?: string;
};

export class AccessError extends Error {}

type Update = (fn: (task: Task) => Task) => void;

async function post(path: string, body: unknown, code: string, signal: AbortSignal) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-office-code": code },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) throw new AccessError("Access code required");
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return res;
}

async function readStream(res: Response, onText: (chunk: string) => void) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let total = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value;
    onText(value);
  }
  return total;
}

/** Manager plans, agents work in parallel, manager merges the results. */
export async function runTask(
  task: Task,
  agents: Agent[],
  code: string,
  signal: AbortSignal,
  update: Update,
) {
  const planRes = await post(
    "/api/plan",
    { task: task.prompt, agents: agents.map(({ id, name, role }) => ({ id, name, role })) },
    code,
    signal,
  );
  const { subtasks } = (await planRes.json()) as { subtasks: PlannedSubtask[] };
  update((t) => ({
    ...t,
    status: "working",
    subtasks: subtasks.map((s, i) => ({ ...s, id: `${t.id}-${i}`, status: "queued", output: "" })),
  }));

  const setSub = (i: number, fn: (s: Subtask) => Subtask) =>
    update((t) => ({ ...t, subtasks: t.subtasks.map((s, j) => (j === i ? fn(s) : s)) }));

  const results = await Promise.all(
    subtasks.map(async (sub, i) => {
      const agent = agents.find((a) => a.id === sub.agentId) ?? agents[0];
      setSub(i, (s) => ({ ...s, status: "working" }));
      try {
        const res = await post(
          "/api/work",
          { task: task.prompt, agent, subtask: { title: sub.title, brief: sub.brief } },
          code,
          signal,
        );
        const output = await readStream(res, (chunk) =>
          setSub(i, (s) => ({ ...s, output: s.output + chunk })),
        );
        if (!output.trim()) throw new Error("Agent returned no output");
        setSub(i, (s) => ({ ...s, status: "done" }));
        return { agentName: agent.name, role: agent.role, title: sub.title, output: output.slice(0, 20000) };
      } catch (err) {
        if (signal.aborted || err instanceof AccessError) throw err;
        setSub(i, (s) => ({ ...s, status: "error", output: s.output || String((err as Error).message) }));
        return null;
      }
    }),
  );

  const ok = results.filter((r) => r !== null);
  if (ok.length === 0) throw new Error("Every agent failed on this task.");

  if (ok.length === 1 && subtasks.length === 1) {
    update((t) => ({ ...t, status: "done", final: ok[0].output }));
    return;
  }

  update((t) => ({ ...t, status: "synthesizing" }));
  const synthRes = await post("/api/synthesize", { task: task.prompt, results: ok }, code, signal);
  const final = await readStream(synthRes, (chunk) => update((t) => ({ ...t, final: t.final + chunk })));
  if (!final.trim()) throw new Error("The manager returned no final report.");
  update((t) => ({ ...t, status: "done" }));
}
