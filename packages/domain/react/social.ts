import { makeFunctionReference } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import type {
  SocialRepository,
  FriendsData,
  ShareFilter,
  SharePage,
  ShareInput,
  FriendRequest,
  FriendChange,
  ShareChapter,
  ShareMarker,
} from "../social";
import type { Watch } from "../types";
const friends = makeFunctionReference<
  "query",
  Record<string, never>,
  FriendsData
>("social:friends");
const markers = makeFunctionReference<"query", ShareChapter, ShareMarker[]>(
  "social:markers",
);
const shares = makeFunctionReference<"query", ShareFilter, SharePage>(
  "social:shares",
);
const rotate = makeFunctionReference<"mutation", Record<string, never>, string>(
  "social:rotateCode",
);
const request = makeFunctionReference<
  "mutation",
  { input: FriendRequest },
  null
>("social:request");
const change = makeFunctionReference<"mutation", FriendChange, null>(
  "social:change",
);
const send = makeFunctionReference<"mutation", ShareInput, string>(
  "social:send",
);
async function safe<T>(operation: Promise<T>) {
  try {
    return await operation;
  } catch (error) {
    throw new Error(
      error instanceof ConvexError && typeof error.data === "string"
        ? error.data
        : "Não foi possível concluir. Atualize a lista e tente novamente.",
    );
  }
}
export function createSocialRepository(
  client: ConvexReactClient,
): SocialRepository {
  const watch =
    <T>(source: ReturnType<ConvexReactClient["watchQuery"]>): Watch<T> =>
    (next, error) => {
      const emit = () => {
        try {
          const value = source.localQueryResult();
          if (value !== undefined) next(value as T);
        } catch (cause) {
          error(
            cause instanceof Error
              ? cause
              : new Error("Não foi possível carregar."),
          );
        }
      };
      const stop = source.onUpdate(emit);
      emit();
      return stop;
    };
  return {
    watchMarkers: (input) =>
      watch<ShareMarker[]>(client.watchQuery(markers, input)),
    watchFriends: () => watch<FriendsData>(client.watchQuery(friends, {})),
    watchShares: (input) => watch<SharePage>(client.watchQuery(shares, input)),
    rotateCode: () => safe(client.mutation(rotate, {})),
    request: async (input) => {
      await safe(client.mutation(request, { input }));
    },
    change: async (input) => {
      await safe(client.mutation(change, input));
    },
    send: (input) => safe(client.mutation(send, input)),
  };
}
