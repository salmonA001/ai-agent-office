import type { Lang } from "./i18n";
import type { StudyLevel } from "./run-task";

/**
 * Exam prep: practice quizzes in the style of real Thai exams (entrance to Mathayom 4, the POSN
 * olympiad camp-1 selection, IJSO). Theo writes original questions from each exam's syllabus;
 * the real past papers are linked, for learners to download and attach.
 */

export type ExamGroup =
  | "nt"
  | "m1"
  | "m4"
  | "onet"
  | "tcas"
  | "triam"
  | "mwit"
  | "kvis"
  | "samsen"
  | "suankularb"
  | "english"
  | "civil"
  | "posn"
  | "ijso";

/** The order the groups are listed in the exam picker. */
export const EXAM_GROUPS: ExamGroup[] = [
  "nt",
  "m1",
  "m4",
  "triam",
  "mwit",
  "kvis",
  "samsen",
  "suankularb",
  "onet",
  "tcas",
  "english",
  "civil",
  "posn",
  "ijso",
];

export type ExamPreset = {
  id: string;
  group: ExamGroup;
  name: Record<Lang, string>;
  level: StudyLevel;
  /** default number of questions and minutes allowed per question */
  count: 5 | 10 | 20 | 30;
  minutesPerQuestion: number;
  /** what the exam covers and how it asks (for the prompt, in English) */
  syllabus: string;
  style: string;
  /** questions in this language whatever the app language (an English exam is in English) */
  questionLang?: "en";
  /** a caveat shown under the picker */
  note?: Record<Lang, string>;
};

const M4_STYLE =
  "Thai entrance exam for Mathayom 4 (Grade 10) at competitive schools, based on the lower-secondary (Mathayom 1-3) IPST curriculum: " +
  "4-choice questions that need understanding and a few steps of working, not just recall.";
const POSN_STYLE =
  "POSN (Thai academic olympiad foundation) camp-1 selection exam for Mathayom 3-5 students: challenging 4-choice problems " +
  "that go a little beyond the school curriculum and need multi-step reasoning.";
const IJSO_STYLE =
  "IJSO (International Junior Science Olympiad) selection for students under 16: integrated science problems that mix physics, " +
  "chemistry and biology with data, experiments and calculations.";

const M4_MATH_SYLLABUS =
  "real numbers and roots, exponents, polynomials and factoring, linear equations and inequalities, systems of equations, " +
  "quadratic equations, ratio and percentage, the Pythagorean theorem, similar and congruent triangles, area, surface area and volume, " +
  "linear graphs and slope, statistics (mean, median, mode, box plots) and basic probability";
const M4_SCIENCE_SYLLABUS =
  "matter, mixtures and separation, atoms and the periodic table, chemical reactions and acids and bases, cells and body systems, " +
  "genetics and heredity, ecosystems, forces and motion, work, energy and power, electricity and circuits, waves, sound and light, " +
  "earth, weather and space";

export const EXAMS: ExamPreset[] = [
  {
    id: "m4-math",
    group: "m4",
    name: { en: "Entrance to M.4: Math", th: "สอบเข้า ม.4: คณิตศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus:
      M4_MATH_SYLLABUS,
    style: M4_STYLE,
  },
  {
    id: "m4-science",
    group: "m4",
    name: { en: "Entrance to M.4: Science", th: "สอบเข้า ม.4: วิทยาศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus:
      M4_SCIENCE_SYLLABUS,
    style: M4_STYLE,
  },
  {
    id: "m4-english",
    group: "m4",
    name: { en: "Entrance to M.4: English", th: "สอบเข้า ม.4: ภาษาอังกฤษ" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "grammar (tenses, conditionals, passive voice, relative clauses, comparatives), vocabulary in context, short reading passages, everyday conversation",
    style: M4_STYLE,
    questionLang: "en",
  },
  {
    id: "m4-thai",
    group: "m4",
    name: { en: "Entrance to M.4: Thai", th: "สอบเข้า ม.4: ภาษาไทย" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus:
      "Thai language: หลักภาษา (word types, sentence types, คำราชาศัพท์, คำสมาส คำสนธิ), reading for the main idea, inference, " +
      "figures of speech, and Mathayom 1-3 Thai literature",
    style: M4_STYLE,
  },
  {
    id: "m4-social",
    group: "m4",
    name: { en: "Entrance to M.4: Social studies", th: "สอบเข้า ม.4: สังคมศึกษา" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "Thai and world history, geography of Thailand and the world, basic economics, civics and the Thai constitution, religions and ethics",
    style: M4_STYLE,
  },
  {
    id: "posn-math",
    group: "posn",
    name: { en: "POSN camp 1: Math", th: "สอวน. ค่าย 1: คณิตศาสตร์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 3,
    syllabus: "number theory (divisibility, primes, remainders), algebra and inequalities, counting and probability, plane geometry, sequences and functions",
    style: POSN_STYLE,
  },
  {
    id: "posn-physics",
    group: "posn",
    name: { en: "POSN camp 1: Physics", th: "สอวน. ค่าย 1: ฟิสิกส์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 3,
    syllabus: "kinematics, Newton's laws, work, energy and momentum, circular motion, fluids, heat, waves and optics, electric circuits",
    style: POSN_STYLE,
  },
  {
    id: "posn-chemistry",
    group: "posn",
    name: { en: "POSN camp 1: Chemistry", th: "สอวน. ค่าย 1: เคมี" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 3,
    syllabus: "atomic structure and the periodic table, chemical bonding, stoichiometry and the mole, gases, solutions, reaction rates and equilibrium, acids and bases",
    style: POSN_STYLE,
  },
  {
    id: "posn-biology",
    group: "posn",
    name: { en: "POSN camp 1: Biology", th: "สอวน. ค่าย 1: ชีววิทยา" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "cell biology, biochemistry and enzymes, genetics and inheritance, evolution, plant and animal physiology, ecology",
    style: POSN_STYLE,
  },
  {
    id: "posn-computer",
    group: "posn",
    name: { en: "POSN camp 1: Computer", th: "สอวน. ค่าย 1: คอมพิวเตอร์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 3,
    syllabus: "logic and truth tables, number bases, tracing short C-like programs, loops and arrays, simple algorithms and complexity, puzzles and patterns",
    style: POSN_STYLE,
  },
  {
    id: "posn-astronomy",
    group: "posn",
    name: { en: "POSN camp 1: Astronomy", th: "สอวน. ค่าย 1: ดาราศาสตร์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "the celestial sphere and coordinates, the Moon's phases and eclipses, Kepler's laws and gravitation, stars and light, the solar system",
    style: POSN_STYLE,
  },
  {
    id: "ijso",
    group: "ijso",
    name: { en: "IJSO selection: Integrated science", th: "คัดเลือก IJSO: วิทยาศาสตร์บูรณาการ" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "physics, chemistry and biology together: motion and energy, electricity, matter and reactions, cells, genetics and ecology, reading data and experiments",
    style: IJSO_STYLE,
  },
];

const M1_STYLE =
  "Thai entrance exam for Mathayom 1 (Grade 7) at competitive schools, based on the Prathom 4-6 IPST curriculum: " +
  "4-choice questions that check understanding and short problem solving, in words a 12-year-old reads easily.";
const ONET3_STYLE =
  "Thailand's O-NET national test for Mathayom 3 (Grade 9), set by NIETS (สทศ.) on the core lower-secondary curriculum standards: " +
  "4-choice questions, some reading short passages, tables, graphs or diagrams described in words.";
const ONET6_STYLE =
  "Thailand's O-NET national test for Mathayom 6 (Grade 12), set by NIETS (สทศ.) on the core upper-secondary curriculum standards: " +
  "4-choice questions, some reading passages, data and diagrams described in words.";
const TGAT_STYLE =
  "TGAT (Thai General Aptitude Test) for university admission through TCAS: aptitude questions, not school-subject recall.";
const ALEVEL_STYLE =
  "A-Level subject exam for Thai university admission through TCAS, on the upper-secondary (Mathayom 4-6) curriculum: " +
  "4-choice questions that need several steps of reasoning or calculation.";

/** Exam presets added for primary-to-secondary entrance, O-NET and TCAS. */
const MORE: ExamPreset[] = [
  // ---------- entrance to M.1 ----------
  {
    id: "m1-math",
    group: "m1",
    name: { en: "Entrance to M.1: Math", th: "สอบเข้า ม.1: คณิตศาสตร์" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "whole numbers, fractions and decimals, ratio and percentage, number patterns, area and perimeter, volume, angles and shapes, simple equations, word problems, reading charts",
    style: M1_STYLE,
  },
  {
    id: "m1-science",
    group: "m1",
    name: { en: "Entrance to M.1: Science", th: "สอบเข้า ม.1: วิทยาศาสตร์" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "living things and their parts, food chains, the human body, states of matter and mixtures, force and motion, light, sound and electricity, the earth, weather and the solar system",
    style: M1_STYLE,
  },
  {
    id: "m1-english",
    group: "m1",
    name: { en: "Entrance to M.1: English", th: "สอบเข้า ม.1: ภาษาอังกฤษ" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "everyday vocabulary, present and past tenses, prepositions, short dialogues, reading short notices and stories",
    style: M1_STYLE,
    questionLang: "en",
  },
  {
    id: "m1-thai",
    group: "m1",
    name: { en: "Entrance to M.1: Thai", th: "สอบเข้า ม.1: ภาษาไทย" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "Thai language: spelling (การสะกดคำ), word types, sentences, คำราชาศัพท์ basics, idioms (สำนวน สุภาษิต), reading for the main idea",
    style: M1_STYLE,
  },
  // ---------- O-NET ----------
  {
    id: "onet3-math",
    group: "onet",
    name: { en: "O-NET M.3: Math", th: "O-NET ม.3: คณิตศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "real numbers, exponents, linear equations and inequalities, ratio and percentage, Pythagoras, similar triangles, area and volume, graphs, statistics and probability",
    style: ONET3_STYLE,
  },
  {
    id: "onet3-science",
    group: "onet",
    name: { en: "O-NET M.3: Science", th: "O-NET ม.3: วิทยาศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "cells and body systems, heredity, ecosystems, substances and chemical change, force, motion and energy, electricity, waves and light, earth and space",
    style: ONET3_STYLE,
  },
  {
    id: "onet3-english",
    group: "onet",
    name: { en: "O-NET M.3: English", th: "O-NET ม.3: ภาษาอังกฤษ" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "conversation and functional language, vocabulary in context, grammar, reading short texts, notices and messages",
    style: ONET3_STYLE,
    questionLang: "en",
  },
  {
    id: "onet3-thai",
    group: "onet",
    name: { en: "O-NET M.3: Thai", th: "O-NET ม.3: ภาษาไทย" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "reading comprehension and inference, หลักภาษา (word and sentence types, คำราชาศัพท์), writing and usage, Thai literature for Mathayom 1-3",
    style: ONET3_STYLE,
  },
  {
    id: "onet6-math",
    group: "onet",
    name: { en: "O-NET M.6: Math", th: "O-NET ม.6: คณิตศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 2,
    syllabus: "sets and logic, exponential and logarithmic functions, sequences and series, counting and probability, statistics, functions and graphs",
    style: ONET6_STYLE,
  },
  {
    id: "onet6-science",
    group: "onet",
    name: { en: "O-NET M.6: Science", th: "O-NET ม.6: วิทยาศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.8,
    syllabus: "physics, chemistry, biology and earth and space science from the upper-secondary core curriculum, science and technology in daily life",
    style: ONET6_STYLE,
  },
  {
    id: "onet6-english",
    group: "onet",
    name: { en: "O-NET M.6: English", th: "O-NET ม.6: ภาษาอังกฤษ" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "conversation, vocabulary and grammar in context, reading longer passages for the main idea, detail and inference",
    style: ONET6_STYLE,
    questionLang: "en",
  },
  {
    id: "onet6-thai",
    group: "onet",
    name: { en: "O-NET M.6: Thai", th: "O-NET ม.6: ภาษาไทย" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "reading and critical reading, หลักภาษา, effective writing and usage, Thai literature and its values for Mathayom 4-6",
    style: ONET6_STYLE,
  },
  {
    id: "onet6-social",
    group: "onet",
    name: { en: "O-NET M.6: Social studies", th: "O-NET ม.6: สังคมศึกษา" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "religion and ethics, civics and the Thai constitution, economics, Thai and world history, geography",
    style: ONET6_STYLE,
  },
  // ---------- TCAS ----------
  {
    id: "tgat1",
    group: "tcas",
    name: { en: "TGAT1: English communication", th: "TGAT1: การสื่อสารภาษาอังกฤษ" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "speaking-style conversation completion, vocabulary in context, reading comprehension of short real-world texts",
    style: TGAT_STYLE,
    questionLang: "en",
  },
  {
    id: "tgat2",
    group: "tcas",
    name: { en: "TGAT2: Critical and logical thinking", th: "TGAT2: การคิดอย่างมีเหตุผล" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "verbal reasoning, number series and quantitative reasoning, spatial reasoning, logical deduction and reasoning from given conditions",
    style: TGAT_STYLE,
  },
  {
    id: "tgat3",
    group: "tcas",
    name: { en: "TGAT3: Future workforce competencies", th: "TGAT3: สมรรถนะการทำงานในอนาคต" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "situational judgment: value creation and innovation, complex problem solving, emotional intelligence, social responsibility",
    style: TGAT_STYLE + " Each question is a short workplace or school situation with four possible responses; the best one shows the competency.",
  },
  {
    id: "tpat3",
    group: "tcas",
    name: { en: "TPAT3: Science, technology and engineering", th: "TPAT3: ความถนัดวิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2,
    syllabus: "applying physics and chemistry ideas to real devices, spatial and mechanical reasoning, reading technical data, engineering and technology awareness",
    style: "TPAT3 aptitude test for Thai science and engineering faculties (TCAS): reasoning about how things work rather than school-subject recall.",
  },
  {
    id: "alevel-math1",
    group: "tcas",
    name: { en: "A-Level: Applied Math 1", th: "A-Level: คณิตศาสตร์ประยุกต์ 1" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "sets and logic, real numbers, functions, exponential and logarithmic functions, trigonometry, conic sections, vectors, matrices, sequences and series, calculus, counting, probability and statistics",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-physics",
    group: "tcas",
    name: { en: "A-Level: Physics", th: "A-Level: ฟิสิกส์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "mechanics, momentum and energy, rotation, oscillations and waves, sound and light, heat and gases, electricity and magnetism, modern physics",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-chemistry",
    group: "tcas",
    name: { en: "A-Level: Chemistry", th: "A-Level: เคมี" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2.5,
    syllabus: "atoms and the periodic table, bonding, stoichiometry, gases, solutions, reaction rates, equilibrium, acids and bases, electrochemistry, organic chemistry and polymers",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-biology",
    group: "tcas",
    name: { en: "A-Level: Biology", th: "A-Level: ชีววิทยา" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 2,
    syllabus: "biomolecules and cells, genetics and molecular biology, evolution, plant and animal structure and function, ecology",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-english",
    group: "tcas",
    name: { en: "A-Level: English", th: "A-Level: ภาษาอังกฤษ" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "listening-style conversations given as text, vocabulary and structure in context, reading longer passages for main idea, detail, tone and inference",
    style: ALEVEL_STYLE,
    questionLang: "en",
  },
  {
    id: "alevel-thai",
    group: "tcas",
    name: { en: "A-Level: Thai", th: "A-Level: ภาษาไทย" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "critical reading and inference, หลักภาษา and usage, effective writing, reasoning in Thai texts, Thai literature",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-social",
    group: "tcas",
    name: { en: "A-Level: Social studies", th: "A-Level: สังคมศึกษา" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "religion and ethics, civics and law, economics, Thai and world history, geography and current issues",
    style: ALEVEL_STYLE,
  },
];

const TRIAM_STYLE =
  "Entrance exam to Mathayom 4 at Triam Udom Suksa School (โรงเรียนเตรียมอุดมศึกษา), among Thailand's most competitive " +
  "(roughly one place for every 7-9 applicants): Mathayom 1-3 content asked harder than the textbook, multi-step 4-choice questions.";
const MWIT_STYLE =
  "Selection exam for Mahidol Wittayanusorn School (MWIT), Thailand's school for students gifted in math and science: " +
  "challenging problems beyond the Mathayom 1-3 curriculum that need deep understanding and several steps of reasoning.";
const KVIS_STYLE =
  "Selection exam for Kamnoetvidya Science Academy (KVIS): applying math and science to unfamiliar situations, data and " +
  "experiments; challenging, beyond the Mathayom 1-3 curriculum.";
const schoolM1 = (school: string) =>
  `Entrance exam to Mathayom 1 at ${school} (special math and science programmes): Prathom 4-6 content asked as harder, multi-step 4-choice problems.`;
const schoolM4 = (school: string) =>
  `Entrance exam to Mathayom 4 at ${school} (science and math programmes): Mathayom 1-3 content at a competitive level, multi-step 4-choice questions.`;
const CHECK_SUBJECTS = {
  en: "Check the school's official admission announcement for this year's subjects.",
  th: "ตรวจสอบวิชาที่สอบปีนี้จากประกาศรับสมัครของโรงเรียน",
};
const M4_MATH = M4_MATH_SYLLABUS;
const M4_SCIENCE = M4_SCIENCE_SYLLABUS;
const M1_MATH = "whole numbers, fractions and decimals, ratio and percentage, number patterns, area, perimeter and volume, angles and shapes, equations, word problems";
const M1_SCIENCE = "living things, the human body, food chains, matter and mixtures, force and motion, light, sound and electricity, the earth and space";

/** Practice for the entrance exams of well-known schools. */
const SCHOOLS: ExamPreset[] = [
  ...(
    [
      ["math", "Math", "คณิตศาสตร์", M4_MATH, 1.5],
      ["science", "Science", "วิทยาศาสตร์", M4_SCIENCE, 1.5],
      ["english", "English", "ภาษาอังกฤษ", "grammar, vocabulary in context, conversation, reading passages for main idea and inference", 1.2],
      ["thai", "Thai", "ภาษาไทย", "หลักภาษา, reading and inference, usage, Mathayom 1-3 Thai literature", 1.2],
      ["social", "Social studies", "สังคมศึกษา", "religion and ethics, civics, economics, Thai and world history, geography", 1.2],
    ] as const
  ).map(
    ([id, en, th, syllabus, min]): ExamPreset => ({
      id: `triam-${id}`,
      group: "triam",
      name: { en: `Triam Udom M.4: ${en}`, th: `เตรียมอุดมศึกษา ม.4: ${th}` },
      level: "advanced",
      count: 20,
      minutesPerQuestion: min,
      syllabus,
      style: TRIAM_STYLE,
      ...(id === "english" ? { questionLang: "en" as const } : {}),
    }),
  ),
  ...(
    [
      ["mwit", "MWIT", "มหิดลวิทยานุสรณ์", MWIT_STYLE],
      ["kvis", "KVIS", "กำเนิดวิทย์", KVIS_STYLE],
    ] as const
  ).flatMap(([school, en, th, style]) =>
    (
      [
        ["math", "Math", "คณิตศาสตร์", `${M4_MATH}, plus number theory and problem solving`],
        ["science", "Science", "วิทยาศาสตร์", `${M4_SCIENCE}, plus experimental design and reading data`],
      ] as const
    ).map(
      ([id, sEn, sTh, syllabus]): ExamPreset => ({
        id: `${school}-${id}`,
        group: school,
        name: { en: `${en} M.4: ${sEn}`, th: `${th} ม.4: ${sTh}` },
        level: "advanced",
        count: 20,
        minutesPerQuestion: 2.5,
        syllabus,
        style,
        note: CHECK_SUBJECTS,
      }),
    ),
  ),
  ...(
    [
      ["samsen", "Samsen", "สามเสนวิทยาลัย", "Samsen Wittayalai School (สามเสนวิทยาลัย)"],
      ["suankularb", "Suankularb", "สวนกุหลาบวิทยาลัย", "Suankularb Wittayalai School (สวนกุหลาบวิทยาลัย)"],
    ] as const
  ).flatMap(([school, en, th, full]) => [
    {
      id: `${school}-m1-math`,
      group: school,
      name: { en: `${en} M.1: Math`, th: `${th} ม.1: คณิตศาสตร์` },
      level: "intermediate",
      count: 20,
      minutesPerQuestion: 1.5,
      syllabus: M1_MATH,
      style: schoolM1(full),
      note: CHECK_SUBJECTS,
    } satisfies ExamPreset,
    {
      id: `${school}-m1-science`,
      group: school,
      name: { en: `${en} M.1: Science`, th: `${th} ม.1: วิทยาศาสตร์` },
      level: "intermediate",
      count: 20,
      minutesPerQuestion: 1.5,
      syllabus: M1_SCIENCE,
      style: schoolM1(full),
      note: CHECK_SUBJECTS,
    } satisfies ExamPreset,
    {
      id: `${school}-m4-math`,
      group: school,
      name: { en: `${en} M.4: Math`, th: `${th} ม.4: คณิตศาสตร์` },
      level: "advanced",
      count: 20,
      minutesPerQuestion: 1.5,
      syllabus: M4_MATH,
      style: schoolM4(full),
      note: CHECK_SUBJECTS,
    } satisfies ExamPreset,
    {
      id: `${school}-m4-science`,
      group: school,
      name: { en: `${en} M.4: Science`, th: `${th} ม.4: วิทยาศาสตร์` },
      level: "advanced",
      count: 20,
      minutesPerQuestion: 1.5,
      syllabus: M4_SCIENCE,
      style: schoolM4(full),
      note: CHECK_SUBJECTS,
    } satisfies ExamPreset,
  ]),
];

const NT_STYLE =
  "Thailand's NT (National Test) for Prathom 3 (Grade 3), set by the Office of the Basic Education Commission: short, " +
  "concrete 4-choice questions on everyday situations, in words an 8-year-old reads easily.";
const ONETP6_STYLE =
  "Thailand's O-NET national test for Prathom 6 (Grade 6), set by NIETS (สทศ.) on the core primary curriculum standards: " +
  "4-choice questions, some reading short passages, tables or pictures described in words.";
const TPAT1_STYLE =
  "TPAT1, the medical aptitude test (กสพท) used for admission to Thai medicine, dentistry, veterinary science and pharmacy: " +
  "it tests reasoning and judgement, not school content.";
const CUTEP_STYLE =
  "CU-TEP, Chulalongkorn University's English proficiency test, used for graduate and international programmes in Thailand: " +
  "academic-level English.";
const OCSC_STYLE =
  "The Thai civil service general exam (ก.พ. ภาค ก) by the Office of the Civil Service Commission: 4-choice questions " +
  "that every applicant for government jobs must pass.";

/** Primary-level national tests, more TCAS, university English and the civil service exam. */
const EXTRA: ExamPreset[] = [
  {
    id: "nt3-math",
    group: "nt",
    name: { en: "NT P.3: Math", th: "NT ป.3: คณิตศาสตร์" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "numbers to 100,000, adding and subtracting, multiplying and dividing, money, time, length, weight and volume, simple fractions, reading tables and pictographs, word problems",
    style: NT_STYLE,
  },
  {
    id: "nt3-thai",
    group: "nt",
    name: { en: "NT P.3: Thai", th: "NT ป.3: ภาษาไทย" },
    level: "beginner",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "reading and understanding short texts, spelling and tones (การสะกดคำ วรรณยุกต์), word meanings, simple sentences, following instructions",
    style: NT_STYLE,
  },
  ...(
    [
      ["math", "Math", "คณิตศาสตร์", "fractions, decimals and percentages, ratio, area and perimeter, volume, angles and shapes, simple equations, reading graphs and charts, word problems", 1.5],
      ["science", "Science", "วิทยาศาสตร์", "living things and the environment, the human body, matter and its changes, force and motion, electricity, light and sound, earth and space", 1.2],
      ["thai", "Thai", "ภาษาไทย", "reading for the main idea, หลักภาษา (word types, sentences, คำราชาศัพท์), spelling, idioms (สำนวน สุภาษิต), literature for Prathom 4-6", 1.2],
      ["english", "English", "ภาษาอังกฤษ", "everyday vocabulary, simple grammar (present, past, future), short conversations, signs and short texts", 1],
    ] as const
  ).map(
    ([id, en, th, syllabus, min]): ExamPreset => ({
      id: `onetp6-${id}`,
      group: "onet",
      name: { en: `O-NET P.6: ${en}`, th: `O-NET ป.6: ${th}` },
      level: "beginner",
      count: 10,
      minutesPerQuestion: min,
      syllabus,
      style: ONETP6_STYLE,
      ...(id === "english" ? { questionLang: "en" as const } : {}),
    }),
  ),
  {
    id: "tpat1-reasoning",
    group: "tcas",
    name: { en: "TPAT1 (กสพท): Reasoning", th: "TPAT1 (กสพท): เชาวน์ปัญญา" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "number and letter series, analogies, logical deduction from given conditions, spatial and pattern reasoning",
    style: TPAT1_STYLE,
  },
  {
    id: "tpat1-ethics",
    group: "tcas",
    name: { en: "TPAT1 (กสพท): Medical ethics", th: "TPAT1 (กสพท): จริยธรรมทางการแพทย์" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "situations a doctor or medical student meets: patient rights and consent, confidentiality, honesty, fairness, teamwork, professional responsibility",
    style: TPAT1_STYLE + " Each question is a short situation with four possible actions; the best one shows sound medical ethics.",
  },
  {
    id: "tpat1-connect",
    group: "tcas",
    name: { en: "TPAT1 (กสพท): Connective thinking", th: "TPAT1 (กสพท): ความคิดเชื่อมโยง" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "reading a passage and linking its ideas: the main idea, what follows logically, what the author assumes, which statement connects two ideas",
    style: TPAT1_STYLE,
  },
  {
    id: "cutep-reading",
    group: "english",
    name: { en: "CU-TEP: Reading", th: "CU-TEP: การอ่าน" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 1.2,
    syllabus: "academic and general passages: main idea, detail, vocabulary in context, inference, reference words, the author's purpose",
    style: CUTEP_STYLE + " Give a short passage inside the question when needed.",
    questionLang: "en",
  },
  {
    id: "cutep-error",
    group: "english",
    name: { en: "CU-TEP: Error identification", th: "CU-TEP: หาจุดผิดในประโยค" },
    level: "advanced",
    count: 10,
    minutesPerQuestion: 0.6,
    syllabus:
      "grammar errors in one sentence: tenses, subject-verb agreement, articles, prepositions, word forms, pronouns, parallel structure, comparatives",
    style: CUTEP_STYLE + " Each question is one sentence with four underlined parts given as the options (quote each part); exactly one is wrong.",
    questionLang: "en",
  },
  {
    id: "ocsc-analysis",
    group: "civil",
    name: { en: "Civil service (ก.พ.): Analytical thinking", th: "ก.พ. ภาค ก: ความสามารถในการคิดวิเคราะห์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus: "Thai reading and analysis, number series, percentage, ratio and arithmetic word problems, reading tables, logical reasoning and conditions",
    style: OCSC_STYLE,
  },
  {
    id: "ocsc-english",
    group: "civil",
    name: { en: "Civil service (ก.พ.): English", th: "ก.พ. ภาค ก: ภาษาอังกฤษ" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus: "conversation, vocabulary, grammar and reading comprehension at a working level",
    style: OCSC_STYLE,
    questionLang: "en",
  },
  {
    id: "ocsc-civil",
    group: "civil",
    name: { en: "Civil service (ก.พ.): Being a good civil servant", th: "ก.พ. ภาค ก: ความรู้และลักษณะการเป็นข้าราชการที่ดี" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1,
    syllabus:
      "the State Administration Act, the Civil Service Act, the Royal Decree on Good Governance, the Administrative Procedure Act, " +
      "the Liability for Wrongful Acts of Officials Act, the civil service code of ethics, and sound judgement as a public servant",
    style: OCSC_STYLE,
  },
];

EXAMS.push(...MORE, ...SCHOOLS, ...EXTRA);

export const examById = (id: string | undefined) => EXAMS.find((e) => e.id === id);

/** Where to find the real past papers (download them, then attach the PDF to be tested on it). */
export const PAST_PAPERS: { name: Record<Lang, string>; url: string; groups: ExamGroup[] }[] = [
  {
    name: { en: "O-NET past papers (NIETS, official)", th: "ข้อสอบ O-NET ย้อนหลัง (สทศ. ทางการ)" },
    url: "https://www.niets.or.th/th/catalog/view/630",
    groups: ["onet", "nt"],
  },
  {
    name: { en: "A-Level papers with answers (mytcas)", th: "ข้อสอบ A-Level พร้อมเฉลย (mytcas)" },
    url: "https://www.mytcas.com/answers",
    groups: ["tcas"],
  },
  {
    name: { en: "TruePlookpanya exam bank (all levels)", th: "คลังข้อสอบ ทรูปลูกปัญญา (ทุกระดับชั้น)" },
    url: "https://www.trueplookpanya.com/examination",
    groups: ["nt", "m1", "m4", "onet", "tcas", "civil"],
  },
  {
    name: { en: "Triam Udom M.4 practice (TruePlookpanya): math", th: "แนวข้อสอบเข้า ม.4 เตรียมอุดม (ทรูปลูกปัญญา): คณิต" },
    url: "https://trueplookpanya.com/examination2/start-exam/14401",
    groups: ["triam"],
  },
  {
    name: { en: "Triam Udom M.4 practice (TruePlookpanya): science", th: "แนวข้อสอบเข้า ม.4 เตรียมอุดม (ทรูปลูกปัญญา): วิทย์" },
    url: "https://www.trueplookpanya.com/examination2/start-exam/14407",
    groups: ["triam"],
  },
  {
    name: { en: "Suankularb M.4 practice (TruePlookpanya): science", th: "แนวข้อสอบเข้า ม.4 สวนกุหลาบ (ทรูปลูกปัญญา): วิทย์" },
    url: "https://www.trueplookpanya.com/examination2/doExam?id=14460",
    groups: ["suankularb"],
  },
  { name: { en: "Triam Udom Suksa: admissions (official)", th: "เตรียมอุดมศึกษา: ประกาศรับสมัคร (ทางการ)" }, url: "https://www.triamudom.ac.th", groups: ["triam"] },
  { name: { en: "MWIT: admissions (official)", th: "มหิดลวิทยานุสรณ์: ประกาศรับสมัคร (ทางการ)" }, url: "https://www.mwit.ac.th", groups: ["mwit"] },
  { name: { en: "KVIS: admissions (official)", th: "กำเนิดวิทย์: ประกาศรับสมัคร (ทางการ)" }, url: "https://www.kvis.ac.th", groups: ["kvis"] },
  { name: { en: "Samsen Wittayalai: admissions (official)", th: "สามเสนวิทยาลัย: ประกาศรับสมัคร (ทางการ)" }, url: "https://www.samsenwit.ac.th", groups: ["samsen"] },
  {
    name: { en: "Civil service exams (ก.พ., official)", th: "สอบ ก.พ. (สำนักงาน ก.พ. ทางการ)" },
    url: "https://job3.ocsc.go.th",
    groups: ["civil"],
  },
  { name: { en: "mytcas: TCAS exams and schedule (official)", th: "mytcas: การสอบและกำหนดการ TCAS (ทางการ)" }, url: "https://www.mytcas.com", groups: ["tcas"] },
  { name: { en: "POSN exam bank (สอวน.)", th: "คลังข้อสอบ สอวน." }, url: "https://www.posn.or.th/examination/", groups: ["posn"] },
  { name: { en: "IJSO past papers", th: "ข้อสอบ IJSO" }, url: "https://www.posn.or.th/projects/academic-olympiad/ijso/examination/", groups: ["ijso"] },
  { name: { en: "Baan Krupui exam collection", th: "คลังข้อสอบ บ้านครูปุ้ย" }, url: "https://www.baankrupui.com/%E0%B8%84%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%AA%E0%B8%AD%E0%B8%9A", groups: ["m1", "m4", "onet"] },
  { name: { en: "Chula Tutor: M.4 entrance practice", th: "Chula Tutor: ข้อสอบเข้า ม.4" }, url: "https://exam.chulatutor.com/m4/", groups: ["m4"] },
];
