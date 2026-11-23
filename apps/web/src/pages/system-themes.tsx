import { useEffect, useState } from "react";
import { themesInputSchema, validationMessage, type ThemesInput } from "domain/core";
import { useApp } from "../context";
import { ErrorMessage } from "../components";
import { Button } from "../ui/button";

const empty: ThemesInput = { monthlyVerse: "", monthlyReference: "", weeklyVerse: "", weeklyReference: "" };

export function SystemThemesPage() {
  const app = useApp();
  const allowed = app.localProfile?.superuser === true || app.pilotAccess?.superuser === true;
  if (!allowed || !app.repository?.system) return <p role="alert">Acesso exclusivo de superusuários.</p>;
  return <ThemeForm />;
}

function ThemeForm() {
  const system = useApp().repository!.system!;
  const [draft, setDraft] = useState<ThemesInput>(empty);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    system.getThemes().then(value => { if (active) setDraft(value); }).catch(cause => { if (active) setError(validationMessage(cause)); });
    return () => { active = false; };
  }, [system]);
  function change(patch: Partial<ThemesInput>) { setDraft(current => ({ ...current, ...patch })); }
  return (
    <form className="page" onSubmit={event => {
      event.preventDefault();
      const parsed = themesInputSchema.safeParse(draft);
      if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
      setBusy(true); setError(""); setNotice("");
      void system.setThemes(parsed.data).then(() => setNotice("Temas atualizados.")).catch(cause => setError(validationMessage(cause))).finally(() => setBusy(false));
    }}>
      <h1>Temas do mês e da semana</h1>
      <p>Estes textos aparecem para quem lê o devocional. A leitura pública continua disponível para todas as contas aprovadas.</p>
      <label>Versículo do mês<textarea required maxLength={500} rows={4} value={draft.monthlyVerse} onChange={event => change({ monthlyVerse: event.target.value })} /></label>
      <label>Referência do mês<input required maxLength={160} value={draft.monthlyReference} onChange={event => change({ monthlyReference: event.target.value })} /></label>
      <label>Versículo da semana<textarea required maxLength={500} rows={3} value={draft.weeklyVerse} onChange={event => change({ weeklyVerse: event.target.value })} /></label>
      <label>Referência da semana<input required maxLength={160} value={draft.weeklyReference} onChange={event => change({ weeklyReference: event.target.value })} /></label>
      {error && <ErrorMessage message={error} />}
      {notice && <p role="status">{notice}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar temas"}</Button>
    </form>
  );
}
