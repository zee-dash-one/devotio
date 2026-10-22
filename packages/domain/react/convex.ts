import { makeFunctionReference } from "convex/server";
import { createSocialRepository } from "./social";
import { createGovernanceRepository } from "./community-governance";
export { createAdministration, createConnectedEditorial, usePilotAccess } from "./administration";
import { ConvexError } from "convex/values";
import type { ConvexReactClient, Watch as ConvexWatch } from "convex/react";
import type {
  Repository,
  HomeData,
  Community,
  CommunityDetail,
} from "../types";
export const refs = {
  home: makeFunctionReference<"query", { date: string }, HomeData>("home:get"),
  communities: makeFunctionReference<
    "query",
    { governance?: boolean },
    Community[]
  >("communities:list"),
  detail: makeFunctionReference<
    "query",
    { id: string; cursor: string | null; governance?: boolean },
    CommunityDetail | null
  >("communities:detail"),
  preview: makeFunctionReference<
    "query",
    { code: string },
    { id: string; name: string } | null
  >("communities:previewInvite"),
  create: makeFunctionReference<
    "mutation",
    { name: string; description: string },
    string
  >("communities:create"),
  join: makeFunctionReference<"mutation", { code: string }, string>(
    "communities:join",
  ),
  send: makeFunctionReference<
    "mutation",
    { id: string; content: string },
    null
  >("communities:send"),
  scripture: makeFunctionReference<
    "mutation",
    { id: string; scripture: string },
    null
  >("communities:updateScripture"),
  list: makeFunctionReference<
    "mutation",
    { id: string; name: string; items: string[] },
    null
  >("communities:createChecklist"),
  tick: makeFunctionReference<
    "mutation",
    { itemId: string; checked: boolean },
    null
  >("communities:setTick"),
  remove: makeFunctionReference<
    "mutation",
    { id: string; memberId: string },
    null
  >("communities:removeMember"),
};
async function safe<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    throw new Error(
      error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "Não foi possível concluir. Verifique sua conexão e tente novamente.",
    );
  }
}
export function createConvexRepository(client: ConvexReactClient): Repository {
  function subscribe<T>(
    watch: ConvexWatch<T>,
    next: (data: T) => void,
    error: (error: Error) => void,
  ) {
    const emit = () => {
      try {
        const data = watch.localQueryResult();
        if (data !== undefined) next(data);
      } catch (e) {
        error(e instanceof Error ? e : new Error("Não foi possível carregar."));
      }
    };
    const stop = watch.onUpdate(emit);
    emit();
    return stop;
  }
  return {
    mode: "live",
    social: createSocialRepository(client),
    governance: createGovernanceRepository(client),
    watchHome: (date) => (next, error) =>
      subscribe(client.watchQuery(refs.home, { date }), next, error),
    watchCommunities: () => (next, error) =>
      subscribe(client.watchQuery(refs.communities, { governance: true }), next, error),
    watchCommunity: (id, cursor) => (next, error) =>
      subscribe(client.watchQuery(refs.detail, { id, cursor, governance: true }), next, error),
    createCommunity: (input) => safe(client.mutation(refs.create, input)),
    previewInvite: (code) => safe(client.query(refs.preview, { code })),
    joinCommunity: (code) => safe(client.mutation(refs.join, { code })),
    async sendMessage(id, content) {
      await safe(client.mutation(refs.send, { id, content }));
    },
    async updateScripture(id, scripture) {
      await safe(client.mutation(refs.scripture, { id, scripture }));
    },
    async createChecklist(id, name, items) {
      await safe(client.mutation(refs.list, { id, name, items }));
    },
    async setTick(itemId, checked) {
      await safe(client.mutation(refs.tick, { itemId, checked }));
    },
    async removeMember(id, memberId) {
      await safe(client.mutation(refs.remove, { id, memberId }));
    },
  };
}
