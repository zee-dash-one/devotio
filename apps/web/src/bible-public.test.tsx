import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBibleRepository, alm1911DatasetSchema, dateInZone, type ConnectedEditorial, type ConnectedPublication, type BibleChapter, type BibleCatalog, type BibleReaderRepository, type Watch } from "domain/core";
import { createPreviewRepository } from "domain/preview";
import { App } from "./router";

const books = alm1911DatasetSchema.parse(JSON.parse(readFileSync(resolve("../../docs/bibles/ALM1911.json"), "utf8")));
const catalog: BibleCatalog = { version: "alm1911", books: books.map(({ chapters, ...b }) => ({ ...b, chapters: chapters.length })), verses: 31101, importedAt: null, source: "Almeida 1911 · fonte fornecida" };
function chapter(book: string, number: number): BibleChapter {
  const entry = books.find(b => b.abbrev === book)!;
  return { version: "alm1911", book: catalog.books.find(b => b.abbrev === book)!, chapter: number, verses: entry.chapters[number - 1].map((text, i) => ({ abbrev: book, bookName: entry.name, chapter: number, number: i + 1, text })) };
}
const watch = <T,>(v: T): Watch<T> => next => { next(v); return () => {}; };
beforeEach(() => {
  window.history.replaceState(null, "", "/biblia?book=gn&chapter=1");
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function start(legacy?: BibleReaderRepository, editorial?: ConnectedEditorial) {
  const load = vi.fn(async (path: string): Promise<unknown> => {
    if (path.endsWith("catalog.json")) return catalog;
    if (path.endsWith("search.json")) return [["gn", 1, 1, "principio creou deus ceus terra"]];
    const [, book, n] = path.match(/\/([a-z0-9]+)\/(\d+)\.json$/)!;
    return chapter(book, Number(n));
  });
  const repository = { ...createPreviewRepository(), mode: "live" as const, bible: createBibleRepository({ load }, legacy) };
  render(<App repository={repository} connectedEditorial={editorial} pilotAccess={editorial ? { status: "approved", editorial: true } : undefined} configured loading={false} userKey="public-reader" onLogin={async () => {}} onLogout={async () => {}} />);
  return load;
}
async function settings() {
  fireEvent.click(screen.getByLabelText("Abrir menu da conta"));
  fireEvent.click(screen.getByRole("button", { name: /Configurações/ }));
  fireEvent.click(screen.getByRole("combobox", { name: /Versão da Bíblia/ }));
}
describe("Bíblia na web conectada", () => {
  it("oferece Bíblia nos menus desktop e celular sem o adaptador privado local", async () => {
    window.history.replaceState(null, "", "/devocional");
    start();
    const desktop = within(await screen.findByRole("navigation", { name: "Navegação principal" }));
    const mobile = within(screen.getByRole("navigation", { name: "Navegação no celular" }));
    expect(mobile.getByRole("link", { name: "Bíblia" }).getAttribute("href")).toContain("/biblia");
    fireEvent.click(desktop.getByRole("link", { name: "Bíblia" }));
    await screen.findByText("No principio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.");
    expect(window.location.pathname).toBe("/biblia");
  });
  it("lê ALM1911 sem reading privado, oferece só edição disponível e pesquisa seu texto", async () => {
    localStorage.setItem("devotio:preferences:v1:public-reader", JSON.stringify({ theme: "day", fontSize: 20, mode: "paged", bibleVersion: "aa" }));
    const load = start();
    await screen.findByText("No principio creou Deus os céus e a terra.");
    expect(screen.queryByText("Leitura bíblica em preparação.")).toBeNull();
    await settings();
    expect(screen.queryByRole("option", { name: "Almeida Atualizada (AA)" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /ARC1911/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("devotio:preferences:v1:public-reader")!).bibleVersion).toBe("alm1911"));
    fireEvent.change(screen.getByRole("textbox", { name: /Buscar/ }), { target: { value: "principio" } });
    await screen.findByText("Encontros na Palavra");
    await screen.findByText("Gênesis 1:1");
    expect(load.mock.calls.some(([p]) => p.endsWith("search.json"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à leitura" }));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByText("No principio creou Deus os céus e a terra.")).toBeTruthy();
    expect(screen.queryByText("Um instante de pausa.")).toBeNull();
  });
  it("troca AA por ALM1911, preserva endereço e tema, limpa a seleção e não mistura textos", async () => {
    localStorage.setItem("devotio:preferences:v1:public-reader", JSON.stringify({ theme: "papyrus", fontSize: 24, mode: "paged" }));
    const aaChapter = { ...chapter("gn", 1), version: "aa" as const, verses: [{ ...chapter("gn", 1).verses[0], text: "Texto da AA para teste" }] };
    start({ watchBible: () => watch({ ...catalog, version: "aa" }), watchChapter: () => watch(aaChapter), watchSearch: () => watch({ verses: aaChapter.verses, total: 1, page: 0 }) });
    await screen.findByText("Texto da AA para teste");
    fireEvent.click(screen.getByRole("checkbox", { name: /Versículo 1:/ }));
    await settings();
    fireEvent.click(screen.getByRole("option", { name: /ARC1911/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await screen.findByText("No principio creou Deus os céus e a terra.");
    expect(screen.queryByText("Texto da AA para teste")).toBeNull();
    expect(screen.queryByLabelText("Ações dos versículos selecionados")).toBeNull();
    expect(window.location.search).toContain("book=gn");
    expect(window.location.search).toContain("chapter=1");
    expect(document.documentElement.dataset.theme).toBe("papyrus");
    await waitFor(() => expect(JSON.parse(localStorage.getItem("devotio:preferences:v1:public-reader")!)).toMatchObject({ theme: "papyrus", fontSize: 24, bibleVersion: "alm1911" }));
  });
});

describe("cadastro editorial publicado", () => {
  const date = dateInZone("America/Sao_Paulo");
  function service(entry?: ConnectedPublication): ConnectedEditorial {
    return { list: vi.fn(async () => ({ entries: entry ? [entry] : [], cursor: null })), get: vi.fn(async () => entry ?? null),
      calendar: vi.fn(async () => ({ dates: [date], credit: "Editor autenticado" })), save: vi.fn(async () => {}), withdraw: vi.fn(async () => {}) };
  }
  async function openNew(editorial: ConnectedEditorial) {
    window.history.replaceState(null, "", "/editorial"); start(undefined, editorial);
    fireEvent.click(await screen.findByRole("link", { name: "Cadastrar devocional" }));
    await screen.findByDisplayValue("Editor autenticado");
    fireEvent.click(screen.getByRole("combobox", { name: "Data da leitura" }));
    fireEvent.click(screen.getByRole("option", { name: date.split("-").reverse().join("/") }));
  }
  it("preserva formulário na ida/volta à Bíblia e salva apenas seleção, data e textos", async () => {
    const editorial = service(); await openNew(editorial);
    expect((screen.getByLabelText("Créditos") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("Texto bíblico") as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByLabelText(/Motivo/)).toBeNull();
    expect((screen.getByLabelText(/Disponível a partir/) as HTMLInputElement).value).toContain("00:00");
    fireEvent.change(screen.getByLabelText("Reflexão"), { target: { value: "Reflexão preservada" } });
    fireEvent.change(screen.getByLabelText("Sugestão de oração"), { target: { value: "Oração preservada" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Tradução" }));
    expect(screen.queryByRole("option", { name: /Atualizada/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /ARC1911/ }));
    fireEvent.click(screen.getByRole("button", { name: "Alternar para leitura bíblica" }));
    await screen.findByText("No principio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.");
    fireEvent.click(screen.getByRole("checkbox", { name: /Versículo 1:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Usar trecho no devocional" }));
    await screen.findByLabelText("Reflexão");
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toBe("Reflexão preservada");
    expect((screen.getByLabelText("Texto bíblico") as HTMLTextAreaElement).value).toContain("1 - No principio era o Verbo");
    fireEvent.click(screen.getByRole("button", { name: "Salvar publicação" }));
    await screen.findByRole("heading", { name: "Gestão editorial" });
    expect(editorial.save).toHaveBeenCalledWith({ date, reflection: "Reflexão preservada", prayerSuggestion: "Oração preservada", mode: "create", reason: undefined,
      selection: { book: "jo", chapter: 1, first: 1, last: 1, verses: [1], version: "alm1911" } });
  });
  it("impede texto acima de 512 e preserva campos quando a gravação falha", async () => {
    const editorial = service(); await openNew(editorial);
    fireEvent.change(screen.getByLabelText("Reflexão"), { target: { value: "R".repeat(513) } });
    fireEvent.change(screen.getByLabelText("Sugestão de oração"), { target: { value: "Oração" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar publicação" }));
    expect((await screen.findByRole("alert")).textContent).toContain("512");
    expect(editorial.save).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toHaveLength(513);
  });
  it("preserva conteúdo legado ao editar e exige justificativa sem trocar autoria", async () => {
    const entry: ConnectedPublication = { id: "old", date, reference: "Referência original", translation: "AA histórica", scripture: "Texto original",
      reflection: "R".repeat(700), prayerSuggestion: "Oração original", credit: "Autor original", licenseEvidence: "Fonte original", publishedAt: 1, withdrawn: false };
    const editorial = service(entry);
    window.history.replaceState(null, "", `/editorial/cadastro?date=${date}`); start(undefined, editorial);
    await screen.findByDisplayValue("Autor original");
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toHaveLength(700);
    expect((screen.getByLabelText("Data da leitura") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText("Reflexão"), { target: { value: "Reflexão reduzida" } });
    fireEvent.change(screen.getByLabelText("Motivo da correção"), { target: { value: "Adequar texto" } });
    vi.mocked(editorial.save).mockRejectedValue(new Error("Falha de conexão. Tente novamente."));
    fireEvent.click(screen.getByRole("button", { name: "Salvar publicação" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Falha de conexão");
    expect((screen.getByLabelText("Reflexão") as HTMLTextAreaElement).value).toBe("Reflexão reduzida");
    expect((screen.getByLabelText("Texto bíblico") as HTMLTextAreaElement).value).toBe("Texto original");
    expect(editorial.save).toHaveBeenCalledWith({ date, reflection: "Reflexão reduzida", prayerSuggestion: "Oração original", reason: "Adequar texto", mode: "update", selection: undefined });
  });
});
