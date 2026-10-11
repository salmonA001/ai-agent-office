/**
 * Walking routes for idle agents. Agents follow straight segments between hand-placed waypoints
 * that run through free floor (aisles, the corridor, doorways), so they never walk through walls.
 * Coordinates are world metres on the floor plane: [x, z]. Must match OfficeFloor.tsx.
 */

export type P2 = [number, number];

const NODES: Record<string, P2> = {
  // open workspace: front aisle along the corridor partition, through its two gaps
  W1: [-5.1, 1.2],
  W0: [0, 1.2],
  W2: [5.1, 1.2],
  // corridor
  C3: [-5.1, 0.3],
  C2: [-3.45, 0.3],
  C4: [0.75, 0.3],
  C5: [3.85, 0.3],
  C6: [5.1, 0.3],
  // meeting room (through its door)
  M0: [-3.45, -1.0],
  M1: [-5.4, -1.3],
  M2: [-7.1, -1.3],
  // kitchen (open to the corridor)
  K0: [0.75, -0.6],
  K1: [0.75, -4.5],
  K2: [-2.0, -4.5],
  // lounge (through its door)
  L0: [3.85, -1.0],
  L1: [4.7, -1.6],
  L4: [6.65, -1.6],
};

const EDGES: [string, string][] = [
  ["W1", "W0"],
  ["W0", "W2"],
  ["W1", "C3"],
  ["W2", "C6"],
  ["C3", "C2"],
  ["C2", "C4"],
  ["C4", "C5"],
  ["C5", "C6"],
  ["C2", "M0"],
  ["M0", "M1"],
  ["M1", "M2"],
  ["C4", "K0"],
  ["K0", "K1"],
  ["K1", "K2"],
  ["C5", "L0"],
  ["L0", "L1"],
  ["L1", "L4"],
];

export type Activity = "look" | "sip" | "play" | "rest";

export type Spot = {
  id: string;
  /** where the agent stands or sits */
  at: P2;
  /** graph node the spot hangs off, and the points from that node to the spot */
  node: string;
  approach: P2[];
  /** yaw in radians; 0 faces +z */
  face: number;
  /** seat height in world metres, or 0 to stand */
  seat: number;
  activity: Activity;
  say: string;
  /** where the agent is, for the explanation panel */
  where: string;
  /** emotes that float up while hanging out here */
  emoji: string[];
};

const PI = Math.PI;

export const SPOTS: Spot[] = [
  { id: "printer", at: [-6.9, 1.6], node: "W1", approach: [], face: -PI / 2, seat: 0, activity: "look", say: "Printing stuff", where: "at the printer", emoji: ["🖨️", "📄"] },
  { id: "window-w", at: [-7.3, 3.0], node: "W1", approach: [[-6.9, 1.5]], face: -PI / 2, seat: 0, activity: "look", say: "Nice view", where: "by the window", emoji: ["☀️", "✨", "🌿"] },
  { id: "pong-a", at: [-6.0, 1.95], node: "W1", approach: [], face: 0, seat: 0, activity: "play", say: "Ping-pong!", where: "at the ping-pong table", emoji: ["🏓", "😆", "💪"] },
  { id: "pong-b", at: [-6.0, 5.45], node: "W1", approach: [[-4.6, 1.6], [-4.6, 5.55]], face: PI, seat: 0, activity: "play", say: "Your serve", where: "at the ping-pong table", emoji: ["🏓", "😆", "💪"] },
  { id: "cooler", at: [6.95, 1.55], node: "W2", approach: [], face: PI / 2, seat: 0, activity: "sip", say: "Hydrating", where: "at the water cooler", emoji: ["💧", "😌"] },
  { id: "beanbag", at: [7.0, 2.6], node: "W2", approach: [[6.9, 1.9]], face: -PI / 2, seat: 0.32, activity: "rest", say: "Comfy…", where: "on a beanbag", emoji: ["💤", "😌"] },
  { id: "round-table", at: [5.9, 4.45], node: "W2", approach: [[4.55, 2.0], [4.55, 5.35], [5.9, 5.35]], face: PI, seat: 0.46, activity: "rest", say: "Thinking", where: "at the breakout table", emoji: ["🤔", "💭"] },
  { id: "corridor", at: [-1.5, 0.3], node: "C4", approach: [], face: PI / 2, seat: 0, activity: "look", say: "Stretching legs", where: "in the corridor", emoji: ["🚶", "🎵"] },
  { id: "whiteboard", at: [-7.15, -4.4], node: "M2", approach: [], face: -PI / 2, seat: 0, activity: "look", say: "Doodling ideas", where: "at the meeting-room whiteboard", emoji: ["✏️", "💡"] },
  { id: "meeting-seat", at: [-5.4, -2.25], node: "M1", approach: [], face: PI, seat: 0.5, activity: "rest", say: "Quiet room", where: "in the meeting room", emoji: ["📖", "😌"] },
  { id: "sink", at: [-1.5, -4.75], node: "K2", approach: [], face: PI, seat: 0, activity: "look", say: "Washing my mug", where: "at the kitchen sink", emoji: ["🫧", "🧽"] },
  { id: "coffee", at: [1.15, -4.8], node: "K1", approach: [], face: PI, seat: 0, activity: "sip", say: "Coffee time", where: "at the coffee machine", emoji: ["☕", "😋"] },
  { id: "fridge", at: [2.35, -4.75], node: "K1", approach: [], face: PI, seat: 0, activity: "look", say: "Snack run", where: "at the fridge", emoji: ["🍎", "🧃"] },
  { id: "stool", at: [-0.6, -2.6], node: "K0", approach: [[-0.6, -2.0]], face: PI, seat: 0.72, activity: "sip", say: "Tea break", where: "at the kitchen island", emoji: ["🍵", "😊"] },
  { id: "dining-a", at: [-1.6, -0.75], node: "K0", approach: [[-1.6, -0.3]], face: PI, seat: 0.46, activity: "sip", say: "Lunch!", where: "at the dining table", emoji: ["🍱", "😋"] },
  { id: "dining-b", at: [1.8, -0.75], node: "K0", approach: [[1.8, -0.3]], face: PI, seat: 0.46, activity: "rest", say: "Lunch!", where: "at the dining table", emoji: ["🥪", "😋"] },
  { id: "sofa-a", at: [5.2, -4.3], node: "L1", approach: [[4.7, -3.65], [5.2, -3.65]], face: 0, seat: 0.46, activity: "rest", say: "Power nap", where: "on the lounge sofa", emoji: ["💤", "🛋️"] },
  { id: "sofa-b", at: [6.0, -4.3], node: "L1", approach: [[4.7, -3.65], [6.0, -3.65]], face: 0, seat: 0.46, activity: "rest", say: "Chilling", where: "on the lounge sofa", emoji: ["😌", "🎧"] },
  { id: "vending", at: [6.65, -4.95], node: "L4", approach: [], face: 2.3, seat: 0, activity: "look", say: "Hmm, which snack?", where: "at the vending machine", emoji: ["🍫", "🥤", "🤔"] },
];

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const ADJ: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}

/** Shortest node path (Dijkstra over the tiny waypoint graph). */
function nodePath(from: string, to: string): string[] {
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = "";
    for (const n of open) if (!cur || best[n] < best[cur]) cur = n;
    open.delete(cur);
    if (cur === to) break;
    for (const next of ADJ[cur] ?? []) {
      const d = best[cur] + dist(NODES[cur], NODES[next]);
      if (d < (best[next] ?? Infinity)) {
        best[next] = d;
        prev[next] = cur;
        open.add(next);
      }
    }
  }
  const out = [to];
  while (out[0] !== from && prev[out[0]]) out.unshift(prev[out[0]]);
  return out[0] === from ? out : [from, to];
}

/** How an agent gets from its chair to the graph: back out to the aisle, then along it to the side. */
export type Home = { seat: P2; aisleZ: number; sideX: number };

function homeChain(h: Home): { points: P2[]; node: string } {
  const points: P2[] = [h.seat, [h.seat[0], h.aisleZ], [h.sideX, h.aisleZ], [h.sideX, NODES.W1[1]]];
  return { points, node: h.sideX < 0 ? "W1" : "W2" };
}

function spotChain(s: Spot): { points: P2[]; node: string } {
  return { points: [s.at, ...[...s.approach].reverse()], node: s.node };
}

type Anchor = { home: Home } | { spot: Spot };

const chain = (a: Anchor) => ("home" in a ? homeChain(a.home) : spotChain(a.spot));

/** Full polyline from one anchor (desk or spot) to another. */
export function route(from: Anchor, to: Anchor): P2[] {
  const a = chain(from);
  const b = chain(to);
  const middle = nodePath(a.node, b.node).map((n) => NODES[n]);
  const pts = [...a.points, ...middle, ...[...b.points].reverse()];
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.01);
}

/** Spots currently claimed, so two agents don't sit in the same chair. */
const taken = new Map<string, string>();

export function claimRandomSpot(agentId: string, avoid?: string): Spot | null {
  const free = SPOTS.filter((s) => s.id !== avoid && (!taken.has(s.id) || taken.get(s.id) === agentId));
  if (!free.length) return null;
  const spot = free[Math.floor(Math.random() * free.length)];
  releaseSpot(agentId);
  taken.set(spot.id, agentId);
  return spot;
}

export function releaseSpot(agentId: string) {
  for (const [id, who] of taken) if (who === agentId) taken.delete(id);
  for (const [id, who] of present) if (who === agentId) present.delete(id);
}

const present = new Map<string, string>();

export function isPresent(spotId: string) {
  return present.has(spotId);
}

// ---------- Per-agent wandering state machine (plain TS so it can be simulated without a browser) ----------

export type WalkPhase = { kind: "seated" } | { kind: "walking"; rushing: boolean } | { kind: "spot"; spot: Spot };

export const STROLL = 0.9;
export const RUSH = 4;

/**
 * Seated at the desk until idle for a while, then strolls between spots, sometimes heading home.
 * The moment the agent is busy again it rushes back to its chair, retracing its current route.
 */
export class Wanderer {
  x: number;
  z: number;
  y: number;
  yaw = 0;
  phase: WalkPhase = { kind: "seated" };
  private mode: "seated" | "out" | "spot" | "home" = "seated";
  private origin: Anchor;
  private path: P2[] = [];
  private seg = 0;
  private speed = STROLL;
  private spot: Spot | null = null;
  private timer: number;
  readonly id: string;
  readonly seatY: number;

  constructor(id: string, home: Home, seatY: number, firstWait: number) {
    this.id = id;
    this.seatY = seatY;
    this.timer = firstWait;
    [this.x, this.z] = home.seat;
    this.y = seatY;
    this.origin = { home };
  }

  /** Advance one frame. Returns true when `phase` changed (the caller re-renders then). */
  update(dt: number, home: Home, busy: boolean, canWander: boolean): boolean {
    const before = this.phase;
    dt = Math.min(dt, 0.1);
    if ((busy || !canWander) && this.mode !== "seated") this.goHome(home);

    let targetY = 0;
    let targetYaw = this.yaw;
    if (this.mode === "seated") {
      [this.x, this.z] = home.seat;
      targetY = this.seatY;
      targetYaw = 0;
      if (busy || !canWander) {
        this.timer = Math.max(this.timer, 5 + Math.random() * 6);
      } else if ((this.timer -= dt) <= 0) {
        const spot = claimRandomSpot(this.id);
        if (spot) {
          this.spot = spot;
          this.start({ home }, { spot }, STROLL, "out");
        } else this.timer = 6;
      }
    } else if (this.mode === "spot" && this.spot) {
      targetY = this.spot.seat;
      targetYaw = this.spot.face;
      if ((this.timer -= dt) <= 0) {
        const from = this.spot;
        const next = Math.random() < 0.35 ? null : claimRandomSpot(this.id, from.id);
        if (next) {
          this.spot = next;
          this.start({ spot: from }, { spot: next }, STROLL, "out");
        } else {
          releaseSpot(this.id);
          this.start({ spot: from }, { home }, STROLL, "home");
        }
      }
    } else {
      const target = this.path[this.seg + 1];
      if (target) {
        const dx = target[0] - this.x;
        const dz = target[1] - this.z;
        const d = Math.hypot(dx, dz);
        const step = this.speed * dt;
        if (d > 0.001) targetYaw = Math.atan2(dx, dz);
        if (d <= step) {
          [this.x, this.z] = target;
          this.seg++;
        } else {
          this.x += (dx / d) * step;
          this.z += (dz / d) * step;
        }
      }
      if (this.seg >= this.path.length - 1) {
        if (this.mode === "out" && this.spot) {
          present.set(this.spot.id, this.id);
          this.mode = "spot";
          this.timer = 8 + Math.random() * 10;
          this.phase = { kind: "spot", spot: this.spot };
        } else {
          this.mode = "seated";
          this.spot = null;
          this.timer = 8 + Math.random() * 12;
          this.phase = { kind: "seated" };
        }
      }
    }

    this.y += (targetY - this.y) * Math.min(1, dt * 10);
    // turn the short way round
    this.yaw += Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw)) * Math.min(1, dt * 10);
    return this.phase !== before;
  }

  dispose() {
    releaseSpot(this.id);
  }

  private start(from: Anchor, to: Anchor, speed: number, mode: "out" | "home") {
    if ("spot" in from) present.delete(from.spot.id);
    this.path = route(from, to);
    this.seg = 0;
    this.origin = from;
    this.speed = speed;
    this.mode = mode;
    this.phase = { kind: "walking", rushing: speed > STROLL };
  }

  private goHome(home: Home) {
    releaseSpot(this.id);
    if (this.mode === "spot" && this.spot) {
      this.start({ spot: this.spot }, { home }, RUSH, "home");
    } else if (this.mode === "out") {
      // retrace the current trip, then continue home if it started at another spot
      let back: P2[] = [[this.x, this.z], ...this.path.slice(0, this.seg + 1).reverse()];
      if ("spot" in this.origin) back = back.concat(route(this.origin, { home }).slice(1));
      this.path = back;
      this.seg = 0;
      this.speed = RUSH;
      this.mode = "home";
      this.phase = { kind: "walking", rushing: true };
    } else if (this.mode === "home" && this.speed < RUSH) {
      this.speed = RUSH;
      this.phase = { kind: "walking", rushing: true };
    }
  }
}
