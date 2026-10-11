import "server-only";
import type { z } from "zod";

// Models are reached through the Vercel AI Gateway with "provider/model" strings.
export const MANAGER_MODEL = process.env.MANAGER_MODEL ?? "anthropic/claude-sonnet-5.5";
export const WORKER_MODEL = process.env.WORKER_MODEL ?? "anthropic/claude-haiku-5.5";

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
