import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalApp } from "./local-app";
import { availableEditorialDates, bibleQuote, dateInZone, recentDates, shiftEditorialMonth, type LocalProfile, type EditorialEntry, type Message, type AppNotification, type BibleSelection, type CommunityQuoteDraft, type Favorite } from "domain/core";

const profile: LocalProfile = { id: "marina", name: "Marina Oliveira", label: "Membro", description: "Perfil de teste", editorial: false };
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  window.getSelection()?.removeAllRanges();
  // jsdom exercises the modal flow, while the browser owns native dialog rendering.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const manager: LocalProfile = { id: "ester", name: "Ester Costa", label: "Gestor do sistema", description: "Teste", editorial: true };
function server(loggedIn: boolean, actor = profile, conflict = false, manages = false, withPassage = false) {
  const entries: EditorialEntry[] = [];
  const favorites: Favorite[] = [];
  let removed: { favorite: Favorite; token: string } | null = null;
  const devotional = (date: string) => ({ id: date, date, reference: withPassage ? "João 1:1–2, 5–6" : "Salmos 23:1", translation: "AA", scripture: withPassage ? "1 - Um\n2 - Dois\n5 - Cinco\n6 - Seis" : "Leitura integrada de teste", reflection: "Reflexão de teste", prayerSuggestion: "Oração de teste", credit: "Teste", ...(withPassage ? { selection: { book: "jo", chapter: 1, first: 1, last: 6, verses: [1, 2, 5, 6], version: "aa" as const } } : {}) });
  const messages: Message[] = [];
  const drafts: CommunityQuoteDraft[] = [];
  const requests = new Map<string, CommunityQuoteDraft>();
  const book = { abbrev: "jo", name: "João", chapters: 21, testament: "NT" as const, order: 43 };
  const makeQuote = (selection: BibleSelection) => bibleQuote({ book, chapter: selection.chapter, verses: ["Versículo bíblico de teste", "Segundo verso de teste", "Terceiro verso", "Quarto verso", "Quinto verso", "Sexto verso"].map((text, index) => ({ abbrev: "jo", bookName: "João", chapter: selection.chapter, number: index + 1, text })) }, selection);
  const notices: AppNotification[] = [{ id: "system-1", type: "system", entity: "Devotio", text: "Aviso de teste.", communityId: null, messageId: null, createdAt: Date.parse("2026-10-07T12:00:00Z"), readAt: null }];
  let revision = 1;
  const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.endsWith("session")) return new Response(JSON.stringify({ profile: loggedIn ? actor : null, profiles: [actor], expiresAt: loggedIn ? Date.now() + 86400000 : null }));
    if (options?.body) {
      const command = JSON.parse(String(options.body));
      if (command.action === "logout") { loggedIn = false; return new Response("null"); }
      if (command.action === "joinCommunity") return new Response(JSON.stringify("esperanca"));
      if (command.action === "setFavorite") {
        const index = favorites.findIndex(item => item.devotional.date === command.date);
        if (command.saved && index < 0) favorites.push({ devotional: devotional(command.date), favoritedAt: Date.now() });
        if (!command.saved && index >= 0) { removed = { favorite: favorites.splice(index, 1)[0], token: crypto.randomUUID() }; return new Response(JSON.stringify(removed.token)); }
        return new Response("null");
      }
      if (command.action === "restoreFavorite") {
        if (!removed || command.token !== removed.token) return new Response(JSON.stringify({ error: "Recibo inválido." }), { status: 409 });
        favorites.push(removed.favorite); removed = null; return new Response("null");
      }
      if (command.action === "schedule") {
        if (conflict) return new Response(JSON.stringify({ error: "Esta data já possui um devocional. Use Editar existente." }), { status: 409 });
        entries.push({ devotional: { ...command.input, id: command.input.date, translation: "AA", credit: actor.name }, publishedAt: Date.now() + 86400000, withdrawn: false });
        return new Response("null");
      }
      if (command.action === "withdraw") { entries.forEach(entry => { if (entry.devotional.date === command.date) entry.withdrawn = true; }); return new Response("null"); }
      if (command.action === "readNotification") { notices.forEach(item => { if (item.id === command.id) item.readAt = Date.now(); }); revision++; return new Response(JSON.stringify({ unread: notices.filter(item => item.readAt === null).length, revision })); }
      if (command.action === "saveQuoteDrafts") {
        const saved = command.ids.map((id: string) => {
          const key = id + command.requestId;
          if (!requests.has(key)) { const draft = { id: crypto.randomUUID(), communityId: id, quote: makeQuote(command.selection), comment: "", createdAt: Date.now() }; drafts.push(draft); requests.set(key, draft); }
          return requests.get(key);
        });
        return new Response(JSON.stringify(saved));
      }
      if (command.action === "updateQuoteDraft" || command.action === "publishQuoteDraft") {
        const draft = drafts.find(draft => draft.id === command.draftId)!;
        draft.comment = command.comment; draft.quote = makeQuote(command.selection);
        if (command.action === "publishQuoteDraft") { messages.push({ id: draft.id, content: draft.comment, quote: draft.quote, name: actor.name, sentAt: Date.now() }); drafts.splice(drafts.indexOf(draft), 1); }
        return new Response("null");
      }
      if (command.action === "deleteQuoteDraft") { const index = drafts.findIndex(draft => draft.id === command.draftId); if (index >= 0) drafts.splice(index, 1); return new Response("null"); }
      if (command.action === "sendQuote") {
        messages.push({ id: command.requestId, content: command.comment, name: actor.name, sentAt: Date.now(), quote: { ...command.selection, text: "Versículo bíblico de teste\nSegundo verso de teste", reference: "João 1:1–2", versionName: "Almeida Atualizada (AA)" } });
        return new Response(JSON.stringify(command.requestId));
      }
      loggedIn = true;
      return new Response(JSON.stringify({ profile: actor, expiresAt: Date.now() + 86400000 }));
    }
    const input = JSON.parse(new URL(path, "http://localhost").searchParams.get("input")!);
    if (input.query === "socialMarkers") return new Response("[]");
    if (input.query === "invite") return new Response(JSON.stringify({ id: "esperanca", name: "Esperança" }));
    if (input.query === "governance") return new Response(JSON.stringify(input.input.kind === "creation" ? { allowed: manages, limit: 3, owned: 2, canCreate: manages } : { items: [], cursor: null }));
    if (input.query === "socialFriends") return new Response(JSON.stringify({ userId: actor.id, code: null, friends: [] }));
    if (input.query === "communities") return new Response(JSON.stringify(manages ? ["Esperança", "Caminho"].map((name, index) => ({ id: index ? "caminho" : "esperanca", name, description: "Teste", scripture: "", role: "admin" })) : []));
    if (input.query === "quoteDrafts") return new Response(JSON.stringify(drafts.filter(draft => draft.communityId === input.id)));
    if (input.query === "community") return new Response(JSON.stringify({ community: { id: input.id, name: "Esperança", description: "Teste", scripture: "", role: manages ? "admin" : "member", inviteCode: "ESPERANC" }, members: [], messages, lists: [], hasMore: false, nextCursor: null }));
    if (input.query === "communityMessage") return new Response(JSON.stringify(messages.find(message => message.id === input.messageId)));
    if (input.query === "notificationSummary") return new Response(JSON.stringify({ unread: notices.filter(item => item.readAt === null).length, revision }));
    if (input.query === "notifications") return new Response(JSON.stringify({ items: notices, nextCursor: null }));
    if (input.query === "editorial") return new Response(JSON.stringify(entries));
    if (input.query === "editorialCalendar") return new Response(JSON.stringify(availableEditorialDates(input.month, entries.map(entry => entry.devotional.date), input.today)));
    if (input.query === "bible") return new Response(JSON.stringify({ books: [book], version: "aa", verses: 1, importedAt: 1, source: "Fixture" }));
    if (input.query === "chapter") return new Response(JSON.stringify({ book, chapter: input.chapter, verses: ["Versículo bíblico de teste", "Segundo verso de teste", "Terceiro verso", "Quarto verso", "Quinto verso", "Sexto verso"].map((text, index) => ({ abbrev: "jo", bookName: "João", chapter: input.chapter, number: index + 1, text })) }));
    if (input.query === "search") return new Response(JSON.stringify({ verses: [{ abbrev: "jo", bookName: "João", chapter: 1, number: 1, text: "Trecho encontrado na busca" }], total: 1, page: input.page }));
    if (input.query === "reading") {
      const dates = recentDates(dateInZone("America/Sao_Paulo")).slice(0, 7);
      return new Response(JSON.stringify({ dates, recent: dates.map(devotional), favorites }));
    }
    if (input.query === "devotionals") return new Response(JSON.stringify(Object.fromEntries(input.dates.map((date: string) => [date, {
      user: actor, settings: null,
      devotional: devotional(date),
    }]))));
    throw new Error("Consulta inesperada: " + path);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
async function chooseWord() {
  fireEvent.click(await screen.findByRole("button", { name: "Escolher Palavra na Bíblia" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
  expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Usar trecho no devocional" }));
  await screen.findByLabelText("Palavra");
}
function isQuery(path: string, name: string) {
  const input = new URL(path, "http://localhost").searchParams.get("input");
  return input ? (JSON.parse(input) as { query?: string }).query === name : false;
}
describe("entrada local integrada", () => {
  it.each(["paged", "continuous"])("devocional seleciona Palavra e abre passagem marcada no modo %s", async (mode) => {
    localStorage.setItem("devotio:preferences:v1:marina", JSON.stringify({ theme: "day", fontSize: 20, mode }));
    server(true, profile, false, false, true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Versículo 1: Um" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Versículo 5: Cinco" }), { shiftKey: true });
    expect(screen.getByRole("checkbox", { name: "Versículo 2: Dois" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("button", { name: "Enviar para comunidade" })).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar para amigos" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("1 - Um\n5 - Cinco\n\nJoão 1:1, 5\nAA"));
    fireEvent.click(screen.getByRole("link", { name: "João 1:1–2, 5–6" }));
    await waitFor(() => expect(window.location.pathname).toBe("/biblia"));
    for (const n of [1, 2, 5, 6]) await waitFor(() => expect(document.getElementById(`verse-1-${n}`)?.getAttribute("aria-checked")).toBe("true"));
    expect(document.getElementById("verse-1-3")?.getAttribute("aria-checked")).toBe("false");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(document.getElementById("verse-1-1")?.getAttribute("aria-checked")).toBe("false");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  it("devocional legado continua legível e compartilha o texto inteiro pela API nativa", async () => {
    server(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    expect(screen.queryByRole("link", { name: "Salmos 23:1" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar devocional" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: expect.stringContaining("PALAVRA\nSalmos 23:1 — AA") }));
    expect(share.mock.calls[0][0].text).toContain("Devotio — https://devotio.zee-dash-one.workers.dev");
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  it.each(["Meditar", "Oração"])("%s só abre no toque longo, cancela movimento e copia com referência", async (label) => {
    server(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StrictMode><LocalApp /></StrictMode>);
    const target = await screen.findByLabelText(label);
    fireEvent.click(target);
    expect(screen.queryByLabelText(`Compartilhar ${label}`)).toBeNull();
    const pointer = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 100, button: 0 });
      Object.defineProperties(event, { pointerType: { value: "touch" }, pointerId: { value: 1 } }); fireEvent(target, event);
    };
    pointer("pointerdown", 100); pointer("pointermove", 125); pointer("pointerup", 125);
    await new Promise(resolve => setTimeout(resolve, 380));
    expect(screen.queryByLabelText(`Compartilhar ${label}`)).toBeNull();
    pointer("pointerdown", 100);
    await screen.findByLabelText(`Compartilhar ${label}`);
    pointer("pointerup", 100); fireEvent.click(target);
    expect(screen.queryByRole("button", { name: "Enviar para amigos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${label === "Meditar" ? "Reflexão" : "Oração"} de teste\n\nSalmos 23:1`));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  it("compartilhar devocional oferece cópia manual se APIs estiverem indisponíveis", async () => {
    server(true);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: "Compartilhar devocional" }));
    const area = await screen.findByLabelText("Texto para compartilhar") as HTMLTextAreaElement;
    expect(area.value).toContain("MEDITAR\n\nReflexão de teste\n\nORAÇÃO\n\nOração de teste");
    expect(screen.queryByRole("button", { name: "Enviar para amigos" })).toBeNull();
  });
  it("acumula versos separados, copia referência agrupada e alterna pelo teclado", async () => {
    window.history.replaceState(null, "", "/biblia"); server(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    const verse = (n: number) => screen.getByRole("checkbox", { name: new RegExp(`^Versículo ${n}:`) });
    for (const n of [1, 2, 5, 6]) fireEvent.click(verse(n), { shiftKey: true });
    for (const n of [1, 2, 5, 6]) expect(verse(n).getAttribute("aria-checked")).toBe("true");
    expect(verse(3).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("João 1:1–2, 5–6")));
    fireEvent.click(verse(5));
    expect(verse(5).getAttribute("aria-checked")).toBe("false");
    fireEvent.keyDown(verse(3), { key: "ArrowDown", shiftKey: true });
    expect(verse(3).getAttribute("aria-checked")).toBe("false");
    fireEvent.keyDown(verse(3), { key: "Enter" });
    expect(verse(3).getAttribute("aria-checked")).toBe("true");
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
    fireEvent(verse(3), copyEvent); expect(copyEvent.defaultPrevented).toBe(true);
    fireEvent.keyDown(verse(3), { key: "Escape" });
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  it("segurar alterna uma vez e arrastar cancela sem selecionar", async () => {
    localStorage.setItem("devotio:preferences:v1:marina", JSON.stringify({ theme: "day", fontSize: 20, mode: "continuous" }));
    window.history.replaceState(null, "", "/biblia"); server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    const verse = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    function pointer(type: string, x: number) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 100, button: 0 });
      Object.defineProperties(event, { pointerType: { value: "touch" }, pointerId: { value: 1 } }); fireEvent(verse, event);
    }
    pointer("pointerdown", 100);
    await waitFor(() => expect(verse.getAttribute("aria-checked")).toBe("true"));
    pointer("pointerup", 100); fireEvent.click(verse);
    expect(verse.getAttribute("aria-checked")).toBe("true");
    pointer("pointerdown", 100); pointer("pointermove", 125); pointer("pointerup", 125); fireEvent.click(verse);
    expect(verse.getAttribute("aria-checked")).toBe("true");
    pointer("pointerdown", 100);
    await waitFor(() => expect(verse.getAttribute("aria-checked")).toBe("false"));
    pointer("pointermove", 125); pointer("pointerup", 125); fireEvent.click(verse);
    expect(verse.getAttribute("aria-checked")).toBe("true");
  });
  it.each([640, 641, 1000])("menu usa viewport %i somente ao montar", async (width) => {
    const media = { matches: width <= 640, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn((query: string) => query === "(max-width: 640px)" ? media : { ...media, matches: false }));
    window.history.replaceState(null, "", "/biblia"); server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
    const menu = screen.getByLabelText("Ações dos versículos selecionados");
    expect(menu.getAttribute("data-state")).toBe(width <= 640 ? "collapsed" : "expanded");
    media.matches = !media.matches; fireEvent(window, new Event("resize"));
    expect(menu.getAttribute("data-state")).toBe(width <= 640 ? "collapsed" : "expanded");
    media.matches = true;
    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("chapter")).toBe("2"));
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
    expect(screen.getByLabelText("Ações dos versículos selecionados").getAttribute("data-state")).toBe("collapsed");
  });
  it("compacta o cabeçalho desktop na rolagem, mantém ações e expande no topo sem consultas", async () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 190, width: 1000, x: 0, y: 0, top: 0, bottom: 190, left: 0, right: 1000, toJSON() {} });
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    const fetcher = server(true); render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    const header = document.querySelector<HTMLElement>(".reader-masthead")!;
    const space = document.querySelector<HTMLElement>(".reader-header-space")!;
    expect(header.dataset.compact).toBe("false");
    const before = fetcher.mock.calls.length;
    vi.spyOn(window, "scrollY", "get").mockReturnValue(160); fireEvent.scroll(window);
    await waitFor(() => expect(header.dataset.compact).toBe("true"));
    expect(space.style.getPropertyValue("--reader-header-height")).toBe("190px");
    expect(screen.getByRole("navigation", { name: "Navegação principal" }).querySelectorAll("a")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Notificações,/ }));
    await screen.findByRole("dialog", { name: "Notificações" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    const afterNotices = fetcher.mock.calls.length;
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0); fireEvent.scroll(window);
    await waitFor(() => expect(header.dataset.compact).toBe("false"));
    expect(fetcher.mock.calls.length).toBe(afterNotices);
    expect(afterNotices).toBe(before + 1);
    media.matches = false;
    vi.spyOn(window, "scrollY", "get").mockReturnValue(160); fireEvent.scroll(window);
    await waitFor(() => expect(header.dataset.compact).toBe("false"));
  });
  it("modal de recentes e dropdown de capítulo preservam a navegação e reutilizam dados", async () => {
    const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    const dates = await screen.findByRole("button", { name: "Abrir devocionais recentes" });
    const before = fetcher.mock.calls.length;
    fireEvent.click(dates);
    const choices = await screen.findAllByRole("button", { name: /^Ler devocional de/ });
    expect(choices).toHaveLength(7);
    expect(choices[1].textContent).toContain("Salmos 23:1");
    expect(choices[1].textContent).toContain("Leitura integrada de teste");
    const older = choices[1], label = older.getAttribute("aria-label")!.replace("Ler devocional de ", "");
    fireEvent.click(older);
    expect(screen.getByRole("button", { name: `Devocional ${label}` }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Deixe o ruído lá fora. Acolha a Palavra aqui.")).toBeNull();
    await screen.findByText("Leitura integrada de teste");
    expect(fetcher.mock.calls).toHaveLength(before);
    fireEvent.click(screen.getAllByRole("link", { name: "Bíblia" })[0]);
    await screen.findByText("Versículo bíblico de teste");
    fireEvent.click(screen.getByRole("combobox", { name: "Capítulo" }));
    fireEvent.click(screen.getByRole("option", { name: /^3$/ }));
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("chapter")).toBe("3"));
    await screen.findByText("Versículo bíblico de teste");
    expect(screen.getByRole("combobox", { name: "Capítulo" }).textContent).toBe("3");
  });
  it("favorita a leitura exibida, preserva a data ao voltar e remove a cópia pessoal", async () => {
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    fireEvent.click(screen.getByRole("button", { name: "Abrir devocionais recentes" }));
    const older = (await screen.findAllByRole("button", { name: /^Ler devocional de/ }))[2];
    const label = older.getAttribute("aria-label")!.replace("Ler devocional de ", "");
    fireEvent.click(older);
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar aos favoritos" }));
    expect((await screen.findByRole("button", { name: "Remover dos favoritos" })).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    await screen.findByText(/Cópia pessoal salva em/);
    expect(screen.getByRole("combobox", { name: "Sua cópia pessoal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Devocional ${label}` }));
    expect(screen.getByRole("button", { name: `Devocional ${label}` }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(await screen.findByRole("button", { name: "Remover dos favoritos" }));
    await screen.findByRole("button", { name: "Adicionar aos favoritos" });
    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    await screen.findByText("Você ainda não tem devocionais favoritos.");
    const restore = await screen.findByRole("button", { name: "Adicionar aos favoritos" });
    expect((restore as HTMLButtonElement).disabled).toBe(true);
  });
  it("abre favoritos pelo perfil e volta às recentes pelo menu principal", async () => {
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    const menu = document.querySelector<HTMLDetailsElement>(".account-menu")!;
    menu.open = true;
    fireEvent.click(screen.getByRole("link", { name: "Favoritos" }));
    await screen.findByRole("heading", { name: "Devocionais Favoritos" });
    await screen.findByText("Você ainda não tem devocionais favoritos.");
    fireEvent.click(screen.getAllByRole("link", { name: "Devocional" })[0]);
    await screen.findByText("Leitura integrada de teste");
    expect(screen.queryByRole("heading", { name: "Devocionais Favoritos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir devocionais recentes" }));
    expect(await screen.findAllByRole("button", { name: /^Ler devocional de/ })).toHaveLength(7);
  });
  it("reinicia no devocional de hoje ao tocar novamente na aba principal", async () => {
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    fireEvent.click(screen.getByRole("button", { name: "Abrir devocionais recentes" }));
    const choices = await screen.findAllByRole("button", { name: /^Ler devocional de/ });
    const oldDate = choices[2].getAttribute("aria-label")!.replace("Ler devocional de ", "");
    fireEvent.click(choices[2]);
    expect(screen.getByRole("button", { name: `Devocional ${oldDate}` })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("link", { name: "Devocional" })[0]);
    const today = recentDates(dateInZone("America/Sao_Paulo"))[0].split("-").reverse().join("/");
    await screen.findByRole("button", { name: `Devocional ${today}` });
  });
  it("compartilha a data selecionada em recentes e favoritos", async () => {
    server(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    fireEvent.click(screen.getByRole("button", { name: "Abrir devocionais recentes" }));
    const older = (await screen.findAllByRole("button", { name: /^Ler devocional de/ }))[2];
    const label = older.getAttribute("aria-label")!.replace("Ler devocional de ", "");
    fireEvent.click(older);
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar devocional" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: expect.stringContaining(`Devocional de ${label}`) }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos" }));
    await screen.findByRole("button", { name: "Remover dos favoritos" });
    const menu = document.querySelector<HTMLDetailsElement>(".account-menu")!;
    menu.open = true;
    fireEvent.click(screen.getByRole("link", { name: "Favoritos" }));
    await screen.findByRole("heading", { name: "Devocionais Favoritos" });
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar devocional" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share.mock.calls[1][0].text).toContain(`Devocional de ${label}`);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  it("mantém o ícone vazio desabilitado e permite desfazer o último favorito sem sair da tela", async () => {
    server(true); render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    expect((screen.getByRole("button", { name: "Adicionar aos favoritos" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^Devocional \d/ }));
    const save = await screen.findByRole("button", { name: "Adicionar aos favoritos" });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(save);
    await screen.findByRole("button", { name: "Remover dos favoritos" });
    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    await screen.findByText(/Cópia pessoal salva em/);
    fireEvent.click(screen.getByRole("button", { name: "Remover dos favoritos" }));
    await screen.findByText("Você ainda não tem devocionais favoritos.");
    fireEvent.click(await screen.findByRole("button", { name: "Restaurar último favorito" }));
    await screen.findByText(/Cópia pessoal salva em/);
    expect(screen.getByRole("button", { name: "Remover dos favoritos" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Remover dos favoritos" }));
    await screen.findByRole("button", { name: "Restaurar último favorito" });
    fireEvent.click(screen.getByRole("button", { name: /^Devocional \d/ }));
    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    expect(screen.queryByRole("button", { name: "Restaurar último favorito" })).toBeNull();
    expect((screen.getByRole("button", { name: "Adicionar aos favoritos" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("fecha o menu da conta ao clicar fora, Escape e acionar configurações ou link", async () => {
    server(true); render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    const menu = document.querySelector<HTMLDetailsElement>(".account-menu")!;
    menu.open = true; fireEvent.pointerDown(screen.getByRole("main")); expect(menu.open).toBe(false);
    menu.open = true; fireEvent.click(screen.getByRole("main")); expect(menu.open).toBe(false);
    menu.open = true; fireEvent.keyDown(document, { key: "Escape" }); expect(menu.open).toBe(false);
    menu.open = true; fireEvent.click(screen.getByRole("button", { name: "Configurações" })); expect(menu.open).toBe(false);
    await screen.findByRole("dialog", { name: /Configurações/ });
    fireEvent.click(screen.getByRole("button", { name: /^Fechar$/ }));
    menu.open = true; fireEvent.click(screen.getAllByRole("link", { name: "Ajuda e instalação" })[0]);
    expect(menu.open).toBe(false);
  });
  it("devolve o foco à conta e mantém falha de logout visível fora do menu fechado", async () => {
    const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    const menu = document.querySelector<HTMLDetailsElement>(".account-menu")!;
    const trigger = menu.querySelector("summary")!;
    trigger.focus(); menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    await screen.findByRole("dialog", { name: "Configurações" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(document.activeElement).toBe(trigger);
    fetcher.mockRejectedValueOnce(new TypeError("Falha de conexão"));
    menu.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Sair / trocar perfil" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("Não foi possível sair");
    expect(menu.open).toBe(false);
    expect(menu.contains(error)).toBe(false);
    expect(screen.getByText("Leitura integrada de teste")).toBeDefined();
  });
  it("aplica configurações na hora, preserva seleção e reutiliza capítulos ao mudar modo", async () => {
    window.history.replaceState(null, "", "/biblia?book=jo&chapter=3");
    const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    const first = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    await waitFor(() => expect(fetcher.mock.calls.filter(([path]) => isQuery(path, "chapter")).length).toBe(3));
    fireEvent.click(first);
    const before = fetcher.mock.calls.filter(([path]) => !isQuery(path, "socialMarkers")).length;
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Tema" }));
    fireEvent.click(screen.getByRole("option", { name: "Noite" }));
    expect(document.documentElement.dataset.theme).toBe("night");
    fireEvent.change(screen.getByRole("slider", { name: "Tamanho da fonte" }), { target: { value: "7" } });
    expect(document.documentElement.style.fontSize).toBe("160%");
    fireEvent.click(screen.getByRole("combobox", { name: "Modo de leitura bíblica" }));
    fireEvent.click(screen.getByRole("option", { name: "Contínuo" }));
    expect(document.querySelectorAll('[data-reading-chapter]')).toHaveLength(3);
    expect(screen.queryByRole("navigation", { name: "Capítulos" })).toBeNull();
    expect(first.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^Fechar$/ }));
    expect(fetcher.mock.calls.filter(([path]) => !isQuery(path, "socialMarkers"))).toHaveLength(before);
    expect(JSON.parse(localStorage.getItem("devotio:preferences:v1:" + profile.id)!)).toEqual({ theme: "night", fontSize: 32, mode: "continuous" });
  });
  it("restaura preferências do perfil na recarga e deixa de aplicá-las ao sair", async () => {
    localStorage.setItem("devotio:preferences:v1:marina", JSON.stringify({ theme: "papyrus", fontSize: 28, mode: "continuous" }));
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    expect(document.documentElement.dataset.theme).toBe("papyrus");
    expect(document.documentElement.style.fontSize).toBe("140%");
    fireEvent.click(screen.getByRole("button", { name: "Sair / trocar perfil" }));
    await screen.findByRole("button", { name: /Marina Oliveira/ });
    expect(document.documentElement.dataset.theme).toBe("day");
    expect(JSON.parse(localStorage.getItem("devotio:preferences:v1:marina")!).theme).toBe("papyrus");
  });
  it("swipe longo pagina uma vez; movimento curto e vertical não navegam", async () => {
    window.history.replaceState(null, "", "/biblia?book=jo&chapter=3"); server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    let verse = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    const pointer = (target: HTMLElement, type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1 });
      Object.defineProperties(event, { pointerType: { value: "touch" }, pointerId: { value: 1 }, isPrimary: { value: true } });
      fireEvent(target, event);
    };
    pointer(verse, "pointerdown", 450, 100); pointer(verse, "pointermove", 410, 102); pointer(verse, "pointerup", 410, 102);
    expect(new URL(window.location.href).searchParams.get("chapter")).toBe("3");
    pointer(verse, "pointerdown", 450, 100); pointer(verse, "pointermove", 449, 350); pointer(verse, "pointerup", 449, 350);
    expect(new URL(window.location.href).searchParams.get("chapter")).toBe("3");
    pointer(verse, "pointerdown", 450, 100); pointer(verse, "pointermove", 100, 102); pointer(verse, "pointerup", 100, 102);
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("chapter")).toBe("4"));
    verse = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    pointer(verse, "pointerdown", 100, 100); pointer(verse, "pointermove", 450, 102); pointer(verse, "pointerup", 450, 102);
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("chapter")).toBe("3"));
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
  });
  it("leitura contínua desloca a janela sem acumular capítulos e só antecipa um novo", async () => {
    localStorage.setItem("devotio:preferences:v1:marina", JSON.stringify({ theme: "day", fontSize: 20, mode: "continuous" }));
    window.history.replaceState(null, "", "/biblia?book=jo&chapter=3");
    const fetcher = server(true);
    let visibleChapter = 3;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const number = Number(this.closest('[data-reading-chapter]')?.getAttribute('data-reading-chapter'));
      const top = number === visibleChapter ? 100 : number < visibleChapter ? -500 : 1000;
      return { x: 0, y: top, top, bottom: top + 400, left: 0, right: 600, width: 600, height: 400, toJSON() {} };
    });
    render(<StrictMode><LocalApp /></StrictMode>);
    await waitFor(() => expect(document.querySelectorAll('[data-reading-chapter]')).toHaveLength(3));
    for (visibleChapter = 4; visibleChapter <= 8; visibleChapter++) {
      fireEvent.scroll(window);
      await waitFor(() => expect(new URL(window.location.href).searchParams.get('chapter')).toBe(String(visibleChapter)));
      await waitFor(() => expect(document.querySelector(`[data-reading-chapter="${visibleChapter + 1}"]`)).not.toBeNull());
      expect(document.querySelectorAll('[data-reading-chapter]')).toHaveLength(3);
    }
    expect(fetcher.mock.calls.filter(([path]) => isQuery(path, "chapter"))).toHaveLength(8);
    visibleChapter = 7;
    fireEvent.scroll(window);
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('chapter')).toBe('7'));
    await waitFor(() => expect(document.querySelector('[data-reading-chapter="6"]')).not.toBeNull());
    expect(fetcher.mock.calls.filter(([path]) => isQuery(path, "chapter"))).toHaveLength(8);
  });
  it("contrai/expande pela seta e preserva seleção, cópia e escolha de comunidades", async () => {
    window.history.replaceState(null, "", "/biblia"); server(true, manager, false, true);
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    render(<StrictMode><LocalApp /></StrictMode>);
    const verse = await screen.findByRole("checkbox", { name: /^Versículo 1:/ }); fireEvent.click(verse);
    const menu = screen.getByLabelText("Ações dos versículos selecionados");
    fireEvent.click(screen.getByRole("button", { name: "Contrair menu de seleção" }));
    expect(menu.getAttribute("data-state")).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Expandir menu de seleção" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Compartilhar").hidden).toBe(true);
    expect(verse.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("1 - Versículo bíblico de teste\n\nJoão 1:1\nAlmeida Atualizada (AA)"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para comunidade" }));
    expect(menu.getAttribute("data-state")).toBe("expanded");
    fireEvent.click(screen.getByRole("checkbox", { name: "Caminho" }));
    fireEvent.click(screen.getByRole("button", { name: "Contrair menu de seleção" }));
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu de seleção" }));
    expect((screen.getByRole("checkbox", { name: "Caminho" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Fechar seleção" }));
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  it("swipe do menu não executa ações nem seleciona versos; swipe rápido da tela expande sem bloquear rolagem", async () => {
    window.history.replaceState(null, "", "/biblia"); const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    const first = await screen.findByRole("checkbox", { name: /^Versículo 1:/ }); fireEvent.click(first);
    const second = screen.getByRole("checkbox", { name: /^Versículo 2:/ });
    const menu = screen.getByLabelText("Ações dos versículos selecionados");
    function pointer(target: HTMLElement, type: string, x: number, y: number, pointerType = "touch") {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1 });
      Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: 1 }, isPrimary: { value: true } });
      fireEvent(target, event);
    }
    const before = fetcher.mock.calls.length;
    const clear = screen.getByRole("button", { name: "Limpar seleção" });
    pointer(clear, "pointerdown", 20, 100, "mouse"); pointer(clear, "pointermove", 40, 100, "mouse"); pointer(clear, "pointerup", 40, 100, "mouse");
    fireEvent.click(clear, { detail: 1 });
    expect(menu.getAttribute("data-state")).toBe("expanded");
    expect(first.getAttribute("aria-checked")).toBe("true");
    pointer(menu, "pointerdown", 30, 100, "mouse"); pointer(menu, "pointermove", 110, 101, "mouse"); pointer(menu, "pointerup", 110, 101, "mouse");
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }), { detail: 1 });
    expect(menu.getAttribute("data-state")).toBe("collapsed");
    expect(first.getAttribute("aria-checked")).toBe("true"); expect(second.getAttribute("aria-checked")).toBe("false");
    pointer(menu, "pointerdown", 50, 100); pointer(menu, "pointermove", 52, 200); pointer(menu, "pointerup", 52, 200);
    expect(menu.getAttribute("data-state")).toBe("collapsed");
    pointer(second, "pointerdown", 200, 100); pointer(second, "pointermove", 120, 104); pointer(second, "pointerup", 120, 104);
    fireEvent.click(second, { detail: 1 });
    expect(menu.getAttribute("data-state")).toBe("expanded");
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(first.getAttribute("aria-checked")).toBe("true"); expect(second.getAttribute("aria-checked")).toBe("false");
    pointer(menu, "pointerdown", 200, 100); pointer(menu, "pointermove", 260, 100); pointer(menu, "pointerup", 260, 100);
    pointer(menu, "pointerdown", 60, 100); pointer(menu, "pointermove", 0, 100); pointer(menu, "pointerup", 0, 100);
    expect(menu.getAttribute("data-state")).toBe("expanded");
    expect(fetcher.mock.calls).toHaveLength(before);
  });
  it("arrastar com mouse não seleciona versos e termina fora do capítulo", async () => {
    window.history.replaceState(null, "", "/biblia"); server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    const first = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    const second = screen.getByRole("checkbox", { name: /^Versículo 2:/ });
    const down = new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, button: 0, buttons: 1 });
    const move = new MouseEvent("pointermove", { bubbles: true, clientX: 20, clientY: 20, buttons: 1 });
    Object.defineProperty(down, "pointerType", { value: "mouse" });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    fireEvent(second, down); fireEvent(first, move);
    fireEvent.pointerUp(document);
    expect(first.getAttribute("aria-checked")).toBe("false"); expect(second.getAttribute("aria-checked")).toBe("false");
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
  });
  it("recebe resumo SSE sem consulta adicional e fecha a conexão no logout", async () => {
    const streams: { source: EventTarget; closed: boolean }[] = [];
    class Stream extends EventTarget {
      closed = false;
      source: EventTarget = this;
      constructor() { super(); streams.push(this); }
      close() { this.closed = true; }
    }
    vi.stubGlobal("EventSource", Stream);
    const fetcher = server(true); render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByRole("button", { name: "Notificações, 1 não lidas" });
    const before = fetcher.mock.calls.length;
    streams.at(-1)!.source.dispatchEvent(new MessageEvent("notifications", { data: JSON.stringify({ unread: 2, revision: 2 }) }));
    await screen.findByRole("button", { name: "Notificações, 2 não lidas" });
    expect(fetcher.mock.calls).toHaveLength(before);
    fireEvent.click(screen.getByRole("button", { name: "Sair / trocar perfil" }));
    await screen.findByRole("button", { name: /Marina Oliveira/ });
    expect(streams.every(stream => stream.closed)).toBe(true);
  });
  it("seleciona por toque/Shift, compartilha texto completo e fecha o menu pelo X", async () => {
    window.history.replaceState(null, "", "/biblia"); server(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: share } });
    render(<StrictMode><LocalApp /></StrictMode>);
    const first = await screen.findByRole("checkbox", { name: /^Versículo 1:/ });
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Versículo 2:/ }), { shiftKey: true });
    expect(first.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: /^Versículo 2:/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith("1 - Versículo bíblico de teste\n2 - Segundo verso de teste\n\nJoão 1:1–2\nAlmeida Atualizada (AA)"));
    expect(screen.queryByRole("button", { name: "Enviar para comunidade" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar para devocional" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar seleção" }));
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    expect(first.getAttribute("aria-checked")).toBe("false");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  it("salva rascunhos em várias comunidades, abre em Escrever e só publica após confirmação", async () => {
    window.history.replaceState(null, "", "/biblia");
    const fetcher = server(true, { ...profile, id: "daniel", name: "Daniel Almeida" }, false, true);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Versículo 2:/ }), { shiftKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para comunidade" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Caminho" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText(/Rascunho salvo em 2 comunidades/);
    expect(window.location.pathname).toBe("/biblia");
    fireEvent.click(screen.getAllByRole("link", { name: "Comunidade" })[0]);
    fireEvent.click(await screen.findByRole("link", { name: /Esperança/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Escrever" }));
    await screen.findByLabelText("Comentário (opcional)");
    expect(fetcher.mock.calls.filter(([, options]) => String(options?.body).includes('"sendQuote"'))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Comentário (opcional)"), { target: { value: "Meu comentário" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar na comunidade" }));
    await screen.findByText("Meu comentário");
    const link = screen.getByRole("link", { name: "Ler na Bíblia" });
    expect(link.getAttribute("href")).toContain("verse=1");
    expect(link.getAttribute("href")).toContain("version=aa");
    expect(fetcher.mock.calls.filter(([, options]) => String(options?.body).includes('"publishQuoteDraft"'))).toHaveLength(1);
  });
  it("escolhe trecho pela comunidade, preserva comentário e seleção, sem menu lateral contextual", async () => {
    window.history.replaceState(null, "", "/comunidade/esperanca");
    const fetcher = server(true, { ...profile, id: "daniel", name: "Daniel Almeida" }, false, true);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: "Escrever" }));
    fireEvent.change(await screen.findByLabelText("Mensagem"), { target: { value: "Comentário em andamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Escolher trecho na Bíblia" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Versículo 2:/ }), { shiftKey: true });
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Usar trecho no rascunho da comunidade" }));
    expect((await screen.findByLabelText("Comentário (opcional)") as HTMLTextAreaElement).value).toBe("Comentário em andamento");
    expect(window.location.pathname).toBe("/comunidade/esperanca");
    expect(fetcher.mock.calls.filter(([, options]) => String(options?.body).includes('"publishQuoteDraft"'))).toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: "Rever seleção na Bíblia" }));
    expect((await screen.findByRole("checkbox", { name: /^Versículo 2:/ })).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getAllByRole("link", { name: "Bíblia" })[0]);
    await waitFor(() => expect(window.location.search).not.toContain("pick="));
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Versículo 1:/ }));
    expect(screen.getByLabelText("Ações dos versículos selecionados")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Usar trecho no rascunho da comunidade" })).toBeNull();
  });
  it("preenche a busca bíblica vinda do cadastro e preserva campos quando não escolhe outro trecho", async () => {
    window.history.replaceState(null, "", "/editorial/cadastro"); server(true, manager);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.change(await screen.findByLabelText("Reflexão"), { target: { value: "Reflexão pendente" } });
    fireEvent.change(screen.getByLabelText("Pesquisar na Bíblia"), { target: { value: "amor" } });
    fireEvent.click(screen.getByRole("button", { name: "Escolher Palavra na Bíblia" }));
    expect((await screen.findByLabelText("Buscar palavras na Bíblia") as HTMLInputElement).value).toBe("amor");
    await screen.findByText("Trecho encontrado na busca");
    fireEvent.click(screen.getByRole("button", { name: "Voltar sem alterar o trecho" }));
    expect((await screen.findByLabelText("Reflexão") as HTMLTextAreaElement).value).toBe("Reflexão pendente");
    expect((screen.getByLabelText("Pesquisar na Bíblia") as HTMLInputElement).value).toBe("amor");
  });
  it("sino abre avisos sem marcar lida e ação Lida atualiza o badge", async () => {
    const fetcher = server(true); render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lidas" }));
    await screen.findByText("Aviso de teste.");
    expect(screen.getByText("07/10/2026")).toBeDefined();
    expect(fetcher.mock.calls.filter(([, options]) => String(options?.body).includes('"readNotification"'))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Marcar notificação de Devotio como lida" }));
    await screen.findByText("Já lida");
    expect(screen.getByRole("button", { name: "Notificações" })).toBeDefined();
  });
  it("busca automaticamente após quatro caracteres, agrupando digitação", async () => {
    window.history.replaceState(null, "", "/biblia"); const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    const search = await screen.findByLabelText("Buscar palavras na Bíblia");
    fireEvent.change(search, { target: { value: "amo" } });
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(fetcher.mock.calls.filter(([path]) => path.includes('search%22'))).toHaveLength(0);
    fireEvent.change(search, { target: { value: "amor" } });
    fireEvent.change(search, { target: { value: "amor de" } });
    await screen.findByText("Trecho encontrado na busca");
    const searches = fetcher.mock.calls.filter(([path]) => path.includes('search%22'));
    expect(searches).toHaveLength(1);
    expect(decodeURIComponent(searches[0][0])).toContain('"text":"amor de"');
  });
  it("bloqueia a tela de cadastro para membro, sem consultar dados editoriais", async () => {
    window.history.replaceState(null, "", "/editorial/cadastro");
    const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    expect((await screen.findByRole("alert")).textContent).toContain("Gestor do sistema");
    expect(screen.queryByLabelText("Palavra")).toBeNull();
    expect(fetcher.mock.calls.filter(([path]) => path.includes("editorial"))).toHaveLength(0);
  });
  it("escolhe Palavra não editável, preserva o formulário entre telas e mantém Auxílio sem IA", async () => {
    window.history.replaceState(null, "", "/editorial/cadastro");
    const fetcher = server(true, manager);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByLabelText("Palavra");
    expect((screen.getByLabelText("Palavra") as HTMLTextAreaElement).readOnly).toBe(true);
    const before = fetcher.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Auxílio" }));
    expect(screen.getByRole("status").textContent).toContain("Peregrino");
    expect(fetcher.mock.calls).toHaveLength(before);
    fireEvent.change(screen.getByLabelText("Reflexão"), { target: { value: "Reflexão preparada" } });
    fireEvent.change(screen.getByLabelText("Sugestão de oração"), { target: { value: "Oração preparada" } });
    await chooseWord();
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toBe("Reflexão preparada");
    expect((screen.getByLabelText("Sugestão de oração") as HTMLTextAreaElement).value).toBe("Oração preparada");
    fireEvent.click(screen.getByRole("button", { name: "Rever seleção na Bíblia" }));
    expect((await screen.findByRole("checkbox", { name: /^Versículo 1:/ })).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Usar trecho no devocional" }));
    await screen.findByLabelText("Palavra");
    fireEvent.click(screen.getByRole("button", { name: "Programar" }));
    const nextMonth = shiftEditorialMonth(dateInZone("America/Sao_Paulo").slice(0, 7), 1);
    const chosenDate = `${nextMonth}-01`;
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Data da leitura" }));
    fireEvent.click(screen.getByRole("option", { name: `01/${nextMonth.slice(5)}/${nextMonth.slice(0, 4)}` }));
    expect((screen.getByLabelText("Fonte e condições de uso") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("Créditos") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("Referência bíblica") as HTMLInputElement).value).toBe("João 1:1");
    expect((screen.getByLabelText("Referência bíblica") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Programar" }));
    await screen.findByText("João 1:1");
    expect(window.location.pathname).toBe("/editorial");
    fireEvent.click(screen.getByRole("link", { name: "Editar existente" }));
    expect((await screen.findByLabelText("Palavra") as HTMLTextAreaElement).value).toBe("1 - Versículo bíblico de teste");
    fireEvent.click(screen.getByRole("button", { name: "Programar" }));
    expect((screen.getByLabelText("Data da leitura") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir / retirar" }));
    fireEvent.change(screen.getByLabelText("Motivo da retirada"), { target: { value: "Revisar publicação" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    await screen.findByText("Devocional retirado.");
    expect(screen.getByText(new RegExp(`${chosenDate} · Retirado`))).toBeDefined();
  });
  it("preserva o formulário quando a data está ocupada", async () => {
    window.history.replaceState(null, "", "/editorial/cadastro");
    server(true, manager, true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByLabelText("Palavra");
    for (const label of ["Reflexão", "Sugestão de oração"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "Texto preservado" } });
    await chooseWord();
    fireEvent.click(screen.getByRole("button", { name: "Programar" }));
    fireEvent.click(screen.getByRole("button", { name: "Programar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Editar existente");
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toBe("Texto preservado");
  });
  it("envia seleção bíblica para Palavra e cancelar retorna sem gravar", async () => {
    window.history.replaceState(null, "", "/biblia");
    const fetcher = server(true, manager);
    render(<StrictMode><LocalApp /></StrictMode>);
    const verse = await screen.findByText("Versículo bíblico de teste");
    fireEvent.click(verse);
    fireEvent.click(screen.getByRole("button", { name: "Enviar para devocional" }));
    expect((await screen.findByLabelText("Palavra") as HTMLTextAreaElement).value).toBe("1 - Versículo bíblico de teste");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await screen.findByText("Versículo bíblico de teste");
    expect(window.location.pathname).toBe("/biblia");
    expect(fetcher.mock.calls.filter(([, options]) => String(options?.body).includes('"schedule"'))).toHaveLength(0);
  });
  it("sai do carregamento na raiz e mostra os perfis ao visitante", async () => {
    server(false);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByRole("button", { name: /Marina Oliveira/ });
    expect(screen.queryByLabelText("Carregando conteúdo")).toBeNull();
    await waitFor(() => expect(window.location.pathname).toBe("/entrar"));
  });
  it("abre a leitura de uma sessão existente", async () => {
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    expect(screen.queryByLabelText("Carregando conteúdo")).toBeNull();
  });
  it("entra com um perfil, mostra leitura e permite sair para selecionar outra conta", async () => {
    const fetcher = server(false);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: /Marina Oliveira/ }));
    await screen.findByText("Leitura integrada de teste");
    await waitFor(() => expect(window.location.pathname).toBe("/devocional"));
    fireEvent.click(screen.getByRole("button", { name: "Sair / trocar perfil" }));
    await screen.findByRole("button", { name: /Marina Oliveira/ });
    expect(screen.queryByText("Leitura integrada de teste")).toBeNull();
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith("session"))).toHaveLength(1);
  });
  it("sai do carregamento e apresenta falha quando a verificação da sessão falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Servidor indisponível")));
    render(<StrictMode><LocalApp /></StrictMode>);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível acessar o banco local");
    expect(screen.queryByLabelText("Carregando conteúdo")).toBeNull();
  });
  it("preserva o destino de uma rota protegida após entrar", async () => {
    window.history.replaceState(null, "", "/comunidade");
    server(false);
    render(<StrictMode><LocalApp /></StrictMode>);
    const enter = await screen.findByRole("button", { name: /Marina Oliveira/ });
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("redirect")).toBe("/comunidade"));
    fireEvent.click(enter);
    await screen.findByRole("heading", { name: /A fé também se vive/ });
    await waitFor(() => expect(window.location.pathname).toBe("/comunidade"));
  });
  it("solicita entrada por código e aguarda aprovação sem abrir a comunidade", async () => {
    window.history.replaceState(null, "", "/comunidade");
    const fetcher = server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: "Entrar com código" }));
    fireEvent.change(screen.getByLabelText("Código de convite"), { target: { value: "ESPERANC" } });
    fireEvent.click(screen.getByRole("button", { name: "Encontrar comunidade" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pedir entrada" }));
    expect(await screen.findByText(/Pedido enviado. Aguarde a aprovação/)).toBeTruthy();
    expect(window.location.pathname).toBe("/comunidade");
    expect(fetcher.mock.calls.some(([, options]) => options?.body && JSON.parse(String(options.body)).action === "joinCommunity")).toBe(true);
  });
  it("navega pelas três áreas com a sessão aberta", async () => {
    server(true);
    render(<StrictMode><LocalApp /></StrictMode>);
    await screen.findByText("Leitura integrada de teste");
    fireEvent.click(screen.getAllByRole("link", { name: "Bíblia" })[0]);
    await screen.findByText("Versículo bíblico de teste");
    fireEvent.click(screen.getAllByRole("link", { name: "Comunidade" })[0]);
    await screen.findByRole("heading", { name: /A fé também se vive/ });
    fireEvent.click(screen.getAllByRole("link", { name: "Devocional" })[0]);
    await screen.findByText("Leitura integrada de teste");
  });
});
