/**
 * Walking routes for agents. Agents follow straight segments between hand-placed waypoints
 * that run through free floor (aisles, the corridor, doorways), so they never walk through walls.
 * Coordinates are world metres on the floor plane: [x, z]. Must match OfficeFloor.tsx.
 */

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
  TH1: [17.5, 2.9],
  TA1: [17.5, 3.7],
  TA2: [17.5, 5.1],
  TA3: [17.5, 6.5],
  GD0: [17.5, 9.6],
  GE: [17.0, 13.6],
  GM: [19.8, 13.6],
  GS1: [21.6, 13.6],
  GS2: [22.8, 13.6],
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
  ["T2", "T3"],
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
];

// ---------- Places to go ----------

/** How an agent looks while at a spot (Mochi plays a matching animation). */
export type Activity = "look" | "sip" | "play" | "rest" | "read" | "call" | "yoga" | "run" | "chat" | "talk" | "nap";

/** What kind of break a spot is; the user can switch whole categories off. */
export type SpotCat = "food" | "games" | "rest" | "reading" | "exercise" | "chat" | "calls" | "nature" | "ideas";
export const SPOT_CATS: SpotCat[] = ["food", "chat", "games", "rest", "reading", "exercise", "calls", "nature", "ideas"];

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
  /** hands the agent something to carry (a parcel), or takes it back */
  gives?: string;
  takes?: boolean;
};

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
  spot({ id: "arcade-1", at: [9.0, -4.85], node: "G1", approach: [[9.15, -1.6], [9.15, -4.3]], face: PI, activity: "play", cat: "games", say: "High score!", where: "at the arcade machine", emoji: ["🕹️", "👾", "😆"] }),
  spot({ id: "arcade-2", at: [10.05, -4.85], node: "G1", approach: [[11.05, -2.3], [11.05, -4.3]], face: PI, activity: "play", cat: "games", say: "One more go", where: "at the arcade machine", emoji: ["🕹️", "👾", "🎮"] }),
  spot({ id: "foos-a", at: [9.15, -3.2], node: "G1", approach: [[9.15, -1.6]], face: PI / 2, activity: "play", cat: "games", say: "Foosball!", where: "at the foosball table", emoji: ["⚽", "😆"], pair: "foos-b" }),
  spot({ id: "foos-b", at: [11.05, -3.2], node: "G1", approach: [[11.05, -2.3]], face: -PI / 2, activity: "play", cat: "games", say: "Goal!", where: "at the foosball table", emoji: ["⚽", "🙌"], pair: "foos-a" }),
  spot({ id: "game-beanbag", at: [11.5, -1.4], node: "G1", face: -2.48, seat: 0.32, activity: "rest", cat: "games", say: "Gaming break", where: "in the game room", emoji: ["🎮", "😌"] }),
  spot({ id: "server-check", at: [14.0, -4.55], node: "S0", face: PI, activity: "look", cat: "ideas", say: "Checking the servers", where: "in the server room", emoji: ["🖥️", "🔧"] }),
  spot({ id: "server-2", at: [15.0, -4.55], node: "S0", approach: [[15.0, -1.6]], face: PI, activity: "look", cat: "ideas", say: "Cables everywhere", where: "in the server room", emoji: ["🔌", "🤓"] }),

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
  spot({ id: "reception", at: [20.5, -1.7], node: "LO2", face: PI, activity: "talk", cat: "chat", say: "Hi, Robo!", where: "at the reception desk", emoji: ["🤖", "👋"] }),
  spot({ id: "waiting-1", at: [24.65, -2.9], node: "LO3", approach: [[24.15, -1.2], [24.15, -2.9]], face: -PI / 2, seat: 0.46, activity: "rest", cat: "rest", say: "Waiting for a visitor", where: "in the lobby", emoji: ["⏳", "🙂"] }),
  spot({ id: "waiting-2", at: [24.65, -2.1], node: "LO3", approach: [[24.15, -1.2]], face: -PI / 2, seat: 0.46, activity: "read", cat: "reading", say: "Reading a magazine", where: "in the lobby", emoji: ["📰", "😌"] }),
  spot({ id: "lobby-logo", at: [18.5, -4.6], node: "LO1", approach: [[18.5, -1.0]], face: PI, activity: "look", cat: "nature", say: "Office selfie!", where: "at the logo wall", emoji: ["🤳", "✨"] }),

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
    spot({ id: "plant-g", at: [11.35, -4.95], node: "G1", approach: [[11.05, -2.3], [11.05, -4.3]], face: 2.51, activity: "look", cat: "nature", say: "Watering plants", where: "watering the plants", emoji: ["💧", "🌿"] }),
  ],
  meeting: [
    spot({ id: "mc-s1", at: [-6.4, -2.25], node: "M1", approach: [[-6.4, -1.3]], face: PI, seat: 0.5, activity: "rest", cat: "ideas", say: "Morning, team!", where: "at the stand-up", emoji: ["📋", "☕"] }),
    spot({ id: "mc-s3", at: [-4.4, -2.25], node: "M1", approach: [[-4.4, -1.3]], face: PI, seat: 0.5, activity: "rest", cat: "ideas", say: "Today I'll finish…", where: "at the stand-up", emoji: ["📋", "💪"] }),
    ...[-6.4, -5.4, -4.4].map((x, i) =>
      spot({ id: `mc-n${i + 1}`, at: [x, -3.95], node: "M0", approach: [[-3.45, -4.45], [x, -4.45]], face: 0, seat: 0.5, activity: "rest", cat: "ideas", say: "No blockers!", where: "at the stand-up", emoji: ["📋", "👍"] }),
    ),
  ],
  townHall: TOWN_HALL_SEATS,
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

// ---------- Who is where ----------

/** Spots currently claimed, so two agents don't sit in the same chair. */
const taken = new Map<string, string>();
/** Spots someone is physically at (not just heading to), e.g. for the ping-pong rally. */
const present = new Map<string, string>();

export function claimRandomSpot(agentId: string, avoid?: string): Spot | null {
  const free = SPOTS.filter((s) => s.id !== avoid && usable(s) && (!taken.has(s.id) || taken.get(s.id) === agentId));
  if (!free.length) return null;
  const hour = officeHour;
  // join a colleague who is already waiting at a table
  const weights = free.map((s) => rhythm(s.cat, hour) * (s.pair && present.has(s.pair) ? 5 : 1));
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
  /** sideways nudge so passing agents step around each other (visual only) */
  offX = 0;
  offZ = 0;
  /** what the agent is carrying, e.g. a parcel during a delivery */
  holding: string | null = null;
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
    // a hangout spot that was switched off in the settings: wrap up soon
    if (this.mode === "spot" && this.spot && !this.ordered && !usable(this.spot)) this.timer = Math.min(this.timer, 0.5);

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
        const homeChance = breakScale > 1 ? 0.65 : breakScale < 1 ? 0.15 : 0.35;
        const next = Math.random() < homeChance ? null : claimRandomSpot(this.id, from.id);
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
          this.timer = this.ordered ? (this.orders.length ? this.dwellEach : 1e9) : 10 + Math.random() * 14;
          this.phase = { kind: "spot", spot: this.spot };
          if (this.spot.gives) this.holding = this.spot.gives;
          if (this.spot.takes) this.holding = null;
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

  /** Walking agents ease sideways away from anyone close by, so two people in an aisle pass instead of merging. */
  private sidestep(dt: number) {
    let px = 0;
    let pz = 0;
    if (this.phase.kind === "walking") {
      for (const other of walkers.values()) {
        if (other === this || other.phase.kind === "seated") continue;
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
    this.path = route(from, to);
    this.seg = 0;
    this.origin = from;
    this.speed = speed;
    this.mode = mode;
    this.phase = { kind: "walking", rushing: speed >= RUSH };
  }

  private goHome(home: Home) {
    releaseSpot(this.id);
    this.holding = null;
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
