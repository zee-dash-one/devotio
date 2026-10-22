import { IconButton, Button } from "./ui/button";
import { useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useWatch } from "domain/react";
import {
  notificationDate,
  notificationKind,
  notificationTarget,
  validationMessage,
  type AppNotification,
  type NotificationsRepository,
} from "domain/core";
import { Modal, Loading, ErrorMessage } from "./components";

export function NotificationsBell({
  notifications,
}: {
  notifications: NotificationsRepository;
}) {
  const summary = useWatch(
    useMemo(() => notifications.watchSummary(), [notifications]),
  );
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        variant="ghost"
        className="notifications-bell"
        aria-label={`Notificações${summary.data?.unread ? summary.data.capped ? ", mais de 99 não lidas" : `, ${summary.data.unread} não lidas` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {summary.data && summary.data.unread > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {summary.data.capped ? "99+" : summary.data.unread}
          </span>
        )}
      </IconButton>
      {open && (
        <Modal title="Notificações" onClose={() => setOpen(false)}>
          <NotificationList
            notifications={notifications}
            onNavigate={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}
function NotificationList({
  notifications,
  onNavigate,
}: {
  notifications: NotificationsRepository;
  onNavigate: () => void;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const state = useWatch(
    useMemo(() => notifications.watchPage(cursor), [notifications, cursor]),
  );
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  return (
    <section className="notifications-list">
      {state.error ? (
        <ErrorMessage message={state.error} />
      ) : !state.data ? (
        <Loading />
      ) : state.data.items.length === 0 ? (
        <p>{state.data.nextCursor ? "Nenhum aviso disponível nesta página." : "Você está em dia. Nenhuma notificação por aqui."}</p>
      ) : (
        <ul>
          {state.data.items.map((item) => (
            <li
              key={item.id}
              className={item.readAt === null ? "notification-unread" : ""}
            >
              <div className="notification-line">
                <span>
                  <NotificationCopy item={item} />
                </span>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {notificationDate(item.createdAt)}
                </time>
              </div>
              <div className="notification-actions">
                <NotificationLink item={item} onNavigate={onNavigate} />
                <Button
                  variant="ghost"
                  disabled={item.readAt !== null || busy === item.id}
                  aria-label={`Marcar notificação de ${item.entity} como lida`}
                  onClick={async () => {
                    setBusy(item.id);
                    setError("");
                    try {
                      await notifications.markRead(item.id);
                    } catch (cause) {
                      setError(validationMessage(cause));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Check size={15} />
                  {item.readAt === null ? "Lida" : "Já lida"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorMessage message={error} />}
      <div className="notification-actions">
        {cursor && (
          <Button variant="ghost" onClick={() => setCursor(null)}>
            Voltar às recentes
          </Button>
        )}
        {state.data?.nextCursor && (
          <Button
            variant="ghost"
            onClick={() => setCursor(state.data!.nextCursor)}
          >
            Ver anteriores
          </Button>
        )}
        {notifications.manualRefresh !== false && <Button
          variant="ghost"
          onClick={async () => {
            try {
              await notifications.refresh();
            } catch (cause) {
              setError(validationMessage(cause));
            }
          }}
        >
          Atualizar avisos
        </Button>}
      </div>
    </section>
  );
}
function NotificationCopy({ item }: { item: AppNotification }) {
  const kind = notificationKind(item), community = item.communityName ?? item.entity;
  if (kind === "friendShare") return <><strong>{item.actorName ?? item.entity}</strong> te enviou {item.text}.</>;
  if (kind === "communityPost") return <>Nova publicação em <strong>{community}</strong>.</>;
  if (kind === "communityAccepted") return <><strong>{community}</strong> aceitou você.</>;
  if (kind === "communityRemoved") return <>Você foi removido de <strong>{community}</strong>.</>;
  return <><strong>{item.entity}</strong> {item.text}</>;
}
function NotificationLink({ item, onNavigate }: { item: AppNotification; onNavigate: () => void }) {
  const target = notificationTarget(item);
  if (!target) return null;
  const kind = notificationKind(item);
  return <Link {...target} onClick={onNavigate}>{kind === "friendShare" ? "Abrir trecho" : kind === "communityPost" ? "Abrir mensagem" : kind === "communityAccepted" ? "Abrir comunidade" : "Ver comunidades"}</Link>;
}
