/**
 * Walking routes for agents. Agents follow straight segments between hand-placed waypoints
 * that run through free floor (aisles, the corridor, doorways), so they never walk through walls.
 * Coordinates are world metres on the floor plane: [x, z]. Must match OfficeFloor.tsx.
 */

import type { ZoneId } from "./camera-focus";

export type P2 = [number, number];

// ---------- Desk grid in the open workspace ----------

/** Chibi scale: workers and their desks are drawn larger than the room furniture so they read at a glance. */
export const DESK_SCALE = 1.35;
/** Chair offset from the desk centre, in world metres. */
export const CHAIR_Z = 0.62 * DESK_SCALE;
/** How far behind the seat the walkway between desk rows runs. */
const AISLE_BEHIND = 0.85;

/** Six desks per row, four rows, all facing the corridor so every screen faces the camera. */
export const DESK_GRID = { cols: 6, rows: 4, x: 4.7, spacing: 2.3, z0: 2.45, pitch: 2.95 } as const;
export const MAX_DESKS = DESK_GRID.cols * DESK_GRID.rows;

/** Walkways around the desk block. */
export const AISLE = { west: -2.8, east: 12.2, front: 1.4 } as const;

export type DeskSlot = { index: number; row: number; col: number; x: number; z: number; seat: P2; aisleZ: number };

export function deskSlot(index: number): DeskSlot {
  const { cols, x, spacing, z0, pitch } = DESK_GRID;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const dx = x + (col - (cols - 1) / 2) * spacing;
  const dz = z0 + row * pitch;
  const seat: P2 = [dx, dz + CHAIR_Z];
  return { index, row, col, x: dx, z: dz, seat, aisleZ: seat[1] + AISLE_BEHIND };
}

const rowAisle = (row: number) => deskSlot(row * DESK_GRID.cols).aisleZ;

// ---------- Waypoint graph ----------

const R = [0, 1, 2, 3].map(rowAisle);

const NODES: Record<string, P2> = {
  // corridor, with the elevator at its west end
  EL: [-6.9, 0.3],
  C3: [-5.1, 0.3],
  C2: [-3.45, 0.3],
  CW: [AISLE.west, 0.3],
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
  // workspace: front aisle along the corridor partition, through its four gaps
  W1: [-5.1, AISLE.front],
  FW: [AISLE.west, AISLE.front],
  F5: [5.1, AISLE.front],
  FE: [AISLE.east, AISLE.front],
  W4: [13.88, AISLE.front],
  // west and east aisles, where each walkway behind a desk row starts
  RW0: [AISLE.west, R[0]],
  RW1: [AISLE.west, R[1]],
  RW2: [AISLE.west, R[2]],
  RW3: [AISLE.west, R[3]],
  RE0: [AISLE.east, R[0]],
  RE1: [AISLE.east, R[1]],
  RE2: [AISLE.east, R[2]],
  RE3: [AISLE.east, R[3]],
  // café stops along the last walkway
  T1: [2.6, R[3]],
  T2: [5.4, R[3]],
  T3: [8.2, R[3]],
  // west zones: library, wellness corner, phone booths
  LB: [-4.1, 4.4],
  WN: [-4.1, 7.6],
  PB: [-4.6, R[3]],
  // east wing: lobby (the corridor runs on into it), town hall, garden
  CE: [16.6, 0.3],
  LO1: [17.5, 0.3],
  LO2: [21.5, 0.3],
  LO3: [24.15, 0.3],
  // ----- the roof (a separate level, reached by the elevator) -----
  RL: [-5.0, 0.3],
  RN: [-5.0, 3.0],
  RW: [-5.0, 13.0],
  RG: [2.0, 13.0],
  RS: [10.0, 13.0],
  RT1: [13.5, 16.4],
  RT: [18.0, 17.2],
  RE: [24.0, 17.2],
  // lobby café: in front of the counter, and between the tables
  CF: [20.85, -3.0],
  CT: [18.4, -1.2],
  TH1: [17.5, 2.9],
  TA1: [17.5, 3.7],
  TA2: [17.5, 5.1],
  TA3: [17.5, 6.5],
  GD0: [17.5, 9.6],
  GE: [17.0, 13.6],
  GM: [19.8, 13.6],
  GS1: [21.6, 13.6],
  GS2: [22.8, 13.6],
  // south wing: a corridor along its rooms, reached from the café and the east aisle
  TX: [6.8, R[3]],
  SX: [6.8, 16.7],
  SC: [12.2, 16.7],
  FA: [-4.0, 16.7],
  FB: [4.5, 16.7],
  FD: [21.5, 16.7],
  // fitness & meditation studio
  FA1: [-4.0, 20.3],
  // deep focus pods
  FB1: [4.5, 19.2],
  FB2: [4.5, 22.4],
  // creative labs
  FC1: [13.6, 18.3],
  FC2: [13.6, 22.4],
  // strategy hub
  FD1: [21.5, 18.6],
  FD2: [18.2, 18.6],
  FD3: [18.2, 22.6],
  FD5: [24.8, 18.6],
  FD6: [24.8, 22.6],
};

const EDGES: [string, string][] = [
  ["EL", "C3"],
  ["C3", "C2"],
  ["C2", "CW"],
  ["CW", "C4"],
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
  // partition gaps
  ["W1", "C3"],
  ["FW", "CW"],
  ["F5", "C6"],
  ["W4", "C8"],
  // front aisle
  ["W1", "FW"],
  ["FW", "F5"],
  ["F5", "FE"],
  ["FE", "W4"],
  // side aisles
  ["FW", "RW0"],
  ["RW0", "RW1"],
  ["RW1", "RW2"],
  ["RW2", "RW3"],
  ["FE", "RE0"],
  ["RE0", "RE1"],
  ["RE1", "RE2"],
  ["RE2", "RE3"],
  // walkways behind the desk rows
  ["RW0", "RE0"],
  ["RW1", "RE1"],
  ["RW2", "RE2"],
  ["RW3", "T1"],
  ["T1", "T2"],
  ["T2", "TX"],
  ["TX", "T3"],
  ["T3", "RE3"],
  // zones
  ["RW0", "LB"],
  ["RW1", "WN"],
  ["RW3", "PB"],
  // east wing
  ["C8", "CE"],
  ["CE", "LO1"],
  ["LO1", "LO2"],
  ["LO2", "LO3"],
  ["LO2", "CF"],
  // roof
  ["RL", "RN"],
  ["RN", "RW"],
  ["RW", "RG"],
  ["RG", "RS"],
  ["RS", "RT1"],
  ["RT1", "RT"],
  ["RT", "RE"],
  ["LO1", "CT"],
  ["LO1", "TH1"],
  ["TH1", "TA1"],
  ["TA1", "TA2"],
  ["TA2", "TA3"],
  ["TA3", "GD0"],
  ["GD0", "GE"],
  ["GE", "RE3"],
  ["GE", "GM"],
  ["GM", "GS1"],
  ["GS1", "GS2"],
  // south wing
  ["TX", "SX"],
  ["RE3", "SC"],
  ["FA", "FB"],
  ["FB", "SX"],
  ["SX", "SC"],
  ["SC", "FD"],
  ["FA", "FA1"],
  ["FB", "FB1"],
  ["FB1", "FB2"],
  ["SC", "FC1"],
  ["FC1", "FC2"],
  ["FD", "FD1"],
  ["FD1", "FD2"],
  ["FD2", "FD3"],
  ["FD1", "FD5"],
  ["FD5", "FD6"],
  ["FD3", "FD6"],
];

// ---------- Places to go ----------

/** How an agent looks while at a spot (Mochi plays a matching animation). */
export type Activity =
  | "look"
  | "sip"
  | "play"
  | "rest"
  | "read"
  | "call"
  | "yoga"
  | "run"
  | "chat"
  | "talk"
  | "nap"
  | "type"
  | "draw"
  | "lift"
  | "meditate"
  | "game";

/** What kind of break a spot is; the user can switch whole categories off. */
export type SpotCat = "food" | "games" | "rest" | "reading" | "exercise" | "chat" | "calls" | "nature" | "ideas" | "focus";
export const SPOT_CATS: SpotCat[] = ["food", "chat", "games", "rest", "reading", "exercise", "focus", "calls", "nature", "ideas"];

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
  cat: SpotCat;
  say: string;
  /** where the agent is, for the explanation panel */
  where: string;
  /** emotes that float up while hanging out here */
  emoji: string[];
  /** the seat opposite, for chats */
  pair?: string;
  /** decoration that has to be switched on for this spot to exist */
  needs?: string;
  /** hands the agent something to carry (a parcel, a coffee), or takes it back */
  gives?: string;
  takes?: boolean;
  /** seconds to stay (default: a normal break of 10-24 s) */
  dwell?: number;
  /** where to go next, in a little routine (queue -> order -> pick up -> sit down) */
  next?: string[];
  /** on the roof (reached by the elevator) */
  roof?: boolean;
};

/** Height of the roof deck above the ground floor. */
export const ROOF_Y = 2.72;

const PI = Math.PI;

type SpotInit = Omit<Spot, "approach" | "seat"> & { approach?: P2[]; seat?: number };
const spot = (s: SpotInit): Spot => ({ approach: [], seat: 0, ...s });

/** The town hall's 3 rows x 5 seats, facing the stage. */
const TOWN_HALL_SEATS: Spot[] = [4.3, 5.7, 7.1].flatMap((z, row) =>
  [18.6, 19.8, 21.0, 22.2, 23.4].map((x, col) =>
    spot({
      id: `th-${row}-${col}`,
      at: [x, z],
      node: `TA${row + 1}`,
      approach: [[x, z - 0.6]],
      face: PI,
      seat: 0.46,
      activity: "rest",
      cat: "ideas",
      say: "Watching a tech talk",
      where: "in the town hall",
      emoji: ["🎤", "💡", "👏"],
    }),
  ),
);

/** Strategy hub: 4 seats on each long side of the table and one at each end. */
const HUB_SEATS: Spot[] = [
  ...[20.0, 21.0, 22.0, 23.0].map((x, i) =>
    spot({ id: `hub-n${i}`, at: [x, 19.55], node: "FD1", approach: [[x, 18.6]], face: 0, seat: 0.5, activity: "type", cat: "ideas", say: "Prepping the roadmap", where: "in the strategy hub", emoji: ["📊", "🗺️"] }),
  ),
  ...[20.0, 21.0, 22.0, 23.0].map((x, i) =>
    spot({ id: `hub-s${i}`, at: [x, 21.65], node: "FD3", approach: [[x, 22.6]], face: PI, seat: 0.5, activity: "type", cat: "ideas", say: "Crunching the numbers", where: "in the strategy hub", emoji: ["📈", "🧮"] }),
  ),
  spot({ id: "hub-w", at: [19.0, 20.6], node: "FD2", approach: [[18.2, 20.6]], face: PI / 2, seat: 0.5, activity: "type", cat: "ideas", say: "Prepping the roadmap", where: "in the strategy hub", emoji: ["📊", "🗺️"] }),
  spot({ id: "hub-e", at: [24.0, 20.6], node: "FD5", approach: [[24.8, 20.6]], face: -PI / 2, seat: 0.5, activity: "type", cat: "ideas", say: "Crunching the numbers", where: "in the strategy hub", emoji: ["📈", "🧮"] }),
];

/** Café seats you can take a coffee to. */
export const CAFE_SEATS = ["cafe-t1a", "cafe-t1b", "cafe-t2a", "cafe-t2b", "waiting-1", "waiting-2"];

/** The lobby café: queue, order from Robo, pick up the cup, then sit down with it (or take it back to the desk). */
const CAFE_SPOTS: Spot[] = [
  spot({ id: "cafe-queue", at: [20.4, -2.95], node: "CF", face: PI, activity: "look", cat: "food", say: "Waiting in line", where: "in the café queue", emoji: ["☕", "⏳"], dwell: 3, next: ["cafe-order"] }),
  spot({ id: "cafe-order", at: [20.4, -3.75], node: "CF", face: PI, activity: "talk", cat: "food", say: "One oat latte, please!", where: "at the café counter", emoji: ["☕", "🤖"], dwell: 4, next: ["cafe-pickup"] }),
  spot({ id: "cafe-pickup", at: [21.35, -3.75], node: "CF", face: PI, activity: "look", cat: "food", say: "Thanks, Robo!", where: "at the café pickup", emoji: ["☕", "😋"], dwell: 3, gives: "cup", next: CAFE_SEATS }),
  spot({ id: "cafe-pastry", at: [18.0, -3.75], node: "CF", face: PI, activity: "look", cat: "food", say: "Ooh, croissants!", where: "at the pastry case", emoji: ["🥐", "😍"], dwell: 5, next: ["cafe-queue"] }),
  spot({ id: "cafe-t1a", at: [16.75, -2.3], node: "CT", approach: [[16.75, -1.2]], face: PI / 2, seat: 0.45, activity: "sip", cat: "food", say: "Latte art!", where: "at a café table", emoji: ["☕", "🎨"] }),
  spot({ id: "cafe-t1b", at: [18.05, -2.3], node: "CT", face: -PI / 2, seat: 0.45, activity: "sip", cat: "food", say: "Best coffee in town", where: "at a café table", emoji: ["☕", "😌"] }),
  spot({ id: "cafe-t2a", at: [18.75, -2.3], node: "CT", face: PI / 2, seat: 0.45, activity: "sip", cat: "food", say: "Coffee break", where: "at a café table", emoji: ["☕", "🥐"] }),
  spot({ id: "cafe-t2b", at: [20.05, -2.3], node: "CT", approach: [[20.05, -1.2]], face: -PI / 2, seat: 0.45, activity: "sip", cat: "food", say: "Mmm, cold brew", where: "at a café table", emoji: ["🧋", "😋"] }),
];

/** The elevator, on each level: walk in, ride, walk out on the other floor. */
export const LIFT_GROUND: Spot = spot({ id: "lift-ground", at: [-7.4, 0.3], node: "EL", face: -PI / 2, activity: "look", cat: "rest", say: "", where: "in the elevator", emoji: [] });
export const LIFT_ROOF: Spot = spot({ id: "lift-roof", at: [-5.9, 0.3], node: "RL", face: -PI / 2, activity: "look", cat: "rest", say: "", where: "in the elevator", emoji: [], roof: true });

const onRoof = (s: SpotInit): Spot => spot({ ...s, roof: true });

/** The rooftop: a sky deck with a fire pit, loungers, a BBQ and a telescope; a garden; views over the railings. */
export const ROOF_SPOTS: Spot[] = [
  onRoof({ id: "roof-view-1", at: [11.0, 23.3], node: "RT1", approach: [[11.0, 18.0]], face: 0, activity: "look", cat: "nature", say: "Fresh air!", where: "on the roof", emoji: ["🌤️", "😌"] }),
  onRoof({ id: "roof-view-2", at: [16.5, 23.3], node: "RT", approach: [[16.5, 18.0]], face: 0, activity: "look", cat: "nature", say: "What a view!", where: "on the roof", emoji: ["🏙️", "✨"] }),
  onRoof({ id: "roof-view-3", at: [25.3, 20.6], node: "RE", approach: [[24.0, 20.6]], face: PI / 2, activity: "look", cat: "nature", say: "Breathe in that sky", where: "on the roof", emoji: ["☁️", "🕊️"] }),
  onRoof({ id: "roof-koi", at: [21.0, 16.6], node: "RT", face: PI, activity: "look", cat: "nature", say: "I can see the koi!", where: "at the courtyard railing", emoji: ["🐟", "👀"] }),
  onRoof({ id: "roof-courtyard", at: [15.4, 12.0], node: "RS", face: PI / 2, activity: "look", cat: "nature", say: "The garden looks tiny", where: "at the courtyard railing", emoji: ["🌳", "😮"] }),
  onRoof({ id: "roof-telescope", at: [24.8, 22.8], node: "RE", approach: [[24.0, 21.8]], face: PI / 4, activity: "look", cat: "nature", say: "Spotting planes", where: "at the roof telescope", emoji: ["🔭", "✈️"] }),
  onRoof({ id: "roof-lounger-1", at: [12.0, 20.0], node: "RT1", approach: [[12.0, 18.4]], face: 0, seat: 0.3, activity: "nap", cat: "rest", say: "Sunbathing on the roof", where: "on a roof lounger", emoji: ["😎", "☀️"] }),
  onRoof({ id: "roof-lounger-2", at: [13.4, 20.0], node: "RT1", approach: [[13.4, 18.4]], face: 0, seat: 0.3, activity: "rest", cat: "rest", say: "Cloud watching", where: "on a roof lounger", emoji: ["☁️", "😌"] }),
  onRoof({ id: "roof-fire-a", at: [18.4, 20.5], node: "RT", approach: [[18.4, 18.0]], face: PI / 2, seat: 0.42, activity: "chat", cat: "chat", say: "Roof chat!", where: "by the fire pit", emoji: ["🔥", "💬"], pair: "roof-fire-b" }),
  onRoof({ id: "roof-fire-b", at: [20.6, 20.5], node: "RT", approach: [[20.6, 18.0]], face: -PI / 2, seat: 0.42, activity: "chat", cat: "chat", say: "Love it up here", where: "by the fire pit", emoji: ["🔥", "😄"], pair: "roof-fire-a" }),
  onRoof({ id: "roof-bbq", at: [23.9, 19.0], node: "RE", face: PI / 2, activity: "look", cat: "food", say: "Grilling some corn", where: "at the roof BBQ", emoji: ["🌽", "🔥"] }),
  onRoof({ id: "roof-herbs", at: [-1.0, 15.0], node: "RW", face: 0, activity: "look", cat: "nature", say: "Picking fresh basil", where: "in the roof garden", emoji: ["🌿", "😋"] }),
  onRoof({ id: "roof-veg", at: [3.0, 15.0], node: "RG", face: 0, activity: "look", cat: "nature", say: "Watering the tomatoes", where: "in the roof garden", emoji: ["🍅", "💧"] }),
  onRoof({ id: "roof-flowers", at: [7.0, 15.0], node: "RG", face: 0, activity: "look", cat: "nature", say: "Smell these flowers", where: "in the roof garden", emoji: ["🌸", "🐝"] }),
  onRoof({ id: "roof-bench-1", at: [-4.0, 23.0], node: "RW", approach: [[-4.0, 14.0]], face: 0, seat: 0.45, activity: "rest", cat: "rest", say: "Quiet time up here", where: "on a roof bench", emoji: ["🌤️", "😌"] }),
  onRoof({ id: "roof-bench-2", at: [1.0, 23.0], node: "RG", approach: [[1.0, 14.0]], face: 0, seat: 0.45, activity: "read", cat: "reading", say: "Reading in the sun", where: "on a roof bench", emoji: ["📖", "☀️"] }),
  onRoof({ id: "roof-solar", at: [-3.4, 3.0], node: "RN", face: PI / 2, activity: "look", cat: "ideas", say: "Checking the solar panels", where: "on the roof", emoji: ["☀️", "🔋"] }),
];

/** Places idle agents wander to on their own. */
export const SPOTS: Spot[] = [
  // ----- north rooms -----
  spot({ id: "corridor", at: [-1.5, 0.3], node: "C4", face: PI / 2, activity: "look", cat: "exercise", say: "Stretching legs", where: "in the corridor", emoji: ["🚶", "🎵"] }),
  spot({ id: "whiteboard", at: [-7.15, -4.4], node: "M2", face: -PI / 2, activity: "look", cat: "ideas", say: "Doodling ideas", where: "at the meeting-room whiteboard", emoji: ["✏️", "💡"] }),
  spot({ id: "meeting-seat", at: [-5.4, -2.25], node: "M1", face: PI, seat: 0.5, activity: "read", cat: "reading", say: "Quiet room", where: "in the meeting room", emoji: ["📖", "😌"] }),
  spot({ id: "sink", at: [-1.5, -4.75], node: "K2", face: PI, activity: "look", cat: "food", say: "Washing my mug", where: "at the kitchen sink", emoji: ["🫧", "🧽"] }),
  spot({ id: "coffee", at: [1.15, -4.8], node: "K1", face: PI, activity: "sip", cat: "food", say: "Coffee time", where: "at the coffee machine", emoji: ["☕", "😋"] }),
  spot({ id: "fridge", at: [2.35, -4.75], node: "K1", face: PI, activity: "look", cat: "food", say: "Snack run", where: "at the fridge", emoji: ["🍎", "🧃"] }),
  spot({ id: "stool", at: [-0.6, -2.6], node: "K0", approach: [[-0.6, -2.0]], face: PI, seat: 0.72, activity: "sip", cat: "food", say: "Tea break", where: "at the kitchen island", emoji: ["🍵", "😊"] }),
  spot({ id: "dining-a", at: [-1.6, -0.75], node: "K0", approach: [[-1.6, -0.3]], face: PI, seat: 0.46, activity: "sip", cat: "food", say: "Lunch!", where: "at the dining table", emoji: ["🍱", "😋"] }),
  spot({ id: "dining-b", at: [1.8, -0.75], node: "K0", approach: [[1.8, -0.3]], face: PI, seat: 0.46, activity: "sip", cat: "food", say: "Lunch!", where: "at the dining table", emoji: ["🥪", "😋"] }),
  spot({ id: "sofa-a", at: [5.2, -4.3], node: "L1", approach: [[4.7, -3.65], [5.2, -3.65]], face: 0, seat: 0.46, activity: "nap", cat: "rest", say: "Power nap", where: "on the lounge sofa", emoji: ["💤", "🛋️"] }),
  spot({ id: "sofa-b", at: [6.0, -4.3], node: "L1", approach: [[4.7, -3.65], [6.0, -3.65]], face: 0, seat: 0.46, activity: "rest", cat: "rest", say: "Chilling", where: "on the lounge sofa", emoji: ["😌", "🎧"] }),
  spot({ id: "vending", at: [6.65, -4.95], node: "L4", face: 2.3, activity: "look", cat: "food", say: "Hmm, which snack?", where: "at the vending machine", emoji: ["🍫", "🥤", "🤔"] }),
  spot({ id: "rig-1", at: [8.75, -4.85], node: "G1", approach: [[9.15, -1.6], [8.75, -4.3]], face: PI, seat: 0.5, activity: "game", cat: "games", say: "Duo queue!", where: "at the gaming PCs", emoji: ["🎮", "🔥", "😆"], pair: "rig-2" }),
  spot({ id: "rig-2", at: [9.95, -4.85], node: "G1", approach: [[9.15, -1.6], [9.15, -4.3], [9.95, -4.3]], face: PI, seat: 0.5, activity: "game", cat: "games", say: "GG, well played!", where: "at the gaming PCs", emoji: ["🎮", "🏆", "😎"], pair: "rig-1" }),
  spot({ id: "arcade-2", at: [10.95, -4.85], node: "G1", approach: [[11.05, -2.3], [11.05, -4.3]], face: PI, activity: "play", cat: "games", say: "One more go", where: "at the arcade machine", emoji: ["🕹️", "👾", "🎮"] }),
  spot({ id: "foos-a", at: [9.15, -3.2], node: "G1", approach: [[9.15, -1.6]], face: PI / 2, activity: "play", cat: "games", say: "Foosball!", where: "at the foosball table", emoji: ["⚽", "😆"], pair: "foos-b" }),
  spot({ id: "foos-b", at: [11.05, -3.2], node: "G1", approach: [[11.05, -2.3]], face: -PI / 2, activity: "play", cat: "games", say: "Goal!", where: "at the foosball table", emoji: ["⚽", "🙌"], pair: "foos-a" }),
  spot({ id: "game-beanbag", at: [11.5, -1.4], node: "G1", face: -2.48, seat: 0.32, activity: "rest", cat: "games", say: "Gaming break", where: "in the game room", emoji: ["🎮", "😌"] }),
  spot({ id: "server-check", at: [14.0, -4.55], node: "S0", face: PI, activity: "look", cat: "ideas", say: "Checking the servers", where: "in the server room", emoji: ["🖥️", "🔧"] }),
  spot({ id: "server-2", at: [15.0, -4.55], node: "S0", approach: [[15.0, -1.6]], face: PI, activity: "look", cat: "ideas", say: "Cables everywhere", where: "in the server room", emoji: ["🔌", "🤓"] }),
  spot({ id: "server-west", at: [13.6, -3.5], node: "S0", approach: [[13.6, -1.6]], face: -PI / 2, activity: "type", cat: "ideas", say: "Swapping a hot drive", where: "in the server room", emoji: ["💾", "🛠️"] }),

  // ----- library nook (west) -----
  spot({ id: "read-a", at: [-6.6, 3.2], node: "W1", approach: [[-6.2, 2.3]], face: PI / 2, seat: 0.42, activity: "read", cat: "reading", say: "Good book", where: "in the library armchair", emoji: ["📖", "🤓", "☕"] }),
  spot({ id: "read-b", at: [-4.8, 3.2], node: "W1", approach: [[-4.4, 2.3]], face: -PI / 2, seat: 0.42, activity: "read", cat: "reading", say: "Just one more chapter", where: "in the library armchair", emoji: ["📚", "😌"] }),
  spot({ id: "books-1", at: [-7.15, 2.25], node: "W1", approach: [[-6.3, 1.9]], face: -PI / 2, activity: "look", cat: "reading", say: "Looking for a book", where: "at the bookshelf", emoji: ["📚", "🔍"] }),
  spot({ id: "books-2", at: [-7.15, 4.1], node: "LB", approach: [[-6.4, 4.3]], face: -PI / 2, activity: "look", cat: "reading", say: "Ooh, a new one", where: "at the bookshelf", emoji: ["📕", "✨"] }),
  spot({ id: "window-w", at: [-7.4, 5.4], node: "LB", approach: [[-6.4, 5.25]], face: -PI / 2, activity: "look", cat: "nature", say: "Nice view", where: "by the window", emoji: ["☀️", "✨", "🌿"] }),

  // ----- wellness corner (west) -----
  spot({ id: "treadmill", at: [-7.15, 6.8], node: "WN", approach: [[-7.15, 7.6]], face: PI / 2, seat: 0.16, activity: "run", cat: "exercise", say: "Cardio time", where: "on the treadmill", emoji: ["🏃", "💦", "💪"] }),
  spot({ id: "yoga-1", at: [-6.7, 8.5], node: "WN", approach: [[-5.9, 8.05]], face: PI / 2, activity: "yoga", cat: "exercise", say: "Deep breaths", where: "on a yoga mat", emoji: ["🧘", "😌", "✨"] }),
  spot({ id: "yoga-2", at: [-6.7, 9.5], node: "WN", approach: [[-5.9, 10.0]], face: PI / 2, activity: "yoga", cat: "exercise", say: "Namaste", where: "on a yoga mat", emoji: ["🧘", "🌸"] }),
  spot({ id: "stretch", at: [-5.0, 6.6], node: "WN", face: PI / 2, activity: "yoga", cat: "exercise", say: "Stretch it out", where: "in the wellness corner", emoji: ["🙆", "💪"] }),

  // ----- phone booths and printer (west) -----
  spot({ id: "booth-1", at: [-7.35, 11.85], node: "PB", approach: [[-6.1, 11.85]], face: PI / 2, activity: "call", cat: "calls", say: "On a call", where: "in a phone booth", emoji: ["📞", "🗣️"] }),
  spot({ id: "booth-2", at: [-7.35, 13.55], node: "PB", approach: [[-6.1, 13.55]], face: PI / 2, activity: "call", cat: "calls", say: "Can you hear me?", where: "in a phone booth", emoji: ["📞", "😅"] }),
  spot({ id: "printer", at: [-5.0, 14.75], node: "PB", approach: [[-5.0, 14.0]], face: 0, activity: "look", cat: "ideas", say: "Printing stuff", where: "at the printer", emoji: ["🖨️", "📄"] }),

  // ----- breakout corner (east) -----
  spot({ id: "cooler", at: [14.95, 1.6], node: "W4", face: PI / 2, activity: "sip", cat: "food", say: "Hydrating", where: "at the water cooler", emoji: ["💧", "😌"] }),
  spot({ id: "beanbag", at: [15.4, 2.6], node: "W4", approach: [[15.3, 1.95]], face: -PI / 2, seat: 0.32, activity: "rest", cat: "rest", say: "Comfy…", where: "on a beanbag", emoji: ["💤", "😌"] }),
  spot({ id: "beanbag-2", at: [15.6, 4.5], node: "RE0", approach: [[12.9, 5.1], [15.6, 5.1]], face: -PI / 2, seat: 0.32, activity: "nap", cat: "rest", say: "Five more minutes", where: "on a beanbag", emoji: ["💤", "😴"] }),
  spot({ id: "rt-s", at: [14.3, 4.45], node: "RE0", approach: [[12.9, 5.1], [14.3, 5.1]], face: PI, seat: 0.46, activity: "chat", cat: "chat", say: "How's your day?", where: "at the breakout table", emoji: ["💬", "😄"], pair: "rt-w" }),
  spot({ id: "rt-w", at: [13.45, 3.6], node: "RE0", approach: [[12.8, 3.6]], face: PI / 2, seat: 0.46, activity: "chat", cat: "chat", say: "Busy, but fun!", where: "at the breakout table", emoji: ["💬", "🤣"], pair: "rt-s" }),

  // ----- ping-pong (east) -----
  spot({ id: "pong-a", at: [14.4, 6.05], node: "RE1", approach: [[13.0, 6.05]], face: 0, activity: "play", cat: "games", say: "Ping-pong!", where: "at the ping-pong table", emoji: ["🏓", "😆", "💪"], pair: "pong-b" }),
  spot({ id: "pong-b", at: [14.4, 9.65], node: "RE2", approach: [[13.0, 9.65]], face: PI, activity: "play", cat: "games", say: "Your serve", where: "at the ping-pong table", emoji: ["🏓", "😆", "💪"], pair: "pong-a" }),

  // ----- aquarium and nap corner (east) -----
  spot({ id: "aquarium", at: [14.75, 12.0], node: "RE3", approach: [[13.5, 12.0]], face: PI / 2, activity: "look", cat: "nature", say: "Look at the fish!", where: "at the aquarium", emoji: ["🐠", "🐟", "😍"], needs: "aquarium" }),
  spot({ id: "recliner-1", at: [13.5, 14.5], node: "RE3", approach: [[13.5, 13.6]], face: 0, seat: 0.38, activity: "nap", cat: "rest", say: "Recharging", where: "in a nap chair", emoji: ["💤", "😴"] }),
  spot({ id: "recliner-2", at: [14.9, 14.5], node: "RE3", approach: [[14.9, 13.6]], face: 0, seat: 0.38, activity: "nap", cat: "rest", say: "Zzz…", where: "in a nap chair", emoji: ["💤", "🌙"] }),

  // ----- café strip (south) -----
  spot({ id: "espresso", at: [-1.9, 14.6], node: "RW3", approach: [[-1.9, 13.8]], face: 0, activity: "sip", cat: "food", say: "Espresso, please", where: "at the café bar", emoji: ["☕", "😋"] }),
  spot({ id: "bar-stool", at: [-0.9, 14.7], node: "RW3", approach: [[-0.9, 13.8]], face: 0, seat: 0.72, activity: "sip", cat: "food", say: "Latte break", where: "at the café bar", emoji: ["🥐", "☕"] }),
  ...[
    ["1", "T1", 2.6],
    ["2", "T2", 5.4],
    ["3", "T3", 8.2],
  ].flatMap(([n, node, x]) => {
    const cx = x as number;
    return [
      spot({ id: `bistro-${n}a`, at: [cx - 0.65, 14.5], node: node as string, approach: [[cx - 0.65, 13.7]], face: PI / 2, seat: 0.46, activity: "chat", cat: "chat", say: "Guess what happened", where: "at a café table", emoji: ["💬", "😮", "😄"], pair: `bistro-${n}b` }),
      spot({ id: `bistro-${n}b`, at: [cx + 0.65, 14.5], node: node as string, approach: [[cx + 0.65, 13.7]], face: -PI / 2, seat: 0.46, activity: "chat", cat: "chat", say: "No way!", where: "at a café table", emoji: ["💬", "🤣", "☕"], pair: `bistro-${n}a` }),
    ];
  }),

  // ----- east wing: lobby -----
  ...CAFE_SPOTS,
  spot({ id: "waiting-1", at: [24.65, -2.9], node: "LO3", approach: [[24.15, -1.2], [24.15, -2.9]], face: -PI / 2, seat: 0.46, activity: "sip", cat: "food", say: "Coffee on the sofa", where: "in the café lounge", emoji: ["☕", "🛋️"] }),
  spot({ id: "waiting-2", at: [24.65, -2.1], node: "LO3", approach: [[24.15, -1.2]], face: -PI / 2, seat: 0.46, activity: "read", cat: "reading", say: "Reading the news", where: "in the café lounge", emoji: ["📰", "☕"] }),

  // ----- east wing: town hall (front row) -----
  ...TOWN_HALL_SEATS.slice(1, 4),

  // ----- east wing: garden -----
  spot({ id: "picnic-a", at: [19.8, 10.65], node: "GD0", approach: [[19.8, 10.05]], face: 0, seat: 0.45, activity: "chat", cat: "chat", say: "Lovely weather!", where: "at the picnic table", emoji: ["🧺", "☀️", "😄"], pair: "picnic-b" }),
  spot({ id: "picnic-b", at: [19.8, 11.95], node: "GM", approach: [[19.8, 12.6]], face: PI, seat: 0.45, activity: "chat", cat: "chat", say: "Pass the sandwiches!", where: "at the picnic table", emoji: ["🥪", "😋"], pair: "picnic-a" }),
  spot({ id: "pond", at: [22.8, 13.0], node: "GS2", face: PI, activity: "look", cat: "nature", say: "Feeding the koi", where: "at the garden pond", emoji: ["🐟", "🌸", "😊"] }),
  spot({ id: "flowers", at: [22.0, 9.95], node: "GD0", approach: [[20.8, 9.95]], face: PI, activity: "look", cat: "nature", say: "Smelling the flowers", where: "in the garden", emoji: ["🌷", "🌼", "😊"] }),
  spot({ id: "lounger-1", at: [21.6, 14.65], node: "GS1", approach: [[21.6, 14.0]], face: 0, seat: 0.3, activity: "rest", cat: "rest", say: "Sunbathing", where: "on a garden lounger", emoji: ["😎", "☀️"] }),
  spot({ id: "lounger-2", at: [23.0, 14.65], node: "GS2", approach: [[23.0, 14.0]], face: 0, seat: 0.3, activity: "nap", cat: "rest", say: "Soaking up the sun", where: "on a garden lounger", emoji: ["😎", "💤"] }),
  spot({ id: "hammock", at: [24.9, 14.6], node: "GS2", approach: [[24.9, 13.95]], face: 0, seat: 0.55, activity: "nap", cat: "rest", say: "Swinging in the hammock", where: "in the garden hammock", emoji: ["💤", "🌴"] }),

  // ----- zone 5: fitness & meditation studio -----
  spot({ id: "tread-a", at: [-7.15, 18.2], node: "FA1", approach: [[-6.0, 18.95], [-7.15, 18.95]], face: PI / 2, seat: 0.16, activity: "run", cat: "exercise", say: "Cardio time", where: "in the fitness studio", emoji: ["🏃", "💦"] }),
  spot({ id: "tread-b", at: [-7.15, 19.8], node: "FA1", approach: [[-6.0, 18.95], [-7.15, 18.95]], face: PI / 2, seat: 0.16, activity: "run", cat: "exercise", say: "New personal best!", where: "in the fitness studio", emoji: ["🏃", "🏅"] }),
  spot({ id: "bike", at: [-4.6, 18.45], node: "FA1", approach: [[-4.0, 18.45]], face: 0, seat: 0.55, activity: "run", cat: "exercise", say: "Spinning class", where: "on the exercise bike", emoji: ["🚴", "💪"] }),
  spot({ id: "weights", at: [-2.2, 18.6], node: "FA1", approach: [[-2.2, 19.4]], face: PI / 2, activity: "lift", cat: "exercise", say: "Leg day? Arm day!", where: "at the weights", emoji: ["🏋️", "💪"] }),
  ...[21.0, 22.0, 23.0].map((z, i) =>
    spot({ id: `ym-${i}`, at: [-6.8, z], node: "FA1", approach: [[-5.4, z]], face: PI / 2, activity: "yoga", cat: "exercise", say: i ? "Downward dog" : "Sun salutation", where: "in the fitness studio", emoji: ["🧘", "🌸"] }),
  ),
  ...[-3.8, -2.8, -1.8].map((x, i) =>
    spot({ id: `med-${i}`, at: [x, 22.2], node: "FA1", approach: [[x, 21.4]], face: 0, seat: 0.12, activity: "meditate", cat: "exercise", say: "Breathe in… breathe out", where: "in the meditation corner", emoji: ["🕯️", "😌", "🌿"] }),
  ),

  // ----- zone 4: deep focus pods -----
  ...[
    [2.6, 19.35, "FB1"],
    [6.4, 19.35, "FB1"],
    [2.6, 22.55, "FB2"],
    [6.4, 22.55, "FB2"],
  ].map(([x, z, node], i) =>
    spot({ id: `pod-${i}`, at: [x as number, z as number], node: node as string, face: PI, seat: 0.5, activity: "type", cat: "focus", say: i % 2 ? "In the zone" : "Deep work, do not disturb", where: "in a focus pod", emoji: ["🎧", "🤫", "🧠"] }),
  ),

  // ----- zone 3: creative labs -----
  spot({ id: "wb-1", at: [9.4, 18.9], node: "FC1", approach: [[10.3, 18.4]], face: -PI / 2, activity: "draw", cat: "ideas", say: "Sketching the flow", where: "at the digital whiteboard", emoji: ["✏️", "💡"] }),
  spot({ id: "wb-2", at: [9.4, 21.6], node: "FC2", approach: [[10.4, 21.9]], face: -PI / 2, activity: "draw", cat: "ideas", say: "Mind-mapping", where: "at the digital whiteboard", emoji: ["🧠", "✨"] }),
  spot({ id: "tt-a", at: [12.0, 19.2], node: "FC1", approach: [[12.0, 18.4]], face: 0, activity: "chat", cat: "ideas", say: "What if we…", where: "at the touch table", emoji: ["💡", "🖐️"], pair: "tt-b" }),
  spot({ id: "tt-b", at: [12.0, 21.2], node: "FC2", approach: [[13.6, 21.2]], face: PI, activity: "chat", cat: "ideas", say: "Yes, and…", where: "at the touch table", emoji: ["💡", "🤩"], pair: "tt-a" }),
  spot({ id: "printer3d", at: [15.0, 18.4], node: "FC1", face: PI / 2, activity: "look", cat: "ideas", say: "3D printing a prototype", where: "at the 3D printer", emoji: ["🖨️", "🧩"] }),
  spot({ id: "idea-bag", at: [15.4, 22.4], node: "FC2", approach: [[14.6, 22.4]], face: -PI / 2, seat: 0.32, activity: "rest", cat: "ideas", say: "Thinking big", where: "in the creative labs", emoji: ["💭", "🌈"] }),
  spot({ id: "pinball", at: [10.0, 22.55], node: "FC2", approach: [[13.6, 22.55]], face: 0, activity: "play", cat: "games", say: "Multiball!", where: "at the pinball machine", emoji: ["🎰", "😆"] }),

  // ----- zone 6: strategy hub (a few seats used day to day) -----
  ...HUB_SEATS.slice(1, 3),

  // ----- the roof -----
  ...ROOF_SPOTS,
];

/** Places only used by office events (gatherings, chores). */
export const EVENT_SPOTS = {
  pizza: [
    spot({ id: "pz-1", at: [-1.9, -4.5], node: "K2", face: 0, activity: "sip", cat: "food", say: "Pizza!", where: "at the pizza party in the kitchen", emoji: ["🍕", "😋"] }),
    spot({ id: "pz-2", at: [-1.0, -4.5], node: "K2", face: 0, activity: "sip", cat: "food", say: "Pizza!", where: "at the pizza party in the kitchen", emoji: ["🍕", "😋"] }),
    spot({ id: "pz-3", at: [-0.1, -4.5], node: "K1", face: 0, activity: "sip", cat: "food", say: "Extra cheese", where: "at the pizza party in the kitchen", emoji: ["🍕", "🧀"] }),
    spot({ id: "pz-4", at: [0.75, -2.0], node: "K0", face: -PI / 2, activity: "sip", cat: "food", say: "Pizza!", where: "at the pizza party in the kitchen", emoji: ["🍕", "😋"] }),
    spot({ id: "pz-5", at: [2.6, -0.45], node: "K0", approach: [[0.75, -0.3], [2.6, -0.3]], face: PI, activity: "sip", cat: "food", say: "Yum", where: "at the pizza party in the kitchen", emoji: ["🍕", "🥤"] }),
    spot({ id: "pz-6", at: [-2.3, -0.45], node: "K0", approach: [[0.75, -0.3], [-2.3, -0.3]], face: PI, activity: "sip", cat: "food", say: "Pizza!", where: "at the pizza party in the kitchen", emoji: ["🍕", "😋"] }),
  ],
  drill: [-7.3, -6.3, -4.2, -2.4, -1.4, -0.4, 1.8, 2.8, 4.45, 6.3, 7.3, 8.3, 9.2, 11.2, 12.2, 15.2, 19.0, 23.0].map((x, i) => {
    const node =
      x < -4.3 ? "C3" : x < -2.1 ? "CW" : x < 2.3 ? "C4" : x < 4.5 ? "C5" : x < 7.6 ? "C6" : x < 12 ? "CG" : x < 16 ? "C8" : x < 21 ? "LO1" : "LO2";
    return spot({ id: `drill-${i}`, at: [x, 0.3], node, face: 0, activity: "look", cat: "ideas", say: "Fire drill!", where: "at the corridor assembly point", emoji: ["🚨", "😮", "🧯"] });
  }),
  party: [
    spot({ id: "party-1", at: [4.7, -2.3], node: "L1", face: PI / 2, activity: "play", cat: "chat", say: "Happy birthday!", where: "at the birthday party in the lounge", emoji: ["🎂", "🎉"] }),
    spot({ id: "party-2", at: [5.5, -1.95], node: "L1", face: PI, activity: "play", cat: "chat", say: "Happy birthday!", where: "at the birthday party in the lounge", emoji: ["🎉", "🥳"] }),
    spot({ id: "party-3", at: [6.3, -1.95], node: "L4", face: PI, activity: "play", cat: "chat", say: "Cake time!", where: "at the birthday party in the lounge", emoji: ["🍰", "🎉"] }),
    spot({ id: "party-4", at: [6.6, -2.5], node: "L4", face: -1.99, activity: "play", cat: "chat", say: "Woohoo!", where: "at the birthday party in the lounge", emoji: ["🥳", "🎈"] }),
    spot({ id: "armchair-1", at: [3.9, -2.4], node: "L1", approach: [[4.7, -2.4]], face: PI / 2, seat: 0.4, activity: "rest", cat: "chat", say: "Happy birthday!", where: "at the birthday party in the lounge", emoji: ["🎈", "😊"] }),
    spot({ id: "armchair-2", at: [3.9, -3.6], node: "L1", approach: [[4.7, -3.6]], face: PI / 2, seat: 0.4, activity: "rest", cat: "chat", say: "Cake time!", where: "at the birthday party in the lounge", emoji: ["🍰", "😊"] }),
  ],
  plants: [
    spot({ id: "plant-w", at: [-6.85, 10.35], node: "WN", approach: [[-5.6, 10.3]], face: -PI / 2, activity: "look", cat: "nature", say: "Watering plants", where: "watering the plants", emoji: ["💧", "🌱"] }),
    spot({ id: "plant-e", at: [15.0, 5.6], node: "RE1", approach: [[13.0, 5.6]], face: PI / 2, activity: "look", cat: "nature", say: "Watering plants", where: "watering the plants", emoji: ["💧", "🌿"] }),
    spot({ id: "plant-l", at: [3.95, -5.0], node: "L1", approach: [[4.7, -3.65], [4.45, -4.5]], face: -2.36, activity: "look", cat: "nature", say: "Watering plants", where: "watering the plants", emoji: ["💧", "🌱"] }),
    spot({ id: "plant-g", at: [11.75, -4.85], node: "G1", approach: [[11.05, -2.3], [11.05, -4.3]], face: PI, activity: "look", cat: "nature", say: "Watering plants", where: "watering the plants", emoji: ["💧", "🌿"] }),
  ],
  meeting: [
    spot({ id: "mc-s1", at: [-6.4, -2.25], node: "M1", approach: [[-6.4, -1.3]], face: PI, seat: 0.5, activity: "rest", cat: "ideas", say: "Morning, team!", where: "at the stand-up", emoji: ["📋", "☕"] }),
    spot({ id: "mc-s3", at: [-4.4, -2.25], node: "M1", approach: [[-4.4, -1.3]], face: PI, seat: 0.5, activity: "rest", cat: "ideas", say: "Today I'll finish…", where: "at the stand-up", emoji: ["📋", "💪"] }),
    ...[-6.4, -5.4, -4.4].map((x, i) =>
      spot({ id: `mc-n${i + 1}`, at: [x, -3.95], node: "M0", approach: [[-3.45, -4.45], [x, -4.45]], face: 0, seat: 0.5, activity: "rest", cat: "ideas", say: "No blockers!", where: "at the stand-up", emoji: ["📋", "👍"] }),
    ),
  ],
  townHall: TOWN_HALL_SEATS,
  hub: HUB_SEATS,
  delivery: [
    spot({ id: "parcel-pickup", at: [-7.0, 0.3], node: "EL", face: 0, activity: "look", cat: "ideas", say: "Signing for a parcel", where: "at the elevator", emoji: ["📦", "✍️"], gives: "box" }),
    spot({ id: "parcel-drop", at: [-6.2, 14.85], node: "PB", approach: [[-6.2, 14.0]], face: 0, activity: "look", cat: "ideas", say: "Unpacking supplies", where: "at the supply cabinet", emoji: ["📦", "✨"], takes: true }),
  ],
  yoga: [
    spot({ id: "yc-1", at: [-5.2, 9.0], node: "WN", face: PI / 2, activity: "yoga", cat: "exercise", say: "Yoga class!", where: "at the yoga class", emoji: ["🧘", "😌"] }),
    spot({ id: "yc-2", at: [-4.6, 6.4], node: "WN", face: PI / 2, activity: "yoga", cat: "exercise", say: "Reach up!", where: "at the yoga class", emoji: ["🙆", "✨"] }),
  ],
};

export const spotById = (id: string) => [...SPOTS, ...Object.values(EVENT_SPOTS).flat()].find((s) => s.id === id)!;

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

/** An agent's desk: back out of the chair to the walkway behind its row, then to either side aisle. */
export type Home = { seat: P2; aisleZ: number; row: number };

type Leg = { points: P2[]; node: string };

function legs(a: Anchor): Leg[] {
  if ("spot" in a) return [{ points: [a.spot.at, ...[...a.spot.approach].reverse()], node: a.spot.node }];
  const { seat, aisleZ, row } = a.home;
  const out: P2[] = [seat, [seat[0], aisleZ]];
  return [{ points: out, node: `RW${row}` }, { points: out, node: `RE${row}` }];
}

type Anchor = { home: Home } | { spot: Spot };

const length = (pts: P2[]) => pts.reduce((sum, p, i) => (i ? sum + dist(p, pts[i - 1]) : 0), 0);

/** Full polyline from one anchor (desk or spot) to another, taking whichever side aisle is shorter. */
export function route(from: Anchor, to: Anchor): P2[] {
  let best: P2[] = [];
  let bestLen = Infinity;
  for (const a of legs(from)) {
    for (const b of legs(to)) {
      const middle = nodePath(a.node, b.node).map((n) => NODES[n]);
      const raw = [...a.points, ...middle, ...[...b.points].reverse()];
      const pts = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 0.01);
      const len = length(pts);
      if (len < bestLen) {
        best = pts;
        bestLen = len;
      }
    }
  }
  return best;
}

// ---------- What agents are allowed to do (set from the office settings) ----------

let allowedCats = new Set<SpotCat>(SPOT_CATS);
let decorOn = new Set<string>(["aquarium"]);
/** >1 = longer at the desk between breaks */
let breakScale = 1;

export function setBreakRules(rules: { cats: SpotCat[]; decor: string[]; breaks: "rare" | "normal" | "often" }) {
  allowedCats = new Set(rules.cats);
  decorOn = new Set(rules.decor);
  breakScale = rules.breaks === "rare" ? 2.6 : rules.breaks === "often" ? 0.4 : 1;
}

const usable = (s: Spot) => allowedCats.has(s.cat) && (!s.needs || decorOn.has(s.needs));

let officeHour = 10;

/** The office clock (0-24), for the daily rhythm of breaks. */
export function setOfficeHour(hour: number) {
  officeHour = hour;
}

/** Real-life rhythm: coffee in the morning, lunch at noon, snacks mid-afternoon, games after five, naps late at night. */
function rhythm(cat: SpotCat, hour: number) {
  if (hour >= 8 && hour < 10) return cat === "food" ? 2.2 : 1;
  if (hour >= 12 && hour < 13) return cat === "food" ? 3 : cat === "chat" ? 1.6 : 1;
  if (hour >= 15 && hour < 16) return cat === "food" || cat === "games" ? 1.6 : 1;
  if (hour >= 17 && hour < 20) return cat === "games" || cat === "chat" ? 1.6 : 1;
  if (hour >= 22 || hour < 6) return cat === "rest" ? 3 : 1;
  return 1;
}

// ---------- Zones: each agent has a favourite one and spends more of its breaks there ----------

/** Which working zone a point on the floor belongs to (null: rooms outside the six zones). */
export function zoneAt([x, z]: P2, roof = false): ZoneId | null {
  if (roof) return null;
  if (z > 17.2) return x < 1 ? "fitness" : x < 8.5 ? "pods" : x < 17 ? "labs" : "hub";
  if (x >= 16 || z > 16) return null;
  if (z < -0.3) return x > -2.6 && x < 8 ? "social" : null;
  if (z > 13.4 || (x < -3.7 && z > 5.9 && z < 10.7)) return "social";
  return z > 0.9 ? "engine" : null;
}

const spotZones = new Map<string, ZoneId | null>();
const zoneOf = (s: Spot) => {
  if (!spotZones.has(s.id)) spotZones.set(s.id, zoneAt(s.at, s.roof));
  return spotZones.get(s.id)!;
};

let favourite = new Map<string, ZoneId>();

/**
 * Where an agent can take real work in their favourite zone: a focus pod, a seat at the strategy
 * table, the labs' touch table and whiteboards, or a café table with a laptop.
 */
export const ZONE_WORK_SPOTS: Partial<Record<ZoneId, string[]>> = {
  pods: ["pod-0", "pod-1", "pod-2", "pod-3"],
  hub: ["hub-n0", "hub-n1", "hub-n2", "hub-n3", "hub-s0", "hub-s1", "hub-s2", "hub-s3", "hub-w", "hub-e"],
  labs: ["tt-a", "tt-b", "wb-1", "wb-2"],
  social: ["cafe-t1a", "cafe-t1b", "cafe-t2a", "cafe-t2b"],
};
/** How often an agent with such a zone takes a job there instead of doing it at the desk. */
const WORK_AWAY = 0.6;

/** Agent id -> favourite zone, from the agent list. */
export function setAgentZones(zones: Record<string, ZoneId | undefined>) {
  favourite = new Map(Object.entries(zones).filter((e): e is [string, ZoneId] => Boolean(e[1])));
}

/** The roof is a lift ride away: visited a bit less, but everyone goes up for lunch in the sun and the sunset. */
function roofPull(hour: number) {
  if (hour >= 17 && hour < 19.5) return 3;
  if (hour >= 12 && hour < 13.5) return 1.5;
  return hour >= 21 || hour < 7 ? 0.4 : 0.8;
}

// ---------- Who is where ----------

/** Spots currently claimed, so two agents don't sit in the same chair. */
const taken = new Map<string, string>();
/** Spots someone is physically at (not just heading to), e.g. for the ping-pong rally. */
const present = new Map<string, string>();

export function claimRandomSpot(agentId: string, avoid?: string): Spot | null {
  let free = SPOTS.filter((s) => s.id !== avoid && usable(s) && (!taken.has(s.id) || taken.get(s.id) === agentId));
  const hour = officeHour;
  const fav = favourite.get(agentId);
  while (free.length) {
    // join a colleague who is already waiting at a table; prefer the agent's favourite zone
    const weights = free.map(
      (s) => rhythm(s.cat, hour) * (s.pair && present.has(s.pair) ? 5 : 1) * (fav && zoneOf(s) === fav ? 4 : 1) * (s.roof ? roofPull(hour) : 1),
    );
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let s = free[free.length - 1];
    for (let i = 0; i < free.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        s = free[i];
        break;
      }
    }
    claimSpot(agentId, s);
    // two-person activities (ping-pong, foosball, a chat at a table) need a partner: invite one, or pick something else
    if (!s.pair || taken.has(s.pair) || invitePartner(agentId, s)) return s;
    releaseSpot(agentId);
    free = free.filter((o) => o !== s && o.id !== s.pair);
  }
  return null;
}

/** Ask the nearest free colleague to take the other side of a two-person spot. */
function invitePartner(agentId: string, s: Spot) {
  const other = spotById(s.pair!);
  if (!other || !usable(other)) return false;
  const near = [...walkers.values()]
    .filter((w) => w.id !== agentId && w.canJoin())
    .sort((a, b) => dist([a.x, a.z], other.at) - dist([b.x, b.z], other.at));
  return near.length > 0 && near[0].invite(other);
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

/** Seconds in the elevator between the floors. */
const LIFT_RIDE = 2.5;

const levelOf = (a: Anchor): 0 | 1 => ("spot" in a && a.spot.roof ? 1 : 0);
const liftOn = (level: 0 | 1) => (level ? LIFT_ROOF : LIFT_GROUND);

/** Activities you can do with a coffee in your hand. */
const CUP_FRIENDLY = new Set<Activity>(["sip", "chat", "talk", "rest", "read", "look", "call"]);

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
  /** sideways nudge so passing agents step around each other (visual only) */
  offX = 0;
  offZ = 0;
  /** what the agent is carrying, e.g. a parcel during a delivery or a coffee */
  holding: string | null = null;
  /** seconds left of a hello with a colleague passing by (both stop and wave) */
  greetT = 0;
  /** the spot in the agent's favourite zone where they're doing their current job, if not at the desk */
  workAt: Spot | null = null;
  /** 0: ground floor, 1: the roof */
  level: 0 | 1 = 0;
  /** inside the elevator (not drawn) */
  hidden = false;
  private ride = 0;
  private rideTo: 0 | 1 = 0;
  /** where to go once the elevator arrives */
  private afterRide: Anchor | null = null;
  private working = false;
  private decidedWork = false;
  private greetCooldown = 10 + Math.random() * 20;
  private greetYaw = 0;
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
  private home: Home;

  constructor(id: string, home: Home, seatY: number, firstWait: number) {
    this.id = id;
    this.seatY = seatY;
    this.timer = firstWait;
    [this.x, this.z] = home.seat;
    this.y = seatY;
    this.home = home;
    this.origin = { home };
  }

  /** The agent has a job in progress (not just watching Max plan): they may take it to their zone. */
  setWorking(working: boolean) {
    this.working = working;
  }

  /** Free to accept a colleague's invitation: at the desk, or at a hangout spot that isn't itself a two-person one. */
  canJoin() {
    if (!this.isIdle() || this.ordered || this.orders.length) return false;
    return this.mode === "seated" || (this.mode === "spot" && !!this.spot && !this.spot.pair);
  }

  /** A colleague asked to play or chat: walk over to the other side of their table. */
  invite(spot: Spot) {
    if (!this.canJoin()) return false;
    const from: Anchor = this.mode === "seated" ? { home: this.home } : { spot: this.spot! };
    claimSpot(this.id, spot);
    this.spot = spot;
    this.start(from, { spot }, HURRY, "out");
    return true;
  }

  /** Play on for exactly `seconds` (both partners get the same, so they finish together). */
  stayFor(seconds: number) {
    if (this.mode === "spot" && !this.ordered) this.timer = seconds;
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
    this.home = home;
    this.busy = busy;
    this.greetCooldown -= dt;
    this.canWander = canWander;
    // the job is done: wrap up at the work spot, then carry on as usual
    if (!this.working && this.workAt) {
      if (this.mode === "spot" && this.spot === this.workAt) this.timer = 6 + Math.random() * 8;
      this.workAt = null;
    }
    if (!this.working) this.decidedWork = false;
    const awayAtWork = busy && canWander && this.workAt !== null;
    if ((busy || !canWander) && this.mode !== "seated" && !awayAtWork) {
      this.orders = [];
      this.ordered = false;
      this.goHome(home);
    }
    // a hangout spot that was switched off in the settings: wrap up soon
    if (this.mode === "spot" && this.spot && !this.ordered && !usable(this.spot)) this.timer = Math.min(this.timer, 0.5);

    let targetY = 0;
    let targetYaw = this.yaw;
    if (this.mode === "seated") {
      [this.x, this.z] = home.seat;
      targetY = this.seatY;
      targetYaw = 0;
      if (busy && canWander && this.working && !this.decidedWork) {
        // a new job: sometimes take it to a pod, the hub table, the labs or the café
        this.decidedWork = true;
        const s = Math.random() < WORK_AWAY ? this.freeWorkSpot() : null;
        if (s) {
          this.orders = [];
          this.ordered = false;
          this.workAt = s;
          this.spot = s;
          this.start({ home }, { spot: s }, HURRY, "out");
        }
      } else if (busy || !canWander) {
        this.orders = [];
        this.ordered = false;
        this.timer = Math.max(this.timer, 4 + Math.random() * 4);
      } else if (this.orders.length) {
        this.takeOrder({ home });
      } else if (!this.ordered && (this.timer -= dt) <= 0) {
        const s = claimRandomSpot(this.id);
        if (s) {
          this.spot = s;
          // a colleague is on the way to play: don't keep them waiting
          this.start({ home }, { spot: s }, s.pair ? HURRY : STROLL, "out");
        } else this.timer = 6;
      }
    } else if (this.mode === "spot" && this.spot) {
      targetY = this.spot.seat;
      targetYaw = this.spot.face;
      this.timer -= dt;
      // working away from the desk: stay put until the job is done
      if (this.workAt === this.spot && busy) this.timer = Math.max(this.timer, 1);
      // an office event sent someone else to this spot: move on
      if (!this.ordered && taken.get(this.spot.id) !== this.id) this.timer = Math.min(this.timer, 0);
      // a two-person spot whose partner isn't coming (or has left): don't play alone for long
      if (!this.ordered && this.spot.pair && !taken.has(this.spot.pair)) this.timer = Math.min(this.timer, 4);
      if (this.orders.length) {
        // new orders interrupt a normal hangout at once; along an ordered route, wait out each stop
        if (!this.onOrder || this.timer <= 0) this.takeOrder({ spot: this.spot });
      } else if (!this.ordered && this.timer <= 0) {
        const from = this.spot;
        const homeChance = breakScale > 1 ? 0.65 : breakScale < 1 ? 0.15 : 0.35;
        // routines (the café queue) lead on to the next step; a coffee is sometimes taken back to the desk
        const step = from.next ? this.claimNext(from) : null;
        const next = step ?? (Math.random() < homeChance ? null : claimRandomSpot(this.id, from.id));
        if (next) {
          this.spot = next;
          this.start({ spot: from }, { spot: next }, next.pair ? HURRY : STROLL, "out");
        } else {
          releaseSpot(this.id);
          this.start({ spot: from }, { home }, STROLL, "home");
        }
      }
    } else if (this.ride > 0) {
      // riding the elevator between the floors
      this.ride -= dt;
      if (this.ride <= 0) this.leaveLift();
    } else if (this.greetT > 0) {
      // saying hello to a colleague in passing: stop, face them, wave
      this.greetT -= dt;
      targetYaw = this.greetYaw;
    } else {
      if (this.speed < HURRY && this.greetCooldown <= 0) this.lookForColleague();
      const target = this.path[this.seg + 1];
      if (target && this.greetT <= 0) {
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
      if (this.greetT <= 0 && this.seg >= this.path.length - 1 && this.afterRide) {
        // at the elevator: step in and ride to the other floor
        this.hidden = true;
        this.ride = LIFT_RIDE;
        this.rideTo = levelOf(this.afterRide);
      } else if (this.greetT <= 0 && this.seg >= this.path.length - 1) {
        if (this.mode === "out" && this.spot) {
          if (taken.get(this.spot.id) === this.id) present.set(this.spot.id, this.id);
          this.mode = "spot";
          // under orders: short stops along a route, then stay until the event ends
          this.timer = this.ordered ? (this.orders.length ? this.dwellEach : 1e9) : (this.spot.dwell ?? 10 + Math.random() * 14);
          // the second player has arrived: both play the same length of game
          const mate = this.spot.pair && !this.ordered ? present.get(this.spot.pair) : undefined;
          if (mate) {
            const game = 22 + Math.random() * 14;
            this.timer = game;
            walkers.get(mate)?.stayFor(game);
          }
          this.phase = { kind: "spot", spot: this.spot };
          if (this.spot.gives) this.holding = this.spot.gives;
          if (this.spot.takes) this.holding = null;
          // a coffee goes along to chats and quiet spots, but not to the gym or the arcade
          if (this.holding === "cup" && !this.spot.gives && !CUP_FRIENDLY.has(this.spot.activity)) this.holding = null;
        } else {
          this.mode = "seated";
          this.spot = null;
          this.holding = null;
          this.timer = (8 + Math.random() * 10) * breakScale;
          this.phase = { kind: "seated" };
        }
      }
    }

    this.y += (targetY - this.y) * Math.min(1, dt * 10);
    // turn the short way round
    this.yaw += Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw)) * Math.min(1, dt * 10);
    this.sidestep(dt);
    return this.phase !== before;
  }

  dispose() {
    releaseSpot(this.id);
    walkers.delete(this.id);
  }

  /** Step out of the elevator on the new floor and carry on (or ride back if plans changed on the way). */
  private leaveLift() {
    this.level = this.rideTo;
    const lift = liftOn(this.level);
    [this.x, this.z] = lift.at;
    const target = this.afterRide!;
    if (levelOf(target) !== this.level) {
      this.rideTo = levelOf(target);
      this.ride = LIFT_RIDE;
      return;
    }
    this.hidden = false;
    this.afterRide = null;
    this.path = route({ spot: lift }, target);
    this.seg = 0;
    this.origin = { spot: lift };
  }

  /** A free work spot in the agent's favourite zone, claimed for them. */
  private freeWorkSpot(): Spot | null {
    const zone = favourite.get(this.id);
    const ids = zone ? ZONE_WORK_SPOTS[zone] : undefined;
    if (!ids) return null;
    const free = ids.map((id) => spotById(id)).filter((sp) => sp && !taken.has(sp.id));
    if (!free.length) return null;
    const sp = free[Math.floor(Math.random() * free.length)];
    claimSpot(this.id, sp);
    return sp;
  }

  /** The next step of a routine, if that spot is free. */
  private claimNext(from: Spot): Spot | null {
    const options = from
      .next!.map((id) => spotById(id))
      .filter((s) => s && usable(s) && (!taken.has(s.id) || taken.get(s.id) === this.id));
    // with a coffee in hand, sometimes just head back to the desk with it
    if (!options.length || (from.gives === "cup" && Math.random() < 0.3)) return null;
    const s = options[Math.floor(Math.random() * options.length)];
    claimSpot(this.id, s);
    return s;
  }

  /** Two colleagues strolling past each other sometimes stop to say hello. */
  private lookForColleague() {
    if (this.hidden) return;
    for (const other of walkers.values()) {
      if (other === this || other.level !== this.level || other.hidden) continue;
      if (other.phase.kind !== "walking" || other.greetT > 0 || other.greetCooldown > 0 || other.speed >= HURRY) continue;
      const dx = other.x - this.x;
      const dz = other.z - this.z;
      if (Math.hypot(dx, dz) > 1.1) continue;
      // whatever happens, neither asks again for a while
      this.greetCooldown = other.greetCooldown = 25 + Math.random() * 20;
      if (Math.random() < 0.45) {
        this.greetT = other.greetT = 1.8;
        this.greetYaw = Math.atan2(dx, dz);
        other.greetYaw = Math.atan2(-dx, -dz);
      }
      return;
    }
  }

  /** Walking agents ease sideways away from anyone close by, so two people in an aisle pass instead of merging. */
  private sidestep(dt: number) {
    let px = 0;
    let pz = 0;
    if (this.phase.kind === "walking") {
      for (const other of walkers.values()) {
        if (other === this || other.phase.kind === "seated" || other.level !== this.level || other.hidden) continue;
        const dx = this.x - other.x;
        const dz = this.z - other.z;
        const d = Math.hypot(dx, dz);
        if (d >= 0.85) continue;
        // head-on: pick a side from the ids so both don't dodge the same way
        const [ux, uz] = d > 1e-3 ? [dx / d, dz / d] : this.id < other.id ? [1, 0] : [-1, 0];
        px += ux * (0.85 - d);
        pz += uz * (0.85 - d);
      }
      const m = Math.hypot(px, pz);
      if (m > 0.35) {
        px = (px / m) * 0.35;
        pz = (pz / m) * 0.35;
      }
    }
    const k = Math.min(1, dt * 4);
    this.offX += (px - this.offX) * k;
    this.offZ += (pz - this.offZ) * k;
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
    // another floor: walk to the elevator first, the rest of the trip follows the ride
    if (levelOf(to) !== this.level) {
      this.path = route(from, { spot: liftOn(this.level) });
      this.afterRide = to;
    } else {
      this.path = route(from, to);
      this.afterRide = null;
    }
    this.seg = 0;
    this.origin = from;
    this.speed = speed;
    this.mode = mode;
    this.phase = { kind: "walking", rushing: speed >= RUSH };
  }

  private goHome(home: Home) {
    releaseSpot(this.id);
    this.holding = null;
    if (this.ride > 0) {
      // in the elevator: ride on, then come straight back down to the desk
      this.afterRide = { home };
      this.speed = RUSH;
      this.mode = "home";
      this.phase = { kind: "walking", rushing: true };
    } else if (this.mode === "spot" && this.spot) {
      this.start({ spot: this.spot }, { home }, RUSH, "home");
    } else if (this.mode === "out") {
      if (this.level === 1 && this.afterRide) {
        // already on the way to the elevator down
        this.afterRide = { home };
      } else {
        // retrace the current trip, then continue home (via the elevator from the roof)
        let back: P2[] = [[this.x, this.z], ...this.path.slice(0, this.seg + 1).reverse()];
        if (this.level === 0) {
          if ("spot" in this.origin) back = back.concat(route(this.origin, { home }).slice(1));
          this.afterRide = null;
        } else {
          if ("spot" in this.origin && this.origin.spot !== LIFT_ROOF) back = back.concat(route(this.origin, { spot: LIFT_ROOF }).slice(1));
          this.afterRide = { home };
        }
        this.path = back;
        this.seg = 0;
      }
      this.speed = RUSH;
      this.mode = "home";
      this.phase = { kind: "walking", rushing: true };
    } else if (this.mode === "home" && this.speed < RUSH) {
      this.speed = RUSH;
      this.phase = { kind: "walking", rushing: true };
    }
  }
}

// ---------- Max the manager: rounds of the office while no task is running ----------

/** Where Max presents (in front of the meeting-room projector). */
export const MAX_BASE: Spot = spot({ id: "max-base", at: [-3.9, -4.9], node: "M0", approach: [[-3.45, -1.6], [-3.45, -4.6]], face: 0, activity: "look", cat: "ideas", say: "", where: "in the meeting room", emoji: [] });

/** Places Max drops by: checking on the desks, the strategy hub, the stage, the labs, coffee, the lobby. */
export const MAX_ROUNDS: Spot[] = [
  spot({ id: "max-desks-w", at: [-3.3, R[1]], node: "RW1", approach: [], face: PI / 2, activity: "look", cat: "ideas", say: "Checking in on the team", where: "making the rounds", emoji: ["👀", "📋"] }),
  spot({ id: "max-desks-e", at: [12.75, R[2]], node: "RE2", approach: [], face: -PI / 2, activity: "talk", cat: "ideas", say: "Great progress, everyone!", where: "making the rounds", emoji: ["👍", "🙌"] }),
  spot({ id: "max-hub", at: [18.0, 20.6], node: "FD2", approach: [[18.2, 20.6]], face: -PI / 2, activity: "look", cat: "ideas", say: "Reviewing the roadmap", where: "in the strategy hub", emoji: ["📊", "🎯"] }),
  spot({ id: "max-stage", at: [21.0, 3.05], node: "TH1", approach: [], face: 0, activity: "talk", cat: "ideas", say: "Rehearsing the all-hands", where: "on the town hall stage", emoji: ["🎤", "📣"] }),
  spot({ id: "max-labs", at: [14.3, 20.2], node: "FC1", approach: [[13.6, 20.2]], face: -PI / 2, activity: "look", cat: "ideas", say: "Love these ideas!", where: "in the creative labs", emoji: ["💡", "👏"] }),
  spot({ id: "max-coffee", at: [-2.4, 14.6], node: "RW3", approach: [[-2.4, 13.8]], face: 0, activity: "sip", cat: "food", say: "Coffee with the team", where: "at the café bar", emoji: ["☕", "😊"] }),
  spot({ id: "max-lobby", at: [19.6, -3.75], node: "CF", approach: [], face: PI, activity: "talk", cat: "chat", say: "Morning, Robo! The usual.", where: "at the café counter", emoji: ["🤖", "☕"] }),
];

export type ManagerPhase = { kind: "base" } | { kind: "walking"; rushing: boolean } | { kind: "visit"; spot: Spot };

/**
 * Max stays at the projector while a task runs. In quiet times he makes the rounds: checks on the
 * desks, drops by the hub, the labs and the stage, grabs a coffee, and hurries back when work arrives.
 */
export class ManagerWalker {
  x: number;
  z: number;
  yaw = 0;
  phase: ManagerPhase = { kind: "base" };
  private mode: "base" | "out" | "visit" | "back" = "base";
  private spot: Spot = MAX_BASE;
  private origin: Spot = MAX_BASE;
  private path: P2[] = [];
  private seg = 0;
  private speed = STROLL;
  private timer: number;

  constructor(firstWait = 10) {
    [this.x, this.z] = MAX_BASE.at;
    this.timer = firstWait;
  }

  atBase() {
    return this.mode === "base";
  }

  update(dt: number, onDuty: boolean, canWander: boolean): boolean {
    const before = this.phase;
    dt = Math.min(dt, 0.1);
    if ((onDuty || !canWander) && (this.mode === "out" || this.mode === "visit")) this.goBack();
    if (onDuty && this.mode === "back" && this.speed < RUSH) {
      this.speed = RUSH;
      this.phase = { kind: "walking", rushing: true };
    }
    let targetYaw = this.yaw;
    if (this.mode === "base") {
      [this.x, this.z] = MAX_BASE.at;
      if (onDuty || !canWander) this.timer = Math.max(this.timer, 6);
      else if ((this.timer -= dt) <= 0) this.visit(this.pick());
    } else if (this.mode === "visit") {
      targetYaw = this.spot.face;
      if ((this.timer -= dt) <= 0) {
        if (Math.random() < 0.5) this.visit(this.pick());
        else this.goBack();
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
        if (this.mode === "out") {
          this.mode = "visit";
          this.timer = 8 + Math.random() * 7;
          this.phase = { kind: "visit", spot: this.spot };
        } else {
          this.mode = "base";
          this.spot = MAX_BASE;
          this.timer = 12 + Math.random() * 14;
          this.phase = { kind: "base" };
        }
      }
    }
    this.yaw += Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw)) * Math.min(1, dt * 8);
    return this.phase !== before;
  }

  private pick() {
    const options = MAX_ROUNDS.filter((s) => s.id !== this.spot.id);
    return options[Math.floor(Math.random() * options.length)];
  }

  private visit(next: Spot) {
    this.origin = this.spot;
    this.path = route({ spot: this.spot }, { spot: next });
    this.seg = 0;
    this.spot = next;
    this.speed = STROLL * 1.15;
    this.mode = "out";
    this.phase = { kind: "walking", rushing: false };
  }

  private goBack() {
    if (this.mode === "visit") {
      this.path = route({ spot: this.spot }, { spot: MAX_BASE });
    } else {
      // turn round mid-walk, then continue from wherever the trip started
      let back: P2[] = [[this.x, this.z], ...this.path.slice(0, this.seg + 1).reverse()];
      if (this.origin !== MAX_BASE) back = back.concat(route({ spot: this.origin }, { spot: MAX_BASE }).slice(1));
      this.path = back;
    }
    this.seg = 0;
    this.speed = STROLL * 1.3;
    this.mode = "back";
    this.spot = MAX_BASE;
    this.phase = { kind: "walking", rushing: false };
  }
}

/** The manager's walker, so the camera can follow him too. */
export const manager = { walker: null as ManagerWalker | null };

/** Every agent currently in the office, so office events can give them orders. */
export const walkers = new Map<string, Wanderer>();

export function registerWalker(w: Wanderer) {
  walkers.set(w.id, w);
}
