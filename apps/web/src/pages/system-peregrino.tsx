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
    <form className="page peregrino-page" onSubmit={event => {
      event.preventDefault();
      const parsed = openRouterKeySchema.safeParse(key);
      if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
      setBusy(true); setError(""); setNotice("");
      void system.setOpenRouterKey(parsed.data).then(() => { setKey(""); setConfigured(true); setNotice("Chave salva. Ela não volta a ser exibida."); }).catch(cause => setError(validationMessage(cause))).finally(() => setBusy(false));
    }}>
      <h1>Peregrino e chave do OpenRouter</h1>
      <p>O ícone do Peregrino, no cadastro e na edição do devocional, abre um balão para pedir a meditação, a oração ou as duas. Esta tela é só para o superusuário guardar a chave.</p>
      <ol className="peregrino-steps">
        <li>Abra <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a> e entre na conta do OpenRouter.</li>
        <li>Crie uma chave. Ela começa com <strong>sk-or-</strong>. Copie na hora: o OpenRouter não mostra a chave inteira outra vez.</li>
        <li>Cole a chave no campo abaixo, sem aspas e sem espaço, e toque em <strong>Salvar chave</strong>. O Devotio guarda a chave só no servidor.</li>
        <li>O modelo não se escolhe aqui. O Peregrino sempre envia <strong>{peregrinoModel}</strong>, a rota gratuita do OpenRouter. Se essa rota estiver fora do ar, o balão pede para tentar de novo.</li>
      </ol>
      <label className="field">
        <span>Modelo</span>
        <input readOnly value={peregrinoModel} aria-describedby="peregrino-model-help" />
      </label>
      <p id="peregrino-model-help" className="caption">Para usar outro modelo é preciso alterar o aplicativo. Nesta tela você troca a chave; o modelo continua {peregrinoModel}.</p>
      <label className="field">
        <span>Chave da API</span>
        <input type="password" autoComplete="off" placeholder="sk-or-…" value={key} aria-describedby="peregrino-key-help" onChange={event => setKey(event.target.value)} />
      </label>
      <p id="peregrino-key-help" className="caption">A chave tem pelo menos 20 caracteres e começa com sk-or-. Salvar de novo substitui a chave anterior. Ela não volta para esta tela.</p>
      <p role="status">{configured ? "Há uma chave salva. O Peregrino já pode ser usado." : "Nenhuma chave salva. O Peregrino fica indisponível até você salvar uma."}</p>
      {error && <ErrorMessage message={error} />}
      {notice && <p role="status">{notice}</p>}
      <div className="devotional-editor-actions">
        <Button type="submit" disabled={busy}>Salvar chave</Button>
        <Button type="button" variant="secondary" disabled={busy || !configured} onClick={() => { setBusy(true); void system.clearOpenRouterKey().then(() => { setConfigured(false); setNotice("Chave removida."); }).catch(cause => setError(validationMessage(cause))).finally(() => setBusy(false)); }}>Remover chave</Button>
      </div>
    </form>
  );
}
