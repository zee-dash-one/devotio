import { describe, expect, it } from "vitest";
import {
  assertFriendCapacity,
  assertFriendChange,
  assertFriendRecipient,
  friendPair,
  friendView,
  privateShare,
  filterFriends,
  shareFingerprint,
  shareInputSchema,
  friendCodeSchema,
  type FriendLink,
  type ShareRecord,
} from "./social";
const link: FriendLink = {
  id: "link",
  low: "a",
  high: "b",
  requesterId: "a",
  state: "pending",
};
const quote = {
  book: "jo",
  chapter: 1,
  first: 1,
  last: 2,
  version: "alm1911" as const,
  text: "Texto",
  reference: "João 1:1–2",
  versionName: "ARC1911",
};
describe("amizades e recados privados", () => {
  it("exige aceite do destinatário e limita transições ao par", () => {
    expect(friendPair("b", "a")).toEqual({ low: "a", high: "b" });
    expect(() => friendPair("a", "a")).toThrow();
    expect(() => assertFriendChange(link, "a", "accept")).toThrow();
    expect(() => assertFriendChange(link, "c", "remove")).toThrow();
    expect(() => assertFriendChange(link, "b", "accept")).not.toThrow();
    expect(friendView(link, "b", "José", true).state).toBe("incoming");
    expect(friendView(link, "a", "Maria", true).state).toBe("outgoing");
    expect(() => assertFriendCapacity(200)).toThrow();
  });
  it("recusa destinatário inativo, pendente ou amizade de outro par", () => {
    expect(() => assertFriendRecipient(link, "a", "b", true)).toThrow();
    expect(() =>
      assertFriendRecipient({ ...link, state: "accepted" }, "a", "b", false),
    ).toThrow();
    expect(() =>
      assertFriendRecipient({ ...link, state: "accepted" }, "a", "c", true),
    ).toThrow();
    expect(() =>
      assertFriendRecipient({ ...link, state: "accepted" }, "a", "b", true),
    ).not.toThrow();
  });
  it("destinatário não recebe nem campos nem identidades dos outros destinatários", () => {
    const record: ShareRecord = {
      id: "share",
      senderId: "a",
      senderName: "Ana",
      recipients: [
        { id: "b", name: "Bruno" },
        { id: "c", name: "Carla" },
      ],
      quote,
      message: "Recado",
      sentAt: 1,
    };
    expect(privateShare(record, "a").recipients).toHaveLength(2);
    const received = privateShare(record, "b");
    expect(received).not.toHaveProperty("recipients");
    expect(JSON.stringify(received)).not.toContain("Carla");
    expect(received.direction).toBe("received");
    expect(() => privateShare(record, "d")).toThrow();
  });
  it("valida limites, destinatários únicos, código e idempotência sem depender da ordem", () => {
    const input = {
      selection: quote,
      recipientIds: ["b", "c"],
      message: "Recado",
      requestId: "280fbcfa-d8e3-4564-911d-207e71d1a230",
    };
    expect(shareFingerprint(input)).toBe(
      shareFingerprint({ ...input, recipientIds: ["c", "b"] }),
    );
    for (const patch of [
      { recipientIds: [] },
      { recipientIds: ["b", "b"] },
      { recipientIds: Array.from({ length: 21 }, (_, n) => String(n)) },
      { message: " " },
      { message: "x".repeat(1001) },
    ])
      expect(shareInputSchema.safeParse({ ...input, ...patch }).success).toBe(
        false,
      );
    expect(friendCodeSchema.parse(" abcdef234567 ")).toBe("ABCDEF234567");
    expect(
      filterFriends([friendView(link, "b", "José", true)], "JOSE"),
    ).toHaveLength(1);
  });
});
