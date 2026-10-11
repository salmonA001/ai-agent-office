"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Agent, DEFAULT_AGENTS } from "@/lib/agents";
import { AccessError, runTask, type Task, type TaskStatus } from "@/lib/run-task";

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
      ? "bg-primary text-ink"
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
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    // Restore after hydration; tasks that were running when the page closed can't resume.
    const storedTasks = load<Task[]>(STORE.tasks, []).map((t) =>
      ACTIVE.includes(t.status) ? { ...t, status: "cancelled" as const } : t,
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    setAgents(load(STORE.agents, DEFAULT_AGENTS));
    setTasks(storedTasks);
    setSelectedId(storedTasks[0]?.id ?? null);
    setCode(load(STORE.code, ""));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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
      };
      const controller = new AbortController();
      controllers.current.set(task.id, controller);
      setTasks((all) => [task, ...all]);
      setSelectedId(task.id);

      runTask(task, agents, accessCode, controller.signal, (fn) => updateTask(task.id, fn))
        .catch((err: Error) => {
          if (controller.signal.aborted) {
            updateTask(task.id, (t) => ({ ...t, status: "cancelled" }));
          } else if (err instanceof AccessError) {
            setNeedCode(true);
            updateTask(task.id, (t) => ({ ...t, status: "error", error: "Enter the office access code, then retry." }));
          } else {
            updateTask(task.id, (t) => ({ ...t, status: "error", error: err.message }));
          }
        })
        .finally(() => controllers.current.delete(task.id));
    },
    [agents, updateTask],
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
  const running = tasks.filter((t) => ACTIVE.includes(t.status));

  // What each agent is doing right now, across every running task.
  const busy = new Map<string, string[]>();
  for (const t of running) {
    for (const s of t.subtasks) {
      if (s.status === "working") busy.set(s.agentId, [...(busy.get(s.agentId) ?? []), s.title]);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Agent <span className="text-accent">Office</span>
          </h1>
          <p className="text-sm text-muted">
            Describe any job. The manager splits it up, the team works in parallel, and you get one result.
          </p>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {running.length === 0 ? "Office is idle" : `${running.length} task${running.length > 1 ? "s" : ""} in progress`}
        </p>
      </header>

      {needCode && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-accent bg-panel p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(STORE.code, code);
            setNeedCode(false);
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            This office is protected. Enter the access code:
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-10 rounded-lg border border-muted/40 bg-well px-3 text-ink"
              autoComplete="off"
            />
          </label>
          <button className="min-h-10 rounded-lg bg-primary px-4 font-semibold text-ink">Save code</button>
        </form>
      )}

      {/* Office floor */}
      <section aria-labelledby="floor-heading" className="rounded-2xl bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="floor-heading" className="font-semibold">
            Office floor
          </h2>
          <button
            type="button"
            onClick={() => setShowHire((v) => !v)}
            aria-expanded={showHire}
            className="min-h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-black"
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

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {agents.map((a) => {
            const doing = busy.get(a.id);
            return (
              <li
                key={a.id}
                className={`relative flex flex-col gap-2 rounded-xl border p-3 ${
                  doing ? "border-accent bg-surface" : "border-white/10 bg-well"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      doing ? "bg-accent text-black" : "bg-primary text-ink"
                    }`}
                  >
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="truncate text-xs text-muted">{a.role}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-xs text-muted">
                  {doing ? `Working on: ${doing.join(", ")}` : "Available"}
                </p>
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
            className="flex flex-col gap-2 rounded-2xl bg-panel p-4"
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
                className="min-h-10 rounded-lg bg-primary px-4 font-semibold text-ink disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </form>

          <section aria-labelledby="tasks-heading" className="rounded-2xl bg-panel p-4">
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
                        t.id === selectedId ? "border-accent bg-surface" : "border-white/10 bg-well hover:border-white/30"
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
      <div className="rounded-2xl bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="task-title" className="min-w-0 flex-1 whitespace-pre-wrap break-words font-semibold">
            {task.prompt}
          </h2>
          <div className="flex items-center gap-2">
            <StatusPill status={task.status} />
            {active ? (
              <button type="button" onClick={onCancel} className="min-h-9 rounded-lg bg-danger px-3 text-sm font-semibold text-ink">
                Cancel
              </button>
            ) : (
              <>
                <button type="button" onClick={onRetry} className="min-h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-ink">
                  Run again
                </button>
                <button type="button" onClick={onDelete} className="min-h-9 rounded-lg bg-danger px-3 text-sm font-semibold text-ink">
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
              <div key={s.id} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {agent ? `${agent.name} · ${agent.role}` : "Former agent"}
                    </p>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <StatusPill status={s.status} />
                </div>
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

      {(task.final || task.status === "synthesizing") && (
        <section aria-labelledby="final-heading" className="rounded-2xl border-2 border-accent bg-panel p-4">
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
                className="min-h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-ink"
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
          className="min-h-10 rounded-lg border border-muted/40 bg-surface px-3 text-ink"
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
          className="min-h-10 rounded-lg border border-muted/40 bg-surface px-3 text-ink placeholder:text-muted/80"
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
          className="rounded-lg border border-muted/40 bg-surface p-3 text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={!valid}
        className="min-h-10 rounded-lg bg-primary px-4 font-semibold text-ink disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
      >
        Hire
      </button>
    </form>
  );
}
