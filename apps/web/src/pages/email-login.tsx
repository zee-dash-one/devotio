import { useEffect, useState } from "react";
import { emailCodeSchema, emailLoginDestinationMessage, emailLoginSchema, validationMessage, type EmailLogin } from "domain/core";
import { ErrorMessage } from "../components";
import { Button } from "../ui/button";

/** Two steps: ask for a code, then confirm it. Same page for connected and local mode. */
export function EmailLoginForm({ login }: { login: EmailLogin }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    login.available().then(value => { if (active) setAvailable(value); }).catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [login]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await task(); }
    catch (cause) { setError(validationMessage(cause)); }
    finally { setBusy(false); }
  }
  const request = () => run(async () => {
    const parsed = emailLoginSchema.parse({ email });
    const result = await login.request(parsed.email);
    setEmail(parsed.email);
    setDevCode(result.devCode ?? "");
    setCode("");
    setSent(true);
  });
  const verify = () => run(async () => {
    await login.verify(emailLoginSchema.parse({ email }).email, emailCodeSchema.parse(code));
  });

  if (!available) return null;
  return (
    <form className="email-login" noValidate onSubmit={event => { event.preventDefault(); void (sent ? verify() : request()); }}>
      <p className="eyebrow">OU ENTRE COM SEU E-MAIL</p>
      {!sent ? (
        <label className="field">
          <span>E-mail</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} maxLength={160} onChange={event => setEmail(event.target.value)} />
        </label>
      ) : (
        <>
          <p role="status">{emailLoginDestinationMessage}</p>
          {devCode && <p className="caption" role="note">Ambiente local: o código é {devCode}.</p>}
          <label className="field">
            <span>Código de 6 números</span>
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
          </label>
        </>
      )}
      <div className="devotional-editor-actions">
        <Button type="submit" disabled={busy || (sent ? code.length !== 6 : !email.trim())}>{sent ? "Entrar" : "Enviar código"}</Button>
        {sent && <Button type="button" variant="ghost" disabled={busy} onClick={() => void request()}>Enviar de novo</Button>}
        {sent && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSent(false); setCode(""); setDevCode(""); setError(""); }}>Trocar e-mail</Button>}
      </div>
      {error && <ErrorMessage message={error} />}
    </form>
  );
}
