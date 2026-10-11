import type { MLCEngine } from "@mlc-ai/web-llm";

/** Small model that runs fully in the browser via WebGPU: no API key, no server cost. */
export const BROWSER_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export type EngineState =
  | { status: "idle" }
  | { status: "loading"; progress: number; text: string }
  | { status: "ready" }
  | { status: "error"; message: string };

let state: EngineState = { status: "idle" };
let enginePromise: Promise<MLCEngine> | null = null;
const listeners = new Set<() => void>();

function setState(next: EngineState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeEngine(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEngineState() {
  return state;
}

export function webGpuSupported() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getEngine(): Promise<MLCEngine> {
  if (!enginePromise) {
    if (!webGpuSupported()) {
      const message = "This browser has no WebGPU, so the in-browser AI can't run. Try a recent Chrome or Edge.";
      setState({ status: "error", message });
      return Promise.reject(new Error(message));
    }
    setState({ status: "loading", progress: 0, text: "Starting the office AI…" });
    enginePromise = import("@mlc-ai/web-llm")
      .then(({ CreateMLCEngine }) =>
        CreateMLCEngine(BROWSER_MODEL, {
          initProgressCallback: (r) => setState({ status: "loading", progress: r.progress, text: r.text }),
        }),
      )
      .then((engine) => {
        setState({ status: "ready" });
        return engine;
      })
      .catch((err: Error) => {
        enginePromise = null;
        setState({ status: "error", message: err.message });
        throw err;
      });
  }
  return enginePromise;
}

// One local model can only generate one reply at a time, so calls queue up.
let queue: Promise<unknown> = Promise.resolve();

export function chat(
  messages: { role: "system" | "user"; content: string }[],
  opts: { signal: AbortSignal; maxTokens: number; json?: string; onText?: (chunk: string) => void },
): Promise<string> {
  const run = async () => {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const engine = await getEngine();
    const onAbort = () => void engine.interruptGenerate();
    opts.signal.addEventListener("abort", onAbort);
    try {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: opts.maxTokens,
        temperature: 0.6,
        ...(opts.json ? { response_format: { type: "json_object" as const, schema: opts.json } } : {}),
      });
      let text = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          text += delta;
          opts.onText?.(delta);
        }
      }
      if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return text;
    } finally {
      opts.signal.removeEventListener("abort", onAbort);
      await engine.resetChat().catch(() => {});
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
