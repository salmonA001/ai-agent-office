"use client";

import { BrainIcon, FileTextIcon, LightningIcon, PaperclipIcon, PaperPlaneRightIcon, XIcon } from "@phosphor-icons/react";
import { type RefObject, useRef, useState } from "react";
import { setAiSettings, useAiSettings } from "@/lib/browser-ai";
import { useI18n } from "@/lib/i18n";

/** A file picked for the next task: pictures are shrunk to a data URL, text files are read as text. */
export type ComposerFile = { id: string; name: string; kind: "image" | "text"; size: number; dataUrl?: string; text?: string };

const MAX_FILES = 4;
const TEXT_FILE = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|css|jsx?|tsx?|py|java|c|cpp|h|cs|go|rs|rb|php|sql|sh|log|ini|toml)$/i;
/**
 * Pictures are letterboxed onto a 3:2 (landscape) or 3:4 (portrait) canvas. The vision model's
 * token count depends only on the aspect ratio, and these two stay under the 2,048 tokens it can
 * take in one go (a square or 16:9 picture would not).
 */
const IMAGE_FRAME = { landscape: [768, 512], portrait: [576, 768] } as const;

async function readFile(file: File): Promise<ComposerFile> {
  const base = { id: crypto.randomUUID(), name: file.name || "pasted-image.png", size: file.size };
  if (file.type.startsWith("image/")) {
    if (file.size > 20e6) throw new Error("big");
    const bmp = await createImageBitmap(file);
    const [w, h] = bmp.width >= bmp.height ? IMAGE_FRAME.landscape : IMAGE_FRAME.portrait;
    const k = Math.min(w / bmp.width, h / bmp.height);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    const [dw, dh] = [bmp.width * k, bmp.height * k];
    g.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
    bmp.close();
    return { ...base, kind: "image", dataUrl: c.toDataURL("image/jpeg", 0.85) };
  }
  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_FILE.test(file.name)) {
    if (file.size > 5e6) throw new Error("big");
    return { ...base, kind: "text", text: (await file.text()).slice(0, 20000) };
  }
  throw new Error("type");
}

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The "new task" box: text, attached files and pictures, and fast or think mode. */
export function TaskComposer({
  composerRef,
  onSubmit,
}: {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: (task: { text: string; files: ComposerFile[]; think: boolean }) => void;
}) {
  const { t } = useI18n();
  const ai = useAiSettings();
  const input = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const add = async (list: FileList | File[]) => {
    setProblem(null);
    const incoming = [...list];
    const room = MAX_FILES - files.length;
    if (incoming.length > room) setProblem(t("attach.tooMany", { n: MAX_FILES }));
    const read: ComposerFile[] = [];
    for (const f of incoming.slice(0, Math.max(0, room))) {
      try {
        read.push(await readFile(f));
      } catch (err) {
        setProblem(t((err as Error).message === "big" ? "attach.tooBig" : "attach.unsupported", { name: f.name }));
      }
    }
    if (read.length) setFiles((cur) => [...cur, ...read].slice(0, MAX_FILES));
  };

  const submit = () => {
    const text = prompt.trim();
    if (text.length < 3) return;
    onSubmit({ text, files, think: ai.think });
    setPrompt("");
    setFiles([]);
    setProblem(null);
  };

  const modes = [
    { think: false, label: t("mode.fast"), I: LightningIcon },
    { think: true, label: t("mode.think"), I: BrainIcon },
  ];

  return (
    <form
      className={`glass enter flex flex-col gap-2 rounded-2xl p-4 transition-[box-shadow,border-color] duration-200 ${dragging ? "border-accent ring-2 ring-accent/50" : ""}`}
      style={{ ["--i" as string]: 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        void add(e.dataTransfer.files);
      }}
    >
      <label htmlFor="task" className="font-semibold">
        {t("composer.title")}
      </label>
      <textarea
        id="task"
        ref={composerRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
        onPaste={(e) => {
          const pics = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
          if (pics.length) {
            e.preventDefault();
            void add(pics);
          }
        }}
        rows={5}
        maxLength={4000}
        placeholder={t("composer.placeholder")}
        className="resize-y rounded-lg border border-line bg-well p-3 text-sm text-ink transition-colors placeholder:text-muted/80 focus:border-accent/60"
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("attach.list")}>
          {files.map((f) => (
            <li key={f.id} className="enter-pop flex max-w-full items-center gap-2 rounded-lg border border-line bg-well py-1 pr-1 pl-1.5 text-xs">
              {f.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview, nothing to optimise
                <img src={f.dataUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : (
                <FileTextIcon size={20} weight="duotone" aria-hidden className="shrink-0 text-accent" />
              )}
              <span className="min-w-0">
                <span className="block max-w-40 truncate font-medium">{f.name}</span>
                <span className="block text-muted">
                  {f.kind === "image" ? t("attach.picture") : t("attach.text")} · {sizeText(f.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}
                aria-label={t("attach.remove", { name: f.name })}
                className="press grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-line hover:text-ink"
              >
                <XIcon size={14} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p role="alert" className="text-xs text-error">
          {problem}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <div role="radiogroup" aria-label={t("mode.label")} className="grid grid-cols-2 gap-1 rounded-lg bg-well p-1">
          {modes.map(({ think, label, I }) => {
            const on = ai.think === think;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAiSettings({ think })}
                className={`press inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors duration-200 ${
                  on ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <I size={16} weight={on ? "fill" : "duotone"} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {ai.think ? t("mode.thinkHint") : t("mode.fastHint")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={input}
            type="file"
            tabIndex={-1}
            aria-hidden
            multiple
            accept="image/*,text/*,.md,.csv,.json,.xml,.yaml,.yml,.html,.css,.js,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.log"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void add(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={files.length >= MAX_FILES}
            title={t("attach.add")}
            aria-label={t("attach.add")}
            className="press inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-muted transition-colors hover:border-accent/60 hover:text-ink disabled:opacity-50"
          >
            <PaperclipIcon size={16} weight="bold" aria-hidden />
            <span>{t("attach.button")}</span>
          </button>
        </div>
        <button
          type="submit"
          disabled={prompt.trim().length < 3}
          title={t("composer.hint")}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          className="press inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
        >
          <PaperPlaneRightIcon size={16} weight="bold" aria-hidden />
          {t("composer.submit")}
        </button>
      </div>
    </form>
  );
}
