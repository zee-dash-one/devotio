import { useEffect, useState } from "react";
import { accessLabels, validationMessage, type SystemDirectoryUser } from "domain/core";
import { useApp } from "../context";
import { ErrorMessage } from "../components";
import { Button } from "../ui/button";

export function SystemUsersPage() {
  const app = useApp();
  const allowed = app.localProfile?.superuser === true || app.pilotAccess?.superuser === true;
  if (!allowed || !app.repository?.system) return <p role="alert">Acesso exclusivo de superusuários.</p>;
  return <UserDirectory />;
}

function UserDirectory() {
  const { repository } = useApp();
  const system = repository!.system!;
  const [users, setUsers] = useState<SystemDirectoryUser[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; email: string } | null>(null);
  const [typed, setTyped] = useState("");

  async function load() {
    setError("");
    try { setUsers(await system.listUsers()); }
    catch (cause) { setError(validationMessage(cause)); }
  }
  useEffect(() => { void load(); }, []);

  async function run(id: string, task: () => Promise<void>) {
    setBusy(id);
    setError("");
    try { await task(); setConfirm(null); setTyped(""); await load(); }
    catch (cause) { setError(validationMessage(cause)); }
    finally { setBusy(""); }
  }

  return (
    <div className="page">
      <h1>Gerenciar usuários</h1>
      <p>Aprove novos pedidos ou desative quem não deve entrar. Excluir só é possível quando a conta ainda não tem comunidades, recados ou envios. Para bloquear alguém com histórico, use Desativar.</p>
      {error && <ErrorMessage message={error} />}
      {!users ? <p role="status">Carregando cadastros…</p> : (
        <ul className="stack">
          {users.map(user => (
            <li key={user.id}>
              <p><strong>{user.name}</strong> · {user.email}</p>
              <p className="caption">{accessLabels[user.status]}{user.editorial ? " · Editorial" : ""}{user.superuser ? " · Superusuário" : ""}</p>
              <div className="devotional-editor-actions">
                {user.status !== "approved" && <Button type="button" disabled={busy === user.id} onClick={() => void run(user.id, () => system.setUserStatus(user.id, "approved"))}>Aprovar</Button>}
                {user.status !== "disabled" && <Button type="button" variant="secondary" disabled={busy === user.id} onClick={() => void run(user.id, () => system.setUserStatus(user.id, "disabled"))}>Desativar</Button>}
                <Button type="button" variant="ghost" disabled={busy === user.id} onClick={() => { setConfirm({ id: user.id, email: user.email }); setTyped(""); }}>Excluir cadastro</Button>
              </div>
              {confirm?.id === user.id && (
                <form onSubmit={event => { event.preventDefault(); void run(user.id, () => system.deleteUser(user.id, typed)); }}>
                  <label>Digite o e-mail para confirmar<input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" /></label>
                  <Button type="submit" disabled={busy === user.id}>Confirmar exclusão</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
