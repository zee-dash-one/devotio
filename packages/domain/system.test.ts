import { describe, expect, it } from "vitest";
import { applyRoleChange, canManageSystem, isNamedOwner, roleChangeBlocker, themesInputSchema, userDeletionBlockers, type DeletionFacts } from "./system";

const open: DeletionFacts = {
  self: false, superuser: false, editorial: false, ownsCommunity: false, communityManager: false,
  hasCommunityMessages: false, hasScriptureShares: false, seedProfile: false, emailMatches: true,
};

describe("system access", () => {
  it("grants system management only to an approved superuser", () => {
    expect(canManageSystem({ status: "approved", superuser: true })).toBe(true);
    expect(canManageSystem({ status: "pending", superuser: true })).toBe(false);
    expect(canManageSystem({ status: "approved", superuser: false })).toBe(false);
  });

  it("recognizes the named owner without using an email", () => {
    expect(isNamedOwner("Hilderney")).toBe(true);
    expect(isNamedOwner("Hildernéy Silva")).toBe(true);
    expect(isNamedOwner("Ana Hilderney")).toBe(false);
  });

  it("requires both monthly and weekly theme fields", () => {
    expect(themesInputSchema.safeParse({ monthlyVerse: "", monthlyReference: "Salmos 23:1", weeklyVerse: "Texto", weeklyReference: "João 1:1" }).success).toBe(false);
    expect(themesInputSchema.safeParse({ monthlyVerse: "O Senhor é o meu pastor.", monthlyReference: "Salmos 23:1", weeklyVerse: "No princípio.", weeklyReference: "João 1:1" }).success).toBe(true);
  });
  it("blocks deletion when the account still has a social footprint", () => {
    expect(userDeletionBlockers(open)).toBeNull();
    expect(userDeletionBlockers({ ...open, emailMatches: false })).toBe("O e-mail digitado não confere.");
    expect(userDeletionBlockers({ ...open, hasCommunityMessages: true })).toMatch(/Desative a conta/);
    expect(userDeletionBlockers({ ...open, self: true })).toMatch(/própria conta/);
  });
  it("decides role changes and keeps editorial with superuser", () => {
    const base = { self: false, namedOwner: false, status: "approved" as const, editorial: false, superuser: false };
    expect(roleChangeBlocker(base, "editorial", true)).toBeNull();
    expect(roleChangeBlocker({ ...base, self: true }, "editorial", true)).toMatch("próprios");
    expect(roleChangeBlocker({ ...base, status: "pending" }, "superuser", true)).toMatch("Aprove");
    expect(roleChangeBlocker({ ...base, status: "pending" }, "editorial", false)).toBeNull();
    expect(roleChangeBlocker({ ...base, namedOwner: true, superuser: true }, "superuser", false)).toMatch("responsável");
    expect(roleChangeBlocker({ ...base, editorial: true, superuser: true }, "editorial", false)).toMatch("Rebaixe");
    expect(applyRoleChange({ editorial: false, superuser: false }, "superuser", true)).toEqual({ editorial: true, superuser: true });
    expect(applyRoleChange({ editorial: true, superuser: true }, "superuser", false)).toEqual({ editorial: true, superuser: false });
    expect(applyRoleChange({ editorial: true, superuser: false }, "editorial", false)).toEqual({ editorial: false, superuser: false });
  });
});
