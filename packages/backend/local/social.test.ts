import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { LocalDatabase } from "./database.local";
import type { FriendsData, SharePage, ShareInput } from "domain/core";
const stores: LocalDatabase[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.close()));
function setup() {
  const db = new LocalDatabase(":memory:");
  stores.push(db);
  return db;
}
function connect(db: LocalDatabase, actor: string, target: string) {
  const code = db.command(db.profile(target), {
    action: "social",
    input: { kind: "rotateCode" },
  }) as string;
  db.command(db.profile(actor), {
    action: "social",
    input: { kind: "request", input: { kind: "code", code } },
  });
  const links = db.query(db.profile(target), {
    query: "socialFriends",
  }) as FriendsData;
  const link = links.friends.find((item) => item.userId === actor)!;
  db.command(db.profile(target), {
    action: "social",
    input: { kind: "change", input: { id: link.id, action: "accept" } },
  });
  return link.id;
}
describe("amizades e partilhas no SQLite", () => {
  it("reabre amizades, código e snapshot após reiniciar o banco", () => {
    const directory = mkdtempSync(join(tmpdir(), "devotio-social-test-"));
    if (
      !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
      !basename(directory).startsWith("devotio-social-test-")
    )
      throw new Error("Diretório inesperado.");
    const file = join(directory, "test.sqlite");
    let db = new LocalDatabase(file);
    try {
      connect(db, "daniel", "marina");
      const code = db.social.friends("marina").code;
      db.command(db.profile("daniel"), {
        action: "social",
        input: {
          kind: "send",
          input: {
            selection: {
              version: "alm1911",
              book: "jo",
              chapter: 1,
              first: 1,
              last: 2,
            },
            recipientIds: ["marina"],
            message: "Persistente",
            requestId: crypto.randomUUID(),
          },
        },
      });
      db.close();
      db = new LocalDatabase(file);
      expect(db.social.friends("marina").code).toBe(code);
      expect(db.social.friends("marina").friends[0].state).toBe("friend");
      expect(
        db.social.shares("marina", { cursor: null }).items[0].message,
      ).toBe("Persistente");
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("persiste links, invalida ambos via SSE e impede descoberta fora da comunidade", () => {
    const db = setup();
    let events = 0;
    const stop = db.subscribeNotifications("marina", () => events++);
    connect(db, "daniel", "marina");
    expect(events).toBe(3);
    stop();
    const communityId = db.get<{ id: string }>(
      "SELECT id FROM communities LIMIT 1",
    )!.id;
    expect(() =>
      db.command(db.profile("lucas"), {
        action: "social",
        input: {
          kind: "request",
          input: { kind: "community", communityId, userId: "marina" },
        },
      }),
    ).toThrow("participar");
    expect(db.social.friends("daniel").friends[0].state).toBe("friend");
  });
  it("protege destinatários, deriva fonte, retém histórico e evita duplicação/efeitos parciais", () => {
    const db = setup(),
      link = connect(db, "daniel", "marina");
    connect(db, "daniel", "lucas");
    const input: ShareInput = {
      selection: {
        version: "alm1911",
        book: "jo",
        chapter: 1,
        first: 1,
        last: 2,
      },
      recipientIds: ["marina", "lucas"],
      message: "Recado privado",
      requestId: crypto.randomUUID(),
    };
    const send = (value: ShareInput) =>
      db.command(db.profile("daniel"), {
        action: "social",
        input: { kind: "send", input: value },
      });
    expect(send(input)).toBe(send(input));
    expect(() =>
      send({
        ...input,
        recipientIds: ["marina", "ester"],
        requestId: crypto.randomUUID(),
      }),
    ).toThrow();
    const received = db.query(db.profile("marina"), {
      query: "socialShares",
      input: { cursor: null },
    }) as SharePage;
    expect(received.items).toHaveLength(1);
    expect(received.items[0]).not.toHaveProperty("recipients");
    expect(received.items[0].quote.text).toContain("No principio era o Verbo");
    expect(db.social.shares("ester", { cursor: null }).items).toEqual([]);
    expect(db.social.markers("marina", input.selection)).toEqual([
      { first: 1, direction: "received" },
    ]);
    db.command(db.profile("marina"), {
      action: "social",
      input: { kind: "change", input: { id: link, action: "remove" } },
    });
    expect(() => send({ ...input, requestId: crypto.randomUUID() })).toThrow();
    expect(db.social.shares("marina", { cursor: null }).items).toHaveLength(1);
    expect(
      db.social.markers("marina", { ...input.selection, version: "aa" }),
    ).toEqual([]);
  });
});
