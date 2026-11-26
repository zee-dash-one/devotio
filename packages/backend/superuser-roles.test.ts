import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./convex/schema";

const modules = {
  "./convex/_generated/server.ts": () => import("./convex/_generated/server"),
  "./convex/superuser.ts": () => import("./convex/superuser"),
};
const setRole = makeFunctionReference<"mutation">("superuser:setRole");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => ({
    admin: await ctx.db.insert("users", { authId: "admin", name: "Ana Admin", email: "ana@example.com", status: "approved", editorial: true, superuser: true }),
    reader: await ctx.db.insert("users", { authId: "reader", name: "Rui Leitor", email: "rui@example.com", status: "approved", editorial: false }),
    pending: await ctx.db.insert("users", { authId: "pending", name: "Pia Pedido", email: "pia@example.com", status: "pending", editorial: false }),
    owner: await ctx.db.insert("users", { authId: "owner", name: "Hilderney Couto", email: "hil@example.com", status: "approved", editorial: true, superuser: true }),
  }));
  const roles = (id: typeof ids.admin) => t.run(async ctx => { const user = await ctx.db.get(id); return { editorial: user?.editorial === true, superuser: user?.superuser === true }; });
  return { t, ids, roles, admin: t.withIdentity({ subject: "admin" }), reader: t.withIdentity({ subject: "reader" }) };
}

describe("superuser role management", () => {
  it("promotes and demotes editorial and superuser, keeping editorial for superusers", async () => {
    const { admin, ids, roles, t } = await setup();
    await admin.mutation(setRole, { id: ids.reader, role: "editorial", grant: true });
    expect(await roles(ids.reader)).toEqual({ editorial: true, superuser: false });
    await admin.mutation(setRole, { id: ids.reader, role: "superuser", grant: true });
    expect(await roles(ids.reader)).toEqual({ editorial: true, superuser: true });
    await expect(admin.mutation(setRole, { id: ids.reader, role: "editorial", grant: false })).rejects.toThrow("Rebaixe de superusuário");
    await admin.mutation(setRole, { id: ids.reader, role: "superuser", grant: false });
    expect(await roles(ids.reader)).toEqual({ editorial: true, superuser: false });
    await admin.mutation(setRole, { id: ids.reader, role: "editorial", grant: false });
    expect(await roles(ids.reader)).toEqual({ editorial: false, superuser: false });
    const events = await t.run(ctx => ctx.db.query("userAdminEvents").collect());
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ target: ids.reader, action: "roles:editorial:false->true;superuser:false->false" });
  });
  it("refuses self changes, pending accounts, the named owner and non-superusers", async () => {
    const { admin, reader, ids, roles } = await setup();
    await expect(admin.mutation(setRole, { id: ids.admin, role: "superuser", grant: false })).rejects.toThrow("próprios papéis");
    await expect(admin.mutation(setRole, { id: ids.pending, role: "editorial", grant: true })).rejects.toThrow("Aprove o cadastro");
    await expect(admin.mutation(setRole, { id: ids.owner, role: "superuser", grant: false })).rejects.toThrow("responsável pelo piloto");
    await expect(reader.mutation(setRole, { id: ids.reader, role: "superuser", grant: true })).rejects.toThrow("superusuários");
    expect(await roles(ids.reader)).toEqual({ editorial: false, superuser: false });
    expect(await roles(ids.owner)).toEqual({ editorial: true, superuser: true });
  });
});
