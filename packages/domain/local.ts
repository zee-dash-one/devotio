import type { Repository, Watch, HomeData, Community, CommunityDetail } from "./types";
import { dateInZone, recentDates, type LocalProfile, type ReadingData, type BibleCatalog, type BibleChapter, type BibleResults, type EditorialEntry } from "./reading";
import { localCommandSchema, localQuerySchema, type LocalCommand, type LocalQuery } from "./validators/local";
import { localCacheSchema, type LocalCache, type LocalCacheStorage } from "./local-cache";
import { notificationSummarySchema, type NotificationSummary, type NotificationPage, type CommunityQuoteDraft } from "./sharing";
import { chapterWindow } from "./preferences";
import type { FriendsData, SharePage, ShareMarker } from "./social";
export type { LocalCacheStorage, LocalCache } from "./local-cache";

export async function localRequest<T>(path: string, body?: unknown, profileId?: string): Promise<T> {
  const response = await fetch("/__local/" + path, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(profileId ? { "X-Devotio-Profile": profileId } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error ?? "Não foi possível acessar o servidor local."), { status: response.status });
  return value as T;
}
export interface LocalSession { profile: LocalProfile | null; profiles: LocalProfile[]; expiresAt: number | null }
let sessionRequest: Promise<LocalSession> | undefined;
// Deduplicate React StrictMode/bootstrap callers, without caching identity indefinitely.
export function localSession() {
  return sessionRequest ??= localRequest<LocalSession>("session").finally(() => { sessionRequest = undefined; });
}
export function localLogin(profileId: string) { return localRequest<{ profile: LocalProfile; expiresAt: number }>("command", localCommandSchema.parse({ action: "login", profileId })); }
export function localLogout() { return localRequest<null>("command", { action: "logout" }); }
interface Observer { next(value: unknown): void; error(error: Error): void }
interface Entry { observers: Set<Observer>; value?: unknown; ready: boolean; revision: number; pending?: Promise<void>; emit(): Promise<void> }
interface Options { now?: () => Date; timeZone?: string; sessionExpiresAt?: number; onStorageWarning?: (message: string) => void }
export function createLocalRepository(storage: LocalCacheStorage, onExpired: () => void, profileId: string, options: Options = {}) {
  const now = options.now ?? (() => new Date());
  const timeZone = options.timeZone ?? "America/Sao_Paulo";
  const today = () => dateInZone(timeZone, now());
  const empty = (): LocalCache => ({ version: 1, owner: profileId, day: today(), homes: {}, favorites: [], chapters: [] });
  let cache = empty(), disposed = false, revision = 0, storageWarning: string | undefined;
  try { const parsed = localCacheSchema.safeParse(storage.read()); if (parsed.success && parsed.data.owner === profileId) cache = parsed.data; } catch { /* Start in memory if storage is unavailable. */ }
  const entries = new Map<string, Entry>();
  const requests = new Map<string, Promise<unknown>>();
  const dirtyDates = new Set<string>();
  const searchCache = new Map<string, BibleResults>();
  let notificationSummary: NotificationSummary | undefined;
  let observedDay = today();
  let windowRequest: Promise<void> | undefined;
  let favoritesRequest: Promise<ReadingData> | undefined;
  let reading: ReadingData | undefined;
  function persist() {
    if (disposed) return;
    try { storage.write(cache); }
    catch {
      storageWarning = "Não foi possível guardar as leituras neste navegador. Elas continuam disponíveis enquanto esta página estiver aberta.";
      options.onStorageWarning?.(storageWarning);
    }
  }
  function expire() {
    if (disposed) return;
    disposed = true; entries.clear(); requests.clear(); cache = empty();
    try { storage.clear(); } finally { onExpired(); }
  }
  async function query<T>(input: LocalQuery): Promise<T> {
    const key = JSON.stringify(localQuerySchema.parse(input));
    let request = requests.get(key);
    if (!request) {
      request = localRequest<T>("query?input=" + encodeURIComponent(key), undefined, profileId).catch(error => {
        if ((error as { status?: number })?.status === 401) expire();
        throw error;
      });
      requests.set(key, request);
      void request.finally(() => { if (requests.get(key) === request) requests.delete(key); }).catch(() => {});
    }
    return request as Promise<T>;
  }
  function reconcileDay() {
    const day = today(), dates = recentDates(day);
    const changed = cache.day !== day;
    cache.day = day;
    for (const date of Object.keys(cache.homes)) {
      if (!dates.includes(date)) { delete cache.homes[date]; dirtyDates.delete(date); }
      else if (changed && !cache.homes[date].devotional) dirtyDates.add(date);
    }
    if (changed) { revision++; persist(); }
    return changed;
  }
  reconcileDay();
  async function loadWindow(): Promise<void> {
    reconcileDay();
    if (windowRequest) { await windowRequest; return loadWindow(); }
    const dates = recentDates(today()).filter(date => !Object.hasOwn(cache.homes, date) || dirtyDates.has(date));
    if (!dates.length) return;
    const started = revision;
    windowRequest = query<Record<string, HomeData>>({ query: "devotionals", dates, timeZone }).then(homes => {
      if (!disposed && started === revision) {
        for (const date of dates) if (Object.hasOwn(homes, date)) { cache.homes[date] = homes[date]; dirtyDates.delete(date); }
        persist();
      }
    }).finally(() => { windowRequest = undefined; });
    await windowRequest;
    if (!disposed && started !== revision) await loadWindow();
  }
  async function home(date: string): Promise<HomeData> {
    try { await loadWindow(); }
    catch (error) {
      if (disposed || (error as { status?: number })?.status || !cache.homes[date]) throw error;
    }
    const value = cache.homes[date];
    if (!value) throw new Error("Esta leitura não está guardada no dispositivo.");
    return value;
  }
  async function readFavorites(): Promise<ReadingData> {
    reconcileDay();
    if (reading) return { ...reading, dates: recentDates(today()), storageWarning };
    if (!favoritesRequest) {
      favoritesRequest = query<ReadingData>({ query: "reading", timeZone }).then(data => {
        if (!disposed) { cache.favorites = data.favorites; persist(); reading = data; }
        return { ...data, storageWarning };
      }).catch(error => {
        if (!disposed && !(error as { status?: number })?.status) return { dates: recentDates(today()), favorites: cache.favorites, offline: true, storageWarning };
        throw error;
      }).finally(() => { favoritesRequest = undefined; });
    }
    return favoritesRequest;
  }
  // Shared observers make shell + reader and StrictMode use one request. No network timers.
  const watch = <T>(key: string, read: () => Promise<T>): Watch<T> => (next, error) => {
    if (disposed) return () => {};
    let entry = entries.get(key);
    if (!entry) {
      const created: Entry = {
        observers: new Set(), ready: false, revision: 0,
        async emit() {
          if (created.pending) return created.pending;
          if (disposed || !created.observers.size) return;
          const started = created.revision;
          created.pending = (async () => {
            try {
              const value = await read();
              if (!disposed && started === created.revision) {
                created.value = value; created.ready = true;
                created.observers.forEach(observer => observer.next(value));
              }
            } catch (e) {
              if (!disposed && started === created.revision) created.observers.forEach(observer => observer.error(e instanceof Error ? e : new Error("Falha na conexão local.")));
            } finally { created.pending = undefined; }
          })();
          await created.pending;
          if (!disposed && started !== created.revision) await created.emit();
        },
      };
      entries.set(key, created); entry = created;
    }
    const observer: Observer = { next: value => next(value as T), error };
    entry.observers.add(observer);
    if (entry.ready) next(entry.value as T); else void entry.emit();
    const current = entry;
    return () => {
      current.observers.delete(observer);
      queueMicrotask(() => {
        if (!current.observers.size && entries.get(key) === current) entries.delete(key);
      });
    };
  };
  async function invalidate(matches: (key: string) => boolean) {
    await Promise.all([...entries].filter(([key]) => matches(key)).map(async ([, entry]) => {
      entry.ready = false; entry.revision++; await entry.emit();
    }));
  }
  async function afterCommand(input: LocalCommand, result: unknown) {
    switch (input.action) {
      case "governance":
        await invalidate(key => key.startsWith("governance:") || key === "communities" || key.startsWith("community:")); break;
      case "social": await invalidate(key => key.startsWith("social:")); break;
      case "publish": case "schedule": case "withdraw": {
        const date = input.action === "withdraw" ? input.date : input.input.date;
        revision++; delete cache.homes[date]; dirtyDates.add(date); persist();
        await invalidate(key => key === "editorial" || key === "home:" + date); break;
      }
      case "setFavorite": case "restoreFavorite": reading = undefined; await favoritesRequest; reading = undefined; await invalidate(key => key === "reading"); break;
      case "createCommunity": case "joinCommunity":
        await invalidate(key => key.startsWith("governance:") || key === "communities" || key.startsWith("community:" + String(result) + ":")); break;
      case "readNotification": await acceptNotificationEvent(result); break;
      case "saveQuoteDrafts": await invalidate(key => input.ids.some(id => key === "drafts:" + id)); break;
      case "updateQuoteDraft": case "deleteQuoteDraft": case "publishQuoteDraft":
        await invalidate(key => key === "drafts:" + input.id || (input.action === "publishQuoteDraft" && key.startsWith("community:" + input.id + ":"))); break;
      case "sendQuote": case "sendMessage": case "createChecklist": case "updateScripture": case "removeMember":
        await invalidate(key => key.startsWith("community:" + input.id + ":") || (input.action === "removeMember" && (key === "communities" || key.startsWith("governance:")))); break;
      case "setTick":
        await invalidate(key => {
          const detail = entries.get(key)?.value as CommunityDetail | undefined;
          return key.startsWith("community:") && !!detail?.lists.some(list => list.items.some(item => item.id === input.itemId));
        }); break;
    }
  }
  async function acceptNotificationEvent(value: unknown) {
    const parsed = notificationSummarySchema.safeParse(value);
    if (disposed || !parsed.success || (notificationSummary && parsed.data.revision <= notificationSummary.revision)) return;
    notificationSummary = parsed.data;
    const entry = entries.get("notifications:summary");
    if (entry) { entry.revision++; entry.value = notificationSummary; entry.ready = true; entry.observers.forEach(observer => observer.next(notificationSummary)); }
    await invalidate(key => key.startsWith("notifications:page:"));
    await invalidate(key => key.startsWith("social:"));
  }
  async function command<T>(input: LocalCommand): Promise<T> {
    try {
      if (disposed) throw new Error("Esta sessão não está mais ativa.");
      const result = await localRequest<T>("command", localCommandSchema.parse(input), profileId);
      if (!disposed) await afterCommand(input, result);
      return result;
    } catch (error) { if ((error as { status?: number })?.status === 401) expire(); throw error; }
  }
  let pinnedChapters: string[] = [], visitedChapters = cache.chapterVisits ?? cache.chapters.map(value => `${value.book.abbrev}:${value.chapter}`), chapterGeneration = 0;
  let prefetches = 0;
  const prefetchQueue: (() => void)[] = [];
  async function chapter(abbrev: string, number: number, preload = false): Promise<BibleChapter | null> {
    const key = `${abbrev}:${number}`;
    const generation = preload ? chapterGeneration : ++chapterGeneration;
    if (preload && !pinnedChapters.includes(key)) return null;
    while (preload && prefetches >= 2) await new Promise<void>(resolve => prefetchQueue.push(resolve));
    if (preload) prefetches++;
    const cached = cache.chapters.find(value => value.book.abbrev === abbrev && value.chapter === number);
    try {
      if (disposed || (preload && !pinnedChapters.includes(key))) return null;
      const value = cached ?? await query<BibleChapter | null>({ query: "chapter", abbrev, chapter: number });
      if (!disposed && value && generation === chapterGeneration && (!preload || pinnedChapters.includes(key))) {
        if (!preload) {
          pinnedChapters = chapterWindow(number, value.book.chapters).map(item => `${abbrev}:${item}`);
          visitedChapters = [key, ...visitedChapters.filter(item => item !== key)].slice(0, 6);
          cache.chapterVisits = visitedChapters;
        }
        const values = [value, ...cache.chapters.filter(item => item.book.abbrev !== abbrev || item.chapter !== number)];
        const rank = (item: BibleChapter) => {
          const id = `${item.book.abbrev}:${item.chapter}`, visit = visitedChapters.indexOf(id);
          return pinnedChapters.includes(id) ? -1 : visit < 0 ? 99 : visit;
        };
        const kept = new Set([...values].sort((a, b) => rank(a) - rank(b)).slice(0, 6));
        cache.chapters = values.filter(item => kept.has(item));
        if (!cached || !preload) persist();
      }
      return value;
    } finally {
      if (preload) { prefetches--; prefetchQueue.shift()?.(); }
    }
  }
  const repository: Repository = {
    mode: "local",
    social: {
      watchMarkers: chapter => watch("social:markers:" + JSON.stringify(chapter), () => query<ShareMarker[]>({ query: "socialMarkers", chapter })),
      watchFriends: () => watch("social:friends", () => query<FriendsData>({ query: "socialFriends" })),
      rotateCode: () => command<string>({ action: "social", input: { kind: "rotateCode" } }),
      request: async input => { await command({ action: "social", input: { kind: "request", input } }); },
      change: async input => { await command({ action: "social", input: { kind: "change", input } }); },
      send: input => command<string>({ action: "social", input: { kind: "send", input } }),
      watchShares: input => watch("social:shares:" + JSON.stringify(input), () => query<SharePage>({ query: "socialShares", input })),
    },
    notifications: {
      watchSummary: () => watch("notifications:summary", async () => {
        if (notificationSummary) return notificationSummary;
        const value = notificationSummarySchema.parse(await query<NotificationSummary>({ query: "notificationSummary" }));
        // SSE may have assigned a newer summary while the request was awaiting.
        const current = notificationSummary as NotificationSummary | undefined;
        if (!current || value.revision >= current.revision) notificationSummary = value;
        return notificationSummary ?? value;
      }),
      watchPage: cursor => watch("notifications:page:" + cursor, () => query<NotificationPage>({ query: "notifications", cursor })),
      markRead: async id => { await command<NotificationSummary>({ action: "readNotification", id }); },
      refresh: async () => { notificationSummary = undefined; await invalidate(key => key.startsWith("notifications:")); },
    },
    sharing: {
      watchDrafts: id => watch("drafts:" + id, () => query<CommunityQuoteDraft[]>({ query: "quoteDrafts", id })),
      saveDrafts: (ids, selection, requestId) => command<CommunityQuoteDraft[]>({ action: "saveQuoteDrafts", ids, selection, requestId }),
      updateDraft: (id, draftId, selection, comment) => command({ action: "updateQuoteDraft", id, draftId, selection, comment }),
      publishDraft: (id, draftId, selection, comment) => command({ action: "publishQuoteDraft", id, draftId, selection, comment }),
      deleteDraft: (id, draftId) => command({ action: "deleteQuoteDraft", id, draftId }),
      sendQuote: (id, selection, comment, requestId) => command<string>({ action: "sendQuote", id, selection, comment, requestId }),
      message: (id, messageId) => query({ query: "communityMessage", id, messageId }),
    },
    async refresh() {
      revision++; recentDates(today()).forEach(date => dirtyDates.add(date)); reading = undefined; notificationSummary = undefined;
      await windowRequest?.catch(() => {}); await favoritesRequest?.catch(() => {}); reading = undefined;
      await loadWindow();
      await invalidate(() => true);
    },
    governance: {
      watchCreation: () => watch("governance:creation", () => query({ query: "governance", input: { kind: "creation" } })),
      watchMine: cursor => watch("governance:mine:" + cursor, () => query({ query: "governance", input: { kind: "mine", cursor } })),
      watchRequests: (id, cursor) => watch("governance:requests:" + id + ":" + cursor, () => query({ query: "governance", input: { kind: "requests", id, cursor } })),
      cancel: requestId => command({ action: "governance", input: { kind: "cancel", requestId } }),
      decide: (requestId, decision) => command({ action: "governance", input: { kind: "decide", requestId, decision } }),
      setRole: (id, memberId, role) => command({ action: "governance", input: { kind: "setRole", id, memberId, role } }),
      leave: id => command({ action: "governance", input: { kind: "leave", id } }),
      transfer: (id, memberId) => command({ action: "governance", input: { kind: "transfer", id, memberId } }),
    },
    watchHome: date => watch("home:" + date, () => home(date)),
    watchCommunities: () => watch("communities", () => query<Community[]>({ query: "communities" })),
    watchCommunity: (id, cursor) => watch("community:" + id + ":" + cursor, () => query<CommunityDetail | null>({ query: "community", id, cursor })),
    createCommunity: input => command<string>({ action: "createCommunity", input }),
    previewInvite: code => query<{ id: string; name: string } | null>({ query: "invite", code }),
    joinCommunity: code => command<string>({ action: "joinCommunity", code }),
    sendMessage: (id, content) => command<void>({ action: "sendMessage", id, content }),
    updateScripture: (id, scripture) => command<void>({ action: "updateScripture", id, scripture }),
    createChecklist: (id, name, items) => command<void>({ action: "createChecklist", id, input: { name, items } }),
    setTick: (itemId, checked) => command<void>({ action: "setTick", itemId, checked }),
    removeMember: (id, memberId) => command<void>({ action: "removeMember", id, memberId }),
    reading: {
      watchReading: () => watch("reading", readFavorites),
      setFavorite: (date, saved) => command<string | null>({ action: "setFavorite", date, saved, timeZone }),
      restoreFavorite: token => command<void>({ action: "restoreFavorite", token }),
      watchBible: () => watch("bible", async () => {
        if (cache.catalog) return cache.catalog;
        const value = await query<BibleCatalog>({ query: "bible" });
        if (!disposed && value.books.length && value.version === "aa") { cache.catalog = { ...value, version: "aa" }; persist(); }
        return value;
      }),
      watchChapter: (abbrev, number, preload = false) => watch((preload ? "prefetch:" : "chapter:") + abbrev + ":" + number, () => chapter(abbrev, number, preload)),
      watchSearch: (text, page) => watch("search:" + text + ":" + page, async () => {
        const key = text.trim().toLowerCase() + ":" + page;
        const cached = searchCache.get(key);
        if (cached) { searchCache.delete(key); searchCache.set(key, cached); return cached; }
        const value = await query<BibleResults>({ query: "search", text, page });
        if (!disposed) { searchCache.set(key, value); if (searchCache.size > 20) searchCache.delete(searchCache.keys().next().value!); }
        return value;
      }),
      watchEditorial: () => watch("editorial", () => query<EditorialEntry[]>({ query: "editorial" })),
      editorialCalendar: (month, today) => query<string[]>({ query: "editorialCalendar", month, today }),
      publish: input => command<void>({ action: "publish", input }),
      schedule: input => command<void>({ action: "schedule", input }),
      withdraw: (date, reason) => command<void>({ action: "withdraw", date, reason }),
    },
  };
  return {
    repository,
    acceptNotificationEvent,
    async checkDay() {
      if (options.sessionExpiresAt && now().getTime() >= options.sessionExpiresAt) { expire(); return; }
      if (!disposed && observedDay !== today()) {
        observedDay = today(); reconcileDay();
        await invalidate(key => key.startsWith("home:") || key === "reading");
      }
    },
    expire,
    dispose() { disposed = true; entries.clear(); requests.clear(); },
  };
}
