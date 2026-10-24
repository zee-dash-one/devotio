import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
import type { FriendsData, SharePage, ShareMarker } from "domain/core";
const modules = {
  "./_generated/server.ts": () => import("./_generated/server"),
  "./social.ts": () => import("./social"),
};
const friends = makeFunctionReference<
  "query",
  Record<string, never>,
  FriendsData
>("social:friends");
const shares = makeFunctionReference<
  "query",
  {
    cursor: string | null;
    chapter?: typeof chapter;
    first?: number;
    direction?: "sent" | "received";
  },
  SharePage
>("social:shares");
const markers = makeFunctionReference<"query", typeof chapter, ShareMarker[]>(
  "social:markers",
);
const request = makeFunctionReference<"mutation">("social:request"),
  change = makeFunctionReference<"mutation">("social:change"),
  send = makeFunctionReference<"mutation">("social:send"),
  rotate = makeFunctionReference<"mutation">("social:rotateCode");
const chapter = { version: "alm1911" as const, book: "jo", chapter: 1 },
  selection = { ...chapter, first: 1, last: 2 };
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const result = [];
    for (const name of ["Ana", "Bruno", "Carla", "Diego"])
      result.push(
        await ctx.db.insert("users", {
          name,
          email: name + "@example.com",
          authId: name,
          status: "approved",
        }),
      );
    return result;
  });
  return {
    t,
    ids,
    users: ["Ana", "Bruno", "Carla", "Diego"].map((subject) =>
      t.withIdentity({ subject }),
    ),
  };
}
async function connect(
  users: Awaited<ReturnType<typeof setup>>["users"],
  to: number,
) {
  const code = await users[to].mutation(rotate, {});
  await users[0].mutation(request, { input: { kind: "code", code } });
  const link = (await users[to].query(friends, {})).friends[0];
  await users[to].mutation(change, { id: link.id, action: "accept" });
  return link.id;
}
describe("Convex: amizade consentida e partilha privada", () => {
  it("preserva seleção descontínua e rejeita listas adulteradas", async () => {
    const { users, ids } = await setup();
    await connect(users, 1);
    const chosen = { ...selection, last: 5, verses: [1, 2, 5] };
    await users[0].mutation(send, { selection: chosen, recipientIds: [ids[1]], message: "Leia", requestId: crypto.randomUUID() });
    const received = await users[1].query(shares, { cursor: null });
    expect(received.items[0].quote.verses).toEqual([1, 2, 5]);
    expect(received.items[0].quote.text.split("\n").map(line => Number(line.split(" - ")[0]))).toEqual([1, 2, 5]);
    await expect(users[0].mutation(send, { selection: { ...chosen, verses: [1, 5, 2] }, recipientIds: [ids[1]], message: "Leia", requestId: crypto.randomUUID() })).rejects.toThrow();
  }, 15000); // The first canonical scripture request loads the complete Bible corpus.
  it.each(["pending", "disabled"] as const)("recusa todas as leituras privadas e envio da conta %s", async status => {
    const { t, users, ids } = await setup();
    await connect(users, 1);
    await t.run(ctx => ctx.db.patch(ids[0], { status }));
    await expect(users[0].query(friends, {})).rejects.toThrow();
    await expect(users[0].query(shares, { cursor: null })).rejects.toThrow();
    await expect(users[0].query(markers, chapter)).rejects.toThrow();
    await expect(users[0].mutation(rotate, {})).rejects.toThrow();
    await expect(users[0].mutation(send, { selection, recipientIds: [ids[1]], message: "Recado", requestId: crypto.randomUUID() })).rejects.toThrow();
  });
  it("exige sessão aprovada; código rotacionado não vale e convite inverso não aceita", async () => {
    const { t, users, ids } = await setup();
    await expect(t.query(friends, {})).rejects.toThrow();
    const old = await users[1].mutation(rotate, {}),
      code = await users[1].mutation(rotate, {});
    await expect(
      users[0].mutation(request, { input: { kind: "code", code: old } }),
    ).rejects.toThrow();
    await users[0].mutation(request, { input: { kind: "code", code } });
    const link = (await users[0].query(friends, {})).friends[0];
    await expect(
      users[0].mutation(change, { id: link.id, action: "accept" }),
    ).rejects.toThrow();
    await expect(
      users[2].mutation(change, { id: link.id, action: "remove" }),
    ).rejects.toThrow();
    await users[1].mutation(request, {
      input: { kind: "code", code: await users[0].mutation(rotate, {}) },
    });
    expect((await users[1].query(friends, {})).friends[0].state).toBe(
      "incoming",
    );
    await t.run((ctx) => ctx.db.patch(ids[1], { status: "disabled" }));
    await expect(users[1].query(friends, {})).rejects.toThrow();
    await expect(
      users[1].mutation(change, { id: link.id, action: "accept" }),
    ).rejects.toThrow();
    expect((await users[0].query(friends, {})).friends[0].available).toBe(
      false,
    );
  });
  it("comunidade em comum é verificada no servidor e não concede amizade automática", async () => {
    const { t, users, ids } = await setup();
    const communityId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("communities", {
        name: "Grupo",
        description: "",
        scripture: "",
        inviteCode: "GROUP123",
        createdAt: 1,
      });
      for (const userId of ids.slice(0, 2))
        await ctx.db.insert("communityMembers", {
          communityId: id,
          userId,
          role: "member",
        });
      return id;
    });
    await expect(
      users[2].mutation(request, {
        input: { kind: "community", communityId, userId: ids[1] },
      }),
    ).rejects.toThrow();
    await users[0].mutation(request, {
      input: { kind: "community", communityId, userId: ids[1] },
    });
    await expect(
      users[0].mutation(send, {
        selection,
        recipientIds: [ids[1]],
        message: "Recado",
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    expect((await users[1].query(friends, {})).friends[0].state).toBe(
      "incoming",
    );
  });
  it("envio atômico, fonte canônica, destinatários privados, snapshot e idempotência", async () => {
    const { t, users, ids } = await setup(),
      firstLink = await connect(users, 1);
    await connect(users, 2);
    const input = {
      selection,
      recipientIds: [ids[1], ids[2]],
      message: "Um recado para vocês",
      requestId: crypto.randomUUID(),
    };
    const id = await users[0].mutation(send, input);
    expect(await users[0].mutation(send, input)).toBe(id);
    await expect(
      users[0].mutation(send, { ...input, message: "Diferente" }),
    ).rejects.toThrow();
    const sent = await users[0].query(shares, { cursor: null }),
      received = await users[1].query(shares, { cursor: null });
    expect(sent.items[0].recipients?.map((person) => person.name)).toEqual([
      "Bruno",
      "Carla",
    ]);
    expect(received.items[0]).not.toHaveProperty("recipients");
    expect(JSON.stringify(received)).not.toContain("Carla");
    expect(received.items[0].quote.text).toContain("No principio era o Verbo");
    expect((await users[3].query(shares, { cursor: null })).items).toEqual([]);
    expect(await users[0].query(markers, chapter)).toEqual([
      { first: 1, direction: "sent" },
    ]);
    expect(await users[1].query(markers, chapter)).toEqual([
      { first: 1, direction: "received" },
    ]);
    expect(
      await users[1].query(markers, { ...chapter, version: "aa" as "alm1911" }),
    ).toEqual([]);
    await users[0].mutation(change, { id: firstLink, action: "remove" });
    await expect(
      users[0].mutation(send, { ...input, requestId: crypto.randomUUID() }),
    ).rejects.toThrow();
    expect((await users[1].query(shares, { cursor: null })).items).toHaveLength(
      1,
    );
    await t.run((ctx) => ctx.db.patch(ids[2], { status: "disabled" }));
    await expect(
      users[0].mutation(send, {
        ...input,
        recipientIds: [ids[2]],
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("scriptureShares").collect()),
    ).toHaveLength(1);
    await expect(
      users[0].mutation(send, {
        ...input,
        recipientIds: [ids[0]],
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
  });
  it("pagina histórico e mantém uma marcação por início/direção", async () => {
    const { users, ids } = await setup();
    await connect(users, 1);
    for (let i = 0; i < 32; i++)
      await users[0].mutation(send, {
        selection,
        recipientIds: [ids[1]],
        message: `Recado ${i}`,
        requestId: crypto.randomUUID(),
      });
    const page = await users[1].query(shares, {
      cursor: null,
      chapter,
      first: 1,
      direction: "received",
    });
    expect(page.items).toHaveLength(30);
    expect(page.nextCursor).toBeTruthy();
    const rest = await users[1].query(shares, {
      cursor: page.nextCursor,
      chapter,
      first: 1,
      direction: "received",
    });
    expect(rest.items).toHaveLength(2);
    expect(
      new Set([...page.items, ...rest.items].map((item) => item.id)).size,
    ).toBe(32);
    expect(await users[1].query(markers, chapter)).toHaveLength(1);
  });
});
