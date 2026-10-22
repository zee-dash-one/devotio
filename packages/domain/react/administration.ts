import { useCallback, useEffect, useState } from "react";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import type { ConvexReactClient } from "convex/react";
import {
  adminLoginSchema,
  adminListSchema,
  managedUserSchema,
  updateManagedUserSchema,
  communityPermissionSchema,
} from "../validators/administration";
import type {
  AccessState,
  Administration,
  AdminPage,
  AdminSession,
  CommunityPermission,
} from "../administration";
import type {
  ConnectedEditorial,
  ConnectedPublication,
} from "../administration";
import { editorialSaveSchema } from "../editorial";
import { communityCreationSchema } from "../community-governance";

export function createConnectedEditorial(
  client: ConvexReactClient,
): ConnectedEditorial {
  return {
    list: (cursor) =>
      safeAdmin(
        client.query(
          ref<
            "query",
            { cursor: string | null },
            { entries: ConnectedPublication[]; cursor: string | null }
          >("editorialAccess:list"),
          { cursor },
        ),
      ),
    get: date => safeAdmin(client.query(ref<"query", { date: string }, ConnectedPublication | null>("editorialAccess:get"), { date })),
    calendar: (month, today) => safeAdmin(client.query(ref<"query", { month: string; today: string }, { dates: string[]; credit: string }>("editorialAccess:calendar"), { month, today })),
    save: async (input) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("editorialAccess:save"), {
          ...editorialSaveSchema.parse(input),
        }),
      );
    },
    withdraw: async (id, reason) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("editorialAccess:withdraw"), {
          id,
          reason,
        }),
      );
    },
  };
}

const ref = makeFunctionReference;
export const accessRefs = {
  bootstrap: ref<"mutation", Record<string, never>, AccessState>(
    "users:bootstrap",
  ),
  access: ref<"query", Record<string, never>, AccessState | null>(
    "users:access",
  ),
};
export async function safeAdmin<T>(operation: Promise<T>): Promise<T> {
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
export function createAdministration(
  client: ConvexReactClient,
): Administration {
  return {
    setCommunityCreation: async (token, input) => {
      await safeAdmin(client.mutation(ref<"mutation">("administration:setCommunityCreation"), { ...communityCreationSchema.parse(input), token }));
    },
    login: (input) =>
      safeAdmin(
        client.action(
          ref<
            "action",
            ReturnType<typeof adminLoginSchema.parse>,
            AdminSession
          >("adminLogin:login"),
          adminLoginSchema.parse(input),
        ),
      ),
    logout: async (token) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("adminSession:logout"), { token }),
      );
    },
    list: (token, input) =>
      safeAdmin(
        client.mutation(
          ref<
            "mutation",
            ReturnType<typeof adminListSchema.parse> & { token: string },
            AdminPage
          >("administration:list"),
          { ...adminListSchema.parse(input), token },
        ),
      ),
    create: (token, input) =>
      safeAdmin(
        client.mutation(
          ref<
            "mutation",
            ReturnType<typeof managedUserSchema.parse> & { token: string },
            string
          >("administration:create"),
          { ...managedUserSchema.parse(input), token },
        ),
      ),
    update: async (token, input) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("administration:update"), {
          ...updateManagedUserSchema.parse(input),
          token,
        }),
      );
    },
    setApproval: async (token, required) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("administration:setApproval"), {
          token,
          required,
        }),
      );
    },
    communities: (token, userId, cursor) =>
      safeAdmin(
        client.mutation(
          ref<
            "mutation",
            { token: string; userId: string; cursor: string | null },
            { communities: CommunityPermission[]; cursor: string | null }
          >("administration:communities"),
          { token, userId, cursor },
        ),
      ),
    setCommunity: async (token, input) => {
      await safeAdmin(
        client.mutation(ref<"mutation">("administration:setCommunity"), {
          ...communityPermissionSchema.parse(input),
          token,
        }),
      );
    },
  };
}
export function useAdminSession(administration: Administration) {
  const [session, setSession] = useState<AdminSession | null>(null);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => setSession(null),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  const login = useCallback(
    async (input: Parameters<Administration["login"]>[0]) => {
      setSession(await administration.login(input));
    },
    [administration],
  );
  const logout = useCallback(async () => {
    try {
      if (session) await administration.logout(session.token);
    } finally {
      setSession(null);
    }
  }, [administration, session]);
  return { session, login, logout };
}
export function usePilotAccess(
  client: ConvexReactClient,
  owner: string | null,
) {
  const [state, setState] = useState<{
    owner: string | null;
    access?: AccessState;
    error?: string;
  }>({ owner: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!owner) {
      setState({ owner: null });
      return;
    }
    let active = true;
    let stop: (() => void) | undefined;
    setState({ owner });
    safeAdmin(client.mutation(accessRefs.bootstrap, {}))
      .then(() => {
        if (!active) return;
        const watch = client.watchQuery(accessRefs.access, {});
        const emit = () => {
          try {
            const access = watch.localQueryResult();
            if (active && access) setState({ owner, access });
            else if (active && access === null)
              setState({
                owner,
                error:
                  "Cadastro indisponível. Consulte novamente ou saia da conta.",
              });
          } catch {
            if (active)
              setState({
                owner,
                error: "Não foi possível consultar seu acesso.",
              });
          }
        };
        stop = watch.onUpdate(emit);
        emit();
      })
      .catch((error) => {
        if (active) setState({ owner, error: error.message });
      });
    return () => {
      active = false;
      stop?.();
    };
  }, [client, owner, revision]);
  return {
    ...(state.owner === owner ? state : {}),
    loading:
      !!owner && (state.owner !== owner || (!state.access && !state.error)),
    refresh: () => setRevision((n) => n + 1),
  };
}
