"use client";

import { EVENT_KINDS, levelOf, levelProgress, triggerEvent, useGame } from "./office-events";

/** Banner for the office event that is happening right now, with a countdown bar. */
export function EventBanner() {
  const { event } = useGame();
  if (!event) return null;
  return (
    <div className="glass-strong w-[min(26rem,calc(100vw-3rem))] rounded-xl px-3 py-2" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="text-lg leading-none">
          {event.icon}
        </span>
        {event.title}
        <span className="ml-auto text-xs font-normal text-muted">
          {event.agentIds.length} agent{event.agentIds.length === 1 ? "" : "s"} joining
        </span>
      </p>
      <p className="mt-0.5 text-xs text-ink/85">{event.text}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          key={event.id}
          className="h-full rounded-full bg-accent"
          style={{ animation: `event-countdown ${event.durationMs}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

/** Red pulsing glow over the office during the fire drill. */
export function DrillOverlay() {
  const { event } = useGame();
  if (event?.kind !== "drill") return null;
  return <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-red-600/10 ring-4 ring-inset ring-red-500/60" />;
}

/** Pops up when an agent levels up. */
export function LevelToast() {
  const { toast } = useGame();
  if (!toast) return null;
  return (
    <div key={toast.id} className="glass-strong glow animate-bounce rounded-full px-4 py-1.5 text-sm font-semibold text-accent" role="status">
      {toast.icon} {toast.text}
    </div>
  );
}

/** Level chip plus an XP bar for an agent card or panel. */
export function XpBadge({ id }: { id: string }) {
  const { xp } = useGame();
  const { level, into, needed } = levelProgress(xp[id] ?? 0);
  return (
    <div className="flex items-center gap-2" title={`${xp[id] ?? 0} XP · ${needed - into} XP to level ${level + 1}`}>
      <span className="rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-bold text-accent">Lv {level}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * into) / needed}%` }} />
      </span>
    </div>
  );
}

/** Header chips: team XP and how many events the office has handled. */
export function TeamStats({ ids }: { ids: string[] }) {
  const { xp, eventsHandled } = useGame();
  const total = [...ids, "max"].reduce((n, id) => n + (xp[id] ?? 0), 0);
  return (
    <>
      <span className="rounded-full border border-white/10 bg-well px-3 py-1 text-muted" title="Everyone's XP added up">
        🏆 Team Lv {levelOf(total / 4)} · {total.toLocaleString()} XP
      </span>
      <span className="rounded-full border border-white/10 bg-well px-3 py-1 text-muted">🎲 {eventsHandled} events</span>
    </>
  );
}

/** Log of office events and XP, with buttons to start an event yourself. */
export function EventsPanel() {
  const { log, event } = useGame();
  return (
    <section aria-labelledby="events-heading" className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="events-heading" className="font-semibold">
          Office events
        </h2>
        <button
          type="button"
          onClick={() => triggerEvent("random")}
          disabled={Boolean(event)}
          className="min-h-8 rounded-lg bg-accent px-2.5 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          🎲 Random event
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Every minute or so something happens. Free agents react and earn XP; busy agents keep working.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Start a specific event">
        {EVENT_KINDS.map((e) => (
          <button
            key={e.kind}
            type="button"
            onClick={() => triggerEvent(e.kind)}
            disabled={Boolean(event)}
            title={e.title}
            aria-label={`Start: ${e.title}`}
            className="grid size-8 place-items-center rounded-lg border border-white/10 bg-well text-base transition hover:border-accent/60 disabled:opacity-40"
          >
            {e.icon}
          </button>
        ))}
      </div>
      {log.length === 0 ? (
        <p className="text-xs text-muted">Nothing yet. The first event starts soon.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
          {log.slice(0, 12).map((l, i) => (
            <li key={l.id ?? `${l.at}-${i}`} className="flex gap-2">
              <span aria-hidden>{l.icon}</span>
              <span className="text-ink/85">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
