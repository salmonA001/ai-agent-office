# AI Agent Office

Hand any job to a team of AI agents. The **manager** splits your task into parallel subtasks, assigns each to the best-suited agent, the agents work at the same time (streamed live to their desks), and the manager merges everything into one final result.

- A cute animated **3D isometric office floor** (meeting room with a live projector, kitchen, lounge, yellow corridor, open-plan workspace). Chubby pastel animal workers (bear, bunny, cat, hamster, puppy, chick) turn and wave when idle, face their PC and type while working, and jump up cheering with pom-poms when they finish. Drag to rotate, scroll or pinch to zoom.
- **Idle agents wander the office**: after a few seconds with nothing to do they get up and stroll the aisles and corridor to the coffee machine, fridge, ping-pong table, sofas, beanbags, water cooler, windows and whiteboard, hanging out a while at each. When work arrives (or Max starts planning) they shout "On my way!" and rush back to their desk. Routes follow hand-placed waypoints through aisles and doorways, so nobody walks through walls.
- **3D PCs on every desk** show each agent's real AI output streaming like a terminal (scanline, blinking LED, keys lighting up as they type). While the manager plans, every worker turns to face the meeting room, monitors show spinners, Max presents at the projector and his dashboard sweeps a progress bar.
- Black + green **glassmorphism** UI.
- **Works with zero setup**: with no AI key (or when the cloud quota runs out, or a visitor has no access code), agents run on a small model **inside your browser** via WebGPU (Qwen2.5 1.5B, ~1 GB one-time download).
- Run several tasks at once; the office floor shows who is working on what.
- Hire your own agents (name, role, instructions) for custom work.
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
