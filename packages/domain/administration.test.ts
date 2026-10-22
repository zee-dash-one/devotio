import { describe, expect, it } from "vitest";
import {
  effectiveAccess,
  hasApprovedAccess,
  initialAccess,
  canManageEditorial,
} from "./administration";
import {
  adminLoginSchema,
  managedUserSchema,
  updateManagedUserSchema,
  communityPermissionSchema,
} from "./validators/administration";
describe("regras de acesso ao piloto", () => {
  it("preserva legados e bloqueia pendentes/desativados mesmo com permissão editorial", () => {
    expect(effectiveAccess()).toBe("approved");
    expect(hasApprovedAccess()).toBe(true);
    for (const status of ["pending", "disabled"] as const) {
      expect(hasApprovedAccess(status)).toBe(false);
      expect(canManageEditorial({ status, editorial: true })).toBe(false);
    }
    expect(canManageEditorial({ status: "approved", editorial: false })).toBe(
      false,
    );
    expect(canManageEditorial({ editorial: true })).toBe(true);
  });
  it("só novos cadastros dependem da regra de entrada", () => {
    expect(initialAccess(true, false)).toBe("pending");
    expect(initialAccess(true, true)).toBe("approved");
    expect(initialAccess(false, false)).toBe("approved");
  });
  it("normaliza e-mail, valida TOTP e não aceita papéis arbitrários", () => {
    expect(
      managedUserSchema.parse({
        name: " Ana ",
        email: "Ana@EXAMPLE.COM",
        status: "pending",
        editorial: false,
      }),
    ).toMatchObject({ name: "Ana", email: "ana@example.com" });
    expect(
      adminLoginSchema.safeParse({
        login: "admin@example.com",
        password: "secret",
        code: "12345",
      }).success,
    ).toBe(false);
    expect(
      adminLoginSchema.safeParse({
        login: "admin@example.com",
        password: "secret",
        code: "012345",
      }).success,
    ).toBe(true);
    expect(
      updateManagedUserSchema.safeParse({
        id: "a",
        name: "Ana",
        status: "superuser",
        editorial: true,
      }).success,
    ).toBe(false);
    expect(
      communityPermissionSchema.safeParse({
        userId: "a",
        communityId: "b",
        role: "superadmin",
      }).success,
    ).toBe(false);
  });
});
