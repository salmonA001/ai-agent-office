import "server-only";
import type { z } from "zod";

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Picks the first provider with a key set, so the app runs without the Vercel AI Gateway.
 * With no provider key, models go through the AI Gateway ("provider/model" strings).
 * MANAGER_MODEL / WORKER_MODEL override the model id for whichever provider is active.
 */
function pickModels(): { manager: LanguageModel; worker: LanguageModel } {
  const m = process.env.MANAGER_MODEL;
  const w = process.env.WORKER_MODEL;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    // Separate models so the free tier's per-model daily limits go further.
    return { manager: google(m ?? "gemini-flash-latest"), worker: google(w ?? "gemini-flash-lite-latest") };
  }
  if (process.env.OPENAI_API_KEY) {
    return { manager: openai(m ?? "gpt-5.5"), worker: openai(w ?? "gpt-5.4-mini") };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { manager: anthropic(m ?? "claude-sonnet-5-5"), worker: anthropic(w ?? "claude-haiku-5-5") };
  }
  return { manager: m ?? "anthropic/claude-sonnet-5.5", worker: w ?? "anthropic/claude-haiku-5.5" };
}

const models = pickModels();
export const MANAGER_MODEL = models.manager;
export const WORKER_MODEL = models.worker;

/**
 * Optional shared access code. When OFFICE_ACCESS_CODE is set, every API call
 * must send it in the x-office-code header, so a public URL can't run up model costs.
 */
export function checkAccess(request: Request): Response | null {
  const code = process.env.OFFICE_ACCESS_CODE;
  if (!code) return null;
  if (request.headers.get("x-office-code") === code) return null;
  return Response.json({ error: "Access code required" }, { status: 401 });
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      error: Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * True when a provider key is set, or the AI Gateway is explicitly enabled
 * (AI_GATEWAY_API_KEY, or AI_GATEWAY_ENABLED=1 when relying on Vercel OIDC after billing is on).
 */
export const CLOUD_AI_CONFIGURED = Boolean(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.AI_GATEWAY_ENABLED === "1",
);

/** HTTP status from a provider error, including the last attempt inside a retry error. */
export function providerStatus(error: unknown): number {
  const e = error as { statusCode?: number; lastError?: { statusCode?: number } };
  return e.statusCode ?? e.lastError?.statusCode ?? 0;
}
