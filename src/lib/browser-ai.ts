import type { MLCEngine } from "@mlc-ai/web-llm";
import { useSyncExternalStore } from "react";

/**
 * The office AI runs entirely in the browser on the GPU (WebGPU via WebLLM): no API key, no server.
 * Qwen 3.5 in three sizes; "auto" picks one that suits the device and steps down if it can't load.
 */

export type ModelTier = "light" | "smart" | "max";
export type ModelChoice = "auto" | ModelTier;
export const MODEL_CHOICES: ModelChoice[] = ["auto", "light", "smart", "max"];
const TIERS: ModelTier[] = ["light", "smart", "max"];

export const MODELS: Record<ModelTier, { name: string; base: string; download: string; vram: string; maxTokens: number }> = {
  light: { name: "Qwen 3.5 2B", base: "Qwen3.5-2B", download: "1.3 GB", vram: "2.5 GB", maxTokens: 800 },
  smart: { name: "Qwen 3.5 4B", base: "Qwen3.5-4B", download: "2.6 GB", vram: "4 GB", maxTokens: 1100 },
  max: { name: "Qwen 3.5 9B", base: "Qwen3.5-9B", download: "5.5 GB", vram: "6.5 GB", maxTokens: 1300 },
};

// ---------- Settings (saved in this browser) ----------

export type AiSettings = { model: ModelChoice; review: boolean };
const SETTINGS_KEY = "office.ai";
const DEFAULT_SETTINGS: AiSettings = { model: "auto", review: true };
let settings: AiSettings = DEFAULT_SETTINGS;
let settingsLoaded = false;
const settingsListeners = new Set<() => void>();

function loadSettings() {
  if (settingsLoaded || typeof window === "undefined") return;
  settingsLoaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<AiSettings> | null;
    if (raw)
      settings = {
        model: MODEL_CHOICES.includes(raw.model as ModelChoice) ? (raw.model as ModelChoice) : "auto",
        review: typeof raw.review === "boolean" ? raw.review : true,
      };
  } catch {
    // storage unavailable: defaults
  }
}

export function getAiSettings() {
  loadSettings();
  return settings;
}

export function setAiSettings(patch: Partial<AiSettings>) {
  loadSettings();
  const modelChanged = patch.model !== undefined && patch.model !== settings.model;
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
  settingsListeners.forEach((l) => l());
  // a different model loads on the next request, once the current one finishes
  if (modelChanged) unloadAfterQueue();
}

function subscribeSettings(listener: () => void) {
  loadSettings();
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function useAiSettings() {
  return useSyncExternalStore(subscribeSettings, getAiSettings, () => DEFAULT_SETTINGS);
}

// ---------- Engine ----------

export type EngineState =
  | { status: "idle" }
  | { status: "loading"; progress: number; text: string; tier: ModelTier }
  | { status: "ready"; tier: ModelTier }
  | { status: "error"; message: string };

let state: EngineState = { status: "idle" };
let enginePromise: Promise<MLCEngine> | null = null;
let loadedTier: ModelTier = "smart";
const listeners = new Set<() => void>();

function setState(next: EngineState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeEngine(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEngineState() {
  return state;
}

export function webGpuSupported() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/** Phones and low-memory machines get the light model; everything else the smart one. */
function autoTier(): ModelTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const phone = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  if (phone || (nav.deviceMemory ?? 8) <= 4) return "light";
  return "smart";
}

/** The model the current settings ask for. */
export function wantedTier(): ModelTier {
  const choice = getAiSettings().model;
  return choice === "auto" ? autoTier() : choice;
}

/** The tier actually loaded (or loading), for the per-tier output length. */
export function currentTier() {
  return loadedTier;
}

/** The bit of the WebGPU API used here (the full types aren't installed). */
type WebGpu = { requestAdapter(o?: { powerPreference?: string }): Promise<{ features: { has(f: string): boolean } } | null> };

async function load(): Promise<MLCEngine> {
  const gpu = (navigator as Navigator & { gpu: WebGpu }).gpu;
  const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("No graphics adapter is available for WebGPU.");
  // half-precision weights are smaller and faster, but not every GPU supports them
  const f16 = adapter.features.has("shader-f16");
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  // try the wanted size first, then smaller ones (e.g. not enough graphics memory)
  const order = TIERS.slice(0, TIERS.indexOf(wantedTier()) + 1).reverse();
  let lastError: Error | null = null;
  for (const tier of order) {
    loadedTier = tier;
    const id = `${MODELS[tier].base}-${f16 ? "q4f16_1" : "q4f32_1"}-MLC`;
    setState({ status: "loading", progress: 0, text: "", tier });
    try {
      const engine = await CreateMLCEngine(id, {
        initProgressCallback: (r) => setState({ status: "loading", progress: r.progress, text: r.text, tier }),
      });
      setState({ status: "ready", tier });
      return engine;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error("The office AI could not start.");
}

export function getEngine(): Promise<MLCEngine> {
  if (!enginePromise) {
    if (!webGpuSupported()) {
      const message = "no-webgpu";
      setState({ status: "error", message });
      return Promise.reject(new Error("This browser has no WebGPU, so the office AI can't run here. Try a recent Chrome or Edge."));
    }
    enginePromise = load().catch((err: Error) => {
      enginePromise = null;
      setState({ status: "error", message: err.message });
      throw err;
    });
  }
  return enginePromise;
}

/**
 * Qwen 3.5 still opens its reply with a (here empty) <think>…</think> block. Drop it, and while streaming
 * hold back anything that might be the start of one, so only the answer itself is shown.
 */
const THINK_OPEN = "<think>";
function visibleText(raw: string) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
  const open = text.indexOf(THINK_OPEN);
  if (open >= 0) text = text.slice(0, open);
  for (let n = Math.min(THINK_OPEN.length - 1, text.length); n > 0; n--) {
    if (THINK_OPEN.startsWith(text.slice(-n))) return text.slice(0, -n);
  }
  return text;
}

// One local model can only generate one reply at a time, so calls queue up.
let queue: Promise<unknown> = Promise.resolve();

function unloadAfterQueue() {
  const unload = async () => {
    const pending = enginePromise;
    enginePromise = null;
    if (!pending) return;
    const engine = await pending.catch(() => null);
    await engine?.unload().catch(() => {});
    setState({ status: "idle" });
  };
  queue = queue.then(unload, unload);
}

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
        // Qwen's recommended settings for direct (non-thinking) answers
        temperature: opts.json ? 0.3 : 0.7,
        top_p: 0.8,
        presence_penalty: 0.5,
        extra_body: { enable_thinking: false },
        ...(opts.json ? { response_format: { type: "json_object" as const, schema: opts.json } } : {}),
      });
      let raw = "";
      let shown = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (!delta) continue;
        raw += delta;
        const visible = visibleText(raw).trimStart();
        if (visible.length > shown.length && visible.startsWith(shown)) {
          opts.onText?.(visible.slice(shown.length));
          shown = visible;
        }
      }
      if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
      const text = raw.replace(/<think>[\s\S]*?(<\/think>|$)\s*/g, "").trim();
      if (text.length > shown.length && text.startsWith(shown)) opts.onText?.(text.slice(shown.length));
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
