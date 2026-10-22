import { describe, expect, it } from "vitest";
import { canCreateCommunity, canChangeRole, canDecideJoin } from "./community-governance";
import { canManage, canRemoveMember } from "./rules";
import type { Role } from "./types";
const roles: Role[] = ["owner", "admin", "member"];
describe("community governance rules", () => {
  it("requires permission and a free ownership slot", () => {
    expect(canCreateCommunity({ allowed: false, limit: 20, owned: 0 })).toBe(false);
    expect(canCreateCommunity({ allowed: true, limit: 1, owned: 0 })).toBe(true);
    expect(canCreateCommunity({ allowed: true, limit: 1, owned: 1 })).toBe(false);
    expect(canCreateCommunity({ allowed: true, limit: 1, owned: 2 })).toBe(false);
    expect(canCreateCommunity({ allowed: true, limit: 0, owned: 0 })).toBe(false);
  });
  it("authorizes every role combination without allowing owner removal or demotion", () => {
    for (const actor of roles) {
      expect(canManage(actor)).toBe(actor !== "member");
      expect(canDecideJoin(actor)).toBe(actor !== "member");
      for (const target of roles) {
        expect(canRemoveMember(target, 2, actor)).toBe(target === "member" ? actor !== "member" : target === "admin" && actor === "owner");
        for (const next of roles) {
          const expected = target !== "owner" && next !== "owner" && (actor === "owner" || (actor === "admin" && target === "member" && next === "admin"));
          expect(canChangeRole(actor, target, next)).toBe(expected);
        }
      }
    }
    expect(canRemoveMember("admin", 1, "owner")).toBe(false);
  });
});
