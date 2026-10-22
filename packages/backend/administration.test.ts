import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { componentsGeneric, makeFunctionReference } from "convex/server";
import type { ComponentApi } from "@convex-dev/better-auth/_generated/component.js";
import betterAuth from "@convex-dev/better-auth/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { hashPassword } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { createHash } from "node:crypto";
import { accessRefs } from "../domain/react/administration";
import { refs } from "domain/convex";
import schema from "./schema";
import { matchingCounter } from "./adminLogin";

const modules = {
  "./_generated/server.ts": () => import("./_generated/server"),
  "./users.ts": () => import("./users"),
  "./administration.ts": () => import("./administration"),
  "./adminSession.ts": () => import("./adminSession"),
  "./adminLogin.ts": () => import("./adminLogin"),
  "./communities.ts": () => import("./communities"),
  "./communityGovernance.ts": () => import("./communityGovernance"),
  "./home.ts": () => import("./home"),
  "./editorial.ts": () => import("./editorial"),
  "./editorialAccess.ts": () => import("./editorialAccess"),
};
const m = (name: string) => makeFunctionReference<"mutation">(name);
const q = (name: string) => makeFunctionReference<"query">(name);
const components = componentsGeneric() as unknown as {
  betterAuth: ComponentApi;
};
function setup() {
  const t = convexTest(schema, modules);
  betterAuth.register(t);
  rateLimiter.register(t);
  return t;
}
async function google(
  t: ReturnType<typeof setup>,
  email: string,
  createdAt = Date.now(),
  emailVerified = true,
) {
  const user: { _id: string } = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          email,
          name: email.split("@")[0],
          emailVerified,
          createdAt,
          updatedAt: createdAt,
        },
      },
    }),
  );
  const session: { _id: string } = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: user._id,
          token: `test-${email}`,
          createdAt,
          updatedAt: createdAt,
          expiresAt: Date.now() + 3600000,
        },
      },
    }),
  );
  return t.withIdentity({
    subject: user._id,
    email,
    name: email.split("@")[0],
    sessionId: session._id,
  });
}
const token = "a".repeat(64);
async function admin(t: ReturnType<typeof setup>) {
  const version = createHash("sha256")
    .update(
      JSON.stringify([
        process.env.ADMIN_LOGIN,
        process.env.ADMIN_PASSWORD_HASH,
        process.env.ADMIN_TOTP_SECRET,
      ]),
    )
    .digest("hex");
  await t.run((ctx) =>
    ctx.db.insert("adminSessions", {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      credentialVersion: version,
      expiresAt: Date.now() + 1800000,
    }),
  );
  return token;
}
beforeEach(() => {
  vi.stubEnv("ADMIN_LOGIN", "owner@example.com");
  vi.stubEnv("ADMIN_PASSWORD_HASH", "test-hash");
  vi.stubEnv("ADMIN_TOTP_SECRET", "12345678901234567890");
  vi.stubEnv("PILOT_EXISTING_USERS_BEFORE", "2020-01-01T00:00:00Z");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("aprovação no backend conectado", () => {
  it("reserva permissão de criação ao proprietário, valida limite e audita", async () => {
    const t = setup();
    const id = await t.run(ctx => ctx.db.insert("users", { name: "Ana", email: "ana@example.test", status: "approved" }));
    const input = { token, userId: id, allowed: true };
    await expect(t.mutation(m("administration:setCommunityCreation"), input)).rejects.toThrow();
    await admin(t);
    await expect(t.mutation(m("administration:setCommunityCreation"), { ...input, limit: 21 })).rejects.toThrow();
    await t.mutation(m("administration:setCommunityCreation"), input);
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ communityCreationAllowed: true, communityCreationLimit: 1 });
    expect(await t.run(ctx => ctx.db.query("userAdminEvents").collect())).toEqual([expect.objectContaining({ target: id, action: "community-creation:true:1" })]);
  });
  it("persiste pendência, não duplica e bloqueia consultas/mutações diretas", async () => {
    const t = setup(),
      user = await google(t, "new@example.com");
    expect(await user.mutation(accessRefs.bootstrap, {})).toEqual({
      status: "pending",
      editorial: false,
    });
    await user.mutation(accessRefs.bootstrap, {});
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      1,
    );
    await expect(user.query(refs.home, { date: "2026-10-09" })).rejects.toThrow(
      "aprovado",
    );
    await expect(user.query(refs.communities, {})).rejects.toThrow("aprovado");
    await expect(
      user.query(refs.preview, { code: "ABCDEFGH" }),
    ).rejects.toThrow("aprovado");
    await expect(
      user.mutation(refs.create, { name: "Grupo", description: "" }),
    ).rejects.toThrow("aprovado");
    await expect(
      user.query(q("editorialAccess:list"), { cursor: null }),
    ).rejects.toThrow("aprovado");
  }, 15000); // First test loads the real Better Auth component and its adapter modules.
  it("preserva legado no produto e contas antigas somente no Better Auth", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        authId: "old",
        name: "Antigo",
        email: "old@example.com",
      }),
    );
    const old = t.withIdentity({ subject: "old" });
    expect((await old.mutation(accessRefs.bootstrap, {})).status).toBe(
      "approved",
    );
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("approved");
    const authOnly = await google(
      t,
      "auth-only@example.com",
      Date.parse("2019-01-01T00:00:00Z"),
    );
    expect((await authOnly.mutation(accessRefs.bootstrap, {})).status).toBe(
      "approved",
    );
    await google(t, "unseen@example.com", Date.parse("2019-01-01T00:00:00Z"));
    await t.mutation(m("users:importAuthUsers"), { cursor: null });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_normalizedEmail", (q) =>
            q.eq("normalizedEmail", "unseen@example.com"),
          )
          .unique(),
      ),
    ).toMatchObject({ status: "approved" });
  });
  it("vincula pré-cadastro apenas a email verificado, preserva desativação e reaplica barreira", async () => {
    const t = setup();
    await admin(t);
    const id = await t.mutation(m("administration:create"), {
      token,
      name: "Ana",
      email: "ANA@example.com",
      status: "approved",
      editorial: true,
    });
    expect(
      await t.mutation(m("administration:create"), {
        token,
        name: "Ana",
        email: "ana@example.com",
        status: "approved",
        editorial: true,
      }),
    ).toBe(id);
    const user = await google(t, "ana@example.com", Date.now(), false);
    await expect(user.mutation(accessRefs.bootstrap, {})).rejects.toThrow(
      "vincular",
    );
    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "email", value: "ana@example.com" }],
          update: { emailVerified: true },
        },
      }),
    );
    expect(await user.mutation(accessRefs.bootstrap, {})).toEqual({
      status: "approved",
      editorial: true,
    });
    await user.query(refs.home, { date: "2026-10-09" });
    await t.mutation(m("administration:update"), {
      token,
      id,
      name: "Ana",
      status: "disabled",
      editorial: true,
    });
    expect((await user.mutation(accessRefs.bootstrap, {})).status).toBe(
      "disabled",
    );
    await expect(user.query(refs.home, { date: "2026-10-09" })).rejects.toThrow(
      "desativado",
    );
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      1,
    );
    await t.mutation(m("administration:setApproval"), {
      token,
      required: false,
    });
    expect((await user.mutation(accessRefs.bootstrap, {})).status).toBe(
      "disabled",
    );
    const newcomer = await google(t, "open@example.com");
    expect((await newcomer.mutation(accessRefs.bootstrap, {})).status).toBe(
      "approved",
    );
  });
  it("protege painel de visitantes, sessões vencidas e rotação de credenciais", async () => {
    const t = setup();
    const input = { token, search: "", field: "name", cursor: null };
    await expect(t.mutation(m("administration:list"), input)).rejects.toThrow(
      "expirada",
    );
    await admin(t);
    expect((await t.mutation(m("administration:list"), input)).users).toEqual(
      [],
    );
    vi.stubEnv("ADMIN_TOTP_SECRET", "rotated");
    await expect(t.mutation(m("administration:list"), input)).rejects.toThrow(
      "expirada",
    );
    vi.stubEnv("ADMIN_TOTP_SECRET", "12345678901234567890");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1800001);
    await expect(t.mutation(m("administration:list"), input)).rejects.toThrow(
      "expirada",
    );
    await t.mutation(m("adminSession:logout"), { token });
    expect(
      await t.run((ctx) => ctx.db.query("adminSessions").collect()),
    ).toHaveLength(0);
  });
  it("pagina, filtra e busca usuários sem expor dados privados", async () => {
    const t = setup();
    await admin(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i++)
        await ctx.db.insert("users", {
          name: `Ana ${i}`,
          normalizedName: `ana ${i}`,
          email: `ana${i}@example.com`,
          normalizedEmail: `ana${i}@example.com`,
          status: "pending",
        });
    });
    const input = {
      token,
      search: "ana",
      field: "name",
      status: "pending",
      cursor: null,
    };
    const first = await t.mutation(m("administration:list"), input);
    const second = await t.mutation(m("administration:list"), {
      ...input,
      cursor: first.cursor,
    });
    expect(first.users).toHaveLength(25);
    expect(second.users).toHaveLength(5);
    expect(first.users[0]).not.toHaveProperty("authId");
    expect(
      (
        await t.mutation(m("administration:list"), {
          ...input,
          field: "email",
          search: "ana29@",
        })
      ).users,
    ).toHaveLength(1);
  });
  it("concede administração por grupo e impede deixar o grupo sem admin ativo", async () => {
    const t = setup();
    await admin(t);
    const user = await google(t, "leader@example.com", 1);
    await user.mutation(accessRefs.bootstrap, {});
    const leader = (await t.run((ctx) => ctx.db.query("users").collect()))[0];
    await t.mutation(m("administration:setCommunityCreation"), { token, userId: leader._id, allowed: true });
    const communityId = await user.mutation(refs.create, {
      name: "Grupo",
      description: "",
    });
    await expect(
      t.mutation(m("administration:update"), {
        token,
        id: leader._id,
        name: leader.name,
        status: "disabled",
        editorial: false,
      }),
    ).rejects.toThrow("Transfira");
    const successor = await t.mutation(m("administration:create"), {
      token,
      name: "Sucessor",
      email: "next@example.com",
      status: "approved",
      editorial: false,
    });
    await t.mutation(m("administration:setCommunity"), {
      token,
      userId: successor,
      communityId,
      role: "admin",
    });
    await expect(t.mutation(m("administration:update"), { token, id: leader._id, name: leader.name, status: "disabled", editorial: false })).rejects.toThrow("Transfira");
    await t.mutation(m("administration:setCommunity"), { token, userId: successor, communityId, role: "owner" });
    await t.mutation(m("administration:update"), {
      token,
      id: leader._id,
      name: leader.name,
      status: "disabled",
      editorial: false,
    });
    await expect(
      user.query(refs.detail, { id: communityId, cursor: null }),
    ).rejects.toThrow("desativado");
    await expect(
      t.mutation(m("administration:setCommunity"), {
        token,
        userId: successor,
        communityId,
        role: "member",
      }),
    ).rejects.toThrow("Transfira");
  });
  it("exige gestão editorial no servidor e deriva autoria da identidade", async () => {
    const t = setup();
    await admin(t);
    const user = await google(t, "editor@example.com", 1);
    await user.mutation(accessRefs.bootstrap, {});
    await expect(
      user.query(q("editorialAccess:list"), { cursor: null }),
    ).rejects.toThrow("editorial");
    const editor = (await t.run((ctx) => ctx.db.query("users").collect()))[0];
    await t.mutation(m("administration:update"), {
      token,
      id: editor._id,
      name: editor.name,
      status: "approved",
      editorial: true,
    });
    const input = {
      date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      selection: { book: "jo", chapter: 1, first: 1, last: 1, version: "alm1911" },
      reflection: "Reflexão",
      prayerSuggestion: "Oração",
      reason: "Teste",
      mode: "create",
    };
    await user.mutation(m("editorialAccess:save"), input);
    expect(
      (await t.run((ctx) => ctx.db.query("devotionals").collect()))[0]
        .reviewedBy,
    ).toBe(editor._id);
    await expect(
      user.mutation(m("editorialAccess:save"), input),
    ).rejects.toThrow("já possui");
    await t.mutation(m("administration:update"), {
      token,
      id: editor._id,
      name: editor.name,
      status: "approved",
      editorial: false,
    });
    await expect(
      user.mutation(m("editorialAccess:save"), { ...input, mode: "update" }),
    ).rejects.toThrow("editorial");
  });
});

describe("senha e autenticador", () => {
  it("valida vetores RFC e a janela de tolerância", async () => {
    expect(await createOTP("12345678901234567890", { digits: 8 }).hotp(1)).toBe(
      "94287082",
    );
    expect(await matchingCounter("12345678901234567890", "287082", 59000)).toBe(
      1,
    );
    expect(
      await matchingCounter("12345678901234567890", "287082", 120000),
    ).toBeNull();
  });
  it("exige ambos os fatores, consome tentativas falhas e impede reutilização", async () => {
    const t = setup();
    const password = "senha-de-teste-longa";
    vi.stubEnv("ADMIN_PASSWORD_HASH", await hashPassword(password));
    const code = await createOTP(process.env.ADMIN_TOTP_SECRET!).totp();
    const login = makeFunctionReference<"action">("adminLogin:login");
    await expect(
      t.action(login, { login: "owner@example.com", password: "wrong", code }),
    ).rejects.toThrow("Confira");
    await expect(
      t.action(login, { login: "owner@example.com", password, code: "xxxxxx" }),
    ).rejects.toThrow("Confira");
    const session = await t.action(login, {
      login: "owner@example.com",
      password,
      code,
    });
    expect(session.token).toMatch(/^[a-f0-9]{64}$/);
    const stored = (
      await t.run((ctx) => ctx.db.query("adminSessions").collect())
    )[0];
    expect(stored.tokenHash).not.toBe(session.token);
    await expect(
      t.action(login, { login: "owner@example.com", password, code }),
    ).rejects.toThrow("já utilizado");
    await expect(
      t.action(login, { login: "wrong@example.com", password, code }),
    ).rejects.toThrow("Confira");
    await expect(
      t.action(login, { login: "owner@example.com", password, code }),
    ).rejects.toThrow("Muitas tentativas");
  });
});
