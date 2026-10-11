"use client";

import {
  ChartLineUpIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CloudIcon,
  CpuIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  SidebarSimpleIcon,
  SpinnerGapIcon,
  TrashIcon,
  UserCircleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { Agent } from "@/lib/agents";
import { type Key, LANGS, useI18n } from "@/lib/i18n";
import { setProfileName, useProfileName } from "@/lib/profile";
import type { Engine, Task, TaskStatus } from "@/lib/run-task";
import { type Motion, MOTIONS, setMotion, useDeviceReducedMotion, useMotion } from "@/lib/motion";
import { THEMES, useTheme } from "@/lib/theme";
import { countWords } from "@/lib/words";
import { useGame } from "./office-events";
import { teamTotals } from "./OfficeGame";

export type SidebarTab = "progress" | "recent" | "account";

const TABS: { id: SidebarTab; label: Key; Icon: typeof ChartLineUpIcon }[] = [
  { id: "progress", label: "tab.progress", Icon: ChartLineUpIcon },
  { id: "recent", label: "tab.recent", Icon: ClockCounterClockwiseIcon },
  { id: "account", label: "tab.account", Icon: UserCircleIcon },
];

const ACTIVE: TaskStatus[] = ["planning", "working", "synthesizing"];

type SidebarProps = {
  tasks: Task[];
  agents: Agent[];
  selectedId: string | null;
  onSelectTask: (id: string) => void;
  onNewTask: () => void;
  busyCount: number;
  engine: Engine | null;
  cloudReady: boolean;
  code: string;
  onSaveCode: (code: string) => void;
  onReset: () => void;
  /** mobile drawer */
  open: boolean;
  onClose: () => void;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
};

/** Left sidebar: task progress, recent tasks and the account/settings tab. Drawer on small screens. */
export function Sidebar(props: SidebarProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* desktop: sticky rail that can collapse to icons */}
      <aside
        className={`glass sticky top-0 hidden h-dvh shrink-0 flex-col rounded-none border-y-0 border-l-0 transition-[width] duration-300 ease-out lg:flex ${
          collapsed ? "w-[76px]" : "w-[320px]"
        }`}
      >
        <SidebarBody {...props} collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} />
      </aside>
      {/* mobile: slide-in drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label={t("nav.closeMenu")} tabIndex={-1} onClick={onClose} className="enter-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <aside
            className="glass-strong absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col rounded-none border-y-0 border-l-0 bg-panel"
            style={{ animation: "slide-in-left var(--dur-3) var(--ease-out) both" }}
          >
            <SidebarBody {...props} collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarBody({
  collapsed,
  onCollapse,
  ...props
}: SidebarProps & { collapsed: boolean; onCollapse?: () => void }) {
  const uid = useId();
  const { t } = useI18n();
  const name = useProfileName();
  const index = TABS.findIndex((x) => x.id === props.tab);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* brand */}
      <div className={`flex items-center gap-3 border-b border-line p-4 ${collapsed ? "justify-center px-2" : ""}`}>
        <span
          aria-hidden
          className="glow grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-sm font-black text-on-accent"
        >
          AI
        </span>
        {!collapsed && (
          <div className="enter-fade min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">
              AI Agent <span className="text-accent">Office</span>
            </p>
            <p className="truncate text-xs text-muted">{t("app.hello", { name: name || "👋" })}</p>
          </div>
        )}
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            className={`press grid size-9 place-items-center rounded-lg text-muted hover:bg-line hover:text-ink ${collapsed ? "hidden" : ""}`}
          >
            <SidebarSimpleIcon size={18} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onClose}
            aria-label={t("nav.closeMenu")}
            className="press grid size-10 place-items-center rounded-lg text-muted hover:bg-line hover:text-ink"
          >
            <XIcon size={18} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      {collapsed ? (
        /* icon rail */
        <nav className="flex flex-col items-center gap-2 p-3" aria-label="sidebar">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={t(label)}
              aria-label={t(label)}
              onClick={() => {
                props.onTab(id);
                onCollapse?.();
              }}
              className={`press grid size-11 place-items-center rounded-xl ${
                props.tab === id ? "bg-accent/15 text-accent" : "text-muted hover:bg-line hover:text-ink"
              }`}
            >
              <Icon size={22} weight={props.tab === id ? "fill" : "regular"} aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t("nav.expand")}
            className="press mt-2 grid size-11 place-items-center rounded-xl text-muted hover:bg-line hover:text-ink"
          >
            <SidebarSimpleIcon size={20} aria-hidden className="-scale-x-100" />
          </button>
        </nav>
      ) : (
        <>
          {/* segmented tabs with a sliding highlight */}
          <div className="px-4 pt-4">
            <div role="tablist" aria-label="sidebar" className="relative grid grid-cols-3 rounded-xl bg-well p-1">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 rounded-lg bg-accent transition-transform duration-300 ease-out"
                style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${index * 100}%)` }}
              />
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  id={`${uid}-tab-${id}`}
                  aria-selected={props.tab === id}
                  aria-controls={`${uid}-panel-${id}`}
                  onClick={() => props.onTab(id)}
                  className={`relative z-10 flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-semibold transition-colors duration-300 ${
                    props.tab === id ? "text-on-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon size={18} weight={props.tab === id ? "fill" : "regular"} aria-hidden />
                  <span className="truncate">{t(label)}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            key={props.tab}
            role="tabpanel"
            id={`${uid}-panel-${props.tab}`}
            aria-labelledby={`${uid}-tab-${props.tab}`}
            className="enter-fade min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {props.tab === "progress" && <ProgressTab {...props} />}
            {props.tab === "recent" && <RecentTab {...props} />}
            {props.tab === "account" && <AccountTab {...props} />}
          </div>

          <QuickSettings />
        </>
      )}
    </div>
  );
}

// ---------- shared bits ----------

const STATUS_KEY: Record<TaskStatus, Key> = {
  planning: "status.planning",
  working: "status.working",
  synthesizing: "status.synthesizing",
  done: "status.done",
  error: "status.error",
  cancelled: "status.cancelled",
};

function StatusIcon({ status }: { status: TaskStatus | "queued" }) {
  if (status === "done") return <CheckCircleIcon size={16} weight="fill" className="text-accent" aria-hidden />;
  if (status === "error") return <WarningCircleIcon size={16} weight="fill" className="text-error" aria-hidden />;
  if (status === "cancelled" || status === "queued") return <span aria-hidden className="mx-1 size-2 rounded-full bg-muted/60" />;
  return <SpinnerGapIcon size={16} weight="bold" className="animate-spin text-accent" aria-hidden />;
}

/** Overall percentage from the task stage and how many parts are finished. */
export function taskProgress(task: Task) {
  if (task.status === "done") return 100;
  if (task.status === "planning") return 8;
  if (task.status === "synthesizing") return 92;
  const total = task.subtasks.length || 1;
  const done = task.subtasks.filter((s) => s.status === "done" || s.status === "error").length;
  const working = task.subtasks.filter((s) => s.status === "working").length;
  return Math.round(10 + (80 * (done + working * 0.4)) / total);
}

/** Current time, read after mount (never during prerender) and ticking each second while `active`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function timeAgo(t: (k: Key, p?: Record<string, string | number>) => string, at: number, now: number) {
  const m = Math.floor((now - at) / 60000);
  if (m < 1) return t("time.now");
  if (m < 60) return t("time.m", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.h", { n: h });
  return t("time.d", { n: Math.floor(h / 24) });
}

function Stat({ label, value, i }: { label: string; value: ReactNode; i: number }) {
  return (
    <div className="enter rounded-xl border border-line bg-well p-3" style={{ ["--i" as string]: i }}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ---------- Progress ----------

function ProgressTab({ tasks, agents, onSelectTask, onNewTask, busyCount }: SidebarProps) {
  const { t } = useI18n();
  const running = tasks.filter((x) => ACTIVE.includes(x.status));
  const now = useNow(running.length > 0);
  const today = now ? new Date(now).toDateString() : "";
  const doneToday = tasks.filter((x) => x.status === "done" && new Date(x.createdAt).toDateString() === today).length;
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "?";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("progress.running")} value={running.length} i={0} />
        <Stat label={t("progress.doneToday")} value={doneToday} i={1} />
        <Stat label={t("progress.busyAgents")} value={busyCount} i={2} />
      </div>

      {running.length === 0 ? (
        <div className="enter flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <ChartLineUpIcon size={26} weight="duotone" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{t("progress.empty")}</p>
            <p className="mt-1 text-xs text-muted">{t("progress.emptyHint")}</p>
          </div>
          <button
            type="button"
            onClick={onNewTask}
            className="press inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary"
          >
            <PaperPlaneRightIcon size={16} weight="bold" aria-hidden />
            {t("progress.assign")}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {running.map((task, i) => {
            const pct = taskProgress(task);
            const done = task.subtasks.filter((s) => s.status === "done").length;
            const stage = task.status === "planning" ? 0 : task.status === "working" ? 1 : 2;
            return (
              <li key={task.id} className="enter" style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  onClick={() => onSelectTask(task.id)}
                  aria-label={`${t("progress.open")}: ${task.prompt}`}
                  className="lift pulse-glow flex w-full flex-col gap-2.5 rounded-xl border border-accent/40 bg-accent/5 p-3 text-left"
                >
                  <span className="line-clamp-2 text-sm font-medium">{task.prompt}</span>
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    {(["step.plan", "step.work", "step.merge"] as Key[]).map((k, s) => (
                      <span
                        key={k}
                        className={`rounded-full px-2 py-0.5 font-semibold transition-colors duration-300 ${
                          s === stage ? "bg-accent text-on-accent" : s < stage ? "text-accent" : ""
                        }`}
                      >
                        {s < stage ? "✓ " : ""}
                        {t(k)}
                      </span>
                    ))}
                    {now > 0 && (
                      <span className="ml-auto font-mono tabular-nums">
                        {t("progress.elapsed", { s: Math.max(0, Math.round((now - task.createdAt) / 1000)) })}
                      </span>
                    )}
                  </span>
                  <span className="relative h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                    <span className="shimmer absolute inset-0" aria-hidden />
                  </span>
                  <span className="flex justify-between text-[11px] text-muted">
                    <span>{task.subtasks.length ? t("progress.parts", { done, total: task.subtasks.length }) : t("status.planning")}</span>
                    <span className="font-semibold tabular-nums text-accent">{pct}%</span>
                  </span>
                  {task.subtasks.length > 0 && (
                    <span className="flex flex-col gap-1.5 border-t border-line pt-2">
                      {task.subtasks.map((s) => (
                        <span key={s.id} className="flex items-center gap-2 text-xs">
                          <StatusIcon status={s.status} />
                          <span className="shrink-0 font-semibold">{nameOf(s.agentId)}</span>
                          <span className="truncate text-muted">{s.title}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Recent ----------

function RecentTab({ tasks, selectedId, onSelectTask }: SidebarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const now = useNow(true);
  const q = query.trim().toLowerCase();
  const shown = q ? tasks.filter((x) => x.prompt.toLowerCase().includes(q)) : tasks;

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">{t("recent.search")}</span>
        <MagnifyingGlassIcon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("recent.search")}
          className="min-h-10 w-full rounded-lg border border-line bg-well pl-9 pr-3 text-sm text-ink placeholder:text-muted/80 transition-colors focus:border-accent/60"
        />
      </label>
      {shown.length === 0 ? (
        <p className="enter-fade py-6 text-center text-sm text-muted">{tasks.length ? t("recent.noMatch") : t("recent.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((task, i) => (
            <li key={task.id} className="enter" style={{ ["--i" as string]: Math.min(i, 10) }}>
              <button
                type="button"
                onClick={() => onSelectTask(task.id)}
                aria-current={task.id === selectedId}
                className={`lift flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left ${
                  task.id === selectedId ? "border-accent bg-accent/10" : "border-line bg-well hover:border-accent/50"
                }`}
              >
                <span className="line-clamp-2 text-sm">{task.prompt}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted">
                  <StatusIcon status={task.status} />
                  <span className="font-semibold">{t(STATUS_KEY[task.status])}</span>
                  {task.subtasks.length > 0 && <span>· {task.subtasks.length}</span>}
                  {now > 0 && <span className="ml-auto">{timeAgo(t, task.createdAt, now)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Account ----------

function AccountTab({ tasks, agents, engine, cloudReady, code, onSaveCode, onReset }: SidebarProps) {
  const uid = useId();
  const { t } = useI18n();
  const name = useProfileName();
  const game = useGame();
  const [draftCode, setDraftCode] = useState(code);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const done = tasks.filter((x) => x.status === "done").length;
  const words = tasks.reduce(
    (n, x) => n + x.subtasks.reduce((m, s) => m + (s.status === "done" ? countWords(s.output) : 0), 0),
    0,
  );
  const team = teamTotals(game.xp, agents.map((a) => a.id));

  return (
    <div className="flex flex-col gap-5">
      <section className="enter rounded-2xl border border-line bg-well p-4" aria-labelledby={`${uid}-profile`}>
        <h3 id={`${uid}-profile`} className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("account.profile")}
        </h3>
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary text-lg font-black text-on-accent">
            {(name || "?").slice(0, 1).toUpperCase()}
          </span>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted">
            {t("account.name")}
            <input
              value={name}
              onChange={(e) => setProfileName(e.target.value)}
              maxLength={40}
              className="min-h-10 rounded-lg border border-line bg-surface/40 px-3 text-sm text-ink transition-colors focus:border-accent/60"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-muted">{t("account.local")}</p>
      </section>

      <section aria-labelledby={`${uid}-stats`}>
        <h3 id={`${uid}-stats`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("account.stats")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t("account.tasksDone")} value={done} i={1} />
          <Stat label={t("account.words")} value={words.toLocaleString()} i={2} />
          <Stat label={t("account.events")} value={game.eventsHandled} i={3} />
          <Stat label={t("account.teamLevel")} value={`Lv ${team.level}`} i={4} />
        </div>
      </section>

      <LanguagePicker />
      <ThemePicker />
      <MotionPicker />

      <section className="enter" aria-labelledby={`${uid}-engine`} style={{ ["--i" as string]: 6 }}>
        <h3 id={`${uid}-engine`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t("account.engine")}
        </h3>
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-well px-3 py-1 text-xs font-semibold text-accent">
          {engine === "cloud" ? <CloudIcon size={14} weight="duotone" aria-hidden /> : <CpuIcon size={14} weight="duotone" aria-hidden />}
          {engine === "cloud" ? t("engine.cloud") : engine === "browser" ? t("engine.browser") : t("engine.detecting")}
        </p>
        {cloudReady && (
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveCode(draftCode);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1500);
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted">
              {t("account.code")}
              <input
                type="password"
                autoComplete="off"
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                className="min-h-10 rounded-lg border border-line bg-well px-3 text-sm text-ink transition-colors focus:border-accent/60"
              />
            </label>
            <button type="submit" className="press min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">
              {saved ? t("account.codeSaved") : t("account.codeSave")}
            </button>
          </form>
        )}
      </section>

      <section className="enter rounded-2xl border border-danger/40 p-4" style={{ ["--i" as string]: 7 }}>
        <p className="text-xs text-muted">{t("account.resetHint")}</p>
        <button
          type="button"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              window.setTimeout(() => setConfirmReset(false), 4000);
              return;
            }
            setConfirmReset(false);
            onReset();
          }}
          className={`press mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
            confirmReset ? "bg-danger text-on-danger" : "border border-danger/50 text-error hover:bg-danger/10"
          }`}
        >
          <TrashIcon size={16} weight="bold" aria-hidden />
          {confirmReset ? t("account.resetConfirm") : t("account.reset")}
        </button>
      </section>
    </div>
  );
}

function LanguagePicker() {
  const uid = useId();
  const { lang, setLang, t } = useI18n();
  return (
    <section className="enter" aria-labelledby={`${uid}-lang`} style={{ ["--i" as string]: 5 }}>
      <h3 id={`${uid}-lang`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("account.language")}
      </h3>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-well p-1" role="radiogroup" aria-labelledby={`${uid}-lang`}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={lang === l.id}
            onClick={() => setLang(l.id)}
            className={`press min-h-10 rounded-lg text-sm font-semibold ${lang === l.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ThemePicker() {
  const uid = useId();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <section className="enter" aria-labelledby={`${uid}-theme`} style={{ ["--i" as string]: 5 }}>
      <h3 id={`${uid}-theme`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("account.theme")}
      </h3>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={`${uid}-theme`}>
        {THEMES.map((th) => (
          <button
            key={th.id}
            type="button"
            role="radio"
            aria-checked={theme === th.id}
            aria-label={t(`theme.${th.id}` as Key)}
            title={t(`theme.${th.id}` as Key)}
            onClick={() => setTheme(th.id)}
            className={`press flex flex-col items-center gap-1 rounded-xl border p-1.5 ${
              theme === th.id ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-accent/50"
            }`}
          >
            <span
              aria-hidden
              className="block size-8 overflow-hidden rounded-lg ring-1 ring-line"
              style={{ background: `linear-gradient(135deg, ${th.swatch[0]} 0 50%, ${th.swatch[1]} 50% 75%, ${th.swatch[2]} 75%)` }}
            />
            <span className="w-full truncate text-center text-[10px] text-muted">{t(`theme.${th.id}` as Key)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MotionPicker() {
  const uid = useId();
  const { t } = useI18n();
  const motion = useMotion();
  const deviceReduced = useDeviceReducedMotion();
  return (
    <section className="enter" aria-labelledby={`${uid}-motion`} style={{ ["--i" as string]: 5 }}>
      <h3 id={`${uid}-motion`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("account.motion")}
      </h3>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-well p-1" role="radiogroup" aria-labelledby={`${uid}-motion`}>
        {MOTIONS.map((m: Motion) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={motion === m}
            onClick={() => setMotion(m)}
            className={`press min-h-10 rounded-lg px-1 text-xs font-semibold ${motion === m ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {t(`motion.${m}` as Key)}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">{t(`motion.hint.${motion}` as Key)}</p>
      {deviceReduced && motion === "system" && <p className="mt-1 text-[11px] text-error">{t("motion.deviceOff")}</p>}
    </section>
  );
}

/** Language and theme always one click away at the bottom of the sidebar. */
function QuickSettings() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const nextTheme = THEMES[(THEMES.findIndex((x) => x.id === theme) + 1) % THEMES.length];
  return (
    <div className="flex items-center gap-2 border-t border-line p-3">
      <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-well p-1">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={lang === l.id}
            onClick={() => setLang(l.id)}
            className={`press min-h-9 rounded-md text-xs font-semibold ${lang === l.id ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(nextTheme.id)}
        aria-label={`${t("account.theme")}: ${t(`theme.${nextTheme.id}` as Key)}`}
        title={t(`theme.${nextTheme.id}` as Key)}
        className="press grid size-10 place-items-center rounded-lg border border-line bg-well"
      >
        <span
          aria-hidden
          className="block size-5 rounded-full ring-1 ring-line"
          style={{ background: `linear-gradient(135deg, ${nextTheme.swatch[0]} 0 50%, ${nextTheme.swatch[1]} 50%)` }}
        />
      </button>
    </div>
  );
}
