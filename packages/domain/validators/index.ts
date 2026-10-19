import { z } from "zod";
import { bibleSelectionSchema } from "./sharing";
export * from "./access";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Informe uma data válida.");
export const editorialTextSchema = z.string().trim().min(1, "Preencha o texto.").max(512, "Use até 512 caracteres.");
export const communitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome à comunidade.")
    .max(80, "Use até 80 caracteres."),
  description: z
    .string()
    .trim()
    .max(280, "Use até 280 caracteres.")
    .default(""),
});
export const inviteSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{8}$/, "O código tem 8 letras ou números.");
export const messageSchema = z
  .string()
  .trim()
  .min(1, "Escreva uma mensagem.")
  .max(1000, "Use até 1.000 caracteres.");
export const scriptureSchema = z
  .string()
  .trim()
  .max(500, "Use até 500 caracteres.");
export const checklistSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à lista.").max(80),
  items: z
    .array(z.string().trim().min(1, "Preencha todos os itens.").max(200))
    .min(1, "Inclua ao menos um item.")
    .max(30, "Use até 30 itens por lista."),
});
export const publicationSchema = z.object({
  selection: bibleSelectionSchema.optional(),
  date: dateSchema,
  reference: z.string().trim().min(1).max(160),
  translation: z.string().trim().min(1).max(160),
  scripture: z.string().trim().min(1).max(6000),
  reflection: z.string().trim().min(1).max(12000),
  prayerSuggestion: z.string().trim().min(1).max(2000),
  credit: z.string().trim().min(1).max(1000),
  licenseEvidence: z.string().trim().min(1).max(2000),
  reviewedBy: z.string().trim().min(1).max(160),
  publishedAt: z.number().finite().nonnegative(),
  reason: z.string().trim().min(1).max(1000),
  audioUrl: z.string().url().startsWith("https://").optional(),
});
export const scheduleSchema = publicationSchema.pick({ date: true, reference: true, scripture: true, reflection: true, prayerSuggestion: true, licenseEvidence: true }).extend({
  reflection: editorialTextSchema,
  prayerSuggestion: editorialTextSchema,
  mode: z.enum(["create", "update"]),
  selection: bibleSelectionSchema.optional(),
  reason: z.string().trim().min(1, "Informe o motivo da correção.").max(1000).optional(),
}).superRefine((input, context) => {
  if (input.mode === "create" && !input.selection) context.addIssue({ code: z.ZodIssueCode.custom, path: ["selection"], message: "Escolha a Palavra na leitura bíblica." });
  if (input.mode === "update" && !input.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Informe o motivo da correção." });
});
export const devotionalSelectionSchema = z.object({
  scripture: publicationSchema.shape.scripture,
  reference: publicationSchema.shape.reference,
});
export function validationMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? "Confira os campos.";
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
}
export const editorialAuditSchema = z.object({
  actor: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(1000),
});
export const themesSchema = z.object({
  monthlyVerse: scriptureSchema,
  monthlyReference: z.string().trim().max(160),
  weeklyVerse: scriptureSchema,
  weeklyReference: z.string().trim().max(160),
});
