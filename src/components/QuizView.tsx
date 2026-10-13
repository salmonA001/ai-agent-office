"use client";

import { ArrowCounterClockwiseIcon, CheckCircleIcon, ExamIcon, GraduationCapIcon, ListChecksIcon, TrophyIcon, XCircleIcon } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import type { Quiz } from "@/lib/run-task";

const LETTERS = "ABCDEF";

/**
 * The practice quiz: pick an answer for each question, check them all at once, and see the score
 * with why each right answer is right. Then try again, retry just the missed ones, have the tutor
 * teach what was missed, or ask for a fresh quiz.
 */
export function QuizView({
  quiz,
  onChange,
  onLearnMissed,
  onNewQuiz,
}: {
  quiz: Quiz;
  onChange: (quiz: Quiz) => void;
  onLearnMissed: (missed: number[]) => void;
  onNewQuiz: () => void;
}) {
  const { t } = useI18n();
  const { questions, picked, checked } = quiz;
  const shown = quiz.only ?? questions.map((_, i) => i);
  const answered = shown.filter((i) => picked[i] !== null).length;
  const right = shown.filter((i) => picked[i] === questions[i].answer);
  const missed = shown.filter((i) => picked[i] !== questions[i].answer);
  const pct = shown.length ? Math.round((right.length / shown.length) * 100) : 0;
  const message = pct >= 90 ? t("quiz.great") : pct >= 60 ? t("quiz.good") : t("quiz.keep");

  const pick = (i: number, option: number) => {
    if (checked) return;
    onChange({ ...quiz, picked: picked.map((p, j) => (j === i ? option : p)) });
  };
  const check = () => {
    const attempts = (quiz.attempts ?? 0) + 1;
    // the best score counts full runs only
    const best = quiz.only ? quiz.best : Math.max(quiz.best ?? 0, pct);
    onChange({ ...quiz, checked: true, attempts, best });
  };
  const again = (only?: number[]) =>
    onChange({ ...quiz, checked: false, only, picked: picked.map((p, j) => ((only ?? shown).includes(j) ? null : p)) });

  return (
    <section aria-labelledby="quiz-heading" className="glass glow enter-pop flex flex-col gap-4 rounded-2xl border-accent/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="quiz-heading" className="inline-flex items-center gap-2 font-semibold text-accent">
          <ExamIcon size={20} weight="duotone" aria-hidden />
          {quiz.only ? t("quiz.retryTitle", { n: shown.length }) : t("quiz.title")}
        </h3>
        <p className="text-xs text-muted tabular-nums" aria-live="polite">
          {checked ? t("quiz.score", { right: right.length, total: shown.length, pct }) : t("quiz.progress", { n: answered, total: shown.length })}
          {quiz.best !== undefined && ` · ${t("quiz.best", { pct: quiz.best })}`}
        </p>
      </div>

      {!checked && (
        <div className="h-1.5 overflow-hidden rounded-full bg-well" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(answered / shown.length) * 100}%` }} />
        </div>
      )}

      {checked && (
        <div role="status" className="enter-pop flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
          <TrophyIcon size={32} weight="duotone" aria-hidden className="shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums">
              {right.length}/{shown.length} <span className="text-sm font-semibold text-muted">({pct}%)</span>
            </p>
            <p className="text-sm">{message}</p>
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {shown.map((i, k) => {
          const q = questions[i];
          const mine = picked[i];
          const ok = mine === q.answer;
          return (
            <li key={i} className="enter rounded-xl border border-line bg-well p-3" style={{ ["--i" as string]: Math.min(k, 10) }}>
              <fieldset>
                <legend className="mb-2 font-semibold">
                  <span className="mr-1.5 text-accent tabular-nums">{k + 1}.</span>
                  {q.question}
                </legend>
                <div className="flex flex-col gap-1.5">
                  {q.options.map((o, j) => {
                    const chosen = mine === j;
                    const isAnswer = j === q.answer;
                    const state = !checked ? (chosen ? "chosen" : "idle") : isAnswer ? "right" : chosen ? "wrong" : "dim";
                    const look = {
                      idle: "border-line hover:border-accent/60",
                      chosen: "border-accent bg-accent/15",
                      right: "border-accent bg-accent/15",
                      wrong: "border-danger bg-danger/10",
                      dim: "border-line opacity-60",
                    }[state];
                    return (
                      <label
                        key={j}
                        className={`press flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${look} ${checked ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          name={`q-${i}`}
                          checked={chosen}
                          disabled={checked}
                          onChange={() => pick(i, j)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold ${
                            chosen || state === "right" ? "bg-accent text-on-accent" : "bg-line text-ink"
                          } ${state === "wrong" ? "bg-danger text-on-danger" : ""}`}
                        >
                          {LETTERS[j]}
                        </span>
                        <span className="min-w-0 flex-1">{o}</span>
                        {state === "right" && <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-accent" aria-label={t("quiz.correctAnswer")} />}
                        {state === "wrong" && <XCircleIcon size={18} weight="fill" className="shrink-0 text-error" aria-label={t("quiz.yourAnswer")} />}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {checked && (
                <p className={`enter-fade mt-2 rounded-lg px-2.5 py-1.5 text-sm ${ok ? "bg-accent/10" : "bg-danger/10"}`}>
                  <span className={`font-semibold ${ok ? "text-accent" : "text-error"}`}>
                    {ok ? t("quiz.correct") : mine === null ? t("quiz.skipped") : t("quiz.wrong")}{" "}
                  </span>
                  {!ok && <span className="font-semibold">{t("quiz.answerWas", { a: `${LETTERS[q.answer]}. ${q.options[q.answer]}` })} </span>}
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!checked ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={check}
            disabled={answered === 0}
            className="press inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-on-primary disabled:opacity-50"
          >
            <ListChecksIcon size={18} weight="bold" aria-hidden />
            {t("quiz.check")}
          </button>
          {answered < shown.length && <p className="text-xs text-muted">{t("quiz.left", { n: shown.length - answered })}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => again()}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent/60"
          >
            <ArrowCounterClockwiseIcon size={16} weight="bold" aria-hidden />
            {t("quiz.retry")}
          </button>
          {missed.length > 0 && missed.length < shown.length && (
            <button
              type="button"
              onClick={() => again(missed)}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent/60"
            >
              <XCircleIcon size={16} weight="bold" aria-hidden />
              {t("quiz.retryMissed", { n: missed.length })}
            </button>
          )}
          {missed.length > 0 && (
            <button
              type="button"
              onClick={() => onLearnMissed(missed)}
              className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary"
            >
              <GraduationCapIcon size={16} weight="bold" aria-hidden />
              {t("quiz.learnMissed")}
            </button>
          )}
          <button
            type="button"
            onClick={onNewQuiz}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent/60"
          >
            <ExamIcon size={16} weight="bold" aria-hidden />
            {t("quiz.newQuiz")}
          </button>
        </div>
      )}
    </section>
  );
}
