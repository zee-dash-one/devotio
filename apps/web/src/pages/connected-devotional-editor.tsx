import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { bibleVersionNames, bibleVersionSchema, dateInZone, editorialDraft, editorialSaveSchema, imageTextLimitMessage, shiftEditorialMonth, validationMessage, type ConnectedEditorial, type ConnectedPublication, type EditorialDraft } from "domain/core";
import { useApp, useWriting } from "../context";
import { Dropdown } from "../dropdown";
import { Button } from "../ui/button";
import { PeregrinoPanel } from "./peregrino-panel";
import { BiblePickerButton } from "../ui/bible-picker-button";
import { ErrorMessage, Loading } from "../components";

export function ConnectedDevotionalEditor({ editorial, date }: { editorial: ConnectedEditorial; date?: string }) {
  const [entry, setEntry] = useState<ConnectedPublication | null | undefined>(date ? undefined : null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!date) return;
    let active = true;
    editorial.get(date).then(value => { if (active) setEntry(value); }).catch(cause => { if (active) setError(validationMessage(cause)); });
    return () => { active = false; };
  }, [date, editorial]);
  if (error) return <main className="devotional-editor"><ErrorMessage message={error} /></main>;
  if (entry === undefined) return <main className="devotional-editor"><Loading /></main>;
  if (date && !entry) return <main className="devotional-editor"><ErrorMessage message="Devocional não encontrado." /></main>;
  return <ConnectedEditorForm editorial={editorial} existing={entry ?? undefined} />;
}

function ConnectedEditorForm({ editorial, existing }: { editorial: ConnectedEditorial; existing?: ConnectedPublication }) {
  const app = useApp(), writing = useWriting(), navigate = useNavigate();
  const key = existing?.date ?? "new";
  const initial = editorialDraft(existing);
  const draft = writing.editors[key] ?? { ...initial, date: existing?.date ?? "", version: existing?.selection?.version ?? (existing ? undefined : "alm1911" as const) };
  const change = (patch: Partial<EditorialDraft>) => writing.setEditor(key, { ...draft, ...patch });
  const versions = app.repository?.bible?.versions ?? [];
  const today = dateInZone("America/Sao_Paulo");
  const [month, setMonth] = useState((draft.date || today).slice(0, 7));
  const [calendar, setCalendar] = useState<{ dates: string[]; credit: string }>();
  const [calendarError, setCalendarError] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setCalendar(undefined); setCalendarError("");
    editorial.calendar(month, today).then(value => { if (active) setCalendar(value); }).catch(cause => { if (active) setCalendarError(validationMessage(cause)); });
    return () => { active = false; };
  }, [editorial, month, today]);
  async function chooseScripture() {
    writing.setEditor(key, draft);
    const previous = writing.picker?.target.kind === "devotional" && writing.picker.target.key === key ? writing.picker : null;
    const book = previous?.book ?? draft.selection?.book ?? "jo", chapter = previous?.chapter ?? draft.selection?.chapter ?? 1;
    writing.setPicker({ target: { kind: "devotional", key, date: existing?.date }, book, chapter,
      selection: previous?.selection ?? draft.selection ?? null, query: draft.query, scrollY: previous?.scrollY });
    await navigate({ to: "/biblia", search: { book, chapter, pick: "devotional", version: draft.version ?? versions[0] } });
  }
  return <main className="devotional-editor">
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setError(""); setBusy(true);
      try {
        if (!existing && (!calendar || !calendar.dates.includes(draft.date))) throw new Error("Escolha uma data livre no calendário.");
        await editorial.save(editorialSaveSchema.parse({ date: existing?.date ?? draft.date, reflection: draft.reflection,
          prayerSuggestion: draft.prayerSuggestion, selection: draft.selection, reason: draft.reason, mode: existing ? "update" : "create" }));
        writing.setEditor(key, null); writing.setPicker(null);
        await navigate({ to: "/editorial" });
      } catch (cause) { setError(validationMessage(cause)); } finally { setBusy(false); }
    }}>
      <h1>{existing ? "Editar devocional" : "Novo devocional"}</h1>
      {existing ? <label>Data da leitura<input readOnly value={existing.date} /></label> : <div className="field">
        <span>Data da leitura</span>
        <div className="admin-actions">
          <Button type="button" variant="ghost" disabled={busy || month <= today.slice(0, 7)} onClick={() => { setMonth(shiftEditorialMonth(month, -1)); change({ date: "" }); }}>Mês anterior</Button>
          <span>{month}</span>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setMonth(shiftEditorialMonth(month, 1)); change({ date: "" }); }}>Próximo mês</Button>
        </div>
        <Dropdown label="Data da leitura" value={draft.date} disabled={!calendar} options={(calendar?.dates ?? []).map(date => ({ value: date, label: date.split("-").reverse().join("/") }))} onChange={date => change({ date })} />
        {!calendar && !calendarError && <p role="status">Consultando datas livres…</p>}
        {calendar?.dates.length === 0 && <p role="status">Nenhuma data livre neste mês. Escolha o próximo mês.</p>}
      </div>}
      {calendarError && <ErrorMessage message={calendarError} />}
      <div className="field"><span>Referência</span>
        <Button type="button" variant="secondary" onClick={() => void chooseScripture()} disabled={!versions.length}>
          <BookOpen size={18} />{draft.reference || "Escolher referência na Bíblia"}
        </Button>
      </div>
      <div className="field"><span>Tradução</span>
        <Dropdown label="Tradução" value={draft.version ?? ""} options={versions.map(version => ({ value: version, label: bibleVersionNames[version] }))}
          onChange={value => { const version = bibleVersionSchema.parse(value); change({ version, selection: undefined, reference: "", scripture: "", translation: "" }); writing.setPicker(null); }} />
        {existing && !draft.selection && draft.scripture && <p className="caption">Trecho original: {draft.translation}. Escolha na Bíblia para substituir.</p>}
      </div>
      <label>Texto bíblico<textarea readOnly rows={5} value={draft.scripture} placeholder="Selecione os versículos na leitura bíblica." /></label>
      <label>Reflexão<textarea required maxLength={512} rows={5} value={draft.reflection} onChange={event => change({ reflection: event.target.value })} /></label>
      <p className="caption">{draft.reflection.length}/512 caracteres{draft.reflection.length > 512 ? " — reduza o texto antes de salvar." : ""}</p>
      <label>Sugestão de oração<textarea required maxLength={512} rows={4} value={draft.prayerSuggestion} onChange={event => change({ prayerSuggestion: event.target.value })} /></label>
      <p className="caption">{draft.prayerSuggestion.length}/512 caracteres. A imagem leva o texto inteiro, em até 10 páginas.{draft.reflection.trim() && draft.prayerSuggestion.trim() ? " " + (imageTextLimitMessage({ reference: draft.reference || "Palavra", reflection: draft.reflection, prayerSuggestion: draft.prayerSuggestion }) ?? "") : ""}</p>
      <label>Créditos<input readOnly value={existing?.credit ?? calendar?.credit ?? ""} /></label>
      <label>Disponível a partir de (horário de Brasília)<input readOnly value={draft.date ? `${draft.date.split("-").reverse().join("/")} às 00:00` : "Escolha a data da leitura"} /></label>
      {existing && <label>Motivo da correção<input required maxLength={1000} value={draft.reason ?? ""} onChange={event => change({ reason: event.target.value })} /></label>}
      {existing && <p className="caption">O motivo fica no histórico administrativo e não aparece no devocional.</p>}
      {error && <ErrorMessage message={error} />}
      <div className="devotional-editor-actions">
        <Button type="submit" disabled={busy || !calendar || !!calendarError}>{busy ? "Salvando…" : "Salvar publicação"}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => { writing.setEditor(key, null); writing.setPicker(null); void navigate({ to: "/editorial" }); }}>Cancelar</Button>
      </div>
    </form>
    <PeregrinoPanel selection={draft.selection} date={existing?.date} reflection={draft.reflection} prayerSuggestion={draft.prayerSuggestion} onApply={patch => change(patch)} />
    <BiblePickerButton type="button" aria-label="Alternar para leitura bíblica" disabled={!versions.length} onClick={() => void chooseScripture()}><BookOpen size={22} /></BiblePickerButton>
  </main>;
}
