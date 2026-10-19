import { BiblePickerButton } from "../ui/bible-picker-button";
import { Button } from "../ui/button";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useWatch } from "domain/react";
import {
  canPublish,
  bibleVersionNames,
  bibleVersionSchema,
  dateInZone,
  editorialDraft,
  scheduleSchema,
  scriptureLicenseForVersion,
  shiftEditorialMonth,
  validationMessage,
  type EditorialDraft,
  type Devotional,
  type ReadingRepository,
} from "domain/core";
import { useApp, useWriting } from "../context";
import { RouteRedirect } from "../redirect";
import { ConnectedDevotionalEditor } from "./connected-devotional-editor";
import { Dropdown } from "../dropdown";

export function DevotionalEditorPage() {
  const app = useApp();
  const { date } = useSearch({ from: "/editorial/cadastro" });
  if (!app.repository)
    return <RouteRedirect to="/entrar" redirect="/editorial/cadastro" />;
  if (app.connectedEditorial && app.pilotAccess?.editorial)
    return <ConnectedDevotionalEditor key={app.userKey + (date ?? "new")} editorial={app.connectedEditorial} date={date} />;
  if (!canPublish(app.localProfile?.editorial) || !app.repository.reading)
    return (
      <main className="devotional-editor">
        <p role="alert">Acesso exclusivo do Gestor do sistema.</p>
        <a href="/devocional">Voltar ao devocional</a>
      </main>
    );
  return date ? (
    <ExistingEditor
      key={app.userKey + date}
      reading={app.repository.reading}
      date={date}
    />
  ) : (
    <EditorForm key={app.userKey} reading={app.repository.reading} />
  );
}
function ExistingEditor({
  reading,
  date,
}: {
  reading: ReadingRepository;
  date: string;
}) {
  const state = useWatch(useMemo(() => reading.watchEditorial(), [reading]));
  if (state.error)
    return (
      <main className="devotional-editor">
        <p role="alert">{state.error}</p>
        <a href="/editorial">Voltar à gestão</a>
      </main>
    );
  if (!state.data)
    return (
      <main className="devotional-editor">
        <p role="status">Carregando devocional…</p>
      </main>
    );
  const entry = state.data.find((value) => value.devotional.date === date);
  if (!entry)
    return (
      <main className="devotional-editor">
        <p role="alert">Devocional não encontrado na listagem.</p>
        <a href="/editorial">Voltar à gestão</a>
      </main>
    );
  return <EditorForm reading={reading} existing={entry.devotional} />;
}
function EditorForm({
  reading,
  existing,
}: {
  reading: ReadingRepository;
  existing?: Devotional;
}) {
  const app = useApp();
  const navigate = useNavigate();
  const writing = useWriting();
  const key = existing?.date ?? "new";
  const draft = writing.editors[key] ?? editorialDraft(existing);
  const change = (patch: Partial<EditorialDraft>) =>
    writing.setEditor(key, { ...draft, ...patch });
  const [auxiliary, setAuxiliary] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const today = dateInZone("America/Sao_Paulo");
  const versions = app.repository?.bible?.versions ?? ["aa"];
  const [month, setMonth] = useState((draft.date || today).slice(0, 7));
  const [freeDates, setFreeDates] = useState<string[]>();
  const [calendarError, setCalendarError] = useState("");
  useEffect(() => {
    if (existing) return;
    let active = true;
    setFreeDates(undefined);
    setCalendarError("");
    reading.editorialCalendar(month, today).then(dates => { if (active) setFreeDates(dates); })
      .catch(cause => { if (active) setCalendarError(validationMessage(cause)); });
    return () => { active = false; };
  }, [existing, reading, month, today]);
  async function chooseWord() {
    writing.setEditor(key, draft);
    const previous =
      writing.picker?.target.kind === "devotional" &&
      writing.picker.target.key === key
        ? writing.picker
        : null;
    const book = previous?.book ?? draft.selection?.book ?? "jo",
      chapter = previous?.chapter ?? draft.selection?.chapter ?? 1;
    writing.setPicker({
      target: { kind: "devotional", key, date: existing?.date },
      book,
      chapter,
      selection:
        draft.query.trim().length >= 4 && draft.query !== previous?.query
          ? null
          : (previous?.selection ?? draft.selection ?? null),
      query: draft.query,
      scrollY: previous?.scrollY,
    });
    await navigate({
      to: "/biblia",
      search: { book, chapter, pick: "devotional", q: draft.query, version: draft.version ?? versions[0] },
    });
  }
  async function leave() {
    const origin =
      !existing &&
      writing.picker?.target.kind === "devotional" &&
      writing.picker.target.key === key
        ? writing.picker
        : null;
    writing.setEditor(key, null);
    writing.setPicker(null);
    if (origin)
      await navigate({
        to: "/biblia",
        search: { book: origin.book, chapter: origin.chapter },
      });
    else await navigate({ to: "/editorial" });
  }
  return (
    <main className="devotional-editor">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.scripture) {
            setError("Escolha a Palavra na leitura bíblica.");
            return;
          }
          if (!draft.programming) {
            change({ programming: true });
            return;
          }
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (!existing && (!freeDates || !freeDates.includes(draft.date)))
              throw new Error("Escolha uma data livre no calendário.");
            await reading.schedule(
              scheduleSchema.parse({
                ...draft,
                mode: existing ? "update" : "create",
                date: existing?.date ?? draft.date,
              }),
            );
            writing.setEditor(key, null);
            writing.setPicker(null);
            await navigate({ to: "/editorial" });
          } catch (cause) {
            setError(validationMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>{existing ? "Editar devocional" : "Cadastrar devocional"}</h1>
        <div className="field"><span>Referência</span>
          <Button type="button" variant="secondary" onClick={() => void chooseWord()}>
            <BookOpen size={18} />{draft.reference || "Escolher referência na Bíblia"}
          </Button>
        </div>
        <Dropdown label="Tradução" value={draft.version ?? draft.selection?.version ?? "aa"}
          options={versions.map(version => ({ value: version, label: bibleVersionNames[version] }))}
          onChange={value => { const version = bibleVersionSchema.parse(value); change({ version, selection: undefined, scripture: "", reference: "", translation: "", licenseEvidence: scriptureLicenseForVersion(version) }); writing.setPicker(null); }} />
        <label>
          Palavra
          <textarea
            name="scripture"
            readOnly
            rows={5}
            value={draft.scripture}
            placeholder="Escolha um trecho na Bíblia."
          />
        </label>
        {draft.reference && (
          <p>
            {draft.reference}
            <br />
            {draft.translation}
          </p>
        )}
        <div className="scripture-picker-search">
          <label>
            Pesquisar na Bíblia
            <input
              maxLength={100}
              value={draft.query}
              onChange={(event) => change({ query: event.target.value })}
              placeholder="Palavras do trecho ou deixe em branco"
            />
          </label>
          <Button
            variant="secondary"
            type="button"
            aria-label="Escolher Palavra na Bíblia"
            onClick={() => void chooseWord()}
          >
            <Search size={18} />
            Buscar na Bíblia
          </Button>
        </div>
        <label>
          Reflexão
          <textarea
            name="reflection"
            required
            maxLength={512}
            rows={9}
            value={draft.reflection}
            onChange={(event) => change({ reflection: event.target.value })}
          />
        </label>
        <label>
          Sugestão de oração
          <textarea
            name="prayerSuggestion"
            required
            maxLength={512}
            rows={4}
            value={draft.prayerSuggestion}
            onChange={(event) =>
              change({ prayerSuggestion: event.target.value })
            }
          />
        </label>
        <label>Créditos<input readOnly value={existing?.credit ?? app.localProfile?.name ?? ""} /></label>
        {draft.programming && (
          <div className="devotional-scheduling">
            {existing ? <label>Data da leitura<input readOnly value={existing.date} /></label> : <div className="field">
              <span>Data da leitura</span>
              <div className="admin-actions">
                <Button type="button" variant="ghost" disabled={busy || month <= today.slice(0, 7)} onClick={() => { setMonth(shiftEditorialMonth(month, -1)); change({ date: "" }); }}>Mês anterior</Button>
                <span>{month}</span>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => { setMonth(shiftEditorialMonth(month, 1)); change({ date: "" }); }}>Próximo mês</Button>
              </div>
              <Dropdown label="Data da leitura" value={draft.date} disabled={!freeDates} options={(freeDates ?? []).map(date => ({ value: date, label: date.split("-").reverse().join("/") }))} onChange={date => change({ date })} />
              {!freeDates && !calendarError && <p role="status">Consultando datas livres…</p>}
              {freeDates?.length === 0 && <p role="status">Nenhuma data livre neste mês. Escolha o próximo mês.</p>}
              {calendarError && <p role="alert">{calendarError}</p>}
            </div>}
            <p>
              Disponível à meia-noite no horário de Brasília.{" "}
              {existing
                ? "A data original será mantida."
                : "Selecione uma data livre."}
            </p>
            <label>Disponível a partir de (horário de Brasília)<input readOnly value={draft.date ? `${draft.date.split("-").reverse().join("/")} às 00:00` : "Escolha a data da leitura"} /></label>
            <label>
              Referência bíblica
              <input name="reference" readOnly value={draft.reference} />
            </label>
            <label>
              Fonte e condições de uso
              <input
                name="licenseEvidence"
                readOnly
                value={draft.licenseEvidence}
              />
            </label>
            {existing && <label>Motivo da correção<input required maxLength={1000} value={draft.reason ?? ""} onChange={event => change({ reason: event.target.value })} /></label>}
            {existing && <p className="caption">O motivo fica no histórico administrativo e não aparece no devocional.</p>}
            <p>
              Ao programar, você confirma a revisão humana do texto neste
              ambiente local.
            </p>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Salvando devocional…</p>}
        {auxiliary && (
          <p role="status">
            Peregrino será o auxílio para preparar devocionais. Ainda não está
            disponível; será desenvolvido na próxima tarefa.
          </p>
        )}
        <div className="devotional-editor-actions">
          <Button type="submit" disabled={busy}>
            Programar
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={busy}
            onClick={() => void leave()}
          >
            Cancelar
          </Button>
          <Button
            variant="ghost"
            type="button"
            aria-expanded={auxiliary}
            onClick={() => setAuxiliary((value) => !value)}
          >
            Auxílio
          </Button>
        </div>
      </form>
      <BiblePickerButton
        type="button"
        aria-label="Rever seleção na Bíblia"
        onClick={() => void chooseWord()}
      >
        <BookOpen size={22} />
      </BiblePickerButton>
    </main>
  );
}
