import type { Agent } from "./agents";
import { chat, currentTier, describeImage, MODELS } from "./browser-ai";
import { type Key, type Lang, type Msg, translate } from "./i18n";
import { countWords } from "./words";
import { planOutput, type PlannedSubtask } from "./schemas";

export type SubtaskStatus = "queued" | "working" | "done" | "error";
export type TaskStatus = "planning" | "working" | "synthesizing" | "done" | "error" | "cancelled";

export type Subtask = PlannedSubtask & {
  id: string;
  status: SubtaskStatus;
  output: string;
  /** the agent's reasoning before the answer, in think mode (last part only) */
  thinking?: string;
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

/** A file attached to a task: a text file's contents, or a picture's description once Max has looked at it. */
export type Attachment = { name: string; kind: "image" | "text"; text?: string };

export type TaskMode = "fast" | "think";

export type Task = {
  id: string;
  prompt: string;
  attachments?: Attachment[];
  mode?: TaskMode;
  createdAt: number;
  status: TaskStatus;
  subtasks: Subtask[];
  final: string;
  error?: string;
  events?: TaskEvent[];
};

type Update = (fn: (task: Task) => Task) => void;
type Result = { agentName: string; role: string; title: string; output: string };

/** At most this many agents work on one task (more would not fit the model's memory). */
const MAX_PARTS = 4;
/** Characters of the team's work the manager can read in one go (the model sees about 4,000 tokens). */
const MERGE_BUDGET = 6500;

const LANG_RULE: Record<Lang, string> = {
  en: " Write in English.",
  th: " Write everything in Thai (ภาษาไทย), natural and fluent.",
};

const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0];

/** Characters of attached files each agent reads (the model sees about 4,000 tokens in all). */
const FILES_BUDGET = 4500;

/** The attached files as one block for the prompt, each trimmed to a fair share of `budget`. */
function filesBlock(files: Attachment[], budget: number) {
  const usable = files.filter((f) => f.text?.trim());
  if (!usable.length) return "";
  const share = Math.floor(budget / usable.length);
  const parts = usable.map((f) => {
    const body = f.text!.trim();
    const cut = body.length > share ? `${body.slice(0, share)}\n[…cut…]` : body;
    return `### ${f.name}${f.kind === "image" ? " (picture, described)" : ""}\n${cut}`;
  });
  return `Attached files:\n${parts.join("\n\n")}`;
}

// ---------- Fallback when the plan can't be parsed: pick agents by keyword ----------

const KEYWORDS: [RegExp, string][] = [
  [/\b(health|fitness|workout|exercise|sleep|stress|diet|habits?)\b/i, "coach"],
  [/\b(budget|pricing|price|forecast|revenue|profit|finance|financial|invoice|cash)\b/i, "finance"],
  [/\b(contract|legal|law|terms|privacy|gdpr|compliance|policy)\b/i, "legal"],
  [/\b(hiring|hire|interview|onboarding|team culture|feedback|hr|employee)\b/i, "people"],
  [/\b(customer|support|reply|complaint|faq|help article|refund)\b/i, "support"],
  [/\b(product|feature|user stor(y|ies)|requirements?|roadmap|prd)\b/i, "product"],
  [/\b(security|secure|vulnerab\w*|threat|password|attack|encrypt\w*)\b/i, "security"],
  [/\b(teach|explain|learn|lesson|tutor|quiz|homework|study)\b/i, "tutor"],
  [/\b(strategy|strategic|priorit(y|ies|ise|ize)|goals?|okrs?|vision)\b/i, "strategist"],
  [/\b(ideas?|brainstorm|invent|creative|concepts?|innovat\w*)\b/i, "innovator"],
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
      brief: `Handle the ${agent.role.toLowerCase()} side of the task: ${task}`,
      reason: word
        ? `The task mentions "${word}", which is ${agent.role.toLowerCase()} work.`
        : `No clear specialty matched, so ${agent.name} takes it as the first available agent.`,
    };
  });
}

// ---------- The three (or four) steps, each a call to the in-browser model ----------

async function plan(task: string, files: string, agents: Agent[], lang: Lang, signal: AbortSignal): Promise<PlannedSubtask[]> {
  const schema = JSON.stringify({
    type: "object",
    properties: {
      subtasks: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PARTS,
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
  const team = agents.map((a) => `- ${a.id}: ${a.name}, ${a.role}. ${firstSentence(a.instructions)}`).join("\n");
  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You are Max, the manager of an AI office. Plan how your team handles the user's task.\n" +
            "Rules:\n" +
            "- A simple or single-skill task gets exactly 1 subtask for the best-suited agent.\n" +
            `- A task with clearly different parts gets 2-${MAX_PARTS} subtasks, each for a different agent, that can be done at the same time without waiting for each other.\n` +
            "- Each brief is specific and self-contained: what to produce, the key points to cover, and the format (bullets, table, email, code, ...).\n" +
            "- title: a few words. reason: one short sentence on why this agent fits.\n" +
            `Reply in JSON only.${LANG_RULE[lang]}\n\nTeam:\n${team}`,
        },
        { role: "user", content: files ? `${task}\n\n${files}` : task },
      ],
      { signal, maxTokens: 700, json: schema },
    );
    // tolerate stray text around the JSON object
    const parsed = planOutput.safeParse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    if (parsed.success) {
      // one subtask per agent
      const seen = new Set<string>();
      const subtasks = parsed.data.subtasks.filter((s) => !seen.has(s.agentId) && seen.add(s.agentId));
      if (subtasks.length) return subtasks.slice(0, MAX_PARTS);
    }
  } catch (err) {
    if (signal.aborted) throw err;
  }
  return fallbackPlan(task, agents);
}

function work(
  task: string,
  files: string,
  agent: Agent,
  sub: PlannedSubtask,
  team: { title: string; name: string }[],
  lang: Lang,
  think: boolean,
  signal: AbortSignal,
  onText: (t: string) => void,
  onThink: (t: string) => void,
) {
  const plan = team.map((p, i) => `${i + 1}. ${p.title} (${p.name}${p.name === agent.name ? ", you" : ""})`).join("\n");
  return chat(
    [
      {
        role: "system",
        content:
          `You are ${agent.name}, the ${agent.role} in an AI office. ${agent.instructions}\n` +
          (team.length > 1 ? `The team's plan for this task:\n${plan}\nDo only your part; teammates cover the rest.\n` : "") +
          "Be specific and practical: concrete facts, numbers, examples, steps or code where useful. " +
          "Structure the answer with Markdown headings and lists. Start directly with the content, no preamble." +
          LANG_RULE[lang],
      },
      { role: "user", content: `Task: ${task}\n\nYour part: ${sub.title}\n${sub.brief}${files ? `\n\n${files}` : ""}` },
    ],
    { signal, maxTokens: MODELS[currentTier()].maxTokens, think, onText, onThink },
  );
}

function merge(task: string, results: Result[], lang: Lang, signal: AbortSignal, onText: (t: string) => void) {
  const share = Math.floor(MERGE_BUDGET / results.length);
  const parts = results.map((r) => `## ${r.title} (by ${r.agentName}, ${r.role})\n${r.output.slice(0, share)}`).join("\n\n");
  return chat(
    [
      {
        role: "system",
        content:
          "You are Max, the manager of an AI office. Merge your team's work into one polished final answer to the user's task. " +
          "Keep every useful detail, remove repetition, resolve contradictions and organise it with clear Markdown headings. " +
          "Start directly with the answer. If it helps, end with a short 'Next steps' list." +
          LANG_RULE[lang],
      },
      { role: "user", content: `Task: ${task}\n\nThe team's work:\n\n${parts}` },
    ],
    { signal, maxTokens: 1400, onText },
  );
}

function review(task: string, draft: string, lang: Lang, signal: AbortSignal, onText: (t: string) => void) {
  return chat(
    [
      {
        role: "system",
        content:
          "You are a meticulous editor. Improve the draft answer to the user's task: fix factual or logical mistakes, " +
          "fill obvious gaps, make it clearer and better organised, and keep everything that is already good. " +
          "Output only the improved final answer in Markdown, with no remarks about your changes." +
          LANG_RULE[lang],
      },
      { role: "user", content: `Task: ${task}\n\nDraft answer:\n${draft.slice(0, MERGE_BUDGET)}` },
    ],
    { signal, maxTokens: 1400, onText },
  );
}

// ---------- Orchestration ----------

/** Manager plans, agents work, manager merges, and (optionally) the answer gets a final review. */
export async function runTask(
  task: Task,
  agents: Agent[],
  signal: AbortSignal,
  update: Update,
  lang: Lang = "en",
  opts: { review: boolean; images?: Record<string, string> } = { review: true },
) {
  const think = task.mode === "think";
  const log = (kind: TaskEvent["kind"], key: Key, params?: Msg["params"], agentId?: string) =>
    update((t) => ({
      ...t,
      events: [...(t.events ?? []), { at: Date.now(), kind, text: translate("en", key, params), msg: { key, params }, agentId }],
    }));
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "An agent";

  // pictures first: the vision model describes each one, and the team works from the description
  const files = [...(task.attachments ?? [])];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const url = opts.images?.[f.name];
    if (f.kind !== "image" || f.text || !url) continue;
    log("info", "ev.lookImage", { name: f.name });
    try {
      const text = await describeImage(url, task.prompt, signal);
      files[i] = { ...f, text };
      update((t) => ({ ...t, attachments: [...files] }));
      log("info", "ev.sawImage", { name: f.name });
    } catch (err) {
      if (signal.aborted) throw err;
      log("error", "ev.imageFail", { name: f.name, msg: (err as Error).message });
    }
  }
  if (files.some((f) => f.text)) log("info", "ev.files", { n: files.filter((f) => f.text).length });
  const filesForPlan = filesBlock(files, 1500);
  const filesForWork = filesBlock(files, FILES_BUDGET);

  log("plan", "ev.planStart");
  const subtasks = await plan(task.prompt, filesForPlan, agents, lang, signal);
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
  const team = subtasks.map((s) => ({ title: s.title, name: nameOf(s.agentId) }));

  const results = await Promise.all(
    subtasks.map(async (sub, i): Promise<Result | null> => {
      const agent = agents.find((a) => a.id === sub.agentId) ?? agents[0];
      let started = false;
      let thinking = false;
      // the model answers one agent at a time, so an agent "starts" when its first words (or thoughts) arrive
      const begin = () => {
        if (started) return;
        started = true;
        log("start", "ev.start", { name: agent.name, title: sub.title }, agent.id);
        setSub(i, (s) => ({ ...s, status: "working", startedAt: Date.now() }));
      };
      try {
        const output = await work(
          task.prompt,
          filesForWork,
          agent,
          sub,
          team,
          lang,
          think,
          signal,
          (chunk) => {
            begin();
            setSub(i, (s) => ({ ...s, output: s.output + chunk }));
          },
          (chunk) => {
            begin();
            if (!thinking) {
              thinking = true;
              log("info", "ev.thinking", { name: agent.name }, agent.id);
            }
            setSub(i, (s) => ({ ...s, thinking: ((s.thinking ?? "") + chunk).slice(-1500) }));
          },
        );
        if (!output.trim()) throw new Error("Agent returned no output");
        setSub(i, (s) => ({ ...s, status: "done", finishedAt: Date.now() }));
        log("done", "ev.done", { name: agent.name, title: sub.title, words: countWords(output) }, agent.id);
        return { agentName: agent.name, role: agent.role, title: sub.title, output };
      } catch (err) {
        if (signal.aborted) throw err;
        setSub(i, (s) => ({ ...s, status: "error", output: s.output || String((err as Error).message) }));
        log("error", "ev.error", { name: agent.name, msg: (err as Error).message }, agent.id);
        return null;
      }
    }),
  );

  const ok = results.filter((r): r is Result => r !== null);
  if (ok.length === 0) throw new Error("Every agent failed on this task.");

  let draft = ok[0].output;
  if (ok.length > 1 || subtasks.length > 1) {
    log("merge", "ev.merge", { n: ok.length });
    update((t) => ({ ...t, status: "synthesizing", final: "" }));
    draft = await merge(task.prompt, ok, lang, signal, (chunk) => update((t) => ({ ...t, final: t.final + chunk })));
    if (!draft.trim()) throw new Error("The manager returned no final report.");
  }
  update((t) => ({ ...t, final: draft }));

  if (opts.review) {
    log("merge", "ev.review");
    update((t) => ({ ...t, status: "synthesizing" }));
    let better = "";
    try {
      better = await review(task.prompt, draft, lang, signal, (chunk) => {
        better += chunk;
        // show the reviewed version once it's taking shape; until then keep the draft on screen
        if (better.length > 200) update((t) => ({ ...t, final: better }));
      });
    } catch (err) {
      if (signal.aborted) throw err;
    }
    // a review that comes back much shorter probably lost content: keep the draft
    update((t) => ({ ...t, final: better.trim().length > draft.trim().length * 0.6 ? better : draft }));
  }

  update((t) => ({ ...t, status: "done" }));
  log("finish", "ev.finish", { s: Math.round((Date.now() - task.createdAt) / 1000) });
}
