"use client";

import { DiceFiveIcon, LightningIcon, TrophyIcon } from "@phosphor-icons/react";
import { renderMsg, translate, useI18n } from "@/lib/i18n";
import { EVENT_KINDS, levelOf, levelProgress, triggerEvent, useGame } from "./office-events";

/** Banner for the office event that is happening right now, with a countdown bar. */
export function EventBanner() {
  const { event } = useGame();
  const { lang, t } = useI18n();
  if (!event) return null;
  return (
    <div
      key={event.id}
      className="glass-strong enter-drop w-[min(26rem,calc(100vw-3rem))] rounded-xl px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="text-lg leading-none">
          {event.icon}
        </span>
        {renderMsg(lang, event.title, "")}
        <span className="ml-auto text-xs font-normal text-muted">{t("game.joining", { n: event.agentIds.length })}</span>
      </p>
      <p className="mt-0.5 text-xs text-ink/85">{renderMsg(lang, event.text, "")}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
        <div
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
  return (
    <div aria-hidden className="enter-fade pointer-events-none absolute inset-0 animate-pulse bg-red-600/10 ring-4 ring-inset ring-red-500/60" />
  );
}

/** Pops up when an agent levels up. */
export function LevelToast() {
  const { toast } = useGame();
  const { lang } = useI18n();
  if (!toast) return null;
  return (
    <div key={toast.id} className="glass-strong glow enter-pop rounded-full px-4 py-1.5 text-sm font-semibold text-accent" role="status">
      {toast.icon} {renderMsg(lang, toast.msg, "")}
    </div>
  );
}

/** Level chip plus an XP bar for an agent card or panel. */
export function XpBadge({ id }: { id: string }) {
  const { xp } = useGame();
  const { t } = useI18n();
  const { level, into, needed } = levelProgress(xp[id] ?? 0);
  return (
    <div className="flex items-center gap-2" title={t("game.xpTitle", { xp: xp[id] ?? 0, need: needed - into, next: level + 1 })}>
      <span className="rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-bold text-accent">Lv {level}</span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${(100 * into) / needed}%` }}
        />
      </span>
    </div>
  );
}

export function teamTotals(xp: Record<string, number>, ids: string[]) {
  const total = [...ids, "max"].reduce((n, id) => n + (xp[id] ?? 0), 0);
  return { total, level: levelOf(total / 4) };
}

/** Header chips: team XP and how many events the office has handled. */
export function TeamStats({ ids }: { ids: string[] }) {
  const { xp, eventsHandled } = useGame();
  const { t } = useI18n();
  const { total, level } = teamTotals(xp, ids);
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-well px-3 py-1 text-muted" title={t("game.teamTitle")}>
        <TrophyIcon size={14} weight="duotone" aria-hidden className="text-accent" />
        {t("game.team", { level, xp: total.toLocaleString() })}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-well px-3 py-1 text-muted">
        <LightningIcon size={14} weight="duotone" aria-hidden className="text-accent" />
        {t("game.eventsCount", { n: eventsHandled })}
      </span>
    </>
  );
}

/** Log of office events and XP, with buttons to start an event yourself. */
export function EventsPanel() {
  const { log, event } = useGame();
  const { lang, t } = useI18n();
  return (
    <section aria-labelledby="events-heading" className="glass enter rounded-2xl p-4" style={{ ["--i" as string]: 2 }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="events-heading" className="font-semibold">
          {t("game.events")}
        </h2>
        <button
          type="button"
          onClick={() => triggerEvent("random")}
          disabled={Boolean(event)}
          className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent disabled:opacity-50"
        >
          <DiceFiveIcon size={16} weight="bold" aria-hidden />
          {t("game.random")}
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">{t("game.hint")}</p>
      <div className="mb-3 flex flex-wrap gap-1.5" aria-label={t("game.startLabel")}>
        {EVENT_KINDS.map((e) => {
          const title = translate(lang, e.titleKey);
          return (
            <button
              key={e.kind}
              type="button"
              onClick={() => triggerEvent(e.kind)}
              disabled={Boolean(event)}
              title={title}
              aria-label={t("game.start", { title })}
              className="press grid size-11 place-items-center rounded-lg border border-line bg-well text-lg hover:border-accent/60 disabled:opacity-40"
            >
              {e.icon}
            </button>
          );
        })}
      </div>
      {log.length === 0 ? (
        <p className="text-xs text-muted">{t("game.none")}</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
          {log.slice(0, 12).map((l, i) => (
            <li key={l.id ?? `${l.at}-${i}`} className="enter flex gap-2" style={{ ["--i" as string]: Math.min(i, 6) }}>
              <span aria-hidden>{l.icon}</span>
              <span className="text-ink/85">{renderMsg(lang, l.msg, l.text)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
