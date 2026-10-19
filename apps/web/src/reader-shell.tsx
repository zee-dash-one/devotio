import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useLocation, useMatches } from "@tanstack/react-router";
import { BookOpen, BookText, Users, ArrowUpRight, Leaf } from "lucide-react";
import { RepositoryProvider, useHome, useLocalDate } from "domain/react";
import { loginDestination, type Devotional } from "domain/core";
import { useApp, ReaderContext, AudioSelectionContext } from "./context";
import { Brand, AudioPlayer } from "./components";
import { RouteRedirect } from "./redirect";
import { NotificationsBell } from "./notifications";
import { useCompactHeader } from "./compact-header";
import { AccountMenu } from "./account-menu";

export function ReaderLayout() {
  const app = useApp();
  const destination = useMatches({
    select: (matches) => matches.at(-1)?.pathname ?? "/devocional",
  });
  if (!app.repository)
    return (
      <RouteRedirect to="/entrar" redirect={loginDestination(destination)} />
    );
  return (
    <RepositoryProvider repository={app.repository} key={app.userKey}>
      <ReaderShell />
    </RepositoryProvider>
  );
}
function ReaderShell() {
  const app = useApp();
  const { date, refresh } = useLocalDate(
    app.localProfile ? "America/Sao_Paulo" : undefined,
  );
  const home = useHome(date);
  const location = useLocation();
  const [selectedAudio, setSelectedAudio] = useState<Devotional | null>(null);
  const masthead = useRef<HTMLDivElement>(null);
  const mobileNavigation = useRef<HTMLElement>(null);
  const [navigationHeight, setNavigationHeight] = useState(70);
  const headerState = useCompactHeader(masthead);
  useEffect(() => {
    const navigation = mobileNavigation.current;
    if (!navigation || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      setNavigationHeight(navigation.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(navigation);
    return () => observer.disconnect();
  }, []);
  const audio = app.repository?.reading ? selectedAudio : home.data?.devotional;
  useEffect(() => {
    const foreground = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", foreground);
    return () => document.removeEventListener("visibilitychange", foreground);
  }, [refresh]);
  const isReading = location.pathname === "/devocional";
  return (
    <AudioSelectionContext.Provider value={setSelectedAudio}>
      <ReaderContext.Provider
        value={{ data: home.data, error: home.error, date }}
      >
        <div
          className="reader-shell"
          style={
            { "--mobile-nav-height": `${navigationHeight}px` } as CSSProperties
          }
        >
          <a className="skip-link" href="#main">
            Pular para o conteúdo
          </a>
          <div
            className="reader-header-space"
            style={
              {
                "--reader-header-height": `${headerState.height}px`,
              } as CSSProperties
            }
          >
            <div
              ref={masthead}
              className="reader-masthead"
              data-compact={headerState.compact}
            >
              <header className="site-header">
                <div className="header-inner">
                  <Link to="/devocional" aria-label="Devotio, página inicial">
                    <Brand />
                  </Link>
                  <nav className="desktop-nav" aria-label="Navegação principal">
                    <Link
                      to="/devocional"
                      aria-label="Devocional"
                      title="Devocional"
                      activeProps={{ className: "active" }}
                    >
                      <BookOpen size={17} />
                      <span className="nav-label">Devocional</span>
                    </Link>
                    {(app.repository?.bible || app.repository?.reading) && (
                      <Link
                        to="/biblia"
                        aria-label="Bíblia"
                        title="Bíblia"
                        search={{ book: "jo", chapter: 1 }}
                        activeProps={{ className: "active" }}
                      >
                        <BookText size={17} />
                        <span className="nav-label">Bíblia</span>
                      </Link>
                    )}
                    <Link
                      to="/comunidade"
                      aria-label="Comunidade"
                      title="Comunidade"
                      activeOptions={{ exact: false }}
                      activeProps={{ className: "active" }}
                    >
                      <Users size={17} />
                      <span className="nav-label">Comunidade</span>
                    </Link>
                  </nav>
                  {app.repository?.notifications && (
                    <NotificationsBell
                      notifications={app.repository.notifications}
                    />
                  )}
                  <AccountMenu name={home.data?.user.name} />
                </div>
              </header>
              {app.preview && (
                <div className="preview-strip">
                  <span className="preview-dot" />
                  Prévia local
                  <span className="preview-long">
                    {" "}
                    · Conteúdo ilustrativo, sem publicação pastoral
                  </span>
                </div>
              )}
              {app.localProfile && (
                <div className="preview-strip">
                  <span className="preview-dot" />
                  Desenvolvimento local{" "}
                  <span className="preview-long">
                    · Login simulado · {app.localProfile.label}
                  </span>
                </div>
              )}
              {isReading && home.data?.settings?.monthlyVerse && (
                <aside className="monthly-theme" aria-label="Tema do mês">
                  <div>
                    <Leaf size={16} />
                    <span className="theme-label">GUARDE NO CORAÇÃO</span>
                    <p>{home.data.settings.monthlyVerse}</p>
                    <span className="theme-reference">
                      {home.data.settings.monthlyReference}
                    </span>
                  </div>
                </aside>
              )}
            </div>
          </div>
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
          {audio?.audioUrl && (
            <div className="persistent-audio">
              <AudioPlayer key={audio.id + audio.audioUrl} devotional={audio} />
            </div>
          )}
          {location.pathname !== "/biblia" && (
            <footer className="site-footer">
              <span>Um pouco de silêncio. Um encontro com a Palavra.</span>
              <Link to="/ajuda">
                Feito para estar presente <ArrowUpRight size={13} />
              </Link>
            </footer>
          )}
          <nav
            ref={mobileNavigation}
            className="mobile-nav"
            aria-label="Navegação no celular"
          >
            <Link to="/devocional" activeProps={{ className: "active" }}>
              <BookOpen size={21} />
              <span>Devocional</span>
            </Link>
            {(app.repository?.bible || app.repository?.reading) && (
              <Link
                to="/biblia"
                search={{ book: "jo", chapter: 1 }}
                activeProps={{ className: "active" }}
              >
                <BookText size={21} />
                <span>Bíblia</span>
              </Link>
            )}
            <Link
              to="/comunidade"
              activeOptions={{ exact: false }}
              activeProps={{ className: "active" }}
            >
              <Users size={21} />
              <span>Comunidade</span>
            </Link>
          </nav>
        </div>
      </ReaderContext.Provider>
    </AudioSelectionContext.Provider>
  );
}
