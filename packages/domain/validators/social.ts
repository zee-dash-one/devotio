import { z } from "zod";
import { bibleSelectionSchema } from "./sharing";
export const MAX_FRIENDS = 200;
export const socialIdSchema = z.string().min(1).max(100);
export const friendCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{12}$/, "Informe o código de 12 caracteres.");
export const friendRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("code"), code: friendCodeSchema }),
  z.object({
    kind: z.literal("community"),
    communityId: socialIdSchema,
    userId: socialIdSchema,
  }),
]);
export const friendChangeSchema = z.object({
  id: socialIdSchema,
  action: z.enum(["accept", "remove"]),
});
export const shareInputSchema = z.object({
  selection: bibleSelectionSchema,
  recipientIds: z
    .array(socialIdSchema)
    .min(1, "Escolha pelo menos um amigo.")
    .max(20, "Escolha até 20 amigos.")
    .refine((ids) => new Set(ids).size === ids.length, "Amigos repetidos."),
  message: z
    .string()
    .trim()
    .min(1, "Escreva um recado.")
    .max(1000, "Use até 1.000 caracteres no recado."),
  requestId: z.string().uuid(),
});
export const shareFilterSchema = z.object({
  first: z.number().int().min(1).max(176).optional(),
  direction: z.enum(["sent", "received"]).optional(),
  chapter: bibleSelectionSchema
    .innerType()
    .pick({ version: true, book: true, chapter: true })
    .optional(),
  cursor: z.string().max(2000).nullable(),
});
export const socialCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rotateCode") }),
  z.object({ kind: z.literal("request"), input: friendRequestSchema }),
  z.object({ kind: z.literal("change"), input: friendChangeSchema }),
  z.object({ kind: z.literal("send"), input: shareInputSchema }),
]);
