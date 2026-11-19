import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { validationMessage, type ConnectedEditorial, type ConnectedPublication } from "domain/core";
import { Button, buttonClassName } from "../ui/button";
import { ErrorMessage, Loading } from "../components";
import "../styles/administration.css";

export function ConnectedEditorialPage({ editorial }: { editorial: ConnectedEditorial }) {
  const [data, setData] = useState<{ entries: ConnectedPublication[]; cursor: string | null }>();
  const [cursor, setCursor] = useState<string | null>(null), [revision, setRevision] = useState(0);
  const [withdraw, setWithdraw] = useState<ConnectedPublication | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setData(undefined); setError("");
    editorial.list(cursor).then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(validationMessage(cause)); });
    return () => { active = false; };
  }, [editorial, cursor, revision]);
  return <section className="page connected-editorial">
    <h1>Gestão editorial</h1>
    <Link className={buttonClassName({})} to="/editorial/cadastro" search={{ date: undefined }}>Cadastrar devocional</Link>
    {error && <ErrorMessage message={error} />}
    {notice && <p role="status">{notice}</p>}
    {withdraw && <form className="admin-card admin-form" onSubmit={async event => {
      event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason"));
      setBusy(true); setError("");
      try { await editorial.withdraw(withdraw.id, reason); setWithdraw(null); setRevision(n => n + 1); setNotice("Publicação retirada."); }
      catch (cause) { setError(validationMessage(cause)); } finally { setBusy(false); }
    }}>
      <h2>Retirar publicação de {withdraw.date}?</h2>
      <label>Motivo da retirada<input name="reason" required maxLength={1000} /></label>
      <p className="caption">O motivo fica no histórico administrativo e não aparece no devocional.</p>
      <div className="admin-actions"><Button type="submit" disabled={busy}>Confirmar retirada</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setWithdraw(null)}>Cancelar retirada</Button></div>
    </form>}
    {!data ? !error && <Loading /> : <>
      {data.entries.length === 0 && <p>Nenhum devocional cadastrado.</p>}
      {data.entries.map(entry => <article className="admin-card" key={entry.id}>
        <p>{entry.date} · {entry.reference} · {entry.withdrawn ? "Retirado" : "Publicado / programado"}</p>
        <div className="admin-actions">
          <Link className={buttonClassName({ variant: "secondary" })} to="/editorial/cadastro" search={{ date: entry.date }}>Editar publicação</Link>
          <Button type="button" variant="ghost" disabled={busy || entry.withdrawn} onClick={() => setWithdraw(entry)}>Retirar</Button>
        </div>
      </article>)}
      <div className="admin-actions">
        <Button type="button" variant="secondary" disabled={!cursor || busy} onClick={() => setCursor(null)}>Primeira página</Button>
        <Button type="button" variant="secondary" disabled={!data.cursor || busy} onClick={() => setCursor(data.cursor)}>Próxima página</Button>
      </div>
    </>}
  </section>;
}

