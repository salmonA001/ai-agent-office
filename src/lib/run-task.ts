import type { Agent } from "./agents";
import { chat } from "./browser-ai";
import { type Key, type Lang, type Msg, translate } from "./i18n";
import { countWords } from "./words";
import { MAX_SUBTASKS, planOutput, type PlannedSubtask } from "./schemas";

export type SubtaskStatus = "queued" | "working" | "done" | "error";
export type TaskStatus = "planning" | "working" | "synthesizing" | "done" | "error" | "cancelled";

export type Subtask = PlannedSubtask & {
  id: string;
  status: SubtaskStatus;
  output: string;
  startedAt?: number;
  finishedAt?: number;
};

/** One line in a task's timeline, so the user can follow what the team did and why. */
export type TaskEvent = {
  at: number;
  kind: "received" | "plan" | "assign" | "start" | "done" | "error" | "merge" | "info" | "finish";
  /** English text (kept for history saved before translations existed) */
  text: string;
  /** translatable form, rendered in the current UI language */
  msg?: Msg;
  agentId?: string;
};

export type Task = {
  id: string;
  prompt: string;
  createdAt: number;
  status: TaskStatus;
  subtasks: Subtask[];
  final: string;
  error?: string;
  engine?: Engine;
  events?: TaskEvent[];
};

export type Engine = "cloud" | "browser";

export class AccessError extends Error {}
/** Cloud AI can't serve requests (quota, missing key); the task continues on the in-browser AI. */
export class CloudUnavailableError extends Error {}

type Update = (fn: (task: Task) => Task) => void;
type Result = { agentName: string; role: string; title: string; output: string };

interface Backend {
  plan(task: string, agents: Agent[], signal: AbortSignal): Promise<PlannedSubtask[]>;
  work(task: string, agent: Agent, sub: PlannedSubtask, signal: AbortSignal, onText: (t: string) => void): Promise<string>;
  synthesize(task: string, results: Result[], signal: AbortSignal, onText: (t: string) => void): Promise<string>;
}

// ---------- Cloud: server routes (AI provider key or AI Gateway) ----------

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
    if (data?.code === "cloud_unavailable") throw new CloudUnavailableError(data.error);
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

function cloudBackend(code: string, lang: Lang): Backend {
  return {
    async plan(task, agents, signal) {
      const res = await post(
        "/api/plan",
        { task, lang, agents: agents.map(({ id, name, role }) => ({ id, name, role })) },
        code,
        signal,
      );
      return ((await res.json()) as { subtasks: PlannedSubtask[] }).subtasks;
    },
    async work(task, agent, sub, signal, onText) {
      const res = await post("/api/work", { task, lang, agent, subtask: { title: sub.title, brief: sub.brief } }, code, signal);
      const text = await readStream(res, onText);
      // A failed cloud stream ends empty (the server hides provider errors mid-stream).
      if (!text.trim()) throw new CloudUnavailableError("Cloud agent returned nothing");
      return text;
    },
    async synthesize(task, results, signal, onText) {
      const res = await post("/api/synthesize", { task, lang, results }, code, signal);
      const text = await readStream(res, onText);
      if (!text.trim()) throw new CloudUnavailableError("Cloud manager returned nothing");
      return text;
    },
  };
}

// ---------- Browser: small local model via WebGPU, no key needed ----------

const KEYWORDS: [RegExp, string][] = [
  [/\b(design|ui|ux|logo|layout|colou?rs?|mockup|wireframe)\b/i, "designer"],
  [/\b(marketing|campaign|social|ads?|seo|tagline|launch|brand)\b/i, "marketer"],
  [/\b(data|sql|statistics?|metrics?|chart|dataset|spreadsheet)\b/i, "data"],
  [/\b(test|tests|testing|qa|edge cases?|bugs)\b/i, "qa"],
  [/\b(translate|translation|thai|spanish|french|japanese|chinese|language)\b/i, "translator"],
  [/\b(code|bug|api|script|function|program|sql|python|javascript|app)\b/i, "coder"],
  [/\b(plan|schedule|timeline|roadmap|steps|itinerary)\b/i, "planner"],
  [/\b(research|find|compare|competitor|market|facts?)\b/i, "researcher"],
  [/\b(analy[sz]e|numbers|budget|pros|cons|decide|cost)\b/i, "analyst"],
  [/\b(write|email|post|blog|story|poem|haiku|letter|copy)\b/i, "writer"],
];

/** Used when the small model's plan is unusable: pick agents by keyword. */
function fallbackPlan(task: string, agents: Agent[]): PlannedSubtask[] {
  const picked = KEYWORDS.flatMap(([re, id]) => {
    const word = task.match(re)?.[0];
    return word && agents.some((a) => a.id === id) ? [{ id, word }] : [];
  }).slice(0, 3);
  const chosen = picked.length ? picked : [{ id: agents[0].id, word: "" }];
  return chosen.map(({ id, word }) => {
    const agent = agents.find((a) => a.id === id)!;
    return {
      agentId: id,
      title: `${agent.role} part`,
      brief: `Handle the ${agent.role.toLowerCase()} side of the task.`,
      reason: word
        ? `The task mentions "${word}", which is ${agent.role.toLowerCase()} work.`
        : `No clear specialty matched, so ${agent.name} takes it as the first available agent.`,
    };
  });
}

const LANG_RULE: Record<Lang, string> = { en: "", th: " Write everything in Thai (ภาษาไทย)." };

const makeBrowserBackend = (lang: Lang): Backend => ({
  async plan(task, agents, signal) {
    const schema = JSON.stringify({
      type: "object",
      properties: {
        subtasks: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              agentId: { type: "string", enum: agents.map((a) => a.id) },
              title: { type: "string" },
              brief: { type: "string" },
              reason: { type: "string" },
            },
            required: ["agentId", "title", "brief", "reason"],
          },
        },
      },
      required: ["subtasks"],
    });
    const roster = agents.map((a) => `${a.id}: ${a.name}, ${a.role}`).join("\n");
    try {
      const raw = await chat(
        [
          {
            role: "system",
            content:
              "You are an office manager. Split the user's task into 1-3 subtasks for different agents. " +
              "Simple tasks get 1 subtask. For each, give a short reason why that agent fits. " +
              `Reply in JSON.${LANG_RULE[lang]}\nAgents:\n${roster}`,
          },
          { role: "user", content: task },
        ],
        { signal, maxTokens: 400, json: schema },
      );
      const parsed = planOutput.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data.subtasks.slice(0, MAX_SUBTASKS);
    } catch (err) {
      if (signal.aborted) throw err;
    }
    return fallbackPlan(task, agents);
  },
  work(task, agent, sub, signal, onText) {
    return chat(
      [
        {
          role: "system",
          content: `You are ${agent.name}, the ${agent.role}. ${agent.instructions} Do only your assigned part. Use Markdown. Be concise.${LANG_RULE[lang]}`,
        },
        { role: "user", content: `Overall task: ${task}\n\nYour part: ${sub.title}\n${sub.brief}` },
      ],
      { signal, maxTokens: 600, onText },
    );
  },
  synthesize(task, results, signal, onText) {
    // The local model has a small context window, so each part is trimmed.
    const work = results.map((r) => `## ${r.title} (${r.agentName})\n${r.output.slice(0, 1500)}`).join("\n\n");
    return chat(
      [
        { role: "system", content: `Combine the team's work into one clear final answer. Use Markdown.${LANG_RULE[lang]}` },
        { role: "user", content: `Task: ${task}\n\n${work}` },
      ],
      { signal, maxTokens: 700, onText },
    );
  },
});

// ---------- Orchestration ----------

/** Manager plans, agents work in parallel, manager merges the results. */
export async function runTask(
  task: Task,
  agents: Agent[],
  engine: Engine,
  code: string,
  signal: AbortSignal,
  update: Update,
  onCloudUnavailable?: (reason: "access" | "unavailable") => void,
  lang: Lang = "en",
) {
  const browserBackend = makeBrowserBackend(lang);
  let backend = engine === "cloud" ? cloudBackend(code, lang) : browserBackend;
  const log = (kind: TaskEvent["kind"], key: Key, params?: Msg["params"], agentId?: string) =>
    update((t) => ({
      ...t,
      events: [...(t.events ?? []), { at: Date.now(), kind, text: translate("en", key, params), msg: { key, params }, agentId }],
    }));
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "An agent";
  // Switch this task (and, via the callback, later tasks) to the in-browser AI.
  const fallBack = (reason: "access" | "unavailable") => {
    if (backend === browserBackend) return;
    backend = browserBackend;
    engine = "browser";
    update((t) => ({ ...t, engine: "browser" }));
    log("info", reason === "access" ? "ev.fallbackAccess" : "ev.fallbackQuota");
    onCloudUnavailable?.(reason);
  };
  const withFallback = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      // Parallel agents can all fail at once; every one of them retries locally.
      // No access code also falls back: visitors without one still get the free local AI.
      if (!(err instanceof CloudUnavailableError || err instanceof AccessError)) throw err;
      fallBack(err instanceof AccessError ? "access" : "unavailable");
      return fn();
    }
  };

  log("plan", "ev.planStart");
  const subtasks = await withFallback(() => backend.plan(task.prompt, agents, signal));
  if (subtasks.length === 1) log("plan", "ev.planOne");
  else log("plan", "ev.planMany", { n: subtasks.length });
  for (const s of subtasks)
    log("assign", "ev.assign", { name: nameOf(s.agentId), title: s.title, reason: s.reason ?? "" }, s.agentId);
  update((t) => ({
    ...t,
    status: "working",
    subtasks: subtasks.map((s, i) => ({ ...s, id: `${t.id}-${i}`, status: "queued", output: "" })),
  }));

  const setSub = (i: number, fn: (s: Subtask) => Subtask) =>
    update((t) => ({ ...t, subtasks: t.subtasks.map((s, j) => (j === i ? fn(s) : s)) }));

  const results = await Promise.all(
    subtasks.map(async (sub, i): Promise<Result | null> => {
      const agent = agents.find((a) => a.id === sub.agentId) ?? agents[0];
      const begin = () => {
        log("start", "ev.start", { name: agent.name, title: sub.title }, agent.id);
        setSub(i, (s) => ({ ...s, status: "working", startedAt: Date.now() }));
      };
      if (engine === "cloud") begin();
      try {
        const output = await withFallback(() => {
          let started = engine === "cloud";
          setSub(i, (s) => ({ ...s, output: "" }));
          return backend.work(task.prompt, agent, sub, signal, (chunk) => {
            // Local runs queue up, so an agent only "starts working" when its first words arrive.
            if (!started) {
              started = true;
              begin();
            }
            setSub(i, (s) => ({ ...s, output: s.output + chunk }));
          });
        });
        if (!output.trim()) throw new Error("Agent returned no output");
        setSub(i, (s) => ({ ...s, status: "done", finishedAt: Date.now() }));
        const words = countWords(output);
        log("done", "ev.done", { name: agent.name, title: sub.title, words }, agent.id);
        return { agentName: agent.name, role: agent.role, title: sub.title, output: output.slice(0, 20000) };
      } catch (err) {
        if (signal.aborted || err instanceof AccessError) throw err;
        setSub(i, (s) => ({ ...s, status: "error", output: s.output || String((err as Error).message) }));
        log("error", "ev.error", { name: agent.name, msg: (err as Error).message }, agent.id);
        return null;
      }
    }),
  );

  const ok = results.filter((r): r is Result => r !== null);
  if (ok.length === 0) throw new Error("Every agent failed on this task.");

  const finish = () => log("finish", "ev.finish", { s: Math.round((Date.now() - task.createdAt) / 1000) });
  if (ok.length === 1 && subtasks.length === 1) {
    update((t) => ({ ...t, status: "done", final: ok[0].output }));
    finish();
    return;
  }

  log("merge", "ev.merge", { n: ok.length });
  update((t) => ({ ...t, status: "synthesizing" }));
  const final = await withFallback(() => {
    update((t) => ({ ...t, final: "" }));
    return backend.synthesize(task.prompt, ok, signal, (chunk) => update((t) => ({ ...t, final: t.final + chunk })));
  });
  if (!final.trim()) throw new Error("The manager returned no final report.");
  update((t) => ({ ...t, status: "done" }));
  finish();
}
