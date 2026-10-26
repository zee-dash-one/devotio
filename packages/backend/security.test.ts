import workpool from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { refs } from "domain/convex";
import schema from "./schema";
import type { Id } from "./server";
// convex-test requires a _generated path to discover its root. This test-only
// mapping points to the real official builder bindings; no runtime stub is used.
const modules = { "./imageActions.ts": () => import("./imageActions"), "./devotionalImages.ts": () => import("./devotionalImages"),
  "./_generated/server.ts": () => import("./server"),
  "./communities.ts": () => import("./communities"),
  "./communityGovernance.ts": () => import("./communityGovernance"),
  "./notifications.ts": () => import("./notifications"),
  "./home.ts": () => import("./home"),
  "./editorial.ts": () => import("./editorial"),
};
const stores: TestConvex<typeof schema>[] = [];
const setup = () => { const t = convexTest(schema, modules); workpool.register(t, "imageWorkpool"); stores.push(t); return t; };
async function community() {
  const t = setup();
  await t.run(async ctx => {
    for (const authId of ["leader", "member", "outsider"]) await ctx.db.insert("users", { authId, name: authId, email: `${authId}@example.com`, communityCreationAllowed: authId !== "member" });
  });
  const admin = t.withIdentity({ subject: "leader", name: "Líder" });
  const member = t.withIdentity({ subject: "member", name: "Membro" });
  const outsider = t.withIdentity({
    subject: "outsider",
    name: "Outra pessoa",
  });
  const id = await admin.mutation(refs.create, {
    name: "Grupo",
    description: "",
  });
  const code = (await admin.query(refs.communities, {}))[0].inviteCode!;
  await member.mutation(refs.join, { code });
  const request = await t.run(ctx => ctx.db.query("communityJoinRequests").first());
  await admin.mutation(makeFunctionReference<"mutation">("communityGovernance:decideJoinRequest"), { requestId: request!._id, decision: "approve" });
  return { t, admin, member, outsider, id, code };
}
beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  try { for (const t of stores.splice(0)) await t.finishAllScheduledFunctions(vi.runAllTimers); }
  finally { vi.useRealTimers(); }
});
describe("autorização e consistência no servidor", () => {
  it("pagina o mural sem truncar o histórico nem repetir mensagens", async () => {
    const { t, admin, id } = await community();
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", "leader"))
        .unique();
      for (let n = 0; n < 55; n++)
        await ctx.db.insert("communityMessages", {
          communityId: id as Id<"communities">,
          senderId: user!._id,
          content: String(n),
          sentAt: n,
        });
    });
    const first = (await admin.query(refs.detail, { id, cursor: null }))!;
    const second = (await admin.query(refs.detail, {
      id,
      cursor: first.nextCursor,
    }))!;
    expect(first.messages).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(second.messages).toHaveLength(5);
    expect(second.hasMore).toBe(false);
    expect(
      new Set([...first.messages, ...second.messages].map((m) => m.id)).size,
    ).toBe(55);
  });
  it("recusa acesso sem sessão", async () => {
    const t = setup();
    await expect(t.query(refs.home, { date: "2026-10-03" })).rejects.toThrow();
    await expect(
      t.mutation(refs.create, { name: "Grupo", description: "" }),
    ).rejects.toThrow();
  });
  it("isola grupos e não permite que membros publiquem", async () => {
    const { member, outsider, id } = await community();
    expect(await outsider.query(refs.detail, { id, cursor: null })).toBeNull();
    await expect(
      outsider.mutation(refs.send, { id, content: "Intrusão" }),
    ).rejects.toThrow();
    await expect(
      member.mutation(refs.send, { id, content: "Intrusão" }),
    ).rejects.toThrow();
    await expect(
      member.mutation(refs.scripture, { id, scripture: "Troca" }),
    ).rejects.toThrow();
    await expect(
      member.mutation(refs.list, { id, name: "Lista", items: ["Item"] }),
    ).rejects.toThrow();
  });
  it("adesão repetida não duplica membros nem expõe email/convite", async () => {
    const { member, id, code } = await community();
    await member.mutation(refs.join, { code });
    const data = await member.query(refs.detail, { id, cursor: null });
    expect(data!.members).toHaveLength(2);
    expect(data!.community.inviteCode).toBeUndefined();
    expect(data!.members[0]).not.toHaveProperty("email");
  });
  it("ticks pertencem à sessão e contagem exclui membros removidos", async () => {
    const { t, admin, member, outsider, id } = await community();
    await admin.mutation(refs.list, {
      id,
      name: "Oração",
      items: ["Famílias"],
    });
    let data = (await member.query(refs.detail, { id, cursor: null }))!;
    const itemId = data.lists[0].items[0].id;
    await expect(
      outsider.mutation(refs.tick, { itemId, checked: true }),
    ).rejects.toThrow();
    await member.mutation(refs.tick, { itemId, checked: true });
    await member.mutation(refs.tick, { itemId, checked: true });
    expect(
      await t.run((ctx) => ctx.db.query("checklistTicks").collect()),
    ).toHaveLength(1);
    data = (await admin.query(refs.detail, { id, cursor: null }))!;
    expect(data.lists[0].items[0]).toMatchObject({ checked: false, count: 1 });
    const memberId = data.members.find((m) => m.role === "member")!.id;
    await admin.mutation(refs.remove, { id, memberId });
    expect(await member.query(refs.detail, { id, cursor: null })).toBeNull();
    expect(
      (await admin.query(refs.detail, { id, cursor: null }))!.lists[0].items[0]
        .count,
    ).toBe(0);
    await expect(
      member.mutation(refs.tick, { itemId, checked: false }),
    ).rejects.toThrow();
  });
  it("protege o último administrador e IDs de outros grupos", async () => {
    const { admin, outsider, id } = await community();
    const own = (await admin.query(refs.detail, {
      id,
      cursor: null,
    }))!.members.find((m) => m.role === "admin")!;
    await expect(
      admin.mutation(refs.remove, { id, memberId: own.id }),
    ).rejects.toThrow();
    const otherId = await outsider.mutation(refs.create, {
      name: "Outro",
      description: "",
    });
    const other = (await outsider.query(refs.detail, {
      id: otherId,
      cursor: null,
    }))!.members[0];
    await expect(
      admin.mutation(refs.remove, { id, memberId: other.id }),
    ).rejects.toThrow();
  });
  it("libera agendamento, mantém uma publicação por data e respeita retirada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    const t = setup();
    const reader = t.withIdentity({ subject: "reader" });
    await t.run(ctx => ctx.db.insert("users", { authId: "reader", name: "Leitor", email: "reader@example.com" }));
    const publish = makeFunctionReference<
      "mutation",
      {
        date: string;
        reference: string;
        translation: string;
        scripture: string;
        reflection: string;
        prayerSuggestion: string;
        credit: string;
        licenseEvidence: string;
        reviewedBy: string;
        publishedAt: number;
        reason: string;
      },
      Id<"devotionals">
    >("editorial:publish");
    const input = {
      date: "2026-10-03",
      reference: "Referência",
      translation: "Autoral",
      scripture: "Texto de teste",
      reflection: "Reflexão teste",
      prayerSuggestion: "Oração teste",
      credit: "Equipe",
      licenseEvidence: "Autorização teste",
      reviewedBy: "Editor humano",
      publishedAt: Date.now() + 60000,
      reason: "Teste",
    };
    const id = await t.mutation(publish, input);
    await t.mutation(publish, { ...input, reflection: "Correção" });
    expect(
      await t.run((ctx) => ctx.db.query("devotionals").collect()),
    ).toHaveLength(1);
    expect(
      (await reader.query(refs.home, { date: input.date })).devotional,
    ).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await reader.query(refs.home, { date: input.date })).devotional
        ?.reflection,
    ).toBe("Correção");
    await t.mutation(makeFunctionReference<"mutation">("editorial:withdraw"), {
      id,
      actor: "Editor",
      reason: "Revisão",
    });
    expect(
      (await reader.query(refs.home, { date: input.date })).devotional,
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("editorialEvents").collect()),
    ).toHaveLength(3);
  });
});
