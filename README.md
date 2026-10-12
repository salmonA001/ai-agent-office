# AI Agent Office

Hand any job to a team of AI agents. The **manager** splits your task into parallel subtasks, assigns each to the best-suited agent, the agents work at the same time (streamed live to their desks), and the manager merges everything into one final result.

- A cute animated **3D isometric office** with a meeting room (live projector), kitchen, lounge, game room and server room along the back, and a big open hall: **24 desks in four rows**, a **library nook**, a **wellness corner** (yoga mats, treadmill, mirror), **phone booths**, a **café strip** with a coffee bar and chat tables, **ping-pong**, an **aquarium** and **nap chairs**. Chubby pastel animal workers (bear, bunny, cat, hamster, puppy, chick) turn and wave when idle, face their PC and type while working, and jump up cheering with pom-poms when they finish. Free desks stay empty with the monitor off until you hire someone. Drag to rotate, scroll or pinch to zoom.
- **Idle agents live their day**: they get up and walk the aisles to read in the library, do yoga or run on the treadmill, take phone calls in a booth, grab an espresso, chat in pairs at the café tables (they gesture and talk once their colleague arrives), play ping-pong or arcade games, nap in a recliner or watch the fish. Breaks follow the real clock: coffee in the morning, a lunch rush at noon, games after five. Walking agents step around each other. When work arrives (or Max starts planning) they shout "On my way!" and rush back to their desk. Routes follow hand-placed waypoints through aisles and doorways, so nobody walks through walls or furniture.
- **East wing**: a reception **lobby** (company logo, Robo the robot receptionist, lifts, waiting sofa), a **town hall** with a stage, a big screen showing a tech talk and rows of seats, and a **garden** with a koi pond and fountain, a picnic table, sun loungers, a hammock, trees, flowers and butterflies. Agents chat with Robo, take office selfies, watch talks, picnic, feed the fish and nap in the sun.
- **17 office events**, picked to fit the time of day: pizza party, fire drill, birthday, printer jam, server alarm, thirsty plants, arcade tournament, broken coffee machine, yoga class, morning stand-up, **all-hands** in the town hall, **garden picnic**, movie night on the town hall screen, karaoke (with a disco ball), ice cream cart, parcel delivery (someone carries a box from the elevator to the supply cabinet), power cut (lights out, red emergency lights) and a welcome party whenever you hire someone.
- **Customize** (button on the office floor): floor (tiles, wood, carpet, concrete), desk finish, accent colour, your office name on a neon sign, and decorations (plants, rugs, wall art, lamps, desk items, aquarium, string lights, sign). The **Activities** tab picks which breaks agents take, how often, and whether random office events happen; **Time of day** sets the office clock (real time, a 24-minute time-lapse, or a fixed day, sunset or night). Saved in your browser.
- **3D PCs on every desk** show each agent's real AI output streaming like a terminal (scanline, blinking LED, keys lighting up as they type). While the manager plans, every worker turns to face the meeting room, monitors show spinners, Max presents at the projector and his dashboard sweeps a progress bar.
- Black + green **glassmorphism** UI.
- **Works with zero setup**: with no AI key (or when the cloud quota runs out, or a visitor has no access code), agents run on a small model **inside your browser** via WebGPU (Qwen2.5 1.5B, ~1 GB one-time download).
- **Explainable**: Max gives a plain-language reason for every assignment ("Why Wren: emails are writer work"). Each task has a step-by-step timeline (planned, assigned, started, finished, merged, with word counts and timings). A live log on the 3D view shows the latest steps, and clicking any agent shows who they are, what they're doing right now, why they got their job and their live output.
- **Lively**: emoji emotes float over agents (coffee, ping-pong, naps, ideas), the coffee machine steams, palms sway, a real ping-pong ball rallies when someone's playing, and Max paces in front of the projector while the team works.
- **Sidebar** with three tabs: **Progress** (live progress bars, stage, timer and each agent's part for every running task), **Recent** (searchable task history) and **Account** (local profile name, stats, language, theme, AI engine and access code, reset). Collapses to an icon rail on desktop, slides in as a drawer on phones.
- **English / ไทย**: the whole interface, the task timeline, office events, 3D speech bubbles and PC screens switch language, and agents answer in Thai when Thai is selected.
- **5 themes** (Matrix, Midnight, Sunset, Ocean, Daylight), each checked for WCAG AA contrast; smooth colour cross-fade when switching.
- **Motion everywhere**: staggered entrances, hover lift, press feedback, sliding tab highlight, pop-in status changes, shimmering progress bars. **Account → Motion** picks *Full* (default), *Follow device* or *Reduced*. Full is the default because Windows turns on "reduce motion" whenever its *Animation effects* setting is off, which used to freeze the agents on many PCs.
- **Full screen**: the button on the 3D office (or the **F** key) fills the screen with the office; Esc exits. Browsers without element full screen, like iPhone Safari, get a full-window view instead.
- Run several tasks at once; the office floor shows who is working on what.
- Hire your own agents (name, role, instructions) for custom work, up to one per desk (24).
- Cancel, re-run, copy results. Task history and agents are kept in your browser.

Built with Next.js 16, React 19, Tailwind CSS 4 and AI SDK 7. Works with a Google Gemini, OpenAI or Anthropic key, or the Vercel AI Gateway.

## How it works

| Step | Route | Model |
|---|---|---|
| Plan: split the task, assign agents | `POST /api/plan` | `MANAGER_MODEL` (structured output) |
| Work: each subtask, in parallel | `POST /api/work` | `WORKER_MODEL` (streamed) |
| Merge: final deliverable | `POST /api/synthesize` | `MANAGER_MODEL` (streamed) |

## Run locally

```bash
npm install
cp .env.example .env.local      # add GOOGLE_GENERATIVE_AI_API_KEY (free tier)
npm run dev
```

## Configuration

See `.env.example`. Set `OFFICE_ACCESS_CODE` on any public deployment so strangers can't spend your AI credits.
