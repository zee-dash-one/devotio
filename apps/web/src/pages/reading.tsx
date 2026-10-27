import { Button, IconButton } from "../ui/button";
import { useContext, useEffect, useMemo, useState } from "react";
import { Heart, ChevronDown } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useLocalDate, useRepository, useWatch } from "domain/react";
import {
  formatDate,
  validationMessage,
  type ReadingRepository,
  type Devotional,
  type Favorite,
} from "domain/core";
import { ReaderContext, useReader, AudioSelectionContext, ReadingNavigationContext } from "../context";
import { DevotionalPage } from "./devotional";
import { Empty, ErrorMessage, Loading, Modal } from "../components";
import { Dropdown } from "../dropdown";

export function ReadingPage() {
  const repository = useRepository();
  const location = useLocation();
  const recentVisit = useContext(ReadingNavigationContext);
  const reading = repository.devotionalReading ?? repository.reading;
  return reading ? (
    <ReadingSelection key={`${location.pathname}:${recentVisit}`} reading={reading} entryMode={location.pathname.endsWith("/favoritos") ? "favorites" : "recent"} />
  ) : (
    <DevotionalPage />
  );
}
function ReadingSelection({ reading, entryMode }: { reading: Pick<ReadingRepository, "watchReading" | "setFavorite" | "restoreFavorite">; entryMode: "recent" | "favorites" }) {
  const reader = useReader();
  const { date: currentDay } = useLocalDate("America/Sao_Paulo");
  const state = useWatch(useMemo(() => reading.watchReading(), [reading, currentDay]));
  const [mode, setMode] = useState<"recent" | "favorites">(entryMode);
  const [selectedRecent, setSelectedRecent] = useState("");
  const [selectedFavorite, setSelectedFavorite] = useState("");
  const [recentOpen, setRecentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [removedFavorite, setRemovedFavorite] = useState<{
    favorite: Favorite;
    token: string;
  } | null>(null);
  const selectAudio = useContext(AudioSelectionContext);
  const selectedAudio =
    mode === "favorites"
      ? (state.data?.favorites.find(
          (f) => f.devotional.date === selectedFavorite,
        )?.devotional ?? state.data?.favorites[0]?.devotional)
      : (state.data?.recent.find(item => item.date === selectedRecent) ?? state.data?.recent[0]);
  useEffect(() => {
    selectAudio(selectedAudio ?? null);
  }, [selectedAudio, selectAudio]);
  if (!state.data)
    return (
      <div className="page">
        {state.error ? <ErrorMessage message={state.error} /> : <Loading />}
      </div>
    );
  const readingData = state.data;
  const favorites = readingData.favorites;
  const showingFavorites = mode === "favorites";
  const dates = showingFavorites
    ? favorites.map((f) => f.devotional.date)
    : state.data.dates;
  const selected = showingFavorites ? selectedFavorite : selectedRecent;
  const date = dates.includes(selected) ? selected : dates[0];
  const recentDate = state.data.dates.includes(selectedRecent)
    ? selectedRecent
    : state.data.dates[0];
  const snapshot = favorites.find((f) => f.devotional.date === date);
  const currentRecent = state.data.recent.find(item => item.date === date);
  async function toggle() {
    if (!date && !removedFavorite) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      if (!date && removedFavorite) {
        await reading.restoreFavorite(removedFavorite.token);
        setSelectedFavorite(removedFavorite.favorite.devotional.date);
        setRemovedFavorite(null);
        setFeedback("Favorito restaurado.");
      } else if (date) {
        const token = await reading.setFavorite(date, !snapshot);
        setRemovedFavorite(
          showingFavorites && snapshot && token
            ? { favorite: snapshot, token }
            : null,
        );
        setFeedback(snapshot ? "Removido dos favoritos." : "Adicionado aos favoritos.");
      }
    } catch (e) {
      setError(validationMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="reading-tools" aria-label="Escolher leitura">
        {showingFavorites && <h1 className="reading-mode-title">Devocionais Favoritos</h1>}
        <div className="reading-tabs">
          <div className="reading-devotional-group">
            <Button
              type="button"
              variant="ghost"
              className="reading-tab"
              aria-pressed={!showingFavorites}
              onClick={() => {
                setMode("recent");
                setRemovedFavorite(null);
                setError("");
                setFeedback("");
              }}
            >
              Devocional{recentDate && ` ${shortDate(recentDate)}`}
            </Button>
            <IconButton
              type="button"
              variant="secondary"
              className="reading-recent-toggle"
              title="Abrir devocionais recentes"
              aria-label="Abrir devocionais recentes"
              aria-haspopup="dialog"
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen(true)}
            >
              <ChevronDown size={18} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="reading-favorites-group">
            <Button
              type="button"
              variant="ghost"
              className="reading-tab"
              aria-pressed={showingFavorites}
              onClick={() => {
                setMode("favorites");
                setError("");
                setFeedback("");
              }}
            >
              Favoritos
            </Button>
            {showingFavorites ? (
              <FavoriteButton
                saved={!!snapshot}
                undo={!date && !!removedFavorite}
                busy={busy}
                disabled={
                  busy || state.data.offline || (!date && !removedFavorite)
                }
                onToggle={toggle}
              />
            ) : date ? (
              <FavoriteButton
                saved={!!snapshot}
                busy={busy}
                disabled={busy || state.data.offline || !currentRecent}
                onToggle={toggle}
              />
            ) : (
              <FavoriteButton
                saved={false}
                busy={busy}
                disabled
                onToggle={toggle}
              />
            )}
          </div>
        </div>
        {state.data.offline && (
          <p role="status" className="notice">
            Sem conexão com o servidor. As leituras já guardadas neste
            dispositivo continuam disponíveis; alterações exigem conexão.
          </p>
        )}
        {state.data.storageWarning && (
          <p role="status">{state.data.storageWarning}</p>
        )}
        {showingFavorites && dates.length > 0 && (
          <div className="reading-picker">
            <div className="field">
              <span id="reading-date-label">Sua cópia pessoal</span>
              <div className="reading-select-row">
                <Dropdown
                  id="reading-date"
                  labelledBy="reading-date-label"
                  value={date}
                  onChange={(value) => {
                    setSelectedFavorite(value);
                    setError("");
                    setFeedback("");
                  }}
                  options={dates.map((day) => ({
                    value: day,
                    label: formatDate(day),
                  }))}
                />
              </div>
            </div>
          </div>
        )}
        {error && <ErrorMessage message={error} />}
        {feedback && <p role="status" className="reading-feedback">{feedback}</p>}
      </section>
      {recentOpen && (
        <Modal
          title="Devocionais recentes"
          onClose={() => setRecentOpen(false)}
        >
          {state.data.dates.length ? (
            <ul className="recent-devotional-list">
              {state.data.dates.map((day) => (
                <li key={day}>
                  <RecentDevotional
                    devotional={readingData.recent.find(item => item.date === day)!}
                    selected={!showingFavorites && day === recentDate}
                    onSelect={() => {
                      setSelectedRecent(day);
                      setMode("recent");
                      setRemovedFavorite(null);
                      setRecentOpen(false);
                      setError("");
                      setFeedback("");
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma leitura disponível.</p>
          )}
        </Modal>
      )}
      {!date ? (
        <Empty
          title={
            showingFavorites
              ? "Você ainda não tem devocionais favoritos."
              : "Nenhuma leitura disponível."
          }
        >
          <p>{showingFavorites ? "Guarde as reflexões que deseja revisitar." : "Volte em breve."}</p>
          {showingFavorites && <Link to="/devocional">Explorar devocionais</Link>}
        </Empty>
      ) : showingFavorites && snapshot ? (
        <ReaderContext.Provider
          value={{
            date,
            data: {
              user: reader.data?.user ?? { id: "", name: "" },
              devotional: snapshot.devotional,
              settings: null,
            },
          }}
        >
          <p className="snapshot-note caption">
            Cópia pessoal salva em{" "}
            {new Date(snapshot.favoritedAt).toLocaleDateString("pt-BR")} ·
            preservada mesmo se o original mudar.
          </p>
          <DevotionalPage />
        </ReaderContext.Provider>
      ) : currentRecent ? (
        <ReaderContext.Provider value={{ date, data: { user: reader.data?.user ?? { id: "", name: "" }, devotional: currentRecent, settings: reader.data?.settings ?? null } }}>
          <DevotionalPage />
        </ReaderContext.Provider>
      ) : (
        <Empty title="Nenhuma leitura disponível." />
      )}
    </>
  );
}
function FavoriteButton({
  saved,
  undo,
  busy,
  disabled,
  onToggle,
}: {
  saved: boolean;
  undo?: boolean;
  busy: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const label = undo
    ? "Restaurar último favorito"
    : saved
      ? "Remover dos favoritos"
      : "Adicionar aos favoritos";
  return (
    <IconButton
      type="button"
      variant="secondary"
      title={label}
      aria-pressed={saved}
      aria-label={label}
      disabled={disabled ?? busy}
      onClick={onToggle}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </IconButton>
  );
}
function shortDate(date: string) {
  return date.split("-").reverse().join("/");
}
function RecentDevotional({
  devotional,
  selected,
  onSelect,
}: {
  devotional: Devotional;
  selected: boolean;
  onSelect: () => void;
}) {
  const date = devotional.date;
  return (
    <button
      type="button"
      aria-label={`Ler devocional de ${shortDate(date)}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="recent-devotional-heading">
        <time dateTime={date}>{shortDate(date)}</time>
        <span>{devotional.reference}</span>
      </span>
      <span className="recent-devotional-preview">
        {devotional.scripture}
      </span>
    </button>
  );
}
