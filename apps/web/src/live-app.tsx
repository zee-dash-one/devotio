import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import {
  createConvexRepository,
  createAdministration,
  createConnectedEditorial,
  usePilotAccess,
} from "domain/convex";
import { loginDestination } from "domain/core";
import { App } from "./router";
import { useMemo } from "react";
import { createWebBible } from "./bible-repository";

/** Load the connected adapter only when both public service URLs are configured. */
export function createLiveApp(url: string, site: string) {
  const client = new ConvexReactClient(url);
  const repository = createConvexRepository(client);
  const administration = createAdministration(client);
  const connectedEditorial = createConnectedEditorial(client);
  const auth = createAuthClient({
    baseURL: site,
    plugins: [convexClient(), crossDomainClient()],
  });

  function AuthenticatedApp() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const session = auth.useSession();
    const owner = session.data?.user.id;
    const connected = useMemo(
      () => owner ? { ...repository, bible: createWebBible(owner) } : null,
      [owner],
    );
    const access = usePilotAccess(
      client,
      isAuthenticated && session.data ? session.data.user.id : null,
    );
    return (
      <App
        repository={
          isAuthenticated &&
          session.data &&
          access.access?.status === "approved"
            ? connected
            : null
        }
        loading={isLoading || session.isPending || access.loading}
        administration={administration}
        connectedEditorial={connectedEditorial}
        pilotAccess={access.access}
        accessError={access.error}
        refreshAccess={access.refresh}
        configured
        userKey={session.data?.user.id ?? "guest"}
        onLogin={async (destination) => {
          const redirect = loginDestination(destination);
          const result = await auth.signIn.social({
            provider: "google",
            callbackURL: location.origin + redirect,
            errorCallbackURL:
              location.origin +
              "/entrar?error=oauth&redirect=" +
              encodeURIComponent(redirect),
          });
          if (result.error)
            throw new Error("Não foi possível entrar. Tente novamente.");
        }}
        onLogout={async () => {
          const result = await auth.signOut();
          if (result.error)
            throw new Error("Não foi possível sair. Tente novamente.");
          location.assign("/entrar");
        }}
      />
    );
  }

  return (
    <ConvexBetterAuthProvider client={client} authClient={auth}>
      <AuthenticatedApp />
    </ConvexBetterAuthProvider>
  );
}
