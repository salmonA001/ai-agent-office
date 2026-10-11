# AI Agent Office

Hand any job to a team of AI agents. The **manager** splits your task into parallel subtasks, assigns each to the best-suited agent, the agents work at the same time (streamed live to their desks), and the manager merges everything into one final result.

- Run several tasks at once; the office floor shows who is working on what.
- Hire your own agents (name, role, instructions) for custom work.
- Cancel, re-run, copy results. Task history and agents are kept in your browser.

Built with Next.js 16, React 19, Tailwind CSS 4 and AI SDK 7 through the Vercel AI Gateway.

## How it works

| Step | Route | Model |
|---|---|---|
| Plan: split the task, assign agents | `POST /api/plan` | `MANAGER_MODEL` (structured output) |
| Work: each subtask, in parallel | `POST /api/work` | `WORKER_MODEL` (streamed) |
| Merge: final deliverable | `POST /api/synthesize` | `MANAGER_MODEL` (streamed) |

## Run locally

```bash
npm install
vercel link && vercel env pull   # or put AI_GATEWAY_API_KEY in .env.local
npm run dev
```

## Configuration

See `.env.example`. Set `OFFICE_ACCESS_CODE` on any public deployment so strangers can't spend your AI credits.
