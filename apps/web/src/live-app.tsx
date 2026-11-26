import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { createAuthClient } from "better-auth/react";
import { makeFunctionReference } from "convex/server";
import { emailOTPClient } from "better-auth/client/plugins";
import { emailLoginError } from "./email-login-error";
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
import { useEffect, useMemo, useState } from "react";
import { createWebBible, licensedEditions } from "./bible-repository";
import type { BibleVersion } from "domain/core";

/** Load the connected adapter only when both public service URLs are configured. */
export function createLiveApp(url: string, site: string) {
  const client = new ConvexReactClient(url);
  const repository = createConvexRepository(client);
  const administration = createAdministration(client);
  const connectedEditorial = createConnectedEditorial(client);
  const auth = createAuthClient({
    baseURL: site,
    plugins: [convexClient(), crossDomainClient(), emailOTPClient()],
  });

  function AuthenticatedApp() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const session = auth.useSession();
    const owner = session.data?.user.id;
    const [licensed, setLicensed] = useState<{ version: BibleVersion; base: string }[]>([]);
    useEffect(() => { void licensedEditions().then(setLicensed); }, []);
    const connected = useMemo(
      () => owner ? { ...repository, bible: createWebBible(owner, undefined, licensed) } : null,
      [owner, licensed],
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
        emailLogin={{
          available: () => client.query(makeFunctionReference<"query", Record<string, never>, boolean>("mail:available"), {}).catch(() => false),
          request: async (email) => {
            const result = await auth.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
            if (result.error) throw new Error(emailLoginError(result.error));
            return {};
          },
          verify: async (email, code) => {
            const result = await auth.signIn.emailOtp({ email, otp: code });
            if (result.error) throw new Error(emailLoginError(result.error));
          },
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
