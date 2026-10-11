"use client";

import type { Agent } from "@/lib/agents";
import type { Task, TaskEvent } from "@/lib/run-task";
import { useAgentActivity } from "./agent-activity";
import type { ManagerState } from "./OfficeScene";

const STEPS = [
  { label: "Assign", text: "Describe any job in the box below. The whole team is waiting for it." },
  { label: "Plan", text: "Max reads the job, splits it into parts and picks the best agent for each part, with a reason." },
  { label: "Work", text: "The agents work at the same time. Each PC screen shows that agent's AI writing live." },
  { label: "Merge", text: "Max combines everyone's work into one answer and removes repeats." },
  { label: "Done", text: "The final result is below, with a timeline of who did what and why." },
];

export function stepIndex(manager: ManagerState, finished: boolean) {
  if (manager === "planning") return 1;
  if (manager === "watching") return 2;
  if (manager === "merging") return 3;
  return finished ? 4 : 0;
}

/** Shows which stage the office is in and what that stage means. */
export function Stepper({ active }: { active: number }) {
  return (
    <div className="glass-strong rounded-xl px-3 py-2">
      <p className="text-[11px] font-semibold sm:hidden">
        <span className="text-muted">
          Step {active + 1}/{STEPS.length} ·{" "}
        </span>
        <span className="text-accent">{STEPS[active].label}</span>
      </p>
      <ol className="hidden flex-wrap items-center sm:flex gap-x-1 gap-y-1 text-[11px] font-semibold" aria-label="How a task moves through the office">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1">
            <span
              aria-current={i === active ? "step" : undefined}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                i === active ? "bg-accent text-black" : i < active ? "text-accent" : "text-muted"
              }`}
            >
              <span aria-hidden>{i < active ? "✓" : i + 1}</span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="text-muted/60">
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-1 hidden text-xs text-ink/90 sm:block" aria-live="polite">
        {STEPS[active].text}
      </p>
    </div>
  );
}

const LEGEND: [string, string][] = [
  ["🟩", "A green PC screen means the agent's AI is writing right now. The text on it is the real output."],
  ["⏳", "A spinner means waiting: Max is still planning, or the agent is queued for the in-browser AI."],
  ["📽️", "The projector in the meeting room shows the live plan: ✓ done, ● in progress."],
  ["🚶", "Agents with nothing to do take breaks around the office. When work arrives they rush back."],
  ["💬", "Bubbles and floating emoji show what each agent is doing at that moment."],
  ["👆", "Click any agent (or its card below) to see who they are, what they're doing and why."],
];

/** "How to read this office" button with a short legend. */
export function HowItWorks({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="glass-strong min-h-8 min-w-8 rounded-full px-3 text-xs font-semibold text-accent transition hover:brightness-125"
      >
        {open ? (
          "Close guide"
        ) : (
          <>
            <span aria-hidden>?</span>
            <span className="sr-only sm:not-sr-only"> How to read this</span>
          </>
        )}
      </button>
      {open && (
        <ul className="glass-strong max-h-64 w-72 overflow-y-auto rounded-xl p-3 text-xs">
          {LEGEND.map(([icon, text]) => (
            <li key={text} className="flex gap-2 py-1">
              <span aria-hidden className="text-base leading-none">
                {icon}
              </span>
              <span className="text-ink/90">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const EVENT_ICON: Record<TaskEvent["kind"], string> = {
  received: "📥",
  plan: "🧠",
  assign: "👉",
  start: "⌨️",
  done: "✅",
  error: "⚠️",
  merge: "🧩",
  info: "ℹ️",
  finish: "🎉",
};

/** The last few things that happened, overlaid on the 3D office. */
export function Ticker({ events }: { events: TaskEvent[] }) {
  if (!events.length) return null;
  return (
    <ul className="glass-strong w-[min(26rem,100%)] rounded-xl px-3 py-2 text-xs" aria-label="Latest office activity">
      {events.slice(-3).map((e) => (
        <li key={`${e.at}${e.text}`} className="flex gap-2 py-0.5">
          <span aria-hidden>{EVENT_ICON[e.kind]}</span>
          <span className="line-clamp-2 text-ink/90">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Full step-by-step story of one task. */
export function Timeline({ events, start }: { events?: TaskEvent[]; start: number }) {
  if (!events?.length) return null;
  return (
    <section aria-labelledby="timeline-heading" className="glass rounded-2xl p-4">
      <h3 id="timeline-heading" className="mb-1 font-semibold">
        How the team worked on this
      </h3>
      <p className="mb-3 text-xs text-muted">Every step the office took, in order, with the manager&apos;s reasoning.</p>
      <ol className="relative flex flex-col gap-2 border-l border-accent/30 pl-4">
        {events.map((e) => (
          <li key={`${e.at}${e.text}`} className="relative text-sm">
            <span
              aria-hidden
              className="absolute -left-[1.42rem] top-0.5 grid size-5 place-items-center rounded-full bg-well text-[11px] ring-1 ring-accent/40"
            >
              {EVENT_ICON[e.kind]}
            </span>
            <span className="mr-2 font-mono text-xs text-muted">+{Math.max(0, Math.round((e.at - start) / 1000))}s</span>
            <span className={e.kind === "error" ? "text-error" : "text-ink/90"}>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One-line live status for an agent card. */
export function AgentStatusText({ id, fallback }: { id: string; fallback: string }) {
  const activity = useAgentActivity(id);
  return <>{activity ?? fallback}</>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Who an agent is, what they're doing right now, and why they got their current job. */
export function AgentPanel({ agent, tasks, onClose }: { agent: Agent; tasks: Task[]; onClose: () => void }) {
  const activity = useAgentActivity(agent.id);
  // newest assignment first (tasks are stored newest-first)
  let latest: { task: Task; sub: Task["subtasks"][number] } | null = null;
  let completed = 0;
  for (const task of tasks) {
    for (const sub of task.subtasks) {
      if (sub.agentId !== agent.id) continue;
      if (sub.status === "done") completed++;
      latest ??= { task, sub };
    }
  }
  const preview = latest?.sub.output.replace(/[#*`_>|]/g, "").trim().slice(-320);
  const statusText = {
    queued: "Queued",
    working: "Working on it now",
    done: "Finished",
    error: "Hit a problem",
  };

  return (
    <aside className="glass-strong flex max-h-full w-[min(22rem,100%)] flex-col gap-2 overflow-y-auto rounded-xl p-3 text-sm" aria-label={`About ${agent.name}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-black">
          {initials(agent.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{agent.name}</p>
          <p className="text-xs text-muted">
            {agent.role} · {completed} part{completed === 1 ? "" : "s"} completed
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${agent.name}'s details`}
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div>
        <p className="text-xs font-semibold text-accent">Right now</p>
        <p className="text-ink/90">{activity ?? "At their desk"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-accent">What they&apos;re good at</p>
        <p className="text-xs text-ink/80">{agent.instructions}</p>
      </div>
      {latest ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-accent">
            Latest job · {statusText[latest.sub.status]}
          </p>
          <p className="font-medium">&ldquo;{latest.sub.title}&rdquo;</p>
          {latest.sub.reason && (
            <p className="text-xs text-ink/80">
              <span className="font-semibold">Why {agent.name}: </span>
              {latest.sub.reason}
            </p>
          )}
          {preview && (
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-lg bg-well p-2 font-mono text-[11px] text-link">
              {preview}
              {latest.sub.status === "working" ? "▌" : ""}
            </pre>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">No jobs yet. Assign a task and Max will decide who does what.</p>
      )}
    </aside>
  );
}
