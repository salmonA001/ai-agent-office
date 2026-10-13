import type { Lang } from "@/lib/i18n";

/**
 * Small talk for two agents sharing a table, a fire pit or a game: short back-and-forth
 * conversations, taking turns line by line. "{task}" is filled in with what the team is working on.
 */
type Convo = Record<Lang, string[]>;

const CONVOS: Convo[] = [
  {
    en: ["How's your week going?", "Busy, but good!", "Same here.", "Coffee after this?", "Always."],
    th: ["สัปดาห์นี้เป็นไงบ้าง?", "ยุ่งแต่ก็ดีนะ!", "เหมือนกันเลย", "เสร็จแล้วไปกินกาแฟไหม?", "ไปสิ"],
  },
  {
    en: ["Did you see the new task?", "About {task}?", "Yes! Tricky one.", "Max will split it up.", "He always does."],
    th: ["เห็นงานใหม่ยัง?", "เรื่อง {task} ใช่ไหม?", "ใช่! ยากอยู่นะ", "เดี๋ยว Max ก็แบ่งงานให้", "เขาทำเสมอแหละ"],
  },
  {
    en: ["Any plans for the weekend?", "Hiking, maybe.", "Nice! Where?", "Up in the hills.", "Take photos!"],
    th: ["สุดสัปดาห์มีแผนไปไหนไหม?", "อาจจะไปเดินป่า", "ดีจัง! ไปไหน?", "บนดอยน่ะ", "ถ่ายรูปมาด้วยนะ!"],
  },
  {
    en: ["Have you tried the oat latte?", "Robo makes it best.", "Better than me!", "Ha, don't tell him.", "Our secret."],
    th: ["ลองโอ๊ตลาเต้หรือยัง?", "Robo ทำอร่อยสุด", "อร่อยกว่าฉันทำอีก!", "ฮ่า อย่าบอกเขานะ", "ความลับของเรา"],
  },
  {
    en: ["I'm stuck on a bug.", "Want a second pair of eyes?", "Yes please!", "Show me after lunch.", "Deal."],
    th: ["ติดบั๊กอยู่เลย", "ให้ช่วยดูไหม?", "ขอเลย!", "หลังข้าวเที่ยงเอามาให้ดูนะ", "ตกลง"],
  },
  {
    en: ["Biscuit stole my sandwich!", "Again?!", "Third time this week.", "He's a good boy though.", "The best boy."],
    th: ["บิสกิตขโมยแซนด์วิชฉัน!", "อีกแล้วเหรอ?!", "ครั้งที่สามของสัปดาห์แล้ว", "แต่เขาก็เป็นเด็กดีนะ", "ดีที่สุดเลย"],
  },
  {
    en: ["The view from the roof!", "Sunset is the best.", "We should go up later.", "Bring snacks.", "Obviously."],
    th: ["วิวจากดาดฟ้าสวยมาก!", "ตอนพระอาทิตย์ตกสวยสุด", "เดี๋ยวขึ้นไปกันนะ", "เอาขนมไปด้วย", "แน่นอนอยู่แล้ว"],
  },
  {
    en: ["What are you reading?", "A book on design.", "Any good?", "Changed how I think.", "Lend it to me?"],
    th: ["อ่านอะไรอยู่?", "หนังสือเรื่องดีไซน์", "ดีไหม?", "เปลี่ยนวิธีคิดฉันเลย", "ให้ยืมหน่อยได้ไหม?"],
  },
  {
    en: ["Ready for the demo?", "Almost. Nervous!", "You'll be great.", "Thanks, that helps.", "We've got you."],
    th: ["พร้อมเดโมหรือยัง?", "เกือบแล้ว ตื่นเต้น!", "ทำได้แน่นอน", "ขอบคุณนะ ช่วยได้เยอะ", "พวกเราอยู่ข้างเธอ"],
  },
  {
    en: ["Lunch at the café?", "Or the rooftop BBQ?", "Ooh, BBQ!", "I'll ask the others.", "Perfect."],
    th: ["ไปกินข้าวที่คาเฟ่ไหม?", "หรือบาร์บีคิวบนดาดฟ้า?", "โอ้ บาร์บีคิว!", "เดี๋ยวชวนคนอื่นด้วย", "เยี่ยม"],
  },
  {
    en: ["How's {task} going?", "Nearly there!", "Need anything?", "Just more coffee.", "On it."],
    th: ["{task} เป็นไงบ้าง?", "ใกล้เสร็จแล้ว!", "ต้องการอะไรไหม?", "แค่กาแฟเพิ่ม", "จัดให้"],
  },
  {
    en: ["Night shift again?", "Yep, I like the quiet.", "And the city lights.", "Exactly!", "Enjoy it."],
    th: ["เข้ากะดึกอีกแล้วเหรอ?", "ใช่ ชอบความเงียบ", "แล้วก็ไฟเมืองด้วย", "ใช่เลย!", "สนุกนะ"],
  },
];

let topic = "";

/** What the team is working on right now, for the small talk. */
export function setChatterTopic(text: string | undefined) {
  topic = (text ?? "").trim();
}

/** Seconds each line stays up. */
const LINE = 3.2;

/**
 * The line this agent says right now in a conversation with their partner, or undefined while
 * the partner talks (or between conversations). `first` says who opens.
 */
export function chatLine(lang: Lang, pairKey: number, first: boolean, t: number): string | undefined {
  const round = 6 * LINE;
  const n = Math.floor(t / round);
  const convo = CONVOS[Math.abs(Math.floor(pairKey * 7.3 + n * 3.1)) % CONVOS.length];
  const lines = convo[lang];
  const i = Math.floor((t % round) / LINE);
  if (i >= lines.length) return undefined;
  if ((i % 2 === 0) !== first) return undefined;
  const short = topic.length > 22 ? `${topic.slice(0, 21)}…` : topic || (lang === "th" ? "งานใหม่" : "the new task");
  return lines[i].replace("{task}", short);
}
