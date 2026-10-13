import type { Agent } from "./agents";
import { chat, currentTier, MODELS } from "./browser-ai";
import { examById } from "./exams";
import { type Lang, translate } from "./i18n";
import { quizItem } from "./schemas";
import {
  FILES_BUDGET,
  filesBlock,
  LANG_RULE,
  prepareFiles,
  type QuizQuestion,
  type StudyLevel,
  type Subtask,
  type Task,
  taskLogger,
  type Update,
} from "./run-task";
import { countWords } from "./words";

/**
 * Learning help: a lesson from the office tutor, or a practice quiz the learner answers in the
 * app (written by the tutor, with the answer key cross-checked by the QA tester).
 */

const LEVEL: Record<StudyLevel, string> = {
  beginner: "a complete beginner: everyday words, short sentences, and an analogy for anything abstract",
  intermediate: "a student who knows the basics: use the proper terms and explain each briefly",
  advanced: "an advanced learner: precise terms, nuance, edge cases and why it works",
};

export const QUIZ_SIZES = [5, 8, 10] as const;

/** The first of these agents on the team (the tutor, ideally), or anyone. */
function pick(team: Agent[], ids: string[], not?: string) {
  for (const id of ids) {
    const a = team.find((x) => x.id === id && x.id !== not);
    if (a) return a;
  }
  return team.find((x) => x.id !== not) ?? team[0];
}

const shortTopic = (text: string) => (text.length > 70 ? `${text.slice(0, 68)}…` : text);

type Opts = { check: boolean; images?: Record<string, string> };

export async function runStudy(task: Task, team: Agent[], signal: AbortSignal, update: Update, lang: Lang, opts: Opts) {
  const log = taskLogger(update);
  const files = await prepareFiles(task, signal, update, log, opts.images);
  if (task.kind === "test") await quiz(task, team, files, signal, update, log, lang, opts.check);
  else await lesson(task, team, files, signal, update, log, lang);
  update((t) => ({ ...t, status: "done" }));
  log("finish", "ev.finish", { s: Math.round((Date.now() - task.createdAt) / 1000) });
}

const setSub = (update: Update, i: number, fn: (s: Subtask) => Subtask) =>
  update((t) => ({ ...t, subtasks: t.subtasks.map((s, j) => (j === i ? fn(s) : s)) }));

// ---------- Lesson ----------

async function lesson(
  task: Task,
  team: Agent[],
  files: Parameters<typeof filesBlock>[0],
  signal: AbortSignal,
  update: Update,
  log: ReturnType<typeof taskLogger>,
  lang: Lang,
) {
  const tutor = pick(team, ["tutor", "writer", "researcher"]);
  const level = task.level ?? "intermediate";
  const title = translate(lang, "study.lessonTitle");
  const reason = translate(lang, "study.lessonWhy", { name: tutor.name });
  log("plan", "ev.studyLesson", { name: tutor.name });
  log("assign", "ev.assign", { name: tutor.name, title, reason }, tutor.id);
  update((t) => ({
    ...t,
    status: "working",
    subtasks: [{ id: `${t.id}-0`, agentId: tutor.id, title, brief: task.prompt, reason, status: "queued", output: "" }],
  }));
  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    log("start", "ev.start", { name: tutor.name, title }, tutor.id);
    setSub(update, 0, (s) => ({ ...s, status: "working", startedAt: Date.now() }));
  };
  const notes = filesBlock(files, FILES_BUDGET);
  const output = await chat(
    [
      {
        role: "system",
        content:
          `You are ${tutor.name}, the ${tutor.role} in an AI office, teaching a learner one to one. ${tutor.instructions}\n` +
          `Teach for ${LEVEL[level]}.\n` +
          "Use exactly these Markdown sections:\n" +
          "## The big idea: 2-3 plain sentences on what it is and why it matters.\n" +
          "## Step by step: a numbered list, one idea per step; define each new term the first time.\n" +
          "## Example: one fully worked example. If the learner shared homework or an exercise, solve it step by step and explain why each step works, so they can do similar ones alone.\n" +
          "## Common mistakes: 2-4 bullets, each with how to avoid it.\n" +
          "## Remember: 3-5 bullets to recap, with a memory trick if one helps.\n" +
          "## Check yourself: 3 short questions, then one line starting with 'Answers:'.\n" +
          "Be accurate; if something is uncertain or depends on context, say so. Start directly with the first heading." +
          LANG_RULE[lang],
      },
      { role: "user", content: `I want to learn: ${task.prompt}${notes ? `\n\n${notes}` : ""}` },
    ],
    {
      signal,
      maxTokens: MODELS[currentTier()].maxTokens + 200,
      think: task.mode === "think",
      onText: (chunk) => {
        begin();
        setSub(update, 0, (s) => ({ ...s, output: s.output + chunk }));
        update((t) => ({ ...t, final: t.final + chunk }));
      },
      onThink: (chunk) => {
        begin();
        setSub(update, 0, (s) => ({ ...s, thinking: ((s.thinking ?? "") + chunk).slice(-1500) }));
      },
    },
  );
  if (!output.trim()) throw new Error(translate(lang, "study.lessonFailed"));
  setSub(update, 0, (s) => ({ ...s, status: "done", finishedAt: Date.now() }));
  log("done", "ev.done", { name: tutor.name, title, words: countWords(output) }, tutor.id);
  update((t) => ({ ...t, final: output }));
}

// ---------- Quiz ----------

/**
 * The complete question objects in a (possibly cut-off) JSON reply: the model can run out of room
 * mid-question, and every finished question is still worth keeping.
 */
export function salvageQuestions(raw: string): QuizQuestion[] {
  const start = raw.indexOf("[", raw.indexOf('"questions"'));
  if (start < 0) return [];
  const out: QuizQuestion[] = [];
  let depth = 0;
  let from = -1;
  let inString = false;
  for (let i = start + 1; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) from = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && from >= 0) {
        try {
          const q = quizItem.safeParse(JSON.parse(raw.slice(from, i + 1)));
          if (q.success) out.push(q.data);
        } catch {
          // a broken object: skip it
        }
        from = -1;
      }
    } else if (c === "]" && depth === 0) break;
  }
  return out;
}

/** Usable questions only: a real question, 3-6 different options, the answer among them. */
function clean(questions: QuizQuestion[]) {
  const seen = new Set<string>();
  return questions
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()).filter(Boolean),
      answer: q.answer,
      explanation: q.explanation.trim(),
    }))
    .filter((q) => {
      const key = q.question.toLowerCase();
      const ok =
        q.question.length > 3 &&
        q.options.length >= 3 &&
        q.options.length <= 6 &&
        new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < q.options.length &&
        !seen.has(key);
      seen.add(key);
      return ok;
    });
}

/** Mixes up the options (models like to put the right answer first). */
function shuffle(q: QuizQuestion): QuizQuestion {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

const LETTERS = "ABCDEF";

/** A printable copy of the quiz, with the answer key at the end. */
export function quizMarkdown(topic: string, questions: QuizQuestion[], lang: Lang) {
  const body = questions
    .map((q, i) => `${i + 1}. **${q.question}**\n${q.options.map((o, j) => `   - ${LETTERS[j]}. ${o}`).join("\n")}`)
    .join("\n\n");
  const key = questions.map((q, i) => `${i + 1}. ${LETTERS[q.answer]}: ${q.explanation}`).join("\n");
  return `## ${translate(lang, "quiz.print", { topic: shortTopic(topic) })}\n\n${body}\n\n### ${translate(lang, "quiz.key")}\n\n${key}`;
}

async function quiz(
  task: Task,
  team: Agent[],
  files: Parameters<typeof filesBlock>[0],
  signal: AbortSignal,
  update: Update,
  log: ReturnType<typeof taskLogger>,
  lang: Lang,
  check: boolean,
) {
  const n = Math.max(3, Math.min(10, task.count ?? 5));
  const level = task.level ?? "intermediate";
  const exam = examById(task.exam);
  const examRule = exam
    ? `This is practice for an exam. ${exam.style} It covers: ${exam.syllabus}. ` +
      "Write original questions in that style and at that difficulty, spread across the syllabus; never copy questions from real papers. "
    : "";
  const langRule =
    exam?.questionLang === "en"
      ? ` Write the questions and options in English (it is an English exam)${lang === "th" ? "; write each explanation in Thai (ภาษาไทย)." : "."}`
      : LANG_RULE[lang];
  const tutor = pick(team, ["tutor", "researcher", "writer"]);
  const checker = check ? pick(team, ["qa", "analyst", "researcher"], tutor.id) : undefined;
  // a couple of spares, so questions the checker disagrees with can be dropped
  const ask = checker && checker.id !== tutor.id ? Math.min(12, n + 2) : n;
  const writeTitle = translate(lang, "study.quizTitle", { n });
  const subs: Subtask[] = [
    {
      id: `${task.id}-0`,
      agentId: tutor.id,
      title: writeTitle,
      brief: task.prompt,
      reason: translate(lang, "study.quizWhy", { name: tutor.name }),
      status: "queued",
      output: "",
    },
  ];
  if (checker && checker.id !== tutor.id)
    subs.push({
      id: `${task.id}-1`,
      agentId: checker.id,
      title: translate(lang, "study.checkTitle"),
      brief: translate(lang, "study.checkTitle"),
      reason: translate(lang, "study.checkWhy", { name: checker.name }),
      status: "queued",
      output: "",
    });
  log("plan", "ev.studyQuiz", { name: tutor.name, n });
  for (const s of subs) log("assign", "ev.assign", { name: team.find((a) => a.id === s.agentId)!.name, title: s.title, reason: s.reason ?? "" }, s.agentId);
  update((t) => ({ ...t, status: "working", subtasks: subs }));

  // 1. the tutor writes the questions
  log("start", "ev.start", { name: tutor.name, title: writeTitle }, tutor.id);
  setSub(update, 0, (s) => ({ ...s, status: "working", startedAt: Date.now(), output: translate(lang, "quiz.writing", { n: 1, total: ask }) }));
  const schema = JSON.stringify({
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: ask,
        maxItems: ask,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
            answer: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" },
          },
          required: ["question", "options", "answer", "explanation"],
        },
      },
    },
    required: ["questions"],
  });
  const notes = filesBlock(files, 3000);
  let raw = "";
  let made = 0;
  const write = () =>
    chat(
      [
        {
          role: "system",
          content:
            `You are ${tutor.name}, a tutor writing a multiple-choice practice quiz to help a learner check their understanding.\n` +
            `Write exactly ${ask} questions for ${LEVEL[level]}. ` +
            examRule +
            (notes
              ? "Base every question on the attached files. If a file is an exam paper, use its questions: keep their meaning, make them " +
                "4-choice where they aren't, and work out the correct answer yourself. "
              : "") +
            "Rules: each question tests understanding, not tricky wording; 4 options, exactly one correct; wrong options are plausible " +
            "(common misconceptions), never 'all/none of the above'; answer is the index (0-3) of the correct option, and it varies " +
            "between questions; explanation is one short sentence on why the answer is right. Cover different parts of the topic. " +
            "Reply in JSON only." +
            langRule,
        },
        { role: "user", content: `Quiz me on: ${exam ? `${exam.name.en}. ` : ""}${task.prompt}${notes ? `\n\n${notes}` : ""}` },
      ],
      {
        signal,
        maxTokens: 3000,
        json: schema,
        onText: (chunk) => {
          raw += chunk;
          const done = salvageQuestions(raw).length;
          if (done !== made && done < ask) {
            made = done;
            setSub(update, 0, (s) => ({ ...s, output: translate(lang, "quiz.writing", { n: done + 1, total: ask }) }));
          }
        },
      },
    );
  let questions = clean(salvageQuestions(await write()));
  if (questions.length < 2) {
    // one more go if the first reply was unusable
    raw = "";
    made = 0;
    questions = clean(salvageQuestions(await write()));
  }
  if (questions.length < 2) {
    setSub(update, 0, (s) => ({ ...s, status: "error", output: translate(lang, "quiz.failed") }));
    throw new Error(translate(lang, "quiz.failed"));
  }
  setSub(update, 0, (s) => ({ ...s, status: "done", finishedAt: Date.now(), output: translate(lang, "quiz.wrote", { n: questions.length }) }));
  log("done", "ev.quizMade", { name: tutor.name, n: questions.length }, tutor.id);

  // 2. the QA tester answers every question on their own; disputed ones go last (or are dropped)
  if (subs.length > 1 && checker) {
    const title = subs[1].title;
    log("start", "ev.start", { name: checker.name, title }, checker.id);
    setSub(update, 1, (s) => ({ ...s, status: "working", startedAt: Date.now() }));
    let agreed = questions;
    try {
      const reply = await chat(
        [
          {
            role: "system",
            content:
              `You are ${checker.name}, the ${checker.role}. Solve each multiple-choice question yourself and give the index (0-based) ` +
              "of the correct option for each, in order. Reply in JSON only.",
          },
          {
            role: "user",
            content: questions.map((q, i) => `${i + 1}. ${q.question}\n${q.options.map((o, j) => `   ${j}: ${o}`).join("\n")}`).join("\n\n"),
          },
        ],
        {
          signal,
          maxTokens: 200,
          json: JSON.stringify({
            type: "object",
            properties: { answers: { type: "array", minItems: questions.length, maxItems: questions.length, items: { type: "integer" } } },
            required: ["answers"],
          }),
        },
      );
      const answers: unknown = JSON.parse(reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1)).answers;
      if (Array.isArray(answers)) {
        const ok = questions.filter((q, i) => answers[i] === q.answer);
        const disputed = questions.filter((q, i) => answers[i] !== q.answer);
        agreed = [...ok, ...disputed];
        log("done", "ev.quizChecked", { name: checker.name, ok: ok.length, total: questions.length }, checker.id);
        setSub(update, 1, (s) => ({
          ...s,
          status: "done",
          finishedAt: Date.now(),
          output: translate(lang, "quiz.checked", { ok: ok.length, total: questions.length }),
        }));
      } else throw new Error("no answers");
    } catch (err) {
      if (signal.aborted) throw err;
      setSub(update, 1, (s) => ({ ...s, status: "done", finishedAt: Date.now(), output: translate(lang, "quiz.checkSkipped") }));
    }
    questions = agreed;
  }

  const final = questions.slice(0, n).map(shuffle);
  // exam prep is timed like the real thing
  const timeLimit = exam ? Math.round(final.length * exam.minutesPerQuestion * 60) : undefined;
  update((t) => ({
    ...t,
    quiz: { questions: final, picked: final.map(() => null), checked: false, attempts: 0, ...(timeLimit ? { timeLimit } : {}) },
    final: quizMarkdown(task.prompt, final, lang),
  }));
}
