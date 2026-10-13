import type { Lang } from "./i18n";
import type { StudyLevel } from "./run-task";

/**
 * Exam prep: practice quizzes in the style of real Thai exams (entrance to Mathayom 4, the POSN
 * olympiad camp-1 selection, IJSO). Theo writes original questions from each exam's syllabus;
 * the real past papers are linked, for learners to download and attach.
 */

export type ExamGroup = "m4" | "posn" | "ijso";

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

export const examById = (id: string | undefined) => EXAMS.find((e) => e.id === id);

/** Where to find the real past papers (download them, then attach the PDF to be tested on it). */
export const PAST_PAPERS: { name: Record<Lang, string>; url: string }[] = [
  { name: { en: "POSN exam bank (สอวน.)", th: "คลังข้อสอบ สอวน." }, url: "https://www.posn.or.th/examination/" },
  { name: { en: "IJSO past papers", th: "ข้อสอบ IJSO" }, url: "https://www.posn.or.th/projects/academic-olympiad/ijso/examination/" },
  { name: { en: "Baan Krupui exam collection", th: "คลังข้อสอบ บ้านครูปุ้ย" }, url: "https://www.baankrupui.com/%E0%B8%84%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%AA%E0%B8%AD%E0%B8%9A" },
  { name: { en: "Chula Tutor: M.4 entrance practice", th: "Chula Tutor: ข้อสอบเข้า ม.4" }, url: "https://exam.chulatutor.com/m4/" },
];
