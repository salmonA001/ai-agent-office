/**
 * The text of a PDF (a past exam paper, notes), read in the browser: nothing is uploaded. pdf.js
 * loads only when a PDF is attached, and runs on the page (its worker module is handed over
 * directly), which is fine for the occasional file.
 */

const MAX_PAGES = 40;

/**
 * Thai text out of PDFs often comes apart: sara am (ำ) as nikhahit + sara aa (ํา), and tone marks the
 * font doesn't map as NUL characters. Put sara am back together and drop what can't be read.
 */
const tidy = (text: string) =>
  text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\u0E4D([\u0E48-\u0E4B]?)\u0E32/g, "$1\u0E33")
    .normalize("NFC");

export class ScannedPdfError extends Error {
  constructor() {
    super("scanned");
  }
}

export async function pdfText(file: File, maxChars = 20000): Promise<{ text: string; pages: number }> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs")]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await loading.promise;
  try {
    const parts: string[] = [];
    let length = 0;
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= pages && length < maxChars; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line.trimEnd());
          line = "";
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      const text = tidy(lines.filter((l) => l.trim()).join("\n"));
      if (text) {
        parts.push(`[page ${n}]\n${text}`);
        length += text.length;
      }
      page.cleanup();
    }
    const text = parts.join("\n\n").slice(0, maxChars);
    // a scan is pictures of pages: no text layer to read
    if (text.replace(/\[page \d+\]|\s/g, "").length < 40) throw new ScannedPdfError();
    return { text, pages: doc.numPages };
  } finally {
    void loading.destroy();
  }
}
