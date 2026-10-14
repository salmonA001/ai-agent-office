"use client";

import {
  ArrowSquareOutIcon,
  BrainIcon,
  ExamIcon,
  FilePdfIcon,
  FileTextIcon,
  GraduationCapIcon,
  LightningIcon,
  PaperclipIcon,
  PaperPlaneRightIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { type RefObject, useRef, useState } from "react";
import { setAiSettings, useAiSettings } from "@/lib/browser-ai";
import { type Key, useI18n } from "@/lib/i18n";
import type { StudyLevel, TaskKind } from "@/lib/run-task";
import { QUIZ_SIZES } from "@/lib/study";
import { importFresh } from "@/lib/stale-build";
import { HoverPill, SegmentThumb } from "./chrome";
import { EXAM_GROUPS, EXAMS, examById, PAST_PAPERS } from "@/lib/exams";

/** A file picked for the next task: pictures are shrunk to a data URL, text files are read as text. */
export type ComposerFile = { id: string; name: string; kind: "image" | "text"; size: number; dataUrl?: string; text?: string; pdf?: boolean };

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
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > 30e6) throw new Error("big");
    // read in the browser; a scanned paper (pictures of pages) has no text to read
    const { pdfText } = await importFresh(() => import("@/lib/pdf-text"));
    try {
      return { ...base, kind: "text", pdf: true, text: (await pdfText(file)).text };
    } catch (err) {
      throw new Error((err as Error).message === "scanned" ? "scanned" : "pdf");
    }
  }
  if (file.type.startsWith("text/") || file.type === "application/json" || TEXT_FILE.test(file.name)) {
    if (file.size > 5e6) throw new Error("big");
    return { ...base, kind: "text", text: (await file.text()).slice(0, 20000) };
  }
  throw new Error("type");
}

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const LEVELS: StudyLevel[] = ["beginner", "intermediate", "advanced"];

/** A small segmented control (radio group) for the composer's options. */
function Segments<T extends string | number>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="relative flex gap-1 rounded-lg bg-well p-1">
        <HoverPill />
        <SegmentThumb index={options.findIndex((o) => o.value === value)} count={options.length} />
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.value)}
              className={`press relative z-10 min-h-10 flex-1 basis-0 rounded-md px-2 text-sm font-semibold ${
                on ? "text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The "new task" box: what it's for (team work, a lesson or a practice quiz), the text, attached
 * files and pictures, and fast or think mode.
 */
export function TaskComposer({
  composerRef,
  onSubmit,
}: {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onSubmit: (task: {
    text: string;
    files: ComposerFile[];
    think: boolean;
    kind: TaskKind;
    level: StudyLevel;
    count: number;
    exam?: string;
  }) => void;
}) {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<TaskKind>("team");
  const [level, setLevel] = useState<StudyLevel>("intermediate");
  const [count, setCount] = useState<number>(5);
  // exam prep: a preset exam to practise for (test mode only)
  const [examId, setExamId] = useState("");
  const exam = kind === "test" ? examById(examId) : undefined;
  const pickExam = (id: string) => {
    setExamId(id);
    const e = examById(id);
    if (e) {
      setLevel(e.level);
      setCount(e.count);
    }
  };
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
        const why = (err as Error).message;
        setProblem(
          t(why === "big" ? "attach.tooBig" : why === "scanned" ? "attach.scanned" : why === "pdf" ? "attach.badPdf" : "attach.unsupported", {
            name: f.name,
          }),
        );
      }
    }
    if (read.length) setFiles((cur) => [...cur, ...read].slice(0, MAX_FILES));
  };

  // with an exam picked, the text is only an optional focus
  const ready = prompt.trim().length >= 3 || !!exam;
  const submit = () => {
    const text = prompt.trim();
    if (!ready) return;
    onSubmit({ text: text || (exam ? exam.name[lang] : text), files, think: ai.think, kind, level, count, ...(exam ? { exam: exam.id } : {}) });
    setPrompt("");
    setFiles([]);
    setProblem(null);
  };

  const modes = [
    { think: false, label: t("mode.fast"), I: LightningIcon },
    { think: true, label: t("mode.think"), I: BrainIcon },
  ];
  const kinds = [
    { kind: "team" as const, label: t("purpose.team"), I: UsersThreeIcon },
    { kind: "learn" as const, label: t("purpose.learn"), I: GraduationCapIcon },
    { kind: "test" as const, label: t("purpose.test"), I: ExamIcon },
  ];
  const placeholder = exam
    ? t("composer.examPlaceholder")
    : kind === "learn"
      ? t("composer.learnPlaceholder")
      : kind === "test"
        ? t("composer.testPlaceholder")
        : t("composer.placeholder");
  // past papers for the chosen exam first
  const papers = exam ? [...PAST_PAPERS].sort((a, b) => Number(b.groups.includes(exam.group)) - Number(a.groups.includes(exam.group))) : PAST_PAPERS;
  const submitLabel = kind === "learn" ? t("composer.submitLearn") : kind === "test" ? t("composer.submitTest") : t("composer.submit");

  return (
    <form
      className={`glass enter flex flex-col gap-3 rounded-2xl p-5 transition-[box-shadow,border-color] duration-200 ${dragging ? "border-accent ring-2 ring-accent/50" : ""}`}
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
      <label htmlFor="task" className="text-lg font-semibold">
        {t("composer.title")}
      </label>
      <div className="flex flex-col gap-1">
        <div role="radiogroup" aria-label={t("purpose.label")} className="relative grid grid-cols-3 gap-1 rounded-lg bg-well p-1">
          <HoverPill />
          <SegmentThumb index={kinds.findIndex((k) => k.kind === kind)} count={kinds.length} />
          {kinds.map(({ kind: k, label, I }) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(k)}
                className={`press relative z-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-1 text-base font-semibold ${
                  on ? "text-on-accent" : "text-muted hover:text-ink"
                }`}
              >
                <I size={16} weight={on ? "fill" : "duotone"} aria-hidden className="shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
        <p key={kind} className="enter-fade text-xs text-muted" aria-live="polite">
          {t(`purpose.${kind}Hint` as Key)}
        </p>
      </div>
      {kind === "test" && (
        <div className="enter-drop flex flex-col gap-1.5 rounded-lg border border-line bg-well/60 p-2.5">
          <label htmlFor="exam" className="text-xs font-semibold">
            {t("exam.label")}
          </label>
          <select
            id="exam"
            value={examId}
            onChange={(e) => pickExam(e.target.value)}
            className="min-h-10 rounded-lg border border-line bg-surface px-2 text-sm text-ink transition-colors focus:border-accent/60"
          >
            <option value="">{t("exam.none")}</option>
            {EXAM_GROUPS.map((g) => (
              <optgroup key={g} label={t(`exam.group.${g}` as Key)}>
                {EXAMS.filter((e) => e.group === g).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name[lang]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {exam && (
            <p className="enter-fade text-xs text-muted">
              {t("exam.hint", { n: count, min: Math.round(count * exam.minutesPerQuestion) })}
              {exam.note && <span className="mt-0.5 block text-error/90">{exam.note[lang]}</span>}
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-muted hover:text-ink">{t("exam.papers")}</summary>
            <p className="enter-fade mt-1.5 text-muted">{t("exam.papersHint")}</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {papers.map((p) => (
                <li key={p.url}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-8 items-center gap-1.5 text-link underline-offset-2 hover:underline"
                  >
                    <ArrowSquareOutIcon size={14} weight="bold" aria-hidden />
                    {p.name[lang]}
                    <span className="sr-only"> {t("exam.newTab")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
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
        rows={8}
        maxLength={4000}
        placeholder={placeholder}
        className="min-h-48 resize-y rounded-xl border border-line bg-well p-4 text-base leading-relaxed text-ink transition-colors placeholder:text-muted/80 focus:border-accent/60"
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("attach.list")}>
          {files.map((f) => (
            <li key={f.id} className="enter-pop flex max-w-full items-center gap-2 rounded-lg border border-line bg-well py-1 pr-1 pl-1.5 text-xs">
              {f.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview, nothing to optimise
                <img src={f.dataUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : f.pdf ? (
                <FilePdfIcon size={20} weight="duotone" aria-hidden className="shrink-0 text-accent" />
              ) : (
                <FileTextIcon size={20} weight="duotone" aria-hidden className="shrink-0 text-accent" />
              )}
              <span className="min-w-0">
                <span className="block max-w-40 truncate font-medium">{f.name}</span>
                <span className="block text-muted">
                  {f.kind === "image" ? t("attach.picture") : f.pdf ? "PDF" : t("attach.text")} · {sizeText(f.size)}
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

      {kind !== "team" && (
        <div className="enter-drop grid gap-2">
          <Segments
            label={t("study.level")}
            value={level}
            options={LEVELS.map((l) => ({ value: l, label: t(`study.${l}` as Key) }))}
            onPick={setLevel}
          />
          {kind === "test" && (
            <Segments label={t("study.count")} value={count} options={QUIZ_SIZES.map((n) => ({ value: n, label: String(n) }))} onPick={setCount} />
          )}
        </div>
      )}

      <div className={`flex flex-col gap-1 ${kind === "test" ? "hidden" : ""}`}>
        <div role="radiogroup" aria-label={t("mode.label")} className="relative grid grid-cols-2 gap-1 rounded-lg bg-well p-1">
          <HoverPill />
          <SegmentThumb index={ai.think ? 1 : 0} count={2} />
          {modes.map(({ think, label, I }) => {
            const on = ai.think === think;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAiSettings({ think })}
                className={`press relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-base font-semibold ${
                  on ? "text-on-accent" : "text-muted hover:text-ink"
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
            accept="image/*,text/*,application/pdf,.pdf,.md,.csv,.json,.xml,.yaml,.yml,.html,.css,.js,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.log"
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
            className="press inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-line px-4 text-base font-semibold text-muted transition-colors hover:border-accent/60 hover:text-ink disabled:opacity-50"
          >
            <PaperclipIcon size={16} weight="bold" aria-hidden />
            <span>{t("attach.button")}</span>
          </button>
        </div>
        <button
          type="submit"
          disabled={!ready}
          title={t("composer.hint")}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          className="press inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-on-primary disabled:opacity-50"
        >
          {kind === "learn" ? (
            <GraduationCapIcon size={16} weight="bold" aria-hidden />
          ) : kind === "test" ? (
            <ExamIcon size={16} weight="bold" aria-hidden />
          ) : (
            <PaperPlaneRightIcon size={16} weight="bold" aria-hidden />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
