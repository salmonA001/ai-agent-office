"use client";

import {
  ArrowCounterClockwiseIcon,
  BarbellIcon,
  BrainIcon,
  CheckIcon,
  CloudSunIcon,
  CoffeeIcon,
  CopyIcon,
  CornersInIcon,
  CornersOutIcon,
  CpuIcon,
  FastForwardIcon,
  FileTextIcon,
  GearIcon,
  HeadphonesIcon,
  type Icon,
  ImageIcon,
  ListIcon,
  MapTrifoldIcon,
  MoonIcon,
  PaintBrushIcon,
  PaletteIcon,
  PlusIcon,
  PresentationChartIcon,
  SunHorizonIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Agent, DEFAULT_AGENTS, MAX_AGENT, withDefaultAgents } from "@/lib/agents";
import { clockText, phaseAt, useOfficeMinutes } from "@/lib/office-clock";
import { useOfficeCustom } from "@/lib/office-custom";
import {
  type EngineState,
  getAiSettings,
  getEngineState,
  MODELS,
  modelInfo,
  subscribeEngine,
  useAiSettings,
  wantedTier,
  webGpuSupported,
} from "@/lib/browser-ai";
import { type Key, phrase, useI18n } from "@/lib/i18n";
import { useProfileName } from "@/lib/profile";
import { countWords } from "@/lib/words";
import { type Attachment, runTask, type Task, type TaskStatus } from "@/lib/run-task";
import { TaskComposer } from "./TaskComposer";
import { focusZone, useCameraFocus, ZONE_IDS, type ZoneId } from "./camera-focus";
import { levelOf, rewardOnce, setNames, triggerEvent, useGame } from "./office-events";
import { MAX_DESKS } from "./office-nav";
import { CustomizePanel } from "./OfficeCustomize";
import { AgentPanel, AgentStatusText, initials, Ticker, Timeline } from "./OfficeExplain";
import { DrillOverlay, EventBanner, EventsPanel, LevelToast, TeamStats, XpBadge } from "./OfficeGame";
import type { BoardLine, DeskState, ManagerState, ScreenState } from "./OfficeScene";
import { Sidebar, type SidebarTab } from "./Sidebar";

function SceneLoading() {
  const { t } = useI18n();
  return <div className="grid h-full place-items-center text-sm text-muted">{t("floor.loading")}</div>;
}

const OfficeScene = dynamic(() => import("./OfficeScene"), { ssr: false, loading: () => <SceneLoading /> });

const IDLE_ENGINE: EngineState = { status: "idle" };

const STORE = { agents: "office.agents", tasks: "office.tasks" };

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

const STATUS_KEY: Record<TaskStatus | "queued", Key> = {
  planning: "status.planning",
  working: "status.working",
  synthesizing: "status.synthesizing",
  done: "status.done",
  error: "status.error",
  cancelled: "status.cancelled",
  queued: "status.queued",
};

function StatusPill({ status }: { status: TaskStatus | "queued" }) {
  const { t } = useI18n();
  const active = status !== "done" && status !== "error" && status !== "cancelled" && status !== "queued";
  const tone =
    status === "done"
      ? "bg-primary text-on-primary"
      : status === "error"
        ? "bg-danger text-on-danger"
        : active
          ? "bg-accent text-on-accent"
          : "bg-well text-muted";
  return (
    <span
      key={status}
      className={`enter-pop inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      {active && (
        <span aria-hidden className="relative flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-on-accent" style={{ animation: "ping-soft 1.4s var(--ease-out) infinite" }} />
          <span className="relative size-1.5 rounded-full bg-on-accent" />
        </span>
      )}
      {t(STATUS_KEY[status])}
    </span>
  );
}

/**
 * Full screen for the 3D office. Uses the browser's full-screen mode where it exists and falls back
 * to a fixed overlay (iPhone Safari can't put an element in full screen).
 */
function useStageFullscreen() {
  const stage = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  const full = native || pseudo;

  useEffect(() => {
    const sync = () => {
      const on = stage.current !== null && document.fullscreenElement === stage.current;
      setNative(on);
      // a slow native request can win after the overlay fallback opened; keep just one mode
      if (on) setPseudo(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!pseudo) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pseudo]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (pseudo) {
      setPseudo(false);
      return;
    }
    const el = stage.current;
    if (el && document.fullscreenEnabled && typeof el.requestFullscreen === "function") {
      let settled = false;
      el.requestFullscreen({ navigationUI: "hide" }).then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
          setPseudo(true);
        },
      );
      // some in-app and embedded browsers never answer the request
      window.setTimeout(() => {
        if (!settled && !document.fullscreenElement) setPseudo(true);
      }, 700);
    } else {
      setPseudo(true);
    }
  }, [pseudo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pseudo) {
        setPseudo(false);
        return;
      }
      if (e.key !== "f" && e.key !== "F") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pseudo, toggle]);

  return { stage, full, pseudo, toggle };
}

function FullscreenButton({ full, onToggle }: { full: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const label = full ? t("full.exit") : t("full.enter");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={full}
      title={`${label} (F)`}
      className="glass-strong press inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-accent"
    >
      {full ? <CornersInIcon size={16} weight="bold" aria-hidden /> : <CornersOutIcon size={16} weight="bold" aria-hidden />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

const ZONE_ICON: Record<ZoneId, Icon> = {
  engine: GearIcon,
  social: CoffeeIcon,
  labs: PaletteIcon,
  pods: HeadphonesIcon,
  fitness: BarbellIcon,
  hub: PresentationChartIcon,
};

/** Buttons that fly the camera to each working zone, or back out to the whole office. */
function ZonePicker() {
  const { t } = useI18n();
  const focus = useCameraFocus();
  const items: { id: ZoneId | "all" | "roof"; label: string; I: Icon }[] = [
    { id: "all", label: t("zones.all"), I: MapTrifoldIcon },
    ...ZONE_IDS.map((id) => ({ id, label: t(`zone.${id}` as Key), I: ZONE_ICON[id] })),
    { id: "roof", label: t("zones.roof"), I: CloudSunIcon },
  ];
  return (
    <div
      role="toolbar"
      aria-label={t("zones.label")}
      className="glass-strong flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none]"
    >
      {items.map(({ id, label, I }) => {
        const on = id === "roof" ? focus.level === 1 : focus.id === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => focusZone(id)}
            aria-label={label}
            aria-pressed={on}
            title={label}
            className={`press grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-200 sm:size-9 ${
              on ? "bg-accent text-on-accent" : "text-muted hover:bg-accent/15 hover:text-ink"
            }`}
          >
            <I size={17} weight={on ? "fill" : "duotone"} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Office time on the 3D view. */
function ClockChip({ minutes, fast }: { minutes: number; fast: boolean }) {
  const { t } = useI18n();
  const phase = phaseAt(minutes);
  const I = phase === "day" ? SunIcon : phase === "sunset" ? SunHorizonIcon : MoonIcon;
  return (
    <span
      className="glass-strong inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tabular-nums"
      title={fast ? t("clock.fast") : undefined}
    >
      <I size={16} weight="fill" aria-hidden className="text-accent" />
      {clockText(minutes)}
      {fast && <FastForwardIcon size={12} weight="fill" aria-label={t("clock.fast")} className="text-accent" />}
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

export function Office() {
  const { lang, t } = useI18n();
  const custom = useOfficeCustom();
  const minutes = useOfficeMinutes(custom.lighting);
  const profileName = useProfileName();
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHire, setShowHire] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SidebarTab>("progress");
  const composer = useRef<HTMLTextAreaElement>(null);
  // agent whose details are open (click an agent in 3D or its card)
  const [focusId, setFocusId] = useState<string | null>(null);
  const selectAgent = useCallback((id: string) => {
    setFocusId((cur) => (cur === id ? null : id));
  }, []);
  const engineState = useSyncExternalStore(subscribeEngine, getEngineState, () => IDLE_ENGINE);
  const controllers = useRef(new Map<string, AbortController>());
  const { stage, full: isFull, pseudo: pseudoFull, toggle: toggleFull } = useStageFullscreen();

  useEffect(() => {
    // Restore after hydration; tasks that were running when the page closed can't resume.
    const storedTasks = load<Task[]>(STORE.tasks, []).map((t) =>
      ACTIVE.includes(t.status) ? { ...t, status: "cancelled" as const } : t,
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    setAgents(withDefaultAgents(load(STORE.agents, DEFAULT_AGENTS)));
    setTasks(storedTasks);
    setSelectedId(storedTasks[0]?.id ?? null);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (loaded) save(STORE.agents, agents);
  }, [agents, loaded]);

  const unsaved = useRef<Task[] | null>(null);
  useEffect(() => {
    if (!loaded) return;
    // saving every streamed token would stall the page: save at most once a second
    unsaved.current = tasks;
    const timer = setTimeout(() => {
      save(STORE.tasks, tasks.slice(0, 30));
      unsaved.current = null;
    }, 1000);
    return () => clearTimeout(timer);
  }, [tasks, loaded]);
  useEffect(() => {
    // ...and never lose the last second when the tab closes
    const flush = () => {
      if (unsaved.current) save(STORE.tasks, unsaved.current.slice(0, 30));
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  // Streamed tokens arrive many times a second; apply them in one render every ~80 ms.
  const pending = useRef<{ id: string; fn: (t: Task) => Task }[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTask = useCallback((id: string, fn: (t: Task) => Task) => {
    pending.current.push({ id, fn });
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const batch = pending.current;
      pending.current = [];
      setTasks((all) => all.map((t) => batch.reduce((cur, u) => (u.id === cur.id ? u.fn(cur) : cur), t)));
    }, 80);
  }, []);

  const start = useCallback(
    (text: string, extra: { attachments?: Attachment[]; images?: Record<string, string>; think?: boolean } = {}) => {
      const team = agents.slice(0, MAX_DESKS);
      const task: Task = {
        id: crypto.randomUUID(),
        prompt: text,
        ...(extra.attachments?.length ? { attachments: extra.attachments } : {}),
        mode: extra.think ? "think" : "fast",
        createdAt: Date.now(),
        status: "planning",
        subtasks: [],
        final: "",
        events: [{ at: Date.now(), kind: "received", text: "You assigned the task. Max picks it up.", msg: { key: "ev.received" } }],
      };
      const controller = new AbortController();
      controllers.current.set(task.id, controller);
      setTasks((all) => [task, ...all]);
      setSelectedId(task.id);
      setSideTab("progress");

      runTask(task, team, controller.signal, (fn) => updateTask(task.id, fn), lang, { review: getAiSettings().review, images: extra.images })
        .catch((err: Error) => {
          if (controller.signal.aborted) {
            updateTask(task.id, (t) => ({ ...t, status: "cancelled" }));
          } else {
            updateTask(task.id, (t) => ({ ...t, status: "error", error: err.message }));
          }
        })
        .finally(() => controllers.current.delete(task.id));
    },
    [agents, updateTask, lang],
  );


  const cancel = (id: string) => controllers.current.get(id)?.abort();

  const remove = (id: string) => {
    cancel(id);
    setTasks((all) => all.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const focusComposer = useCallback(() => {
    setMenuOpen(false);
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composer.current?.focus({ preventScroll: true });
  }, []);

  const resetOffice = useCallback(() => {
    for (const c of controllers.current.values()) c.abort();
    try {
      for (const k of ["office.tasks", "office.agents", "office.game", "office.rewarded", "office.custom"]) localStorage.removeItem(k);
    } catch {
      // storage unavailable
    }
    window.location.reload();
  }, []);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const focusAgent = focusId === "max" ? MAX_AGENT : (agents.find((a) => a.id === focusId) ?? null);

  // game layer: XP for finished work, levels shown on the 3D name tags
  const game = useGame();
  useEffect(() => {
    setNames(agents.map((a) => [a.id, a.name]));
  }, [agents]);
  useEffect(() => {
    for (const t of tasks) {
      for (const s of t.subtasks) {
        if (s.status !== "done") continue;
        const words = countWords(s.output);
        rewardOnce(`sub:${s.id}`, s.agentId, 30 + Math.min(30, Math.round(words / 25)), { key: "why.finished", params: { title: s.title } });
      }
      if (t.status === "done") rewardOnce(`task:${t.id}`, "max", 25, { key: "why.task" });
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
            ? s.output || !s.thinking
              ? { mode, title: s.title, text: s.output.slice(-800), len: s.output.length }
              : { mode, title: s.title, text: `… ${s.thinking.slice(-700)}`, len: s.thinking.length }
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
  // The projector shows live subtasks, or the selected task's when nothing is running.
  const board: BoardLine[] = (running.length ? running : selected ? [selected] : [])
    .flatMap((t) => t.subtasks)
    .map((s) => ({ text: s.title, status: s.status }));

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar
        tasks={tasks}
        agents={agents}
        selectedId={selectedId}
        onSelectTask={(id) => {
          setSelectedId(id);
          setMenuOpen(false);
          document.getElementById("task-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onNewTask={focusComposer}
        busyCount={busy.size}
        onReset={resetOffice}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        tab={sideTab}
        onTab={setSideTab}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="glass sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.openMenu")}
            className="press grid size-10 place-items-center rounded-lg border border-line bg-well lg:hidden"
          >
            <ListIcon size={20} weight="bold" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {profileName ? t("app.hello", { name: profileName }) : <>AI Agent <span className="text-accent">Office</span></>}
            </h1>
            <p className="hidden truncate text-xs text-muted md:block">{t("app.tagline")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent">
              <CpuIcon size={14} weight="duotone" aria-hidden />
              <ModelName />
            </span>
            <span className="hidden items-center gap-2 xl:inline-flex">
              <TeamStats ids={agents.map((a) => a.id)} />
            </span>
            <span
              key={running.length}
              className="enter-pop rounded-full border border-line bg-well px-3 py-1 text-muted"
              aria-live="polite"
            >
              {running.length === 0 ? t("office.idle") : t("office.running", { n: running.length })}
            </span>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6">
          <EngineBanner state={engineState} />

          {/* Office floor */}
          {/* glass blur and the entrance transform would trap the fixed full-screen overlay, so drop them while it's open */}
          <section
            aria-labelledby="floor-heading"
            className={`${pseudoFull ? "" : "glass enter"} rounded-2xl p-4`}
            style={{ ["--i" as string]: 0 }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 id="floor-heading" className="font-semibold">
                  {t("floor.title")}
                </h2>
                <span className="text-xs text-muted">{t("hire.desks", { n: Math.min(agents.length, MAX_DESKS), max: MAX_DESKS })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom((v) => !v);
                    setShowHire(false);
                  }}
                  aria-expanded={showCustom}
                  className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 text-sm font-semibold text-accent"
                >
                  {showCustom ? <XIcon size={16} weight="bold" aria-hidden /> : <PaintBrushIcon size={16} weight="bold" aria-hidden />}
                  {showCustom ? t("custom.close") : t("custom.open")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHire((v) => !v);
                    setShowCustom(false);
                  }}
                  aria-expanded={showHire}
                  className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent"
                >
                  {showHire ? <XIcon size={16} weight="bold" aria-hidden /> : <PlusIcon size={16} weight="bold" aria-hidden />}
                  {showHire ? t("hire.close") : t("hire.open")}
                </button>
              </div>
            </div>

            {showCustom && (
              <CustomizePanel />
            )}

            {showHire &&
              (agents.length >= MAX_DESKS ? (
                <p role="status" className="enter-drop mb-4 rounded-xl bg-well p-4 text-sm text-muted">
                  {t("hire.full", { n: MAX_DESKS })}
                </p>
              ) : (
                <HireForm
                  onHire={(a) => {
                    setAgents((all) => [...all, a]);
                    setShowHire(false);
                    setNames([[a.id, a.name]]);
                    triggerEvent("welcome", a.id);
                  }}
                />
              ))}

            <div
              ref={stage}
              data-stage
              className={
                isFull
                  ? "fixed inset-0 z-[70] flex flex-col bg-surface p-2 sm:p-3"
                  : "relative mb-4"
              }
            >
              <div
                className={`relative overflow-hidden rounded-xl bg-surface ring-1 ring-accent/20 ${
                  isFull ? "min-h-0 flex-1" : "h-[420px] sm:h-[640px]"
                }`}
              >
                <OfficeScene
                  agents={agents}
                  desks={desks}
                  manager={manager}
                  board={board}
                  selectedId={focusId}
                  onSelectAgent={selectAgent}
                  levels={levels}
                  lang={lang}
                />
                <DrillOverlay />
                {/* clock and full screen, layered over the 3D office */}
                <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
                  <div className="pointer-events-auto min-w-0">
                    <ZonePicker />
                  </div>
                  <div className="pointer-events-auto flex shrink-0 items-start gap-2">
                    {minutes !== null && <ClockChip minutes={minutes} fast={custom.lighting === "fast"} />}
                    <FullscreenButton full={isFull} onToggle={toggleFull} />
                  </div>
                </div>
                <div className="pointer-events-none absolute bottom-2 left-2 hidden md:block">
                  <Ticker events={(running[0] ?? selected)?.events ?? []} />
                </div>
                {/* game events: banner at the top, level-ups near the bottom */}
                <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-2">
                  <EventBanner />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <LevelToast />
                </div>
              </div>
              {focusAgent && (
                <div
                  className={
                    isFull
                      ? "absolute inset-x-4 bottom-4 flex max-h-[55%] justify-center sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-h-[calc(100%-7rem)] sm:justify-end"
                      : "mt-3 flex justify-center sm:absolute sm:bottom-2 sm:right-2 sm:mt-0 sm:max-h-[calc(100%-6rem)] sm:justify-end"
                  }
                >
                  <AgentPanel agent={focusAgent} tasks={tasks} onClose={() => setFocusId(null)} />
                </div>
              )}
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={t("floor.title")}>
              {agents.map((a, i) => {
                const doing = busy.get(a.id);
                return (
                  <li
                    key={a.id}
                    className={`enter lift relative flex flex-col gap-2 rounded-xl border p-3 ${
                      doing ? "pulse-glow border-accent bg-accent/10" : "border-line bg-well"
                    } ${focusId === a.id ? "ring-2 ring-accent" : ""}`}
                    style={{ ["--i" as string]: Math.min(i, 12) }}
                  >
                    <button
                      type="button"
                      onClick={() => selectAgent(a.id)}
                      aria-pressed={focusId === a.id}
                      className="flex flex-col gap-2 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-300 ${
                            doing ? "bg-accent text-on-accent" : "bg-primary text-on-primary"
                          }`}
                        >
                          {initials(a.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{a.name}</span>
                          <span className="block truncate text-xs text-muted">{phrase(lang, a.role)}</span>
                        </span>
                      </span>
                      <XpBadge id={a.id} />
                      <span className="line-clamp-2 text-xs text-muted">
                        {doing ? t("agent.workingOn", { title: doing.join(", ") }) : <AgentStatusText id={a.id} fallback={t("agent.available")} />}
                      </span>
                    </button>
                    {a.custom && (
                      <button
                        type="button"
                        onClick={() => setAgents((all) => all.filter((x) => x.id !== a.id))}
                        className="self-start text-xs text-error underline"
                        aria-label={t("agent.removeLabel", { name: a.name })}
                      >
                        {t("agent.remove")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="grid flex-1 gap-5 lg:grid-cols-[340px_1fr]">
            <div className="flex flex-col gap-5">
              <TaskComposer
                composerRef={composer}
                onSubmit={({ text, files, think }) =>
                  start(text, {
                    attachments: files.map((f) => ({ name: f.name, kind: f.kind, ...(f.text ? { text: f.text } : {}) })),
                    images: Object.fromEntries(files.filter((f) => f.dataUrl).map((f) => [f.name, f.dataUrl!])),
                    think,
                  })
                }
              />

              <EventsPanel />
            </div>

            {/* Task detail */}
            <section id="task-detail" className="min-w-0 scroll-mt-20">
              {selected ? (
                <TaskView
                  key={selected.id}
                  task={selected}
                  agents={agents}
                  onCancel={() => cancel(selected.id)}
                  onRetry={() => start(selected.prompt, { attachments: selected.attachments, think: selected.mode === "think" })}
                  onDelete={() => remove(selected.id)}
                />
              ) : (
                <div className="enter-fade grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-line p-8 text-center text-muted">
                  <p>{t("task.empty")}</p>
                </div>
              )}
            </section>
          </div>
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
  const { lang, t } = useI18n();
  const [copied, setCopied] = useState(false);
  const active = ACTIVE.includes(task.status);

  return (
    <article className="flex flex-col gap-4" aria-labelledby="task-title">
      <div className="glass enter rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="task-title" className="min-w-0 flex-1 whitespace-pre-wrap break-words font-semibold">
            {task.prompt}
          </h2>
          <div className="flex items-center gap-2">
            <StatusPill status={task.status} />
            {active ? (
              <button
                type="button"
                onClick={onCancel}
                className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-danger px-3 text-sm font-semibold text-on-danger"
              >
                <XIcon size={16} weight="bold" aria-hidden />
                {t("task.cancel")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary"
                >
                  <ArrowCounterClockwiseIcon size={16} weight="bold" aria-hidden />
                  {t("task.retry")}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  aria-label={t("task.delete")}
                  className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-danger/50 px-3 text-sm font-semibold text-error hover:bg-danger/10"
                >
                  <TrashIcon size={16} weight="bold" aria-hidden />
                  <span className="hidden sm:inline">{t("task.delete")}</span>
                </button>
              </>
            )}
          </div>
        </div>
        {(task.mode === "think" || task.attachments?.length) && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label={t("attach.list")}>
            {task.mode === "think" && (
              <li className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 font-semibold text-accent">
                <BrainIcon size={13} weight="fill" aria-hidden />
                {t("mode.think")}
              </li>
            )}
            {task.attachments?.map((a) => (
              <li key={a.name} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted" title={a.text?.slice(0, 300)}>
                {a.kind === "image" ? <ImageIcon size={13} weight="duotone" aria-hidden /> : <FileTextIcon size={13} weight="duotone" aria-hidden />}
                <span className="max-w-48 truncate">{a.name}</span>
              </li>
            ))}
          </ul>
        )}
        {task.error && (
          <p role="alert" className="mt-2 text-sm text-error">
            {task.error}
          </p>
        )}
        {task.status === "planning" && <p className="enter-fade mt-2 text-sm text-muted">{t("task.planningNote")}</p>}
      </div>

      {task.subtasks.length > 0 && (
        <section aria-label={t("step.work")} className="grid gap-4 xl:grid-cols-2">
          {task.subtasks.map((s, i) => {
            const agent = agents.find((a) => a.id === s.agentId);
            return (
              <div
                key={s.id}
                className={`glass enter flex min-w-0 flex-col gap-2 rounded-2xl p-4 ${s.status === "working" ? "pulse-glow" : ""}`}
                style={{ ["--i" as string]: i + 1 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{agent ? `${agent.name} · ${phrase(lang, agent.role)}` : t("task.formerAgent")}</p>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                {s.reason && (
                  <p className="rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1.5 text-xs text-ink/90">
                    <span className="font-semibold text-accent">{t("task.why", { name: agent?.name ?? t("task.whyAgent") })} </span>
                    {s.reason}
                  </p>
                )}
                <details className="text-xs text-muted">
                  <summary>{t("task.brief")}</summary>
                  <p className="enter-fade mt-1 whitespace-pre-wrap">{s.brief}</p>
                </details>
                <div className="max-h-96 overflow-y-auto rounded-lg bg-well p-3">
                  {s.output ? (
                    <Markdown>{s.output}</Markdown>
                  ) : (
                    <p className="text-sm text-muted">{s.status === "error" ? t("task.failed") : t("task.waiting")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Timeline events={task.events} start={task.createdAt} />

      {(task.final || task.status === "synthesizing") && (
        <section aria-labelledby="final-heading" className="glass glow enter-pop rounded-2xl border-accent/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="final-heading" className="font-semibold text-accent">
              {t("task.final")}
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
                className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary"
              >
                {copied ? <CheckIcon size={16} weight="bold" aria-hidden /> : <CopyIcon size={16} weight="bold" aria-hidden />}
                {copied ? t("task.copied") : t("task.copy")}
              </button>
            )}
          </div>
          {task.final ? <Markdown>{task.final}</Markdown> : <p className="text-sm text-muted">{t("task.merging")}</p>}
        </section>
      )}
    </article>
  );
}

function HireForm({ onHire }: { onHire: (a: Agent) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [zone, setZone] = useState<ZoneId>("engine");
  const valid = name.trim() && role.trim() && instructions.trim();
  const input = "min-h-10 rounded-lg border border-line bg-surface/40 px-3 text-ink transition-colors focus:border-accent/60";

  return (
    <form
      className="enter-drop mb-4 grid gap-3 rounded-xl bg-well p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onHire({
          id: `custom-${crypto.randomUUID().slice(0, 8)}`,
          name: name.trim(),
          role: role.trim(),
          instructions: instructions.trim(),
          zone,
          custom: true,
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        {t("hire.name")}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("hire.role")}
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={60}
          required
          placeholder={t("hire.rolePh")}
          className={`${input} placeholder:text-muted/80`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        {t("hire.instructions")}
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={2000}
          rows={3}
          required
          className="rounded-lg border border-line bg-surface/40 p-3 text-ink transition-colors focus:border-accent/60"
        />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
        <legend className="mb-1">{t("hire.zone")}</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("hire.zone")}>
          {ZONE_IDS.map((id) => {
            const I = ZONE_ICON[id];
            const on = zone === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setZone(id)}
                className={`press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-200 ${
                  on ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                <I size={15} weight={on ? "fill" : "duotone"} aria-hidden className={on ? "text-accent" : ""} />
                {t(`zone.${id}` as Key)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={!valid}
        className="press inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-on-primary disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
      >
        <PlusIcon size={16} weight="bold" aria-hidden />
        {t("hire.submit")}
      </button>
    </form>
  );
}

/** Which model the office runs on (the one loaded, or the one the settings will load). */
function ModelName() {
  const { t } = useI18n();
  const ai = useAiSettings();
  const state = useSyncExternalStore(subscribeEngine, getEngineState, () => IDLE_ENGINE);
  const tier = state.status === "ready" || state.status === "loading" ? state.tier : ai.model === "auto" ? null : ai.model;
  return <>{tier ? t("engine.model", { name: modelInfo(tier).name }) : t("engine.browser")}</>;
}

const noop = () => () => {};

function EngineBanner({ state }: { state: EngineState }) {
  const { t } = useI18n();
  // the hints depend on this device, so they only render in the browser (not in the prerendered page)
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;
  if (state.status === "loading") {
    const m = modelInfo(state.tier);
    return (
      <div className="glass enter-drop rounded-xl border-accent p-4" role="status">
        <p className="text-sm font-semibold">{t("engineBanner.loading", { name: m.name, size: m.download })}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-well">
          <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.round(state.progress * 100)}%` }} />
        </div>
        <p className="mt-1 truncate text-xs text-muted">{state.text}</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="glass enter-drop rounded-xl border-danger p-4 text-sm text-error">
        {state.message === "no-webgpu" ? t("engineBanner.noWebgpu") : t("engineBanner.error", { msg: state.message })}
      </p>
    );
  }
  if (state.status === "ready") return null;
  if (!webGpuSupported()) return <p className="glass enter-drop rounded-xl p-3 text-sm text-error">{t("engineBanner.noWebgpu")}</p>;
  const m = MODELS[wantedTier()];
  return <p className="glass enter-drop rounded-xl p-3 text-sm text-muted">{t("engineBanner.free", { name: m.name, size: m.download })}</p>;
}
