import { BiblePickerButton } from "../ui/bible-picker-button";
import { Button } from "../ui/button";
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
} from "lucide-react";
import { useRepository, useWatch } from "domain/react";
import {
  applyEditorialQuote,
  bibleQuote,
  chapterWindow,
  devotionalSelectionSchema,
  selectionRange,
  validationMessage,
  type BibleChapter,
  type BibleSelection,
  type BibleReaderRepository,
  type BibleVersion,
  resolveBibleVersion,
  type Watch,
} from "domain/core";
import { usePreferences } from "../preferences";
import { useBiblePageGestures } from "../bible-page-gestures";
import { Dropdown } from "../dropdown";
import { useWriting } from "../context";
import { SelectionMenu } from "./selection-menu";
import { Empty, ErrorMessage, Loading } from "../components";
import { ChapterMarks, VerseMarks } from "../social";

export function BiblePage() {
  const repository = useRepository();
  const { preferences, change } = usePreferences();
  const params = useSearch({ from: "/_reader/biblia" }),
    { picker } = useWriting();
  const versions = repository.bible?.versions ?? ["aa"];
  const version = resolveBibleVersion(preferences.bibleVersion, versions);
  useEffect(() => {
    const desired = params.version ?? (params.pick ? picker?.selection?.version : undefined);
    if (desired && versions.includes(desired)) change({ bibleVersion: desired });
    // Apply the edition of an incoming link once; later Settings changes remain effective.
  }, [params.version, params.pick]);
  const reading = useMemo(() => repository.bible?.forVersion(version) ?? repository.reading, [repository, version]);
  if (!reading)
    return <Empty title="Leitura bíblica em preparação." />;
  return (
    <BibleReader
      key={
        params.pick
          ? `${params.pick}:${picker?.target.kind === "devotional" ? picker.target.key : picker?.target.communityId}`
          : "normal"
      }
      reading={reading}
      version={version}
    />
  );
}
function BibleReader({ reading, version }: { reading: BibleReaderRepository; version: BibleVersion }) {
  const { preferences } = usePreferences();
  const params = useSearch({ from: "/_reader/biblia" });
  const navigate = useNavigate();
  const repository = useRepository(),
    writing = useWriting();
  const picker =
    params.pick && writing.picker?.target.kind === params.pick
      ? writing.picker
      : null;
  const [returning, setReturning] = useState(false),
    [returnError, setReturnError] = useState("");
  const versesElement = useRef<HTMLDivElement>(null);
  const [storedSelection, setSelected] = useState<BibleSelection | null>(
    picker?.selection ?? null,
  );
  const selected = storedSelection?.version === version ? storedSelection : null;
  const anchor = useRef(picker?.selection?.first ?? 1);
  const gesture = useRef<{
    chapter: BibleChapter;
    anchor: number;
    x: number;
    y: number;
    active: boolean;
    type: string;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);
  const catalog = useWatch(useMemo(() => reading.watchBible(), [reading]));
  const scrollAnchor = useRef<{ id: string; top: number } | null>(null);
  const captureAnchor = () => {
    if (scrollAnchor.current) return;
    const element = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reading-verse]"),
    ).find((verse) => verse.getBoundingClientRect().bottom > 130);
    if (element)
      scrollAnchor.current = {
        id: element.id,
        top: element.getBoundingClientRect().top,
      };
  };
  const chapter = useNeighbor(
    reading,
    params.book,
    params.chapter,
    false,
    captureAnchor,
  );
  const previous = useNeighbor(
    reading,
    params.book,
    chapter.data && params.chapter > 1 ? params.chapter - 1 : undefined,
    true,
    captureAnchor,
  );
  const next = useNeighbor(
    reading,
    params.book,
    chapter.data && params.chapter < chapter.data.book.chapters
      ? params.chapter + 1
      : undefined,
    true,
    captureAnchor,
  );
  const retained = useRef<BibleChapter[]>([]);
  const available = [
    previous.data,
    chapter.data,
    next.data,
    ...retained.current,
  ].filter(
    (data): data is BibleChapter => !!data && data.book.abbrev === params.book && (data.version ?? "aa") === version,
  );
  const current = available.find((data) => data.chapter === params.chapter);
  const visibleChapters = current
    ? chapterWindow(params.chapter, current.book.chapters)
        .map((number) => available.find((data) => data.chapter === number))
        .filter((data): data is BibleChapter => !!data)
    : [];
  useLayoutEffect(() => {
    retained.current = visibleChapters;
  });
  const previousMode = useRef(preferences.mode);
  const spacer = useRef(0);
  useLayoutEffect(() => {
    const anchor = scrollAnchor.current;
    if (anchor && current) {
      const element = document.getElementById(anchor.id);
      if (element) {
        window.scrollBy(0, element.getBoundingClientRect().top - anchor.top);
        scrollAnchor.current = null;
      }
    }
    if (previousMode.current !== preferences.mode) {
      previousMode.current = preferences.mode;
    }
  });
  useEffect(() => {
    if (preferences.mode !== "continuous" || selected || !current) return;
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>("[data-reading-chapter]"),
        );
        const candidate = elements.find(
          (element) =>
            element.getBoundingClientRect().top <= 140 &&
            element.getBoundingClientRect().bottom > 140,
        );
        const number = Number(candidate?.dataset.readingChapter);
        if (!number || number === params.chapter) return;
        const verse = candidate?.querySelector<HTMLElement>(
          "[data-reading-verse]",
        );
        if (verse)
          scrollAnchor.current = {
            id: verse.id,
            top: verse.getBoundingClientRect().top,
          };
        if (number > params.chapter) {
          const removed = elements.find(
            (element) =>
              Number(element.dataset.readingChapter) === params.chapter - 1,
          );
          spacer.current += removed?.getBoundingClientRect().height ?? 0;
        } else
          spacer.current = Math.max(
            0,
            spacer.current - (candidate?.getBoundingClientRect().height ?? 0),
          );
        void navigate({
          to: "/biblia",
          search: { ...params, chapter: number, verse: undefined },
          replace: true,
          resetScroll: false,
        });
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, [preferences.mode, selected, current, params, navigate]);
  useEffect(() => {
    const beforePreferences = (event: Event) => {
      captureAnchor();
      const mode = (
        event as CustomEvent<Partial<import("domain/core").ReadingPreferences>>
      ).detail?.mode;
      if (mode === "paged") {
        const number =
          selected?.chapter ?? Number(scrollAnchor.current?.id.split("-")[1]);
        if (number && number !== params.chapter)
          void navigate({
            to: "/biblia",
            search: { ...params, chapter: number, verse: undefined },
            replace: true,
            resetScroll: false,
          });
      }
    };
    document.addEventListener("devotio:before-preferences", beforePreferences);
    return () =>
      document.removeEventListener(
        "devotio:before-preferences",
        beforePreferences,
      );
  });
  const [text, setText] = useState(params.q ?? picker?.query ?? "");
  const [initialSearch] = useState(() => ({
    query: params.q ?? picker?.query ?? "",
    preserveSelection: !!picker?.selection,
  }));
  const [search, setSearch] = useState<{ query: string; page: number } | null>(
    null,
  );
  const lastVersion = useRef(version);
  useLayoutEffect(() => {
    if (lastVersion.current === version) return;
    lastVersion.current = version;
    cancelGesture();
    window.getSelection()?.removeAllRanges();
    setSelected(null);
    setSearch(current => current ? { ...current, page: 0 } : null);
    scrollAnchor.current = null;
  }, [version]);
  const chapterReady = !!chapter.data;
  const selectedData = visibleChapters.find(
    (data) => data.chapter === selected?.chapter,
  );
  const quote =
    selected && selectedData ? bibleQuote(selectedData, selected) : null;
  function select(first: number, last = first, data = current) {
    if (data)
      setSelected({
        book: data.book.abbrev,
        chapter: data.chapter,
        ...selectionRange(first, last),
        version,
      });
  }
  function clearSelection() {
    const selection = selected;
    setSelected(null);
    window.getSelection()?.removeAllRanges();
    if (selection)
      document
        .getElementById(`verse-${selection.chapter}-${selection.first}`)
        ?.focus({ preventScroll: true });
  }
  function cancelGesture() {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = null;
  }
  useEffect(() => {
    setSelected((current) =>
      current && current.book !== params.book ? null : current,
    );
    const update = () => {
      const selection = window.getSelection(),
        container = versesElement.current;
      if (
        !selection ||
        selection.isCollapsed ||
        !selection.rangeCount ||
        !container ||
        gesture.current?.active
      )
        return;
      const range = selection.getRangeAt(0);
      if (
        !container.contains(range.startContainer) ||
        !container.contains(range.endContainer)
      )
        return;
      const pieces: { number: number; chapter: number; text: string }[] = [];
      container
        .querySelectorAll<HTMLParagraphElement>("p[data-verse]")
        .forEach((element) => {
          if (!range.intersectsNode(element)) return;
          const clipped = document.createRange();
          clipped.selectNodeContents(element);
          if (clipped.compareBoundaryPoints(Range.START_TO_START, range) < 0)
            clipped.setStart(range.startContainer, range.startOffset);
          if (clipped.compareBoundaryPoints(Range.END_TO_END, range) > 0)
            clipped.setEnd(range.endContainer, range.endOffset);
          const content = clipped.cloneContents();
          content.querySelectorAll("a").forEach((link) => link.remove());
          const text = content.textContent?.trim();
          if (text)
            pieces.push({
              number: Number(element.dataset.verse),
              chapter: Number(element.dataset.chapter),
              text,
            });
        });
      if (!pieces.length) {
        setSelected(null);
        return;
      }
      if (pieces.some((piece) => piece.chapter !== pieces[0].chapter)) return;
      const first = pieces[0].number,
        last = pieces.at(-1)!.number;
      anchor.current = first;
      setSelected({
        book: params.book,
        chapter: pieces[0].chapter,
        first,
        last,
        version,
      });
    };
    document.addEventListener("selectionchange", update);
    document.addEventListener("pointerup", cancelGesture);
    document.addEventListener("pointercancel", cancelGesture);
    const preventScroll = (event: TouchEvent) => {
      if (gesture.current?.active) event.preventDefault();
    };
    const element = versesElement.current;
    element?.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      cancelGesture();
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("pointerup", cancelGesture);
      document.removeEventListener("pointercancel", cancelGesture);
      element?.removeEventListener("touchmove", preventScroll);
    };
  }, [chapter.data, params.book, version]);
  const targetKey =
    picker?.target.kind === "devotional"
      ? picker.target.key
      : picker?.target.communityId;
  const setPicker = writing.setPicker;
  useEffect(() => {
    if (picker)
      setPicker({
        ...picker,
        book: params.book,
        chapter: params.chapter,
        selection: selected,
        query: text,
      });
    // A snapshot update must not trigger another snapshot update.
  }, [
    params.book,
    params.chapter,
    params.pick,
    targetKey,
    selected,
    text,
    setPicker,
  ]);
  useEffect(() => {
    const term = text.trim();
    if (term.length < 4) {
      setSearch(null);
      return;
    }
    if (initialSearch.preserveSelection && text === initialSearch.query) return;
    const timer = setTimeout(() => {
      setSelected(null);
      setSearch({ query: term, page: 0 });
    }, 350);
    return () => clearTimeout(timer);
  }, [text, initialSearch]);
  useEffect(() => {
    if (chapterReady && params.verse)
      document
        .getElementById(`verse-${params.chapter}-${params.verse}`)
        ?.scrollIntoView({ block: "center" });
    else if (chapterReady && picker?.scrollY !== undefined)
      window.scrollTo({ top: picker.scrollY });
  }, [chapterReady, params.book, params.chapter, params.verse]);
  const open = (book: string, chapter: number) => {
    cancelGesture();
    setSearch(null);
    setText("");
    setSelected(null);
    scrollAnchor.current = null;
    spacer.current = 0;
    void navigate({
      to: "/biblia",
      search: { book, chapter, pick: picker?.target.kind },
    });
  };
  useBiblePageGestures(
    versesElement,
    preferences.mode === "paged" && !selected && !search,
    cancelGesture,
    (offset) => {
      const number = params.chapter + offset;
      if (current && number >= 1 && number <= current.book.chapters)
        open(params.book, number);
    },
  );
  async function returnToWriting() {
    if (!picker || returning) return;
    setReturning(true);
    setReturnError("");
    try {
      writing.setPicker({ ...picker, scrollY: window.scrollY });
      if (picker.target.kind === "devotional") {
        const draft = writing.editors[picker.target.key];
        if (!draft)
          throw new Error(
            "O cadastro não está mais aberto. Inicie um novo devocional.",
          );
        if (quote)
          devotionalSelectionSchema.parse({
            scripture: quote.text,
            reference: quote.reference,
          });
        writing.setEditor(picker.target.key, {
          ...(quote ? applyEditorialQuote(draft, quote) : draft),
          query: text,
        });
        await navigate({
          to: "/editorial/cadastro",
          search: { date: picker.target.date },
        });
      } else {
        const id = picker.target.communityId,
          draft = writing.communities[id];
        if (!draft)
          throw new Error(
            "Abra Escrever na comunidade para escolher a Palavra.",
          );
        let draftId = draft.draftId;
        if (quote) {
          if (draftId)
            await repository.sharing!.updateDraft(
              id,
              draftId,
              quote,
              draft.comment,
            );
          else {
            const saved = await repository.sharing!.saveDrafts(
              [id],
              quote,
              draft.requestId,
            );
            draftId = saved[0].id;
            if (draft.comment)
              await repository.sharing!.updateDraft(
                id,
                draftId,
                quote,
                draft.comment,
              );
          }
        }
        writing.setCommunity(id, {
          ...draft,
          draftId,
          quote: quote ?? draft.quote,
          query: text,
          open: true,
        });
        writing.setPicker({
          ...picker,
          target: { ...picker.target, draftId },
          scrollY: window.scrollY,
        });
        await navigate({
          to: "/comunidade/$communityId",
          params: { communityId: id },
        });
      }
    } catch (cause) {
      setReturnError(validationMessage(cause));
    } finally {
      setReturning(false);
    }
  }
  return (
    <div className="page bible-page">
      <h1 className="sr-only">Leitura bíblica</h1>
      {catalog.error ? (
        <ErrorMessage message={catalog.error} />
      ) : !catalog.data ? (
        <Loading />
      ) : !catalog.data.books.length ? (
        <Empty title="A Bíblia ainda não foi preparada.">
          <p>
            Execute a preparação dos dados indicada no README e reinicie o
            servidor local.
          </p>
        </Empty>
      ) : (
        <>
          <div className="bible-controls">
            <div className="field">
              <span>Livro</span>
              <Dropdown
                label="Livro"
                value={params.book}
                onChange={(value) => open(value, 1)}
                options={catalog.data.books.map((book) => ({
                  value: book.abbrev,
                  label: book.name,
                  group:
                    book.testament === "VT"
                      ? "Antigo Testamento"
                      : "Novo Testamento",
                }))}
              />
            </div>
            <div className="field">
              <span>Capítulo</span>
              <Dropdown
                label="Capítulo"
                value={String(params.chapter)}
                onChange={(value) => open(params.book, Number(value))}
                options={Array.from(
                  {
                    length:
                      catalog.data.books.find(
                        (book) => book.abbrev === params.book,
                      )?.chapters ?? 1,
                  },
                  (_, index) => ({
                    value: String(index + 1),
                    label: String(index + 1),
                  }),
                )}
              />
            </div>
          </div>
          <form
            className="bible-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim().length >= 4)
                setSearch({ query: text.trim(), page: 0 });
            }}
          >
            <label className="sr-only" htmlFor="bible-search">
              Buscar palavras na Bíblia
            </label>
            <Search size={18} aria-hidden="true" />
            <input
              id="bible-search"
              placeholder="Buscar um trecho na Bíblia…"
              minLength={4}
              maxLength={100}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSearch(null);
              }}
            />
          </form>
          {search && search.query === text.trim() ? (
            <BibleSearch
              pick={picker?.target.kind}
              reading={reading}
              query={search.query}
              page={search.page}
              onPage={(page) => setSearch({ ...search, page })}
              onClose={() => {
                setSearch(null);
                setText("");
              }}
            />
          ) : chapter.error ? (
            <ErrorMessage message={chapter.error} />
          ) : !current && chapter.data === undefined ? (
            <Loading />
          ) : !current ? (
            <Empty title="Capítulo não encontrado.">
              <Button variant="secondary" onClick={() => open("jo", 1)}>
                Abrir João 1
              </Button>
            </Empty>
          ) : (
            <>
              <div
                ref={versesElement}
                className="reading-window"
                data-reading-mode={preferences.mode}
              >
                {preferences.mode === "continuous" && (
                  <div aria-hidden="true" style={{ height: spacer.current }} />
                )}
                {(preferences.mode === "continuous"
                  ? visibleChapters
                  : [current]
                ).map((data) => (
                  <ChapterMarks key={`${version}:${data.book.abbrev}:${data.chapter}`} social={params.pick ? undefined : repository.social} chapter={{ version, book: data.book.abbrev, chapter: data.chapter }}>
                  <section
                    data-reading-chapter={data.chapter}
                  >
                    <div className={preferences.mode === "continuous" ? "bible-chapter-heading" : "sr-only"}>
                      <h2>
                        {data.book.name} <em>{data.chapter}</em>
                      </h2>
                    </div>
                    <article
                      className="bible-verses"
                      aria-label={`${data.book.name}, capítulo ${data.chapter}`}
                      onPointerMove={(event) => {
                        const current = gesture.current;
                        if (!current) return;
                        const distance = Math.hypot(
                          event.clientX - current.x,
                          event.clientY - current.y,
                        );
                        if (
                          !current.active &&
                          current.type === "touch" &&
                          distance > 10
                        ) {
                          cancelGesture();
                          return;
                        }
                        if (
                          !current.active &&
                          current.type === "mouse" &&
                          event.buttons === 1 &&
                          distance > 6
                        ) {
                          current.active = true;
                          suppressClick.current = true;
                          anchor.current = current.anchor;
                          if (current.timer) clearTimeout(current.timer);
                        }
                        if (!current.active) return;
                        event.preventDefault();
                        const element = (
                          document.elementFromPoint?.(
                            event.clientX,
                            event.clientY,
                          ) ?? (event.target as Element)
                        ).closest<HTMLElement>("[data-verse]");
                        if (
                          element &&
                          Number(element.dataset.chapter) ===
                            current.chapter.chapter &&
                          versesElement.current?.contains(element)
                        )
                          select(
                            current.anchor,
                            Number(element.dataset.verse),
                            current.chapter,
                          );
                      }}
                      onPointerUp={() => cancelGesture()}
                      onPointerCancel={() => cancelGesture()}
                    >
                      {data.verses.map((verse) => (
                        <div className="bible-verse-row" key={verse.number}>
                        <p
                          data-verse={verse.number}
                          data-chapter={data.chapter}
                          data-reading-verse
                          id={`verse-${data.chapter}-${verse.number}`}
                          role="checkbox"
                          tabIndex={0}
                          aria-checked={
                            !!quote &&
                            quote.chapter === data.chapter &&
                            verse.number >= quote.first &&
                            verse.number <= quote.last
                          }
                          aria-label={`Versículo ${verse.number}: ${verse.text}`}
                          className={
                            (quote &&
                              quote.chapter === data.chapter &&
                              verse.number >= quote.first &&
                              verse.number <= quote.last) ||
                            (params.chapter === data.chapter &&
                              params.verse === verse.number)
                              ? "selected-verse"
                              : ""
                          }
                          onPointerDown={(event) => {
                            if (event.button > 0) return;
                            cancelGesture();
                            suppressClick.current = false;
                            const current = {
                              chapter: data,
                              anchor: verse.number,
                              x: event.clientX,
                              y: event.clientY,
                              active: false,
                              type: event.pointerType || "mouse",
                              timer: undefined as
                                ReturnType<typeof setTimeout> | undefined,
                            };
                            current.timer = setTimeout(() => {
                              current.active = true;
                              suppressClick.current = true;
                              anchor.current = verse.number;
                              select(verse.number, verse.number, data);
                            }, 350);
                            gesture.current = current;
                          }}
                          onClick={(event) => {
                            if (suppressClick.current) {
                              suppressClick.current = false;
                              event.preventDefault();
                              return;
                            }
                            if (!window.getSelection()?.isCollapsed) return;
                            if (
                              event.shiftKey &&
                              selected?.chapter === data.chapter
                            )
                              select(anchor.current, verse.number, data);
                            else if (
                              quote?.chapter === data.chapter &&
                              quote.first === verse.number &&
                              quote.last === verse.number
                            )
                              clearSelection();
                            else {
                              anchor.current = verse.number;
                              select(verse.number, verse.number, data);
                            }
                          }}
                          onContextMenu={(event) => {
                            if (gesture.current?.active) event.preventDefault();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              clearSelection();
                              return;
                            }
                            if (event.key === " " || event.key === "Enter") {
                              event.preventDefault();
                              anchor.current = verse.number;
                              select(verse.number, verse.number, data);
                            }
                            if (
                              event.shiftKey &&
                              (event.key === "ArrowDown" ||
                                event.key === "ArrowUp")
                            ) {
                              event.preventDefault();
                              const end = Math.max(
                                1,
                                Math.min(
                                  data.verses.length,
                                  verse.number +
                                    (event.key === "ArrowDown" ? 1 : -1),
                                ),
                              );
                              select(
                                selected?.chapter === data.chapter
                                  ? anchor.current
                                  : verse.number,
                                end,
                                data,
                              );
                              document
                                .getElementById(`verse-${data.chapter}-${end}`)
                                ?.focus();
                            }
                          }}
                        >
                          <Link
                            to="/biblia"
                            search={{
                              ...params,
                              chapter: data.chapter,
                              verse: verse.number,
                            }}
                            aria-label={`Versículo ${verse.number}, link direto`}
                          >
                            {verse.number}
                          </Link>
                          {verse.text}
                        </p>
                        <VerseMarks number={verse.number} />
                        </div>
                      ))}
                    </article>
                  </section>
                  </ChapterMarks>
                ))}
              </div>
              {quote && !params.pick && (
                <SelectionMenu
                  key={`${params.book}:${params.chapter}`}
                  quote={quote}
                  onClear={clearSelection}
                  onSwipe={cancelGesture}
                />
              )}
              {preferences.mode === "paged" && (
                <nav className="chapter-navigation" aria-label="Capítulos">
                  <Button
                    variant="secondary"
                    disabled={params.chapter === 1}
                    onClick={() => open(params.book, params.chapter - 1)}
                  >
                    <ChevronLeft size={17} />
                    Anterior
                  </Button>
                  <span className="caption">
                    {params.chapter} de {current.book.chapters}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={params.chapter >= current.book.chapters}
                    onClick={() => open(params.book, params.chapter + 1)}
                  >
                    Próximo
                    <ChevronRight size={17} />
                  </Button>
                </nav>
              )}
              {(previous.error || next.error) && (
                <p role="status" className="caption">
                  Um capítulo vizinho não pôde ser preparado.{" "}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      previous.retry();
                      next.retry();
                    }}
                  >
                    Tentar novamente
                  </Button>
                </p>
              )}
            </>
          )}
        </>
      )}
      {params.pick && !picker && (
        <p role="alert">
          Seleção sem formulário de origem. Abra a Bíblia pelo cadastro ou pela
          comunidade.
        </p>
      )}
      {returnError && <p role="alert">{returnError}</p>}
      {picker && (
        <BiblePickerButton
          disabled={returning}
          aria-label={
            quote
              ? `Usar trecho no ${picker.target.kind === "devotional" ? "devocional" : "rascunho da comunidade"}`
              : "Voltar sem alterar o trecho"
          }
          onClick={() => void returnToWriting()}
        >
          {quote ? <Send size={22} /> : <ArrowLeft size={22} />}
        </BiblePickerButton>
      )}
    </div>
  );
}
function useNeighbor(
  reading: BibleReaderRepository,
  book: string,
  number: number | undefined,
  preload = true,
  beforeUpdate?: () => void,
) {
  const [attempt, retry] = useState(0);
  const callback = useRef(beforeUpdate);
  callback.current = beforeUpdate;
  const state = useWatch(
    useMemo(
      (): Watch<BibleChapter | null> =>
        number === undefined
          ? () => () => {}
          : (next, error) =>
              reading.watchChapter(
                book,
                number,
                preload,
              )((value) => {
                callback.current?.();
                next(value);
              }, error),
      [reading, book, number, preload, attempt],
    ),
  );
  return { ...state, retry: () => retry((value) => value + 1) };
}
function BibleSearch({
  reading,
  query,
  page,
  onPage,
  onClose,
  pick,
}: {
  reading: BibleReaderRepository;
  query: string;
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
  pick?: "devotional" | "community";
}) {
  const result = useWatch(
    useMemo(() => reading.watchSearch(query, page), [reading, query, page]),
  );
  return (
    <section className="bible-results" aria-label="Resultados da busca">
      <div className="section-top">
        <h2>Encontros na Palavra</h2>
        <Button variant="ghost" onClick={onClose}>
          Voltar à leitura
        </Button>
      </div>
      {result.error ? (
        <ErrorMessage message={result.error} />
      ) : !result.data ? (
        <Loading />
      ) : (
        <>
          <p role="status" className="caption">
            {result.data.total}{" "}
            {result.data.total === 1 ? "resultado" : "resultados"} para “{query}
            ”
          </p>
          {!result.data.total && (
            <Empty title="Nenhum versículo encontrado.">
              <p>Experimente outra palavra.</p>
            </Empty>
          )}
          {result.data.verses.map((verse) => (
            <Link
              className="verse-result"
              key={`${verse.abbrev}-${verse.chapter}-${verse.number}`}
              to="/biblia"
              search={{
                book: verse.abbrev,
                chapter: verse.chapter,
                verse: verse.number,
                pick,
              }}
              onClick={onClose}
            >
              <span className="eyebrow">
                {verse.bookName} {verse.chapter}:{verse.number}
              </span>
              <p>{verse.text}</p>
              <span className="caption">Ler no capítulo →</span>
            </Link>
          ))}
          {result.data.total > 40 && (
            <nav className="chapter-navigation" aria-label="Páginas da busca">
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => onPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="caption">Página {page + 1}</span>
              <Button
                variant="secondary"
                disabled={(page + 1) * 40 >= result.data.total}
                onClick={() => onPage(page + 1)}
              >
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
