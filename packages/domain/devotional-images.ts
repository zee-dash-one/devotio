import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import type { Devotional } from "./types";

export const IMAGE_LAYOUT_VERSION = "basic-paths-v1";
export const IMAGE_RETENTION_DAYS = 30;
export const IMAGE_MAX_PAGES = 10;
export const IMAGE_PUBLIC_URL = "devotio.zee-dash-one.workers.dev";
export const imageSizes = [
  { id: "story", label: "Vertical", width: 1080, height: 1920 },
  { id: "portrait", label: "Retrato", width: 1080, height: 1350 },
  { id: "square", label: "Quadrado", width: 1080, height: 1080 },
] as const;
export const imageStyles = [
  { id: "paper", label: "Papel claro", version: "basic-paper-v1" },
  { id: "forest", label: "Verde escuro", version: "basic-forest-v1" },
] as const;
export const IMAGE_TEXT_LIMIT = "O texto excede dez páginas por formato. Revise o conteúdo editorial.";
export const IMAGE_REFERENCE_LIMIT = "A referência é longa demais para a arte.";
type ImageMeasure = (text: string, size: number) => number;
function wrapImageText(text: string, size: number, maxWidth: number, measure: ImageMeasure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (measure(line ? line + " " + word : word, size) <= maxWidth) { line += (line ? " " : "") + word; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const { segment } of new Intl.Segmenter("pt", { granularity: "grapheme" }).segment(word)) {
        if (line && measure(line + segment, size) > maxWidth) { lines.push(line); line = ""; }
        line += segment;
      }
    }
    lines.push(line);
  }
  return lines;
}
/** Width used before render. Slightly wider than Lora, so the editor rejects text the art could not hold. */
export function conservativeImageMeasure(text: string, size: number) { return text.length * size * 0.62; }
export function layoutImages(content: Pick<ImageContent, "reference" | "reflection" | "prayerSuggestion">, measure: ImageMeasure = conservativeImageMeasure) {
  return imageSizes.map(size => {
    const reference = wrapImageText(content.reference, 42, 900, measure);
    const top = 185 + reference.length * 54;
    const linesPerPage = Math.floor((size.height - top - 150) / 55);
    if (linesPerPage < 4) throw new Error(IMAGE_REFERENCE_LIMIT);
    const lines = ["MEDITAR", ...wrapImageText(content.reflection, 38, 900, measure), "", "ORAÇÃO", ...wrapImageText(content.prayerSuggestion, 38, 900, measure)];
    const pages: string[][] = [];
    for (let offset = 0; offset < lines.length;) {
      while (lines[offset] === "") offset++;
      let end = Math.min(offset + linesPerPage, lines.length);
      if (end < lines.length && ["MEDITAR", "ORAÇÃO"].includes(lines[end - 1])) end--;
      const pageLines = lines.slice(offset, end);
      while (pageLines.at(-1) === "") pageLines.pop();
      if (pageLines.length) pages.push(pageLines);
      if (end <= offset) throw new Error(IMAGE_TEXT_LIMIT);
      offset = end;
    }
    if (pages.length > IMAGE_MAX_PAGES) throw new Error(IMAGE_TEXT_LIMIT);
    return { ...size, reference, pages };
  });
}
export function imageTextLimitMessage(content: Pick<ImageContent, "reference" | "reflection" | "prayerSuggestion">): string | null {
  try { layoutImages(content); return null; } catch (error) { return error instanceof Error ? error.message : IMAGE_TEXT_LIMIT; }
}
export const imageContentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().min(1).max(300),
  reflection: z.string().min(1).max(20000),
  prayerSuggestion: z.string().min(1).max(20000),
}).superRefine((value, ctx) => {
  const message = imageTextLimitMessage(value);
  if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});
export type ImageContent = z.infer<typeof imageContentSchema>;
export function imageContent(day: Pick<Devotional, keyof ImageContent>): ImageContent {
  return imageContentSchema.parse({ date: day.date, reference: day.reference, reflection: day.reflection, prayerSuggestion: day.prayerSuggestion });
}
export function imageRevision(day: Pick<Devotional, keyof ImageContent>): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify([IMAGE_LAYOUT_VERSION, imageStyles, imageSizes, IMAGE_PUBLIC_URL, imageContent(day)]))));
}
export const imageRequestSchema = z.object({ id: z.string().min(1).max(100), revision: z.string().regex(/^[a-f0-9]{64}$/) });
export interface DevotionalImageFile { variant: string; page: number; pages: number; width: number; height: number; bytes: number; url: string }
export interface DevotionalImageManifest {
  revision: string;
  status: "pending" | "rendering" | "ready" | "failed" | "unavailable";
  files: DevotionalImageFile[];
}
export function imageAvailableToday(date: string, now: number): boolean {
  return date === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}
