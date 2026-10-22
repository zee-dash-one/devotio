import { z } from "zod";

export const accessStatusSchema = z.enum(["pending", "approved", "disabled"]);
export const userNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(100);
export const userEmailSchema = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254)
  .transform((value) => value.toLowerCase());
export const adminLoginSchema = z.object({
  login: userEmailSchema,
  password: z.string().min(1, "Informe a senha.").max(256),
  code: z.string().regex(/^\d{6}$/, "Informe os seis números do autenticador."),
});
export const managedUserSchema = z.object({
  name: userNameSchema,
  email: userEmailSchema,
  status: accessStatusSchema,
  editorial: z.boolean(),
});
export const updateManagedUserSchema = managedUserSchema
  .omit({ email: true })
  .extend({ id: z.string().min(1) });
export const adminListSchema = z.object({
  cursor: z.string().nullable(),
  search: z.string().trim().toLowerCase().max(100),
  field: z.enum(["name", "email"]),
  status: accessStatusSchema.optional(),
});
export const communityPermissionSchema = z.object({
  userId: z.string().min(1),
  communityId: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "none"]),
});
