import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { peregrinoModel, validationMessage, type BibleSelection } from "domain/core";
import { useApp } from "../context";
import { ErrorMessage } from "../components";
import { Button } from "../ui/button";

export function PeregrinoPanel({ selection, date, reflection, prayerSuggestion, onApply }: {
  selection?: BibleSelection;
  date?: string;
  reflection: string;
  prayerSuggestion: string;
  onApply(patch: { reflection?: string; prayerSuggestion?: string }): void;
}) {
  const app = useApp();
  const system = app.repository?.system;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ reflection?: string; prayerSuggestion?: string } | null>(null);
  useEffect(() => {
    if (!system) return;
    let active = true;
    system.peregrinoStatus().then(value => { if (active) setConfigured(value.configured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, [system]);
  if (!system || configured === null) return null;
  async function suggest(target: "both" | "reflection" | "prayer") {
    setBusy(true); setError(""); setDraft(null);
    try { setDraft(await system!.peregrinoSuggest({ selection, date, reflection, prayerSuggestion, target })); }
    catch (cause) { setError(validationMessage(cause)); }
    finally { setBusy(false); }
  }
  return (
    <section aria-label="Peregrino">
      <p>O Peregrino sugere um rascunho. Revise antes de salvar. Modelo: {peregrinoModel}.</p>
      {!configured && <p role="status">O Peregrino ainda não foi configurado. {app.localProfile?.superuser || app.pilotAccess?.superuser ? <Link to="/sistema/peregrino">Informar a chave</Link> : "Peça a um superusuário para informar a chave do OpenRouter."}</p>}
      {configured && (
        <div className="devotional-editor-actions">
          <Button type="button" disabled={busy} onClick={() => void suggest("both")}>Sugerir reflexão e oração</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void suggest("reflection")}>Sugerir só a reflexão</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void suggest("prayer")}>Sugerir só a oração</Button>
        </div>
      )}
      {busy && <p role="status">O Peregrino está preparando o rascunho…</p>}
      {error && <ErrorMessage message={error} />}
      {draft && (
        <div>
          {draft.reflection && <p>{draft.reflection}</p>}
          {draft.prayerSuggestion && <p>{draft.prayerSuggestion}</p>}
          <div className="devotional-editor-actions">
            <Button type="button" onClick={() => { onApply(draft); setDraft(null); }}>Usar sugestão</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Descartar</Button>
          </div>
        </div>
      )}
    </section>
  );
}
