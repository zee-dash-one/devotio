import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, NotificationsRepository, Watch } from "domain/core";
import { NotificationsBell } from "./notifications";
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const once = <T,>(value: T): Watch<T> => next => { next(value); return () => {}; };
function setup(item: AppNotification) {
  const notices: NotificationsRepository = { manualRefresh: false, watchSummary: () => once({ unread: 100, capped: true, revision: 0 }), watchPage: () => once({ items: [item], nextCursor: null }), markRead: vi.fn(), refresh: vi.fn() };
  const root = createRootRoute({ component: () => <><NotificationsBell notifications={notices} /><Outlet /></> });
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/", component: () => <p>Home</p> }),
    createRoute({ getParentRoute: () => root, path: "/biblia", validateSearch: (value: Record<string, unknown>) => value, component: () => <p>Bíblia</p> }),
    createRoute({ getParentRoute: () => root, path: "/comunidade/$communityId", validateSearch: (value: Record<string, unknown>) => value, component: () => <p>Comunidade</p> }),
  ]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />);
  return { notices, router };
}
const base: AppNotification = { id: "notice", type: "system", entity: "Ana", text: "João 3:16", communityId: null, messageId: null, createdAt: 1, readAt: null };
describe("connected notification bell", () => {
  it("opens a friend's exact Bible location without marking read and hides manual refresh", async () => {
    const { notices, router } = setup({ ...base, kind: "friendShare", actorName: "Ana", target: { version: "alm1911", book: "jo", chapter: 3, verse: 16 } });
    fireEvent.click(await screen.findByRole("button", { name: /^Notificações/ }));
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Atualizar avisos" })).toBeNull();
    fireEvent.click(await screen.findByRole("link", { name: "Abrir trecho" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/biblia"));
    expect(router.state.location.search).toMatchObject({ version: "alm1911", book: "jo", chapter: 3, verse: 16 });
    expect(notices.markRead).not.toHaveBeenCalled();
  });
  it("opens the selected community message and reserves reading for Lida", async () => {
    const { notices, router } = setup({ ...base, kind: "communityPost", type: "community", entity: "Esperança", communityId: "group", messageId: "old-message" });
    fireEvent.click(await screen.findByRole("button", { name: /^Notificações/ }));
    fireEvent.click(await screen.findByRole("link", { name: "Abrir mensagem" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/comunidade/group"));
    expect(router.state.location.search).toMatchObject({ message: "old-message" });
    expect(notices.markRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Notificações/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar notificação de Esperança como lida" }));
    await waitFor(() => expect(notices.markRead).toHaveBeenCalledWith("notice"));
  });
});
