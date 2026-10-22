import { z } from "zod";
export const roleSchema = z.enum(["owner", "admin", "member"]);
export const joinDecisionSchema = z.enum(["approve", "reject"]);
export const joinStateSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
export const communityCreationSchema = z.object({
  userId: z.string().min(1),
  allowed: z.boolean(),
  limit: z.number().int().min(0).max(20).default(1),
});
export const memberRoleSchema = z.object({
  id: z.string().min(1), memberId: z.string().min(1), role: z.enum(["admin", "member"]),
});
const id = z.string().min(1).max(100);
const cursor = z.string().regex(/^\d+$/).max(20).nullable();
export const governanceQuerySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("creation") }),
  z.object({ kind: z.literal("mine"), cursor }),
  z.object({ kind: z.literal("requests"), id, cursor }),
]);
export const governanceCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cancel"), requestId: id }),
  z.object({ kind: z.literal("decide"), requestId: id, decision: joinDecisionSchema }),
  memberRoleSchema.extend({ kind: z.literal("setRole") }),
  z.object({ kind: z.literal("leave"), id }),
  z.object({ kind: z.literal("transfer"), id, memberId: id }),
]);
