import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  HelpCircle,
  Heart,
  LogOut,
  PenLine,
  RefreshCw,
  Settings,
  Shield,
  UserRound,
} from "lucide-react";
import { canPublish, initials } from "domain/core";
import { useApp } from "./context";
import { ErrorMessage } from "./components";
import { SettingsModal } from "./preferences";
import { Button, buttonClassName } from "./ui/button";

export function AccountMenu({ name = "Minha conta" }: { name?: string }) {
  const app = useApp();
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState<"refresh" | "logout" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target)
      ) {
        menu.current?.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.removeAttribute("open");
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("click", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("click", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function run(action: "refresh" | "logout") {
    if (pending) return;
    setPending(action);
    setError("");
    try {
      if (action === "refresh") await app.repository?.refresh?.();
      else await app.onLogout();
    } catch {
      setError(
        action === "refresh"
          ? "Não foi possível atualizar. Tente novamente quando estiver conectado."
          : "Não foi possível sair. Tente novamente.",
      );
    } finally {
      setPending(null);
    }
  }

  const linkAppearance = buttonClassName({ variant: "ghost" });
  return (
    <>
      <details className="account-menu" ref={menu}>
        <summary ref={trigger} aria-label="Abrir menu da conta">
          <span className="avatar">{initials(name)}</span>
          <span className="account-name">{name.split(" ")[0]}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div
          className="account-popover"
          onClickCapture={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("button, a")
            ) {
              menu.current?.removeAttribute("open");
              trigger.current?.focus();
            }
          }}
        >
          <p className="caption">{name}</p>
          {app.repository?.social && <Link className={linkAppearance} to="/perfil"><UserRound size={16} />Meu perfil e amigos</Link>}
          {(app.repository?.devotionalReading || app.repository?.reading) && <Link className={linkAppearance} to="/devocional/favoritos"><Heart size={16} />Favoritos</Link>}
          {app.localProfile && (
            <p className="caption">{app.localProfile.label}</p>
          )}
          {app.repository?.refresh && (
            <Button
              variant="ghost"
              disabled={pending !== null}
              onClick={() => void run("refresh")}
            >
              <RefreshCw size={16} />
              Atualizar conteúdo
            </Button>
          )}
          {(canPublish(app.localProfile?.editorial) || app.pilotAccess?.editorial) && (
            <Link className={linkAppearance} to="/editorial">
              <PenLine size={16} />
              Gestão de devocionais
            </Link>
          )}
          <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            Configurações
          </Button>
          <Link className={linkAppearance} to="/ajuda">
            <HelpCircle size={16} />
            Ajuda e instalação
          </Link>
          <Link className={linkAppearance} to="/privacidade">
            <Shield size={16} />
            Privacidade
          </Link>
          <Button
            variant="ghost"
            disabled={pending !== null}
            onClick={() => void run("logout")}
          >
            <LogOut size={16} />
            {app.localProfile ? "Sair / trocar perfil" : "Sair"}
          </Button>
        </div>
      </details>
      {pending && (
        <p className="account-feedback" role="status">
          {pending === "refresh" ? "Atualizando conteúdo…" : "Saindo…"}
        </p>
      )}
      {error && (
        <div className="account-feedback">
          <ErrorMessage message={error} />
        </div>
      )}
      {settingsOpen && (
        <SettingsModal
          returnFocusRef={trigger}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
