import { connection } from "next/server";
import { CLOUD_AI_CONFIGURED } from "@/lib/server";

/** Tells the browser whether server-side AI is set up; if not, it runs a model locally. */
export async function GET() {
  await connection(); // read env at request time, not build time
  return Response.json({ cloud: CLOUD_AI_CONFIGURED });
}
