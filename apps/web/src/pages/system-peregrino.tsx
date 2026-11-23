import { useEffect, useState } from "react";
import { openRouterKeySchema, peregrinoModel, validationMessage } from "domain/core";
import { useApp } from "../context";
import { ErrorMessage } from "../components";
import { Button } from "../ui/button";

export function SystemPeregrinoPage() {
  const app = useApp();
  const allowed = app.localProfile?.superuser === true || app.pilotAccess?.superuser === true;
  if (!allowed || !app.repository?.system) return <p role="alert">Acesso exclusivo de superusuários.</p>;
  return <KeyForm />;
}
function KeyForm() {
  const system = useApp().repository!.system!;
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    system.peregrinoKeyStatus().then(value => { if (active) setConfigured(value.configured); }).catch(cause => { if (active) setError(validationMessage(cause)); });
    return () => { active = false; };
  }, [system]);
  return (
    <form className="page" onSubmit={event => {
      event.preventDefault();
      const parsed = openRouterKeySchema.safeParse(key);
      if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
      setBusy(true); setError(""); setNotice("");
      void system.setOpenRouterKey(parsed.data).then(() => { setKey(""); setConfigured(true); setNotice("Chave salva. Ela não volta a ser exibida."); }).catch(cause => setError(validationMessage(cause))).finally(() => setBusy(false));
    }}>
      <h1>Peregrino</h1>
      <p>Modelo: {peregrinoModel}. A chave fica só no servidor. {configured ? "Há uma chave configurada." : "Nenhuma chave configurada."}</p>
      <label>Chave do OpenRouter<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} /></label>
      {error && <ErrorMessage message={error} />}
      {notice && <p role="status">{notice}</p>}
      <div className="devotional-editor-actions">
        <Button type="submit" disabled={busy}>Salvar chave</Button>
        <Button type="button" variant="secondary" disabled={busy || !configured} onClick={() => { setBusy(true); void system.clearOpenRouterKey().then(() => { setConfigured(false); setNotice("Chave removida."); }).catch(cause => setError(validationMessage(cause))).finally(() => setBusy(false)); }}>Remover chave</Button>
      </div>
    </form>
  );
}
