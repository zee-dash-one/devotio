import { makeFunctionReference } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import type { NotificationsRepository, NotificationPage, NotificationSummary } from "../sharing";
import type { Watch } from "../types";
import { safeAdmin } from "./administration";
export function createNotificationsRepository(client: ConvexReactClient): NotificationsRepository {
  function watch<T>(name: string, args: Record<string, string | null>): Watch<T> {
    return (next, error) => {
      const source = client.watchQuery(makeFunctionReference<"query", Record<string, string | null>, T>("notifications:" + name), args);
      const emit = () => { try { const value = source.localQueryResult(); if (value !== undefined) next(value); } catch (e) { error(e instanceof Error ? e : new Error("Não foi possível carregar.")); } };
      const stop = source.onUpdate(emit); emit(); return stop;
    };
  }
  return {
    manualRefresh: false,
    watchSummary: () => watch<NotificationSummary>("summary", {}),
    watchPage: cursor => watch<NotificationPage>("page", { cursor }),
    markRead: async id => { await safeAdmin(client.mutation(makeFunctionReference<"mutation">("notifications:markRead"), { id })); },
    refresh: async () => {},
  };
}
