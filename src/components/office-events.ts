import { useSyncExternalStore } from "react";
import { EVENT_SPOTS, type Spot, spotById, walkers } from "./office-nav";

/**
 * Game layer: random office events that idle agents react to, plus XP and levels.
 * The engine is ticked from the 3D scene's frame loop (so it pauses with the animation),
 * and the UI subscribes to the store below.
 */

export type EventKind = "pizza" | "drill" | "birthday" | "printer" | "server" | "plants" | "arcade" | "coffee";

export type ActiveEvent = {
  id: number;
  kind: EventKind;
  icon: string;
  title: string;
  text: string;
  /** wall-clock ms, for the UI countdown */
  startedAt: number;
  durationMs: number;
  agentIds: string[];
  /** the agent the event is about (birthday person, the fixer) */
  heroId?: string;
};

export type LogEntry = { id?: number; at: number; icon: string; text: string };

type GameState = {
  event: ActiveEvent | null;
  xp: Record<string, number>;
  log: LogEntry[];
  eventsHandled: number;
  toast: { id: number; icon: string; text: string } | null;
};

const STORE_KEY = "office.game";
const REWARDED_KEY = "office.rewarded";

let state: GameState = { event: null, xp: {}, log: [], eventsHandled: 0, toast: null };
const listeners = new Set<() => void>();
const names = new Map<string, string>([["max", "Max"]]);
let rewarded = new Set<string>();
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (saved) state = { ...state, xp: saved.xp ?? {}, log: saved.log ?? [], eventsHandled: saved.eventsHandled ?? 0 };
    rewarded = new Set(JSON.parse(localStorage.getItem(REWARDED_KEY) ?? "[]"));
  } catch {
    // storage unavailable: play without saving
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ xp: state.xp, log: state.log.slice(0, 30), eventsHandled: state.eventsHandled }));
    localStorage.setItem(REWARDED_KEY, JSON.stringify([...rewarded].slice(-500)));
  } catch {
    // storage unavailable: play without saving
  }
}

function set(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY: GameState = { event: null, xp: {}, log: [], eventsHandled: 0, toast: null };

export function useGame() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

/** Current event, read every frame by scene effects without re-rendering. */
export function currentEventKind(): EventKind | null {
  return state.event?.kind ?? null;
}

export function setNames(entries: [string, string][]) {
  for (const [id, name] of entries) names.set(id, name);
}

const nameOf = (id: string) => names.get(id) ?? "Someone";

// ---------- XP and levels ----------

/** Level 2 at 25 XP, 3 at 100, 4 at 225, 5 at 400 ... */
export function levelOf(xp: number) {
  return 1 + Math.floor(Math.sqrt(xp / 25));
}

export function levelProgress(xp: number) {
  const level = levelOf(xp);
  const base = 25 * (level - 1) ** 2;
  const next = 25 * level ** 2;
  return { level, into: xp - base, needed: next - base };
}

let logSeq = Date.now();
function log(icon: string, text: string, xpState = state.xp) {
  set({ log: [{ id: ++logSeq, at: Date.now(), icon, text }, ...state.log].slice(0, 30), xp: xpState });
}

let toastId = 0;
function toast(icon: string, text: string) {
  const id = ++toastId;
  set({ toast: { id, icon, text } });
  setTimeout(() => {
    if (state.toast?.id === id) set({ toast: null });
  }, 3500);
}

export function awardXp(agentId: string, amount: number, why: string, quiet = false) {
  load();
  const before = state.xp[agentId] ?? 0;
  const xp = { ...state.xp, [agentId]: before + amount };
  if (!quiet) log("✨", `${nameOf(agentId)} +${amount} XP: ${why}`, xp);
  else set({ xp });
  const lvl = levelOf(before + amount);
  if (lvl > levelOf(before)) {
    log("⭐", `${nameOf(agentId)} reached level ${lvl}!`);
    toast("⭐", `${nameOf(agentId)} reached level ${lvl}!`);
  }
  save();
}

/** Reward finished work once per id (subtasks, tasks), even across reloads. */
export function rewardOnce(key: string, agentId: string, amount: number, why: string) {
  load();
  if (rewarded.has(key)) return;
  rewarded.add(key);
  awardXp(agentId, amount, why);
}

// ---------- Events ----------

type Plan = { orders: Map<string, Spot[]>; dwell: number; heroId?: string; text: string };

type EventDef = {
  kind: EventKind;
  icon: string;
  title: string;
  seconds: number;
  xp: number;
  plan: (idle: string[], everyone: string[]) => Plan | null;
};

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Send each idle agent to one of the spots. */
function gather(idle: string[], spots: Spot[], say?: string) {
  const orders = new Map<string, Spot[]>();
  shuffle(idle)
    .slice(0, spots.length)
    .forEach((id, i) => orders.set(id, [say ? { ...spots[i], say } : spots[i]]));
  return orders;
}

/** One agent handles a chore; prefer the right specialist if they're free. */
function chore(idle: string[], prefer: string[], spots: Spot[]) {
  const id = prefer.find((p) => idle.includes(p)) ?? pick(idle);
  return { id, orders: new Map([[id, spots]]) };
}

const fix = (s: Spot, say: string, emoji: string[], where: string): Spot => ({ ...s, say, emoji, where });

const EVENTS: EventDef[] = [
  {
    kind: "pizza",
    icon: "🍕",
    title: "Pizza party!",
    seconds: 28,
    xp: 8,
    plan: (idle) => ({
      orders: gather(idle, [
        ...EVENT_SPOTS.pizza,
        ...["stool", "dining-a", "dining-b", "coffee", "fridge", "sink"].map((id) =>
          fix(spotById(id), "Pizza!", ["🍕", "😋"], "at the pizza party in the kitchen"),
        ),
      ]),
      dwell: 4,
      text: "Free pizza in the kitchen! Everyone who isn't busy heads over.",
    }),
  },
  {
    kind: "drill",
    icon: "🚨",
    title: "Fire drill",
    seconds: 20,
    xp: 6,
    plan: (idle) => ({
      orders: gather(idle, shuffle(EVENT_SPOTS.drill)),
      dwell: 4,
      text: "Alarm! Free agents leave their spots and line up in the corridor. Busy agents keep working.",
    }),
  },
  {
    kind: "birthday",
    icon: "🎂",
    title: "Birthday party",
    seconds: 28,
    xp: 8,
    plan: (idle, everyone) => {
      const heroId = pick(everyone);
      return {
        orders: gather(idle, [
          ...EVENT_SPOTS.party,
          ...["sofa-a", "sofa-b", "vending"].map((id) =>
            fix(spotById(id), "Happy birthday!", ["🎂", "🎉"], "at the birthday party in the lounge"),
          ),
        ]),
        dwell: 4,
        heroId,
        text: `It's ${nameOf(heroId)}'s birthday! Cake in the lounge.`,
      };
    },
  },
  {
    kind: "printer",
    icon: "🖨️",
    title: "Printer jam",
    seconds: 18,
    xp: 15,
    plan: (idle) => {
      const { id, orders } = chore(idle, ["coder", "qa"], [fix(spotById("printer"), "Fixing the printer", ["🔧", "😤", "📄"], "fixing the printer")]);
      return { orders, dwell: 4, heroId: id, text: `The printer jammed. ${nameOf(id)} goes to fix it.` };
    },
  },
  {
    kind: "server",
    icon: "🖥️",
    title: "Server alarm",
    seconds: 20,
    xp: 15,
    plan: (idle) => {
      const { id, orders } = chore(idle, ["coder", "data", "qa"], [
        fix(spotById("server-check"), "Rebooting servers", ["🔧", "💻", "😅"], "fixing the servers"),
      ]);
      return { orders, dwell: 4, heroId: id, text: `A server is overheating! ${nameOf(id)} rushes to the server room.` };
    },
  },
  {
    kind: "plants",
    icon: "🌱",
    title: "Thirsty plants",
    seconds: 40,
    xp: 12,
    plan: (idle) => {
      const { id, orders } = chore(idle, ["planner"], shuffle(EVENT_SPOTS.plants));
      return { orders, dwell: 4.5, heroId: id, text: `The office plants need water. ${nameOf(id)} does the rounds.` };
    },
  },
  {
    kind: "arcade",
    icon: "🕹️",
    title: "Arcade tournament",
    seconds: 28,
    xp: 10,
    plan: (idle) => ({
      orders: gather(idle, ["arcade-1", "arcade-2", "foos-a", "foos-b"].map((id) => spotById(id))),
      dwell: 4,
      text: "Tournament in the game room! Up to four free agents compete.",
    }),
  },
  {
    kind: "coffee",
    icon: "☕",
    title: "Coffee machine broke",
    seconds: 18,
    xp: 12,
    plan: (idle) => {
      const { id, orders } = chore(idle, ["qa", "coder"], [
        fix(spotById("coffee"), "Fixing the coffee machine", ["🔧", "☕", "😩"], "fixing the coffee machine"),
      ]);
      return { orders, dwell: 4, heroId: id, text: `The coffee machine is smoking! ${nameOf(id)} saves the day.` };
    },
  },
];

let nextAt = 20; // scene seconds until the first event
let endsAt = 0;
let pending: EventKind | "random" | null = null;
let eventId = 0;

/** Start an event on the next frame (from the 🎲 button). */
export function triggerEvent(kind: EventKind | "random" = "random") {
  pending = kind;
}

function begin(def: EventDef, t: number) {
  const everyone = [...walkers.keys()];
  const idle = everyone.filter((id) => walkers.get(id)!.isIdle());
  if (!idle.length) {
    log(def.icon, `${def.title} postponed: everyone is busy working.`);
    nextAt = t + 20;
    return;
  }
  const plan = def.plan(idle, everyone);
  if (!plan) return;
  const agentIds: string[] = [];
  for (const [id, spots] of plan.orders) if (walkers.get(id)?.command(spots, plan.dwell)) agentIds.push(id);
  endsAt = t + def.seconds;
  set({
    event: {
      id: ++eventId,
      kind: def.kind,
      icon: def.icon,
      title: def.title,
      text: plan.text,
      startedAt: Date.now(),
      durationMs: def.seconds * 1000,
      agentIds,
      heroId: plan.heroId,
    },
  });
  log(def.icon, `${def.title}: ${plan.text}`);
}

function finish(t: number) {
  const ev = state.event;
  if (!ev) return;
  const def = EVENTS.find((e) => e.kind === ev.kind)!;
  for (const id of ev.agentIds) walkers.get(id)?.release();
  set({ event: null, eventsHandled: state.eventsHandled + 1 });
  if (ev.heroId) awardXp(ev.heroId, def.xp * (ev.kind === "birthday" ? 2 : 1), ev.kind === "birthday" ? "birthday gifts" : `handled the ${def.title.toLowerCase()}`);
  for (const id of ev.agentIds) if (id !== ev.heroId) awardXp(id, def.xp, `joined the ${def.title.toLowerCase()}`, true);
  if (ev.agentIds.length) log("✅", `${def.title} over. ${ev.agentIds.length} agent${ev.agentIds.length > 1 ? "s" : ""} earned XP.`);
  save();
  nextAt = t + 45 + Math.random() * 45;
}

/** Called every frame by the scene with its clock (seconds). */
export function tickEvents(t: number) {
  if (state.event) {
    if (t >= endsAt) finish(t);
    return;
  }
  if (pending) {
    const kind = pending;
    pending = null;
    begin(kind === "random" ? pick(EVENTS) : EVENTS.find((e) => e.kind === kind)!, t);
    return;
  }
  if (t >= nextAt && walkers.size) {
    nextAt = t + 30;
    begin(pick(EVENTS), t);
  }
}

export const EVENT_KINDS = EVENTS.map((e) => ({ kind: e.kind, icon: e.icon, title: e.title }));
