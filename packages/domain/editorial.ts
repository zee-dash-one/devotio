import { z } from "zod";
import { dateSchema, editorialTextSchema } from "./validators";
import { bibleSelectionSchema } from "./sharing";
import { dateInZone } from "./reading";

export const editorialSaveSchema = z.object({
  date: dateSchema,
  reflection: editorialTextSchema,
  prayerSuggestion: editorialTextSchema,
  selection: bibleSelectionSchema.optional(),
  reason: z.string().trim().max(1000).optional(),
  mode: z.enum(["create", "update"]),
}).superRefine((value, ctx) => {
  if (value.mode === "create" && !value.selection)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selection"], message: "Escolha o trecho na leitura bíblica." });
  if (value.mode === "update" && !value.reason)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Informe o motivo da correção." });
});
export type EditorialSave = z.infer<typeof editorialSaveSchema>;
export const editorialMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe um mês válido.");
export function editorialMonthDates(month: string): string[] {
  editorialMonthSchema.parse(month);
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
export function availableEditorialDates(month: string, occupied: readonly string[], today = dateInZone("America/Sao_Paulo")) {
  dateSchema.parse(today);
  const reserved = new Set(occupied);
  return editorialMonthDates(month).filter(date => date >= today && !reserved.has(date));
}
export function shiftEditorialMonth(month: string, offset: number) {
  editorialMonthSchema.parse(month);
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + offset, 1)).toISOString().slice(0, 7);
}
export const scriptureLicense = "ARC1911 · arquivo fornecido pelo mantenedor; inclusão pública autorizada em 09/10/2026.";
export const localAaLicense = "AA · ABíbliaDigital; uso no ambiente local. Distribuição pública depende de validação de licença.";
export function scriptureLicenseForVersion(version: "aa" | "alm1911") {
  return version === "alm1911" ? scriptureLicense : localAaLicense;
}
