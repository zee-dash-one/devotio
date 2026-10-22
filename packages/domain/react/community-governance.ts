import { makeFunctionReference } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import type { Watch } from "../types";
import type { CommunityGovernance } from "../community-governance";
import { safeAdmin } from "./administration";
export function createGovernanceRepository(client: ConvexReactClient): CommunityGovernance {
  function watch<T>(name: string, args: Record<string, string | null>): Watch<T> {
    return (next, error) => {
      const source = client.watchQuery(makeFunctionReference<"query", Record<string, string | null>, T>("communityGovernance:" + name), args);
      const emit = () => {
        try { const value = source.localQueryResult(); if (value !== undefined) next(value); }
        catch (e) { error(e instanceof Error ? e : new Error("Não foi possível carregar.")); }
      };
      const stop = source.onUpdate(emit); emit(); return stop;
    };
  }
  async function command(name: string, args: Record<string, string>) {
    await safeAdmin(client.mutation(makeFunctionReference<"mutation">("communityGovernance:" + name), args));
  }
  return {
    watchCreation: () => watch("creation", {}),
    watchMine: cursor => watch("myJoinRequests", { cursor }),
    watchRequests: (id, cursor) => watch("joinRequests", { id, cursor }),
    cancel: requestId => command("cancelJoinRequest", { requestId }),
    decide: (requestId, decision) => command("decideJoinRequest", { requestId, decision }),
    setRole: (id, memberId, role) => command("setMemberRole", { id, memberId, role }),
    leave: id => command("leave", { id }),
    transfer: (id, memberId) => command("transferOwnership", { id, memberId }),
  };
}
