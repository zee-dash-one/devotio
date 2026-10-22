import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "domain/react";
import {
  accessLabels,
  validationMessage,
  type AccessStatus,
  type Administration,
  type AdminPage,
  type ManagedUser,
  type CommunityPermission,
} from "domain/core";
import { useApp } from "../context";
import { Brand, ErrorMessage, Loading } from "../components";
import { Button } from "../ui/button";
import "../styles/administration.css";

export function AdministrationPage() {
  const { administration } = useApp();
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.append(meta);
    document.title = "Gestão de acesso · Devotio";
    return () => meta.remove();
  }, []);
  return (
    <main className="page admin-page">
      <Brand />
      <h1>Gestão de acesso</h1>
      {administration ? (
        <AdminEntry administration={administration} />
      ) : (
        <p>O painel precisa da conexão com o ambiente publicado.</p>
      )}
    </main>
  );
}
function AdminEntry({ administration }: { administration: Administration }) {
  const { session, login, logout } = useAdminSession(administration);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (session)
    return (
      <>
        <div className="admin-heading">
          <p>Sessão de 30 minutos. Recarregar a página exige nova entrada.</p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await logout();
              } catch {
                setError(
                  "A sessão foi encerrada neste navegador. A revogação no servidor não pôde ser confirmada; ela expira em até 30 minutos.",
                );
              }
            }}
          >
            Sair do painel
          </Button>
        </div>
        <AdminUsers
          key={session.token}
          administration={administration}
          token={session.token}
        />
      </>
    );
  return (
    <form
      className="admin-form admin-login"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        try {
          await login({
            login: String(data.get("login")),
            password: String(data.get("password")),
            code: String(data.get("code")),
          });
          form.reset();
        } catch (error) {
          setError(validationMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Entrada exclusiva do responsável pelo piloto.</p>
      <label>
        Login (e-mail)
        <input
          name="login"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Senha
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      <label>
        Código do autenticador
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
        />
      </label>
      {error && <ErrorMessage message={error} />}
      <Button type="submit" disabled={busy}>
        {busy ? "Verificando…" : "Entrar"}
      </Button>
    </form>
  );
}
function AdminUsers({
  administration,
  token,
}: {
  administration: Administration;
  token: string;
}) {
  const [data, setData] = useState<AdminPage>(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    search: string;
    field: "name" | "email";
    status?: AccessStatus;
  }>({ search: "", field: "name" });
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<ManagedUser | null>(null);
  const [communityUser, setCommunityUser] = useState<ManagedUser | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    administration
      .list(token, { ...filter, cursor })
      .then((page) => {
        if (active) setData(page);
      })
      .catch((error) => {
        if (active) {
          setData(undefined);
          setError(validationMessage(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [administration, token, filter, cursor, refresh]);
  async function run(operation: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(message);
      setRefresh((n) => n + 1);
      return true;
    } catch (error) {
      setError(validationMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="admin-actions">
        <Button
          disabled={busy}
          onClick={() => {
            setEditing("new");
            setCommunityUser(null);
          }}
        >
          Criar usuário
        </Button>
        <Button
          variant="secondary"
          disabled={loading || busy}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Atualizar lista
        </Button>
      </div>
      <p>
        Novos participantes{" "}
        {data?.approvalRequired === false
          ? "entram sem aprovação prévia"
          : "aguardam aprovação"}
        . Pendentes e desativados mantêm sua situação.
      </p>
      {data && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(
              () => administration.setApproval(token, !data.approvalRequired),
              "Regra de entrada atualizada.",
            )
          }
        >
          {data.approvalRequired
            ? "Desligar aprovação para novos cadastros"
            : "Exigir aprovação para novos cadastros"}
        </Button>
      )}
      <form
        className="admin-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setCursor(null);
          setFilter({
            search: String(values.get("search")),
            field: values.get("field") as "name" | "email",
            status: (values.get("status") || undefined) as
              AccessStatus | undefined,
          });
        }}
      >
        <label>
          Buscar por
          <select name="field">
            <option value="name">Nome</option>
            <option value="email">E-mail</option>
          </select>
        </label>
        <label>
          Começa com
          <input name="search" maxLength={100} placeholder="Nome ou e-mail" />
        </label>
        <label>
          Situação
          <select name="status">
            <option value="">Todas</option>
            {Object.entries(accessLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          Buscar
        </Button>
      </form>
      {error && <ErrorMessage message={error} />}
      {notice && <p role="status">{notice}</p>}
      {editing && (
        <UserForm
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? undefined : editing}
          busy={busy}
          cancel={() => setEditing(null)}
          save={async (input) => {
            const ok = await run(
              async () => {
                const userId = editing === "new"
                  ? await administration.create(token, input)
                  : editing.id;
                if (editing !== "new") await administration.update(token, {
                      id: editing.id,
                      name: input.name,
                      status: input.status,
                      editorial: input.editorial,
                    });
                if (administration.setCommunityCreation) await administration.setCommunityCreation(token, { userId, allowed: input.communityCreationAllowed, limit: input.communityCreationLimit });
              },
              "Cadastro salvo.",
            );
            if (ok) setEditing(null);
          }}
        />
      )}
      {deactivating && (
        <section
          className="admin-confirm"
          role="alertdialog"
          aria-labelledby="deactivation-title"
          aria-describedby="deactivation-description"
        >
          <h2 id="deactivation-title">Desativar {deactivating.name}?</h2>
          <p id="deactivation-description">
            {deactivating.email} perderá o acesso. Os dados serão preservados e
            a conta poderá ser reativada.
          </p>
          <div className="admin-actions">
            <Button
              disabled={busy}
              onClick={async () => {
                const user = deactivating;
                if (
                  await run(
                    () =>
                      administration.update(token, {
                        id: user.id,
                        name: user.name,
                        editorial: user.editorial,
                        status: "disabled",
                      }),
                    "Conta desativada.",
                  )
                )
                  setDeactivating(null);
              }}
            >
              Confirmar desativação
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => setDeactivating(null)}
            >
              Cancelar
            </Button>
          </div>
        </section>
      )}
      {communityUser && (
        <CommunityPermissions
          key={communityUser.id}
          administration={administration}
          token={token}
          user={communityUser}
          close={() => setCommunityUser(null)}
        />
      )}
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption>Usuários do piloto</caption>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Situação</th>
                    <th>Permissões</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <br />
                        {user.email}
                        <br />
                        <small>
                          {user.linked ? "Conta vinculada" : "Pré-cadastro"}
                        </small>
                      </td>
                      <td>{accessLabels[user.status]}</td>
                      <td>
                        {user.editorial ? "Gestão editorial" : "Participante"}
                      </td>
                      <td>
                        <div className="admin-actions">
                          <Button
                            size="compact"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditing(user);
                              setCommunityUser(null);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="compact"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setCommunityUser(user);
                              setEditing(null);
                            }}
                          >
                            Comunidades
                          </Button>
                          {user.status !== "approved" && (
                            <Button
                              size="compact"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    administration.update(token, {
                                      ...user,
                                      status: "approved",
                                    }),
                                  "Acesso aprovado.",
                                )
                              }
                            >
                              {user.status === "disabled"
                                ? "Reativar"
                                : "Aprovar"}
                            </Button>
                          )}
                          {user.status !== "disabled" && (
                            <Button
                              size="compact"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setDeactivating(user)}
                            >
                              Desativar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.users.length === 0 && <p>Nenhum usuário encontrado.</p>}
            <div className="admin-actions">
              <Button
                variant="secondary"
                disabled={!cursor || busy}
                onClick={() => setCursor(null)}
              >
                Primeira página
              </Button>
              <Button
                variant="secondary"
                disabled={!data.cursor || busy}
                onClick={() => setCursor(data.cursor)}
              >
                Próxima página
              </Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
function UserForm({
  user,
  busy,
  save,
  cancel,
}: {
  user?: ManagedUser;
  busy: boolean;
  save: (input: {
    name: string;
    email: string;
    status: AccessStatus;
    editorial: boolean;
    communityCreationAllowed: boolean;
    communityCreationLimit: number;
  }) => Promise<void>;
  cancel: () => void;
}) {
  const [creationAllowed, setCreationAllowed] = useState(user?.communityCreation?.allowed ?? false);
  const [creationLimit, setCreationLimit] = useState(user?.communityCreation?.limit ?? 1);
  return (
    <form
      className="admin-form admin-card"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void save({
          name: String(data.get("name")),
          email: user?.email ?? String(data.get("email")),
          status: user?.status ?? (data.get("status") as AccessStatus),
          editorial: data.get("editorial") === "on",
          communityCreationAllowed: creationAllowed,
          communityCreationLimit: creationLimit,
        });
      }}
    >
      <h2>{user ? "Editar usuário" : "Criar pré-cadastro"}</h2>
      <label>
        Nome
        <input name="name" defaultValue={user?.name} required maxLength={100} />
      </label>
      <label>
        E-mail
        <input
          name="email"
          type="email"
          defaultValue={user?.email}
          readOnly={!!user}
          required
          maxLength={254}
        />
      </label>
      {!user && (
        <>
          <p>
            O vínculo será feito no login Google com este e-mail verificado.
          </p>
          <label>
            Acesso inicial
            <select name="status" defaultValue="approved">
              <option value="approved">Aprovado</option>
              <option value="pending">Aguardar aprovação</option>
            </select>
          </label>
        </>
      )}
      <label className="admin-check">
        <input
          name="editorial"
          type="checkbox"
          defaultChecked={user?.editorial}
        />
        Gestão editorial
      </label>
      <p>
        Administração de comunidades é concedida por grupo no botão Comunidades.
      </p>
      <label className="admin-check"><input type="checkbox" checked={creationAllowed} onChange={event => { setCreationAllowed(event.target.checked); if (event.target.checked && !creationAllowed) setCreationLimit(1); }} />Pode criar comunidades</label>
      <label>Limite de comunidades<input type="number" min={0} max={20} step={1} value={creationLimit} onChange={event => setCreationLimit(Number(event.target.value))} required /></label>
      <p>Usadas: {(user?.communityCreation?.owned ?? 0) > 20 ? "20+" : user?.communityCreation?.owned ?? 0}. Revogar a permissão ou reduzir o limite preserva as comunidades existentes.</p>
      <div className="admin-actions">
        <Button type="submit" disabled={busy}>
          Salvar
        </Button>
        <Button variant="secondary" disabled={busy} onClick={cancel}>
          Cancelar edição
        </Button>
      </div>
    </form>
  );
}
function CommunityPermissions({
  administration,
  token,
  user,
  close,
}: {
  administration: Administration;
  token: string;
  user: ManagedUser;
  close: () => void;
}) {
  const [data, setData] = useState<{
      communities: CommunityPermission[];
      cursor: string | null;
    }>(),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () => administration.communities(token, user.id, cursor),
    [administration, token, user.id, cursor],
  );
  useEffect(() => {
    let active = true;
    setData(undefined);
    load()
      .then((data) => {
        if (active) setData(data);
      })
      .catch((error) => {
        if (active) setError(validationMessage(error));
      });
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <section className="admin-card">
      <div className="admin-heading">
        <h2>Comunidades de {user.name}</h2>
        <Button variant="ghost" onClick={close}>
          Fechar comunidades
        </Button>
      </div>
      {error && <ErrorMessage message={error} />}
      {!data ? (
        !error && <Loading />
      ) : (
        <>
          {data.communities.length === 0 && (
            <p>Nenhuma comunidade cadastrada.</p>
          )}
          {data.communities.map((c) => (
            <form
              key={c.id}
              className="admin-community"
              onSubmit={async (event) => {
                event.preventDefault();
                const role = new FormData(event.currentTarget).get(
                  "role",
                ) as CommunityPermission["role"];
                setBusy(true);
                setError("");
                try {
                  await administration.setCommunity(token, {
                    userId: user.id,
                    communityId: c.id,
                    role,
                  });
                  setData(await load());
                } catch (error) {
                  setError(validationMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {c.name}
                <select key={c.role} name="role" defaultValue={c.role}>
                  <option value="none">Sem participação</option>
                  <option value="member">Membro</option>
                  <option value="admin">Administrador</option>
                  {c.role !== "none" && <option value="owner">Responsável (transferir posse)</option>}
                </select>
              </label>
              {c.role !== "none" && <p className="caption">Escolher Responsável transfere a posse para {user.name}; o responsável anterior vira administrador.</p>}
              <Button type="submit" disabled={busy}>
                Salvar permissão
              </Button>
            </form>
          ))}
          <div className="admin-actions">
            <Button
              variant="secondary"
              disabled={!cursor || busy}
              onClick={() => setCursor(null)}
            >
              Primeira página de comunidades
            </Button>
            <Button
              variant="secondary"
              disabled={!data.cursor || busy}
              onClick={() => setCursor(data.cursor)}
            >
              Próximas comunidades
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
