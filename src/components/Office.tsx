"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Agent, DEFAULT_AGENTS, withDefaultAgents } from "@/lib/agents";
import { type EngineState, getEngineState, subscribeEngine, webGpuSupported } from "@/lib/browser-ai";
import { type Engine, runTask, type Task, type TaskStatus } from "@/lib/run-task";
import { levelOf, rewardOnce, setNames, useGame } from "./office-events";
import { AgentPanel, AgentStatusText, HowItWorks, Stepper, stepIndex, Ticker, Timeline } from "./OfficeExplain";
import { DrillOverlay, EventBanner, EventsPanel, LevelToast, TeamStats, XpBadge } from "./OfficeGame";
import type { BoardLine, DeskState, ManagerState, ScreenState } from "./OfficeScene";

const OfficeScene = dynamic(() => import("./OfficeScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Building the office…</div>,
});

const IDLE_ENGINE: EngineState = { status: "idle" };

const STORE = { agents: "office.agents", tasks: "office.tasks", code: "office.code" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the office still works without it.
  }
}

const ACTIVE: TaskStatus[] = ["planning", "working", "synthesizing"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  planning: "Planning",
  working: "Working",
  synthesizing: "Merging",
  done: "Done",
  error: "Failed",
  cancelled: "Cancelled",
};

function StatusPill({ status }: { status: TaskStatus | "queued" }) {
  const active = status !== "done" && status !== "error" && status !== "cancelled" && status !== "queued";
  const tone =
    status === "done"
      ? "bg-primary text-black"
      : status === "error"
        ? "bg-danger text-ink"
        : active
          ? "bg-accent text-black"
          : "bg-well text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {active && <span className="size-1.5 animate-pulse rounded-full bg-black" aria-hidden />}
      {status === "queued" ? "Queued" : STATUS_LABEL[status]}
    </span>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Office() {
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showHire, setShowHire] = useState(false);
  // agent whose details are open (click an agent in 3D or its card)
  const [focusId, setFocusId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const selectAgent = useCallback((id: string) => {
    setGuideOpen(false);
    setFocusId((cur) => (cur === id ? null : id));
  }, []);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const engineState = useSyncExternalStore(subscribeEngine, getEngineState, () => IDLE_ENGINE);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    // Restore after hydration; tasks that were running when the page closed can't resume.
    const storedTasks = load<Task[]>(STORE.tasks, []).map((t) =>
      ACTIVE.includes(t.status) ? { ...t, status: "cancelled" as const } : t,
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    setAgents(withDefaultAgents(load(STORE.agents, DEFAULT_AGENTS)));
    setTasks(storedTasks);
    setSelectedId(storedTasks[0]?.id ?? null);
    setCode(load(STORE.code, ""));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    // Use the server's AI when a key is configured; otherwise run a model in the browser.
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { cloud: boolean }) => {
        setCloudReady(d.cloud);
        setEngine(d.cloud ? "cloud" : "browser");
      })
      .catch(() => setEngine("browser"));
  }, []);

  useEffect(() => {
    if (loaded) save(STORE.agents, agents);
  }, [agents, loaded]);

  useEffect(() => {
    if (loaded) save(STORE.tasks, tasks.slice(0, 30));
  }, [tasks, loaded]);

  const updateTask = useCallback((id: string, fn: (t: Task) => Task) => {
    setTasks((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const start = useCallback(
    (text: string, accessCode: string) => {
      const task: Task = {
        id: crypto.randomUUID(),
        prompt: text,
        createdAt: Date.now(),
        status: "planning",
        subtasks: [],
        final: "",
        engine: engine ?? "browser",
        events: [{ at: Date.now(), kind: "received", text: "You assigned the task. Max picks it up." }],
      };
      const controller = new AbortController();
      controllers.current.set(task.id, controller);
      setTasks((all) => [task, ...all]);
      setSelectedId(task.id);

      runTask(task, agents, task.engine!, accessCode, controller.signal, (fn) => updateTask(task.id, fn), (reason) => {
        setEngine("browser");
        if (reason === "access") setNeedCode(true);
      })
        .catch((err: Error) => {
          if (controller.signal.aborted) {
            updateTask(task.id, (t) => ({ ...t, status: "cancelled" }));
          } else {
            updateTask(task.id, (t) => ({ ...t, status: "error", error: err.message }));
          }
        })
        .finally(() => controllers.current.delete(task.id));
    },
    [agents, engine, updateTask],
  );

  const submit = () => {
    const text = prompt.trim();
    if (text.length < 3) return;
    start(text, code);
    setPrompt("");
  };

  const cancel = (id: string) => controllers.current.get(id)?.abort();

  const remove = (id: string) => {
    cancel(id);
    setTasks((all) => all.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const focusAgent = agents.find((a) => a.id === focusId) ?? null;

  // game layer: XP for finished work, levels shown on the 3D name tags
  const game = useGame();
  useEffect(() => {
    setNames(agents.map((a) => [a.id, a.name]));
  }, [agents]);
  useEffect(() => {
    for (const t of tasks) {
      for (const s of t.subtasks) {
        if (s.status !== "done") continue;
        const words = s.output.trim().split(/\s+/).length;
        rewardOnce(`sub:${s.id}`, s.agentId, 30 + Math.min(30, Math.round(words / 25)), `finished "${s.title}"`);
      }
      if (t.status === "done") rewardOnce(`task:${t.id}`, "max", 25, "delivered a finished task");
    }
  }, [tasks]);
  const levels = Object.fromEntries(agents.map((a) => [a.id, levelOf(game.xp[a.id] ?? 0)]));
  const running = tasks.filter((t) => ACTIVE.includes(t.status));

  // What each agent is doing right now, across every running task, and what its PC screen shows.
  const busy = new Map<string, string[]>();
  const desks: Record<string, DeskState> = {};
  const planningNow = running.some((t) => t.status === "planning");
  const SCREEN_RANK: Record<ScreenState["mode"], number> = { idle: 0, planning: 0, done: 1, error: 1, queued: 2, working: 3 };
  for (const t of [...tasks].reverse()) {
    const active = ACTIVE.includes(t.status);
    for (const s of t.subtasks) {
      const desk = (desks[s.agentId] ??= { working: [], screen: { mode: "idle" } });
      if (active && s.status === "working") {
        desk.working.push(s.title);
        busy.set(s.agentId, desk.working);
      }
      if (s.finishedAt && s.finishedAt > (desk.lastDoneAt ?? 0)) desk.lastDoneAt = s.finishedAt;
      const mode: ScreenState["mode"] | null =
        active && (s.status === "working" || s.status === "queued") ? s.status : s.status === "done" || s.status === "error" ? s.status : null;
      // Newer tasks win ties; busier states win over finished ones.
      if (mode && SCREEN_RANK[mode] >= SCREEN_RANK[desk.screen.mode]) {
        desk.screen =
          mode === "working"
            ? { mode, title: s.title, text: s.output.slice(-800), len: s.output.length }
            : { mode, title: s.title };
      }
    }
  }
  if (planningNow) {
    for (const a of agents) {
      const desk = (desks[a.id] ??= { working: [], screen: { mode: "idle" } });
      if (SCREEN_RANK[desk.screen.mode] < 2) desk.screen = { mode: "planning" };
    }
  }
  const manager: ManagerState = planningNow
    ? "planning"
    : running.some((t) => t.status === "synthesizing")
      ? "merging"
      : running.length
        ? "watching"
        : "idle";
  // The chalkboard shows live subtasks, or the selected task's when nothing is running.
  const board: BoardLine[] = (running.length ? running : selected ? [selected] : [])
    .flatMap((t) => t.subtasks)
    .map((s) => ({ text: s.title, status: s.status }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="glow grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-sm font-black text-black"
          >
            AI
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              AI Agent <span className="text-accent">Office</span>
            </h1>
            <p className="text-sm text-muted">
              Describe any job. The manager splits it up, the team works in parallel, and you get one result.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-primary/10 px-3 py-1 text-accent">
            <span
              aria-hidden
              className={`size-2 rounded-full ${engine ? "bg-accent" : "bg-muted"} ${engine === "cloud" ? "" : "animate-pulse"}`}
            />
            {engine === "cloud" ? "Cloud AI" : engine === "browser" ? "In-browser AI (free)" : "Detecting AI…"}
          </span>
          <TeamStats ids={agents.map((a) => a.id)} />
          <span className="rounded-full border border-white/10 bg-well px-3 py-1 text-muted" aria-live="polite">
            {running.length === 0 ? "Office is idle" : `${running.length} task${running.length > 1 ? "s" : ""} running`}
          </span>
        </div>
      </header>

      <EngineBanner engine={engine} state={engineState} />

      {needCode && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-white/20 glass p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(STORE.code, code);
            setNeedCode(false);
            if (cloudReady) setEngine("cloud");
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Running on the free in-browser AI. Have the office access code? Enter it to use the faster cloud AI:
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-10 rounded-lg border border-muted/40 bg-well px-3 text-ink"
              autoComplete="off"
            />
          </label>
          <button className="min-h-10 rounded-lg bg-primary transition hover:brightness-110 px-4 font-semibold text-black">Use cloud AI</button>
          <button
            type="button"
            onClick={() => setNeedCode(false)}
            className="min-h-10 rounded-lg border border-muted/40 px-4 text-sm text-ink"
          >
            Stay free
          </button>
        </form>
      )}

      {/* Office floor */}
      <section aria-labelledby="floor-heading" className="rounded-2xl glass p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="floor-heading" className="font-semibold">
            Office floor
          </h2>
          <button
            type="button"
            onClick={() => setShowHire((v) => !v)}
            aria-expanded={showHire}
            className="min-h-9 rounded-lg bg-accent transition hover:brightness-110 px-3 text-sm font-semibold text-black"
          >
            {showHire ? "Close" : "+ Hire agent"}
          </button>
        </div>

        {showHire && (
          <HireForm
            onHire={(a) => {
              setAgents((all) => [...all, a]);
              setShowHire(false);
            }}
          />
        )}

        <div className="relative mb-4">
        <div className="relative h-[340px] overflow-hidden rounded-xl ring-1 ring-accent/20 sm:h-[640px]">
          <OfficeScene
            agents={agents}
            desks={desks}
            manager={manager}
            board={board}
            selectedId={focusId}
            onSelectAgent={selectAgent}
            levels={levels}
          />
          <DrillOverlay />
          {/* explanations layered over the 3D office */}
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            <div className="pointer-events-auto">
              <Stepper active={stepIndex(manager, Boolean(selected && selected.status === "done"))} />
            </div>
            <div className="pointer-events-auto">
              <HowItWorks
                open={guideOpen}
                onToggle={() => {
                  setGuideOpen((v) => !v);
                  setFocusId(null);
                }}
              />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 hidden md:block">
            <Ticker events={(running[0] ?? selected)?.events ?? []} />
          </div>
          {/* game events: banner under the stepper, level-ups near the bottom */}
          <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-2 sm:top-20">
            <EventBanner />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <LevelToast />
          </div>
        </div>
          {focusAgent && (
            <div className="mt-3 flex justify-center sm:absolute sm:bottom-2 sm:right-2 sm:mt-0 sm:max-h-[calc(100%-6rem)] sm:justify-end">
              <AgentPanel agent={focusAgent} tasks={tasks} onClose={() => setFocusId(null)} />
            </div>
          )}
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Agents">
          {agents.map((a) => {
            const doing = busy.get(a.id);
            return (
              <li
                key={a.id}
                className={`relative flex flex-col gap-2 rounded-xl border p-3 ${
                  doing ? "glow border-accent bg-primary/10" : "border-white/10 bg-well"
                } ${focusId === a.id ? "ring-2 ring-accent" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => selectAgent(a.id)}
                  aria-pressed={focusId === a.id}
                  className="flex flex-col gap-2 text-left"
                >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      doing ? "bg-accent text-black" : "bg-primary text-black"
                    }`}
                  >
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="truncate text-xs text-muted">{a.role}</p>
                  </div>
                </div>
                <XpBadge id={a.id} />
                <p className="line-clamp-2 text-xs text-muted">
                  {doing ? `Working on: ${doing.join(", ")}` : <AgentStatusText id={a.id} fallback="Available" />}
                </p>
                </button>
                {a.custom && (
                  <button
                    type="button"
                    onClick={() => setAgents((all) => all.filter((x) => x.id !== a.id))}
                    className="self-start text-xs text-error underline"
                    aria-label={`Let ${a.name} go`}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid flex-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Composer + task list */}
        <aside className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-2 rounded-2xl glass p-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="task" className="font-semibold">
              New task
            </label>
            <textarea
              id="task"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={5}
              maxLength={4000}
              placeholder="e.g. Plan a product launch for a budgeting app: research competitors, write the announcement email and draft a 4-week timeline."
              className="resize-y rounded-lg border border-muted/40 bg-well p-3 text-sm text-ink placeholder:text-muted/80"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Ctrl+Enter to send. Run as many tasks as you like.</span>
              <button
                type="submit"
                disabled={prompt.trim().length < 3}
                className="min-h-10 rounded-lg bg-primary transition hover:brightness-110 px-4 font-semibold text-black disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </form>

          <section aria-labelledby="tasks-heading" className="rounded-2xl glass p-4">
            <h2 id="tasks-heading" className="mb-2 font-semibold">
              Tasks
            </h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={t.id === selectedId}
                      className={`flex w-full flex-col gap-1 rounded-lg border p-2.5 text-left ${
                        t.id === selectedId ? "border-accent bg-primary/10" : "border-white/10 bg-well hover:border-accent/50"
                      }`}
                    >
                      <span className="line-clamp-2 text-sm">{t.prompt}</span>
                      <span className="flex items-center justify-between gap-2">
                        <StatusPill status={t.status} />
                        <span className="text-xs text-muted">
                          {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <EventsPanel />
        </aside>

        {/* Task detail */}
        <main className="min-w-0">
          {selected ? (
            <TaskView
              task={selected}
              agents={agents}
              onCancel={() => cancel(selected.id)}
              onRetry={() => start(selected.prompt, code)}
              onDelete={() => remove(selected.id)}
            />
          ) : (
            <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-white/20 p-8 text-center text-muted">
              <p>Assign a task and watch the team pick it up here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TaskView({
  task,
  agents,
  onCancel,
  onRetry,
  onDelete,
}: {
  task: Task;
  agents: Agent[];
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const active = ACTIVE.includes(task.status);

  return (
    <article className="flex flex-col gap-4" aria-labelledby="task-title">
      <div className="rounded-2xl glass p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="task-title" className="min-w-0 flex-1 whitespace-pre-wrap break-words font-semibold">
            {task.prompt}
          </h2>
          <div className="flex items-center gap-2">
            <StatusPill status={task.status} />
            {active ? (
              <button type="button" onClick={onCancel} className="min-h-9 rounded-lg bg-danger transition hover:brightness-110 px-3 text-sm font-semibold text-ink">
                Cancel
              </button>
            ) : (
              <>
                <button type="button" onClick={onRetry} className="min-h-9 rounded-lg bg-primary transition hover:brightness-110 px-3 text-sm font-semibold text-black">
                  Run again
                </button>
                <button type="button" onClick={onDelete} className="min-h-9 rounded-lg bg-danger transition hover:brightness-110 px-3 text-sm font-semibold text-ink">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        {task.error && (
          <p role="alert" className="mt-2 text-sm text-error">
            {task.error}
          </p>
        )}
        {task.status === "planning" && <p className="mt-2 text-sm text-muted">The manager is splitting up the work…</p>}
      </div>

      {task.subtasks.length > 0 && (
        <section aria-label="Agent work" className="grid gap-4 xl:grid-cols-2">
          {task.subtasks.map((s) => {
            const agent = agents.find((a) => a.id === s.agentId);
            return (
              <div key={s.id} className="flex min-w-0 flex-col gap-2 rounded-2xl glass p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {agent ? `${agent.name} · ${agent.role}` : "Former agent"}
                    </p>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                {s.reason && (
                  <p className="rounded-lg border border-accent/20 bg-primary/5 px-2.5 py-1.5 text-xs text-ink/90">
                    <span className="font-semibold text-accent">Why {agent?.name ?? "this agent"}: </span>
                    {s.reason}
                  </p>
                )}
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer">Brief</summary>
                  <p className="mt-1 whitespace-pre-wrap">{s.brief}</p>
                </details>
                <div className="max-h-96 overflow-y-auto rounded-lg bg-well p-3">
                  {s.output ? (
                    <Markdown>{s.output}</Markdown>
                  ) : (
                    <p className="text-sm text-muted">{s.status === "error" ? "Failed." : "Waiting for output…"}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Timeline events={task.events} start={task.createdAt} />

      {(task.final || task.status === "synthesizing") && (
        <section aria-labelledby="final-heading" className="glass glow rounded-2xl border-accent/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="final-heading" className="font-semibold text-accent">
              Final result
            </h3>
            {task.final && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(task.final);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // Clipboard blocked; nothing else to do.
                  }
                }}
                className="min-h-9 rounded-lg bg-primary transition hover:brightness-110 px-3 text-sm font-semibold text-black"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          {task.final ? <Markdown>{task.final}</Markdown> : <p className="text-sm text-muted">The manager is merging the work…</p>}
        </section>
      )}
    </article>
  );
}

function HireForm({ onHire }: { onHire: (a: Agent) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const valid = name.trim() && role.trim() && instructions.trim();

  return (
    <form
      className="mb-4 grid gap-3 rounded-xl bg-well p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onHire({
          id: `custom-${crypto.randomUUID().slice(0, 8)}`,
          name: name.trim(),
          role: role.trim(),
          instructions: instructions.trim(),
          custom: true,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          className="min-h-10 rounded-lg border border-muted/40 bg-well px-3 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Role
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={60}
          required
          placeholder="e.g. SEO Specialist"
          className="min-h-10 rounded-lg border border-muted/40 bg-well px-3 text-ink placeholder:text-muted/80"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        What this agent does and how
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={2000}
          rows={3}
          required
          className="rounded-lg border border-muted/40 bg-well p-3 text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={!valid}
        className="min-h-10 rounded-lg bg-primary transition hover:brightness-110 px-4 font-semibold text-black disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
      >
        Hire
      </button>
    </form>
  );
}

function EngineBanner({ engine, state }: { engine: Engine | null; state: EngineState }) {
  if (engine !== "browser") return null;
  if (state.status === "loading") {
    return (
      <div className="rounded-xl border border-accent glass p-4" role="status">
        <p className="text-sm font-semibold">Waking up the office AI (one-time download, cached afterwards)…</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-well">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(state.progress * 100)}%` }} />
        </div>
        <p className="mt-1 truncate text-xs text-muted">{state.text}</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-xl border border-danger glass p-4 text-sm text-error">
        {state.message}
      </p>
    );
  }
  if (state.status === "ready") return null;
  return (
    <p className="rounded-xl glass p-3 text-sm text-muted">
      {webGpuSupported()
        ? "Free mode: agents run on a small AI model inside your browser, no key needed. The first task downloads it (~1 GB) once."
        : "Free mode needs WebGPU (recent Chrome or Edge). Add an AI provider key on the server for other browsers."}
    </p>
  );
}
