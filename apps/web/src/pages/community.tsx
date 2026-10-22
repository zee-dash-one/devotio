import { BiblePickerButton } from "../ui/bible-picker-button";
import { Button, buttonClassName, IconButton } from "../ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Users,
  Plus,
  KeyRound,
  MessageSquare,
  CheckCheck,
  Leaf,
  Copy,
  Trash2,
  Pencil,
  ArrowRight,
  Search,
  BookOpen,
} from "lucide-react";
import {
  useCommunities,
  useCommunity,
  useRepository,
  useWatch,
} from "domain/react";
import { Dropdown } from "../dropdown";
import {
  communitySchema,
  inviteSchema,
  messageSchema,
  checklistSchema,
  scriptureSchema,
  canManage,
  canRemoveMember,
  formatMessageDate,
  initials,
  validationMessage,
  quoteText,
  copy,
  type ChecklistItem,
  type Message,
} from "domain/core";
import {
  Empty,
  Loading,
  ErrorMessage,
  Modal,
  ActionForm,
  Field,
  Success,
} from "../components";
import { useWriting } from "../context";
import { Quote } from "../quote";
import { useFriends, CommunityFriendButton } from "../social";
import { CreationActions, MyJoinRequests, PendingJoinRequests, MemberGovernance, LeaveCommunity } from "../community-governance";
import { roleLabels } from "domain/core";
type DialogKind = "create" | "join" | null;
export function CommunitiesPage() {
  const { data, error } = useCommunities();
  const [dialog, setDialog] = useState<DialogKind>(null);
  return (
    <div className="page community-index">
      <div className="page-heading">
        <p className="eyebrow">
          <Users size={15} />
          JUNTOS NO CAMINHO
        </p>
        <h1>
          A fé também se vive
          <br />
          <em>em comunhão.</em>
        </h1>
        <p className="intro-copy">
          Presença, partilha e cuidado. Um lugar para caminhar juntos.
        </p>
      </div>
      <div className="section-top">
        <h2>Suas comunidades</h2>
        <Button
          variant="secondary"
          size="compact"
          onClick={() => setDialog("join")}
        >
          <KeyRound size={15} />
          Entrar com código
        </Button>
      </div>
      {error ? (
        <ErrorMessage message={error} />
      ) : !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Empty title="Sua caminhada pode ser compartilhada.">
          <p>
            Você ainda não participa de uma comunidade.
            <br />
            Peça um código à sua liderança para começar.
          </p>
        </Empty>
      ) : (
        <div className="community-grid">
          {data.map((group) => (
            <Link
              key={group.id}
              className="community-card"
              to="/comunidade/$communityId"
              params={{ communityId: group.id }}
            >
              <div className="community-card-top">
                <span className="community-symbol">
                  <Users size={25} strokeWidth={1.2} />
                </span>
                <ArrowUpRight size={20} />
              </div>
              <span className="eyebrow">
                {canManage(group.role)
                  ? "VOCÊ CUIDA DESTE ESPAÇO"
                  : "SEU ESPAÇO DE COMUNHÃO"}
              </span>
              <h2>{group.name}</h2>
              <p>
                {group.description || "Um espaço de Palavra, cuidado e oração."}
              </p>
              <span className="card-link">
                Abrir comunidade <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
      <MyJoinRequests />
      <CreationActions onCreate={() => setDialog("create")} />
      <aside className="community-note">
        <Leaf size={21} strokeWidth={1.2} />
        <p>
          Comunidade é presença.
          <br />
          <span>Sem comparações. Sem pressa. Cada pessoa, no seu caminho.</span>
        </p>
      </aside>
      {dialog && (
        <CommunityDialog kind={dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
function CommunityDialog({
  kind,
  onClose,
}: {
  kind: "create" | "join";
  onClose: () => void;
}) {
  const repo = useRepository();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [invitation, setInvitation] = useState<{
    code: string;
    name: string;
  } | null>(null);
  return (
    <Modal
      title={kind === "create" ? "Um novo começo." : "Encontre sua comunidade."}
      onClose={onClose}
    >
      <p className="dialog-description">
        {kind === "create"
          ? "Dê um nome a este espaço de comunhão. Você será responsável por cuidar dele."
          : "Insira o código de oito caracteres compartilhado pela liderança."}
      </p>
      {sent ? <Success>Pedido enviado. Aguarde a aprovação. Acompanhe em Suas solicitações.</Success> : kind === "create" ? (
        <ActionForm
          label="Criar comunidade"
          onSubmit={async (data) => {
            const input = communitySchema.parse({
              name: data.get("name"),
              description: data.get("description"),
            });
            const id = await repo.createCommunity(input);
            onClose();
            await navigate({
              to: "/comunidade/$communityId",
              params: { communityId: id },
            });
          }}
        >
          <Field
            name="name"
            label="Nome da comunidade"
            placeholder="Ex.: Comunidade Esperança"
            maxLength={80}
          />
          <Field
            name="description"
            label="Uma breve descrição (opcional)"
            placeholder="O que reúne vocês?"
            textarea
            maxLength={280}
            required={false}
          />
        </ActionForm>
      ) : invitation ? (
        <ActionForm
          label="Pedir entrada"
          onSubmit={async () => {
            await repo.joinCommunity(invitation.code);
            setSent(true);
          }}
        >
          <div className="invitation-preview">
            <Users size={24} />
            <span className="caption">VOCÊ ESTÁ ENTRANDO EM</span>
            <h3>{invitation.name}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setInvitation(null)}
          >
            Usar outro código
          </Button>
        </ActionForm>
      ) : (
        <ActionForm
          label="Encontrar comunidade"
          onSubmit={async (data) => {
            const code = inviteSchema.parse(data.get("code"));
            const found = await repo.previewInvite(code);
            if (!found)
              throw new Error(
                "Não encontramos uma comunidade com esse código.",
              );
            setInvitation({ code, name: found.name });
          }}
        >
          <Field
            name="code"
            label="Código de convite"
            placeholder="8 letras ou números"
            maxLength={8}
          />
        </ActionForm>
      )}
    </Modal>
  );
}
function Tick({ item }: { item: ChecklistItem }) {
  const repo = useRepository();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <li>
      <label className={"checklist-item" + (item.checked ? " checked" : "")}>
        <input
          type="checkbox"
          checked={item.checked}
          disabled={pending}
          onChange={async (event) => {
            const checked = event.target.checked;
            setPending(true);
            setError("");
            try {
              await repo.setTick(item.id, checked);
            } catch (e) {
              setError(validationMessage(e));
            } finally {
              setPending(false);
            }
          }}
        />
        <span className="check-visual">
          <CheckCheck size={15} />
        </span>
        <span className="check-text">
          {item.text}
          <small>
            {pending
              ? "Salvando…"
              : item.count === 1
                ? "1 pessoa marcou"
                : item.count + " pessoas marcaram"}
          </small>
        </span>
      </label>
      {error && <ErrorMessage message={error} />}
    </li>
  );
}
export function CommunityPage({
  id,
  tab = "mural",
  messageId,
}: {
  id: string;
  tab?: "mural" | "listas" | "membros";
  messageId?: string;
}) {
  const repo = useRepository();
  const writing = useWriting();
  const friends = useFriends(tab === "membros" ? repo.social : undefined);
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, error } = useCommunity(id, cursor);
  const [modal, setModal] = useState<
    "message" | "list" | "scripture" | "invite" | null
  >(writing.communities[id]?.open ? "message" : null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  if (error)
    return (
      <div className="page">
        <ErrorMessage message={error} />
      </div>
    );
  if (data === undefined)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  if (data === null)
    return (
      <div className="page">
        <Empty title="Um caminho diferente.">
          <p>{copy.revoked}</p>
          <Link
            to="/comunidade"
            className={buttonClassName({ variant: "secondary" })}
          >
            Suas comunidades
          </Link>
        </Empty>
      </div>
    );
  const group = data.community;
  const admin = canManage(group.role);
  return (
    <div className="page community-detail">
      <Link to="/comunidade" className="back-link">
        <ArrowLeft size={15} />
        Suas comunidades
      </Link>
      <div className="group-heading">
        <div>
          <p className="eyebrow">UM ESPAÇO DE COMUNHÃO</p>
          <h1>{group.name}</h1>
          <p className="intro-copy">
            {group.description || "Palavra, presença e cuidado, juntos."}
          </p>
        </div>
        {admin && (
          <Button
            variant="secondary"
            size="compact"
            onClick={() => setModal("invite")}
          >
            <KeyRound size={16} />
            Convidar
          </Button>
        )}
      </div>
      {(group.scripture || admin) && (
        <aside className="group-scripture">
          <Leaf size={21} />
          <p>
            {group.scripture || "Escolha uma palavra para guiar a comunidade."}
          </p>
          {admin && (
            <IconButton
              variant="ghost"
              aria-label="Editar escritura da comunidade"
              onClick={() => setModal("scripture")}
            >
              <Pencil size={16} />
            </IconButton>
          )}
        </aside>
      )}
      <nav className="group-tabs" aria-label="Áreas da comunidade">
        <Link
          activeOptions={{ exact: true }}
          to="/comunidade/$communityId"
          params={{ communityId: id }}
          className={tab === "mural" ? "active" : ""}
        >
          <MessageSquare size={17} />
          Mural
        </Link>
        <Link
          to="/comunidade/$communityId/listas"
          params={{ communityId: id }}
          className={tab === "listas" ? "active" : ""}
        >
          <CheckCheck size={17} />
          Listas
        </Link>
        <Link
          to="/comunidade/$communityId/membros"
          params={{ communityId: id }}
          className={tab === "membros" ? "active" : ""}
        >
          <Users size={17} />
          Membros
        </Link>
      </nav>
      {tab === "mural" ? (
        <section className="community-section">
          <div className="section-top">
            <div>
              <h2>Palavras para a comunidade</h2>
              <p className="caption">
                Avisos e mensagens de quem cuida deste espaço.
              </p>
            </div>
            {admin && (
              <Button size="compact" onClick={() => setModal("message")}>
                <Plus size={16} />
                Escrever
              </Button>
            )}
          </div>
          {messageId && repo.sharing && (
            <TargetMessage communityId={id} messageId={messageId} />
          )}
          {cursor && (
            <Button
              variant="ghost"
              className="load-more"
              onClick={() => setCursor(null)}
            >
              Voltar às recentes
            </Button>
          )}
          {data.hasMore && (
            <Button
              variant="ghost"
              className="load-more"
              onClick={() => setCursor(data.nextCursor)}
            >
              Carregar anteriores
            </Button>
          )}
          {data.messages.length ? (
            <div className="message-list">
              {data.messages.map((message) => (
                <article className="message-card" key={message.id}>
                  <header>
                    <span className="avatar">{initials(message.name)}</span>
                    <div>
                      <strong>{message.name}</strong>
                      <span>{formatMessageDate(message.sentAt)}</span>
                    </div>
                    <span className="message-author">Liderança</span>
                  </header>
                  {message.quote && <Quote quote={message.quote} />}
                  {message.content && <p>{message.content}</p>}
                </article>
              ))}
            </div>
          ) : (
            <Empty title="As palavras vão chegar.">
              <p>Os avisos da comunidade aparecerão aqui.</p>
            </Empty>
          )}
        </section>
      ) : tab === "listas" ? (
        <section className="community-section">
          <div className="section-top">
            <div>
              <h2>Pequenos gestos, juntos.</h2>
              <p className="caption">
                Suas marcações são pessoais. A comunidade vê apenas a contagem.
              </p>
            </div>
            {admin && (
              <Button size="compact" onClick={() => setModal("list")}>
                <Plus size={16} />
                Criar lista
              </Button>
            )}
          </div>
          {data.lists.length ? (
            <div className="checklists">
              {data.lists.map((list) => (
                <section className="checklist-card" key={list.id}>
                  <h3>
                    <Leaf size={18} />
                    {list.name}
                  </h3>
                  <ul>
                    {list.items.map((item) => (
                      <Tick item={item} key={item.id} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <Empty title="Espaço para o cuidado.">
              <p>As listas compartilhadas pela liderança aparecerão aqui.</p>
            </Empty>
          )}
        </section>
      ) : (
        <section className="community-section">
          <div className="section-top">
            <div>
              <h2>Quem caminha com você</h2>
              <p className="caption">
                Pessoas que fazem parte desta comunidade.
              </p>
            </div>
            <span className="caption">{data.members.length} pessoas</span>
          </div>
          {admin && repo.governance && <PendingJoinRequests governance={repo.governance} id={id} />}
          <ul className="member-list">
            {data.members.map((member) => (
              <li key={member.id}>
                <span className="avatar">{initials(member.name)}</span>
                <div>
                  <strong>{member.name}</strong>
                  <span>
                    {roleLabels[member.role]}
                  </span>
                </div>
                {admin && (
                  <IconButton
                    variant="ghost"
                    aria-label={"Remover " + member.name}
                    title={
                      canRemoveMember(
                        member.role,
                        data.members.filter((m) => canManage(m.role)).length,
                        group.role,
                      )
                        ? "Remover membro"
                        : copy.lastAdmin
                    }
                    disabled={
                      member.id === group.memberId || !canRemoveMember(
                        member.role,
                        data.members.filter((m) => canManage(m.role)).length,
                        group.role,
                      )
                    }
                    onClick={() =>
                      setRemoving({ id: member.id, name: member.name })
                    }
                  >
                    <Trash2 size={17} />
                  </IconButton>
                )}
                {admin && repo.governance && <MemberGovernance governance={repo.governance} group={group} member={member} />}
                {repo.social && friends.data && <CommunityFriendButton social={repo.social} data={friends.data} communityId={id} userId={member.userId} name={member.name} />}
              </li>
            ))}
          </ul>
          {repo.governance && <LeaveCommunity governance={repo.governance} group={group} />}
        </section>
      )}
      {modal && (
        <Modal
          title={
            modal === "message"
              ? "Uma palavra para a comunidade."
              : modal === "list"
                ? "Um convite ao cuidado."
                : modal === "scripture"
                  ? "A Palavra que nos reúne."
                  : "Convide alguém para caminhar."
          }
          onClose={() => {
            const current = writing.communities[id];
            if (current) writing.setCommunity(id, { ...current, open: false });
            setModal(null);
          }}
        >
          {modal === "message" && repo.sharing ? (
            <CommunityComposer
              communityId={id}
              admin={admin}
              onClose={() => setModal(null)}
            />
          ) : modal === "invite" ? (
            <div className="invite-content">
              <p>
                Compartilhe este código apenas com quem você deseja receber em{" "}
                <strong>{group.name}</strong>.
              </p>
              <code>{group.inviteCode}</code>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(group.inviteCode ?? "");
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy size={16} />
                Copiar código
              </Button>
              {copied && <Success>Código copiado.</Success>}
            </div>
          ) : (
            <ActionForm
              label={
                modal === "message"
                  ? "Publicar mensagem"
                  : modal === "list"
                    ? "Criar lista"
                    : "Salvar escritura"
              }
              onDone={() => setModal(null)}
              onSubmit={async (form) => {
                if (modal === "message")
                  await repo.sendMessage(
                    id,
                    messageSchema.parse(form.get("content")),
                  );
                if (modal === "scripture")
                  await repo.updateScripture(
                    id,
                    scriptureSchema.parse(form.get("scripture")),
                  );
                if (modal === "list") {
                  const value = checklistSchema.parse({
                    name: form.get("name"),
                    items: String(form.get("items"))
                      .split("\n")
                      .filter((line) => line.trim()),
                  });
                  await repo.createChecklist(id, value.name, value.items);
                }
              }}
            >
              {modal === "message" ? (
                <>
                  <p className="dialog-description">
                    Sua mensagem será lida pelos membros de {group.name}.
                  </p>
                  <Field
                    name="content"
                    label="Mensagem"
                    placeholder="Escreva com cuidado e simplicidade…"
                    textarea
                    maxLength={1000}
                  />
                </>
              ) : modal === "scripture" ? (
                <Field
                  name="scripture"
                  label="Texto e referência"
                  defaultValue={group.scripture}
                  textarea
                  maxLength={500}
                  required={false}
                />
              ) : (
                <>
                  <Field
                    name="name"
                    label="Nome da lista"
                    placeholder="Ex.: Motivos de oração"
                    maxLength={80}
                  />
                  <Field
                    name="items"
                    label="Itens (um por linha)"
                    placeholder="Pelas famílias da comunidade&#10;Por quem precisa de acolhimento"
                    textarea
                  />
                </>
              )}
            </ActionForm>
          )}
        </Modal>
      )}
      {removing && (
        <Modal title="Remover da comunidade?" onClose={() => setRemoving(null)}>
          <p className="dialog-description">
            {removing.name} perderá o acesso a {group.name}. O histórico será
            preservado.
          </p>
          <ActionForm
            label="Confirmar remoção"
            onSubmit={async () => repo.removeMember(id, removing.id)}
            onDone={() => setRemoving(null)}
          />
        </Modal>
      )}
    </div>
  );
}
function CommunityComposer({
  communityId,
  admin,
  onClose,
}: {
  communityId: string;
  admin: boolean;
  onClose: () => void;
}) {
  const repo = useRepository(),
    writing = useWriting(),
    navigate = useNavigate();
  const drafts = useWatch(
    useMemo(() => repo.sharing!.watchDrafts(communityId), [repo, communityId]),
  );
  const [initial] = useState(() => ({
    communityId,
    draftId: null,
    quote: null,
    comment: "",
    query: "",
    open: true,
    requestId: crypto.randomUUID(),
  }));
  const current = writing.communities[communityId] ?? initial;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const initialized = useRef(false);
  const setCommunity = writing.setCommunity;
  useEffect(() => {
    if (!drafts.data || initialized.current) return;
    initialized.current = true;
    const first = drafts.data[0];
    if (!current.draftId && !current.quote && first)
      setCommunity(communityId, {
        ...current,
        draftId: first.id,
        quote: first.quote,
        comment: current.comment || first.comment,
        open: true,
      });
    // Hydrate once; subsequent draft refreshes must not overwrite the writer's text.
  }, [drafts.data, communityId, setCommunity]);
  async function saveCurrent() {
    const saved = drafts.data?.find((draft) => draft.id === current.draftId);
    if (
      current.draftId &&
      current.quote &&
      (!saved ||
        saved.comment !== current.comment.trim() ||
        quoteText(saved.quote) !== quoteText(current.quote))
    )
      await repo.sharing!.updateDraft(
        communityId,
        current.draftId,
        current.quote,
        current.comment,
      );
  }
  async function chooseWord() {
    setBusy(true);
    setError("");
    try {
      await saveCurrent();
      writing.setCommunity(communityId, { ...current, open: true });
      const previous =
        writing.picker?.target.kind === "community" &&
        writing.picker.target.communityId === communityId &&
        writing.picker.target.draftId === current.draftId
          ? writing.picker
          : null;
      const book = previous?.book ?? current.quote?.book ?? "jo",
        chapter = previous?.chapter ?? current.quote?.chapter ?? 1;
      writing.setPicker({
        target: { kind: "community", communityId, draftId: current.draftId },
        book,
        chapter,
        selection:
          current.query.trim().length >= 4 && current.query !== previous?.query
            ? null
            : (previous?.selection ?? current.quote),
        query: current.query,
        scrollY: previous?.scrollY,
      });
      await navigate({
        to: "/biblia",
        search: { book, chapter, pick: "community", q: current.query },
      });
    } catch (cause) {
      setError(validationMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="community-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          if (current.quote && current.draftId)
            await repo.sharing!.publishDraft(
              communityId,
              current.draftId,
              current.quote,
              current.comment,
            );
          else if (current.quote)
            await repo.sharing!.sendQuote(
              communityId,
              current.quote,
              current.comment,
              current.requestId,
            );
          else
            await repo.sendMessage(
              communityId,
              messageSchema.parse(current.comment),
            );
          writing.setCommunity(communityId, null);
          writing.setPicker(null);
          onClose();
        } catch (cause) {
          setError(validationMessage(cause));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Preparar mensagem</h3>
      {drafts.error && <ErrorMessage message={drafts.error} />}
      {drafts.data && drafts.data.length > 0 && (
        <div className="field">
          <span>Rascunho salvo</span>
          <Dropdown
            label="Rascunho salvo"
            disabled={busy}
            value={current.draftId ?? ""}
            onChange={async (value) => {
              const next = drafts.data?.find((draft) => draft.id === value);
              setBusy(true);
              setError("");
              try {
                await saveCurrent();
                writing.setCommunity(communityId, {
                  ...initial,
                  draftId: next?.id ?? null,
                  quote: next?.quote ?? null,
                  comment: next?.comment ?? "",
                  requestId: crypto.randomUUID(),
                });
              } catch (cause) {
                setError(validationMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
            options={[
              { value: "", label: "Nova mensagem" },
              ...drafts.data.map((draft) => ({
                value: draft.id,
                label: `${draft.quote.reference} · ${formatMessageDate(draft.createdAt)}`,
              })),
            ]}
          />
        </div>
      )}
      {current.quote && <Quote quote={current.quote} />}
      {!admin && (
        <p role="alert">
          Você não administra mais esta comunidade. O rascunho não foi
          publicado.
        </p>
      )}
      <label className="field">
        <span>Pesquisar na Bíblia</span>
        <input
          maxLength={100}
          value={current.query}
          onChange={(event) =>
            writing.setCommunity(communityId, {
              ...current,
              query: event.target.value,
            })
          }
        />
      </label>
      <Button
        variant="secondary"
        type="button"
        disabled={busy || !admin}
        onClick={() => void chooseWord()}
      >
        <Search size={17} />
        Escolher trecho na Bíblia
      </Button>
      <label className="field">
        <span>{current.quote ? "Comentário (opcional)" : "Mensagem"}</span>
        <textarea
          maxLength={1000}
          value={current.comment}
          onChange={(event) =>
            writing.setCommunity(communityId, {
              ...current,
              comment: event.target.value,
              open: true,
            })
          }
        />
      </label>
      {error && <ErrorMessage message={error} />}
      <div className="editorial-actions">
        <Button disabled={busy || !admin || !drafts.data} type="submit">
          Publicar na comunidade
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          type="button"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await saveCurrent();
              writing.setCommunity(communityId, { ...current, open: false });
              onClose();
            } catch (cause) {
              setError(validationMessage(cause));
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar e fechar
        </Button>
        {current.draftId && (
          <Button
            variant="ghost"
            disabled={busy}
            type="button"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await repo.sharing!.deleteDraft(communityId, current.draftId!);
                writing.setCommunity(communityId, null);
                onClose();
              } catch (cause) {
                setError(validationMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            Descartar rascunho
          </Button>
        )}
      </div>
      <BiblePickerButton
        type="button"
        disabled={busy || !admin}
        aria-label="Rever seleção na Bíblia"
        onClick={() => void chooseWord()}
      >
        <BookOpen size={22} />
      </BiblePickerButton>
    </form>
  );
}
function TargetMessage({
  communityId,
  messageId,
}: {
  communityId: string;
  messageId: string;
}) {
  const repo = useRepository();
  const [state, setState] = useState<{
    id: string;
    message?: Message;
    error?: string;
  }>({ id: "" });
  useEffect(() => {
    let active = true;
    void repo.sharing!.message(communityId, messageId).then(
      (message) => {
        if (active) setState({ id: messageId, message });
      },
      (cause) => {
        if (active)
          setState({ id: messageId, error: validationMessage(cause) });
      },
    );
    return () => {
      active = false;
    };
  }, [repo, communityId, messageId]);
  if (state.id !== messageId) return <Loading />;
  if (state.error) return <ErrorMessage message={state.error} />;
  if (!state.message) return null;
  return (
    <article
      className="message-card notification-target"
      aria-label="Mensagem da notificação"
    >
      <p>
        <strong>{state.message.name}</strong> ·{" "}
        {formatMessageDate(state.message.sentAt)}
      </p>
      {state.message.quote && <Quote quote={state.message.quote} />}
      {state.message.content && <p>{state.message.content}</p>}
    </article>
  );
}
