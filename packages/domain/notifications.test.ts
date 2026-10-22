import { describe, expect, it } from "vitest";
import { notificationKind, notificationTarget, type AppNotification } from "./sharing";
const base: AppNotification = { id: "notice", type: "system", entity: "Grupo", text: "Aviso", communityId: null, messageId: null, createdAt: 1, readAt: null };
describe("notification navigation", () => {
  it("maps all four destinations and keeps legacy community notices", () => {
    expect(notificationTarget({ ...base, kind: "friendShare", target: { version: "alm1911", book: "jo", chapter: 3, verse: 16 } })).toEqual({ to: "/biblia", search: { version: "alm1911", book: "jo", chapter: 3, verse: 16 } });
    expect(notificationTarget({ ...base, kind: "communityAccepted", communityId: "group" })).toEqual({ to: "/comunidade/$communityId", params: { communityId: "group" } });
    expect(notificationTarget({ ...base, kind: "communityRemoved", communityId: "group" })).toEqual({ to: "/comunidade" });
    const legacy = { ...base, type: "community" as const, communityId: "group", messageId: "message" };
    expect(notificationKind(legacy)).toBe("communityPost");
    expect(notificationTarget(legacy)).toEqual({ to: "/comunidade/$communityId", params: { communityId: "group" }, search: { message: "message" } });
  });
  it("does not link missing destinations or invent a Bible location", () => {
    expect(notificationTarget({ ...base, kind: "friendShare" })).toBeNull();
    expect(notificationTarget({ ...base, kind: "communityPost", communityId: "group", messageId: "message", available: false })).toBeNull();
    expect(notificationTarget({ ...base, kind: "communityAccepted", communityId: null })).toBeNull();
  });
});
