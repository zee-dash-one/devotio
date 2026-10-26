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
export const imageContentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().min(1).max(300),
  reflection: z.string().min(1).max(20000),
  prayerSuggestion: z.string().min(1).max(20000),
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
