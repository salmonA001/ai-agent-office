/**
 * Walking routes for agents. Agents follow straight segments between hand-placed waypoints
 * that run through free floor (aisles, the corridor, doorways), so they never walk through walls.
 * Coordinates are world metres on the floor plane: [x, z]. Must match OfficeFloor.tsx.
 */

export type P2 = [number, number];

const NODES: Record<string, P2> = {
  // open workspace: front aisle along the corridor partition, through its three gaps
  W1: [-5.1, 1.2],
  W0: [0, 1.2],
  W2: [5.1, 1.2],
  W3: [9.5, 1.2],
  W4: [13.88, 1.2],
  // corridor
  C3: [-5.1, 0.3],
  C2: [-3.45, 0.3],
  C4: [0.75, 0.3],
  C5: [3.85, 0.3],
  C6: [5.1, 0.3],
  CG: [10.1, 0.3],
  C8: [13.88, 0.3],
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
  // game room (open to the corridor) and server room (through its door)
  G1: [10.1, -1.0],
  S0: [13.85, -1.0],
};

const FRONT_AISLE = ["W1", "W0", "W2", "W3", "W4"];

const EDGES: [string, string][] = [
  ["W1", "W0"],
  ["W0", "W2"],
  ["W2", "W3"],
  ["W3", "W4"],
  ["W1", "C3"],
  ["W2", "C6"],
  ["W4", "C8"],
  ["C3", "C2"],
  ["C2", "C4"],
  ["C4", "C5"],
  ["C5", "C6"],
  ["C6", "CG"],
  ["CG", "C8"],
  ["C2", "M0"],
  ["M0", "M1"],
  ["M1", "M2"],
  ["C4", "K0"],
  ["K0", "K1"],
  ["K1", "K2"],
  ["C5", "L0"],
  ["L0", "L1"],
  ["L1", "L4"],
  ["CG", "G1"],
  ["C8", "S0"],
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

const spot = (
  id: string,
  at: P2,
  node: string,
  approach: P2[],
  face: number,
  seat: number,
  activity: Activity,
  say: string,
  where: string,
  emoji: string[],
): Spot => ({ id, at, node, approach, face, seat, activity, say, where, emoji });

/** Places idle agents wander to on their own. */
export const SPOTS: Spot[] = [
  // workspace, west
  spot("printer", [-6.9, 1.6], "W1", [], -PI / 2, 0, "look", "Printing stuff", "at the printer", ["🖨️", "📄"]),
  spot("window-w", [-7.3, 3.0], "W1", [[-6.9, 1.5]], -PI / 2, 0, "look", "Nice view", "by the window", ["☀️", "✨", "🌿"]),
  spot("pong-a", [-6.0, 1.95], "W1", [], 0, 0, "play", "Ping-pong!", "at the ping-pong table", ["🏓", "😆", "💪"]),
  spot("pong-b", [-6.0, 5.45], "W1", [[-4.6, 1.6], [-4.6, 5.55]], PI, 0, "play", "Your serve", "at the ping-pong table", ["🏓", "😆", "💪"]),
  // workspace, east
  spot("cooler", [14.95, 1.55], "W4", [], PI / 2, 0, "sip", "Hydrating", "at the water cooler", ["💧", "😌"]),
  spot("beanbag", [15.4, 2.6], "W4", [[15.3, 1.95]], -PI / 2, 0.32, "rest", "Comfy…", "on a beanbag", ["💤", "😌"]),
  spot("round-table", [14.3, 4.45], "W4", [[12.95, 2.0], [12.95, 5.35], [14.3, 5.35]], PI, 0.46, "rest", "Thinking", "at the breakout table", ["🤔", "💭"]),
  // corridor
  spot("corridor", [-1.5, 0.3], "C4", [], PI / 2, 0, "look", "Stretching legs", "in the corridor", ["🚶", "🎵"]),
  // meeting room
  spot("whiteboard", [-7.15, -4.4], "M2", [], -PI / 2, 0, "look", "Doodling ideas", "at the meeting-room whiteboard", ["✏️", "💡"]),
  spot("meeting-seat", [-5.4, -2.25], "M1", [], PI, 0.5, "rest", "Quiet room", "in the meeting room", ["📖", "😌"]),
  // kitchen
  spot("sink", [-1.5, -4.75], "K2", [], PI, 0, "look", "Washing my mug", "at the kitchen sink", ["🫧", "🧽"]),
  spot("coffee", [1.15, -4.8], "K1", [], PI, 0, "sip", "Coffee time", "at the coffee machine", ["☕", "😋"]),
  spot("fridge", [2.35, -4.75], "K1", [], PI, 0, "look", "Snack run", "at the fridge", ["🍎", "🧃"]),
  spot("stool", [-0.6, -2.6], "K0", [[-0.6, -2.0]], PI, 0.72, "sip", "Tea break", "at the kitchen island", ["🍵", "😊"]),
  spot("dining-a", [-1.6, -0.75], "K0", [[-1.6, -0.3]], PI, 0.46, "sip", "Lunch!", "at the dining table", ["🍱", "😋"]),
  spot("dining-b", [1.8, -0.75], "K0", [[1.8, -0.3]], PI, 0.46, "rest", "Lunch!", "at the dining table", ["🥪", "😋"]),
  // lounge
  spot("sofa-a", [5.2, -4.3], "L1", [[4.7, -3.65], [5.2, -3.65]], 0, 0.46, "rest", "Power nap", "on the lounge sofa", ["💤", "🛋️"]),
  spot("sofa-b", [6.0, -4.3], "L1", [[4.7, -3.65], [6.0, -3.65]], 0, 0.46, "rest", "Chilling", "on the lounge sofa", ["😌", "🎧"]),
  spot("vending", [6.65, -4.95], "L4", [], 2.3, 0, "look", "Hmm, which snack?", "at the vending machine", ["🍫", "🥤", "🤔"]),
  // game room
  spot("arcade-1", [9.0, -4.85], "G1", [[9.15, -1.6], [9.15, -4.3]], PI, 0, "play", "High score!", "at the arcade machine", ["🕹️", "👾", "😆"]),
  spot("arcade-2", [10.05, -4.85], "G1", [[11.05, -2.3], [11.05, -4.3]], PI, 0, "play", "One more go", "at the arcade machine", ["🕹️", "👾", "🎮"]),
  spot("foos-a", [9.15, -3.2], "G1", [[9.15, -1.6]], PI / 2, 0, "play", "Foosball!", "at the foosball table", ["⚽", "😆"]),
  spot("foos-b", [11.05, -3.2], "G1", [[11.05, -2.3]], -PI / 2, 0, "play", "Goal!", "at the foosball table", ["⚽", "🙌"]),
  spot("game-beanbag", [11.5, -1.4], "G1", [], -2.48, 0.32, "rest", "Gaming break", "in the game room", ["🎮", "😌"]),
  // server room
  spot("server-check", [14.0, -4.55], "S0", [], PI, 0, "look", "Checking the servers", "in the server room", ["🖥️", "🔧"]),
  spot("server-2", [15.0, -4.55], "S0", [[15.0, -1.6]], PI, 0, "look", "Cables everywhere", "in the server room", ["🔌", "🤓"]),
];

/** Places only used by office events (gatherings, chores). */
export const EVENT_SPOTS = {
  pizza: [
    spot("pz-1", [-1.9, -4.5], "K2", [], 0, 0, "sip", "Pizza!", "at the pizza party in the kitchen", ["🍕", "😋"]),
    spot("pz-2", [-1.0, -4.5], "K2", [], 0, 0, "sip", "Pizza!", "at the pizza party in the kitchen", ["🍕", "😋"]),
    spot("pz-3", [-0.1, -4.5], "K1", [], 0, 0, "sip", "Extra cheese", "at the pizza party in the kitchen", ["🍕", "🧀"]),
    spot("pz-4", [0.75, -2.0], "K0", [], -PI / 2, 0, "sip", "Pizza!", "at the pizza party in the kitchen", ["🍕", "😋"]),
    spot("pz-5", [2.6, -0.45], "K0", [[0.75, -0.3], [2.6, -0.3]], PI, 0, "sip", "Yum", "at the pizza party in the kitchen", ["🍕", "🥤"]),
    spot("pz-6", [-2.3, -0.45], "K0", [[0.75, -0.3], [-2.3, -0.3]], PI, 0, "sip", "Pizza!", "at the pizza party in the kitchen", ["🍕", "😋"]),
  ],
  drill: [-7.3, -6.3, -4.2, -2.4, -1.4, -0.4, 1.8, 2.8, 4.45, 6.3, 7.3, 8.3, 9.2, 11.2, 12.2, 15.2].map((x, i) => {
    const node = x < -4.3 ? "C3" : x < -1.6 ? "C2" : x < 2.3 ? "C4" : x < 4.5 ? "C5" : x < 7.6 ? "C6" : x < 12 ? "CG" : "C8";
    return spot(`drill-${i}`, [x, 0.3], node, [], 0, 0, "look", "Fire drill!", "at the corridor assembly point", ["🚨", "😮", "🧯"]);
  }),
  party: [
    spot("party-1", [4.7, -2.3], "L1", [], PI / 2, 0, "play", "Happy birthday!", "at the birthday party in the lounge", ["🎂", "🎉"]),
    spot("party-2", [5.5, -1.95], "L1", [], PI, 0, "play", "Happy birthday!", "at the birthday party in the lounge", ["🎉", "🥳"]),
    spot("party-3", [6.3, -1.95], "L4", [], PI, 0, "play", "Cake time!", "at the birthday party in the lounge", ["🍰", "🎉"]),
    spot("party-4", [6.6, -2.5], "L4", [], -1.99, 0, "play", "Woohoo!", "at the birthday party in the lounge", ["🥳", "🎈"]),
    spot("armchair-1", [3.9, -2.4], "L1", [[4.7, -2.4]], PI / 2, 0.4, "rest", "Happy birthday!", "at the birthday party in the lounge", ["🎈", "😊"]),
    spot("armchair-2", [3.9, -3.6], "L1", [[4.7, -3.6]], PI / 2, 0.4, "rest", "Cake time!", "at the birthday party in the lounge", ["🍰", "😊"]),
  ],
  plants: [
    spot("plant-w", [-6.95, 5.5], "W1", [[-4.6, 1.6], [-4.6, 5.55]], -PI / 2, 0, "look", "Watering plants", "watering the plants", ["💧", "🌱"]),
    spot("plant-e", [14.9, 5.5], "W4", [[12.95, 2.0], [12.95, 5.55]], PI / 2, 0, "look", "Watering plants", "watering the plants", ["💧", "🌿"]),
    spot("plant-l", [3.95, -5.0], "L1", [[4.7, -3.65], [4.45, -4.5]], -2.36, 0, "look", "Watering plants", "watering the plants", ["💧", "🌱"]),
    spot("plant-g", [11.35, -4.95], "G1", [[11.05, -2.3], [11.05, -4.3]], 2.51, 0, "look", "Watering plants", "watering the plants", ["💧", "🌿"]),
  ],
};

export const spotById = (id: string) =>
  [...SPOTS, ...Object.values(EVENT_SPOTS).flat()].find((s) => s.id === id)!;

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const ADJ: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}

/** Shortest node path (Dijkstra over the small waypoint graph). */
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
  const z = NODES.W1[1];
  const points: P2[] = [h.seat, [h.seat[0], h.aisleZ], [h.sideX, h.aisleZ], [h.sideX, z]];
  const node = FRONT_AISLE.reduce((a, b) => (Math.abs(NODES[b][0] - h.sideX) < Math.abs(NODES[a][0] - h.sideX) ? b : a));
  return { points, node };
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

// ---------- Who is where ----------

/** Spots currently claimed, so two agents don't sit in the same chair. */
const taken = new Map<string, string>();
/** Spots someone is physically at (not just heading to), e.g. for the ping-pong rally. */
const present = new Map<string, string>();

export function claimRandomSpot(agentId: string, avoid?: string): Spot | null {
  const free = SPOTS.filter((s) => s.id !== avoid && (!taken.has(s.id) || taken.get(s.id) === agentId));
  if (!free.length) return null;
  const s = free[Math.floor(Math.random() * free.length)];
  claimSpot(agentId, s);
  return s;
}

function claimSpot(agentId: string, s: Spot) {
  releaseSpot(agentId);
  taken.set(s.id, agentId);
}

export function releaseSpot(agentId: string) {
  for (const [id, who] of taken) if (who === agentId) taken.delete(id);
  for (const [id, who] of present) if (who === agentId) present.delete(id);
}

export function isPresent(spotId: string) {
  return present.has(spotId);
}

// ---------- Per-agent state machine (plain TS so it can be simulated without a browser) ----------

export type WalkPhase = { kind: "seated" } | { kind: "walking"; rushing: boolean } | { kind: "spot"; spot: Spot };

export const STROLL = 0.9;
export const HURRY = 1.6;
export const RUSH = 4;

/**
 * Seated at the desk until idle for a while, then strolls between spots, sometimes heading home.
 * Office events can give it orders (a list of spots to visit). The moment the agent is busy with
 * real work it drops everything and rushes back to its chair, retracing its current route.
 */
export class Wanderer {
  x: number;
  z: number;
  y: number;
  yaw = 0;
  phase: WalkPhase = { kind: "seated" };
  readonly id: string;
  readonly seatY: number;
  private mode: "seated" | "out" | "spot" | "home" = "seated";
  private origin: Anchor;
  private path: P2[] = [];
  private seg = 0;
  private speed = STROLL;
  private spot: Spot | null = null;
  private timer: number;
  private busy = false;
  private canWander = true;
  private orders: Spot[] = [];
  private ordered = false;
  private dwellEach = 4;
  /** the current/last trip was an order from an office event */
  private onOrder = false;

  constructor(id: string, home: Home, seatY: number, firstWait: number) {
    this.id = id;
    this.seatY = seatY;
    this.timer = firstWait;
    [this.x, this.z] = home.seat;
    this.y = seatY;
    this.origin = { home };
  }

  /** Free to take part in office events. */
  isIdle() {
    return !this.busy && this.canWander;
  }

  /** Visit these spots in order (dwelling `dwellEach` seconds at all but the last), then wait for release(). */
  command(spots: Spot[], dwellEach = 4) {
    if (!this.isIdle() || !spots.length) return false;
    this.orders = [...spots];
    this.ordered = true;
    this.dwellEach = dwellEach;
    return true;
  }

  /** The event is over: go back to normal wandering soon. */
  release() {
    this.ordered = false;
    this.orders = [];
    if (this.mode === "spot") this.timer = Math.min(this.timer, 1 + Math.random() * 3);
  }

  /** Advance one frame. Returns true when `phase` changed (the caller re-renders then). */
  update(dt: number, home: Home, busy: boolean, canWander: boolean): boolean {
    const before = this.phase;
    dt = Math.min(dt, 0.1);
    this.busy = busy;
    this.canWander = canWander;
    if ((busy || !canWander) && this.mode !== "seated") {
      this.orders = [];
      this.ordered = false;
      this.goHome(home);
    }

    let targetY = 0;
    let targetYaw = this.yaw;
    if (this.mode === "seated") {
      [this.x, this.z] = home.seat;
      targetY = this.seatY;
      targetYaw = 0;
      if (busy || !canWander) {
        this.orders = [];
        this.ordered = false;
        this.timer = Math.max(this.timer, 4 + Math.random() * 4);
      } else if (this.orders.length) {
        this.takeOrder({ home });
      } else if (!this.ordered && (this.timer -= dt) <= 0) {
        const s = claimRandomSpot(this.id);
        if (s) {
          this.spot = s;
          this.start({ home }, { spot: s }, STROLL, "out");
        } else this.timer = 6;
      }
    } else if (this.mode === "spot" && this.spot) {
      targetY = this.spot.seat;
      targetYaw = this.spot.face;
      this.timer -= dt;
      // an office event sent someone else to this spot: move on
      if (!this.ordered && taken.get(this.spot.id) !== this.id) this.timer = Math.min(this.timer, 0);
      if (this.orders.length) {
        // new orders interrupt a normal hangout at once; along an ordered route, wait out each stop
        if (!this.onOrder || this.timer <= 0) this.takeOrder({ spot: this.spot });
      } else if (!this.ordered && this.timer <= 0) {
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
          if (taken.get(this.spot.id) === this.id) present.set(this.spot.id, this.id);
          this.mode = "spot";
          // under orders: short stops along a route, then stay until the event ends
          this.timer = this.ordered ? (this.orders.length ? this.dwellEach : 1e9) : 8 + Math.random() * 10;
          this.phase = { kind: "spot", spot: this.spot };
        } else {
          this.mode = "seated";
          this.spot = null;
          this.timer = 6 + Math.random() * 8;
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
    walkers.delete(this.id);
  }

  private takeOrder(from: Anchor) {
    const next = this.orders.shift()!;
    claimSpot(this.id, next);
    this.spot = next;
    this.start(from, { spot: next }, HURRY, "out");
    this.onOrder = true;
  }

  private start(from: Anchor, to: Anchor, speed: number, mode: "out" | "home") {
    if ("spot" in from) present.delete(from.spot.id);
    this.onOrder = false;
    this.path = route(from, to);
    this.seg = 0;
    this.origin = from;
    this.speed = speed;
    this.mode = mode;
    this.phase = { kind: "walking", rushing: speed >= RUSH };
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

/** Every agent currently in the office, so office events can give them orders. */
export const walkers = new Map<string, Wanderer>();

export function registerWalker(w: Wanderer) {
  walkers.set(w.id, w);
}
