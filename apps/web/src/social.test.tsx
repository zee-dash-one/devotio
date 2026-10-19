import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createPreviewRepository } from "domain/preview";
import {
  bibleQuote,
  type BibleChapter,
  type FriendsData,
  type PrivateShare,
  type ShareMarker,
  type SocialRepository,
  type Watch,
} from "domain/core";
import { App } from "./router";
const chapter: BibleChapter = {
  version: "alm1911",
  chapter: 1,
  book: { abbrev: "jo", name: "João", chapters: 1, testament: "NT", order: 43 },
  verses: [1, 2].map((number) => ({
    abbrev: "jo",
    bookName: "João",
    chapter: 1,
    number,
    text: `Texto canônico ${number}.`,
  })),
};
const quote = bibleQuote(chapter, {
  version: "alm1911",
  book: "jo",
  chapter: 1,
  first: 1,
  last: 2,
});
const watch =
  <T,>(value: T): Watch<T> =>
  (next) => {
    next(value);
    return () => {};
  };
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/perfil");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  window.getSelection()?.removeAllRanges();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup() {
  const data: FriendsData = {
    userId: "me",
    code: "ABCDEF234567",
    friends: [
      {
        id: "f1",
        userId: "ana",
        name: "Ana",
        state: "friend",
        available: true,
      },
      {
        id: "f2",
        userId: "jose",
        name: "José",
        state: "incoming",
        available: true,
      },
    ],
  };
  const listeners = new Set<(data: FriendsData) => void>();
  const marks: ShareMarker[] = [
    { first: 1, direction: "sent" },
    { first: 1, direction: "received" },
  ];
  const share: PrivateShare = {
    id: "received",
    direction: "received",
    quote,
    message: "Recado recebido de Ana",
    senderName: "Ana",
    sentAt: 1,
  };
  const social: SocialRepository = {
    watchFriends: () => (next) => {
      next(data);
      listeners.add(next);
      return () => {
        listeners.delete(next);
      };
    },
    rotateCode: vi.fn(async () => "ZXCVBN234567"),
    request: vi.fn(async () => {}),
    change: vi.fn(async (input) => {
      data.friends = data.friends.map((friend) =>
        friend.id === input.id ? { ...friend, state: "friend" } : friend,
      );
      listeners.forEach((next) => next({ ...data }));
    }),
    send: vi.fn(async () => "new-share"),
    watchMarkers: () => watch(marks),
    watchShares: (input) =>
      watch({
        items:
          input.direction === "sent"
            ? [
                {
                  ...share,
                  id: "sent",
                  direction: "sent",
                  message: "Recado enviado",
                  recipients: [
                    { id: "ana", name: "Ana" },
                    { id: "outro", name: "Outro destinatário" },
                  ],
                },
              ]
            : [share],
        nextCursor: null,
      }),
  };
  const repo = {
    ...createPreviewRepository(),
    social,
    bible: {
      versions: ["alm1911" as const],
      forVersion: () => ({
        watchBible: () =>
          watch({
            books: [chapter.book],
            verses: 2,
            importedAt: null,
            source: "Fonte ARC1911",
            version: "alm1911" as const,
          }),
        watchChapter: () => watch(chapter),
        watchSearch: () => watch({ verses: [], total: 0, page: 0 }),
      }),
    },
  };
  render(
    <App
      repository={repo}
      configured
      loading={false}
      userKey="friends-test"
      onLogin={async () => {}}
      onLogout={async () => {}}
    />,
  );
  return social;
}
describe("perfil e partilha da Bíblia", () => {
  it("busca amigos com acentos, aceita convite e envia código sem nova aba principal", async () => {
    const social = setup();
    await screen.findByRole("heading", { name: "Amigos" });
    fireEvent.change(screen.getByLabelText("Buscar amigos e convites"), {
      target: { value: "jose" },
    });
    expect(
      within(
        screen.getByRole("region", { name: "Convites recebidos" }),
      ).getByText("José"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Meus amigos" })).getByText(
          "José",
        ),
      ).toBeTruthy(),
    );
    fireEvent.change(screen.getByLabelText("Código de um amigo"), {
      target: { value: "abcdef234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(social.request).toHaveBeenCalledWith({
        kind: "code",
        code: "ABCDEF234567",
      }),
    );
    expect(
      within(
        screen.getByRole("navigation", { name: "Navegação principal" }),
      ).queryByText(/Amigos|Perfil/),
    ).toBeNull();
  });
  it("leitura limpa mostra ícones distintos; destinatário não vê a lista do remetente", async () => {
    window.history.replaceState(null, "", "/biblia?book=jo&chapter=1");
    setup();
    await screen.findByRole("checkbox", {
      name: "Versículo 1: Texto canônico 1.",
    });
    expect(
      screen.queryByText(
        /Leia com calma|A PALAVRA, POR INTEIRO|Toque para selecionar|Versão AA/,
      ),
    ).toBeNull();
    expect(screen.queryByText("Fonte ARC1911")).toBeNull();
    expect(
      screen.queryByText("Um pouco de silêncio. Um encontro com a Palavra."),
    ).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Recados recebidos a partir do versículo 1",
      }),
    );
    let modal = within(screen.getByRole("dialog"));
    expect(await modal.findByText("De Ana")).toBeTruthy();
    expect(modal.getByText("Recado recebido de Ana")).toBeTruthy();
    expect(modal.queryByText(/Outro destinatário|Para:/)).toBeNull();
    fireEvent.click(modal.getByRole("button", { name: "Fechar" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Recados enviados a partir do versículo 1",
      }),
    );
    modal = within(screen.getByRole("dialog"));
    expect(
      await modal.findByText("Para: Ana, Outro destinatário"),
    ).toBeTruthy();
  });
  it("modal mantém recado e destinatários após falha e reutiliza tentativa no reenvio", async () => {
    window.history.replaceState(null, "", "/biblia?book=jo&chapter=1");
    const social = setup();
    vi.mocked(social.send).mockRejectedValueOnce(new Error("Falha temporária"));
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Versículo 1: Texto canônico 1.",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Enviar para amigos" }),
    );
    const modal = within(screen.getByRole("dialog"));
    fireEvent.click(await modal.findByRole("checkbox", { name: "Ana" }));
    fireEvent.change(modal.getByLabelText("Seu recado"), {
      target: { value: "Uma palavra de cuidado" },
    });
    fireEvent.click(modal.getByRole("button", { name: "Enviar recado" }));
    await modal.findByText("Falha temporária");
    expect(
      (modal.getByLabelText("Seu recado") as HTMLTextAreaElement).value,
    ).toBe("Uma palavra de cuidado");
    expect(
      (modal.getByRole("checkbox", { name: "Ana" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    fireEvent.click(modal.getByRole("button", { name: "Enviar recado" }));
    await modal.findByText("O trecho e seu recado foram enviados.");
    const calls = vi.mocked(social.send).mock.calls;
    expect(calls[0][0].requestId).toBe(calls[1][0].requestId);
    expect(calls[0][0]).toMatchObject({
      recipientIds: ["ana"],
      message: "Uma palavra de cuidado",
      selection: { first: 1, last: 1, version: "alm1911" },
    });
  });
});
