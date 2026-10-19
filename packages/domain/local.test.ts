import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalRepository, localSession, type LocalCacheStorage, type LocalCache } from "./local";
import { recentDates, type BibleChapter, type Favorite } from "./reading";
import type { HomeData, Watch } from "./types";
import type { LocalQuery } from "./validators/local";

const date = "2026-10-05";
const fixture: Favorite = { favoritedAt: 1, devotional: { id: "one", date, reference: "Teste", translation: "AA", scripture: "Cópia privada", reflection: "Teste", prayerSuggestion: "Teste", credit: "Fixture" } };
const home = (day: string): HomeData => ({ user: { id: "marina", name: "Marina" }, devotional: { ...fixture.devotional, id: day, date: day }, settings: null });
const book = { abbrev: "jo", name: "João", chapters: 21, testament: "NT" as const, order: 43 };
const chapter = (number: number): BibleChapter => ({ book, chapter: number, verses: [{ abbrev: "jo", bookName: "João", chapter: number, number: 1, text: "Texto de teste" }] });
const dispose: (() => void)[] = [];
afterEach(() => { dispose.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); vi.useRealTimers(); });
function storage(initial?: LocalCache) {
  let value: unknown = initial;
  const adapter: LocalCacheStorage = {
    read: () => value,
    write: vi.fn(data => { value = JSON.parse(JSON.stringify(data)); }),
    clear: vi.fn(() => { value = undefined; }),
  };
  return adapter;
}
function setup(mirror = storage()) {
  let now = new Date(date + "T15:00:00Z");
  const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
    if (options?.body) return new Response("null");
    const input = JSON.parse(new URL(path, "http://localhost").searchParams.get("input")!) as LocalQuery;
    let value: unknown;
    switch (input.query) {
      case "notificationSummary": value = { unread: 1, revision: 1 }; break;
      case "notifications": value = { items: [], nextCursor: null }; break;
      case "devotionals": value = Object.fromEntries(input.dates.map(d => [d, home(d)])); break;
      case "reading": value = { dates: recentDates(now.toISOString().slice(0, 10)), favorites: [fixture] }; break;
      case "chapter": value = chapter(input.chapter); break;
      case "bible": value = { books: [book], version: "aa", verses: 1, importedAt: 1, source: "fixture" }; break;
      case "community": value = { community: { id: input.id }, members: [], messages: [], lists: [{ id: "list", items: [{ id: "tick" }] }] }; break;
      default: value = [];
    }
    return new Response(JSON.stringify(value));
  });
  vi.stubGlobal("fetch", fetcher);
  const expired = vi.fn();
  const connect = () => {
    const connection = createLocalRepository(mirror, expired, "marina", { timeZone: "UTC", now: () => now });
    dispose.push(connection.dispose); return connection;
  };
  const connection = connect();
  const calls = () => fetcher.mock.calls.filter(([, options]) => !options?.body).map(([path]) => JSON.parse(new URL(path, "http://localhost").searchParams.get("input")!) as LocalQuery);
  return { ...connection, connect, mirror, fetcher, expired, calls, advance: (days: number) => { now = new Date(now.getTime() + days * 86400000); } };
}
async function once<T>(watch: Watch<T>): Promise<T> {
  let stop = () => {};
  const value = await new Promise<T>((resolve, reject) => { stop = watch(resolve, reject); });
  stop(); await Promise.resolve(); return value;
}

describe("invalidação de rascunhos", () => {
  it("gravar um destino atualiza somente rascunhos observados dele, sem recarregar capítulos ou outro mural", async () => {
    const state = setup(), sharing = state.repository.sharing!;
    const stops = [sharing.watchDrafts("esperanca")(() => {}, () => {}), sharing.watchDrafts("caminho")(() => {}, () => {}), state.repository.watchCommunity("esperanca", null)(() => {}, () => {}), state.repository.reading!.watchChapter("jo", 1)(() => {}, () => {})];
    dispose.push(...stops);
    await vi.waitFor(() => expect(state.calls()).toHaveLength(4));
    const before = state.calls().length;
    await sharing.updateDraft("esperanca", "3537e982-5116-45df-95d9-c2c9f7f1cbbf", { book: "jo", chapter: 1, first: 1, last: 1, version: "aa" }, "Comentário");
    expect(state.calls().slice(before)).toEqual([{ query: "quoteDrafts", id: "esperanca" }]);
  });
});
describe("janela bíblica antecipada", () => {
  it("deduplica vizinhos e avançar consulta somente o novo capítulo", async () => {
    const app = setup(), reading = app.repository.reading!;
    await once(reading.watchChapter("jo", 3));
    await Promise.all([once(reading.watchChapter("jo", 2, true)), once(reading.watchChapter("jo", 4, true)), once(reading.watchChapter("jo", 4, true))]);
    expect(app.calls().filter(call => call.query === "chapter")).toHaveLength(3);
    await once(reading.watchChapter("jo", 4));
    await Promise.all([once(reading.watchChapter("jo", 3, true)), once(reading.watchChapter("jo", 5, true))]);
    expect(app.calls().filter(call => call.query === "chapter")).toHaveLength(4);
    expect((app.mirror.read() as LocalCache).chapterVisits).toEqual(["jo:4", "jo:3"]);
  });
  it("não acumula capítulos, conserva visitas em vez de promover antecipações e reabre sem rede", async () => {
    const app = setup(), reading = app.repository.reading!;
    for (let number = 3; number <= 9; number++) {
      await once(reading.watchChapter("jo", number));
      await Promise.all([once(reading.watchChapter("jo", number - 1, true)), once(reading.watchChapter("jo", number + 1, true))]);
      expect((app.mirror.read() as LocalCache).chapters.length).toBeLessThanOrEqual(6);
    }
    const cache = app.mirror.read() as LocalCache;
    expect(cache.chapters.map(value => value.chapter)).toEqual(expect.arrayContaining([8, 9, 10, 7, 6, 5]));
    expect(cache.chapterVisits).not.toContain("jo:10");
    const before = app.calls().length;
    app.dispose(); const reopened = app.connect();
    await once(reopened.repository.reading!.watchChapter("jo", 6));
    expect(app.calls()).toHaveLength(before);
  });
  it("não solicita capítulo fora da janela por antecipação", async () => {
    const app = setup(), reading = app.repository.reading!;
    await once(reading.watchChapter("jo", 1));
    expect(await once(reading.watchChapter("jo", 0, true))).toBeNull();
    expect(await once(reading.watchChapter("jo", 20, true))).toBeNull();
    expect(app.calls().filter(call => call.query === "chapter")).toHaveLength(1);
  });
});
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

describe("cache local: orçamento de rede e persistência", () => {
  it("SSE atualiza o contador sem HTTP e só recarrega a página de avisos observada", async () => {
    const app = setup(), next = vi.fn(), page = vi.fn();
    const stop = app.repository.notifications!.watchSummary()(next, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith({ unread: 1, revision: 1 }));
    app.fetcher.mockClear();
    await app.acceptNotificationEvent({ unread: 2, revision: 2 });
    expect(next).toHaveBeenLastCalledWith({ unread: 2, revision: 2 });
    expect(app.fetcher).not.toHaveBeenCalled();
    const stopPage = app.repository.notifications!.watchPage(null)(page, vi.fn());
    await vi.waitFor(() => expect(page).toHaveBeenCalled()); app.fetcher.mockClear();
    await app.acceptNotificationEvent({ unread: 3, revision: 3 });
    expect(app.calls()).toEqual([{ query: "notifications", cursor: null }]);
    app.fetcher.mockClear(); await app.acceptNotificationEvent({ unread: 3, revision: 3 });
    expect(app.fetcher).not.toHaveBeenCalled(); stop(); stopPage();
    app.dispose(); await app.acceptNotificationEvent({ unread: 4, revision: 4 });
    expect(next).toHaveBeenLastCalledWith({ unread: 3, revision: 3 });
  });
  it("reutiliza busca parcial em memória sem ultrapassar o limite de capítulos", async () => {
    const app = setup(); app.fetcher.mockResolvedValue(new Response(JSON.stringify({ verses: [], total: 0, page: 0 })));
    await once(app.repository.reading!.watchSearch("amor", 0));
    await once(app.repository.reading!.watchSearch("amor", 0));
    expect(app.fetcher).toHaveBeenCalledTimes(1);
    expect((app.mirror.read() as LocalCache | undefined)?.chapters ?? []).toHaveLength(0);
  });
  it("o calendário padrão só acrescenta um dia à meia-noite de Brasília", async () => {
    const app = setup(); app.dispose();
    let now = new Date("2026-10-05T02:59:00Z");
    const connection = createLocalRepository(storage(), vi.fn(), "marina", { now: () => now });
    dispose.push(connection.dispose);
    await once(connection.repository.watchHome("2026-10-04"));
    expect(app.calls()).toEqual([{ query: "devotionals", dates: recentDates("2026-10-04"), timeZone: "America/Sao_Paulo" }]);
    now = new Date("2026-10-05T03:00:00Z");
    await connection.checkDay();
    await once(connection.repository.watchHome("2026-10-05"));
    expect(app.calls().at(-1)).toEqual({ query: "devotionals", dates: ["2026-10-05"], timeZone: "America/Sao_Paulo" });
    expect(app.calls()).toHaveLength(2);
  });
  it("baixa os oito dias em um lote, compartilha assinaturas e não consulta durante ociosidade", async () => {
    const app = setup(), next = vi.fn();
    const first = app.repository.watchHome(date)(next, vi.fn());
    const second = app.repository.watchHome(date)(next, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(2));
    expect(app.calls()).toEqual([{ query: "devotionals", dates: recentDates(date), timeZone: "UTC" }]);
    expect(app.fetcher.mock.calls[0][1]?.headers).toMatchObject({ "X-Devotio-Profile": "marina" });
    vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(600_000);
    expect(app.fetcher).toHaveBeenCalledTimes(1);
    first(); second();
    for (const day of recentDates(date)) expect((await once(app.repository.watchHome(day))).devotional?.date).toBe(day);
    expect(app.fetcher).toHaveBeenCalledTimes(1);
    app.dispose();
    const reopened = app.connect(); await once(reopened.repository.watchHome(date));
    expect(app.fetcher).toHaveBeenCalledTimes(1);
    expect(Object.keys((app.mirror.read() as LocalCache).homes)).toHaveLength(8);
  });
  it("na virada solicita só um dia e remove o mais antigo, sem recarregar favoritos", async () => {
    const app = setup(), next = vi.fn();
    const stop = app.repository.watchHome(date)(next, vi.fn());
    const reading = vi.fn(); const stopReading = app.repository.reading!.watchReading()(reading, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    await vi.waitFor(() => expect(reading).toHaveBeenCalled());
    app.fetcher.mockClear(); app.advance(1); await app.checkDay();
    expect(app.calls()).toEqual([{ query: "devotionals", dates: ["2026-10-06"], timeZone: "UTC" }]);
    expect(reading.mock.lastCall?.[0].dates).toEqual(recentDates("2026-10-06"));
    expect(Object.keys((app.mirror.read() as LocalCache).homes)).toEqual(expect.arrayContaining(recentDates("2026-10-06")));
    expect((app.mirror.read() as LocalCache).homes["2026-09-28"]).toBeUndefined();
    await app.checkDay(); expect(app.fetcher).toHaveBeenCalledTimes(1);
    stop(); stopReading();
  });
  it("recupera só os dias faltantes após ausência e limita a janela a oito", async () => {
    const app = setup(); await once(app.repository.watchHome(date)); app.dispose();
    app.advance(3); const reopened = app.connect(); await once(reopened.repository.watchHome("2026-10-08"));
    expect(app.calls().at(-1)).toMatchObject({ dates: ["2026-10-08", "2026-10-07", "2026-10-06"] });
    reopened.dispose(); app.advance(10); const later = app.connect(); await once(later.repository.watchHome("2026-10-18"));
    expect(app.calls().at(-1)).toMatchObject({ dates: recentDates("2026-10-18") });
    expect(Object.keys((app.mirror.read() as LocalCache).homes)).toHaveLength(8);
  });
  it("mantém seis capítulos LRU, reutiliza visita e persiste após reabrir", async () => {
    const app = setup();
    for (let n = 1; n <= 6; n++) await once(app.repository.reading!.watchChapter("jo", n));
    await once(app.repository.reading!.watchChapter("jo", 1));
    expect(app.fetcher).toHaveBeenCalledTimes(6);
    await once(app.repository.reading!.watchChapter("jo", 7));
    expect((app.mirror.read() as LocalCache).chapters.map(c => c.chapter)).toEqual([7, 1, 6, 5, 4, 3]);
    app.dispose(); const reopened = app.connect(); await once(reopened.repository.reading!.watchChapter("jo", 1));
    expect(app.fetcher).toHaveBeenCalledTimes(7);
    await once(reopened.repository.reading!.watchChapter("jo", 2));
    expect(app.fetcher).toHaveBeenCalledTimes(8);
  });
  it("guarda catálogo e deduplica um mesmo capítulo em voo", async () => {
    const app = setup();
    await Promise.all([once(app.repository.reading!.watchBible()), once(app.repository.reading!.watchChapter("jo", 1)), once(app.repository.reading!.watchChapter("jo", 1))]);
    expect(app.fetcher).toHaveBeenCalledTimes(2);
    app.dispose(); const reopened = app.connect();
    await once(reopened.repository.reading!.watchBible()); expect(app.fetcher).toHaveBeenCalledTimes(2);
  });
  it("consulta favoritos uma vez por abertura e invalida só favoritos após salvar", async () => {
    const app = setup();
    const stopHome = app.repository.watchHome(date)(vi.fn(), vi.fn());
    const stopBible = app.repository.reading!.watchChapter("jo", 1)(vi.fn(), vi.fn());
    const next = vi.fn(); const stop = app.repository.reading!.watchReading()(next, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect((app.mirror.read() as LocalCache).favorites).toEqual([fixture]);
    app.fetcher.mockClear(); await app.repository.reading!.setFavorite(date, true);
    expect(app.calls()).toEqual([{ query: "reading", timeZone: "UTC" }]);
    expect(app.fetcher).toHaveBeenCalledTimes(2); stop(); stopHome(); stopBible();
  });
  it("uma marcação atualiza somente o grupo correspondente", async () => {
    const app = setup();
    const stops = [app.repository.watchHome(date)(vi.fn(), vi.fn()), app.repository.watchCommunities()(vi.fn(), vi.fn()), app.repository.watchCommunity("esperanca", null)(vi.fn(), vi.fn())];
    await vi.waitFor(() => expect(app.fetcher).toHaveBeenCalledTimes(3)); await flush();
    app.fetcher.mockClear(); await app.repository.setTick("tick", true);
    expect(app.calls()).toEqual([{ query: "community", id: "esperanca", cursor: null }]); stops.forEach(stop => stop());
  });
  it("restaurar favorito valida recibo e atualiza somente favoritos", async () => {
    const app = setup();
    const stops = [app.repository.watchHome(date)(vi.fn(), vi.fn()), app.repository.reading!.watchReading()(vi.fn(), vi.fn()), app.repository.reading!.watchChapter("jo", 1)(vi.fn(), vi.fn())];
    await vi.waitFor(() => expect(app.calls()).toHaveLength(3));
    app.fetcher.mockClear();
    await app.repository.reading!.restoreFavorite("3537e982-5116-45df-95d9-c2c9f7f1cbbf");
    expect(app.calls()).toEqual([{ query: "reading", timeZone: "UTC" }]);
    expect(app.fetcher).toHaveBeenCalledTimes(2);
    await expect(app.repository.reading!.restoreFavorite("inválido")).rejects.toThrow();
    expect(app.fetcher).toHaveBeenCalledTimes(2);
    stops.forEach(stop => stop());
  });
  it("consulta comunidades novamente ao reentrar e nunca as persiste", async () => {
    const app = setup(); await once(app.repository.watchCommunities()); await once(app.repository.watchCommunities());
    expect(app.fetcher).toHaveBeenCalledTimes(2);
    expect(app.mirror.read()).toBeUndefined();
  });
  it("lembra dias sem publicação sem repetir consultas e permite atualização explícita", async () => {
    const app = setup();
    app.fetcher.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.body) return new Response("null");
      const input = JSON.parse(new URL(path, "http://localhost").searchParams.get("input")!) as Extract<LocalQuery, { query: "devotionals" }>;
      return new Response(JSON.stringify(Object.fromEntries(input.dates.map(day => [day, { ...home(day), devotional: null }]))));
    });
    const next = vi.fn(); const stop = app.repository.watchHome(date)(next, vi.fn());
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    await once(app.repository.watchHome(date)); expect(app.fetcher).toHaveBeenCalledTimes(1);
    await app.repository.refresh!(); expect(app.fetcher).toHaveBeenCalledTimes(2); stop();
  });
  it("retirada editorial recarrega somente sua data e preserva snapshot", async () => {
    const app = setup(), next = vi.fn();
    const stop = app.repository.watchHome(date)(next, vi.fn());
    await once(app.repository.reading!.watchReading()); await vi.waitFor(() => expect(next).toHaveBeenCalled());
    app.fetcher.mockClear(); await app.repository.reading!.withdraw(date, "Teste");
    expect(app.calls()).toEqual([{ query: "devotionals", dates: [date], timeZone: "UTC" }]);
    expect((app.mirror.read() as LocalCache).favorites).toEqual([fixture]); stop();
  });
  it("programação invalida só a data e editorial, reutilizando capítulos e grupos", async () => {
    const app = setup(), next = vi.fn();
    const stop = app.repository.watchHome(date)(next, vi.fn());
    await once(app.repository.reading!.watchChapter("jo", 1));
    await once(app.repository.reading!.watchEditorial());
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    app.fetcher.mockClear();
    await app.repository.reading!.schedule({ mode: "update", date, reference: "João 1:1", scripture: "Palavra", reflection: "Meditação", prayerSuggestion: "Oração", licenseEvidence: "Fonte de teste", reason: "Correção do texto" });
    await once(app.repository.reading!.watchChapter("jo", 1));
    expect(app.calls()).toEqual([{ query: "devotionals", dates: [date], timeZone: "UTC" }]);
    stop();
  });
});

describe("fronteira de sessão e recuperação", () => {
  it("deduplica verificação inicial de sessão", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ profile: null, profiles: [], expiresAt: null })));
    vi.stubGlobal("fetch", fetcher); await Promise.all([localSession(), localSession()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("lê cache sem rede, mas 401 limpa tudo e encerra a sessão", async () => {
    const app = setup(); await once(app.repository.watchHome(date)); await once(app.repository.reading!.watchChapter("jo", 1)); await once(app.repository.reading!.watchReading());
    app.dispose(); const reopened = app.connect();
    app.fetcher.mockRejectedValue(new TypeError("offline"));
    expect((await once(reopened.repository.watchHome(date))).devotional?.date).toBe(date);
    expect((await once(reopened.repository.reading!.watchChapter("jo", 1)))?.chapter).toBe(1);
    expect(await once(reopened.repository.reading!.watchReading())).toMatchObject({ dates: recentDates(date), favorites: [fixture], offline: true });
    app.fetcher.mockResolvedValue(new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401 }));
    const next = vi.fn(); const stop = reopened.repository.watchCommunities()(next, vi.fn());
    await vi.waitFor(() => expect(app.expired).toHaveBeenCalled());
    expect(next).not.toHaveBeenCalled(); expect(app.mirror.read()).toBeUndefined(); stop();
  });
  it("descarta respostas em voo após desmontagem, sem repovoar cache após logout", async () => {
    const app = setup(); let finish!: (response: Response) => void;
    app.fetcher.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const next = vi.fn(); const stop = app.repository.watchHome(date)(next, vi.fn());
    app.dispose(); app.mirror.clear(); finish(new Response(JSON.stringify({ [date]: home(date) })));
    await flush(); stop(); expect(next).not.toHaveBeenCalled(); expect(app.mirror.write).not.toHaveBeenCalled();
  });
  it("ignora cache corrompido, versão antiga e dados de outro perfil", async () => {
    for (const value of [{ broken: true }, { version: 0 }, { version: 1, owner: "ester", day: date, homes: { [date]: home(date) }, favorites: [fixture], chapters: [] }]) {
      const mirror = storage(); mirror.read = () => value;
      const app = setup(mirror); await once(app.repository.watchHome(date));
      expect(app.calls()).toHaveLength(1); app.dispose();
    }
  });
  it("continua em memória e avisa quando o armazenamento está cheio", async () => {
    const mirror = storage(); mirror.write = () => { throw new Error("quota"); };
    const app = setup(mirror); await once(app.repository.watchHome(date)); await once(app.repository.watchHome(date));
    expect(app.fetcher).toHaveBeenCalledTimes(1);
    expect((await once(app.repository.reading!.watchReading())).storageWarning).toContain("navegador");
  });
  it("expira pelo relógio local sem consultar a sessão nem conservar dados", async () => {
    const app = setup(); await once(app.repository.watchHome(date)); app.dispose();
    const expired = vi.fn();
    const connection = createLocalRepository(app.mirror, expired, "marina", { now: () => new Date("2026-11-06T00:00:00Z"), sessionExpiresAt: Date.parse("2026-11-05T00:00:00Z") });
    dispose.push(connection.dispose); app.fetcher.mockClear(); await connection.checkDay();
    expect(expired).toHaveBeenCalledTimes(1); expect(app.fetcher).not.toHaveBeenCalled(); expect(app.mirror.read()).toBeUndefined();
  });
  it("uma atualização manual sem rede preserva as leituras e informa a falha", async () => {
    const app = setup(); await once(app.repository.watchHome(date));
    app.fetcher.mockRejectedValue(new TypeError("offline"));
    await expect(app.repository.refresh!()).rejects.toThrow("offline");
    expect((app.mirror.read() as LocalCache).homes[date].devotional?.date).toBe(date);
    expect((await once(app.repository.watchHome(date))).devotional?.date).toBe(date);
  });
  it("uma resposta iniciada antes da virada não reintroduz datas vencidas", async () => {
    const app = setup(); let finish!: (response: Response) => void;
    app.fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const pending = once(app.repository.watchHome(date));
    app.advance(1); const rollover = app.checkDay();
    finish(new Response(JSON.stringify(Object.fromEntries(recentDates(date).map(day => [day, home(day)])))));
    await pending; await rollover;
    expect(Object.keys((app.mirror.read() as LocalCache).homes).sort()).toEqual(recentDates("2026-10-06").sort());
  });
});
