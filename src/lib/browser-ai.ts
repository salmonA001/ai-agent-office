import type { MLCEngine } from "@mlc-ai/web-llm";
import { importFresh } from "./stale-build";
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

/** Qwen 3.5 in WebLLM reads text only, so pictures are described first by a vision model. */
export const VISION_MODEL = { name: "Phi 3.5 Vision", base: "Phi-3.5-vision-instruct", download: "2.4 GB", vram: "4 GB" };

export function modelInfo(tier: ModelTier | "vision") {
  return tier === "vision" ? VISION_MODEL : MODELS[tier];
}

/** Every model here sees 4,096 tokens in total (prompt plus reply). */
const CONTEXT = 4096;

/** Rough token count: about 3.5 characters per token in English, fewer for Thai and other scripts. */
function estimateTokens(text: string) {
  let ascii = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) < 128) ascii++;
  return Math.ceil(ascii / 3.5 + (text.length - ascii) / 1.3);
}

// ---------- Settings (saved in this browser) ----------

export type AiSettings = { model: ModelChoice; review: boolean; think: boolean };
const SETTINGS_KEY = "office.ai";
const DEFAULT_SETTINGS: AiSettings = { model: "auto", review: true, think: false };
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
        think: raw.think === true,
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
  | { status: "loading"; progress: number; text: string; tier: ModelTier | "vision" }
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
  const { CreateMLCEngine } = await importFresh(() => import("@mlc-ai/web-llm"));
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

type ChatOpts = {
  signal: AbortSignal;
  maxTokens: number;
  json?: string;
  /** think it through first: write reasoning notes, then answer from them */
  think?: boolean;
  onText?: (chunk: string) => void;
  /** the reasoning notes as they stream, in think mode */
  onThink?: (chunk: string) => void;
  /** lower = more careful and consistent (facts, checks); higher = more varied (ideas, prose) */
  temperature?: number;
};

type Message = { role: "system" | "user"; content: string };

const NOTES_PROMPT =
  "Before answering, think it through. Write brief bullet-point notes only, not the answer: what exactly is asked, " +
  "the key points, facts and numbers to include, the best structure, and mistakes to avoid.";

/** The same conversation with something added to the last (user) message. */
const withNote = (messages: Message[], note: string): Message[] => {
  const last = messages[messages.length - 1];
  return [...messages.slice(0, -1), { ...last, content: `${last.content}

${note}` }];
};

export function chat(messages: Message[], opts: ChatOpts): Promise<string> {
  const run = async () => {
    if (!opts.think || opts.json) return generate(messages, opts);
    // think mode: reasoning notes first (shown live), then the answer written from them. The small
    // Qwen 3.5 models rarely start their own <think> block, so the step is made explicit.
    const notes = await generate(withNote(messages, NOTES_PROMPT), { signal: opts.signal, maxTokens: 450, onText: opts.onThink });
    return generate(withNote(messages, `Your notes from thinking it through:
${notes}

Now write the final answer, following your notes.`), opts);
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

async function generate(messages: Message[], opts: ChatOpts): Promise<string> {
  {
    if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const engine = await getEngine();
    const onAbort = () => void engine.interruptGenerate();
    opts.signal.addEventListener("abort", onAbort);
    // keep prompt + reply inside the context window
    const prompt = estimateTokens(messages.map((m) => m.content).join("\n")) + 40 * messages.length;
    const maxTokens = Math.max(200, Math.min(opts.maxTokens, CONTEXT - prompt - 64));
    try {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: maxTokens,
        // Qwen's recommended settings for direct answers: precise for JSON, a little warmer for prose
        // careful by default: small models invent less when they sample less freely
        temperature: opts.temperature ?? (opts.json ? 0.2 : 0.6),
        top_p: 0.8,
        // a repetition penalty would also punish the repeated keys of JSON ("question", "options")
        presence_penalty: opts.json ? 0 : 0.3,
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
  }
}

/**
 * Describe a picture for the team. The text model is unloaded first (graphics memory is tight),
 * the vision model reads the picture, then it is unloaded again; the text model reloads from the
 * browser cache on the next request.
 */
export function describeImage(dataUrl: string, question: string, signal: AbortSignal): Promise<string> {
  const run = async () => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (!webGpuSupported()) throw new Error("This browser has no WebGPU.");
    const pending = enginePromise;
    enginePromise = null;
    const text = await pending?.catch(() => null);
    await text?.unload().catch(() => {});
    const gpu = (navigator as Navigator & { gpu: WebGpu }).gpu;
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    const f16 = adapter?.features.has("shader-f16") ?? false;
    const { CreateMLCEngine } = await importFresh(() => import("@mlc-ai/web-llm"));
    setState({ status: "loading", progress: 0, text: "", tier: "vision" });
    const engine = await CreateMLCEngine(`${VISION_MODEL.base}-${f16 ? "q4f16_1" : "q4f32_1"}-MLC`, {
      initProgressCallback: (r) => setState({ status: "loading", progress: r.progress, text: r.text, tier: "vision" }),
    });
    setState({ status: "idle" });
    const onAbort = () => void engine.interruptGenerate();
    signal.addEventListener("abort", onAbort);
    try {
      const reply = await engine.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Describe this picture in detail for a colleague who cannot see it: what it shows, every piece of text in it (quoted exactly), " +
                  `numbers, layout and colours. The colleague's task is: "${question.slice(0, 400)}". Focus on what matters for that task.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 600,
        temperature: 0.2,
      });
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      return (reply.choices[0]?.message?.content ?? "").trim();
    } finally {
      signal.removeEventListener("abort", onAbort);
      await engine.unload().catch(() => {});
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
