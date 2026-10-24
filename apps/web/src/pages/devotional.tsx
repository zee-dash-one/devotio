import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, IconButton } from "../ui/button";
import { Leaf, Share2 } from "lucide-react";
import {
  copy,
  devotionalQuote,
  devotionalSectionText,
  devotionalShareText,
  devotionalVerses,
  selectionVerses,
  type Devotional,
  type HomeData,
} from "domain/core";
import { useReader } from "../context";
import { Empty, Loading, ErrorMessage } from "../components";
import {
  useVerseSelection,
  usePressActivation,
  useReadingSurface,
} from "../verse-selection";
import { SelectionMenu } from "./selection-menu";
import { PUBLIC_APP_URL } from "../config";
import { shareText } from "../share-text";

export function DevotionalPage() {
  const { data, error } = useReader();
  return (
    <div className="devotional-page">
      <h1 className="sr-only">Devocional</h1>
      {error ? (
        <div className="reading-column">
          <ErrorMessage message={error} />
          <Button variant="secondary" onClick={() => location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : !data ? (
        <Loading />
      ) : !data.devotional ? (
        <Empty title="Um espaço à espera da Palavra.">
          <p>{copy.emptyDevotional}</p>
        </Empty>
      ) : (
        <DevotionalContent
          key={`${data.devotional.id}:${data.devotional.date}`}
          day={data.devotional}
          settings={data.settings}
        />
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="reading-divider">
      <span />
      <Leaf size={18} />
      <span />
    </div>
  );
}
function DevotionalContent({
  day,
  settings,
}: {
  day: Devotional;
  settings: HomeData["settings"];
}) {
  useReadingSurface();
  const selection = useVerseSelection();
  const press = usePressActivation();
  const [section, setSection] = useState<
    "reflection" | "prayerSuggestion" | "whole" | null
  >(null);
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const verses = devotionalVerses(day);
  const quote = selection.selection
    ? devotionalQuote(day, selection.selection)
    : null;
  const clear = () => {
    selection.cancel();
    press.cancel();
    selection.setSelection(null);
    setSection(null);
  };
  function sectionPress(next: "reflection" | "prayerSuggestion") {
    return press.bind(
      () => {
        selection.setSelection(null);
        setSection(next);
      },
      () => {
        selection.setSelection(selection.selection);
        setSection(section);
      },
      true,
    );
  }
  const label =
    section === "reflection"
      ? "Meditar"
      : section === "prayerSuggestion"
        ? "Oração"
        : "Devocional";
  return (
    <>
      <article className="reading-column" id="palavra">
        <header className="section-heading">
          <span className="section-number">01</span>
          <span className="eyebrow">PALAVRA</span>
          <span className="section-rule" />
          <IconButton
            aria-label="Compartilhar devocional"
            disabled={sharing}
            onClick={async () => {
              setSharing(true);
              setMessage("");
              try {
                const result = await shareText(
                  devotionalShareText(day, PUBLIC_APP_URL),
                );
                if (result === "copied")
                  setMessage("Devocional copiado para compartilhar.");
                if (result === "manual") {
                  selection.setSelection(null);
                  setSection("whole");
                }
              } finally {
                setSharing(false);
              }
            }}
          >
            <Share2 size={20} />
          </IconButton>
        </header>
        {message && <p role="status">{message}</p>}
        <h2 className="scripture-reference">
          {day.selection ? (
            <Link
              to="/biblia"
              search={{
                book: day.selection.book,
                chapter: day.selection.chapter,
                verse: day.selection.first,
                verses: selectionVerses(day.selection).join(","),
                version: day.selection.version,
              }}
            >
              {day.reference}
            </Link>
          ) : (
            day.reference
          )}
        </h2>
        <p className="translation">{day.translation}</p>
        <div
          className="scripture-text"
          onCopy={(event) => event.preventDefault()}
        >
          {verses.length && day.selection
            ? verses.map((verse) => {
                const checked =
                  !!selection.selection &&
                  selectionVerses(selection.selection).includes(verse.number);
                const bindings = selection.bind(day.selection!, verse.number);
                return (
                  <p
                    key={verse.number}
                    role="checkbox"
                    tabIndex={0}
                    aria-label={`Versículo ${verse.number}: ${verse.text}`}
                    aria-checked={checked}
                    className={checked ? "selected-verse" : ""}
                    {...bindings}
                    onClick={(event) => {
                      setSection(null);
                      bindings.onClick(event);
                    }}
                  >
                    <span className="verse-marker" aria-hidden="true">
                      {verse.number}
                    </span>
                    {verse.text}
                  </p>
                );
              })
            : day.scripture
                .split("\n")
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index}>
                    <span className="verse-marker" aria-hidden="true">
                      ✦
                    </span>
                    {paragraph}
                  </p>
                ))}
        </div>
        <Divider />
        <header className="section-heading">
          <span className="section-number">02</span>
          <span className="eyebrow">MEDITAR</span>
          <span className="section-rule" />
        </header>
        <div
          className="reflection-text"
          {...sectionPress("reflection")}
          onCopy={(event) => event.preventDefault()}
          tabIndex={0}
          aria-label="Meditar"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selection.setSelection(null);
              setSection("reflection");
            }
          }}
        >
          {day.reflection
            .split("\n")
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
        <Divider />
        <header className="section-heading">
          <span className="section-number">03</span>
          <span className="eyebrow">ORAÇÃO</span>
          <span className="section-rule" />
        </header>
        <section
          className="prayer-card"
          {...sectionPress("prayerSuggestion")}
          onCopy={(event) => event.preventDefault()}
          tabIndex={0}
          aria-label="Oração"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selection.setSelection(null);
              setSection("prayerSuggestion");
            }
          }}
        >
          <p>{day.prayerSuggestion}</p>
          <span className="prayer-end" aria-hidden="true">
            ✧
          </span>
        </section>
        <Divider />
        <p className="editorial-credit">{day.credit}</p>
      </article>
      {settings?.weeklyVerse && (
        <aside className="weekly-theme">
          <span className="eyebrow">AO LONGO DESTA SEMANA</span>
          <p>{settings.weeklyVerse}</p>
          <span className="caption">{settings.weeklyReference}</span>
        </aside>
      )}
      {quote ? (
        <SelectionMenu
          key="verses"
          quote={quote}
          scope="friends"
          onClear={clear}
          onSwipe={selection.cancel}
        />
      ) : (
        section && (
          <SelectionMenu
            key={section}
            text={
              section === "whole"
                ? devotionalShareText(day, PUBLIC_APP_URL)
                : devotionalSectionText(day, section)
            }
            label={label}
            scope="text"
            initialManualCopy={section === "whole"}
            onClear={clear}
            onSwipe={press.cancel}
          />
        )
      )}
    </>
  );
}
