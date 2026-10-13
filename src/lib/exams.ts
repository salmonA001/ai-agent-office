import type { Lang } from "./i18n";
import type { StudyLevel } from "./run-task";

/**
 * Exam prep: practice quizzes in the style of real Thai exams (entrance to Mathayom 4, the POSN
 * olympiad camp-1 selection, IJSO). Theo writes original questions from each exam's syllabus;
 * the real past papers are linked, for learners to download and attach.
 */

export type ExamGroup = "m1" | "m4" | "onet" | "tcas" | "posn" | "ijso";

/** The order the groups are listed in the exam picker. */
export const EXAM_GROUPS: ExamGroup[] = ["m1", "m4", "onet", "tcas", "posn", "ijso"];

export type ExamPreset = {
  id: string;
  group: ExamGroup;
  name: Record<Lang, string>;
  level: StudyLevel;
  /** default number of questions and minutes allowed per question */
  count: 5 | 8 | 10;
  minutesPerQuestion: number;
  /** what the exam covers and how it asks (for the prompt, in English) */
  syllabus: string;
  style: string;
  /** questions in this language whatever the app language (an English exam is in English) */
  questionLang?: "en";
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

export const EXAMS: ExamPreset[] = [
  {
    id: "m4-math",
    group: "m4",
    name: { en: "Entrance to M.4: Math", th: "สอบเข้า ม.4: คณิตศาสตร์" },
    level: "intermediate",
    count: 10,
    minutesPerQuestion: 1.5,
    syllabus:
      "real numbers and roots, exponents, polynomials and factoring, linear equations and inequalities, systems of equations, " +
      "quadratic equations, ratio and percentage, the Pythagorean theorem, similar and congruent triangles, area, surface area and volume, " +
      "linear graphs and slope, statistics (mean, median, mode, box plots) and basic probability",
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
      "matter, mixtures and separation, atoms and the periodic table, chemical reactions and acids and bases, cells and body systems, " +
      "genetics and heredity, ecosystems, forces and motion, work, energy and power, electricity and circuits, waves, sound and light, " +
      "earth, weather and space",
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
    count: 8,
    minutesPerQuestion: 3,
    syllabus: "number theory (divisibility, primes, remainders), algebra and inequalities, counting and probability, plane geometry, sequences and functions",
    style: POSN_STYLE,
  },
  {
    id: "posn-physics",
    group: "posn",
    name: { en: "POSN camp 1: Physics", th: "สอวน. ค่าย 1: ฟิสิกส์" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 3,
    syllabus: "kinematics, Newton's laws, work, energy and momentum, circular motion, fluids, heat, waves and optics, electric circuits",
    style: POSN_STYLE,
  },
  {
    id: "posn-chemistry",
    group: "posn",
    name: { en: "POSN camp 1: Chemistry", th: "สอวน. ค่าย 1: เคมี" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 3,
    syllabus: "atomic structure and the periodic table, chemical bonding, stoichiometry and the mole, gases, solutions, reaction rates and equilibrium, acids and bases",
    style: POSN_STYLE,
  },
  {
    id: "posn-biology",
    group: "posn",
    name: { en: "POSN camp 1: Biology", th: "สอวน. ค่าย 1: ชีววิทยา" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 2.5,
    syllabus: "cell biology, biochemistry and enzymes, genetics and inheritance, evolution, plant and animal physiology, ecology",
    style: POSN_STYLE,
  },
  {
    id: "posn-computer",
    group: "posn",
    name: { en: "POSN camp 1: Computer", th: "สอวน. ค่าย 1: คอมพิวเตอร์" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 3,
    syllabus: "logic and truth tables, number bases, tracing short C-like programs, loops and arrays, simple algorithms and complexity, puzzles and patterns",
    style: POSN_STYLE,
  },
  {
    id: "posn-astronomy",
    group: "posn",
    name: { en: "POSN camp 1: Astronomy", th: "สอวน. ค่าย 1: ดาราศาสตร์" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 2.5,
    syllabus: "the celestial sphere and coordinates, the Moon's phases and eclipses, Kepler's laws and gravitation, stars and light, the solar system",
    style: POSN_STYLE,
  },
  {
    id: "ijso",
    group: "ijso",
    name: { en: "IJSO selection: Integrated science", th: "คัดเลือก IJSO: วิทยาศาสตร์บูรณาการ" },
    level: "advanced",
    count: 8,
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
    count: 8,
    minutesPerQuestion: 2,
    syllabus: "applying physics and chemistry ideas to real devices, spatial and mechanical reasoning, reading technical data, engineering and technology awareness",
    style: "TPAT3 aptitude test for Thai science and engineering faculties (TCAS): reasoning about how things work rather than school-subject recall.",
  },
  {
    id: "alevel-math1",
    group: "tcas",
    name: { en: "A-Level: Applied Math 1", th: "A-Level: คณิตศาสตร์ประยุกต์ 1" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 2.5,
    syllabus: "sets and logic, real numbers, functions, exponential and logarithmic functions, trigonometry, conic sections, vectors, matrices, sequences and series, calculus, counting, probability and statistics",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-physics",
    group: "tcas",
    name: { en: "A-Level: Physics", th: "A-Level: ฟิสิกส์" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 2.5,
    syllabus: "mechanics, momentum and energy, rotation, oscillations and waves, sound and light, heat and gases, electricity and magnetism, modern physics",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-chemistry",
    group: "tcas",
    name: { en: "A-Level: Chemistry", th: "A-Level: เคมี" },
    level: "advanced",
    count: 8,
    minutesPerQuestion: 2.5,
    syllabus: "atoms and the periodic table, bonding, stoichiometry, gases, solutions, reaction rates, equilibrium, acids and bases, electrochemistry, organic chemistry and polymers",
    style: ALEVEL_STYLE,
  },
  {
    id: "alevel-biology",
    group: "tcas",
    name: { en: "A-Level: Biology", th: "A-Level: ชีววิทยา" },
    level: "advanced",
    count: 8,
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

EXAMS.push(...MORE);

export const examById = (id: string | undefined) => EXAMS.find((e) => e.id === id);

/** Where to find the real past papers (download them, then attach the PDF to be tested on it). */
export const PAST_PAPERS: { name: Record<Lang, string>; url: string; groups: ExamGroup[] }[] = [
  {
    name: { en: "O-NET past papers (NIETS, official)", th: "ข้อสอบ O-NET ย้อนหลัง (สทศ. ทางการ)" },
    url: "https://www.niets.or.th/th/catalog/view/630",
    groups: ["onet"],
  },
  {
    name: { en: "A-Level papers with answers (mytcas)", th: "ข้อสอบ A-Level พร้อมเฉลย (mytcas)" },
    url: "https://www.mytcas.com/answers",
    groups: ["tcas"],
  },
  {
    name: { en: "TruePlookpanya exam bank (all levels)", th: "คลังข้อสอบ ทรูปลูกปัญญา (ทุกระดับชั้น)" },
    url: "https://www.trueplookpanya.com/examination",
    groups: ["m1", "m4", "onet", "tcas"],
  },
  { name: { en: "POSN exam bank (สอวน.)", th: "คลังข้อสอบ สอวน." }, url: "https://www.posn.or.th/examination/", groups: ["posn"] },
  { name: { en: "IJSO past papers", th: "ข้อสอบ IJSO" }, url: "https://www.posn.or.th/projects/academic-olympiad/ijso/examination/", groups: ["ijso"] },
  { name: { en: "Baan Krupui exam collection", th: "คลังข้อสอบ บ้านครูปุ้ย" }, url: "https://www.baankrupui.com/%E0%B8%84%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%AA%E0%B8%AD%E0%B8%9A", groups: ["m1", "m4", "onet"] },
  { name: { en: "Chula Tutor: M.4 entrance practice", th: "Chula Tutor: ข้อสอบเข้า ม.4" }, url: "https://exam.chulatutor.com/m4/", groups: ["m4"] },
];
