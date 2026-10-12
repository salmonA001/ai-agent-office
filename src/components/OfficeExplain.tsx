"use client";

import { XIcon } from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents";
import { agentInstructions, type Key, phrase, renderMsg, useI18n } from "@/lib/i18n";
import type { Task, TaskEvent } from "@/lib/run-task";
import { useAgentActivity } from "./agent-activity";
import { XpBadge } from "./OfficeGame";

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
  const { lang, t } = useI18n();
  if (!events.length) return null;
  const start = Math.max(0, events.length - 3);
  return (
    <ul className="glass-strong w-[min(26rem,100%)] rounded-xl px-3 py-2 text-xs" aria-label={t("ticker.label")}>
      {events.slice(-3).map((e, i) => (
        <li key={start + i} className="enter flex gap-2 py-0.5">
          <span aria-hidden>{EVENT_ICON[e.kind]}</span>
          <span className="line-clamp-2 text-ink/90">{renderMsg(lang, e.msg, e.text)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Full step-by-step story of one task. */
export function Timeline({ events, start }: { events?: TaskEvent[]; start: number }) {
  const { lang, t } = useI18n();
  if (!events?.length) return null;
  return (
    <section aria-labelledby="timeline-heading" className="glass enter rounded-2xl p-4" style={{ ["--i" as string]: 1 }}>
      <h3 id="timeline-heading" className="mb-1 font-semibold">
        {t("timeline.title")}
      </h3>
      <p className="mb-3 text-xs text-muted">{t("timeline.sub")}</p>
      <ol className="relative flex flex-col gap-2 border-l border-accent/30 pl-4">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="enter relative text-sm" style={{ ["--i" as string]: Math.min(i, 8) }}>
            <span
              aria-hidden
              className="absolute -left-[1.42rem] top-0.5 grid size-5 place-items-center rounded-full bg-well text-[11px] ring-1 ring-accent/40"
            >
              {EVENT_ICON[e.kind]}
            </span>
            <span className="mr-2 font-mono text-xs text-muted">+{Math.max(0, Math.round((e.at - start) / 1000))}s</span>
            <span className={e.kind === "error" ? "text-error" : "text-ink/90"}>{renderMsg(lang, e.msg, e.text)}</span>
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

export function initials(name: string) {
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
  const { lang, t } = useI18n();
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
  const statusKey: Record<string, Key> = { queued: "panel.queued", working: "panel.working", done: "panel.done", error: "panel.error" };

  return (
    <aside
      key={agent.id}
      className="glass-strong enter-pop flex max-h-full w-[min(22rem,100%)] flex-col gap-2 overflow-y-auto rounded-xl p-3 text-sm"
      aria-label={t("panel.about", { name: agent.name })}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary">
          {initials(agent.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{agent.name}</p>
          <p className="text-xs text-muted">
            {phrase(lang, agent.role)} · {t("panel.parts", { n: completed })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("panel.close", { name: agent.name })}
          className="press grid size-9 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"
        >
          <XIcon size={16} weight="bold" aria-hidden />
        </button>
      </div>
      <XpBadge id={agent.id} />
      <div>
        <p className="text-xs font-semibold text-accent">{t("panel.now")}</p>
        <p className="text-ink/90">{activity ?? t("panel.atDesk")}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-accent">{t("panel.goodAt")}</p>
        <p className="text-xs text-ink/80">{agentInstructions(lang, agent.id, agent.instructions)}</p>
      </div>
      {latest ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-accent">{t("panel.latest", { status: t(statusKey[latest.sub.status]) })}</p>
          <p className="font-medium">&ldquo;{latest.sub.title}&rdquo;</p>
          {latest.sub.reason && (
            <p className="text-xs text-ink/80">
              <span className="font-semibold">{t("task.why", { name: agent.name })} </span>
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
        <p className="text-xs text-muted">{t("panel.noJobs")}</p>
      )}
    </aside>
  );
}
