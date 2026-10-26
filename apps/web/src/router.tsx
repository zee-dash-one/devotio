import { buttonClassName } from "./ui/button";
import { useEffect, useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createBrowserHistory,
  RouterProvider,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { loginSearchSchema, bibleParamsSchema, dateSchema } from "domain/core";
import { AppProvider, useApp, type AppContextValue } from "./context";
import { Brand, Loading } from "./components";
import { ReadingPage } from "./pages/reading";
import { BiblePage } from "./pages/bible";
import { EditorialPage } from "./pages/editorial";
import { DevotionalEditorPage } from "./pages/devotional-editor";
import { CommunitiesPage, CommunityPage } from "./pages/community";
import { SignInPage, InfoPage } from "./pages/access";
import { RouteRedirect } from "./redirect";
import { ReaderLayout } from "./reader-shell";
import { AdministrationPage } from "./pages/administration";
import { AccessWaitPage } from "./pages/access-wait";
import { ProfilePage } from "./social";

const pageTitles: Record<string, string> = {
  "/devocional": "Devocional",
  "/devocional/favoritos": "Devocionais Favoritos",
  "/biblia": "Bíblia",
  "/perfil": "Meu perfil",
  "/editorial": "Gestão de devocionais",
  "/editorial/cadastro": "Cadastro de devocional",
  "/entrar": "Bem-vindo",
  "/ajuda": "Ajuda e instalação",
  "/privacidade": "Privacidade",
};
function Root() {
  const app = useApp();
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const title = location.pathname.startsWith("/comunidade")
      ? "Comunidade"
      : pageTitles[location.pathname] ?? "Devotio";
    document.title = `${title} · Devotio`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  if (!online && !app.localProfile && !(location.pathname === "/biblia" && app.repository?.bible))
    return (
      <div className="offline-page">
        <Brand />
        <WifiOff size={32} />
        <h1>Um instante de pausa.</h1>
        <p>
          Conecte-se à internet para acessar seu devocional e sua comunidade.
        </p>
        <p className="caption">
          Seus conteúdos pessoais não ficam salvos neste dispositivo.
        </p>
      </div>
    );
  if (app.loading && location.pathname !== "/gestao-acesso")
    return (
      <div className="page narrow">
        <Brand />
        <Loading />
      </div>
    );
  if (location.pathname !== "/gestao-acesso" && (app.accessError || (app.pilotAccess && app.pilotAccess.status !== "approved"))) return <AccessWaitPage />;
  return <Outlet />;
}
const rootRoute = createRootRoute({
  component: Root,
  notFoundComponent: () => (
    <div className="page narrow">
      <h1>Este caminho não existe.</h1>
      <Link className={buttonClassName({})} to="/devocional">
        Voltar ao devocional
      </Link>
    </div>
  ),
});
const administrationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/gestao-acesso", component: AdministrationPage });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <RouteRedirect to="/devocional" />,
});
const readerRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_reader",
  component: ReaderLayout,
});
const devotionalRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/devocional",
  component: ReadingPage,
});
const favoriteDevotionalsRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/devocional/favoritos",
  component: ReadingPage,
});
const bibleRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/biblia",
  validateSearch: (search) => bibleParamsSchema.parse(search),
  component: BiblePage,
});
const editorialRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/editorial",
  component: EditorialPage,
});
const profileRoute = createRoute({ getParentRoute: () => readerRoute, path: "/perfil", component: ProfilePage });
const editorFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editorial/cadastro",
  validateSearch: (search: Record<string, unknown>) => ({
    date: dateSchema.optional().catch(undefined).parse(search.date),
  }),
  component: DevotionalEditorPage,
});
const communitiesRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/comunidade",
  component: CommunitiesPage,
});
const communityRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/comunidade/$communityId",
  validateSearch: (search: Record<string, unknown>): { message?: string } => ({
    message:
      typeof search.message === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(search.message)
        ? search.message
        : undefined,
  }),
  component: () => {
    const { communityId } = communityRoute.useParams();
    const { message } = communityRoute.useSearch();
    return (
      <CommunityPage key={communityId} id={communityId} messageId={message} />
    );
  },
});
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entrar",
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: SignInPage,
});
const listsRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/comunidade/$communityId/listas",
  component: () => {
    const { communityId } = listsRoute.useParams();
    return <CommunityPage key={communityId} id={communityId} tab="listas" />;
  },
});
const membersRoute = createRoute({
  getParentRoute: () => readerRoute,
  path: "/comunidade/$communityId/membros",
  component: () => {
    const { communityId } = membersRoute.useParams();
    return <CommunityPage key={communityId} id={communityId} tab="membros" />;
  },
});
const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ajuda",
  component: () => <InfoPage kind="help" />,
});
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacidade",
  component: () => <InfoPage kind="privacy" />,
});
const routeTree = rootRoute.addChildren([
  administrationRoute,
  indexRoute,
  editorFormRoute,
  readerRoute.addChildren([
    profileRoute,
    devotionalRoute,
    favoriteDevotionalsRoute,
    bibleRoute,
    editorialRoute,
    communitiesRoute,
    communityRoute,
    listsRoute,
    membersRoute,
  ]),
  signInRoute,
  helpRoute,
  privacyRoute,
]);
const history = createBrowserHistory();
function createAppRouter() {
  return createRouter({ routeTree, history, defaultPreload: "intent" });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
export function App(props: AppContextValue) {
  const [router] = useState(createAppRouter);
  return (
    <AppProvider value={props}>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
