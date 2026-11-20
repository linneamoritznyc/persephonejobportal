/**
 * PDF generation with pdf-lib (no headless browser). Produces the three CV
 * versions and per-application cover letters. Standard fonts only support
 * WinAnsi, so text is sanitised first (Swedish letters survive).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const INK = rgb(0.07, 0.08, 0.13);
const MUTED = rgb(0.38, 0.41, 0.5);
const ACCENT = rgb(0.76, 0.21, 0.29); // pomegranate

export function winAnsi(s: string): string {
  return (s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ€]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsi(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    public fonts: { serif: PDFFont; serifBold: PDFFont; sans: PDFFont; sansBold: PDFFont },
    private margin = 54
  ) {
    this.newPage();
  }
  get width() {
    return 595.28 - this.margin * 2;
  }
  newPage() {
    this.page = this.doc.addPage([595.28, 841.89]);
    this.y = 841.89 - this.margin;
  }
  ensure(h: number) {
    if (this.y - h < this.margin) this.newPage();
  }
  text(t: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) {
    const font = o.font ?? this.fonts.sans;
    const size = o.size ?? 9.5;
    const indent = o.indent ?? 0;
    for (const line of wrap(t, font, size, this.width - indent)) {
      this.ensure(size * 1.4);
      this.page.drawText(line, { x: this.margin + indent, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size * 1.38;
    }
    this.y -= o.gap ?? 0;
  }
  rule() {
    this.ensure(10);
    this.page.drawLine({
      start: { x: this.margin, y: this.y - 2 },
      end: { x: this.margin + this.width, y: this.y - 2 },
      thickness: 0.6,
      color: ACCENT,
    });
    this.y -= 10;
  }
  heading(t: string) {
    this.y -= 6;
    this.text(t.toUpperCase(), { font: this.fonts.sansBold, size: 8.5, color: ACCENT });
    this.rule();
  }
}

async function newDoc() {
  const doc = await PDFDocument.create();
  const fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  return { doc, fonts };
}

export interface CvInput {
  name: string;
  leadLine: string;
  contact: string;
  summary: string;
  experiences: { org: string; title: string; dates: string; location?: string; bullets: string[] }[];
  skills: string[];
  education: string[];
  languages: string;
  extras: string[];
}

export async function renderCv(cv: CvInput): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  doc.setTitle(`${cv.name} CV`);
  doc.setAuthor(cv.name);
  const w = new Writer(doc, fonts);
  w.text(cv.name, { font: fonts.serifBold, size: 24, gap: 2 });
  w.text(cv.leadLine, { font: fonts.serif, size: 12.5, color: ACCENT, gap: 2 });
  w.text(cv.contact, { size: 8.5, color: MUTED, gap: 4 });
  w.text(cv.summary, { size: 9.5, gap: 2 });

  w.heading("Experience");
  for (const e of cv.experiences) {
    w.ensure(40);
    w.text(`${e.title}, ${e.org}`, { font: fonts.sansBold, size: 10 });
    w.text([e.dates, e.location].filter(Boolean).join("  |  "), { size: 8.5, color: MUTED, gap: 1 });
    for (const b of e.bullets) w.text(`•  ${b}`, { size: 9.2, indent: 8 });
    w.y -= 4;
  }
  w.heading("Skills");
  w.text(cv.skills.join("  ·  "), { size: 9.2 });
  w.heading("Education");
  for (const e of cv.education) w.text(e, { size: 9.2 });
  w.heading("Languages");
  w.text(cv.languages, { size: 9.2 });
  if (cv.extras.length) {
    w.heading("Also");
    for (const e of cv.extras) w.text(`•  ${e}`, { size: 9.2, indent: 8 });
  }
  return doc.save();
}

export async function renderLetter(opts: {
  name: string;
  contact: string;
  date: string;
  company: string;
  role: string;
  body: string;
}): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  doc.setTitle(`Cover letter, ${opts.company}`);
  doc.setAuthor(opts.name);
  const w = new Writer(doc, fonts, 64);
  w.text(opts.name, { font: fonts.serifBold, size: 20, gap: 1 });
  w.text(opts.contact, { size: 8.5, color: MUTED, gap: 2 });
  w.rule();
  w.text(opts.date, { size: 9.5, color: MUTED, gap: 6 });
  w.text(`${opts.company}  |  ${opts.role}`, { font: fonts.sansBold, size: 10.5, gap: 10 });
  for (const para of opts.body.split(/\n{2,}/)) w.text(para.trim(), { font: fonts.serif, size: 11.2, gap: 8 });
  return doc.save();
}
